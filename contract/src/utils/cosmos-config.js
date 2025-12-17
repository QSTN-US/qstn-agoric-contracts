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
    Osmosis: 'osmo1jzvuj8kgpw8969g92d834mydc4y0jt9d3pmm7kgvkhpql8x3jnvs4t4pq6',
    Neutron:
      'neutron1em4guhq7hvheehl3wqm44slngckg6e0338utfrl9yx8tt0mmtgsq5x9fgx',
  },
  testnet: {
    Osmosis: 'osmo1rc2e0gw25fk0vpm92n7nrckfhjzudmudgtv5kyzsyaa67mfd3f9q35djer',
    Neutron:
      'neutron1s7x6zxxsyush4drljt5v8chrekc5v4xdurs29ns6tllevsvnuwmsc6uwng',
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
