/**
 * @file Pattern-based validation guards for qstn contract
 */

import { M } from '@endo/patterns';
import { ChainInfoShape } from '@agoric/orchestration';

/**
 * @import {TypedPattern} from '@agoric/internal';
 * @import {RemoteChannelInfo} from './types';
 */

export const MessageShape = M.splitRecord(
  {
    destinationChain: M.and(M.string(), M.not('')),
    destinationAddress: M.and(M.string(), M.not('')),
    chainType: M.or('evm', 'cosmos'),
    type: M.or(1, 2, 3),
    amountForChain: M.string(),
    payload: M.any(),
  },
  {
    amountFee: M.string(),
  },
);

export const OfferArgsShape = M.splitRecord(
  {
    messages: M.arrayOf(MessageShape, { arrayLengthLimit: 10 }),
  },
  {},
);

export const CreateSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  time_to_expire: M.number(),
  owner: M.and(M.string(), M.not('')),
  survey_id: M.and(M.string(), M.not('')),
  participants_limit: M.gte(1),
  reward_denom: M.and(M.string(), M.not('')),
  reward_amount: M.gte(0),
  survey_hash: M.and(M.string(), M.not('')),
  manager_pub_key: M.and(M.string(), M.not('')),
});

export const CancelSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  time_to_expire: M.number(),
  survey_id: M.and(M.string(), M.not('')),
  manager_pub_key: M.and(M.string(), M.not('')),
});

export const PayRewardsShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  time_to_expire: M.number(),
  survey_ids: M.and(
    M.arrayOf(M.and(M.string(), M.not('')), { arrayLengthLimit: 100 }),
  ),
  participants: M.and(
    M.arrayOf(M.and(M.string(), M.not('')), { arrayLengthLimit: 100 }),
  ),
  manager_pub_key: M.and(M.string(), M.not('')),
});

export const CosmosPayloadShape = M.splitRecord({
  wasm: M.splitRecord({
    contract: M.and(M.string(), M.not('')),
    msg: M.or(
      M.splitRecord({ create_survey: CreateSurveyShape }),
      M.splitRecord({ cancel_survey: CancelSurveyShape }),
      M.splitRecord({ pay_rewards: PayRewardsShape }),
    ),
  }),
});

/** @type {TypedPattern<RemoteChannelInfo>} */
export const RemoteChannelInfoShape = {
  localDenom: M.string(),
  remoteChainInfo: ChainInfoShape,
  channelId: M.string(),
  remoteDenom: M.string(),
};

harden(RemoteChannelInfoShape);
