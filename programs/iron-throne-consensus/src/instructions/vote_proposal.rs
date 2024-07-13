use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::prelude::*;

pub fn vote_proposal_instruction(ctx: Context<Vote>, vote: bool) -> Result<()> {
    let voter_account = &mut ctx.accounts.voter_account;
    let proposal = &mut ctx.accounts.proposal;

    require!(proposal.on_going, ProposalErrorCode::ProposalFinalized);
    require!(!voter_account.has_voted, ProposalErrorCode::AlreadyVoted);

    voter_account.voter = *ctx.accounts.user.key;
    voter_account.has_voted = true;
    voter_account.vote = vote;

    if vote {
        proposal.votes_for += 1;
    } else {
        proposal.votes_against += 1;
    }

    // proposal.voters.push(voter_account.key());
    proposal.voters.push(*ctx.accounts.user.key);

    Ok(())
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + VoterAccount::INIT_SPACE,
        seeds = [proposal.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub voter_account: Account<'info, VoterAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct VoterAccount {
    pub voter: Pubkey,
    pub proposal: Pubkey,
    pub has_voted: bool,
    pub vote: bool,
}
