/**
 * @import {CosmosContractAddressesMap, CosmosAddressesMap, CosmosChainConfigMap} from './types.js';
 */

export const CosmosChainIdMap = harden({
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
 * @type {CosmosAddressesMap}
 */
export const quizzlerAddresses = harden({
  mainnet: {
    Osmosis: 'osmo1',
    Neutron: 'neutron1',
  },
  testnet: {
    Osmosis: 'osmo1rmk9m9jh43hg5ra7kkvgpg9mq3rejq3mp0epw4cq77zm0g5xpg4slm3tup',
    Neutron:
      'neutron1jrx86xxpy7xrj0g7lhsjypjjz2hld58c3raz83g0w90fdlasgsqq9mnxdr',
  },
});

/**
 * Testnet configuration with real contract addresses
 * Made extensible to support qstn nfts in future
 * @type {CosmosContractAddressesMap}
 */
const testnetContracts = {
  Osmosis: {
    quizzler: quizzlerAddresses.testnet.Osmosis,
  },
  Neutron: {
    quizzler: quizzlerAddresses.testnet.Neutron,
  },
};

harden(testnetContracts);

/**
 * Mainnet configuration with real contract addresses
 *  Made extensible to support qstn nfts in future
 * @type {CosmosContractAddressesMap}
 */
const mainnetContracts = {
  Osmosis: {
    quizzler: quizzlerAddresses.mainnet.Osmosis,
  },
  Neutron: {
    quizzler: quizzlerAddresses.mainnet.Neutron,
  },
};

harden(mainnetContracts);

/**
 * @satisfies {CosmosChainConfigMap}
 */
export const cosmosConfig = harden({
  Osmosis: {
    cosmosId: CosmosChainIdMap.Osmosis.mainnet,
    contracts: { ...mainnetContracts.Osmosis },
  },
  Neutron: {
    cosmosId: CosmosChainIdMap.Neutron.mainnet,
    contracts: { ...mainnetContracts.Neutron },
  },
});

/**
 * @satisfies {CosmosChainConfigMap}
 */
export const cosmosConfigTestnet = harden({
  Osmosis: {
    cosmosId: CosmosChainIdMap.Osmosis.testnet,
    contracts: { ...testnetContracts.Osmosis },
  },
  Neutron: {
    cosmosId: CosmosChainIdMap.Neutron.testnet,
    contracts: { ...testnetContracts.Neutron },
  },
});
