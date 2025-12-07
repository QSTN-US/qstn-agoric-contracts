/**
 * @file Helper functions for qstn contract
 */

import { makeError } from '@endo/errors';
import { denomHash } from '@agoric/orchestration';

/**
 * @import {CosmosChainInfo, IBCConnectionInfo} from '@agoric/orchestration';
 * @import {RemoteChannelInfo} from './types.js';
 */

/**
 * Extracts RemoteChannelInfo from chain configuration
 *
 * @param {CosmosChainInfo} remoteChainInfo - The remote chain information
 * @param {IBCConnectionInfo['transferChannel']} transferChannel - The transfer channel
 * @returns {RemoteChannelInfo}
 */
export const extractRemoteChannelInfo = (remoteChainInfo, transferChannel) => {
  const stakingTokens = remoteChainInfo.stakingTokens;

  if (!stakingTokens) {
    throw makeError(
      `${remoteChainInfo.chainId} does not have stakingTokens in config`,
    );
  }

  const stakingToken = stakingTokens[0];

  const remoteDenom = stakingToken.denom;

  const localDenom = `ibc/${denomHash({
    denom: remoteDenom,
    channelId: transferChannel.channelId,
  })}`;

  return {
    localDenom,
    remoteChainInfo,
    transferChannel,
    remoteDenom,
  };
};
