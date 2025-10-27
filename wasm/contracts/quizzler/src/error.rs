use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("{0}")]
    Payment(#[from] cw_utils::PaymentError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Survey Not Found")]
    SurveyNotFound {},

    #[error("Survey Already Exists")]
    SurveyAlreadyExists {},

    #[error("Survey Already Cancelled")]
    SurveyAlreadyCancelled {},

    #[error("Invalid Manager")]
    InvalidManager {},

    #[error("Only Creator Or Manager")]
    OnlyCreatorOrManager {},

    #[error("All Participants Rewarded")]
    AllParticipantsRewarded {},

    #[error("Array Length Mismatch")]
    ArrayLengthMismatch {},

    #[error("User Already Rewarded")]
    UserAlreadyRewarded {},

    #[error("Invalid Message Hash")]
    InvalidMessageHash {},

    #[error("Token Already Used")]
    TokenAlreadyUsed {},

    #[error("Proof Expired")]
    ProofExpired {},

    #[error("Insufficient Funds")]
    InsufficientFunds {},

    #[error("Survey Creation Failed")]
    SurveyCreationFailed {},

    #[error("Reward Payment Failed")]
    RewardPaymentFailed {},

    #[error("Survey Cancellation Failed")]
    SurveyCancellationFailed {},

    #[error("Invalid Signer")]
    InvalidSigner {},

    #[error("Invalid Reward Amount")]
    InvalidRewardAmount {},

    #[error("Invalid Transaction Value")]
    InvalidTransactionValue {},

    #[error("Arithmetic Error")]
    ArithmeticError {},

    #[error("Invalid Address")]
    InvalidAddress {},

    #[error("Custom Error val: {val:?}")]
    CustomError { val: String },

    #[error("Semver parsing error: {0}")]
    SemVer(String),

    #[error("Signature Verification Failed")]
    SignatureVerificationFailed(String),
}

impl From<semver::Error> for ContractError {
    fn from(err: semver::Error) -> Self {
        Self::SemVer(err.to_string())
    }
}

impl From<cosmwasm_std::VerificationError> for ContractError {
    fn from(err: cosmwasm_std::VerificationError) -> Self {
        Self::SignatureVerificationFailed(err.to_string())
    }
}
