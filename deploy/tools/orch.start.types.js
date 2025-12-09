/**
 *
 * @import {BootstrapManifest} from '@agoric/vats/src/core/lib-boot.js';
 * @import {OrchestrationPowers} from '@agoric/orchestration';
 * @import {Remote} from '@agoric/internal';
 * @import {Marshaller, StorageNode} from '@agoric/internal/src/lib-chainStorage.js';
 * @import {ContractStartFunction} from '@agoric/zoe/src/zoeService/utils.js';
 * @import {CopyRecord} from '@endo/pass-style';
 * @import {Installation, Instance} from '@agoric/zoe';
 * @import {Issuer, Brand} from '@agoric/ertp';
 *
 */

/**
 * Generic permit constraints
 *
 * @typedef {BootstrapManifest & {
 *   issuer: BootstrapManifest }
 * & {
 *   brand: BootstrapManifest;
 * }} PermitG
 */

/**
 * @typedef {OrchestrationPowers & {
 *   storageNode: Remote<StorageNode>;
 * }} OrchestrationPowersWithStorage
 */

/**
 * @template {ContractStartFunction} SF
 * @template {CopyRecord} CFG
 * @typedef {(
 *   op: OrchestrationPowersWithStorage,
 *   m: Remote<Marshaller>,
 *   cfg: CFG
 * ) => Promise<Parameters<SF>[1]>} MakePrivateArgs
 */

/**
 * @template {ContractStartFunction} SF
 * @typedef {StartedInstanceKit<SF> & {
 *   label: string;
 *   privateArgs: Parameters<SF>[1];
 * }} UpgradeKit
 */

/**
 * @typedef {{
 *   consume: { chainStorage: Promise<Remote<StorageNode>> };
 * }} ChainStoragePowers
 */

/**
 * @template {string} CN
 * @template {ContractStartFunction} SF
 * @template {PermitG} P
 * @typedef {PromiseSpaceOf<Record<`${CN}Kit`, UpgradeKit<SF>>> & {
 *   installation: PromiseSpaceOf<Record<CN, Installation<SF>>>;
 *   instance: PromiseSpaceOf<Record<CN, Instance<SF>>>;
 *   issuer: PromiseSpaceOf<Record<keyof P['issuer']['produce'], Issuer>>;
 *   brand: PromiseSpaceOf<Record<keyof P['brand']['produce'], Brand>>;
 * } & ChainStoragePowers} CorePowersG
 */

export {};
