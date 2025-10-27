use cosmwasm_std::{coins, Addr, Binary, StdResult};
use cw_multi_test::{App, ContractWrapper, Executor, IntoAddr};
use ed25519_zebra::{SigningKey, VerificationKey};
use quizzler::contract::{execute, instantiate, query};
use quizzler::msg::{InstantiateMsg, Manager};
use rand_core::OsRng;

pub struct ManagerKeys {
    pub addr: Addr,
    pub pub_key: Binary,
    pub signing_key: SigningKey,
}

pub struct TestEnv {
    pub app: App,
    pub quizzler_address: Addr,
    pub owner: Addr,
    pub manager_keys: Vec<ManagerKeys>,
}

impl Default for TestEnv {
    fn default() -> Self {
        Self::new()
    }
}

impl TestEnv {
    pub fn new() -> Self {
        let owner = "owner".into_addr();

        let mut app = App::new(|router, _, storage| {
            router
                .bank
                .init_balance(storage, &owner, coins(2000, "uosmo"))
                .unwrap()
        });

        let managers = vec!["manager1".into_addr(), "manager2".into_addr()];

        let gas_station = "gas_station".into_addr();

        let reward_denom = "uosmo";

        // Generate keys for managers
        let mut manager_addrs = Vec::new();
        let mut manager_keys = Vec::new();

        for mgr in &managers {
            let (pub_key, signing_key) = generate_keys().unwrap();

            let public_key_bytes: [u8; 32] = pub_key.into();

            let pub_key_binary = Binary::from(public_key_bytes.to_vec());

            manager_addrs.push(Manager {
                addr: mgr.to_string(),
                pub_key: pub_key_binary.clone(),
            });

            manager_keys.push(ManagerKeys {
                addr: mgr.clone(),
                pub_key: pub_key_binary,
                signing_key,
            });
        }

        println!("Deploying the quizzler contract");

        let code = ContractWrapper::new(execute, instantiate, query);

        let code_id = app.store_code(Box::new(code));

        let quizzler_address = app
            .instantiate_contract(
                code_id,
                owner.clone(),
                &InstantiateMsg {
                    managers: manager_addrs,
                    gas_station: gas_station.to_string(),
                    reward_denom: reward_denom.to_string(),
                },
                &[],
                "Quizzler",
                None,
            )
            .unwrap();

        println!("Quizzler contract deployed at: {}", quizzler_address);

        TestEnv {
            app,
            quizzler_address,
            owner,
            manager_keys,
        }
    }
}

pub struct SurveyMock {
    pub survey_creator: String,
    pub survey_id: String,
    pub participants_limit: u32,
    pub reward_per_user: u128,
    pub survey_hash: Binary,
    pub amount_to_gas_station: u128,
}

pub fn dummy_survey(survey_id: String) -> SurveyMock {
    SurveyMock {
        survey_creator: "creator".into_addr().to_string(),
        survey_id,
        participants_limit: 100,
        reward_per_user: 10u128,
        survey_hash: Binary::from(b"dummy_hash".to_vec()),
        amount_to_gas_station: 100u128,
    }
}

pub fn generate_keys() -> StdResult<(VerificationKey, SigningKey)> {
    let signing_key = SigningKey::new(OsRng);
    let verifying_key = VerificationKey::from(&signing_key);
    Ok((verifying_key, signing_key))
}

pub fn sign_message(message: &Binary, signing_key: &SigningKey) -> Binary {
    let signature = signing_key.sign(&message);
    Binary::from(signature.to_bytes().to_vec())
}
