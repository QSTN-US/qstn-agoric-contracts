use crate::error::ContractError;
use crate::state::{
    Config, ManagerInfo, SurveyInfo, CONFIG, MANAGERS, SURVEYS, SURVEY_REWARDED_USERS,
};

use crate::helpers;
use crate::query;
use cosmwasm_std::{coins, Addr, BankMsg, Binary, DepsMut, Env, MessageInfo, Response, Uint256};
use cw_utils::Expiration;

#[allow(clippy::too_many_arguments)]
pub fn create_survey(
    ctx: (DepsMut, &Env, MessageInfo),
    signature: Binary,
    token: String,
    time_to_expire: Expiration,
    owner: String,
    survey_id: String,
    participants_limit: u32,
    reward_per_user: u128,
    survey_hash: Binary,
    amount_to_gas_station: u128,
    manager_pub_key: Binary,
) -> Result<Response, ContractError> {
    let (mut deps, env, info) = ctx;

    if SURVEYS.has(deps.storage, &survey_id) {
        return Err(ContractError::SurveyAlreadyExists {});
    }

    let owner_addr = deps.api.addr_validate(&owner)?;

    let config = CONFIG.load(deps.storage)?;
    let reward_denom = &config.reward_denom;

    let message_hash = query::create_survey_proof(
        &token,
        time_to_expire,
        owner_addr.clone(),
        &survey_id,
        participants_limit,
        reward_per_user,
        survey_hash.clone(),
        reward_denom.clone(),
        amount_to_gas_station,
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

    // Save survey info
    let survey_info = SurveyInfo {
        survey_creator: owner_addr,
        participants_limit,
        reward_per_user,
        participants_rewarded: 0,
        survey_hash,
        is_cancelled: false,
    };

    let amount_sent = cw_utils::must_pay(&info, reward_denom)?;

    let amount_to_survey = (participants_limit as u128)
        .checked_mul(reward_per_user)
        .ok_or(ContractError::ArithmeticError {})?;

    let total_required = Uint256::from_uint128(amount_to_survey.into())
        .checked_add(Uint256::from_uint128(amount_to_gas_station.into()))
        .map_err(|_| ContractError::ArithmeticError {})?;

    if amount_sent < total_required {
        return Err(ContractError::InvalidTransactionValue {});
    }

    let message = BankMsg::Send {
        to_address: config.gas_station.to_string(),
        amount: coins(amount_to_gas_station, reward_denom),
    };

    SURVEYS.save(deps.storage, &survey_id, &survey_info)?;

    Ok(Response::new()
        .add_message(message)
        .add_attribute("action", "create_survey"))
}

#[allow(clippy::too_many_arguments)]
pub fn cancel_survey(
    ctx: (DepsMut, &Env, MessageInfo),
    signature: Binary,
    token: String,
    time_to_expire: Expiration,
    survey_id: String,
    manager_pub_key: Binary,
) -> Result<Response, ContractError> {
    let (mut deps, env, _info) = ctx;
    let message_hash = query::cancel_survey_proof(&token, time_to_expire, &survey_id)?;

    let config = CONFIG.load(deps.storage)?;
    let reward_denom = &config.reward_denom;

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

    let funded_amount = query::get_survey_amount_to_fund(deps.as_ref(), &survey_id)?;

    let paid_amount = query::get_survey_rewards_amount_paid(deps.as_ref(), &survey_id)?;

    let return_amount = if funded_amount >= paid_amount {
        funded_amount - paid_amount
    } else {
        0
    };

    let bal = helpers::query_contract_balance(&deps.querier, &env.contract.address, &reward_denom)?;

    // that the contract has enough balance to refund
    if bal < Uint256::from_uint128(return_amount.into()) {
        return Err(ContractError::InsufficientContractBalance {});
    }

    let message = BankMsg::Send {
        to_address: survey_info.survey_creator.to_string(),
        amount: coins(return_amount, reward_denom),
    };

    Ok(Response::new()
        .add_message(message)
        .add_attribute("action", "cancel_survey")
        .add_attribute("amount", return_amount.to_string())
        .add_attribute("denom", reward_denom))
}

#[allow(clippy::too_many_arguments)]
pub fn pay_rewards(
    ctx: (DepsMut, &Env, MessageInfo),
    signature: Binary,
    token: String,
    time_to_expire: Expiration,
    survey_ids: Vec<String>,
    participants: Vec<String>,
    manager_pub_key: Binary,
) -> Result<Response, ContractError> {
    let (mut deps, env, _info) = ctx;

    if survey_ids.len() != participants.len() {
        return Err(ContractError::ArrayLengthMismatch {});
    }

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

    let mut messages: Vec<BankMsg> = Vec::new();
    let config = CONFIG.load(deps.storage)?;

    for i in 0..survey_ids.len() {
        let survey_id = &survey_ids[i];
        let participant = deps.api.addr_validate(&participants[i])?;

        let already_rewarded = SURVEY_REWARDED_USERS
            .load(deps.storage, (survey_id.as_str(), &participant))
            .unwrap_or(false);

        if already_rewarded {
            return Err(ContractError::UserAlreadyRewarded {});
        }

        SURVEYS.update(
            deps.storage,
            survey_id,
            |survey_info| -> Result<SurveyInfo, ContractError> {
                let mut survey_info = survey_info.ok_or(ContractError::SurveyNotFound {})?;

                // check if survey is cancelled
                if survey_info.is_cancelled {
                    return Err(ContractError::SurveyAlreadyCancelled {});
                }

                // check if all participants has been rewarded
                if survey_info.participants_rewarded >= survey_info.participants_limit {
                    return Err(ContractError::AllParticipantsRewarded {});
                }

                // check if user already rewarded

                messages.push(BankMsg::Send {
                    to_address: participant.to_string(),
                    amount: coins(survey_info.reward_per_user, &config.reward_denom),
                });

                survey_info.participants_rewarded += 1;

                Ok(survey_info)
            },
        )?;

        // mark user as rewarded
        SURVEY_REWARDED_USERS.save(deps.storage, (survey_id.as_str(), &participant), &true)?;
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("action", "pay_rewards"))
}

pub fn set_manager(
    ctx: (DepsMut, &Env, MessageInfo),
    manager_addr: &str,
    pub_key: Binary,
    status: bool,
) -> Result<Response, ContractError> {
    let (deps, _env, info) = ctx;
    let sender = info.sender;

    helpers::check_is_contract_owner(deps.as_ref(), sender)?;

    let manager_addr = deps.api.addr_validate(manager_addr)?;

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

pub fn set_gas_station(
    ctx: (DepsMut, &Env, MessageInfo),
    new_gas_station: &str,
) -> Result<Response, ContractError> {
    let (deps, _env, info) = ctx;
    let sender = info.sender;
    helpers::check_is_contract_owner(deps.as_ref(), sender)?;

    let new_gas_station = deps.api.addr_validate(new_gas_station)?;

    CONFIG.update(
        deps.storage,
        |mut config| -> Result<Config, ContractError> {
            config.gas_station = new_gas_station;
            Ok(config)
        },
    )?;

    Ok(Response::new().add_attribute("action", "set_gas_station"))
}

// Transfer ownership of this contract
pub fn transfer_ownership(
    deps: DepsMut,
    sender: Addr,
    new_owner: String,
) -> Result<Response, ContractError> {
    // only owner can transfer
    helpers::check_is_contract_owner(deps.as_ref(), sender)?;
    let new_owner = deps.api.addr_validate(&new_owner)?;

    CONFIG.update(
        deps.storage,
        |mut config| -> Result<Config, ContractError> {
            config.owner = new_owner;
            Ok(config)
        },
    )?;

    Ok(Response::new().add_attribute("action", "transfer_ownership"))
}
