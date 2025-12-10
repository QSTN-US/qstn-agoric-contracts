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
import { ENABLED_EVM_CHAINS, ENABLED_COSMOS_CHAINS } from './chain-config.js';

/**
 * @import {RemoteChannelInfo, AccountTapState} from './types';
 * @import {CopyRecord} from '@endo/pass-style';
 * @import {TypedPattern} from '@agoric/internal';
 * @import {CosmosContractAddresses, EVMContractAddresses, GMPAddresses, QstnPrivateArgs} from './types.js';
 */

const { fromEntries, keys } = Object;

/**
 * Non-empty string pattern
 * Used for addresses, chain IDs, and other string fields requiring non-empty values
 * Runtime validation provides format-specific checks (e.g., EVM hex format, bech32)
 */
const NonEmptyStringShape = M.and(M.string(), M.not(''));

export const EvmCreateSurveyShape = M.splitRecord({
  signature: NonEmptyStringShape,
  token: NonEmptyStringShape,
  timeToExpire: M.and(M.number(), M.gte(1)),
  owner: NonEmptyStringShape,
  surveyId: NonEmptyStringShape,
  participantsLimit: M.and(M.number(), M.gte(1)),
  rewardAmount: NonEmptyStringShape,
  surveyHash: NonEmptyStringShape,
});

export const EvmCancelSurveyShape = M.splitRecord({
  signature: NonEmptyStringShape,
  token: NonEmptyStringShape,
  timeToExpire: M.and(M.number(), M.gte(1)),
  surveyId: NonEmptyStringShape,
});

export const EvmPayRewardsSurveyShape = M.splitRecord({
  signature: NonEmptyStringShape,
  token: NonEmptyStringShape,
  timeToExpire: M.and(M.number(), M.gte(1)),
  surveyIds: M.arrayOf(NonEmptyStringShape, { arrayLengthLimit: 100 }),
  participants: M.arrayOf(NonEmptyStringShape, { arrayLengthLimit: 100 }),
});

export const EvmPayloadShape = M.splitRecord({
  msg: M.or(
    M.splitRecord({ create_survey: EvmCreateSurveyShape }),
    M.splitRecord({ cancel_survey: EvmCancelSurveyShape }),
    M.splitRecord({ pay_rewards: EvmPayRewardsSurveyShape }),
  ),
});

export const CosmosCreateSurveyShape = M.splitRecord({
  signature: NonEmptyStringShape,
  token: NonEmptyStringShape,
  time_to_expire: M.number(),
  owner: NonEmptyStringShape,
  survey_id: NonEmptyStringShape,
  participants_limit: M.and(M.number(), M.gte(1)),
  reward_denom: NonEmptyStringShape,
  reward_amount: M.and(M.number(), M.gte(0)),
  survey_hash: NonEmptyStringShape,
  manager_pub_key: NonEmptyStringShape,
});

export const CosmosCancelSurveyShape = M.splitRecord({
  signature: NonEmptyStringShape,
  token: NonEmptyStringShape,
  time_to_expire: M.number(),
  survey_id: NonEmptyStringShape,
  manager_pub_key: NonEmptyStringShape,
});

export const CosmosPayRewardsShape = M.splitRecord({
  signature: NonEmptyStringShape,
  token: NonEmptyStringShape,
  time_to_expire: M.number(),
  survey_ids: M.arrayOf(NonEmptyStringShape, { arrayLengthLimit: 100 }),
  participants: M.arrayOf(NonEmptyStringShape, { arrayLengthLimit: 100 }),
  manager_pub_key: NonEmptyStringShape,
});

export const CosmosPayloadShape = M.splitRecord({
  msg: M.or(
    M.splitRecord({ create_survey: CosmosCreateSurveyShape }),
    M.splitRecord({ cancel_survey: CosmosCancelSurveyShape }),
    M.splitRecord({ pay_rewards: CosmosPayRewardsShape }),
  ),
});

/**
 * Dynamically generate ValidEvms pattern from enabled chains
 * If only one chain is enabled, M.or needs special handling
 */
const enabledEvmChainNames = Object.keys(ENABLED_EVM_CHAINS);
const ValidEvms = M.or(...enabledEvmChainNames);

/**
 * Dynamically generate ValidCosmos pattern from enabled chains
 */
const enabledCosmosChainNames = Object.keys(ENABLED_COSMOS_CHAINS);
const ValidCosmos = M.or(...enabledCosmosChainNames);

export const EvmMessageShape = M.splitRecord({
  destinationChain: ValidEvms,
  chainType: 'evm',
  type: M.or(1, 2, 3),
  amountForChain: M.string(),
  payload: EvmPayloadShape,
  amountFee: M.string(),
});

export const CosmosMessageShape = M.splitRecord({
  destinationChain: ValidCosmos,
  chainType: 'cosmos',
  type: M.or(1, 2, 3),
  amountForChain: M.string(),
  payload: CosmosPayloadShape,
  amountFee: M.string(),
});

export const MessageShape = M.or(EvmMessageShape, CosmosMessageShape);

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
  quizzler: NonEmptyStringShape,
});

/** @type {TypedPattern<CosmosContractAddresses>}*/
const CosmosContractAddressesShape = M.splitRecord({
  quizzler: NonEmptyStringShape,
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
  AXELAR_GMP: NonEmptyStringShape,
  AXELAR_GAS: NonEmptyStringShape,
});

/** @type {TypedPattern<QstnPrivateArgs>} */
export const QstnPrivateArgsShape = {
  .../** @type {CopyRecord} */ (OrchestrationPowersShape),
  marshaller: M.remotable('marshaller'),
  storageNode: M.remotable('storageNode'),
  chainInfo: M.splitRecord({
    ...fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [chain, ChainInfoShape]),
    ),
    ...fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [
        chain.toLowerCase(),
        ChainInfoShape,
      ]),
    ),
  }),
  assetInfo: M.arrayOf([NonEmptyStringShape, DenomDetailShape]),
  chainIds: M.splitRecord({
    ...fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [chain, NonEmptyStringShape]),
    ),
    ...fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [chain, NonEmptyStringShape]),
    ),
  }),
  contracts: M.splitRecord({
    ...fromEntries(
      keys(ENABLED_EVM_CHAINS).map(chain => [chain, EVMContractAddressesShape]),
    ),
    ...fromEntries(
      keys(ENABLED_COSMOS_CHAINS).map(chain => [
        chain,
        CosmosContractAddressesShape,
      ]),
    ),
  }),
  gmpAddresses: GmpAddressesShape,
};

// export const InvitationProposalShape = M.splitRecord(
//   {give: {Deposit: }}
// )

/**
 * @param {Brand<'nat'>} brand must be a 'nat' brand, not checked
 * @param {import('@agoric/ertp').NatValue} [min] optional minimum value
 */
export const makeNatAmountShape = (brand, min) =>
  harden({ brand, value: min ? M.and(M.nat(), M.gte(min)) : M.nat() });

/**
 *
 * @param {Brand<'nat'>} bld
 */
export const makeProposalShape = bld => {
  const $Shape = makeNatAmountShape(bld);

  return M.splitRecord(
    { want: {}, give: M.splitRecord({}, { Deposit: $Shape }, {}) },
    { exit: M.any() },
    {},
  );
};
