import { M, mustMatch } from '@endo/patterns';
import { VowShape } from '@agoric/vow';
import { makeTracer, NonNullish } from '@agoric/internal';
import { Fail, makeError, q } from '@endo/errors';
import { AmountMath } from '@agoric/ertp';
import { OfferArgsShape, AccountKitStateShape } from './utils/type-guards.js';
import { validateMessage } from './utils/message-validation.js';

/**
 * @import {VowTools} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {ZoeTools} from '@agoric/orchestration/src/utils/zoe-tools.js';
 * @import {AccountTapState, CrossChainContractMessage} from './utils/types.js';
 * @import {ZCF, ZCFSeat} from '@agoric/zoe';
 * @import {Bech32Address} from '@agoric/orchestration';
 */

const trace = makeTracer('Qstn-Account-Kit', false);

const { entries } = Object;

const ACCOUNTI = M.interface('holder', {
  getLocalAddress: M.call().returns(M.any()),
  send: M.call(M.any(), M.any()).returns(M.any()),
  sendTransactions: M.call(M.any(), M.any()).returns(M.any()),
  fundLCA: M.call(M.any(), M.any()).returns(VowShape),
});
harden(ACCOUNTI);

const InvitationMakerI = M.interface('invitationMaker', {
  makeTransactionInvitation: M.call(M.string(), M.array()).returns(M.any()),
});
harden(InvitationMakerI);

/**
 * @param {Zone} zone
 * @param {{
 *   zcf: ZCF;
 *   vowTools: VowTools;
 *   zoeTools: ZoeTools;
 * }} powers
 */
export const prepareAccountKit = (zone, { zcf, vowTools, zoeTools }) => {
  return zone.exoClassKit(
    'AccountKit',
    {
      transferWatcher: M.interface('TransferWatcher', {
        onFulfilled: M.call(M.undefined())
          .optional(M.bigint())
          .returns(VowShape),
      }),
      holder: ACCOUNTI,
      invitationMakers: InvitationMakerI,
    },
    /**
     * @param {AccountTapState} initialState
     * @returns {AccountTapState}
     */
    initialState => {
      mustMatch(initialState, AccountKitStateShape);
      return harden({
        ...initialState,
      });
    },
    {
      transferWatcher: {
        /**
         * @param {void} _result
         * @param {bigint} value the qty of uatom to delegate
         */
        onFulfilled(_result, value) {
          trace('onFulfilled _result:', JSON.stringify(_result));
          trace('onFulfilled value:', JSON.stringify(value));
          trace('onFulfilled state:', JSON.stringify(this.state));
        },
      },
      holder: {
        getLocalAddress() {
          return this.state.localAccount.getAddress().value;
        },

        /**
         * Sends tokens from the local account to a specified Cosmos chain
         * address.
         *
         * @param {import('@agoric/orchestration').CosmosChainAddress} toAccount
         * @param {import('@agoric/orchestration').AmountArg} amount
         * @returns {Promise<string>} A success message upon completion.
         */
        async send(toAccount, amount) {
          await this.state.localAccount.send(toAccount, amount);
          return 'transfer success';
        },

        /**
         * @param {ZCFSeat} seat
         * @param {{
         *  messages: CrossChainContractMessage[]
         * }} offerArgs
         */
        async sendTransactions(seat, offerArgs) {
          trace('Inside sendTransactions');

          // Track transfers for accurate recovery on failure
          let transferredAmount = 0n;
          const successfulTransfers = [];
          let amt;

          await null;
          try {
            mustMatch(offerArgs, OfferArgsShape);

            const { messages } = offerArgs;

            trace('Offer Args:', JSON.stringify(offerArgs));

            // Get proposal from seat and extract amount
            const { give } = seat.getProposal();
            const [[_kw, _amt]] = entries(give);
            amt = _amt;

            // Validate transfer amount is positive
            amt.value > 0n ||
              Fail`IBC transfer amount must be greater than zero`;

            // Add up total amount required for all chains
            const totalRequired = messages.reduce(
              (acc, msg) =>
                acc + BigInt(msg.amountForChain) + BigInt(msg.amountFee || 0),
              0n,
            );

            totalRequired === amt.value ||
              Fail`Total amount required for all chains ${q(totalRequired)} does not match amount given ${q(amt.value)}`;

            trace('_kw, amt', _kw, amt);

            const { denom } = NonNullish(
              this.state.assets.find(a => a.brand === amt.brand),

              `${amt.brand} not registered in vbank`,
            );

            trace('amt and brand', amt.brand);

            // Validate ALL messages in parallel and store results
            trace('Validating all messages in parallel...');

            const validatedMessages = await Promise.all(
              messages.map((msg, index) =>
                validateMessage(msg, this.state).then(result => ({
                  ...result,
                  message: msg,
                  index,
                })),
              ),
            );

            trace('All messages validated successfully');

            // Execute transfers sequentially using pre-validated data
            for (const validated of validatedMessages) {
              const { message, remoteChainId, memo, destinationAddress } =
                validated;

              const transferAmount =
                BigInt(message.amountForChain) + BigInt(message.amountFee || 0);

              trace(
                `Initiating ${message.chainType === 'evm' ? 'GMP' : 'IBC'} Transfer...`,
              );

              trace(`DENOM of token: ${denom}`);

              await this.state.localAccount.transfer(
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

              trace(
                `${message.chainType === 'evm' ? 'GMP' : 'IBC'} Transaction sent successfully ✓`,
              );
            }
          } catch (e) {
            // Calculate remaining amount in localAccount
            const remainingAmount = amt ? amt.value - transferredAmount : 0n;

            trace(
              `ERROR: Transfer failed after ${successfulTransfers.length} successful transfers`,
            );

            trace(
              `Transferred: ${transferredAmount}, Remaining: ${remainingAmount}`,
            );

            // Refund any remaining tokens in localAccount
            if (remainingAmount > 0n && amt) {
              const remainingGive = AmountMath.make(amt.brand, remainingAmount);
              await zoeTools.withdrawToSeat(
                this.state.localAccount,
                seat,
                remainingGive,
              );
            }

            const errorMsg = `Transaction failed: ${q(e)}. ${successfulTransfers.length} transfers succeeded. ${transferredAmount} tokens sent, ${remainingAmount} tokens recovered.`;
            trace(`ERROR: ${errorMsg}`);

            if (!seat.hasExited()) seat.fail(errorMsg);
            throw makeError(errorMsg);
          } finally {
            if (!seat.hasExited()) seat.exit();
          }
        },
        /**
         * @param {ZCFSeat} seat
         * @param {any} give
         */
        fundLCA(seat, give) {
          seat.hasExited() && Fail`The seat cannot be exited.`;
          return zoeTools.localTransfer(seat, this.state.localAccount, give);
        },
      },
      invitationMakers: {
        // "method" and "args" can be used to invoke methods of localAccount obj
        makeTransactionInvitation(method, args) {
          const continuingTransactionHandler = async seat => {
            await null;
            const { holder } = this.facets;
            switch (method) {
              case 'sendTransactions': {
                const { give } = seat.getProposal();
                await vowTools.when(holder.fundLCA(seat, give));
                return holder.sendTransactions(seat, args[0]);
              }
              case 'getLocalAddress': {
                const vow = holder.getLocalAddress();
                return vowTools.when(vow, res => {
                  seat.exit();
                  return res;
                });
              }
              case 'send': {
                const vow = holder.send(args[0], args[1]);
                return vowTools.when(vow, res => {
                  seat.exit();
                  return res;
                });
              }
              case 'fundLCA': {
                const { give } = seat.getProposal();
                const vow = holder.fundLCA(seat, give);
                return vowTools.when(vow, res => {
                  seat.exit();
                  return res;
                });
              }
              default:
                return 'Invalid method';
            }
          };

          return zcf.makeInvitation(
            continuingTransactionHandler,
            'transaction',
          );
        },
      },
    },
  );
};

/** @typedef {ReturnType<typeof prepareAccountKit>} MakeAccountKit */
/** @typedef {ReturnType<MakeAccountKit>} AccountKit */
