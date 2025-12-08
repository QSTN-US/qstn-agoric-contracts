/// <reference types="@agoric/vats/src/core/types-ambient.js"/>

import { makeTracer } from '@agoric/internal';
import { E } from '@endo/far';
import { M } from '@endo/patterns';
import {
  lookupInterchainInfo,
  startOrchContract,
} from '../tools/orch.start.js';
import { name, permit } from './qstn.contract.permit.js';

/**
 * @import {TypedPattern, Remote} from '@agoric/internal';
 * @import {Marshaller} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {CopyRecord} from '@endo/pass-style';
 * @import {Bech32Address} from '@agoric/orchestration';
 * @import {LegibleCapData} from '../tools/config-marshal.js';
 * @import {start as StartFn} from '../../contract/src/qstn.contract.js';
 * @import {AxelarChainConfigMap, CosmosChainConfigMap, AxelarId, CosmosId, EVMContractAddressesMap, CosmosContractAddressesMap} from '../../contract/src/utils/types.js'
 * @import {OrchestrationPowersWithStorage} from '../tools/orch.start.types.js';
 * @import {QstnBootPowers} from './qstn.deploy.type.js'
 * @import {ChainInfoPowers} from '../tools/chain-info.core.js';
 */

const contractName = 'QstnRouter';

const trace = makeTracer('start qstn contract', true);

/**
 * @typedef {{
 *   chainConfig: AxelarChainConfigMap & CosmosChainConfigMap;
 *   gmpAddresses: {
 *     AXELAR_GMP: Bech32Address;
 *     AXELAR_GAS: Bech32Address;
 *   };
 *   oldBoardId?: string;
 * } & CopyRecord} QstnDeployConfig
 */

/** @type {TypedPattern<QstnDeployConfig>} */
export const qstnDeployConfigShape = M.splitRecord(
  {
    // XXX more precise shape
    chainConfig: M.record(),
    gmpAddresses: M.splitRecord({
      AXELAR_GMP: M.string(),
      AXELAR_GAS: M.string(),
    }),
  },
  {
    oldBoardId: M.string(),
  },
);

/**
 * @param {OrchestrationPowersWithStorage} orchestrationPowers
 * @param {Remote<Marshaller>} marshaller
 * @param {QstnDeployConfig} config
 */
export const makePrivateArgs = async (
  orchestrationPowers,
  marshaller,
  config,
) => {
  const { chainConfig, gmpAddresses } = config;
  const { agoricNames } = orchestrationPowers;

  const { chainInfo, assetInfo } = await lookupInterchainInfo(agoricNames, {
    agoric: ['ubld'],
    axelar: ['uaxl'],
    neutron: ['utrn'],
    osmosis: ['uosmo'],
  });

  /** @type {AxelarId & CosmosId} */
  const chainIds = {
    Avalanche: chainConfig.Avalanche.axelarId,
    Ethereum: chainConfig.Ethereum.axelarId,
    Arbitrum: chainConfig.Arbitrum.axelarId,
    Optimism: chainConfig.Optimism.axelarId,
    Base: chainConfig.Base.axelarId,
    Osmosis: chainConfig.Osmosis.cosmosId,
    Neutron: chainConfig.Neutron.cosmosId,
  };

  /** @type {EVMContractAddressesMap & CosmosContractAddressesMap} */
  const contracts = {
    Avalanche: { ...chainConfig.Avalanche.contracts },
    Ethereum: { ...chainConfig.Ethereum.contracts },
    Arbitrum: { ...chainConfig.Arbitrum.contracts },
    Optimism: { ...chainConfig.Optimism.contracts },
    Base: { ...chainConfig.Base.contracts },
    Osmosis: { ...chainConfig.Osmosis.contracts },
    Neutron: { ...chainConfig.Neutron.contracts },
  };

  /** @type {Parameters<typeof StartFn>[1]} */
  const it = harden({
    ...orchestrationPowers,
    marshaller,
    chainInfo,
    assetInfo,
    chainIds,
    contracts,
    gmpAddresses,
  });
  return it;
};
harden(makePrivateArgs);

/**
 * @param {BootstrapPowers & QstnBootPowers & ChainInfoPowers } permitted
 * @param {{options: LegibleCapData<QstnDeployConfig>}} configStruct
 * @returns {Promise<void>}
 */
export const startQstnRouter = async (permitted, configStruct) => {
  trace('startQstnContract', configStruct);

  /** @type {{ structure: { oldBoardId?: string } }} */
  const options = /** @type any */ (configStruct.options);
  const oldBoardId = options?.structure?.oldBoardId;

  if (oldBoardId) {
    const instance = await E(permitted.consume.board).getValue(oldBoardId);
    const kit = await permitted.consume.qstnKit;
    assert.equal(instance, kit.instance);
    await E(kit.adminFacet).terminateContract(
      Error('shutting down for replacement'),
    );
  }

  await permitted.consume.chainInfoPublished;

  const { issuer } = permitted;

  const [BLD, IST] = await Promise.all([
    issuer.consume.BLD,
    issuer.consume.IST,
  ]);

  const issuerKeywordRecord = { IST, BLD };

  trace('Setting privateArgs');

  await startOrchContract(
    name,
    qstnDeployConfigShape,
    permit,
    makePrivateArgs,
    permitted,
    configStruct,
    // @ts-ignore
    issuerKeywordRecord,
  );

  trace(`${contractName} (re)started`);
};
harden(startQstnRouter);

/** @type {import('@agoric/vats/src/core/lib-boot.js').BootstrapManifest} */
const qstnManifest = {
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
      consume: { [contractName]: true },
    },
    instance: {
      produce: { [contractName]: true },
    },
    issuer: {
      consume: { BLD: true, IST: true },
    },
  },
};

harden(qstnManifest);

export const getManifest = ({ restoreRef }, { installationRef, options }) => {
  return {
    manifest: qstnManifest,
    installations: {
      [contractName]: restoreRef(installationRef),
    },
    options,
  };
};
