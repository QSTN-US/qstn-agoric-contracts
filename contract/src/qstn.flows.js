/**
 * @file Implements the orchestration flow which does the following:
 *
 *   - Creates Qstn Account kit
 *
 */

import { makeTracer } from '@agoric/internal';
import { Tracer } from './utils/tracer.js';

/**
 * @import {GuestInterface} from '@agoric/async-flow';
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {MakeAccountKit} from './qstn-account-kit.js';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {VowTools} from '@agoric/vow'
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
 *  vowTools: GuestInterface<VowTools>
 * }} ctx
 * @param {ZCFSeat} seat
 * @param {{
 * messages: CrossChainContractMessage[],
 * }} offerArgs
 */
export const createLCA = async (
  orch,
  {
    makeAccountKit,
    transferChannels,
    gmpAddresses,
    chainIds,
    contracts,
    vowTools,
  },
  seat,
  offerArgs,
) => {
  trace('Creating CrossChain LCA and monitoring transfers');

  const [agoric] = await Promise.all([orch.getChain('agoric')]);

  const localAccount = await agoric.makeAccount();
  trace('localAccount created successfully');

  const localChainAddress = await localAccount.getAddress();
  trace('Local Chain Address:', localChainAddress);

  const agoricChainId = (await agoric.getChainInfo()).chainId;

  const assets = await agoric.getVBankAssetInfo();

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

  // Fund the LCA first
  const { give } = seat.getProposal();
  await vowTools.when(accountKit.holder.fundLCA(seat, give));

  // Then perform the transfer
  await accountKit.holder.sendTransactions(seat, offerArgs);

  return harden({ invitationMakers: accountKit.invitationMakers });
};
harden(createLCA);
