/**
 * @file Implements the orchestration flow which does the following:
 *
 *   - Creates Qstn Account kit
 *
 */

import { makeTracer } from '@agoric/internal';
import { Tracer } from './utils/tracer.js';

/**
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {MakeAccountKit} from './qstn-account-kit.js';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {ChainIds, ContractMaps, CrossChainContractMessage, GMPAddresses, TransferChannels} from './utils/types.js';
 */

const trace = makeTracer(`${Tracer}-LCA-Flows`);

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  makeAccountKit: MakeAccountKit;
 *  transferChannels: TransferChannels,
 *  chainIds: ChainIds,
 *  contracts: ContractMaps,
 *  gmpAddresses: GMPAddresses,
 * }} ctx
 * @param {ZCFSeat} seat
 * @param {{
 * messages: CrossChainContractMessage[],
 * }} offerArgs
 */
export const qstnAccountTransaction = async (
  orch,
  { makeAccountKit, transferChannels, gmpAddresses, chainIds, contracts },
  seat,
  offerArgs,
) => {
  trace('Starting qstnAccountTransaction flow');
  trace('offerArgs:', offerArgs);

  trace('Getting Agoric chain...');
  const [agoric] = await Promise.all([orch.getChain('agoric')]);
  trace('Agoric chain obtained');

  trace('Creating local account...');
  const localAccount = await agoric.makeAccount();
  trace('localAccount created successfully');

  trace('Getting local chain address...');
  const localChainAddress = await localAccount.getAddress();
  trace('Local Chain Address:', localChainAddress);

  trace('Getting Agoric chain info...');
  const agoricChainId = (await agoric.getChainInfo()).chainId;
  trace('Agoric chainId:', agoricChainId);

  trace('Getting VBank asset info...');
  const assets = await agoric.getVBankAssetInfo();
  trace('Assets retrieved, count:', assets.length);

  trace('Creating account kit with state...');
  const accountKit = makeAccountKit({
    localAccount,
    localChainId: agoricChainId,
    localChainAddress,
    assets,
    transferChannels,
    chainIds,
    contracts,
    gmpAddresses,
  });
  trace('AccountKit created successfully');

  // Fund the LCA first
  trace('Getting proposal from seat...');
  const { give } = seat.getProposal();
  trace('Proposal give:', give);

  trace('Funding LCA...');
  // await vowTools.when(accountKit.holder.fundLCA(seat, give));
  await accountKit.holder.fundLCA(seat, give);
  trace('LCA funded successfully');

  // Then perform the transfer
  trace('Sending transactions...');
  trace('Transaction count:', offerArgs.messages?.length || 0);
  await accountKit.holder.sendTransactions(seat, offerArgs);
  trace('Transactions sent successfully');

  if (!seat.hasExited()) {
    seat.exit();
  }

  trace('qstnAccountTransaction flow completed');
  return harden({ invitationMakers: accountKit.invitationMakers });
};
harden(qstnAccountTransaction);
