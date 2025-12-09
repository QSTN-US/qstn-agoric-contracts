/**
 * @import {EVMContractAddressesMap, AxelarChainIdEntry, EvmAddressesMap, AxelarChainConfigMap, GMPAddressesMap} from './types.js';
 */

import { ENABLED_EVM_CHAINS } from './chain-config.js';

const { keys, fromEntries } = Object;

/**
 * All possible Axelar chain ID mappings
 * Maps internal chain names to Axelar chain identifiers for testnet and mainnet
 *
 * @see {@link https://docs.axelar.dev/resources/contract-addresses/testnet/#evm-contract-addresses}
 * @see {@link https://github.com/axelarnetwork/axelarjs-sdk/blob/f84c8a21ad9685091002e24cac7001ed1cdac774/src/chains/supported-chains-list.ts | supported-chains-list.ts}
 */
const AllAxelarChainIds = harden({
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

/**
 * Enabled Axelar chain IDs (filtered by ENABLED_EVM_CHAINS)
 *
 * @type {Record<keyof typeof ENABLED_EVM_CHAINS, AxelarChainIdEntry>}
 */
export const AxelarChainIdMap = harden(
  /** @type {Record<keyof typeof ENABLED_EVM_CHAINS, AxelarChainIdEntry>} */ (
    fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [chain, AllAxelarChainIds[chain]]),
    )
  ),
);

// XXX: Ideally this should be Record<keyof typeof AxelarChain, HexAddress>.
// Currently using a looser type to work around compile-time errors.

/** @type {EvmAddressesMap} */
const allQuizzlerAddresses = harden({
  mainnet: {
    Avalanche: '0x1746Cc9395bFE6e0f0545C072514aC9E11f730a5',
    Ethereum: '0x',
    Arbitrum: '0x',
    Optimism: '0x',
    Base: '0x',
  },
  testnet: {
    Avalanche: '0x1746Cc9395bFE6e0f0545C072514aC9E11f730a5',
    Ethereum: '0x',
    Arbitrum: '0x',
    Base: '0x',
    Optimism: '0x',
  },
});

/**
 * Mainnet configuration with real contract addresses (filtered by ENABLED_EVM_CHAINS)
 * Made extensible to support qstn nfts in future
 * @type {EVMContractAddressesMap}
 */
const mainnetContracts = harden(
  /** @type {EVMContractAddressesMap} */ (
    fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [
        chain,
        { quizzler: allQuizzlerAddresses.mainnet[chain] },
      ]),
    )
  ),
);

// XXX turn these inside out? contract.chain.address
/**
 * Testnet configuration with testnet contract addresses (filtered by ENABLED_EVM_CHAINS)
 * Made extensible to support qstn nfts in future
 * @type {EVMContractAddressesMap}
 */
const testnetContracts = harden(
  /** @type {EVMContractAddressesMap} */ (
    fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [
        chain,
        { quizzler: allQuizzlerAddresses.testnet[chain] },
      ]),
    )
  ),
);

/**
 * Mainnet chains only (filtered by ENABLED_EVM_CHAINS).
 * @type {AxelarChainConfigMap}
 */
export const axelarConfig = harden(
  /** @type {AxelarChainConfigMap} */ (
    fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [
        chain,
        {
          axelarId: AxelarChainIdMap[chain].mainnet,
          contracts: { ...mainnetContracts[chain] },
        },
      ]),
    )
  ),
);

/**
 * Testnet chains only (filtered by ENABLED_EVM_CHAINS).
 * @type {AxelarChainConfigMap}
 */
export const axelarConfigTestnet = harden(
  /** @type {AxelarChainConfigMap} */ (
    fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [
        chain,
        {
          axelarId: AxelarChainIdMap[chain].testnet,
          contracts: { ...testnetContracts[chain] },
        },
      ]),
    )
  ),
);

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
