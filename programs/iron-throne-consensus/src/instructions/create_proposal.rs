use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::{prelude::*, solana_program::system_instruction};

/// Creates a new proposal in the DAO voting system.
///
/// This function initializes a new proposal account with a description and an optional reward pool.
/// The reward pool is transferred from the user's account to the new proposal's account if specified.
///
/// # Arguments
/// * `ctx` - The context in which this function is called, including accounts and signer information.
/// * `description` - A description of the proposal. This must be non-empty.
/// * `reward_pool` - The amount of lamports to allocate as a reward pool. This can be zero, indicating no reward.
///
/// # Errors
/// Returns an error if the description is empty or if the transfer of the reward pool fails due to insufficient funds.
///
/// # Side Effects
/// If a `reward_pool` greater than 0 is provided, this function will perform a lamport transfer from the
/// user's account to the proposal's account. The proposal account is created and initialized if it does not exist.
pub fn create_proposal_instruction(
    ctx: Context<CreateProposal>,
    description: String,
    reward_pool: u64,
) -> Result<()> {
    require!(
        !description.is_empty(),
        ProposalErrorCode::DescriptionRequired
    );

    msg!("Creating proposal with description: {}", description);

    let proposal_ctx = &mut ctx.accounts.proposal.clone();

    let proposal = &mut ctx.accounts.proposal;
    proposal.creator = *ctx.accounts.user.key;
    proposal.description = description;
    proposal.votes_for = 0;
    proposal.votes_against = 0;
    proposal.on_going = true;

    if reward_pool> 0 {
        let transfer_instruction = system_instruction::transfer(
            ctx.accounts.user.to_account_info().key,
            proposal_ctx.to_account_info().key,
            reward_pool,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.user.to_account_info(),
                proposal_ctx.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    proposal.reward_pool = reward_pool;

    Ok(())
}

/// Accounts required to create a new proposal.
#[derive(Accounts)]
pub struct CreateProposal<'info> {
    /// The proposal account to be created.
    /// Initializes if needed, setting the `user` as the payer for the account creation.
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", user.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    /// The user creating the proposal.
    /// Must be a signer to authorize the transaction and must be mutable to pay for the account creation.
    #[account(mut)]
    pub user: Signer<'info>,
    /// The system program account, used for handling account creations and SOL transactions.
    pub system_program: Program<'info, System>,
}
