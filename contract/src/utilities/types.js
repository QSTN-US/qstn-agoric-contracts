import '@agoric/governance/src/types-ambient';
import '@agoric/vats/src/core/types';
import '@agoric/ertp/exported';
import '@agoric/zoe/exported';

import '@agoric/vats/src/types.js';

/**
 * @import {axelarGmpMessageType} from '../utils/gmp.js';
 * @import {COSMOS_CHAINS, EVM_CHAINS, ActiveChainType} from './chains.js';
 * @import {ChainInfo} from "@agoric/orchestration/src/orchestration-api.js"
 * @import {AdminFacet} from '@agoric/zoe/src/zoeService/utils';
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
 *   remoteChainInfo: ChainInfo;
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
 * @typedef {object} QSTNKit
 * @property {string} label
 * @property {Instance} qstn
 * @property {Instance} qstnGovernor
 * @property {Awaited<ReturnType<Awaited<ReturnType<import('../src/archive/qstn.router.governance.js')['start']>>['creatorFacet']['getLimitedCreatorFacet']>>} psmCreatorFacet
 * @property {GovernorCreatorFacet<import('../src/archive/qstn.router.governance.js')['start']>} qstnGovernorCreatorFacet
 * @property {AdminFacet} qstnAdminFacet
 */

export {};
