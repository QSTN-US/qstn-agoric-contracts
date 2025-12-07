/**
 * @file Message validation helpers for qstn flow
 */

import { Fail, makeError, q } from '@endo/errors';
import { mustMatch } from '@endo/patterns';
import { CosmosPayloadShape, EvmPayloadShape } from './type-guards.js';
import { buildGMPPayload } from './gmp.js';

/**
 * @import {AccountTapState, CrossChainContractMessage, CosmosPayload, EvmPayload} from "./types.js";
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
  const { destinationChain, type, chainType, payload } = message;

  // Validate chain-specific data
  if (chainType === 'evm') {
    if (!accountState.transferChannels.Axelar) {
      throw makeError(`GMP transfers not enabled`);
    }

    mustMatch(payload, EvmPayloadShape);

    const evmPayload = /** @type {EvmPayload} */ (payload);

    const remoteChannel = accountState.transferChannels.Axelar;

    const { remoteChainInfo } = remoteChannel;

    const destinationAddress =
      accountState.contracts[destinationChain].quizzler;

    /** @type {axelarGmpOutgoingMemo} */
    const memo = {
      destination_chain: accountState.chainIds[destinationChain],
      destination_address: destinationAddress,
      payload: buildGMPPayload(evmPayload),
      type,
    };

    if (type === 1 || type === 2) {
      memo.fee = {
        amount: String(message.amountFee),
        recipient: accountState.gmpAddresses.AXELAR_GAS,
      };
    }

    return {
      remoteChainId: remoteChainInfo.chainId,
      memo: JSON.stringify(memo),
      destinationAddress: accountState.gmpAddresses.AXELAR_GMP,
    };
  } else if (chainType === 'cosmos') {
    mustMatch(payload, CosmosPayloadShape);

    const cosmosPayload = /** @type {CosmosPayload} */ (payload);

    const remoteChannel = accountState.transferChannels[destinationChain];

    const { remoteChainInfo } = remoteChannel;

    const destinationAddress =
      accountState.contracts[destinationChain].quizzler;

    const memo = {
      wasm: {
        ...cosmosPayload,
        contract: destinationAddress,
      },
    };

    return {
      remoteChainId: remoteChainInfo.chainId,
      memo: JSON.stringify(memo),
      destinationAddress,
    };
  } else {
    throw Fail`Invalid chainType: ${q(chainType)}. Must be 'evm' or 'cosmos'`;
  }
};
