import '@agoric/ertp/exported';
import '@agoric/zoe/exported';

import '@agoric/vats/src/types.js';

/**
 * @import {axelarGmpMessageType} from './gmp.js';
 * @import {COSMOS_CHAINS, EVM_CHAINS, ActiveChainType} from './chains.js';
 * @import {CosmosChainInfo, Bech32Address, CosmosChainAddress, OrchestrationAccount} from "@agoric/orchestration"
 * @import {AssetInfo} from '@agoric/vats/src/vat-bank.js';
 */

/**
 * @typedef {(typeof axelarGmpMessageType)[keyof typeof axelarGmpMessageType]} GMPMessageType
 */

/**
 * @typedef {(typeof ActiveChainType)[keyof typeof ActiveChainType]} ChainType
 */

/**
 * @typedef {keyof typeof EVM_CHAINS} SupportedEVMChains
 */

/**
 * @typedef {keyof typeof COSMOS_CHAINS} SupportedCosmosChains
 */

// Contract Call should contain a list of addresses
/**
 * @typedef {object} CrossChainContractMessage
 * @property {string} destinationAddress
 * @property {GMPMessageType} type
 * @property {ChainType} chainType
 * @property {any} payload
 * @property {SupportedEVMChains | SupportedCosmosChains} destinationChain
 * @property {string} amountFee
 * @property {string} amountForChain
 *
 */

/**
 *  @typedef {{
 *   localDenom: string;
 *   remoteChainInfo: CosmosChainInfo;
 *   channelId: string;
 *   remoteDenom: string;
 * }} RemoteChannelInfo
 */

/**
 *
 * @typedef {PromiseSpaceOf<{
 *   qstnCommitteeCreatorFacet: import('@agoric/governance/src/committee.js').CommitteeElectorateCreatorFacet
 * }>
 * } QstnBootstrapSpace
 *
 */

/**
 * @typedef {{
 * amount: string;
 * recipient: Bech32Address
 * }} AxelarFeeObject
 */

/**
 * @typedef {{
 * destination_chain: string;
 * destination_address: string;
 * payload: number[] | null;
 * type: GMPMessageType
 * fee?: AxelarFeeObject
 * }} AxelarGmpOutgoingMemo
 */

/**
 * @typedef {{
 * localAccount: OrchestrationAccount<{chainId: 'agoric'}>;
 * localChainId: string;
 * localChainAddress: CosmosChainAddress,
 * assets: AssetInfo[];
 * axelarRemoteChannel: RemoteChannelInfo
 * osmosisRemoteChannel: RemoteChannelInfo
 * neutronRemoteChannel: RemoteChannelInfo
 * }} AccountTapState
 */

export {};
