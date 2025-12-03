/**
 * @import {Denom, CosmosChainInfo} from '@agoric/orchestration';
 */

const agoricData = {
  channelId: 'channel-0',
  clientId: '07-tendermint-0',
  connectionId: 'connection-0',
  chainId: 'agoriclocal',
};

/** @type {Record<string, CosmosChainInfo>} */
export const chainInfo = {
  agoric: {
    bech32Prefix: 'agoric',
    chainId: agoricData.chainId,
    icqEnabled: false,
    namespace: 'cosmos',
    reference: agoricData.chainId,
    stakingTokens: [{ denom: 'ubld' }],
    connections: {
      axelar: {
        id: 'connection-0',
        client_id: '07-tendermint-0',
        counterparty: {
          client_id: '07-tendermint-0',
          connection_id: 'connection-0',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-0',
          portId: 'transfer',
          counterPartyChannelId: 'channel-0',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
      'osmosis-1': {
        id: 'connection-1',
        client_id: '07-tendermint-1',
        counterparty: {
          client_id: '07-tendermint-2109',
          connection_id: 'connection-1649',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-1',
          portId: 'transfer',
          counterPartyChannelId: 'channel-320',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
      'neutron-1': {
        id: 'connection-99',
        client_id: '07-tendermint-101',
        counterparty: {
          client_id: '07-tendermint-148',
          connection_id: 'connection-108',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-146',
          portId: 'transfer',
          counterPartyChannelId: 'channel-5789',
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
    icqEnabled: true,
    namespace: 'cosmos',
    reference: 'axelar',
    stakingTokens: [{ denom: 'uaxl' }],
    connections: {
      agoriclocal: {
        id: 'connection-0',
        client_id: '07-tendermint-0',
        counterparty: {
          client_id: '07-tendermint-0',
          connection_id: 'connection-0',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-0',
          portId: 'transfer',
          counterPartyChannelId: 'channel-0',
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
    chainId: 'osmosis-1',
    icqEnabled: true,
    namespace: 'cosmos',
    reference: 'osmosis-1',
    stakingTokens: [
      {
        denom: 'uosmo',
      },
    ],
    connections: {
      agoriclocal: {
        id: 'connection-1649',
        client_id: '07-tendermint-2109',
        counterparty: {
          client_id: '07-tendermint-1',
          connection_id: 'connection-1',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-320',
          portId: 'transfer',
          counterPartyChannelId: 'channel-1',
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
    chainId: 'neutron-1',
    icqEnabled: false,
    namespace: 'cosmos',
    reference: 'neutron-1',
    stakingTokens: [
      {
        denom: 'untrn',
      },
    ],
    connections: {
      agoriclocal: {
        id: 'connection-108',
        client_id: '07-tendermint-148',
        counterparty: {
          client_id: '07-tendermint-101',
          connection_id: 'connection-99',
        },
        state: 3,
        transferChannel: {
          channelId: 'channel-5789',
          portId: 'transfer',
          counterPartyChannelId: 'channel-146',
          counterPartyPortId: 'transfer',
          ordering: 0,
          state: 3,
          version: 'ics20-1',
        },
      },
    },
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

export const assetInfo = JSON.stringify([
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
    'ibc/2CC0B1B7A981ACC74854717F221008484603BB8360E81B262411B0D830EDE9B0',
    {
      baseDenom: 'uaxl',
      baseName: 'axelar',
      chainName: 'agoric',
      brandKey: 'AXL',
    },
  ],
  [
    'ibc/6469BDA6F62C4F4B8F76629FA1E72A02A3D1DD9E2B22DDB3C3B2296DEAD29AB8',
    {
      baseDenom: 'uosmo',
      baseName: 'osmosis',
      chainName: 'agoric',
      brandKey: 'OSMO',
    },
  ],
  [
    'ibc/126DA09104B71B164883842B769C0E9EC1486C0887D27A9999E395C2C8FB5682',
    {
      baseDenom: 'untrn',
      baseName: 'neutron',
      chainName: 'agoric',
      brandKey: 'NTRN',
    },
  ],
]);
