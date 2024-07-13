import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
	airdropSol,
	createRpc,
	LightSystemProgram,
	buildTx,
	sendAndConfirmTx,
	defaultTestStateTreeAccounts,
} from "@lightprotocol/stateless.js";
import {
	clusterApiUrl,
	Connection,
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	SystemProgram,
} from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { DaoVoting } from "../target/types/dao_voting";

async function createToken(payer: anchor.web3.Keypair | anchor.web3.Signer) {
	const connection = new Connection("http://localhost:8899", "confirmed");

	const airdropSignature = await connection.requestAirdrop(
		payer.publicKey,
		LAMPORTS_PER_SOL // Airdrop 1 SOL
	);
	await connection.confirmTransaction(airdropSignature);

	const mint = await createMint(connection, payer, payer.publicKey, null, 9);

	console.log(`Token created with mint address: ${mint}`);

	return mint;
}

enum ProposalResult {
	For = 0,
	Against = 1,
	Tie = 2,
}

describe("dao-voting", () => {
	anchor.setProvider(anchor.AnchorProvider.env());

	const program = anchor.workspace.DaoVoting as Program<DaoVoting>;
	const provider = anchor.getProvider();

	let proposal: anchor.web3.Keypair;
	let creator: anchor.web3.Keypair = new anchor.web3.Keypair();
	let token: PublicKey;

	beforeAll(async () => {
		token = await createToken(creator);
	});

	let voters = [
		{ voter: "voterA", keypair: new anchor.web3.Keypair(), vote: true },
		{ voter: "voterB", keypair: new anchor.web3.Keypair(), vote: false },
		{ voter: "voterC", keypair: new anchor.web3.Keypair(), vote: true },
	];

	beforeAll(async () => {
		await provider.connection.confirmTransaction(
			await provider.connection.requestAirdrop(
				creator.publicKey,
				LAMPORTS_PER_SOL * 5
			)
		);

		for (let v of voters) {
			await provider.connection.confirmTransaction(
				await provider.connection.requestAirdrop(
					v.keypair.publicKey,
					2 * LAMPORTS_PER_SOL
				),
				"confirmed"
			);
		}
	});

	afterEach(async () => {
		const balances = [];

		const creatorBalance = await provider.connection.getBalance(
			creator.publicKey
		);
		balances.push({
			pubKey: creator.publicKey.toBase58(),
			balance: creatorBalance,
		});

		await Promise.all(
			voters.map((v) => {
				const b = provider.connection.getBalance(v.keypair.publicKey);
				balances.push({
					pubKey: v.keypair.publicKey.toBase58(),
					balance: b,
				});
			})
		);

		console.log(
			`Balances: ${balances
				.map(
					(b) =>
						b.pubKey + ": " + b.balance / LAMPORTS_PER_SOL + " SOL"
				)
				.join(", ")}`
		);
	});

	const [proposalPDA, proposalBump] = PublicKey.findProgramAddressSync(
		[Buffer.from("proposal"), creator.publicKey.toBuffer()],
		program.programId
	);

	it("Creates a proposal with initial deposit", async () => {
		console.log("Creates a proposal with initial deposit");

		const description = "Test of proposal";
		const depositAmount = new anchor.BN(3 * LAMPORTS_PER_SOL);

		try {
			await program.methods
				.createProposal(description, depositAmount)
				.accounts({
					proposal: proposalPDA,
					user: creator.publicKey,
					systemProgram: SystemProgram.programId,
				})
				.signers([creator])
				.rpc();
		} catch (err) {
			console.error("Error creating proposal:", err);
		}

		const proposalAccount = await program.account.proposal.fetch(
			proposalPDA
		);
		expect(proposalAccount.description).toBe(description);
		expect(proposalAccount.votesFor.toString()).toEqual("0");
		expect(proposalAccount.votesAgainst.toString()).toEqual("0");
		expect(proposalAccount.rewardPool.toString()).toEqual(
			depositAmount.toString()
		);
	});

	it("Should have received the deposit", async () => {
		console.log("Should have received the deposit");

		const proposalAccount = await program.account.proposal.fetch(
			proposalPDA
		);
		expect(proposalAccount.rewardPool.toString()).toEqual(
			(3 * LAMPORTS_PER_SOL).toString()
		);
		const proposalAccountBalance = await provider.connection.getBalance(
			proposalPDA
		);
		expect(proposalAccountBalance).toBeGreaterThanOrEqual(LAMPORTS_PER_SOL);
	});

	it("Voters vote for the proposal", async () => {
		console.log("Voters vote for the proposal");

		for (let v of voters) {
			const [voterPDA] = PublicKey.findProgramAddressSync(
				[proposalPDA.toBuffer(), v.keypair.publicKey.toBuffer()],
				program.programId
			);
			await program.methods
				.voteProposal(v.vote)
				.accounts({
					proposal: proposalPDA,
					voterAccount: voterPDA,
					systemProgram: SystemProgram.programId,
					user: v.keypair.publicKey,
				})
				.signers([v.keypair])
				.rpc();
		}

		const proposalAccount = await program.account.proposal.fetch(
			proposalPDA
		);
		expect(proposalAccount.votesFor.toString()).toEqual("2");
		expect(proposalAccount.votesAgainst.toString()).toEqual("1");
	});

	it("Finalizes the proposal and distributes rewards", async () => {
		console.log("Finalizes the proposal and distributes rewards");

		const voterAccountAddresses = await getVoterAccounts(
			program,
			proposalPDA
		);
		const initialBalances = await Promise.all(
			voterAccountAddresses.map((acc) =>
				provider.connection.getBalance(acc.pubkey)
			)
		);

		voterAccountAddresses.forEach((acc, index) => {
			console.log(
				`Initial balance of Voter ${acc.pubkey.toBase58()}: ${
					initialBalances[index] / LAMPORTS_PER_SOL
				} SOL`
			);
		});

		await program.methods
			.finalizeProposal()
			.accounts({
				proposal: proposalPDA,
				creator: creator.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.remainingAccounts(voterAccountAddresses)
			.signers([creator])
			.rpc();

		const finalizedProposalAccount = await program.account.proposal.fetch(
			proposalPDA
		);
		expect(finalizedProposalAccount.onGoing).toBe(false);
		expect(finalizedProposalAccount.rewardPool.toNumber()).toBe(0);

		const finalBalances = await Promise.all(
			voterAccountAddresses.map((acc) =>
				provider.connection.getBalance(acc.pubkey)
			)
		);

		voterAccountAddresses.forEach((acc, index) => {
			const expectedIncrease =
				new anchor.BN(finalizedProposalAccount.rewardPool).toNumber() /
				voterAccountAddresses.length;
			const actualIncrease =
				finalBalances[index] - initialBalances[index];
			console.log(
				`Final balance of Voter ${acc.pubkey.toBase58()}: ${
					finalBalances[index] / LAMPORTS_PER_SOL
				} SOL`
			);
			expect(actualIncrease).toBeGreaterThanOrEqual(expectedIncrease);
		});
	});
});

async function getVoterAccounts(
	program: Program<DaoVoting>,
	proposalPDA: PublicKey
) {
	const proposalAccount = await program.account.proposal.fetch(proposalPDA);
	return proposalAccount.voters.map((voterPublicKey) => {
		return {
			pubkey: voterPublicKey,
			isWritable: true,
			isSigner: false,
		};
	});
}
