/**
 * @import {CosmosContractAddressesMap, CosmosAddressesMap, CosmosChainConfigMap} from './types.js';
 */

import { ENABLED_COSMOS_CHAINS } from './chain-config.js';

const { keys, fromEntries } = Object;

/**
 * All possible Cosmos chain ID mappings
 */
const AllCosmosChainIds = harden({
  Osmosis: {
    testnet: 'osmo-test-5',
    mainnet: 'osmosis-1 ',
  },
  Neutron: {
    testnet: 'pion-1',
    mainnet: 'neutron-1',
  },
});

/**
 * Enabled Cosmos chain IDs (filtered by ENABLED_COSMOS_CHAINS)
 */
export const CosmosChainIdMap = harden(
  fromEntries(
    keys(ENABLED_COSMOS_CHAINS).map(chain => [chain, AllCosmosChainIds[chain]]),
  ),
);

/**
 * @type {CosmosAddressesMap}
 */
export const quizzlerAddresses = harden({
  mainnet: {
    Osmosis: 'osmo1',
    Neutron:
      '"neutron1yvlzedzdn66x7zynn33z5mdkg6vlxa6tcqn70pkxksncnhuk47csq8yj9h"',
  },
  testnet: {
    Osmosis: 'osmo1rmk9m9jh43hg5ra7kkvgpg9mq3rejq3mp0epw4cq77zm0g5xpg4slm3tup',
    Neutron:
      'neutron1jrx86xxpy7xrj0g7lhsjypjjz2hld58c3raz83g0w90fdlasgsqq9mnxdr',
  },
});

/**
 * Testnet configuration with real contract addresses (filtered by ENABLED_COSMOS_CHAINS)
 * Made extensible to support qstn nfts in future
 * @type {CosmosContractAddressesMap}
 */
const testnetContracts = harden(
  /** @type {CosmosContractAddressesMap} */ (
    fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [
        chain,
        { quizzler: quizzlerAddresses.testnet[chain] },
      ]),
    )
  ),
);

/**
 * Mainnet configuration with real contract addresses (filtered by ENABLED_COSMOS_CHAINS)
 * Made extensible to support qstn nfts in future
 * @type {CosmosContractAddressesMap}
 */
const mainnetContracts = harden(
  /** @type {CosmosContractAddressesMap} */ (
    fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [
        chain,
        { quizzler: quizzlerAddresses.mainnet[chain] },
      ]),
    )
  ),
);

/**
 * Mainnet Cosmos chains (filtered by ENABLED_COSMOS_CHAINS)
 * @type {CosmosChainConfigMap}
 */
export const cosmosConfig = harden(
  /** @type {CosmosChainConfigMap} */ (
    fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [
        chain,
        {
          cosmosId: CosmosChainIdMap[chain].mainnet,
          contracts: { ...mainnetContracts[chain] },
        },
      ]),
    )
  ),
);

/**
 * Testnet Cosmos chains (filtered by ENABLED_COSMOS_CHAINS)
 * @type {CosmosChainConfigMap}
 */
export const cosmosConfigTestnet = harden(
  /** @type {CosmosChainConfigMap} */ (
    fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [
        chain,
        {
          cosmosId: CosmosChainIdMap[chain].testnet,
          contracts: { ...testnetContracts[chain] },
        },
      ]),
    )
  ),
);
