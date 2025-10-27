use crate::error::ContractError;
use crate::msg::{ExecuteMsg, IBCLifecycleComplete, InstantiateMsg, MigrateMsg, QueryMsg, SudoMsg};
use crate::query;
use crate::state::{Config, CONFIG, MANAGERS};
use crate::{execute, ibc_lifecycle};

use crate::helpers;
#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
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

    let cfg = helpers::map_validate(deps.api, &msg.managers)?;

    for manager in cfg.iter() {
        MANAGERS.save(deps.storage, &manager.address, manager)?;
    }

    let config = Config {
        gas_station: deps.api.addr_validate(&msg.gas_station)?,
        owner: info.sender,
        reward_denom: msg.reward_denom,
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
            reward_per_user,
            survey_hash,
            amount_to_gas_station,
            manager_pub_key,
        } => execute::create_survey(
            (deps, &env, info),
            signature,
            token,
            time_to_expire,
            owner,
            survey_id,
            participants_limit,
            reward_per_user,
            survey_hash,
            amount_to_gas_station,
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
        ExecuteMsg::SetGasStation { gas_station } => {
            execute::set_gas_station((deps, &env, info), &gas_station)
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
            reward_per_user,
            survey_hash,
            reward_denom,
            amount_to_gas_station,
        } => {
            let query_resp = query::create_survey_proof(
                token.as_str(),
                time_to_expire,
                deps.api.addr_validate(&owner)?,
                survey_id.as_str(),
                participants_limit,
                reward_per_user,
                survey_hash,
                reward_denom,
                amount_to_gas_station,
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
                query::pay_rewards_proof(token.as_str(), time_to_expire, survey_ids, participants)?;

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
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, msg: MigrateMsg) -> Result<Response, ContractError> {
    match msg {}
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn sudo(deps: DepsMut, _env: Env, msg: SudoMsg) -> Result<Response, ContractError> {
    match msg {
        SudoMsg::IBCLifecycleComplete(IBCLifecycleComplete::IBCAck {
            channel,
            sequence,
            ack,
            success,
        }) => ibc_lifecycle::receive_ack(deps, channel, sequence, ack, success),
        SudoMsg::IBCLifecycleComplete(IBCLifecycleComplete::IBCTimeout { channel, sequence }) => {
            ibc_lifecycle::receive_timeout(deps, channel, sequence)
        }
    }
}

/// Handling submessage reply.
/// For more info on submessage and reply, see https://github.com/CosmWasm/cosmwasm/blob/main/SEMANTICS.md#submessages
#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(_deps: DepsMut, _env: Env, _msg: Reply) -> Result<Response, ContractError> {
    // With `Response` type, it is still possible to dispatch message to invoke external logic.
    // See: https://github.com/CosmWasm/cosmwasm/blob/main/SEMANTICS.md#dispatching-messages

    return Ok(Response::new());
}
