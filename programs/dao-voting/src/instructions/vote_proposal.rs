use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::prelude::*;

pub fn vote_proposal_instruction(ctx: Context<Vote>, vote: bool) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;

    require!(proposal.on_going, ProposalErrorCode::ProposalFinalized);
    require!(
        !proposal
            .voters
            .contains(ctx.accounts.voter.to_account_info().key),
        ProposalErrorCode::AlreadyVoted
    );

    if vote {
        proposal.votes_for += 1;
    } else {
        proposal.votes_against += 1;
    }

    proposal
        .voters
        .push(*ctx.accounts.voter.to_account_info().key);

    Ok(())
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub voter: Signer<'info>,
}
