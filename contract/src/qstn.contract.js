/**
 * @file Qstn Router contract
 *
 */

import { M } from '@endo/patterns';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import { makeTracer } from '@agoric/internal';
import { makeError } from '@endo/errors';

import * as flows from './qstn.flows.js';
import { prepareAccountKit } from './qstn-account-kit.js';
import { extractRemoteChannelInfo } from './utils/helper.js';
import {
  makeProposalShape,
  QstnPrivateArgsShape,
} from './utils/type-guards.js';
import { validatePrivateArgsAddresses } from './utils/address-validation.js';

const { keys } = Object;
/**
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {ContractMeta, ZCF} from '@agoric/zoe';
 * @import {HostForGuest} from '@agoric/orchestration/src/facade.js'
 * @import {QstnPrivateArgs, RemoteChannelInfo} from './utils/types.js';
 */

const trace = makeTracer('Qstn-Contract');

/** @type {ContractMeta} */
export const meta = {
  privateArgsShape: QstnPrivateArgsShape,
};
harden(meta);

/**
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF} zcf
 * @param {QstnPrivateArgs} privateArgs
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
  const { brands } = zcf.getTerms();

  const {
    chainInfo: passedChainInfo,
    assetInfo,
    contracts,
    chainIds,
    gmpAddresses,
  } = privateArgs;

  // Validate address formats in privateArgs
  validatePrivateArgsAddresses(contracts, gmpAddresses);

  // Validate assetInfo is non-empty
  if (!assetInfo || assetInfo.length === 0) {
    throw makeError('assetInfo must contain at least one asset');
  }

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    passedChainInfo,
    assetInfo,
  );

  const chainHubAdminFacet = prepareChainHubAdmin(zone, chainHub);

  const transferChannels = (() => {
    const { agoric, axelar, neutron, osmosis } =
      /** @type {Record<string, CosmosChainInfo>} */ (passedChainInfo);

    const { connections } = /** @type {CosmosChainInfo} */ (agoric);

    if (!connections) {
      throw makeError('No connections found');
    }

    const neutronTransferChannel = connections[neutron.chainId].transferChannel;

    const neutronConn = extractRemoteChannelInfo(
      neutron,
      neutronTransferChannel,
    );

    const osmosisTransferChannel = connections[osmosis.chainId].transferChannel;
    const osmosisConn = extractRemoteChannelInfo(
      osmosis,
      osmosisTransferChannel,
    );

    /** @type {RemoteChannelInfo | undefined} */
    let axelarConn;

    if ('axelar' in passedChainInfo) {
      const axelarTransferChannel = connections[axelar.chainId].transferChannel;
      axelarConn = extractRemoteChannelInfo(axelar, axelarTransferChannel);
    } else {
      trace('⚠️ no axelar chainInfo; GMP not available', keys(passedChainInfo));
    }

    return harden({
      Osmosis: osmosisConn,
      Neutron: neutronConn,
      Axelar: axelarConn,
    });
  })();

  const makeAccountKit = prepareAccountKit(zone.subZone('qstnTap'), {
    zcf,
    vowTools,
    zoeTools,
  });

  /** @type {{ createLCA: HostForGuest<typeof flows.createLCA> }} */
  const { createLCA } = orchestrateAll(
    { createLCA: flows.createLCA },
    {
      makeAccountKit,
      transferChannels,
      chainIds,
      contracts,
      gmpAddresses,
    },
  );

  const proposalShape = makeProposalShape(brands.BLD);

  const publicFacet = zone.exo(
    'Send PF',

    M.interface('Send PF', {
      createLCA: M.callWhen().returns(M.any()),
    }),

    {
      createLCA() {
        return zcf.makeInvitation(
          createLCA,
          'makeQstnAccount',
          undefined,
          proposalShape,
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
