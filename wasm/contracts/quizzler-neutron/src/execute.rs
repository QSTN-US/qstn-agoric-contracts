use crate::error::ContractError;
use crate::helpers;
use crate::ibc_lifecycle::msg_with_sudo_callback;
use crate::msg::{
    CancelSurveyResponse, CreateSurveyResponse, PayRewardsResponse, SudoPayload, Type1,
};
use crate::query;
use crate::state::{
    Config, ManagerInfo, SurveyInfo, CONFIG, MANAGERS, SURVEYS, SURVEY_REWARDED_USERS,
};
use cosmwasm_std::{to_json_binary, Binary, DepsMut, Env, MessageInfo, Response, SubMsg, Uint128};

#[allow(clippy::too_many_arguments)]
pub fn create_survey(
    ctx: (DepsMut, &Env, MessageInfo),
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
) -> Result<Response, ContractError> {
    let (mut deps, env, info) = ctx;

    if SURVEYS.has(deps.storage, &survey_id) {
        return Err(ContractError::SurveyAlreadyExists {});
    }

    let config = CONFIG.load(deps.storage)?;

    let message_hash = query::create_survey_proof(
        &token,
        time_to_expire,
        &owner,
        &survey_id,
        participants_limit,
        reward_amount,
        &survey_hash,
        &reward_denom,
    )?;

    helpers::auth_validations(
        &mut deps,
        env,
        token.clone(),
        message_hash,
        manager_pub_key,
        time_to_expire,
        signature,
    )?;

    let (_, validated_owner_addr) = helpers::validate_account(&config.receiver_prefix, &owner)?;

    // Save survey info
    let survey_info = SurveyInfo {
        survey_creator: validated_owner_addr,
        participants_limit,
        reward_denom: reward_denom.clone(),
        reward_amount,
        participants_rewarded: 0,
        survey_hash,
        is_cancelled: false,
    };

    let amount_sent = cw_utils::must_pay(&info, &reward_denom)?;

    let amount_to_survey = (participants_limit as u128)
        .checked_mul(reward_amount)
        .ok_or(ContractError::ArithmeticError {})?;

    if amount_sent < Uint128::from(amount_to_survey) {
        return Err(ContractError::InvalidRewardAmount {});
    }

    SURVEYS.save(deps.storage, &survey_id, &survey_info)?;

    let response_data = CreateSurveyResponse::new(
        &survey_id,
        participants_limit,
        reward_amount,
        &reward_denom,
        env.block.time.seconds(),
    );

    Ok(Response::new()
        .set_data(to_json_binary(&response_data)?)
        .add_attribute("action", "create_survey")
        .add_attribute("survey_id", survey_id)
        .add_attribute("owner", owner)
        .add_attribute("reward_denom", reward_denom)
        .add_attribute("reward_amount", reward_amount.to_string())
        .add_attribute("participants_limit", participants_limit.to_string()))
}

#[allow(clippy::too_many_arguments)]
pub fn cancel_survey(
    ctx: (DepsMut, &Env, MessageInfo),
    signature: String,
    token: String,
    time_to_expire: u64,
    survey_id: String,
    manager_pub_key: String,
) -> Result<Response, ContractError> {
    let (mut deps, env, _info) = ctx;

    let message_hash = query::cancel_survey_proof(&token, time_to_expire, &survey_id)?;

    helpers::auth_validations(
        &mut deps,
        env,
        token.clone(),
        message_hash,
        manager_pub_key,
        time_to_expire,
        signature,
    )?;

    // Mark survey as cancelled
    let survey_info = SURVEYS.update(
        deps.storage,
        &survey_id,
        |survey_info| -> Result<SurveyInfo, ContractError> {
            let mut survey = survey_info.ok_or(ContractError::SurveyNotFound {})?;
            survey.is_cancelled = true;
            Ok(survey)
        },
    )?;

    let reward_denom = survey_info.reward_denom;

    let funded_amount = query::get_survey_amount_to_fund(deps.as_ref(), &survey_id)?;

    let paid_amount = query::get_survey_rewards_amount_paid(deps.as_ref(), &survey_id)?;

    let return_amount = if funded_amount >= paid_amount {
        funded_amount - paid_amount
    } else {
        0
    };

    let bal = helpers::query_contract_balance(&deps.querier, &env.contract.address, &reward_denom)?;

    if bal < Uint128::from(return_amount) {
        return Err(ContractError::InsufficientContractBalance {});
    }

    if return_amount == 0 {
        return Err(ContractError::NothingToRefund {});
    }

    let ibc_msg = helpers::create_ibc_transfer(
        deps.as_ref(),
        env,
        &survey_info.survey_creator.to_string(),
        &reward_denom,
        Uint128::from(return_amount),
    )?;

    let submsg = msg_with_sudo_callback(
        deps.branch(),
        ibc_msg,
        SudoPayload::HandlerPayload1(Type1 {
            message: "message".to_string(),
        }),
    )?;

    let response_data =
        CancelSurveyResponse::new(&survey_id, return_amount, env.block.time.seconds());

    Ok(Response::new()
        .set_data(to_json_binary(&response_data)?)
        .add_submessage(submsg)
        .add_attribute("action", "cancel_survey")
        .add_attribute("amount", return_amount.to_string())
        .add_attribute("denom", reward_denom)
        .add_event(helpers::ibc_message_event(
            "create_survey: fund gas station",
        )))
}

#[allow(clippy::too_many_arguments)]
pub fn pay_rewards(
    ctx: (DepsMut, &Env, MessageInfo),
    signature: String,
    token: String,
    time_to_expire: u64,
    survey_ids: Vec<String>,
    participants: Vec<String>,
    manager_pub_key: String,
) -> Result<Response, ContractError> {
    let (mut deps, env, _info) = ctx;

    if survey_ids.len() != participants.len() {
        return Err(ContractError::ArrayLengthMismatch {});
    }

    let config = CONFIG.load(deps.storage)?;

    let message_hash = query::pay_rewards_proof(
        &token,
        time_to_expire,
        survey_ids.clone(),
        participants.clone(),
    )?;

    helpers::auth_validations(
        &mut deps,
        env,
        token.clone(),
        message_hash,
        manager_pub_key,
        time_to_expire,
        signature,
    )?;

    let mut messages: Vec<SubMsg> = Vec::new();
    let mut rewards = 0u128;

    for i in 0..survey_ids.len() {
        let survey_id = &survey_ids[i];

        let (_, participant) =
            helpers::validate_account(&config.receiver_prefix, &participants[i])?;

        let already_rewarded = SURVEY_REWARDED_USERS
            .load(deps.storage, (survey_id.as_str(), &participant))
            .unwrap_or(false);

        if already_rewarded {
            return Err(ContractError::UserAlreadyRewarded {});
        }

        let mut survey_info = SURVEYS.load(deps.storage, survey_id)?;
        let reward_denom = survey_info.reward_denom.clone();
        let reward_amount = survey_info.reward_amount;

        // check if survey is cancelled
        if survey_info.is_cancelled {
            return Err(ContractError::SurveyAlreadyCancelled {});
        }

        // check if all participants has been rewarded
        if survey_info.participants_rewarded >= survey_info.participants_limit {
            return Err(ContractError::AllParticipantsRewarded {});
        }

        // Create IBC transfer message
        let ibc_msg = helpers::create_ibc_transfer(
            deps.as_ref(),
            env,
            &participant.to_string(),
            &reward_denom,
            Uint128::from(reward_amount),
        )?;

        let submsg = msg_with_sudo_callback(
            deps.branch(),
            ibc_msg,
            SudoPayload::HandlerPayload1(Type1 {
                message: "message".to_string(),
            }),
        )?;

        messages.push(submsg);

        survey_info.participants_rewarded += 1;
        SURVEYS.save(deps.storage, survey_id, &survey_info)?;

        rewards += reward_amount;

        // mark user as rewarded
        SURVEY_REWARDED_USERS.save(deps.storage, (survey_id.as_str(), &participant), &true)?;
    }

    let response_data =
        PayRewardsResponse::new(survey_ids, rewards, participants, env.block.time.seconds());

    Ok(Response::new()
        .set_data(to_json_binary(&response_data)?)
        .add_submessages(messages)
        .add_attribute("action", "pay_rewards")
        .add_event(helpers::ibc_message_event(
            "pay_rewards: distribute survey rewards",
        )))
}

pub fn set_manager(
    ctx: (DepsMut, &Env, MessageInfo),
    manager_addr: &str,
    pub_key: String,
    status: bool,
) -> Result<Response, ContractError> {
    let (deps, _env, info) = ctx;
    let sender = info.sender;

    let pub_key = Binary::from_base64(&pub_key)?;

    let config = CONFIG.load(deps.storage)?;

    helpers::check_is_contract_owner(deps.as_ref(), sender)?;

    let (_, manager_addr) = helpers::validate_account(&config.receiver_prefix, &manager_addr)?;

    if MANAGERS.has(deps.storage, &manager_addr) {
        MANAGERS.update(
            deps.storage,
            &manager_addr,
            |manager_info| -> Result<ManagerInfo, ContractError> {
                if let Some(mut info) = manager_info {
                    info.status = status;
                    info.pub_key = pub_key;
                    Ok(info)
                } else {
                    Err(ContractError::InvalidManager {})
                }
            },
        )?;
    } else {
        let manager_info = ManagerInfo {
            address: manager_addr.clone(),
            pub_key,
            status,
        };
        MANAGERS.save(deps.storage, &manager_addr, &manager_info)?;
    }

    Ok(Response::new())
}

// Transfer ownership of this contract
pub fn transfer_ownership(
    ctx: (DepsMut, &Env, MessageInfo),
    new_owner: String,
) -> Result<Response, ContractError> {
    // only owner can transfer
    let (deps, _env, info) = ctx;
    let sender = info.sender;
    helpers::check_is_contract_owner(deps.as_ref(), sender)?;
    let new_owner = deps.api.addr_validate(&new_owner)?;

    CONFIG.update(
        deps.storage,
        |mut config| -> Result<Config, ContractError> {
            config.owner = new_owner.clone();
            Ok(config)
        },
    )?;

    Ok(Response::new()
        .add_attribute("action", "transfer_ownership")
        .add_attribute("new_owner", new_owner.to_string()))
}
