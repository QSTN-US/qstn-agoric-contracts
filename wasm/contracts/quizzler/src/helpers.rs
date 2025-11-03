use crate::error::ContractError;
use crate::msg::Manager;
use crate::state::{ManagerInfo, CONFIG, MANAGERS, USED_PROOF_TOKENS};
use cosmwasm_std::{
    Addr, BalanceResponse, BankQuery, Binary, Coin, Deps, DepsMut, Env, IbcMsg, IbcTimeout,
    QuerierWrapper, QueryRequest, StdResult, Uint256,
};
use cw_utils::Expiration;

pub fn map_validate(receiver_prefix: &str, managers: &[Manager]) -> StdResult<Vec<ManagerInfo>> {
    managers
        .iter()
        .map(|admin| {
            let (_, validated_addr) = validate_account(receiver_prefix, &admin.addr)?;
            Ok(ManagerInfo {
                address: validated_addr,
                pub_key: admin.pub_key.clone(),
                status: true,
            })
        })
        .collect()
}

pub fn validate_account(
    receiver_prefix: &str,
    receiver: &str,
) -> StdResult<(String, Addr), ContractError> {
    let Ok((prefix, _, _)) = bech32::decode(receiver) else {
        return Err(ContractError::InvalidAccount {
            receiver: receiver.to_string(),
        });
    };

    if prefix != receiver_prefix {
        return Err(ContractError::ExpectedAgoricAccount {
            receiver: receiver.to_string(),
        });
    }

    Ok((prefix, Addr::unchecked(receiver)))
}

pub fn auth_validations(
    deps: &mut DepsMut,
    env: &Env,
    token: String,
    message: Binary,
    pub_key: Binary,
    time_to_expire: Expiration,
    signature: Binary,
) -> StdResult<(), ContractError> {
    if time_to_expire.is_expired(&env.block) {
        return Err(ContractError::ProofExpired {});
    }

    let proof_token_exists = USED_PROOF_TOKENS
        .load(deps.storage, &token)
        .unwrap_or(false);

    if proof_token_exists {
        return Err(ContractError::TokenAlreadyUsed {});
    }

    // Verify pub key exists
    let managers = MANAGERS
        .range(deps.storage, None, None, cosmwasm_std::Order::Ascending)
        .collect::<StdResult<Vec<(Addr, ManagerInfo)>>>()?;

    let mut pub_key_exists = false;

    for (_addr, manager_info) in managers.iter() {
        if manager_info.pub_key == pub_key && manager_info.status {
            pub_key_exists = true;
            break;
        }
    }

    if !pub_key_exists {
        return Err(ContractError::InvalidSigner {});
    }

    let result = deps.api.ed25519_verify(&message, &signature, &pub_key)?;

    // mark proof token as used
    USED_PROOF_TOKENS.save(deps.storage, &token, &true)?;

    if !result {
        return Err(ContractError::InvalidMessageHash {});
    }

    Ok(())
}

pub fn check_is_contract_owner(deps: Deps, sender: Addr) -> Result<(), ContractError> {
    let config = CONFIG.load(deps.storage).unwrap();
    if config.owner != sender {
        Err(ContractError::Unauthorized {})
    } else {
        Ok(())
    }
}

pub fn query_contract_balance(
    querier: &QuerierWrapper,
    addr: &Addr,
    denom: &str,
) -> StdResult<Uint256> {
    let resp: BalanceResponse = querier.query(&QueryRequest::Bank(BankQuery::Balance {
        address: addr.to_string(),
        denom: denom.to_string(),
    }))?;
    Ok(resp.amount.amount)
}

pub fn create_ibc_transfer(
    deps: Deps,
    env: &Env,
    receiver: &str,
    coin: Coin,
) -> StdResult<IbcMsg, ContractError> {
    let config = CONFIG.load(deps.storage).unwrap();

    let _ = validate_account(&config.receiver_prefix, receiver)?;

    let ibc_transfer_msg = IbcMsg::Transfer {
        channel_id: config.channel_id,
        to_address: receiver.to_string(),
        amount: coin,
        timeout: IbcTimeout::with_timestamp(
            env.block.time.plus_seconds(600), // 10 minutes
        ),
        memo: Option::None,
    };

    Ok(ibc_transfer_msg)
}

pub fn ibc_message_event(context: &str) -> cosmwasm_std::Event {
    cosmwasm_std::Event::new("ibc_message_added").add_attribute("context", context)
}
