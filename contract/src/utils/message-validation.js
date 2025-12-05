/**
 * @file Message validation helpers for qstn flow
 */

import { Fail, makeError, q } from '@endo/errors';
import { mustMatch } from '@endo/patterns';
import { COSMOS_CHAINS } from './chains.js';
import { gmpAddresses } from './gmp.js';
import { CosmosPayloadShape } from './type-guards.js';

/**
 * @import {AccountTapState, CrossChainContractMessage} from "./types.js";
 * @import {axelarGmpOutgoingMemo} from '../../types.js';
 */

/**
 * Validates a single message and returns data needed for transfer
 *
 * @param {CrossChainContractMessage} message
 * @param {AccountTapState} accountState
 * @returns {Promise<{remoteChainId: string, memo: any, destinationAddress: string}>}
 */
export const validateMessage = async (message, accountState) => {
  const { destinationChain, destinationAddress, type, chainType, payload } =
    message;

  // Determine connection chain
  const chain =
    chainType === 'evm'
      ? COSMOS_CHAINS.Axelar
      : COSMOS_CHAINS[destinationChain];

  let remoteChannel;
  if (chain === 'axelar') {
    remoteChannel = accountState.axelarRemoteChannel;
  } else if (chain === 'osmosis') {
    remoteChannel = accountState.osmosisRemoteChannel;
  } else {
    remoteChannel = accountState.neutronRemoteChannel;
  }

  const { remoteChainInfo } = remoteChannel;

  // Validate chain-specific data
  if (chainType === 'evm') {
    /** @type {axelarGmpOutgoingMemo} */
    const memo = {
      destination_chain: destinationChain,
      destination_address: destinationAddress,
      payload: Array.from(payload),
      type,
    };

    if (type === 1 || type === 2) {
      memo.fee = {
        amount: String(message.amountFee),
        recipient: gmpAddresses.AXELAR_GAS,
      };
    }

    return {
      remoteChainId: remoteChainInfo.chainId,
      memo: JSON.stringify(memo),
      destinationAddress: gmpAddresses.AXELAR_GMP,
    };
  } else if (chainType === 'cosmos') {
    // Validate payload structure
    let parsedPayload;

    try {
      parsedPayload = JSON.parse(payload);
    } catch (e) {
      throw makeError(`Invalid payload: must be valid JSON string. ${q(e)}`);
    }

    mustMatch(parsedPayload, CosmosPayloadShape);

    return {
      remoteChainId: remoteChainInfo.chainId,
      memo: payload,
      destinationAddress,
    };
  } else {
    throw Fail`Invalid chainType: ${q(chainType)}. Must be 'evm' or 'cosmos'`;
  }
};
