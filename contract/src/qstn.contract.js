import { M } from '@endo/patterns';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import { handleParamGovernance } from '@agoric/governance/src/contractHelper.js';
import { sendTransaction } from './qstn.flows.js';

/**
 * @import {Remote} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {Marshaller, StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {ZCF} from '@agoric/zoe';
 * @import {GovernanceTerms} from '@agoric/governance/src/types.js';
 * @import {Invitation} from '@agoric/zoe';
 * @import {NamesByAddressAdmin} from '@agoric/vats';
 */

/**
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF<GovernanceTerms<{}>>} zcf
 * @param {OrchestrationPowers &  {
 *   marshaller: Remote<Marshaller>;
 *   chainInfo?: Record<string, CosmosChainInfo>;
 *   assetInfo?: [Denom, DenomDetail & { brandKey?: string }][];
 *   storageNode: Remote<StorageNode>;
 *   initialPoserInvitation: Invitation;
 *   nameByAddressAdmin: NamesByAddressAdmin;
 * }} privateArgs
 * @param {Zone} zone
 * @param {OrchestrationTools} tools
 */
export const contract = async (
  zcf,
  privateArgs,
  zone,
  { chainHub, orchestrate, zoeTools, baggage },
) => {
  const { makeDurableGovernorFacet } = await handleParamGovernance(
    zcf,
    privateArgs.initialPoserInvitation,
    {},
    privateArgs.storageNode,
    privateArgs.marshaller,
  );

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );

  const chainHubAdminFacet = prepareChainHubAdmin(zone, chainHub);

  const makeSendTransaction = orchestrate(
    'sendTransaction',
    {
      chainHub,
      zoeTools,
    },
    sendTransaction,
  );

  const publicFacet = zone.exo(
    'Send PF',
    M.interface('Send PF', {
      makeSendTransactionInvitation: M.callWhen().returns(M.any()),
    }),
    {
      makeSendTransactionInvitation() {
        return zcf.makeInvitation(
          makeSendTransaction,
          'sendTransaction',
          undefined,
        );
      },
    },
  );

  const { governorFacet } = makeDurableGovernorFacet(
    baggage,
    chainHubAdminFacet,
    {
      /**
       * Register a new chain in the ChainHub
       * @param {string} chainName - Name of the chain to register
       * @param {CosmosChainInfo} chainInfo - Chain information
       * @param {any} ibcConnectionInfo - IBC connection information
       * @returns {Promise<void>}
       */
      registerChain: (chainName, chainInfo, ibcConnectionInfo) =>
        chainHubAdminFacet.registerChain(
          chainName,
          chainInfo,
          ibcConnectionInfo,
        ),

      /**
       * Register a new asset in the ChainHub
       * @param {Denom} denom - Asset denomination
       * @param {DenomDetail} detail - Asset details
       * @returns {Promise<void>}
       */
      registerAsset: (denom, detail) =>
        chainHubAdminFacet.registerAsset(denom, detail),
    },
  );

  return harden({
    publicFacet,
    creatorFacet: governorFacet,
  });
};
harden(contract);

export const start = withOrchestration(contract);
harden(start);
