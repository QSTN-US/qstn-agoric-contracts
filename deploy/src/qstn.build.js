import { makeHelpers } from '@agoric/deploy-script-support';
import { parseArgs } from 'node:util';
import {
  axelarConfigTestnet,
  axelarConfig as axelarMainnetConfig,
  gmpAddresses,
} from '../../contract/src/utils/axelar-config.js';
import {
  cosmosConfigTestnet,
  cosmosConfig as cosmosMainnetConfig,
} from '../../contract/src/utils/cosmos-config.js';
import { toExternalConfig } from '../tools/config-marshal.js';
import { name } from './qstn.contract.permit.js';
import { QstnDeployConfigShape } from './qstn.start.js';
import { isBech32Address } from '@agoric/orchestration/src/utils/address.js';
import { getChainConfig } from '../tools/get-chain-config.js';
import { Tracer } from '../tools/tracer.js';
import { makeTracer } from '@agoric/internal';
import { EvmChainInfo } from '../tools/static-config.js';
/**
 * @typedef {import('@agoric/deploy-script-support/src/externalTypes.js').CoreEvalBuilder} CoreEvalBuilder
 * @typedef {import('@agoric/deploy-script-support/src/externalTypes.js').DeployScriptFunction} DeployScriptFunction
 */

/**
 * @import {QstnDeployConfig} from './qstn.start.js';
 */

const trace = makeTracer(`${Tracer}-Builder`);

const isValidAddr = addr => {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
};

const parseBuilderArgs = args =>
  parseArgs({
    args,
    options: {
      net: { type: 'string' },
      replace: { type: 'string' },
      peer: { type: 'string', multiple: true },
    },
  });

/**
 * @param {Parameters<CoreEvalBuilder>[0]} tools
 * @param {QstnDeployConfig} config
 * @satisfies {CoreEvalBuilder}
 */
const defaultProposalBuilder = async ({ publishRef, install }, config) => {
  return harden({
    sourceSpec: './qstn.start.js',
    getManifestCall: [
      'getManifestForQstn',
      {
        options: toExternalConfig(config, {}, QstnDeployConfigShape),
        installKeys: {
          [name]: publishRef(install('../dist/qstn.contract.bundle.js')),
        },
      },
    ],
  });
};

/** @type {DeployScriptFunction} */ 0;
const build = async (homeP, endowments) => {
  await null;
  const { scriptArgs } = endowments;
  const { values: flags } = parseBuilderArgs(scriptArgs);
  const boardId = flags.replace;

  if (!flags.net) {
    throw new Error('network is required');
  }

  const { assetInfo, chainInfo } = await getChainConfig({
    net: flags.net,
    peer: flags.peer ? flags.peer : [],
  });

  /** @type {{ mainnet: QstnDeployConfig, testnet: QstnDeployConfig }} */
  const configs = harden({
    mainnet: {
      chainConfig: { ...axelarMainnetConfig, ...cosmosMainnetConfig },
      gmpAddresses: {
        ...gmpAddresses.mainnet,
      },
      oldBoardId: boardId || '',
      assetInfo,
      chainInfo: { ...chainInfo, ...EvmChainInfo },
    },
    testnet: {
      chainConfig: { ...axelarConfigTestnet, ...cosmosConfigTestnet },
      gmpAddresses: {
        ...gmpAddresses.testnet,
      },
      oldBoardId: boardId || '',
      assetInfo,
      chainInfo: { ...chainInfo, ...EvmChainInfo },
    },
  });

  const isMainnet = flags.net === 'mainnet';
  const config = configs[isMainnet ? 'mainnet' : 'testnet'];

  for (const [chain, chainConfig] of Object.entries(config.chainConfig)) {
    const addr = chainConfig.contracts.quizzler;

    if (!addr || (!isValidAddr(addr) && !isBech32Address(addr))) {
      throw new Error(`Invalid address for ${chain}: ${addr}`);
    }
  }

  const { writeCoreEval } = await makeHelpers(homeP, endowments);
  // TODO: unit test agreement with startPortfolio.name
  await writeCoreEval('eval-qstn', utils =>
    defaultProposalBuilder(utils, harden(config)),
  );
};

export default build;
