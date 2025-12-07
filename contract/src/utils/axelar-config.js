/**
 * @import {EVMContractAddressesMap, AxelarChainIdEntry, EvmAddressesMap, AxelarChainConfigMap, GMPAddressesMap} from './types.js';
 * @import {EVM_CHAINS} from './chains.js';
 */

/**
 * A mapping between internal AxelarChain enum keys and their corresponding
 * Axelar chain identifiers for both testnet and mainnet environments.
 *
 *
 * @type {Record<keyof typeof EVM_CHAINS, AxelarChainIdEntry>}
 *
 * @see {@link https://docs.axelar.dev/resources/contract-addresses/testnet/#evm-contract-addresses}
 * @see {@link https://github.com/axelarnetwork/axelarjs-sdk/blob/f84c8a21ad9685091002e24cac7001ed1cdac774/src/chains/supported-chains-list.ts | supported-chains-list.ts}
 */
export const AxelarChainIdMap = harden({
  Avalanche: {
    testnet: 'Avalanche',
    mainnet: 'Avalanche',
  },
  Ethereum: {
    testnet: 'ethereum-sepolia',
    mainnet: 'Ethereum',
  },
  Arbitrum: {
    testnet: 'arbitrum-sepolia',
    mainnet: 'arbitrum',
  },
  Optimism: {
    testnet: 'optimism-sepolia',
    mainnet: 'optimism',
  },
  Base: {
    testnet: 'base-sepolia',
    mainnet: 'base',
  },
});

// XXX: Ideally this should be Record<keyof typeof AxelarChain, HexAddress>.
// Currently using a looser type to work around compile-time errors.

/** @type {EvmAddressesMap} */
const quizzlerAddresses = harden({
  mainnet: {
    Ethereum: '0x',
    Avalanche: '0x',
    Arbitrum: '0x',
    Optimism: '0x',
    Base: '0x',
  },
  testnet: {
    Ethereum: '0x',
    Arbitrum: '0x',
    Base: '0x',
    Optimism: '0x',
    Avalanche: '0x6AAe256A231017939Ff870877F01072d94A633AB',
  },
});

/**
 * Mainnet configuration with real contract addresses
 * Made extensible to support qstn nfts in future
 * @type {EVMContractAddressesMap}
 */
const mainnetContracts = {
  Avalanche: {
    quizzler: quizzlerAddresses.mainnet.Avalanche,
  },
  Ethereum: {
    quizzler: quizzlerAddresses.mainnet.Ethereum,
  },
  Optimism: {
    quizzler: quizzlerAddresses.mainnet.Optimism,
  },
  Arbitrum: {
    quizzler: quizzlerAddresses.mainnet.Arbitrum,
  },
  Base: {
    quizzler: quizzlerAddresses.mainnet.Base,
  },
};
harden(mainnetContracts);

// XXX turn these inside out? contract.chain.address
/**
 * Testnet configuration with testnet contract addresses
 * Made extensible to support qstn nfts in future
 * @type {EVMContractAddressesMap}
 */
const testnetContracts = {
  Avalanche: {
    quizzler: quizzlerAddresses.testnet.Avalanche,
  },
  Base: {
    quizzler: quizzlerAddresses.testnet.Base,
  },
  Ethereum: {
    quizzler: quizzlerAddresses.testnet.Ethereum,
  },
  Optimism: {
    quizzler: quizzlerAddresses.testnet.Optimism,
  },
  Arbitrum: {
    quizzler: quizzlerAddresses.testnet.Arbitrum,
  },
};
harden(testnetContracts);

/**
 * Mainnet chains only.
 *  @satisfies {AxelarChainConfigMap}
 */
export const axelarConfig = harden({
  Arbitrum: {
    axelarId: AxelarChainIdMap.Arbitrum.mainnet,
    contracts: { ...mainnetContracts.Arbitrum },
  },
  Avalanche: {
    axelarId: AxelarChainIdMap.Avalanche.mainnet,
    contracts: { ...mainnetContracts.Avalanche },
  },
  Base: {
    axelarId: AxelarChainIdMap.Base.mainnet,
    contracts: { ...mainnetContracts.Base },
  },
  Ethereum: {
    axelarId: AxelarChainIdMap.Ethereum.mainnet,
    contracts: { ...mainnetContracts.Ethereum },
  },
  Optimism: {
    axelarId: AxelarChainIdMap.Optimism.mainnet,
    contracts: { ...mainnetContracts.Optimism },
  },
});

/**
 * Testnet chains only.
 *  @satisfies {AxelarChainConfigMap}
 */
export const axelarConfigTestnet = harden({
  Arbitrum: {
    axelarId: AxelarChainIdMap.Arbitrum.testnet,
    contracts: { ...testnetContracts.Arbitrum },
  },
  Avalanche: {
    axelarId: AxelarChainIdMap.Avalanche.testnet,
    contracts: { ...testnetContracts.Avalanche },
  },
  Base: {
    axelarId: AxelarChainIdMap.Base.testnet,
    contracts: { ...testnetContracts.Base },
  },
  Ethereum: {
    axelarId: AxelarChainIdMap.Ethereum.testnet,
    contracts: { ...testnetContracts.Ethereum },
  },
  Optimism: {
    axelarId: AxelarChainIdMap.Optimism.testnet,
    contracts: { ...testnetContracts.Optimism },
  },
});

/**
 * These addresses are canonical per Axelar.
 *
 * **AXELAR_GMP:**
 * The Axelar GMP account address is documented in various places.
 * One reference: {@link https://docs.axelar.dev/dev/general-message-passing/cosmos-gmp/overview/#messages-from-cosmwasm}
 *
 * **AXELAR_GAS:**
 * The GAS service address is not directly cited in the docs,
 * but appears in the AxelarJS source:
 * {@link https://github.com/axelarnetwork/axelarjs/blob/fae808d4a2a1e34f386d6486f5f3708dd7a25cf5/packages/core/src/index.ts#L9-L13}
 *
 * Both addresses were also confirmed directly with the Axelar team via Slack.
 * @type {GMPAddressesMap}
 */
export const gmpAddresses = harden({
  mainnet: {
    /**
     * GMP address on mainnet.
      @see https://axelarscan.io/account/axelar1dv4u5k73pzqrxlzujxg3qp8kvc3pje7jtdvu72npnt5zhq05ejcsn5qme5 */
    AXELAR_GMP:
      'axelar1dv4u5k73pzqrxlzujxg3qp8kvc3pje7jtdvu72npnt5zhq05ejcsn5qme5',
    /**
     * GAS receiver address on mainnet.
      @see https://axelarscan.io/account/axelar1aythygn6z5thymj6tmzfwekzh05ewg3l7d6y89 */
    AXELAR_GAS: 'axelar1aythygn6z5thymj6tmzfwekzh05ewg3l7d6y89',
  },
  testnet: {
    /**
     * GMP address on testnet.
      @see https://testnet.axelarscan.io/account/axelar1dv4u5k73pzqrxlzujxg3qp8kvc3pje7jtdvu72npnt5zhq05ejcsn5qme5 */
    AXELAR_GMP:
      'axelar1dv4u5k73pzqrxlzujxg3qp8kvc3pje7jtdvu72npnt5zhq05ejcsn5qme5',
    /**
     * GAS receiver address on testnet.
      @see https://testnet.axelarscan.io/account/axelar1zl3rxpp70lmte2xr6c4lgske2fyuj3hupcsvcd */
    AXELAR_GAS: 'axelar1zl3rxpp70lmte2xr6c4lgske2fyuj3hupcsvcd',
  },
});
