use crate::{errors::ProposalErrorCode, state::proposal::Proposal};
use anchor_lang::prelude::*;

pub fn finalize_proposal_instruction(ctx: Context<Finalize>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;

    require!(proposal.on_going, ProposalErrorCode::ProposalFinalized);
    let voters = ctx.remaining_accounts;
    let num_voters = voters.len() as u64;
    require!(num_voters > 0, ProposalErrorCode::NoVoters);

    let share = proposal
        .clone()
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
    proposal.on_going = false;

    Ok(())
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut, has_one = creator)]
    pub proposal: Account<'info, Proposal>,
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
