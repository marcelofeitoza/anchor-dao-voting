use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub creator: Pubkey,
    #[max_len(256)]
    pub description: String,
    pub votes_for: u64,
    pub votes_against: u64,
    pub on_going: bool,
    #[max_len(256)]
    pub voters: Vec<Pubkey>,
    pub reward_pool: u64,
    pub result: Option<u8>,
}

impl Proposal {
    pub fn get_result_enum(&self) -> Option<ProposalResult> {
        match self.result {
            Some(0) => Some(ProposalResult::For),
            Some(1) => Some(ProposalResult::Against),
            Some(2) => Some(ProposalResult::Tie),
            _ => None,
        }
    }

    pub fn set_result_enum(&mut self, result: ProposalResult) {
        self.result = Some(result as u8);
    }
}

#[derive(Clone, Copy, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub enum ProposalResult {
    For = 0,
    Against = 1,
    Tie = 2,
}
