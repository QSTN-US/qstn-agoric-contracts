/**
 * @file Qstn Router contract
 *
 */

import { M } from '@endo/patterns';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import { makeTracer } from '@agoric/internal';
import * as flows from './qstn.flows.js';
import { prepareAccountKit } from './qstn-account-kit.js';
/**
 * @import {Remote} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {Marshaller, StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {ZCF} from '@agoric/zoe';
 * @import {GovernanceTerms} from '@agoric/governance/src/types.js';
 * @import {HostForGuest} from '@agoric/orchestration/src/facade.js'
 */

const trace = makeTracer('AxelarGmp');

/**
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF<GovernanceTerms<{}>>} zcf
 * @param {OrchestrationPowers &  {
 *   marshaller: Remote<Marshaller>;
 *   chainInfo?: Record<string, CosmosChainInfo>;
 *   assetInfo?: [Denom, DenomDetail & { brandKey?: string }][];
 *   storageNode: Remote<StorageNode>;
 * }} privateArgs
 * @param {Zone} zone
 * @param {OrchestrationTools} tools
 */
export const contract = async (
  zcf,
  privateArgs,
  zone,
  { chainHub, orchestrateAll, zoeTools, vowTools },
) => {
  trace('Inside Contract');

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );

  const chainHubAdminFacet = prepareChainHubAdmin(zone, chainHub);

  const {
    makeAxelarRemoteChannel,
    makeOsmosisRemoteChannel,
    makeNeutronRemoteChannel,
  } = orchestrateAll(
    {
      makeAxelarRemoteChannel: flows.makeAxelarRemoteChannel,
      makeOsmosisRemoteChannel: flows.makeOsmosisRemoteChannel,
      makeNeutronRemoteChannel: flows.makeNeutronRemoteChannel,
    },
    {
      chainHub,
    },
  );

  const axelarRemoteChannel = zone.makeOnce('AxelarRemoteChannel', () =>
    makeAxelarRemoteChannel(),
  );
  const osmosisRemoteChannel = zone.makeOnce('OsmosisRemoteChannel', () =>
    makeOsmosisRemoteChannel(),
  );
  const neutronRemoteChannel = zone.makeOnce('NeutronRemoteChannel', () =>
    makeNeutronRemoteChannel(),
  );

  const makeAccountKit = prepareAccountKit(zone.subZone('qstnTap'), {
    zcf,
    vowTools,
    zoeTools,
  });

  /** @type {{ createAndMonitorLCA: HostForGuest<typeof flows.createAndMonitorLCA> }} */
  const { createAndMonitorLCA } = orchestrateAll(
    { createAndMonitorLCA: flows.createAndMonitorLCA },
    {
      makeAccountKit,
      chainHub,
      axelarRemoteChannel,
      osmosisRemoteChannel,
      neutronRemoteChannel,
    },
  );

  const publicFacet = zone.exo(
    'Send PF',

    M.interface('Send PF', {
      createAndMonitorLCA: M.callWhen().returns(M.any()),
    }),

    {
      createAndMonitorLCA() {
        return zcf.makeInvitation(
          createAndMonitorLCA,
          'makeAccount',
          undefined,
        );
      },
    },
  );

  const creatorFacet = zone.exo(
    'Creator Facet',

    M.interface('Creator Facet', {
      setOfferFilter: M.call(M.arrayOf(M.string())).returns(M.promise()),
      registerChain: M.call(M.string(), M.record(), M.any()).returns(
        M.promise(),
      ),
      registerAsset: M.call(M.string(), M.record()).returns(M.promise()),
    }),

    {
      /**
       * @param {string[]} strings
       */
      setOfferFilter(strings) {
        return zcf.setOfferFilter(strings);
      },
      /**
       * @param {string} chainName
       * @param {CosmosChainInfo} chainInfo
       * @param {any} ibcConnectionInfo
       */
      registerChain(chainName, chainInfo, ibcConnectionInfo) {
        return chainHubAdminFacet.registerChain(
          chainName,
          chainInfo,
          ibcConnectionInfo,
        );
      },
      /**
       * @param {Denom} denom
       * @param {DenomDetail} detail
       */
      registerAsset(denom, detail) {
        return chainHubAdminFacet.registerAsset(denom, detail);
      },
    },
  );

  return harden({
    publicFacet,
    creatorFacet,
  });
};
harden(contract);

export const start = withOrchestration(contract);
harden(start);
