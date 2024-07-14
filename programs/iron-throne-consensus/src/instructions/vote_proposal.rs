use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::prelude::*;

/// Casts a vote on an existing proposal in the DAO voting system.
///
/// This function records a vote for a proposal based on the voter's choice. It checks if the proposal
/// is still ongoing and if the voter has not already voted. If the conditions are met, it updates the
/// proposal's vote count and the voter's status.
///
/// # Arguments
/// * `ctx` - The context in which this function is called, including accounts related to the proposal and voter.
/// * `vote` - A boolean representing the vote: `true` for a vote in favor (for) and `false` for a vote against (against).
///
/// # Errors
/// * `ProposalErrorCode::ProposalFinalized` - If the proposal is not ongoing (i.e., it has already been finalized).
/// * `ProposalErrorCode::AlreadyVoted` - If the voter has already cast a vote on this proposal.
///
/// # Permissions
/// * `proposal` - The proposal account, which must be mutable because the vote counts are updated.
/// * `voter_account` - The voter's account, which must be mutable and may be initialized here if it does not exist.
/// * `user` - The signer of the transaction, assumed to be the voter.
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

    proposal.voters.push(*ctx.accounts.user.key);

    Ok(())
}

/// Accounts required to cast a vote on a proposal.
#[derive(Accounts)]
pub struct Vote<'info> {
    /// The proposal account being voted on.
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    /// The account that records the vote. It is initialized here if not already existing.
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + VoterAccount::INIT_SPACE,
        seeds = [proposal.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub voter_account: Account<'info, VoterAccount>,
    /// The user casting the vote.
    /// Must be mutable to deduct the transaction fee and must be a signer to authorize the vote.
    #[account(mut)]
    pub user: Signer<'info>,
    /// The system program account, used for handling account creations and SOL transactions.
    pub system_program: Program<'info, System>,
}

/// Represents a voter's record on a specific proposal.
#[account]
#[derive(InitSpace)]
pub struct VoterAccount {
    /// The public key of the voter.
    pub voter: Pubkey,
    /// The public key of the proposal this vote is associated with.
    pub proposal: Pubkey,
    /// Indicates whether this voter has already cast a vote to prevent double voting.
    pub has_voted: bool,
    /// Records the vote: true for "for", false for "against".
    pub vote: bool,
}
