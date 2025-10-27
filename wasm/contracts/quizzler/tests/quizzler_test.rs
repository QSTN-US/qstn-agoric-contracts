#![allow(unused_imports)]
#![allow(dead_code)]

mod test_env;

use cosmwasm_std::{coins, Addr, BankMsg, Binary, DepsMut, Env, MessageInfo, Response, Uint256};
use cw_multi_test::{Executor, IntoAddr};
use cw_utils::Expiration;
use quizzler::{
    msg::{ExecuteMsg, QueryMsg},
    ContractError,
};

use test_env::*;

#[test]
fn test_create_survey() {
    // Setup
    let TestEnv {
        mut app,
        quizzler_address,
        owner,
        manager_keys,
    } = TestEnv::new();

    let survey_id = "survey1".to_string();
    let survey_data = dummy_survey(survey_id.clone());
    let manager = &manager_keys[0];
    let token = "token1".to_string();
    let expiration = Expiration::AtHeight(20000);
    let denom = "uosmo";

    // Get proof and signature
    let create_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CreateSurveyProof {
                token: token.clone(),
                time_to_expire: expiration,
                owner: survey_data.survey_creator.clone(),
                survey_id: survey_id.clone(),
                participants_limit: survey_data.participants_limit,
                reward_per_user: survey_data.reward_per_user,
                survey_hash: survey_data.survey_hash.clone(),
                reward_denom: denom.to_string(),
                amount_to_gas_station: survey_data.amount_to_gas_station,
            },
        )
        .unwrap();

    let signature = sign_message(&create_survey_proof, &manager.signing_key);

    // Execute create survey
    app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CreateSurvey {
            signature,
            token,
            time_to_expire: expiration,
            owner: survey_data.survey_creator.clone(),
            survey_id: survey_id.clone(),
            participants_limit: survey_data.participants_limit,
            reward_per_user: survey_data.reward_per_user,
            survey_hash: survey_data.survey_hash.clone(),
            amount_to_gas_station: survey_data.amount_to_gas_station,
            manager_pub_key: manager.pub_key.clone(),
        },
        &coins(1100u128, denom),
    )
    .unwrap();

    // Verify balances
    let contract_balance = app
        .wrap()
        .query_balance(&quizzler_address, denom)
        .unwrap()
        .amount;

    let gas_station_balance = app
        .wrap()
        .query_balance(&"gas_station".into_addr(), denom)
        .unwrap()
        .amount;

    assert_eq!(contract_balance, Uint256::from(1000u128));
    assert_eq!(gas_station_balance, Uint256::from(100u128));

    // Verify survey data
    let survey_response: quizzler::msg::SurveyResponse = app
        .wrap()
        .query_wasm_smart(quizzler_address, &QueryMsg::GetSurvey { survey_id })
        .unwrap();

    assert_eq!(survey_response.survey_creator, survey_data.survey_creator);
    assert_eq!(
        survey_response.participants_limit,
        survey_data.participants_limit
    );
    assert_eq!(survey_response.reward_per_user, survey_data.reward_per_user);
    assert_eq!(survey_response.survey_hash, survey_data.survey_hash);
    assert_eq!(survey_response.is_cancelled, false);
    assert_eq!(survey_response.participants_rewarded, 0);
}

#[test]
fn test_cancel_survey() {
    // Setup
    let TestEnv {
        mut app,
        quizzler_address,
        owner,
        manager_keys,
    } = TestEnv::new();

    let survey_id = "survey_to_cancel".to_string();
    let survey_data = dummy_survey(survey_id.clone());
    let manager = &manager_keys[0];
    let token = "token_cancel".to_string();
    let expiration = Expiration::AtHeight(20000);
    let denom = "uosmo";

    // Get proof and signature for creating survey
    let create_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CreateSurveyProof {
                token: token.clone(),
                time_to_expire: expiration,
                owner: survey_data.survey_creator.clone(),
                survey_id: survey_id.clone(),
                participants_limit: survey_data.participants_limit,
                reward_per_user: survey_data.reward_per_user,
                survey_hash: survey_data.survey_hash.clone(),
                reward_denom: denom.to_string(),
                amount_to_gas_station: survey_data.amount_to_gas_station,
            },
        )
        .unwrap();

    let create_signature = sign_message(&create_survey_proof, &manager.signing_key);

    // Execute create survey
    app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CreateSurvey {
            signature: create_signature,
            token: token.clone(),
            time_to_expire: expiration,
            owner: survey_data.survey_creator.clone(),
            survey_id: survey_id.clone(),
            participants_limit: survey_data.participants_limit,
            reward_per_user: survey_data.reward_per_user,
            survey_hash: survey_data.survey_hash.clone(),
            amount_to_gas_station: survey_data.amount_to_gas_station,
            manager_pub_key: manager.pub_key.clone(),
        },
        &coins(1100u128, denom),
    )
    .unwrap();

    let contract_balance = app
        .wrap()
        .query_balance(&quizzler_address, denom)
        .unwrap()
        .amount;

    assert_eq!(contract_balance, Uint256::from(1000u128));

    let cancel_token = "token_cancel_survey".to_string();

    // Get proof and signature for cancelling survey
    let cancel_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CancelSurveyProof {
                token: cancel_token.clone(),
                time_to_expire: expiration,
                survey_id: survey_id.clone(),
            },
        )
        .unwrap();

    let cancel_signature = sign_message(&cancel_survey_proof, &manager.signing_key);

    // Execute cancel survey
    app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CancelSurvey {
            signature: cancel_signature,
            token: cancel_token,
            time_to_expire: expiration,
            survey_id: survey_id.clone(),
            manager_pub_key: manager.pub_key.clone(),
        },
        &[],
    )
    .unwrap();

    // Verify survey is cancelled
    let survey_response: quizzler::msg::SurveyResponse = app
        .wrap()
        .query_wasm_smart(quizzler_address, &QueryMsg::GetSurvey { survey_id })
        .unwrap();
    assert_eq!(survey_response.is_cancelled, true);

    // Check that creator has been refunded the unspent rewards
    let creator_balance = app
        .wrap()
        .query_balance(&"creator".into_addr(), denom)
        .unwrap()
        .amount;

    let expected_refund = Uint256::from(
        (survey_data.participants_limit as u128 * survey_data.reward_per_user) - 0u128,
    ); // No participants rewarded yet

    assert_eq!(creator_balance, expected_refund);
}

#[test]
fn test_pay_rewards() {
    // Setup test environment
    let TestEnv {
        mut app,
        quizzler_address,
        owner,
        manager_keys,
    } = TestEnv::new();

    let manager = &manager_keys[0];
    let survey_id = "test_survey".to_string();
    let create_token = "create_token".to_string();
    let reward_token = "reward_token".to_string();
    let participant = "participant1".into_addr().to_string();
    let expiration = Expiration::AtHeight(20000);
    let denom = "uosmo";
    let survey_data = dummy_survey(survey_id.clone());

    // Create survey
    let create_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CreateSurveyProof {
                token: create_token.clone(),
                time_to_expire: expiration,
                owner: survey_data.survey_creator.clone(),
                survey_id: survey_id.clone(),
                participants_limit: survey_data.participants_limit,
                reward_per_user: survey_data.reward_per_user,
                survey_hash: survey_data.survey_hash.clone(),
                reward_denom: denom.to_string(),
                amount_to_gas_station: survey_data.amount_to_gas_station,
            },
        )
        .unwrap();

    let create_signature = sign_message(&create_survey_proof, &manager.signing_key);

    app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CreateSurvey {
            signature: create_signature,
            token: create_token,
            time_to_expire: expiration,
            owner: survey_data.survey_creator.clone(),
            survey_id: survey_id.clone(),
            participants_limit: survey_data.participants_limit,
            reward_per_user: survey_data.reward_per_user,
            survey_hash: survey_data.survey_hash.clone(),
            amount_to_gas_station: survey_data.amount_to_gas_station,
            manager_pub_key: manager.pub_key.clone(),
        },
        &coins(1100u128, denom),
    )
    .unwrap();

    // Verify initial contract balance
    let initial_balance = app
        .wrap()
        .query_balance(&quizzler_address, denom)
        .unwrap()
        .amount;
    assert_eq!(initial_balance, Uint256::from(1000u128));

    // Pay rewards
    let pay_reward_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::PayRewardsProof {
                token: reward_token.clone(),
                time_to_expire: expiration,
                survey_ids: vec![survey_id.clone()],
                participants: vec![participant.clone()],
            },
        )
        .unwrap();

    let pay_signature = sign_message(&pay_reward_proof, &manager.signing_key);

    app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::PayRewards {
            signature: pay_signature,
            token: reward_token,
            time_to_expire: expiration,
            survey_ids: vec![survey_id.clone()],
            participants: vec![participant.clone()],
            manager_pub_key: manager.pub_key.clone(),
        },
        &[],
    )
    .unwrap();

    // Verify final balances
    let participant_balance = app
        .wrap()
        .query_balance("participant1".into_addr(), denom)
        .unwrap()
        .amount;

    assert_eq!(
        participant_balance,
        Uint256::from(survey_data.reward_per_user)
    );

    let final_contract_balance = app
        .wrap()
        .query_balance(&quizzler_address, denom)
        .unwrap()
        .amount;
    let expected_balance = initial_balance - Uint256::from(survey_data.reward_per_user);
    assert_eq!(final_contract_balance, expected_balance);
}

#[test]
fn test_authentication_fails_with_wrong_signature() {
    // Setup
    let TestEnv {
        mut app,
        quizzler_address,
        owner,
        manager_keys,
    } = TestEnv::new();

    let survey_id = "survey_wrong_signature".to_string();
    let survey_data = dummy_survey(survey_id.clone());
    let manager = &manager_keys[0];
    let token = "token_wrong_signature".to_string();
    let expiration = Expiration::AtHeight(20000);
    let denom = "uosmo";

    // Get proof and signature
    let create_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CreateSurveyProof {
                token: token.clone(),
                time_to_expire: expiration,
                owner: survey_data.survey_creator.clone(),
                survey_id: survey_id.clone(),
                participants_limit: survey_data.participants_limit,
                reward_per_user: survey_data.reward_per_user,
                survey_hash: survey_data.survey_hash.clone(),
                reward_denom: denom.to_string(),
                amount_to_gas_station: survey_data.amount_to_gas_station,
            },
        )
        .unwrap();

    // Tamper with the proof to create a wrong signature
    let mut tampered_proof = create_survey_proof.to_vec();
    tampered_proof[0] ^= 0xFF; // Flip the first byte

    let wrong_signature = sign_message(&Binary::from(tampered_proof), &manager.signing_key);
    // Attempt to execute create survey with wrong signature
    let result = app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CreateSurvey {
            signature: wrong_signature,
            token,
            time_to_expire: expiration,
            owner: survey_data.survey_creator.clone(),
            survey_id: survey_id.clone(),
            participants_limit: survey_data.participants_limit,
            reward_per_user: survey_data.reward_per_user,
            survey_hash: survey_data.survey_hash.clone(),
            amount_to_gas_station: survey_data.amount_to_gas_station,
            manager_pub_key: manager.pub_key.clone(),
        },
        &coins(1100u128, denom),
    );

    // Verify that the execution failed due to wrong signature
    assert!(result.is_err());
}

#[test]
fn test_authentication_fails_with_invalid_signer() {
    // Setup
    let TestEnv {
        mut app,
        quizzler_address,
        owner,
        ..
    } = TestEnv::new();

    let survey_id = "survey_invalid_signer".to_string();
    let survey_data = dummy_survey(survey_id.clone());
    let (invalid_manager_vk, invalid_manager_sk) = generate_keys().unwrap();

    let token = "token_invalid_signer".to_string();
    let expiration = Expiration::AtHeight(20000);
    let denom = "uosmo";

    // Get proof and signature
    let create_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CreateSurveyProof {
                token: token.clone(),
                time_to_expire: expiration,
                owner: survey_data.survey_creator.clone(),
                survey_id: survey_id.clone(),
                participants_limit: survey_data.participants_limit,
                reward_per_user: survey_data.reward_per_user,
                survey_hash: survey_data.survey_hash.clone(),
                reward_denom: denom.to_string(),
                amount_to_gas_station: survey_data.amount_to_gas_station,
            },
        )
        .unwrap();

    let signature = sign_message(&create_survey_proof, &invalid_manager_sk);

    let invalid_manager_vk_bytes: [u8; 32] = invalid_manager_vk.into();

    // Attempt to execute create survey with invalid signer
    let result = app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CreateSurvey {
            signature,
            token,
            time_to_expire: expiration,
            owner: survey_data.survey_creator.clone(),
            survey_id: survey_id.clone(),
            participants_limit: survey_data.participants_limit,
            reward_per_user: survey_data.reward_per_user,
            survey_hash: survey_data.survey_hash.clone(),
            amount_to_gas_station: survey_data.amount_to_gas_station,
            manager_pub_key: Binary::from(invalid_manager_vk_bytes.to_vec()),
        },
        &coins(1100u128, denom),
    );

    // Verify that the execution failed due to invalid signer
    assert!(result.is_err());
}

#[test]
fn test_authentication_fails_with_expired_expiration() {
    // Setup
    let TestEnv {
        mut app,
        quizzler_address,
        owner,
        manager_keys,
    } = TestEnv::new();

    let survey_id = "survey_expired".to_string();
    let survey_data = dummy_survey(survey_id.clone());
    let manager = &manager_keys[0];
    let token = "token_expired".to_string();
    let expiration = Expiration::AtHeight(1); // Set expiration to a past height
    let denom = "uosmo";

    // Get proof and signature
    let create_survey_proof: Binary = app
        .wrap()
        .query_wasm_smart(
            quizzler_address.clone(),
            &QueryMsg::CreateSurveyProof {
                token: token.clone(),
                time_to_expire: expiration,
                owner: survey_data.survey_creator.clone(),
                survey_id: survey_id.clone(),
                participants_limit: survey_data.participants_limit,
                reward_per_user: survey_data.reward_per_user,
                survey_hash: survey_data.survey_hash.clone(),
                reward_denom: denom.to_string(),
                amount_to_gas_station: survey_data.amount_to_gas_station,
            },
        )
        .unwrap();

    let signature = sign_message(&create_survey_proof, &manager.signing_key);
    // Attempt to execute create survey with expired expiration
    let result = app.execute_contract(
        owner.clone(),
        quizzler_address.clone(),
        &ExecuteMsg::CreateSurvey {
            signature,
            token,
            time_to_expire: expiration,
            owner: survey_data.survey_creator.clone(),
            survey_id: survey_id.clone(),
            participants_limit: survey_data.participants_limit,
            reward_per_user: survey_data.reward_per_user,
            survey_hash: survey_data.survey_hash.clone(),
            amount_to_gas_station: survey_data.amount_to_gas_station,
            manager_pub_key: manager.pub_key.clone(),
        },
        &coins(1100u128, denom),
    );

    // Verify that the execution failed due to expired expiration
    assert!(result.is_err());
}
