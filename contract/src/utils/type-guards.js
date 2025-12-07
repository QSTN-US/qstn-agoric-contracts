/**
 * @file Pattern-based validation guards for qstn contract
 */

import { M } from '@endo/patterns';
import {
  ChainInfoShape,
  CosmosChainAddressShape,
  DenomDetailShape,
  OrchestrationPowersShape,
} from '@agoric/orchestration';
import { COSMOS_CHAINS, EVM_CHAINS } from './chains.js';

/**
 * @import {RemoteChannelInfo, AccountTapState} from './types';
 * @import {CopyRecord} from '@endo/pass-style';
 * @import {TypedPattern} from '@agoric/internal';
 * @import {CosmosContractAddresses, EVMContractAddresses, GMPAddresses, QstnPrivateArgs} from './types.js';
 */

const { fromEntries, keys } = Object;

export const EvmCreateSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  timeToExpire: M.and(M.number(), M.gte(1)),
  owner: M.and(M.string(), M.not('')),
  surveyId: M.and(M.string(), M.not('')),
  participantsLimit: M.and(M.number(), M.gte(1)),
  rewardAmount: M.and(M.string(), M.not('')),
  surveyHash: M.and(M.string(), M.not('')),
});

export const EvmCancelSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  timeToExpire: M.and(M.number(), M.gte(1)),
  surveyId: M.and(M.string(), M.not('')),
});

export const EvmPayRewardsSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  timeToExpire: M.and(M.number(), M.gte(1)),
  surveyIds: M.and(
    M.arrayOf(M.and(M.string(), M.not('')), { arrayLengthLimit: 100 }),
  ),
  participants: M.and(
    M.arrayOf(M.and(M.string(), M.not('')), { arrayLengthLimit: 100 }),
  ),
});

export const EvmPayloadShape = M.splitRecord({
  msg: M.or(
    M.splitRecord({ create_survey: EvmCreateSurveyShape }),
    M.splitRecord({ cancel_survey: EvmCancelSurveyShape }),
    M.splitRecord({ pay_rewards: EvmPayRewardsSurveyShape }),
  ),
});

export const CosmosCreateSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  time_to_expire: M.number(),
  owner: M.and(M.string(), M.not('')),
  survey_id: M.and(M.string(), M.not('')),
  participants_limit: M.and(M.number(), M.gte(1)),
  reward_denom: M.and(M.string(), M.not('')),
  reward_amount: M.and(M.number(), M.gte(0)),
  survey_hash: M.and(M.string(), M.not('')),
  manager_pub_key: M.and(M.string(), M.not('')),
});

export const CosmosCancelSurveyShape = M.splitRecord({
  signature: M.and(M.string(), M.not('')),
  token: M.and(M.string(), M.not('')),
  time_to_expire: M.number(),
  survey_id: M.and(M.string(), M.not('')),
  manager_pub_key: M.and(M.string(), M.not('')),
});

export const CosmosPayRewardsShape = M.splitRecord({
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
  msg: M.or(
    M.splitRecord({ create_survey: CosmosCreateSurveyShape }),
    M.splitRecord({ cancel_survey: CosmosCancelSurveyShape }),
    M.splitRecord({ pay_rewards: CosmosPayRewardsShape }),
  ),
});

export const MessageShape = M.splitRecord(
  {
    destinationChain: M.and(M.string(), M.not('')),
    chainType: M.or('evm', 'cosmos'),
    type: M.or(1, 2, 3),
    amountForChain: M.string(),
    payload: M.or(EvmPayloadShape, CosmosPayloadShape),
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

/** @type {TypedPattern<RemoteChannelInfo>} */
export const RemoteChannelInfoShape = {
  localDenom: M.string(),
  remoteChainInfo: ChainInfoShape,
  transferChannel: M.any(),
  remoteDenom: M.string(),
};

harden(RemoteChannelInfoShape);

/** @type {TypedPattern<EVMContractAddresses>} */
const EVMContractAddressesShape = M.splitRecord({
  quizzler: M.string(),
});

/** @type {TypedPattern<CosmosContractAddresses>}*/
const CosmosContractAddressesShape = M.splitRecord({
  quizzler: M.string(),
});

/** @type {TypedPattern<AccountTapState>} */
export const AccountKitStateShape = {
  localChainAddress: CosmosChainAddressShape,
  localChainId: M.string(),
  localAccount: M.remotable('LocalAccount'),
  assets: M.any(),
  transferChannels: M.any(),
  chainIds: M.any(),
  contracts: M.any(),
};
harden(AccountKitStateShape);

/** @type {TypedPattern<GMPAddresses>} */
const GmpAddressesShape = M.splitRecord({
  AXELAR_GMP: M.string(),
  AXELAR_GAS: M.string(),
});

/** @type {TypedPattern<QstnPrivateArgs>} */
export const QstnPrivateArgsShape = {
  .../** @type {CopyRecord} */ (OrchestrationPowersShape),
  marshaller: M.remotable('marshaller'),
  storageNode: M.remotable('storageNode'),
  chainInfo: M.and(
    M.recordOf(M.string(), ChainInfoShape),
    M.splitRecord({
      agoric: M.any(),
      neutron: M.any(),
      osmosis: M.any(),
    }),
  ),
  assetInfo: M.arrayOf([M.string(), DenomDetailShape]),
  chainIds: M.splitRecord({
    ...fromEntries(keys(EVM_CHAINS).map(chain => [chain, M.string()])),
    ...fromEntries(keys(COSMOS_CHAINS).map(chain => [chain, M.string()])),
  }),
  contracts: M.splitRecord({
    ...fromEntries(
      keys(EVM_CHAINS).map(chain => [chain, EVMContractAddressesShape]),
    ),
    ...fromEntries(
      keys(COSMOS_CHAINS).map(chain => [chain, CosmosContractAddressesShape]),
    ),
  }),
  gmpAddresses: GmpAddressesShape,
};
