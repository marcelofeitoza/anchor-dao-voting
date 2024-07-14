import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { IronThroneConsensus } from "../target/types/iron_throne_consensus";

enum ProposalResult {
	For,
	Against,
	Tie,
}

describe("iron-throne-consensus", () => {
	anchor.setProvider(anchor.AnchorProvider.env());

	const program = anchor.workspace
		.IronThroneConsensus as Program<IronThroneConsensus>;
	const provider = anchor.getProvider();

	let creator: anchor.web3.Keypair = new anchor.web3.Keypair();
	const secondCreator = new anchor.web3.Keypair();

	let voters = [
		{ voter: "Jon Snow", keypair: new anchor.web3.Keypair(), vote: true },
		{
			voter: "Cersei Lannister",
			keypair: new anchor.web3.Keypair(),
			vote: false,
		},
		{
			voter: "Daenerys Taragaryen",
			keypair: new anchor.web3.Keypair(),
			vote: true,
		},
	];

	beforeAll(async () => {
		await provider.connection.confirmTransaction(
			await provider.connection.requestAirdrop(
				creator.publicKey,
				LAMPORTS_PER_SOL * 5
			)
		);

		await provider.connection.confirmTransaction(
			await provider.connection.requestAirdrop(
				secondCreator.publicKey,
				LAMPORTS_PER_SOL * 5
			)
		);

		for (let v of voters) {
			await provider.connection.confirmTransaction(
				await provider.connection.requestAirdrop(
					v.keypair.publicKey,
					10_000_000
				),
				"confirmed"
			);
		}
	});

	const [proposalPDA] = PublicKey.findProgramAddressSync(
		[Buffer.from("proposal"), creator.publicKey.toBuffer()],
		program.programId
	);

	it("Creates a proposal with initial deposit", async () => {
		const description = "Unite the Seven Kingdoms";
		const depositAmount = new anchor.BN(3 * LAMPORTS_PER_SOL);

		try {
			let proposalAccount = await createProposal(
				program,
				creator,
				description,
				depositAmount
			);
			expect(proposalAccount.description).toBe(description);
			expect(proposalAccount.votesFor.toString()).toEqual("0");
			expect(proposalAccount.votesAgainst.toString()).toEqual("0");
			expect(proposalAccount.rewardPool.toString()).toEqual(
				depositAmount.toString()
			);

			console.log(`Creates a proposal with initial deposit:\n
Proposal Description: ${proposalAccount.description}
Reward Pool: ${proposalAccount.rewardPool / LAMPORTS_PER_SOL} SOL
			`);
		} catch (err) {
			console.error("Error creating proposal:", err);
		}
	});

	it("Creates a proposal without initial deposit", async () => {
		const description = "Unite the North";
		const depositAmount = new anchor.BN(0);

		try {
			let proposalAccount = await createProposal(
				program,
				secondCreator,
				description,
				depositAmount
			);
			expect(proposalAccount.description).toBe(description);
			expect(proposalAccount.votesFor.toString()).toEqual("0");
			expect(proposalAccount.votesAgainst.toString()).toEqual("0");
			expect(proposalAccount.rewardPool.toString()).toEqual(
				depositAmount.toString()
			);

			console.log(`Creates a proposal without initial deposit:\n
Proposal Description: ${proposalAccount.description}
Reward Pool: ${proposalAccount.rewardPool / LAMPORTS_PER_SOL} SOL
			`);
		} catch (err) {
			console.error("Error creating proposal:", err);
		}
	});

	it("Should have received the deposit", async () => {
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

		console.log(`Should have received the deposit:\n
Reward Pool: ${proposalAccount.rewardPool.toNumber() / LAMPORTS_PER_SOL} SOL
Balance: ${proposalAccountBalance / LAMPORTS_PER_SOL} SOL
		`);
	});

	it("Voters vote for the proposal", async () => {
		let proposalAccount = await getProposal(program, proposalPDA);

		for (let v of voters) {
			proposalAccount = await vote(program, proposalPDA, v, v.vote);
		}
		expect(proposalAccount.votesFor.toString()).toEqual("2");
		expect(proposalAccount.votesAgainst.toString()).toEqual("1");

		console.log(`Voters vote for the proposal:\n
Total Votes For: ${proposalAccount.votesFor}
Total Votes Against: ${proposalAccount.votesAgainst}
		`);
	});

	it("Should list all proposals", async () => {
		const proposals = await listAllProposals(program);
		expect(proposals.length).toBe(2);

		console.log(`Should list all proposals:\n
Total Proposals: ${proposals.length}
		`);
	});

	it("Should list the details of a proposal", async () => {
		const proposalAccount = await getProposal(program, proposalPDA);
		expect(proposalAccount.description).toBe("Unite the Seven Kingdoms");
		expect(proposalAccount.votesFor.toString()).toEqual("2");
		expect(proposalAccount.votesAgainst.toString()).toEqual("1");
		expect(proposalAccount.rewardPool.toString()).toEqual(
			(3 * LAMPORTS_PER_SOL).toString()
		);

		console.log(`Should list the details of a proposal:\n
Proposal Description: ${proposalAccount.description}
Total Votes For: ${proposalAccount.votesFor}
Total Votes Against: ${proposalAccount.votesAgainst}
Reward Pool: ${proposalAccount.rewardPool / LAMPORTS_PER_SOL} SOL
		`);
	});

	it("Finalizes the proposal and distributes rewards", async () => {
		const voterAccountAddresses = await getVoterAccounts(
			program,
			proposalPDA
		);
		const initialBalances = await Promise.all(
			voterAccountAddresses.map((acc) =>
				provider.connection.getBalance(acc.pubkey)
			)
		);

		await finalizeProposal(program, proposalPDA, creator, [
			...voterAccountAddresses.map((acc) => acc.pubkey),
		]);

		const finalizedProposalAccount = await getProposal(
			program,
			proposalPDA
		);
		expect(finalizedProposalAccount.onGoing).toBe(false);
		expect(finalizedProposalAccount.rewardPool.toNumber()).toBe(0);

		const finalBalances = await Promise.all(
			voterAccountAddresses.map((acc) =>
				provider.connection.getBalance(acc.pubkey)
			)
		);
		voterAccountAddresses.forEach((_, index) => {
			const expectedIncrease =
				new anchor.BN(finalizedProposalAccount.rewardPool).toNumber() /
				voterAccountAddresses.length;
			const actualIncrease =
				finalBalances[index] - initialBalances[index];
			expect(actualIncrease).toBeGreaterThanOrEqual(expectedIncrease);
		});
		expect(finalizedProposalAccount.result).toBe(ProposalResult.For);

		console.log(`Finalizes the proposal and distributes rewards:\n
Proposal Description: ${finalizedProposalAccount.description}
Reward Pool: ${finalizedProposalAccount.rewardPool / LAMPORTS_PER_SOL} SOL
Voters balances before finalization: [\n${voterAccountAddresses
			.map((acc, index) => {
				return `\t${acc.pubkey}: ${
					initialBalances[index] / LAMPORTS_PER_SOL
				} SOL`;
			})
			.join("\n")}\n]
Voters balances after finalization: [\n${voterAccountAddresses
			.map((acc, index) => {
				return `\t${acc.pubkey}: ${
					finalBalances[index] / LAMPORTS_PER_SOL
				} SOL`;
			})
			.join("\n")}\n]
		`);
	});

	it("Displays detailed results of the proposal", async () => {
		const proposalAccount = await getProposal(program, proposalPDA);

		const resultString =
			proposalAccount.result === ProposalResult.For
				? "For"
				: proposalAccount.result === ProposalResult.Against
				? "Against"
				: "Tie";

		expect(proposalAccount.onGoing).toBe(false);
		expect(proposalAccount.result).toBeDefined();
		expect(
			proposalAccount.votesForPercentage +
				proposalAccount.votesAgainstPercentage
		).toBeCloseTo(100, 1);

		console.log(`Displays detailed results of the proposal:\n
Proposal Description: ${proposalAccount.description}
Ongoing: ${proposalAccount.onGoing ? "Yes" : "No"}
Total Votes For: ${proposalAccount.votesFor}
Total Votes Against: ${proposalAccount.votesAgainst}
Votes For Percentage: ${proposalAccount.votesForPercentage?.toFixed(2)}%
Votes Against Percentage: ${proposalAccount.votesAgainstPercentage?.toFixed(2)}%
Voters: [\n${voters
			.map(
				(v) =>
					`\t${v.vote ? "For" : "Against"}: ${v.keypair.publicKey} (${
						v.voter
					})`
			)
			.join("\n")}\n]
Result: ${resultString}
		`);
	});
});

async function listAllProposals(program) {
	const proposals = await program.account.proposal.all();
	return proposals;
}

async function getProposal(program, proposalPDA) {
	return await program.account.proposal.fetch(proposalPDA);
}

async function createProposal(program, creator, description, depositAmount) {
	const [proposalPDA] = PublicKey.findProgramAddressSync(
		[Buffer.from("proposal"), creator.publicKey.toBuffer()],
		program.programId
	);

	await program.methods
		.createProposal(description, new anchor.BN(depositAmount))
		.accounts({
			proposal: proposalPDA,
			user: creator.publicKey,
			systemProgram: anchor.web3.SystemProgram.programId,
		})
		.signers([creator])
		.rpc();

	return await getProposal(program, proposalPDA);
}

async function vote(program, proposalPDA, voter, vote) {
	const [voterPDA] = PublicKey.findProgramAddressSync(
		[proposalPDA.toBuffer(), voter.keypair.publicKey.toBuffer()],
		program.programId
	);

	await program.methods
		.voteProposal(vote)
		.accounts({
			proposal: proposalPDA,
			voterAccount: voterPDA,
			systemProgram: anchor.web3.SystemProgram.programId,
			user: voter.keypair.publicKey,
		})
		.signers([voter.keypair])
		.rpc();

	return await getProposal(program, proposalPDA);
}

async function finalizeProposal(
	program,
	proposalPDA,
	creator,
	voterPublicKeys
) {
	const voterAccountAddresses = voterPublicKeys.map((voterPublicKey) => ({
		pubkey: voterPublicKey,
		isWritable: true,
		isSigner: false,
	}));

	await program.methods
		.finalizeProposal()
		.accounts({
			proposal: proposalPDA,
			creator: creator.publicKey,
			systemProgram: anchor.web3.SystemProgram.programId,
		})
		.remainingAccounts(voterAccountAddresses)
		.signers([creator])
		.rpc();

	return await getProposal(program, proposalPDA);
}

async function getVoterAccounts(
	program: Program<IronThroneConsensus>,
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
