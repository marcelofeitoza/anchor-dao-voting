use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub creator: Pubkey,
    #[max_len(256)]
    pub description: String,
    pub votes_for: u64,
    pub votes_for_percentage: Option<f64>,
    pub votes_against: u64,
    pub votes_against_percentage: Option<f64>,
    pub on_going: bool,
    #[max_len(256)]
    pub voters: Vec<Pubkey>,
    pub result: Option<u8>,
    pub reward_pool: u64,
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

    pub fn calculate_result(&mut self) -> ProposalResult {
        match self.votes_for.cmp(&self.votes_against) {
            std::cmp::Ordering::Greater => ProposalResult::For,
            std::cmp::Ordering::Less => ProposalResult::Against,
            std::cmp::Ordering::Equal => ProposalResult::Tie,
        }
    }

    pub fn calculate_percentages(&mut self) {
        let total_votes = self.votes_for + self.votes_against;
        if total_votes > 0 {
            self.votes_for_percentage = Some((self.votes_for as f64 / total_votes as f64) * 100.0);
            self.votes_against_percentage =
                Some((self.votes_against as f64 / total_votes as f64) * 100.0);
        } else {
            self.votes_for_percentage = None;
            self.votes_against_percentage = None;
        }
    }

    pub fn result_description(&mut self) -> String {
        match self.calculate_result() {
            ProposalResult::For => format!(
                "Passed with {:.2}% in favor",
                self.votes_for_percentage.unwrap_or(0.0)
            ),
            ProposalResult::Against => format!(
                "Failed with {:.2}% against",
                self.votes_against_percentage.unwrap_or(0.0)
            ),
            ProposalResult::Tie => String::from("Resulted in a tie"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub enum ProposalResult {
    For,
    Against,
    Tie,
}
