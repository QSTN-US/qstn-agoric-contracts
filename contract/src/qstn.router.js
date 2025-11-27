import { M } from '@endo/patterns';
import { E } from '@endo/far';
import { prepareChainHubAdmin } from '@agoric/orchestration/src/exos/chain-hub-admin.js';
import { withOrchestration } from '@agoric/orchestration/src/utils/start-helper.js';
import { registerChainsAndAssets } from '@agoric/orchestration/src/utils/chain-hub-helper.js';
import { makeTracer } from '@agoric/internal';
import { sendTransaction } from './qstn.flows.js';

/**
 * @import {Remote, Vow} from '@agoric/vow';
 * @import {Zone} from '@agoric/zone';
 * @import {OrchestrationPowers, OrchestrationTools} from '@agoric/orchestration/src/utils/start-helper.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {Marshaller, StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {ZCF} from '@agoric/zoe';
 */

const trace = makeTracer('qstnRouterV1');

/**
 * Orchestration contract to be wrapped by withOrchestration for Zoe
 *
 * @param {ZCF} zcf
 * @param {OrchestrationPowers & {
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
  { chainHub, orchestrate, vowTools, zoeTools },
) => {
  trace('Inside Contract');

  registerChainsAndAssets(
    chainHub,
    zcf.getTerms().brands,
    privateArgs.chainInfo,
    privateArgs.assetInfo,
  );

  const creatorFacet = prepareChainHubAdmin(zone, chainHub);

  // UNTIL https://github.com/Agoric/agoric-sdk/issues/9066
  const logNode = E(privateArgs.storageNode).makeChildNode('log');
  /** @type {(msg: string) => Vow<void>} */
  const log = msg => vowTools.watch(E(logNode).setValue(msg));

  const makeSendTransaction = orchestrate(
    'sendTransaction',
    {
      chainHub,
      log,
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

  return { publicFacet, creatorFacet };
};
harden(contract);

export const start = withOrchestration(contract);
harden(start);
