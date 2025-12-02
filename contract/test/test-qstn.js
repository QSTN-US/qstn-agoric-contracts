// @ts-check
import { test as anyTest } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { createRequire } from 'node:module';
import { E } from '@endo/far';
import { extractPowers } from '@agoric/vats/src/core/utils.js';

import { mockBootstrapPowers } from './utils/boot-tools.js';
import {
  installQstnContract,
  permit,
  startQstnContract,
  startQstnCharter,
} from '../src/proposals/qstn.proposal.js';
import { getBundleId, makeBundleCacheContext } from '../tools/bundle-tools.js';
import {
  installPuppetGovernance,
  mockElectorate,
  assets as govAssets,
} from './lib-gov-test/puppet-gov.js';
import { getBuildOpts } from '../tools/qstn-builder.js';

/**
 * @import {MockWallet} from './utils/wallet-tools.js';
 * @import {TestFn} from 'ava';
 */

/** @typedef {MockWallet} MockWallet */

/**
 * @typedef {{
 *   getExitMessage: () => any;
 *   getHasExited: () => boolean;
 *   getExitWithFailure: () => any;
 *   installBundle: (id: any, bundle: any) => any;
 *   installNamedBundle: (name: any, id: any, bundle: any) => any;
 *   getCriticalVatKey: () => {};
 *   getVatPowers: () => { D: (bcap: any) => { getBundle: () => any } };
 * }} FakeVatAdminState
 */

/**
 * @typedef {Awaited<ReturnType<makeTestContext>>} TestContext
 */
const test = /** @type {TestFn<TestContext>}} */ (anyTest);

const nodeRequire = createRequire(import.meta.url);

const contractName = 'qstn';
const assets = {
  [contractName]: nodeRequire.resolve(`../src/${contractName}.contract.js`),
};

const makeTestContext = async t => {
  const bc = await makeBundleCacheContext(t);
  t.log('bootstrap');
  const { powers, vatAdminState } = await mockBootstrapPowers(t.log);

  const { zoe } = powers.consume;
  for await (const [name, asset] of Object.entries({
    econCommitteeCharter: govAssets.committeeCharter,
  })) {
    powers.installation.produce[name].resolve(
      E(zoe).install(await bc.bundleCache.load(asset)),
    );
  }

  return { ...bc, powers, vatAdminState };
};

test.before(async t => (t.context = await makeTestContext(t)));

test.serial('install bundle; make zoe Installation', async t => {
  const { bundleCache, powers, vatAdminState } = t.context;

  const bundle = await bundleCache.load(assets.qstn, contractName);
  const bundleID = getBundleId(bundle);
  t.log('publish bundle', bundleID.slice(0, 8));
  vatAdminState.installBundle(bundleID, bundle);
  t.log('install contract');
  const config = { options: { [contractName]: { bundleID } } };
  const installation = await installQstnContract(powers, config);
  t.log(installation);
  t.is(typeof installation, 'object');
});

test.serial('install puppet governor; mock getPoserInvitation', async t => {
  const { bundleCache, powers } = t.context;
  const { zoe } = powers.consume;
  await installPuppetGovernance(zoe, powers.installation.produce, bundleCache);

  powers.produce[`${contractName}CommitteeKit`].resolve(
    mockElectorate(zoe, bundleCache),
  );

  const invitation = await E(
    E.get(powers.consume[`${contractName}CommitteeKit`]).creatorFacet,
  ).getPoserInvitation();
  t.log(invitation);
  t.is(typeof invitation, 'object');
});

test.serial('start contract', async t => {
  t.log('install, start contract');
  const { powers } = t.context;
  t.log('start contract, checking permit');
  const permittedPowers = extractPowers(permit, powers);

  const buildOpts = await getBuildOpts('bootstrap', [
    'axelar:connection-7:channel-6:uaxl',
    'peer=osmosis:connection-6:channel-5:uosmo',
    'neutron:connection-9:channel-7:untrn',
  ]);

  const config = {
    options: {
      [`${contractName}Committee`]: {
        voterAddresses: {},
      },
      qstn: buildOpts,
    },
  };

  await Promise.all([
    startQstnCharter(permittedPowers, config),
    startQstnContract(permittedPowers, config),
  ]);

  const instance = await powers.instance.consume[contractName];
  t.log(instance);
  t.is(typeof instance, 'object');
});
