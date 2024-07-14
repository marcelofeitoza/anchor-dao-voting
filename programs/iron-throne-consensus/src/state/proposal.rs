use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

/// Represents a voting proposal within the Iron Throne Consensus DAO.
///
/// This struct contains all the necessary details for a proposal including who created it,
/// a description, voting results, and reward distribution details.
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    /// The public key of the user who created the proposal.
    pub creator: Pubkey,
    /// A description of the proposal limited to 256 characters.
    #[max_len(256)]
    pub description: String,
    /// The total number of votes in favor of the proposal.
    pub votes_for: u64,
    /// The percentage of votes in favor calculated after voting ends.
    pub votes_for_percentage: Option<f64>,
    /// The total number of votes against the proposal.
    pub votes_against: u64,
    /// The percentage of votes against calculated after voting ends.
    pub votes_against_percentage: Option<f64>,
    /// Indicates whether the proposal is still open for voting.
    pub on_going: bool,
    /// A list of public keys of voters who have participated in the voting.
    #[max_len(256)]
    pub voters: Vec<Pubkey>,
    /// The result of the proposal voting represented as an enum `ProposalResult`.
    pub result: Option<u8>,
    /// The total reward pool in lamports available for distribution among voters.
    pub reward_pool: u64,
}

impl Proposal {
    /// Returns the result of the proposal as an `Option<ProposalResult>` enum.
    pub fn get_result_enum(&self) -> Option<ProposalResult> {
        match self.result {
            Some(0) => Some(ProposalResult::For),
            Some(1) => Some(ProposalResult::Against),
            Some(2) => Some(ProposalResult::Tie),
            _ => None,
        }
    }

    /// Sets the result of the proposal using a `ProposalResult` enum.
    pub fn set_result_enum(&mut self, result: ProposalResult) {
        self.result = Some(result as u8);
    }

    /// Calculates the result of the proposal based on the current vote counts.
    pub fn calculate_result(&mut self) -> ProposalResult {
        match self.votes_for.cmp(&self.votes_against) {
            std::cmp::Ordering::Greater => ProposalResult::For,
            std::cmp::Ordering::Less => ProposalResult::Against,
            std::cmp::Ordering::Equal => ProposalResult::Tie,
        }
    }

    /// Calculates and updates the vote percentages for the proposal.
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

    /// Returns a descriptive string of the result, showing the result and percentage.
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

/// Enum to represent the possible outcomes of a proposal.
#[derive(Clone, Copy, Debug, PartialEq, BorshSerialize, BorshDeserialize)]
pub enum ProposalResult {
    For,
    Against,
    Tie,
}
