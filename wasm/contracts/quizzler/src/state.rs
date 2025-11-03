use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Binary};
use cw_storage_plus::{Item, Map};
use cw_utils::Expiration;

#[cw_serde]
pub struct ManagerInfo {
    pub address: Addr,
    pub pub_key: Binary,
    pub status: bool,
}

#[cw_serde]
pub struct Config {
    pub gas_station: Addr,
    pub owner: Addr,
    pub receiver_prefix: String,
    pub channel_id: String,
}

pub const CONFIG: Item<Config> = Item::new("config");

// Managers
pub const MANAGERS: Map<&Addr, ManagerInfo> = Map::new("managers");

#[cw_serde]
pub struct SurveyInfo {
    pub survey_creator: Addr,
    pub participants_limit: u32,
    pub reward_per_user: u128,
    pub participants_rewarded: u32,
    pub survey_hash: Binary,
    pub is_cancelled: bool,
    pub reward_denom: String,
}

pub const SURVEYS: Map<&str, SurveyInfo> = Map::new("surveys");

// Survey rewarded users
pub const SURVEY_REWARDED_USERS: Map<(&str, &Addr), bool> = Map::new("survey_rewarded_users");

// Used proof tokens
pub const USED_PROOF_TOKENS: Map<&String, bool> = Map::new("used_proof_tokens");

#[cw_serde]
pub struct CreateSurveyPayload<'a> {
    pub token: &'a str,
    pub time_to_expire: Expiration,
    pub owner: &'a str,
    pub survey_id: &'a str,
    pub participants_limit: u32,
    pub reward_per_user: u128,
    pub survey_hash: Binary,
    pub reward_denom: &'a str,
    pub amount_to_gas_station: u128,
    pub domain: &'a str,
}

#[cw_serde]
pub struct CancelSurveyPayload<'a> {
    pub token: &'a str,
    pub time_to_expire: Expiration,
    pub survey_id: &'a str,
    pub domain: &'a str,
}

#[cw_serde]
pub struct PayRewardsPayload<'a> {
    pub token: &'a str,
    pub time_to_expire: Expiration,
    pub survey_id: Vec<String>,
    pub participants: Vec<String>,
    pub domain: &'a str,
}

pub mod ibc {
    use super::*;

    #[cw_serde]
    pub enum PacketLifecycleStatus {
        Sent,
        AckSuccess,
        AckFailure,
        TimedOut,
    }

    /// A transfer packet sent by this contract that is expected to be received but
    /// needs to be tracked in case the receive fails or times-out
    #[cw_serde]
    pub struct IBCTransfer {
        pub recovery_addr: Addr,
        pub channel_id: String,
        pub sequence: u64,
        pub amount: u128,
        pub denom: String,
        pub status: PacketLifecycleStatus,
    }
}

/// In-Flight packets by (source_channel_id, sequence)
pub const INFLIGHT_PACKETS: Map<(&str, u64), ibc::IBCTransfer> = Map::new("inflight");

/// Recovery. This tracks any recovery that an addr can execute.
pub const RECOVERY_STATES: Map<&Addr, Vec<ibc::IBCTransfer>> = Map::new("recovery");
