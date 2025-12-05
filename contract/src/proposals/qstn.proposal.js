// @ts-check
import { E } from '@endo/far';
import { installContract } from '../utilities/start-contract.js';
import {
  startMyCharter,
  startMyCommittee,
  startMyGovernedInstance,
} from '../utilities/start-governed-contract.js';
import { allValues } from '../utilities/objectTools.js';

/**
 * * @import {BootstrapManifestPermit} from "@agoric/vats/src/core/lib-boot.js";
 * * @import {Issuer} from '@agoric/ertp';
 * * @import {CosmosChainInfo, Denom, DenomDetail} from '@agoric/orchestration';
 */

const { Fail } = assert;

const contractName = 'qstn';

/**
 * @param {BootstrapPowers} powers
 * @param {*} config
 */
export const startQstnCharter = (powers, config) =>
  startMyCharter(contractName, powers, config);

/**
 * @param {BootstrapPowers} powers
 * @param {*} config
 */
export const startQstnCommittee = (powers, config) =>
  startMyCommittee(contractName, powers, config);

/**
 * @param {BootstrapPowers} powers
 * @param {*} config
 */
export const installQstnContract = async (powers, config) => {
  const {
    // must be supplied by caller or template-replaced
    bundleID = Fail`no bundleID`,
  } = config?.options?.[contractName] ?? {};

  return installContract(powers, {
    name: contractName,
    bundleID,
  });
};

/**
 * @param {BootstrapPowers} powers
 * @param {{
 *  options: {
 *    qstn: {
 *     chainInfo: Record<string, CosmosChainInfo>;
 *     assetInfo: [Denom, DenomDetail & { brandKey?: string }][];
 *    }};
 * }} config
 */
export const startQstnContract = async (powers, config) => {
  const {
    consume: {
      agoricNames,
      board,
      chainStorage,
      chainTimerService,
      cosmosInterchainService,
      namesByAddressAdmin: namesByAddressAdminP,
      zoe,
      localchain,
    },
    produce,
    installation,
    instance: { produce: produceInstance },
    issuer: {
      consume: { BLD, IST },
    },
  } = powers;

  const {
    [contractName]: { chainInfo, assetInfo },
  } = config?.options || {};

  assert(chainInfo, 'no chainInfo provided');
  assert(assetInfo, 'no asset info provided');

  const installationP = installation.consume[contractName];
  const contractGovernor = installation.consume.contractGovernor;

  const namesByAddressAdmin = await namesByAddressAdminP;

  const storageNode = await E(chainStorage).makeChildNode(contractName);
  await E(storageNode).setValue('');

  const marshaller = await E(board).getPublishingMarshaller();

  const privateArgs = {
    agoricNames,
    orchestrationService: cosmosInterchainService,
    storageNode,
    timerService: chainTimerService,
    chainInfo,
    assetInfo,
    marshaller,
    localchain,
    namesByAddressAdmin,
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

  const creatorFacet = E.get(
    powers.consume[`${contractName}CommitteeKit`],
  ).creatorFacet;

  const it = await startMyGovernedInstance(
    {
      zoe,
      governedContractInstallation: installationP,
      label: contractName,
      privateArgs,
      terms: {},
      issuerKeywordRecord,
    },
    {
      governedParams: {},
      governorTerms: {},
      timer: chainTimerService,
      contractGovernor,
      committeeCreatorFacet: creatorFacet,
    },
  );

  produce[`${contractName}Kit`].reset();
  produce[`${contractName}Kit`].resolve(it);

  await E(
    E.get(powers.consume[`${contractName}CharterKit`]).creatorFacet,
  ).addInstance(it.instance, it.governorCreatorFacet);

  console.log('CoreEval script: started contract', contractName, it.instance);

  console.log('CoreEval script: share via agoricNames: none');

  produceInstance[contractName].reset();
  produceInstance[contractName].resolve(it.instance);

  console.log(`${contractName} (re)started`);
};

/**
 * @param {BootstrapPowers} permittedPowers
 * @param {*} config
 */
export const main = (
  permittedPowers,
  config = {
    options: Fail`missing options config`,
  },
) =>
  allValues({
    installation: installQstnContract(permittedPowers, config),
    committeeFacets: startQstnCommittee(permittedPowers, config),
    charterFacets: startQstnCharter(permittedPowers, config),
    contractFacets: startQstnContract(permittedPowers, config),
  });

/** @type {import('@agoric/vats/src/core/lib-boot.js').BootstrapManifest} */
const qstnManifest = {
  [installQstnContract.name]: {
    installation: {
      produce: { [contractName]: true },
    },
  },
  [startQstnCharter.name]: {
    consume: {
      board: true,
      chainStorage: true,
      startUpgradable: true,
    },
    installation: {
      consume: { econCommitteeCharter: true },
    },
    instance: {
      produce: { [`${contractName}Charter`]: true },
    },
    produce: {
      [`${contractName}CharterKit`]: true,
    },
  },
  [startQstnCommittee.name]: {
    consume: {
      board: true,
      chainStorage: true,
      startUpgradable: true,
      namesByAddress: true,
    },
    installation: {
      consume: {
        committee: true,
        binaryVoteCounter: true,
      },
    },
    instance: {
      produce: { [`${contractName}Committee`]: true },
    },
    produce: {
      [`${contractName}CommitteeKit`]: true,
    },
  },
  [startQstnContract.name]: {
    consume: {
      agoricNames: true,
      board: true,
      chainStorage: true,
      chainTimerService: true,
      cosmosInterchainService: true,
      namesByAddressAdmin: true,
      zoe: true,
      localchain: true,
      [`${contractName}CommitteeKit`]: true,
      [`${contractName}CharterKit`]: true,
    },
    produce: {
      [`${contractName}Kit`]: true,
    },
    installation: {
      consume: {
        [contractName]: true,
        contractGovernor: true,
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

export const getManifest = ({ restoreRef }, { installKeys, ...options }) => {
  return harden({
    manifest: qstnManifest,
    installations: {
      [contractName]: restoreRef(installKeys[contractName]),
    },
    options: {
      [contractName]: options,
    },
  });
};

/** @type {BootstrapManifestPermit} */
export const permit = harden({
  consume: {
    agoricNames: true,
    cosmosInterchainService: true,
    namesByAddress: true,
    namesByAddressAdmin: true, // to convert string addresses to depositFacets
    startUpgradable: true,
    qstnKit: true,

    qstnCommitteeKit: true,
    board: true, // for to marshal governance parameter values
    chainStorage: true, // to publish governance parameter values
    chainTimerService: true, // to manage vote durations
    zoe: true, // to start governed contract (TODO: use startUpgradable?)
    localchain: true,
  },
  produce: {
    qstnKit: true,
    qstnCommitteeKit: true,
    qstnCharterKit: true,
  },
  installation: {
    consume: {
      [contractName]: true,
      contractGovernor: true,
      committee: true,
      binaryVoteCounter: true,
      econCommitteeCharter: true,
    },
    produce: { [contractName]: true },
  },
  instance: {
    produce: {
      [contractName]: true,
      [`${contractName}Charter`]: true,
      [`${contractName}Committee`]: true,
    },
  },
  issuer: {
    consume: {
      IST: true,
      BLD: true,
    },
  },
});
