/**
 * @file Implements the orchestration flow which does the following:
 *
 *   - Creates Qstn Account kit
 *
 */

import { makeTracer } from '@agoric/internal';
import { Fail } from '@endo/errors';
import { denomHash } from '@agoric/orchestration';
import { COSMOS_CHAINS } from './utils/chains.js';

/**
 * @import {GuestInterface} from '@agoric/async-flow';
 * @import {Orchestrator, OrchestrationFlow} from '@agoric/orchestration';
 * @import {MakeAccountKit} from './qstn-account-kit.js';
 * @import {ChainHub} from '@agoric/orchestration/src/exos/chain-hub.js';
 * @import {ZCFSeat} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {SupportedCosmosChains, RemoteChannelInfo} from './utils/types.js';
 */

const trace = makeTracer('CrossChainLCA');

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  makeAccountKit: MakeAccountKit;
 *  axelarRemoteChannel: Promise<RemoteChannelInfo>,
 *  osmosisRemoteChannel: Promise<RemoteChannelInfo>,
 *  neutronRemoteChannel: Promise<RemoteChannelInfo>,
 * }} ctx
 * @param {ZCFSeat} seat
 */
export const createAndMonitorLCA = async (
  orch,
  {
    makeAccountKit,
    axelarRemoteChannel,
    osmosisRemoteChannel,
    neutronRemoteChannel,
  },
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

  const axelar = await axelarRemoteChannel;
  const osmosis = await osmosisRemoteChannel;
  const neutron = await neutronRemoteChannel;

  const accountKit = makeAccountKit({
    localAccount,
    localChainId: agoricChainId,
    localChainAddress,
    assets,
    axelarRemoteChannel: axelar,
    osmosisRemoteChannel: osmosis,
    neutronRemoteChannel: neutron,
  });

  trace('tap created successfully');
  // XXX consider storing appRegistration, so we can .revoke() or .updateTargetApp()
  // @ts-expect-error tap.receiveUpcall: 'Vow<void> | undefined' not assignable to 'Promise<any>'
  await localAccount.monitorTransfers(accountKit.tap);

  trace('Monitoring transfers setup successfully');

  seat.exit();

  return harden({ invitationMakers: accountKit.invitationMakers });
};
harden(createAndMonitorLCA);

/**
 * @param {Orchestrator} orch
 * @param {{
 *  chainName: SupportedCosmosChains;
 *  chainHub: GuestInterface<ChainHub>;
 * }} ctx
 * @returns {Promise<RemoteChannelInfo>}
 */
export const makeRemoteChannel = async (orch, { chainName, chainHub }) => {
  const chain = COSMOS_CHAINS[chainName];

  const [agoric, remoteChain] = await Promise.all([
    orch.getChain('agoric'),
    orch.getChain(chain),
  ]);

  const { chainId, stakingTokens } = await remoteChain.getChainInfo();

  const remoteDenom = stakingTokens[0].denom;
  remoteDenom || Fail`${chainId} does not have stakingTokens in config`;

  trace(
    `Creating remote channel to ${chainName} (${chain}) with denom ${remoteDenom}`,
  );

  const agoricChainId = (await agoric.getChainInfo()).chainId;

  const { transferChannel } = await chainHub.getConnectionInfo(
    agoricChainId,
    chainId,
  );
  assert(transferChannel.counterPartyChannelId, 'unable to find sourceChannel');

  const localDenom = `ibc/${denomHash({
    denom: remoteDenom,
    channelId: transferChannel.channelId,
  })}`;

  const remoteChainInfo = await remoteChain.getChainInfo();

  return harden({
    localDenom,
    remoteChainInfo,
    channelId: transferChannel.channelId,
    remoteDenom,
  });
};

harden(makeRemoteChannel);

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  chainHub: GuestInterface<ChainHub>;
 * }} ctx
 * @returns {Promise<RemoteChannelInfo>}
 */
export const makeOsmosisRemoteChannel = async (orch, { chainHub }) => {
  return makeRemoteChannel(orch, { chainName: 'Osmosis', chainHub });
};

harden(makeOsmosisRemoteChannel);

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  chainHub: GuestInterface<ChainHub>;
 * }} ctx
 * @returns {Promise<RemoteChannelInfo>}
 */
export const makeNeutronRemoteChannel = async (orch, { chainHub }) => {
  return makeRemoteChannel(orch, { chainName: 'Neutron', chainHub });
};

harden(makeNeutronRemoteChannel);

/**
 * @satisfies {OrchestrationFlow}
 * @param {Orchestrator} orch
 * @param {{
 *  chainHub: GuestInterface<ChainHub>;
 * }} ctx
 * @returns {Promise<RemoteChannelInfo>}
 */
export const makeAxelarRemoteChannel = async (orch, { chainHub }) => {
  return makeRemoteChannel(orch, { chainName: 'Axelar', chainHub });
};

harden(makeAxelarRemoteChannel);
