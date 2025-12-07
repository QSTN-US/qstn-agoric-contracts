import '@agoric/ertp/exported';
import '@agoric/zoe/exported';

import '@agoric/vats/src/types.js';

/**
 * @import {axelarGmpMessageType} from './gmp.js';
 * @import {COSMOS_CHAINS, EVM_CHAINS} from './chains.js';
 * @import {Remote} from '@agoric/internal';
 * @import {Marshaller, StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {
 *  ChainInfo,
 *  CosmosChainInfo,
 *  Denom,
 *  DenomDetail,
 *  Bech32Address,
 *  CosmosChainAddress,
 *  OrchestrationPowers,
 *  OrchestrationAccount,
 *  IBCConnectionInfo
 * } from "@agoric/orchestration"
 * @import {AssetInfo} from '@agoric/vats/src/vat-bank.js';
 */

/**
 * @typedef {(typeof axelarGmpMessageType)[keyof typeof axelarGmpMessageType]} GMPMessageType
 */

/**
 * @typedef {keyof typeof EVM_CHAINS} SupportedEVMChains
 */

/**
 * @typedef {keyof typeof COSMOS_CHAINS} SupportedCosmosChains
 */

/**
 * @typedef {{
 *   type: GMPMessageType;
 *   chainType: 'evm';
 *   payload: EvmPayload;
 *   destinationChain: SupportedEVMChains;
 *   amountFee: string;
 *   amountForChain: string;
 * } | {
 *   type: GMPMessageType;
 *   chainType: 'cosmos';
 *   payload: CosmosPayload;
 *   destinationChain: SupportedCosmosChains;
 *   amountFee: string;
 *   amountForChain: string;
 * }} CrossChainContractMessage
 */

/**
 * @typedef {IBCConnectionInfo['transferChannel']} TransferChannel
 */

/**
 * @typedef {{
 *   localDenom: string;
 *   remoteChainInfo: CosmosChainInfo;
 *   transferChannel: TransferChannel;
 *   remoteDenom: string;
 * }} RemoteChannelInfo
 */

/**
 * @typedef {OrchestrationPowers & {
 *   assetInfo: [Denom, DenomDetail & { brandKey?: string }][];
 *   chainInfo: Record<string, ChainInfo>;
 *   marshaller: Remote<Marshaller>;
 *   storageNode: Remote<StorageNode>;
 *   chainIds: ChainIds;
 *   contracts: ContractMaps;
 *   gmpAddresses: GMPAddresses;
 * }} QstnPrivateArgs
 */

/**
 * @typedef {{
 *   amount: string;
 *   recipient: Bech32Address;
 * }} AxelarFeeObject
 */

/**
 * @typedef {{
 *   destination_chain: string;
 *   destination_address: string;
 *   payload: number[] | null;
 *   type: GMPMessageType;
 *   fee?: AxelarFeeObject;
 * }} AxelarGmpOutgoingMemo
 */

/**
 * @typedef {{
 *   Osmosis: RemoteChannelInfo;
 *   Neutron: RemoteChannelInfo;
 *   Axelar: RemoteChannelInfo | undefined;
 * }} TransferChannels
 */

/**
 * @typedef {{
 *   localAccount: OrchestrationAccount<{chainId: 'agoric'}>;
 *   localChainId: string;
 *   localChainAddress: CosmosChainAddress;
 *   assets: AssetInfo[];
 *   transferChannels: TransferChannels;
 *   gmpAddresses: GMPAddresses;
 *   contracts: ContractMaps;
 *   chainIds: ChainIds;
 * }} AccountTapState
 */

/**
 * @typedef {`0x${string}`} HexAddress
 */

/**
 * @typedef {Record<string, HexAddress>} EvmAddresses
 */

/**
 * @typedef {Record<string, Bech32Address>} CosmosAddresses
 */

/**
 * @typedef {{
 *   mainnet: EvmAddresses;
 *   testnet: EvmAddresses;
 * }} EvmAddressesMap
 */

/**
 * @typedef {{
 *   mainnet: CosmosAddresses;
 *   testnet: CosmosAddresses;
 * }} CosmosAddressesMap
 */

/**
 * @typedef {{
 *   quizzler: HexAddress;
 * }} EVMContractAddresses
 */

/**
 * @typedef {{
 *   [chain in SupportedEVMChains]: EVMContractAddresses;
 * }} EVMContractAddressesMap
 */

/**
 * @typedef {{
 *   quizzler: Bech32Address;
 * }} CosmosContractAddresses
 */

/**
 * @typedef {{
 *   [chain in SupportedCosmosChains]: CosmosContractAddresses;
 * }} CosmosContractAddressesMap
 */

/**
 * @typedef {{
 *   axelarId: string;
 *   contracts: EVMContractAddresses;
 * }} AxelarChainConfig
 */

/**
 * @typedef {Record<SupportedEVMChains, AxelarChainConfig>} AxelarChainConfigMap
 */

/**
 * @typedef {{
 *   cosmosId: string;
 *   contracts: CosmosContractAddresses;
 * }} CosmosChainConfig
 */

/**
 * @typedef {Record<SupportedCosmosChains, CosmosChainConfig>} CosmosChainConfigMap
 */

/**
 * @typedef {{
 *   testnet: string;
 *   mainnet: string;
 * }} AxelarChainIdEntry
 */

/**
 * @typedef {{
 *   [chain in SupportedEVMChains]: string;
 * }} AxelarId
 */

/**
 * @typedef {{
 *   [chain in SupportedCosmosChains]: string;
 * }} CosmosId
 */

/**
 * @typedef {EVMContractAddressesMap & CosmosContractAddressesMap} ContractMaps
 */

/**
 * @typedef {AxelarId & CosmosId} ChainIds
 */

/**
 * @typedef {{
 *  AXELAR_GMP: Bech32Address;
 *  AXELAR_GAS: Bech32Address;
 * }} GMPAddresses
 */

/**
 * @typedef {{
 *   mainnet: GMPAddresses;
 *   testnet: GMPAddresses;
 * }} GMPAddressesMap
 */

/**
 * @typedef {{
 *   signature: HexAddress;
 *   token: HexAddress;
 *   timeToExpire: number;
 *   owner: string;
 *   surveyId: string;
 *   participantsLimit: number;
 *   rewardAmount: string;
 *   surveyHash: HexAddress;
 * }} EvmCreateSurvey
 */

/**
 * @typedef {{
 *   signature: HexAddress;
 *   token: HexAddress;
 *   timeToExpire: number;
 *   surveyId: string;
 * }} EvmCancelSurvey
 */

/**
 * @typedef {{
 *   signature: HexAddress;
 *   token: HexAddress;
 *   timeToExpire: number;
 *   surveyIds: string[];
 *   participants: string[];
 * }} EvmPayRewardsSurvey
 */

/**
 * @typedef {{
 *   msg:
 *     | { create_survey: EvmCreateSurvey }
 *     | { cancel_survey: EvmCancelSurvey }
 *     | { pay_rewards: EvmPayRewardsSurvey };
 * }} EvmPayload
 */

/**
 * @typedef {{
 *   signature: string;
 *   token: string;
 *   time_to_expire: number;
 *   owner: string;
 *   survey_id: string;
 *   participants_limit: number;
 *   reward_denom: string;
 *   reward_amount: number;
 *   survey_hash: string;
 *   manager_pub_key: string;
 * }} CosmosCreateSurvey
 */

/**
 * @typedef {{
 *   signature: string;
 *   token: string;
 *   time_to_expire: number;
 *   survey_id: string;
 *   manager_pub_key: string;
 * }} CosmosCancelSurvey
 */

/**
 * @typedef {{
 *   signature: string;
 *   token: string;
 *   time_to_expire: number;
 *   survey_ids: string[];
 *   participants: Bech32Address[];
 *   manager_pub_key: string;
 * }} CosmosPayRewards
 */

/**
 * @typedef {{
 *   msg:
 *     | { create_survey: CosmosCreateSurvey }
 *     | { cancel_survey: CosmosCancelSurvey }
 *     | { pay_rewards: CosmosPayRewards };
 * }} CosmosPayload
 */

export {};
