/**
 * @file Implements the orchestration flow which does the following:
 *
 *   - Creates Qstn Account kit
 *
 */

import { makeTracer } from '@agoric/internal';

/**
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {MakeAccountKit} from './qstn-account-kit.js';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {ChainIds, ContractMaps, GMPAddresses, TransferChannels} from './utils/types.js';
 */

const trace = makeTracer('Qstn-LCA-Flows');

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  makeAccountKit: MakeAccountKit;
 *  transferChannels: TransferChannels,
 *  chainIds: ChainIds,
 *  contracts: ContractMaps,
 *  gmpAddresses: GMPAddresses
 * }} ctx
 * @param {ZCFSeat} seat
 */
export const createLCA = async (
  orch,
  { makeAccountKit, transferChannels, gmpAddresses, chainIds, contracts },
  seat,
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

  trace('tap created successfully');

  seat.exit();

  return harden({ invitationMakers: accountKit.invitationMakers });
};
harden(createLCA);
