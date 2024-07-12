use anchor_lang::prelude::*;

#[error_code]
pub enum ProposalErrorCode {
    #[msg("Description is required.")]
    DescriptionRequired,
    #[msg("Description is too long.")]
    DescriptionTooLong,
    #[msg("Invalid proposal ID.")]
    InvalidProposalId,
    #[msg("Proposal already finalized.")]
    ProposalFinalized,
    #[msg("Already voted.")]
    AlreadyVoted,
    #[msg("Only creator can finalize.")]
    OnlyCreatorCanFinalize,
    #[msg("Invalid voter account.")]
    InvalidVoterAccount,
}
