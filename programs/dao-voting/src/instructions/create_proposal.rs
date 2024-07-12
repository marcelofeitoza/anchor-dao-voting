use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::prelude::*;

pub fn create_proposal_instruction(
    ctx: Context<CreateProposal>,
    description: String,
    deposit: u64,
) -> Result<()> {
    require!(
        !description.is_empty(),
        ProposalErrorCode::DescriptionRequired
    );
    require!(
        description.len() <= 500,
        ProposalErrorCode::DescriptionTooLong
    );

    msg!("Creating proposal with description: {}", description);

    let proposal = &mut ctx.accounts.proposal;
    proposal.creator = *ctx.accounts.user.key;
    proposal.description = description;
    proposal.votes_for = 0;
    proposal.votes_against = 0;
    proposal.on_going = true;

    **proposal.to_account_info().try_borrow_mut_lamports()? += deposit;
    **ctx
        .accounts
        .user
        .to_account_info()
        .try_borrow_mut_lamports()? -= deposit;

    // ctx.accounts.proposal = proposal.clone();

    Ok(())
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Proposal::INIT_SPACE,
        // seeds = [b"proposal".as_ref()],
        // bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
