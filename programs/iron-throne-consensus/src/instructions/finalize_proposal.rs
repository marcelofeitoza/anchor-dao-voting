use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::prelude::*;

/// Finalizes a voting proposal within the DAO voting system.
///
/// This function is used to conclude a proposal's voting process. It calculates the final results based
/// on the votes, distributes the rewards if any, and sets the proposal's status to not ongoing.
/// This function ensures that the proposal is still ongoing, calculates the percentages of votes for and against,
/// and if there's a reward pool, distributes it evenly among all voters.
///
/// # Arguments
/// * `ctx` - The context in which this function is called, including accounts related to the proposal and system program.
///
/// # Errors
/// * `ProposalErrorCode::ProposalFinalized` - If the proposal has already been finalized.
/// * `ProposalErrorCode::NoVoters` - If no voters are provided when there is a reward pool to distribute.
/// * `ProposalErrorCode::RewardDivisionError` - If dividing the reward pool by the number of voters fails.
/// * `ProposalErrorCode::Overflow` - If adding or subtracting the reward from accounts overflows.
///
/// # Permissions
/// * `proposal` - The proposal account, which must be mutable because it is being updated to reflect the final state.
/// * `creator` - The signer of the transaction, typically the creator of the proposal or an admin.
pub fn finalize_proposal_instruction(ctx: Context<Finalize>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;

    require!(proposal.on_going, ProposalErrorCode::ProposalFinalized);
    let voters = ctx.remaining_accounts;
    let num_voters = voters.len() as u64;

    proposal.calculate_percentages();

    let proposal_result = proposal.calculate_result();
    proposal.set_result_enum(proposal_result);
    msg!("Proposal result: {:?}", proposal_result);
    msg!("Result description: {}", proposal.result_description());

    if proposal.reward_pool > 0 && num_voters > 0 {
        let share = proposal
            .reward_pool
            .checked_div(num_voters)
            .ok_or(ProposalErrorCode::RewardDivisionError)?;

        for voter_acc_info in voters {
            let voter_acc: AccountInfo = voter_acc_info.to_account_info();
            **voter_acc.try_borrow_mut_lamports()? = voter_acc
                .lamports()
                .checked_add(share)
                .ok_or(ProposalErrorCode::Overflow)?;
            **proposal.to_account_info().try_borrow_mut_lamports()? = proposal
                .to_account_info()
                .lamports()
                .checked_sub(share)
                .ok_or(ProposalErrorCode::Overflow)?;
        }

        proposal.reward_pool = 0;
    }

    proposal.on_going = false;

    Ok(())
}

/// Accounts required to finalize a proposal.
#[derive(Accounts)]
pub struct Finalize<'info> {
    /// The proposal account being finalized.
    /// This account must be mutable because it will update the proposal's state.
    #[account(mut, has_one = creator)]
    pub proposal: Account<'info, Proposal>,
    /// The creator of the proposal who is allowed to finalize it.
    /// Must be a signer to authorize the operation.
    pub creator: Signer<'info>,
    /// The system program account, used for handling SOL transactions within the instruction.
    pub system_program: Program<'info, System>,
}
