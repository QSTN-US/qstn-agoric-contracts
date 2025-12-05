// @ts-check
import { E } from '@endo/far';

/**
 * @import {Issuer} from '@agoric/ertp';
 * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 * @import {start as StartFn} from "../qstn.contract.js";
 * @import {Installation, Instance} from "@agoric/zoe";
 */

const contractName = 'qstn';

/**
 * @param {BootstrapPowers & {
 *   installation: {
 *     consume: {
 *       qstn: Installation<StartFn>;
 *     };
 *   };
 *   instance: {
 *     produce: {
 *       qstn: Producer<Instance<StartFn>>
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
export const startQstnContract = async (
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
      consume: { qstn: installation },
    },
    instance: {
      produce: { qstn: produceInstance },
    },
    issuer: {
      consume: { BLD, IST },
    },
  },
  { options: { chainInfo, assetInfo } },
) => {
  assert(chainInfo, 'no chainInfo provided');
  assert(assetInfo, 'no asset info provided');

  const marshaller = await E(board).getPublishingMarshaller();

  const storageNode = await E(chainStorage).makeChildNode(contractName);
  await E(storageNode).setValue('');

  const privateArgs = {
    agoricNames,
    localchain,
    orchestrationService: cosmosInterchainService,
    storageNode,
    timerService: chainTimerService,
    marshaller,
    chainInfo,
    assetInfo,
  };

  /** @param {() => Promise<Issuer>} p */
  const safeFulfill = async p =>
    E.when(
      p(),
      i => i,
      () => undefined,
    );

  const axlIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'AXL'),
  );

  const atomIssuer = await safeFulfill(() =>
    E(agoricNames).lookup('issuer', 'ATOM'),
  );

  const issuerKeywordRecord = harden({
    BLD: await BLD,
    IST: await IST,
    ...(axlIssuer && { AXL: axlIssuer }),
    ...(atomIssuer && { ATOM: atomIssuer }),
  });

  const { instance } = await E(startUpgradable)({
    label: contractName,
    installation,
    issuerKeywordRecord,
    privateArgs,
  });

  produceInstance.reset();
  produceInstance.resolve(instance);
  console.log(`${contractName} (re)started`);
};

/** @type {import('@agoric/vats/src/core/lib-boot.js').BootstrapManifest} */
const qstnManifest = {
  [startQstnContract.name]: {
    consume: {
      agoricNames: true,
      board: true,
      chainStorage: true,
      chainTimerService: true,
      cosmosInterchainService: true,
      localchain: true,
    },
    installation: {
      consume: {
        [contractName]: true,
      },
    },
    instance: {
      produce: { [contractName]: true },
    },
    issuer: {
      consume: {
        BLD: true,
        IST: true,
      },
    },
  },
};
harden(qstnManifest);

export const getManifest = ({ restoreRef }, { installationRef, options }) => {
  return harden({
    manifest: qstnManifest,
    installations: {
      [contractName]: restoreRef(installationRef),
    },
    options,
  });
};
