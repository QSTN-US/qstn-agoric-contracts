import { test as anyTest } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { createRequire } from 'node:module';
import { prepareVowTools } from '@agoric/vow/vat.js';
import { seatLike } from './utils/wallet-tools.js';
import { makeWalletFactoryContext } from './utilities/walletFactory.js';
import { makeBundleCacheContext } from '../tools/bundle-tools.js';
import { mockBootstrapPowers } from './utils/boot-tools.js';
import { installGovContracts } from './lib-gov-test/puppet-gov.js';

/**
 * @import {ExecutionContext, TestFn} from 'ava';
 */

/**
 * @typedef {Awaited<ReturnType<makeTestContext>>} TestContext
 */

const test = /** @type {TestFn<TestContext>}} */ anyTest;

const nodeRequire = createRequire(import.meta.url);

const contractName = 'qstn';
export const assets = {
  [contractName]: nodeRequire.resolve(`../src/${contractName}.contract.js`),
};

const address = 'agoric18jr9nlvp300feu726y3v4n07ykfjwup3twnlyn';

const makeTestContext = async t => {
  const ctx = await makeWalletFactoryContext(
    t,
    '@agoric/vm-config/decentral-itest-orchestration-config.json',
  );

  const wallet = await ctx.walletFactoryDriver.provideSmartWallet(address);

  t.log('bootstrap');
  const bc = await makeBundleCacheContext(t);

  const { powers, vatAdminState } = await mockBootstrapPowers(t.log);

  await installGovContracts(t, powers, bc.bundleCache);

  const vowTools = prepareVowTools(powers.zone);

  return {
    ...ctx,
    wallet,
    ...bc,
    vowTools,
    powers,
    vatAdminState,
    bootsrapSPace: powers.consume,
  };
};

test.before(async t => (t.context = await makeTestContext(t)));

/**
 * @param {ExecutionContext} t
 * @param {any} wallet
 */
export const makeVoter = (t, wallet) => {
  const doOffer = async offer => {
    t.snapshot(offer, `voter offer: ${offer.id}`);
    const updates = wallet.executeOffer(offer);
    const seat = seatLike(updates);
    const result = await seat.getOfferResult();
    await seatLike(updates).getPayoutAmounts();
    return result;
  };

  return harden({
    doOffer,
  });
};

export const voterAddresses = {
  mem1: address,
};

test.before(async t => {
  t.context = await makeTestContext(t);
  // const { evalProposal, buildProposal } = t.context;

  // await evalProposal(
  //   buildProposal('../src/init-contract.js', [
  //     '--net',
  //     'bootstrap',
  //     '--peer',
  //     'axelar:connection-0:channel-0:uaxl',
  //   ]),
  // );
});

test.beforeEach(t => {
  t.context.storage.data.delete('published.qstn.log');
});
