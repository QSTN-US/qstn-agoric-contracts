/**
 * @import {Brand} from '@agoric/ertp';
 * @import {Denom, ChainInfo} from '@agoric/orchestration';
 */

const agoricData = net => {
  switch (net) {
    case 'local':
      return 'agoriclocal';
    case 'devnet':
      return 'agoricdev-25';
    case 'mainnet':
      return 'agoric-3';
    default:
      return 'agoriclocal';
  }
};

/** @type {(net: string) => Record<string, ChainInfo>} */
export const chainInfo = net => ({
  agoric: {
    bech32Prefix: 'agoric',
    chainId: agoricData(net),
    icqEnabled: false,
    namespace: 'cosmos',
    reference: agoricData(net),
    stakingTokens: [{ denom: 'ubld' }],
    connections: {
      axelar: {
        id: 'connection-19',
        client_id: '07-tendermint-22',
        counterparty: {
          client_id: '07-tendermint-22',
          connection_id: 'connection-942',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-315',
          portId: 'transfer',
          counterPartyChannelId: 'channel-623',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
      'osmo-test-5': {
        id: 'connection-6',
        client_id: '07-tendermint-6',
        counterparty: {
          client_id: '07-tendermint-6',
          connection_id: 'connection-3957',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-5',
          portId: 'transfer',
          counterPartyChannelId: 'channel-10293',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
      'pion-1': {
        id: 'connection-9',
        client_id: '07-tendermint-9',
        counterparty: {
          client_id: '07-tendermint-9',
          connection_id: 'connection-558',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-7',
          portId: 'transfer',
          counterPartyChannelId: 'channel-1748',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
    },
  },
  axelar: {
    bech32Prefix: 'axelar',
    chainId: 'axelar',
    icqEnabled: false,
    namespace: 'cosmos',
    reference: 'axelar',
    stakingTokens: [{ denom: 'uaxl' }],
    connections: {
      [agoricData(net)]: {
        id: 'connection-942',
        client_id: '07-tendermint-22',
        counterparty: {
          client_id: '07-tendermint-22',
          connection_id: 'connection-19',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-623',
          portId: 'transfer',
          counterPartyChannelId: 'channel-315',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
    },
  },
  osmosis: {
    bech32Prefix: 'osmo',
    chainId: 'osmo-test-5',
    icqEnabled: false,
    namespace: 'cosmos',
    reference: 'osmosis',
    stakingTokens: [{ denom: 'uosmo' }],
    connections: {
      [agoricData(net)]: {
        id: 'connection-3957',
        client_id: '07-tendermint-6',
        counterparty: {
          client_id: '07-tendermint-6',
          connection_id: 'connection-6',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-10293',
          portId: 'transfer',
          counterPartyChannelId: 'channel-5',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
    },
  },

  neutron: {
    bech32Prefix: 'neutron',
    chainId: 'pion-1',
    icqEnabled: false,
    namespace: 'cosmos',
    reference: 'neutron',
    stakingTokens: [{ denom: 'untrn' }],
    connections: {
      [agoricData(net)]: {
        id: 'connection-558',
        client_id: '07-tendermint-9',
        counterparty: {
          client_id: '07-tendermint-9',
          connection_id: 'connection-9',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-1748',
          portId: 'transfer',
          counterPartyChannelId: 'channel-7',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
    },
  },
  Avalanche: {
    namespace: 'eip155',
    reference: '43114',
    cctpDestinationDomain: 1,
  },
  Ethereum: {
    namespace: 'eip155',
    reference: '1',
    cctpDestinationDomain: 0,
  },
  Optimism: {
    namespace: 'eip155',
    reference: '10',
    cctpDestinationDomain: 2,
  },
  Arbitrum: {
    namespace: 'eip155',
    reference: '42161',
    cctpDestinationDomain: 3,
  },
});

/** @type {Record<string, ChainInfo>} */
export const EvmChainInfo = {
  Avalanche: {
    namespace: 'eip155',
    reference: '43114',
    cctpDestinationDomain: 1,
  },
  Ethereum: {
    namespace: 'eip155',
    reference: '1',
    cctpDestinationDomain: 0,
  },
  Optimism: {
    namespace: 'eip155',
    reference: '10',
    cctpDestinationDomain: 2,
  },
  Arbitrum: {
    namespace: 'eip155',
    reference: '42161',
    cctpDestinationDomain: 3,
  },
};

/**
 * @typedef {object} DenomDetail
 * @property {string} baseName - name of issuing chain; e.g. cosmoshub
 * @property {Denom} baseDenom - e.g. uatom
 * @property {string} chainName - name of holding chain; e.g. agoric
 * @property {Brand<'nat'>} [brand] - vbank brand, if registered
 * @see {ChainHub} `registerAsset` method
 */

/** @type {[string, DenomDetail][]} */
export const assetInfo = [
  [
    'uist',
    {
      baseDenom: 'uist',
      baseName: 'agoric',
      chainName: 'agoric',
    },
  ],
  [
    'ubld',
    {
      baseDenom: 'ubld',
      baseName: 'agoric',
      chainName: 'agoric',
    },
  ],
  [
    'uaxl',
    {
      baseDenom: 'uaxl',
      baseName: 'axelar',
      chainName: 'axelar',
    },
  ],
  [
    'uosmo',
    {
      baseDenom: 'uosmo',
      baseName: 'osmosis',
      chainName: 'osmosis',
    },
  ],
  [
    'untrn',
    {
      baseDenom: 'untrn',
      baseName: 'neutron',
      chainName: 'neutron',
    },
  ],
];
