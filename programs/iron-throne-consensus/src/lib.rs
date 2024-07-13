use anchor_lang::prelude::*;

mod errors;
mod instructions;
mod state;

use instructions::*;

declare_id!("9gvLmeAkDQzGjoLoJCCbEizicBYATkJSfD6pmVJzGKWS");

#[program]
pub mod iron_throne_consensus {
    use super::*;

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        description: String,
        initial_reward: u64,
    ) -> Result<()> {
        create_proposal_instruction(ctx, description, initial_reward)
    }
    pub fn finalize_proposal(ctx: Context<Finalize>) -> Result<()> {
        finalize_proposal_instruction(ctx)
    }
    pub fn vote_proposal(ctx: Context<Vote>, vote: bool) -> Result<()> {
        vote_proposal_instruction(ctx, vote)
    }
}
