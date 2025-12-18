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

/** Transfer channel shape for IBC channel info */
const TransferChannelShape = M.splitRecord({
  portId: M.string(),
  channelId: M.string(), // channel-${number} format
  counterPartyPortId: M.string(),
  counterPartyChannelId: M.string(), // channel-${number} format
  ordering: M.scalar(), // Order enum
  state: M.scalar(), // State enum
  version: M.string(),
});

/** @type {TypedPattern<RemoteChannelInfo>} */
export const RemoteChannelInfoShape = {
  localDenom: M.string(),
  remoteChainInfo: ChainInfoShape,
  transferChannel: TransferChannelShape,
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

/** @type {TypedPattern<GMPAddresses>} */
const GmpAddressesShape = M.splitRecord({
  AXELAR_GMP: NonEmptyStringShape,
  AXELAR_GAS: NonEmptyStringShape,
});

/** ChainIds shape mapping chain names to chain IDs */
const ChainIdsShape = M.splitRecord({
  ...fromEntries(
    keys(ENABLED_EVM_CHAINS).map(chain => [chain, NonEmptyStringShape]),
  ),
  ...fromEntries(
    keys(ENABLED_COSMOS_CHAINS).map(chain => [chain, NonEmptyStringShape]),
  ),
});

/** Contracts shape mapping chain names to contract addresses */
const ContractsShape = M.splitRecord({
  ...fromEntries(
    keys(ENABLED_EVM_CHAINS).map(chain => [chain, EVMContractAddressesShape]),
  ),
  ...fromEntries(
    keys(ENABLED_COSMOS_CHAINS).map(chain => [
      chain,
      CosmosContractAddressesShape,
    ]),
  ),
});

/** TransferChannels shape for IBC transfer channel info */
const TransferChannelsShape = M.splitRecord(
  {
    Osmosis: RemoteChannelInfoShape,
    Neutron: RemoteChannelInfoShape,
  },
  {
    Axelar: RemoteChannelInfoShape,
  },
);

/** @type {TypedPattern<AccountTapState>} */
export const AccountKitStateShape = {
  localChainAddress: CosmosChainAddressShape,
  localChainId: M.string(),
  localAccount: M.remotable('LocalAccount'),
  assets: M.any(),
  transferChannels: TransferChannelsShape,
  chainIds: ChainIdsShape,
  contracts: ContractsShape,
  gmpAddresses: GmpAddressesShape,
};
harden(AccountKitStateShape);

/** @type {TypedPattern<QstnPrivateArgs>} */
export const QstnPrivateArgsShape = {
  .../** @type {CopyRecord} */ (OrchestrationPowersShape),
  marshaller: M.remotable('marshaller'),
  storageNode: M.remotable('storageNode'),
  chainInfo: M.splitRecord(
    {
      agoric: ChainInfoShape,
      ...fromEntries(
        keys(ENABLED_COSMOS_CHAINS).map(chain => [
          chain.toLowerCase(),
          ChainInfoShape,
        ]),
      ),
    },
    {
      axelar: ChainInfoShape,
    },
  ),
  assetInfo: M.arrayOf([NonEmptyStringShape, DenomDetailShape]),
  chainIds: ChainIdsShape,
  contracts: ContractsShape,
  gmpAddresses: GmpAddressesShape,
};

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
  const $Shape = makeNatAmountShape(bld, 200000n);

  return M.splitRecord(
    { want: {}, give: { Deposit: $Shape } },
    { exit: M.any() },
    {},
  );
};
