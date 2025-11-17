use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Binary;
use serde::{Deserialize, Serialize};

#[cw_serde]
pub struct Manager {
    pub addr: String,
    pub pub_key: String,
}

/// Message type for `instantiate` entry_point
#[cw_serde]
pub struct InstantiateMsg {
    pub managers: Vec<Manager>,
    pub receiver_prefix: String,
    pub channel_id: String,
}

/// Message type for `execute` entry_point
#[cw_serde]
pub enum ExecuteMsg {
    SetManagers {
        managers: String,
        pub_key: String,
        status: bool,
    },
    CreateSurvey {
        signature: String,
        token: String,
        time_to_expire: u64,
        owner: String,
        survey_id: String,
        participants_limit: u32,
        reward_denom: String,
        reward_amount: u128,
        survey_hash: String,
        manager_pub_key: String,
    },
    CancelSurvey {
        signature: String,
        token: String,
        time_to_expire: u64,
        survey_id: String,
        manager_pub_key: String,
    },
    PayRewards {
        signature: String,
        token: String,
        time_to_expire: u64,
        survey_ids: Vec<String>,
        participants: Vec<String>,
        manager_pub_key: String,
    },
    TransferOwnership {
        new_owner: String,
    },
}

/// Message type for `migrate` entry_point
#[cw_serde]
pub enum MigrateMsg {}

#[cw_serde]
pub struct SurveyResponse {
    pub survey_creator: String,
    pub participants_limit: u32,
    pub reward_amount: u128,
    pub participants_rewarded: u32,
    pub survey_hash: String,
    pub amount_to_fund: u128,
    pub is_cancelled: bool,
}

/// Message type for `query` entry_point
#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(Binary)]
    CreateSurveyProof {
        token: String,
        time_to_expire: u64,
        owner: String,
        survey_id: String,
        participants_limit: u32,
        reward_amount: u128,
        survey_hash: String,
        reward_denom: String,
    },
    #[returns(Binary)]
    CancelSurveyProof {
        token: String,
        time_to_expire: u64,
        survey_id: String,
    },
    #[returns(Binary)]
    PayRewardsProof {
        token: String,
        time_to_expire: u64,
        survey_ids: Vec<String>,
        participants: Vec<String>,
    },
    #[returns(SurveyResponse)]
    GetSurvey { survey_id: String },
    #[returns(u128)]
    GetSurveyAmountToFund { survey_id: String },
    #[returns(u128)]
    GetSurveyRewardsAmountPaid { survey_id: String },
    #[returns(crate::state::Config)]
    GetConfig {},
    #[returns(bool)]
    GetHasClaimedReward {
        survey_id: String,
        participant: String,
    },
}

#[cw_serde]
pub enum IBCLifecycleComplete {
    #[serde(rename = "ibc_ack")]
    IBCAck {
        /// The source channel (osmosis side) of the IBC packet
        channel: String,
        /// The sequence number that the packet was sent with
        sequence: u64,
        /// String encoded version of the ack as seen by OnAcknowledgementPacket(..)
        ack: String,
        /// Weather an ack is a success of failure according to the transfer spec
        success: bool,
    },
    #[serde(rename = "ibc_timeout")]
    IBCTimeout {
        /// The source channel (osmosis side) of the IBC packet
        channel: String,
        /// The sequence number that the packet was sent with
        sequence: u64,
    },
}

#[cw_serde]
pub struct Type1 {
    pub message: String,
}

#[cw_serde]
pub struct Type2 {
    pub data: String,
}

#[derive(Serialize, Deserialize)]
pub enum SudoPayload {
    HandlerPayload1(Type1),
    HandlerPayload2(Type2),
}

#[cw_serde]
pub struct CreateSurveyResponse {
    pub survey_id: String,
    pub participants_limit: u32,
    pub reward_amount: u128,
    pub reward_denom: String,
    pub timestamp: u64,
}

impl CreateSurveyResponse {
    pub fn new(
        survey_id: &str,
        participants_limit: u32,
        reward_amount: u128,
        reward_denom: &str,
        timestamp: u64,
    ) -> Self {
        Self {
            survey_id: survey_id.to_string(),
            participants_limit,
            reward_amount,
            reward_denom: reward_denom.to_string(),
            timestamp,
        }
    }
}

#[cw_serde]
pub struct CancelSurveyResponse {
    pub survey_id: String,
    pub amount_refunded: u128,
    pub timestamp: u64,
}

impl CancelSurveyResponse {
    pub fn new(survey_id: &str, amount: u128, timestamp: u64) -> Self {
        Self {
            survey_id: survey_id.to_string(),
            amount_refunded: amount,
            timestamp,
        }
    }
}

#[cw_serde]
pub struct PayRewardsResponse {
    pub survey_ids: Vec<String>,
    pub participants: Vec<String>,
    pub total_rewards_paid: u128,
    pub timestamp: u64,
}

impl PayRewardsResponse {
    pub fn new(
        survey_ids: Vec<String>,
        rewards: u128,
        participants: Vec<String>,
        timestamp: u64,
    ) -> Self {
        Self {
            survey_ids,
            total_rewards_paid: rewards,
            participants,
            timestamp,
        }
    }
}
