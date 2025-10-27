use crate::msg::SurveyResponse;
use crate::state::{
    CancelSurveyPayload, Config, CreateSurveyPayload, PayRewardsPayload, CONFIG, SURVEYS,
};

use cosmwasm_std::{to_json_binary, Addr, Binary, Deps, StdResult};
use cw_utils::Expiration;
use sha2::{Digest, Sha256};

#[allow(clippy::too_many_arguments)]
pub fn create_survey_proof(
    token: &str,
    time_to_expire: Expiration,
    owner: Addr,
    survey_id: &str,
    participants_limit: u32,
    reward_per_user: u128,
    survey_hash: Binary,
    reward_denom: String,
    amount_to_gas_station: u128,
) -> StdResult<Binary> {
    let payload = CreateSurveyPayload {
        token,
        time_to_expire,
        owner: owner.as_str(),
        survey_id,
        participants_limit,
        reward_per_user,
        survey_hash,
        reward_denom: &reward_denom.as_str(),
        amount_to_gas_station,
        domain: "SURVEY_V1",
    };

    let bytes = to_json_binary(&payload)?;

    let digest = Sha256::digest(&bytes);

    Ok(Binary::from(digest.to_vec()))
}

pub fn cancel_survey_proof(
    token: &str,
    time_to_expire: Expiration,
    survey_id: &str,
) -> StdResult<Binary> {
    let payload = CancelSurveyPayload {
        token,
        time_to_expire,
        survey_id,
        domain: "SURVEY_V1",
    };

    let bytes = to_json_binary(&payload)?;
    let digest = Sha256::digest(&bytes);

    Ok(Binary::from(digest.to_vec()))
}

pub fn pay_rewards_proof(
    token: &str,
    time_to_expire: Expiration,
    survey_id: Vec<String>,
    participants: Vec<String>,
) -> StdResult<Binary> {
    let payload = PayRewardsPayload {
        token,
        time_to_expire,
        survey_id,
        participants,
        domain: "SURVEY_V1",
    };

    let bytes = to_json_binary(&payload)?;
    let digest = Sha256::digest(&bytes);

    Ok(Binary::from(digest.to_vec()))
}

pub fn get_survey(deps: Deps, survey_id: &str) -> StdResult<SurveyResponse> {
    let survey_info = SURVEYS.load(deps.storage, survey_id)?;
    Ok(SurveyResponse {
        survey_creator: survey_info.survey_creator.to_string(),
        participants_limit: survey_info.participants_limit,
        reward_per_user: survey_info.reward_per_user,
        participants_rewarded: survey_info.participants_rewarded,
        survey_hash: survey_info.survey_hash,
        amount_to_fund: survey_info.participants_limit as u128 * survey_info.reward_per_user,
        is_cancelled: survey_info.is_cancelled,
    })
}

pub fn get_survey_amount_to_fund(deps: Deps, survey_id: &str) -> StdResult<u128> {
    SURVEYS.load(deps.storage, survey_id).map(|survey_info| {
        let amount_to_fund = survey_info.participants_limit as u128 * survey_info.reward_per_user;
        amount_to_fund
    })
}

pub fn get_survey_rewards_amount_paid(deps: Deps, survey_id: &str) -> StdResult<u128> {
    SURVEYS.load(deps.storage, survey_id).map(|survey_info| {
        let amount_rewards_paid =
            survey_info.participants_rewarded as u128 * survey_info.reward_per_user;
        amount_rewards_paid
    })
}

pub fn get_config(deps: Deps) -> StdResult<Config> {
    CONFIG.load(deps.storage)
}
