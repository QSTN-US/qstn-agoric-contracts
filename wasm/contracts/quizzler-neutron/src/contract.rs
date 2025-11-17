#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::StdError;
use neutron_sdk::sudo::msg::TransferSudoMsg;

use crate::error::ContractError;
use crate::execute;
use crate::ibc_lifecycle;
use crate::msg::{ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg};
use crate::query;
use crate::state::{Config, CONFIG, IBC_SUDO_ID_RANGE_END, IBC_SUDO_ID_RANGE_START, MANAGERS};

use crate::helpers as quizzler_helpers;

use cosmwasm_std::{
    to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Reply, Response, StdResult,
};
use cw2::set_contract_version;

// version info for migration info
const CONTRACT_NAME: &str = "crates.io:quizzler";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Handling contract instantiation
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let cfg = quizzler_helpers::map_validate(&msg.receiver_prefix, &msg.managers)?;

    for manager in cfg.iter() {
        MANAGERS.save(deps.storage, &manager.address, manager)?;
    }

    let config = Config {
        owner: info.sender,
        receiver_prefix: msg.receiver_prefix,
        channel_id: msg.channel_id,
    };

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::default())
}

/// Handling contract execution
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::SetManagers {
            managers,
            pub_key,
            status,
        } => execute::set_manager((deps, &env, info), &managers, pub_key, status),
        ExecuteMsg::CreateSurvey {
            signature,
            token,
            time_to_expire,
            owner,
            survey_id,
            participants_limit,
            reward_denom,
            reward_amount,
            survey_hash,
            manager_pub_key,
        } => execute::create_survey(
            (deps, &env, info),
            signature,
            token,
            time_to_expire,
            owner,
            survey_id,
            participants_limit,
            reward_denom,
            reward_amount,
            survey_hash,
            manager_pub_key,
        ),
        ExecuteMsg::CancelSurvey {
            signature,
            token,
            time_to_expire,
            survey_id,
            manager_pub_key,
        } => execute::cancel_survey(
            (deps, &env, info),
            signature,
            token,
            time_to_expire,
            survey_id,
            manager_pub_key,
        ),
        ExecuteMsg::PayRewards {
            signature,
            token,
            time_to_expire,
            survey_ids,
            participants,
            manager_pub_key,
        } => execute::pay_rewards(
            (deps, &env, info),
            signature,
            token,
            time_to_expire,
            survey_ids,
            participants,
            manager_pub_key,
        ),
        ExecuteMsg::TransferOwnership { new_owner } => {
            execute::transfer_ownership((deps, &env, info), new_owner)
        }
    }
}

/// Handling contract query
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::CancelSurveyProof {
            token,
            time_to_expire,
            survey_id,
        } => {
            let query_resp =
                query::cancel_survey_proof(token.as_str(), time_to_expire, survey_id.as_str())?;

            to_json_binary(&query_resp)
        }
        QueryMsg::CreateSurveyProof {
            token,
            time_to_expire,
            owner,
            survey_id,
            participants_limit,
            reward_amount,
            survey_hash,
            reward_denom,
        } => {
            let query_resp = query::create_survey_proof(
                &token,
                time_to_expire,
                &owner,
                &survey_id,
                participants_limit,
                reward_amount,
                &survey_hash,
                &reward_denom,
            )?;

            to_json_binary(&query_resp)
        }
        QueryMsg::PayRewardsProof {
            token,
            time_to_expire,
            survey_ids,
            participants,
        } => {
            let query_resp =
                query::pay_rewards_proof(&token, time_to_expire, survey_ids, participants)?;

            to_json_binary(&query_resp)
        }
        QueryMsg::GetSurvey { survey_id } => {
            let resp = query::get_survey(deps, survey_id.as_str())?;
            to_json_binary(&resp)
        }
        QueryMsg::GetSurveyAmountToFund { survey_id } => {
            let amount = query::get_survey_amount_to_fund(deps, survey_id.as_str())?;
            to_json_binary(&amount)
        }
        QueryMsg::GetSurveyRewardsAmountPaid { survey_id } => {
            let amount = query::get_survey_rewards_amount_paid(deps, survey_id.as_str())?;
            to_json_binary(&amount)
        }
        QueryMsg::GetConfig {} => {
            let config: Config = CONFIG.load(deps.storage)?;
            to_json_binary(&config)
        }
        QueryMsg::GetHasClaimedReward {
            survey_id,
            participant,
        } => {
            let has_claimed =
                query::get_has_claimed_reward(deps, survey_id.as_str(), participant.as_str())?;
            to_json_binary(&has_claimed)
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    Ok(Response::default())
}

// Handle sudo callbacks from the Neutron blockchain
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn sudo(deps: DepsMut, _env: Env, msg: TransferSudoMsg) -> StdResult<Response> {
    match msg {
        // Handle successful acknowledgements (non-error)
        TransferSudoMsg::Response { request, data } => {
            ibc_lifecycle::sudo_response(deps, request, data)
        }

        // Handle error acknowledgements
        TransferSudoMsg::Error { request, details } => {
            ibc_lifecycle::sudo_error(deps, request, details)
        }

        // Handle timeouts
        TransferSudoMsg::Timeout { request } => ibc_lifecycle::sudo_timeout(deps, request),
    }
}

/// Handling submessage reply.
/// For more info on submessage and reply, see https://github.com/CosmWasm/cosmwasm/blob/main/SEMANTICS.md#submessages
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(deps: DepsMut, env: Env, msg: Reply) -> StdResult<Response> {
    match msg.id {
        IBC_SUDO_ID_RANGE_START..=IBC_SUDO_ID_RANGE_END => {
            ibc_lifecycle::prepare_sudo_payload(deps, env, msg)
        }
        _ => Err(StdError::generic_err(format!(
            "unsupported reply message id {}",
            msg.id
        ))),
    }
}
