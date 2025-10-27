use crate::error::ContractError;
use crate::msg::Manager;
use crate::state::{ManagerInfo, CONFIG, MANAGERS, USED_PROOF_TOKENS};
use cosmwasm_std::{Addr, Api, Binary, Deps, DepsMut, Env, StdResult};
use cw_utils::Expiration;

pub fn map_validate(api: &dyn Api, managers: &[Manager]) -> StdResult<Vec<ManagerInfo>> {
    managers
        .iter()
        .map(|admin| {
            Ok(ManagerInfo {
                address: api.addr_validate(&admin.addr)?,
                pub_key: admin.pub_key.clone(),
                status: true,
            })
        })
        .collect()
}

pub fn pre_auth_validations(
    deps: &DepsMut,
    env: &Env,
    token: String,
    message: Binary,
    pub_key: Binary,
    time_to_expire: Expiration,
    signature: Binary,
) -> StdResult<(), ContractError> {
    // Check expiration
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
