/**
 * @file Implements the orchestration flow for qstn
 *
 */

import { makeTracer, NonNullish } from '@agoric/internal';
import { Fail, makeError, q } from '@endo/errors';
import { COSMOS_CHAINS } from './utilities/chains.js';
import { gmpAddresses } from './utilities/gmp.js';

/**
 * @import {GuestInterface} from '@agoric/async-flow';
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {ChainHub} from '@agoric/orchestration/src/exos/chain-hub.js';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {ZoeTools} from '@agoric/orchestration/src/utils/zoe-tools.js';
 * @import {axelarGmpOutgoingMemo} from '../types.js';
 * @import {CrossChainContractMessage} from "./utilities/types.js";
 * @import {Bech32Address} from '@agoric/orchestration';
 */

const trace = makeTracer('SendTransaction');
const { entries } = Object;

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {object} ctx
 * @param {GuestInterface<ChainHub>} ctx.chainHub
 * @param {GuestInterface<ZoeTools>} ctx.zoeTools
 * @param {ZCFSeat} seat
 * @param {{
 * messages: CrossChainContractMessage[],
 * }} offerArgs
 */
export const sendTransaction = async (
  orch,
  { chainHub, zoeTools: { localTransfer, withdrawToSeat } },
  seat,
  offerArgs,
) => {
  trace('Inside sendTransaction flow');

  // Extract messages and gas amount from offer arguments
  const { messages } = offerArgs;

  trace('Offer Args:', JSON.stringify(offerArgs));

  // Get proposal from seat and extract amount
  const { give } = seat.getProposal();
  const [[_kw, amt]] = entries(give);

  // Validate transfer amount is positive
  amt.value > 0n || Fail`IBC transfer amount must be greater than zero`;

  // Add up total amount required for all chains
  const totalRequired = messages.reduce(
    (acc, msg) => acc + BigInt(msg.amountForChain) + BigInt(msg.amountFee || 0),
    0n,
  );

  totalRequired === amt.value ||
    Fail`Total amount required for all chains ${q(totalRequired)} does not match amount given ${q(amt.value)}`;

  trace('_kw, amt', _kw, amt);

  // Get Agoric chain instance
  const agoric = await orch.getChain('agoric');

  // Get asset information from vbank
  const agoricAssets = await agoric.getVBankAssetInfo();

  // Find matching asset denomination
  const { denom } = NonNullish(
    agoricAssets.find(a => a.brand === amt.brand),
    `${amt.brand} not registered in vbank`,
  );

  trace('amt and brand', amt.brand);

  // Create local account for transactions
  const localAccount = await agoric.makeAccount();

  // Transfer funds to local account
  await localTransfer(seat, localAccount, give);

  // Process each message
  for (const message of messages) {
    // Validate message parameters
    message.destinationChain != null ||
      Fail`Destination chain must be defined for message ${message}`;

    message.destinationAddress != null ||
      Fail`Destination address must be defined for message ${message}`;

    const { destinationChain, destinationAddress, type, chainType, payload } =
      message;

    // Determine connection chain
    const chain =
      chainType === 'evm'
        ? COSMOS_CHAINS.Axelar
        : COSMOS_CHAINS[destinationChain];

    const remoteChain = await orch.getChain(chain);

    trace('Connection Chain', chain);

    // Get remote chain information
    const { chainId: remoteChainId, stakingTokens } =
      await remoteChain.getChainInfo();

    const remoteDenom = stakingTokens[0].denom;
    remoteDenom || Fail`${remoteChainId} does not have stakingTokens in config`;

    trace(
      `Creating remote channel to ${destinationChain} (${chain}) with denom ${remoteDenom}`,
    );

    // Get Agoric chain ID and connection info
    const agoricChainId = (await agoric.getChainInfo()).chainId;

    const { transferChannel } = await chainHub.getConnectionInfo(
      agoricChainId,
      remoteChainId,
    );

    assert(
      transferChannel.counterPartyChannelId,
      'unable to find sourceChannel',
    );

    trace(`targets: [${destinationAddress}]`);

    /**
     * Helper function to recover if IBC Transfer fails
     *
     * @param {Error} e
     */
    const recoverFailedTransfer = async e => {
      await withdrawToSeat(localAccount, seat, give);
      const errorMsg = `IBC Transfer failed ${q(e)}`;
      trace(`ERROR: ${errorMsg}`);
      seat.fail(errorMsg);
      throw makeError(errorMsg);
    };

    if (chainType === 'evm') {
      // Handle EVM chain transfer
      /** @type {axelarGmpOutgoingMemo} */
      const memo = {
        destination_chain: destinationChain,
        destination_address: destinationAddress,
        payload: Array.from(payload),
        type,
      };

      // Add fee information for certain transaction types
      if (type === 1 || type === 2) {
        memo.fee = {
          amount: String(message.amountFee),
          recipient: gmpAddresses.AXELAR_GAS,
        };
        trace(`Fee object ${JSON.stringify(memo.fee)}`);
        trace(`Fee object ${JSON.stringify(memo.fee)}`);
      }

      trace(`Initiating GMP Transaction...`);
      trace(`DENOM of token:${denom}`);

      // Execute EVM transfer
      try {
        await localAccount.transfer(
          {
            value: gmpAddresses.AXELAR_GMP,
            encoding: 'bech32',
            chainId: remoteChainId,
          },
          {
            denom,
            value: BigInt(message.amountForChain) + BigInt(message.amountFee),
          },
          { memo: JSON.stringify(memo) },
        );

        seat.exit();

        trace(`GMP Transaction sent successfully`);
      } catch (e) {
        return recoverFailedTransfer(e);
      }
    } else if (chainType === 'cosmos') {
      // Handle Cosmos chain transfer

      // Validate payload structure
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (e) {
        throw makeError(`Invalid payload: must be valid JSON string. ${q(e)}`);
      }

      // Validate required fields in payload
      parsedPayload.wasm != null || Fail`Payload must contain 'wasm' field`;
      parsedPayload.wasm.contract != null ||
        Fail`Payload wasm must contain 'contract' field`;
      parsedPayload.wasm.msg != null ||
        Fail`Payload wasm must contain 'msg' field`;

      // Validate message type and all required fields
      const msg = parsedPayload.wasm.msg;

      let msgData;
      /** @type {string[]} */
      let requiredFields = [];

      if (msg.create_survey) {
        msgData = msg.create_survey;
        requiredFields = [
          'signature',
          'token',
          'time_to_expire',
          'owner',
          'survey_id',
          'participants_limit',
          'reward_denom',
          'reward_amount',
          'survey_hash',
          'manager_pub_key',
        ];
      } else if (msg.cancel_survey) {
        msgData = msg.cancel_survey;
        requiredFields = [
          'signature',
          'token',
          'time_to_expire',
          'survey_id',
          'manager_pub_key',
        ];
      } else if (msg.pay_rewards) {
        msgData = msg.pay_rewards;
        requiredFields = [
          'signature',
          'token',
          'time_to_expire',
          'survey_ids',
          'participants',
          'manager_pub_key',
        ];
      } else {
        Fail`Payload wasm.msg must contain one of: create_survey, cancel_survey, or pay_rewards`;
      }

      // Validate all required fields for the message type
      for (const field of requiredFields) {
        msgData[field] != null ||
          Fail`Message must contain '${q(field)}' field`;
      }

      const memo = payload;

      trace(`Initiating IBC Transfer...`);

      trace(`DENOM of token:${denom}`);

      // Execute Cosmos transfer
      try {
        await localAccount.transfer(
          {
            value: /** @type {Bech32Address} */ (destinationAddress),
            encoding: 'bech32',
            chainId: remoteChainId,
          },
          {
            denom,
            value: BigInt(message.amountForChain) + BigInt(message.amountFee),
          },
          { memo },
        );

        seat.exit();

        trace(`IBC Message Transaction sent successfully`);
      } catch (e) {
        return recoverFailedTransfer(e);
      }
    }
  }
};

harden(sendTransaction);
