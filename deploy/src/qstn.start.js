/// <reference types="@agoric/vats/src/core/types-ambient.js"/>

import { makeTracer } from '@agoric/internal';
import { E } from '@endo/far';
import { M } from '@endo/patterns';
import {
  lookupInterchainInfo,
  makeGetManifest,
  startOrchContract,
} from '../tools/orch.start.js';
import { name, permit } from './qstn.contract.permit.js';
import { Tracer } from './tracer.js';

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

const trace = makeTracer(`${Tracer}-Starter`);

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
export const QstnDeployConfigShape = M.splitRecord(
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
 * Extract chain ID from either EVM (Axelar) or Cosmos chain config
 * @param {import('../../contract/src/utils/types.js').AxelarChainConfig | import('../../contract/src/utils/types.js').CosmosChainConfig} config
 * @returns {string}
 */
const getChainId = config => {
  if ('axelarId' in config) return config.axelarId;
  if ('cosmosId' in config) return config.cosmosId;
  throw Error('Invalid chain config: missing axelarId or cosmosId');
};

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

  // Get list of cosmos chains from config, plus agoric and axelar
  const chainNames = [
    'agoric',
    'axelar',
    ...Object.entries(chainConfig)
      .filter(([_, config]) => 'cosmosId' in config)
      .map(([name, _]) => name.toLowerCase()),
  ];

  trace('Requesting chain info for:', chainNames);

  const { chainInfo, assetInfo } = await lookupInterchainInfo(
    agoricNames,
    { agoric: ['ubld'] },
    chainNames,
  );

  trace('Final assetinfo', assetInfo);
  trace('Final chainInfos', chainInfo);

  // Build both chainIds and contracts in a single iteration
  /** @type {AxelarId & CosmosId} */
  const chainIds = /** @type {any} */ ({});
  /** @type {EVMContractAddressesMap & CosmosContractAddressesMap} */
  const contracts = /** @type {any} */ ({});

  for (const [chain, config] of Object.entries(chainConfig)) {
    chainIds[chain] = getChainId(config);
    contracts[chain] = { ...config.contracts };
  }

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
export const startQstn = async (permitted, configStruct) => {
  trace('startQstnContract', configStruct);

  /** @type {{ structure: { oldBoardId?: string } }} */
  const options = /** @type any */ (configStruct.options);
  const oldBoardId = options?.structure?.oldBoardId;

  if (oldBoardId) {
    const instance = await E(permitted.consume.board).getValue(oldBoardId);
    const kit = await permitted.consume[`${name}Kit`];
    assert.equal(instance, kit.instance);
    await E(kit.adminFacet).terminateContract(
      Error('shutting down for replacement'),
    );
  }

  await permitted.consume.chainInfoPublished;

  const { issuer } = permitted;

  const BLD = await issuer.consume.BLD;

  const issuerKeywordRecord = { BLD };

  trace('Setting privateArgs');

  await startOrchContract(
    name,
    QstnDeployConfigShape,
    permit,
    makePrivateArgs,
    permitted,
    configStruct,
    issuerKeywordRecord,
  );

  trace(`${name} (re)started`);
};
harden(startQstn);

export const getManifestForQstn = (u, d) =>
  makeGetManifest(startQstn, permit, name)(u, d);
