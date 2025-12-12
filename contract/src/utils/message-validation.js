/**
 * @file Message validation helpers for qstn flow
 */

import { Fail, makeError, q } from '@endo/errors';
import { mustMatch } from '@endo/patterns';
import { makeTracer } from '@agoric/internal';
import { CosmosPayloadShape, EvmPayloadShape } from './type-guards.js';
import { buildGMPPayload } from './gmp.js';
import { Tracer } from './tracer.js';

/**
 * @import {AccountTapState, CrossChainContractMessage, CosmosPayload, EvmPayload} from "./types.js";
 * @import {axelarGmpOutgoingMemo} from '../../types.js';
 */

const trace = makeTracer(`${Tracer}-MessageValidation`);

/**
 * Validates a single message and returns data needed for transfer
 *
 * @param {CrossChainContractMessage} message
 * @param {AccountTapState} accountState
 * @returns {Promise<{remoteChainId: string, memo: any, destinationAddress: string}>}
 */
export const validateMessage = async (message, accountState) => {
  trace('validateMessage called');
  const { destinationChain, type, chainType, payload } = message;
  trace('Message details:', {
    destinationChain,
    type,
    chainType,
  });

  // Validate chain-specific data
  if (chainType === 'evm') {
    trace('Processing EVM chain message');
    if (!accountState.transferChannels.Axelar) {
      trace('ERROR: Axelar transfer channel not available');
      throw makeError(`GMP transfers not enabled`);
    }
    trace('Axelar transfer channel available');

    trace('Validating EVM payload against EvmPayloadShape');
    mustMatch(payload, EvmPayloadShape);
    trace('EVM payload validated successfully');

    const evmPayload = /** @type {EvmPayload} */ (payload);

    const remoteChannel = accountState.transferChannels.Axelar;
    trace('Remote channel obtained:', remoteChannel.remoteChainInfo.chainId);

    const { remoteChainInfo } = remoteChannel;

    const destinationAddress =
      accountState.contracts[destinationChain].quizzler;
    trace('Destination contract address:', destinationAddress);

    trace('Building GMP memo');
    /** @type {axelarGmpOutgoingMemo} */
    const memo = {
      destination_chain: accountState.chainIds[destinationChain],
      destination_address: destinationAddress,
      payload: buildGMPPayload(evmPayload),
      type,
    };
    trace('GMP payload built');

    if (type === 1 || type === 2) {
      trace('Adding fee to memo for type', type);
      memo.fee = {
        amount: String(message.amountFee),
        recipient: accountState.gmpAddresses.AXELAR_GAS,
      };
      trace('Fee added:', memo.fee);
    }

    const result = {
      remoteChainId: remoteChainInfo.chainId,
      memo: JSON.stringify(memo),
      destinationAddress: accountState.gmpAddresses.AXELAR_GMP,
    };
    trace('EVM message validation complete, remoteChainId:', result.remoteChainId);
    return result;
  } else if (chainType === 'cosmos') {
    trace('Processing Cosmos chain message');

    trace('Validating Cosmos payload against CosmosPayloadShape');
    mustMatch(payload, CosmosPayloadShape);
    trace('Cosmos payload validated successfully');

    const cosmosPayload = /** @type {CosmosPayload} */ (payload);

    const remoteChannel = accountState.transferChannels[destinationChain];
    trace('Remote channel obtained for', destinationChain);

    const { remoteChainInfo } = remoteChannel;
    trace('Remote chain info:', remoteChainInfo.chainId);

    const destinationAddress =
      accountState.contracts[destinationChain].quizzler;
    trace('Destination contract address:', destinationAddress);

    trace('Building Cosmos WASM memo');
    const memo = {
      wasm: {
        ...cosmosPayload,
        contract: destinationAddress,
      },
    };
    trace('WASM memo built');

    const result = {
      remoteChainId: remoteChainInfo.chainId,
      memo: JSON.stringify(memo),
      destinationAddress,
    };
    trace('Cosmos message validation complete, remoteChainId:', result.remoteChainId);
    return result;
  } else {
    trace('ERROR: Invalid chainType:', chainType);
    throw Fail`Invalid chainType: ${q(chainType)}. Must be 'evm' or 'cosmos'`;
  }
};
