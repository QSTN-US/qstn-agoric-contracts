import { IBCConnectionInfoShape } from '@agoric/orchestration/src/typeGuards.js';
import { mustMatch } from '@endo/patterns';
import { execFileSync } from 'node:child_process';
import { makeAgd } from '../tools/agd-lib.js';
import {
  chainInfo as bootstrapChainInfo,
  assetInfo as bootstrapAssetInfo,
} from './static-config.js';
import { makeAssetInfo } from './chain-name-service.js';

/**
 * @import {IBCChannelID, IBCConnectionID} from '@agoric/vats';
 * @import {ChainInfo, CosmosChainInfo, IBCConnectionInfo} from '@agoric/orchestration'
 * @import {DenomDetail} from '@agoric/orchestration'
 */

/**
 * @typedef {{ rpcAddrs: string[], chainName: string }} MinimalNetworkConfig
 */

/**
 * @param {string} net
 * @param {typeof fetch} fetch
 * @returns {Promise<MinimalNetworkConfig>}
 */
const getNetConfig = (net, fetch) =>
  fetch(`https://${net}.agoric.net/network-config`)
    .then(res => res.text())
    .then(s => JSON.parse(s));

/** @param {string[]} strs */
const parsePeers = strs => {
  /** @type {[name: string, conn: IBCConnectionID, chan: IBCChannelID, denom:string][]} */
  // @ts-expect-error XXX ID syntax should be dynamically checked
  const peerParts = strs.map(s => s.split(':'));
  const badPeers = peerParts.filter(d => d.length !== 4);
  if (badPeers.length) {
    throw Error(
      `peers must be name:connection-X:channel-Y:denom, not ${badPeers.join(', ')}`,
    );
  }
  return peerParts;
};

/**
 * Get the IBC chain configuration based on the provided network and peer inputs.
 *
 * @param {Object} args - The arguments object.
 * @param {string} args.net - The network name (e.g., 'emerynet').
 * @param {string[]} args.peer - The peers to connect .
 * @returns {Promise<{chainInfo: Record<string, ChainInfo>,  assetInfo: [string, DenomDetail][]}>} A promise that resolves to the chain configuration details keyed by chain name.
 */

export const getChainConfig = async ({ net, peer }) => {
  if (net === 'local') {
    return {
      chainInfo: bootstrapChainInfo(net),
      assetInfo: bootstrapAssetInfo,
    };
  }

  /** @type {Record<string, CosmosChainInfo>} */
  const chainDetails = {};

  /** @type {Record<string, IBCConnectionInfo>} */
  const connections = {};
  const portId = 'transfer';

  const { chainName: chainId, rpcAddrs } = await getNetConfig(net, fetch);

  const agd = makeAgd({ execFileSync }).withOpts({ rpcAddrs });

  /** @type {Record<string, string[]>} */
  const tokenMap = { agoric: ['ubld'] };

  for (const [peerName, myConn, myChan, denom] of parsePeers(peer)) {
    const connInfo = await agd
      .query(['ibc', 'connection', 'end', myConn])
      .then(x => x.connection);

    const { client_id } = connInfo;

    const clientState = await agd
      .query(['ibc', 'client', 'state', client_id])
      .then(x => x.client_state);

    const { chain_id: peerId } = clientState;

    chainDetails[peerName] = {
      namespace: 'cosmos',
      reference: peerId,
      chainId: peerId,
      stakingTokens: [{ denom }],
      bech32Prefix: peerName,
    };

    // Add token to tokenMap for asset info generation
    tokenMap[peerName] = [denom];

    const chan = await agd
      .query(['ibc', 'channel', 'end', portId, myChan])
      .then(r => r.channel);

    /** @type {IBCConnectionInfo} */
    const info = harden({
      client_id,
      counterparty: {
        client_id: connInfo.counterparty.client_id,
        connection_id: connInfo.counterparty.connection_id,
      },
      id: myConn,
      state: connInfo.state,
      transferChannel: {
        channelId: myChan,
        counterPartyChannelId: chan.counterparty.channel_id,
        counterPartyPortId: chan.counterparty.port_id,
        ordering: chan.ordering,
        portId,
        state: chan.state,
        version: chan.version,
      },
    });
    mustMatch(info, IBCConnectionInfoShape);
    connections[peerId] = info;
  }

  chainDetails['agoric'] = {
    namespace: 'cosmos',
    reference: chainId,
    chainId,
    stakingTokens: [{ denom: 'ubld' }],
    connections,
    bech32Prefix: 'agoric',
  };

  const assetInfo = makeAssetInfo(chainDetails, tokenMap);

  return { chainInfo: chainDetails, assetInfo };
};
