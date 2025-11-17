/// <reference types="@agoric/vats/src/core/types-ambient"/>

import {
  deeplyFulfilledObject,
  makeTracer,
  NonNullish,
} from '@agoric/internal';
import { E } from '@endo/far';

/**
 * @import {Issuer} from '@agoric/ertp';
 * @import {Installation, Instance} from '@agoric/zoe/src/zoeService/utils.js';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {start as StartFn} from 'contract/src/qstn.router.js';
 */

const trace = makeTracer('start qstn contract', true);

/**
 * @param {BootstrapPowers & {
 *   installation: {
 *     consume: {
 *       qstnRouterV1: Installation<StartFn>;
 *     };
 *   };
 *   instance: {
 *     produce: {
 *       qstnRouterV1: Producer<Instance<StartFn>>
 *     };
 *   };
 *   issuer: {
 *     consume: {
 *       BLD: Issuer<'nat'>;
 *       IST: Issuer<'nat'>;
 *     };
 *   };
 * }} powers
 * @param {{
 *   options: {
 *     chainInfo: Record<string, CosmosChainInfo>;
 *     assetInfo: [Denom, DenomDetail & { brandKey?: string }][];
 *   };
 * }} config
 */
export const startQstnRouter = async (
  {
    consume: {
      agoricNames,
      board,
      chainStorage,
      chainTimerService,
      cosmosInterchainService,
      localchain,
      startUpgradable,
    },
    installation: {
      consume: { qstnRouterV1 },
    },
    instance: {
      produce: { qstnRouterV1: produceInstance },
    },
    issuer: {
      consume: { BLD, IST },
    },
  },
  { options: { chainInfo, assetInfo } },
) => {
  trace(startQstnRouter.name);

  const marshaller = await E(board).getReadonlyMarshaller();

  trace('Setting privateArgs');

  const privateArgs = await deeplyFulfilledObject(
    harden({
      agoricNames,
      localchain,
      marshaller,
      orchestrationService: cosmosInterchainService,
      storageNode: E(NonNullish(await chainStorage)).makeChildNode(
        'qstnRouterV1',
      ),
      timerService: chainTimerService,
      chainInfo,
      assetInfo,
    }),
  );

  /** @param {() => Promise<Issuer>} p */
  const safeFulfill = async (p) =>
    E.when(
      p(),
      (i) => i,
      () => undefined,
    );

  const axlIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'AXL'),
  );

  const atomIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'ATOM'),
  );

  // const ntrnIssuer = await safeFulfill(() =>
  //   E(agoricNames).lookup('issuer', 'NTRN'),
  // );

  const issuerKeywordRecord = harden({
    BLD: await BLD,
    IST: await IST,
    ...(axlIssuer && { AXL: axlIssuer }),
    ...(atomIssuer && { ATOM: atomIssuer }),
    // ...(ntrnIssuer && { untrn: ntrnIssuer }),
  });
  trace('issuerKeywordRecord', issuerKeywordRecord);

  trace('Starting contract instance');
  const { instance } = await E(startUpgradable)({
    label: 'qstnRouterV1',
    installation: qstnRouterV1,
    issuerKeywordRecord,
    privateArgs,
  });
  produceInstance.resolve(instance);
  trace('done');
};
harden(startQstnRouter);

export const getManifest = ({ restoreRef }, { installationRef, options }) => {
  return {
    manifest: {
      [startQstnRouter.name]: {
        consume: {
          agoricNames: true,
          board: true,
          chainTimerService: true,
          chainStorage: true,
          cosmosInterchainService: true,
          localchain: true,
          startUpgradable: true,
        },
        installation: {
          consume: { qstnRouterV1: true },
        },
        instance: {
          produce: { qstnRouterV1: true },
        },
        issuer: {
          consume: { BLD: true, IST: true, AXL: true, ATOM: true },
        },
      },
    },
    installations: {
      qstnRouterV1: restoreRef(installationRef),
    },
    options,
  };
};
