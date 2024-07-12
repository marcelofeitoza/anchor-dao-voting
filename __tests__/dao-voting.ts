import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DaoVoting } from "../target/types/dao_voting";
import {
	airdropSol,
	createRpc,
	LightSystemProgram,
	buildTx,
	sendAndConfirmTx,
	defaultTestStateTreeAccounts,
} from "@lightprotocol/stateless.js";
import {
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	sendAndConfirmTransaction,
	SendTransactionError,
} from "@solana/web3.js";

const rpc = createRpc(
	"http://localhost:8899",
	"http://localhost:8784",
	"http://localhost:3001"
);

async function airdropForTesting(recipientPublicKey: anchor.web3.PublicKey) {
	await airdropSol({
		connection: rpc,
		lamports: 1e11,
		recipientPublicKey,
	});
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

	let voters = [
		{ voter: "voterA", keypair: new anchor.web3.Keypair(), vote: true },
		{ voter: "voterB", keypair: new anchor.web3.Keypair(), vote: false },
		{ voter: "voterC", keypair: new anchor.web3.Keypair(), vote: true },
	];

	beforeAll(async () => {
		for (let v of voters) {
			await provider.connection.confirmTransaction(
				await provider.connection.requestAirdrop(
					v.keypair.publicKey,
					2 * LAMPORTS_PER_SOL
				),
				"confirmed"
			);

			console.log(
				`Airdropped ${2 * LAMPORTS_PER_SOL} to ${
					v.voter
				} account\nBalance: ${
					(await provider.connection.getBalance(
						v.keypair.publicKey
					)) / LAMPORTS_PER_SOL
				} SOL`
			);
		}
	});

	// it("Creates a proposal", async () => {
	// 	proposal = anchor.web3.Keypair.generate();

	// 	const proposalDescription = "Test of proposal";

	// 	const tx = await program.methods
	// 		.createProposal(proposalDescription, new anchor.BN(100))
	// 		.accounts({
	// 			proposal: proposal.publicKey,
	// 			user: provider.publicKey,
	// 			systemProgram: anchor.web3.SystemProgram.programId,
	// 		})
	// 		.signers([proposal])
	// 		.rpc();
	// 	console.log(tx);

	// 	const proposalAccount = await program.account.proposal.fetch(
	// 		proposal.publicKey
	// 	);

	// 	expect(proposalAccount.description).toBe(proposalDescription);
	// 	expect(proposalAccount.votesFor.toString()).toEqual("0");
	// 	expect(proposalAccount.votesAgainst.toString()).toEqual("0");
	// });
	it("Creates a proposal", async () => {
		const proposal = Keypair.generate();
		const description = "Test of proposal";
		const depositAmount = new anchor.BN(100000000);

		const airdropSignature = await provider.connection.requestAirdrop(
			provider.publicKey,
			1000000000
		);
		await provider.connection.confirmTransaction(airdropSignature);

		await program.methods
			.createProposal(description, depositAmount)
			.accounts({
				systemProgram: anchor.web3.SystemProgram.programId,
				proposal: proposal.publicKey,
				user: provider.publicKey,
			})
			.signers([proposal])
			.rpc()
			.then((res) => console.log(res))
			.catch((err) => console.log(err));

		const proposalAccount = await program.account.proposal.fetch(
			proposal.publicKey
		);
		console.log(proposalAccount);
		expect(proposalAccount.description).toBe(description);
		expect(proposalAccount.votesFor.toString()).toEqual("0");
		expect(proposalAccount.votesAgainst.toString()).toEqual("0");
		expect(proposalAccount.rewardPool.toString()).toEqual(
			depositAmount.toString()
		);
	});

	it("Voters vote for the proposal", async () => {
		for (let i = 0; i < voters.length; i++) {
			async function voteWithCompression(
				voterKeypair: Keypair,
				proposalId: PublicKey,
				vote: boolean
			) {
				try {
					// const compressedData = await LightSystemProgram.compress({
					// 	payer: voterKeypair.publicKey,
					// 	toAddress: proposalId,
					// 	lamports: vote ? new anchor.BN(1) : new anchor.BN(0),
					// 	outputStateTree:
					// 		defaultTestStateTreeAccounts().merkleTree,
					// });

					const instruction = await program.methods
						.voteProposal(vote)
						.accounts({
							proposal: proposalId,
							voter: voterKeypair.publicKey,
						})
						.signers([voterKeypair])
						.rpc();
					console.log(instruction);

					// const tx = buildTx(
					// 	[compressedData, instruction],
					// 	voterKeypair.publicKey,
					// 	(await rpc.getLatestBlockhash()).blockhash
					// );
					// await sendAndConfirmTx(rpc, tx).then((res) =>
					// 	console.log(res)
					// );
				} catch (error: any) {
					if (error instanceof SendTransactionError) {
						console.log(
							"Error voting with SendTransactionError: ",
							error.logs,
							error.message
						);
					} else {
						console.log("Error voting with compression: ", error);
					}
				}
			}

			await voteWithCompression(
				voters[i].keypair,
				proposal.publicKey,
				voters[i].vote
			);
		}

		const updatedProposalAccount = await program.account.proposal.fetch(
			proposal.publicKey
		);

		console.log(
			"Voters vote for the proposal: ",
			updatedProposalAccount.voters
		);
		expect(updatedProposalAccount.votesFor.toString()).toEqual("2");
		expect(updatedProposalAccount.votesAgainst.toString()).toEqual("1");
	});

	it("Errors when Voter votes again (either for or against) the proposal", async () => {
		try {
			await program.methods
				.voteProposal(true)
				.accounts({
					proposal: proposal.publicKey,
					voter: voters[0].keypair.publicKey,
				})
				.signers([voters[0].keypair])
				.rpc();
		} catch (error: any) {
			expect(error.error.errorMessage).toEqual("Already voted.");
		}
	});

	it("Should get all votes and voters for the proposal", async () => {
		const proposalACcount = await program.account.proposal.fetch(
			proposal.publicKey
		);

		const votesFor = proposalACcount.votesFor;
		const votesAgainst = proposalACcount.votesAgainst;
		const voters = proposalACcount.voters;

		// console.log(votesFor.toString());
		// console.log(votesAgainst.toString());
		// console.log(voters);

		expect(votesFor.toString()).toEqual(new anchor.BN(2).toString());
		expect(votesAgainst.toString()).toEqual(new anchor.BN(1).toString());
		expect(voters).toHaveLength(3);
	});

	it("Creator finalizes the proposal", async () => {
		await program.methods
			.finalizeProposal()
			.accounts({
				proposal: proposal.publicKey,
				user: provider.publicKey,
			})
			.rpc();

		const updatedProposalAccount = await program.account.proposal.fetch(
			proposal.publicKey
		);

		expect(updatedProposalAccount.onGoing).toBe(false);
	});

	it("Proposal result should be correct", async () => {
		const proposalAccount = await program.account.proposal.fetch(
			proposal.publicKey
		);

		expect(proposalAccount.result).toBe(ProposalResult.For);
	});

	it("Should return all proposals", async () => {
		const proposals = await program.account.proposal.all();

		// console.log(proposals);

		expect(proposals).toHaveLength(1);
	});
});
