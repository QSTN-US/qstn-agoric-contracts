import { denomHash } from '@agoric/orchestration/src/utils/denomHash.js';

/**
 * @import {IBCChannelID, NameAdmin} from '@agoric/vats';
 * @import {ChainInfo, Denom} from '@agoric/orchestration';
 * @import {CosmosChainInfo} from '@agoric/orchestration';
 * @import {DenomDetail} from '@agoric/orchestration';
 */

const { entries, fromEntries } = Object;

/**
 * @param {Record<string, ChainInfo>} chainInfo
 * @returns {Record<string, CosmosChainInfo>}
 */
export const selectCosmosChainInfo = chainInfo =>
  // @ts-expect-error filter out all but CosmosChainInfo
  harden(
    fromEntries(
      entries(chainInfo).filter(([_n, info]) => 'bech32Prefix' in info),
    ),
  );

/**
 * @param {Record<string, ChainInfo>} chainInfo
 */
export const makeDenomTools = chainInfo => {
  const cosmosChainInfo = selectCosmosChainInfo(chainInfo);
  /**
   * @param {string} destChainId
   * @param {string} fromChainName
   * @returns {IBCChannelID | undefined}
   */
  const getTransferChannelId = (destChainId, fromChainName) =>
    cosmosChainInfo[fromChainName]?.connections?.[destChainId]?.transferChannel
      .channelId;

  /**
   * @param {Denom} denom
   * @param {string} destChainId
   * @param {string} fromChainName
   * @returns {Denom}
   */
  const toDenomHash = (denom, destChainId, fromChainName) => {
    const channelId = getTransferChannelId(destChainId, fromChainName);
    if (!channelId) {
      throw new Error(
        `No channel found for ${destChainId} -> ${fromChainName}....${chainInfo}`,
      );
    }
    return `ibc/${denomHash({ denom, channelId })}`;
  };

  return harden({ getTransferChannelId, toDenomHash });
};

/**
 * Make asset info for the current environment.
 *
 * TODO: NEEDSTEST
 *
 * until #10580, the contract's `issuerKeywordRecord` must include 'ATOM',
 * 'OSMO',, etc. for the local `chainHub` to know about brands.
 *
 * @param {Record<string, ChainInfo>} chainInfo
 * @param {Record<string, Denom[]>} tokenMap
 * @returns {[Denom, DenomDetail][]}
 */
export const makeAssetInfo = (
  chainInfo,
  tokenMap = {
    agoric: ['ubld'],
    axelar: ['uaxl'],
    osmosis: ['uosmo'],
    neutron: ['untrn'],
  },
) => {
  const { toDenomHash } = makeDenomTools(chainInfo);

  // Only include chains present in `chainInfo`
  const tokens = Object.entries(tokenMap)
    .filter(([chain]) => chain in chainInfo)
    .flatMap(([chain, denoms]) => denoms.map(denom => ({ denom, chain })));

  /** @type {[Denom, DenomDetail][]} */
  const assetInfo = [];

  for (const { denom, chain } of tokens) {
    const baseDetails = {
      baseName: chain,
      baseDenom: denom,
    };

    // Add native token entry (token on its origin chain)
    assetInfo.push([
      denom,
      {
        ...baseDetails,
        chainName: chain,
        ...(chain === 'agoric' && {
          brandKey: denom.replace(/^u/, '').toUpperCase(),
        }),
      },
    ]);

    // Add IBC denom entry for how this token appears on Agoric
    // (Only for non-agoric cosmos chains, using agoric's connections)
    if (chain === 'agoric') continue;
    if (chainInfo[chain].namespace !== 'cosmos') continue;
    if (chainInfo.agoric?.namespace !== 'cosmos') continue;

    const sourceChainId = chainInfo[chain].chainId;

    const agoricConnections = chainInfo.agoric.connections;

    // Check if agoric has a connection to this source chain
    if (agoricConnections?.[sourceChainId]) {
      assetInfo.push([
        toDenomHash(denom, sourceChainId, 'agoric'),
        {
          ...baseDetails,
          chainName: 'agoric',
          // @ts-expect-error brandKey until #10580
          brandKey: denom.replace(/^u/, '').toUpperCase(),
        },
      ]);
    }
  }

  return harden(assetInfo);
};
