use crate::{
    errors::ProposalErrorCode,
    state::proposal::{Proposal, ProposalResult},
};
use anchor_lang::prelude::*;

pub fn finalize_proposal_instruction(ctx: Context<Finalize>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    require!(proposal.on_going, ProposalErrorCode::ProposalFinalized);
    require!(
        proposal.creator == *ctx.accounts.user.key,
        ProposalErrorCode::OnlyCreatorCanFinalize
    );

    let votes_for = proposal.votes_for;
    let votes_against = proposal.votes_against;
    match votes_for.cmp(&votes_against) {
        std::cmp::Ordering::Greater => proposal.set_result_enum(ProposalResult::For),
        std::cmp::Ordering::Less => proposal.set_result_enum(ProposalResult::Against),
        std::cmp::Ordering::Equal => proposal.set_result_enum(ProposalResult::Tie),
    }

    if proposal.voters.is_empty() {
        return Ok(());
    }

    let reward_per_voter = proposal.reward_pool / proposal.voters.len() as u64;
    for voter_pubkey in &proposal.voters {
        let voter_account = ctx
            .remaining_accounts
            .iter()
            .find(|account| account.key == voter_pubkey)
            .ok_or(ProposalErrorCode::InvalidVoterAccount)?;

        **voter_account.try_borrow_mut_lamports()? += reward_per_voter;
        **proposal.to_account_info().try_borrow_mut_lamports()? -= reward_per_voter;
    }

    proposal.on_going = false;

    Ok(())
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub user: Signer<'info>,
}
