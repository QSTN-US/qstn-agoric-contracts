/**
 * @file Implements the orchestration flow for qstn
 *
 */
import { AmountMath } from '@agoric/ertp';
import { makeTracer, NonNullish } from '@agoric/internal';
import { mustMatch } from '@endo/patterns';
import { Fail, makeError, q } from '@endo/errors';
import { OfferArgsShape } from './utilities/type-guards.js';
import { validateMessage } from './utilities/message-validation.js';

/**
 * @import {GuestInterface} from '@agoric/async-flow';
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {ChainHub} from '@agoric/orchestration/src/exos/chain-hub.js';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {ZoeTools} from '@agoric/orchestration/src/utils/zoe-tools.js';
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

  mustMatch(offerArgs, OfferArgsShape);

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

  // Create local account for transactions
  const localAccount = await agoric.makeAccount();

  const agoricChainId = (await agoric.getChainInfo()).chainId;

  // Validate ALL messages in parallel and store results
  trace('Validating all messages in parallel...');

  const validatedMessages = await Promise.all(
    messages.map((msg, index) =>
      validateMessage(msg, orch, chainHub, agoricChainId).then(result => ({
        ...result,
        message: msg,
        index,
      })),
    ),
  );

  trace('All messages validated successfully');

  // ALL validation passed - safe to transfer funds
  await localTransfer(seat, localAccount, give);

  // Track transfers for accurate recovery on failure
  let transferredAmount = 0n;
  const successfulTransfers = [];

  // Execute transfers sequentially using pre-validated data
  try {
    for (const validated of validatedMessages) {
      const { message, remoteChainId, memo, destinationAddress } = validated;
      const transferAmount =
        BigInt(message.amountForChain) + BigInt(message.amountFee || 0);

      trace(
        `Initiating ${message.chainType === 'evm' ? 'GMP' : 'IBC'} Transfer...`,
      );

      trace(`DENOM of token: ${denom}`);

      await localAccount.transfer(
        {
          value: /** @type {Bech32Address} */ (destinationAddress),
          encoding: 'bech32',
          chainId: remoteChainId,
        },
        {
          denom,
          value: transferAmount,
        },
        { memo },
      );

      // Track successful transfer
      transferredAmount += transferAmount;

      successfulTransfers.push({
        index: validated.index,
        amount: transferAmount,
        destination: destinationAddress,
      });

      seat.exit();

      trace(
        `${message.chainType === 'evm' ? 'GMP' : 'IBC'} Transaction sent successfully ✓`,
      );
    }
  } catch (e) {
    // Calculate remaining amount in localAccount
    const remainingAmount = amt.value - transferredAmount;

    trace(
      `ERROR: Transfer failed after ${successfulTransfers.length} successful transfers`,
    );

    trace(`Transferred: ${transferredAmount}, Remaining: ${remainingAmount}`);

    // Only recover what's actually left in localAccount
    if (remainingAmount > 0n) {
      const remainingGive = AmountMath.make(amt.brand, remainingAmount);
      await withdrawToSeat(localAccount, seat, remainingGive);
    }

    const errorMsg = `Transaction failed: ${q(e)}. ${successfulTransfers.length}/${messages.length} messages succeeded. ${transferredAmount} tokens sent, ${remainingAmount} tokens recovered.`;
    trace(`ERROR: ${errorMsg}`);

    seat.fail(errorMsg);

    throw makeError(errorMsg);
  }
};

harden(sendTransaction);
