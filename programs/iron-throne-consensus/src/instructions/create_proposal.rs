use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::{prelude::*, solana_program::system_instruction};

pub fn create_proposal_instruction(
    ctx: Context<CreateProposal>,
    description: String,
    reward: u64,
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

    if reward > 0 {
        let transfer_instruction = system_instruction::transfer(
            ctx.accounts.user.to_account_info().key,
            proposal_ctx.to_account_info().key,
            reward,
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

    proposal.reward_pool = reward;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", user.key().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
