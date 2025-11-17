use crate::helpers;
use crate::msg::SurveyResponse;
use crate::state::{
    CancelSurveyPayload, Config, CreateSurveyPayload, PayRewardsPayload, CONFIG, SURVEYS,
    SURVEY_REWARDED_USERS,
};

use cosmwasm_std::{to_json_binary, Binary, Deps, StdResult};
use sha2::{Digest, Sha256};

#[allow(clippy::too_many_arguments)]
pub fn create_survey_proof(
    token: &str,
    time_to_expire: u64,
    owner: &str,
    survey_id: &str,
    participants_limit: u32,
    reward_amount: u128,
    survey_hash: &str,
    reward_denom: &str,
) -> StdResult<Binary> {
    let payload = CreateSurveyPayload {
        token,
        time_to_expire,
        owner: &owner,
        survey_id,
        participants_limit,
        reward_amount,
        survey_hash,
        reward_denom: &reward_denom,
        domain: "SURVEY_V1",
    };

    let bytes = to_json_binary(&payload)?;

    let digest = Sha256::digest(&bytes);

    Ok(Binary::from(digest.to_vec()))
}

pub fn cancel_survey_proof(token: &str, time_to_expire: u64, survey_id: &str) -> StdResult<Binary> {
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
    time_to_expire: u64,
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
        reward_amount: survey_info.reward_amount,
        participants_rewarded: survey_info.participants_rewarded,
        survey_hash: survey_info.survey_hash,
        amount_to_fund: survey_info.participants_limit as u128 * survey_info.reward_amount,
        is_cancelled: survey_info.is_cancelled,
    })
}

pub fn get_survey_amount_to_fund(deps: Deps, survey_id: &str) -> StdResult<u128> {
    SURVEYS.load(deps.storage, survey_id).map(|survey_info| {
        let amount_to_fund = survey_info.participants_limit as u128 * survey_info.reward_amount;
        amount_to_fund
    })
}

pub fn get_survey_rewards_amount_paid(deps: Deps, survey_id: &str) -> StdResult<u128> {
    SURVEYS.load(deps.storage, survey_id).map(|survey_info| {
        let amount_rewards_paid =
            survey_info.participants_rewarded as u128 * survey_info.reward_amount;
        amount_rewards_paid
    })
}

pub fn get_config(deps: Deps) -> StdResult<Config> {
    CONFIG.load(deps.storage)
}

pub fn get_has_claimed_reward(deps: Deps, survey_id: &str, participant: &str) -> StdResult<bool> {
    let config = CONFIG.load(deps.storage)?;

    let (_, participant) = helpers::validate_account(&config.receiver_prefix, &participant)
        .map_err(|err| cosmwasm_std::StdError::generic_err(err.to_string()))?;

    let already_rewarded = SURVEY_REWARDED_USERS
        .load(deps.storage, (survey_id, &participant))
        .unwrap_or(false);

    Ok(already_rewarded)
}
