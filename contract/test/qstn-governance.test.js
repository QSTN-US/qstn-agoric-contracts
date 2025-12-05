import { test as anyTest } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { createRequire } from 'node:module';
import { prepareVowTools } from '@agoric/vow/vat.js';

import { NonNullish } from '../src/utilities/objectTools.js';
import { seatLike } from './utils/wallet-tools.js';
import { INVITATION_MAKERS_DESC } from '../src/utilities/start-governed-contract.js';
import { makeWalletFactoryContext } from './utilities/walletFactory.js';
import { makeBundleCacheContext } from '../tools/bundle-tools.js';
import { mockBootstrapPowers } from './utils/boot-tools.js';
import { installGovContracts } from './lib-gov-test/puppet-gov.js';

/**
 * @import {QuestionDetails} from '@agoric/governance/src/types.js';
 * @import {OfferSpec} from '@agoric/smart-wallet/src/offers.js';
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
 * @param {{ instance: BootstrapPowers['instance']['consume']}} wellKnown
 */
export const makeVoter = (t, wallet, wellKnown) => {
  let charterAcceptOfferId;
  let committeeOfferId;

  const doOffer = async offer => {
    t.snapshot(offer, `voter offer: ${offer.id}`);
    const updates = wallet.executeOffer(offer);
    const seat = seatLike(updates);
    const result = await seat.getOfferResult();
    await seatLike(updates).getPayoutAmounts();
    return result;
  };

  const acceptInvitation = async (offerId, { instance, description }) => {
    /** @type {OfferSpec} */
    const offer = {
      id: offerId,
      invitationSpec: {
        source: 'purse',
        description,
        instance,
      },
      proposal: {},
    };
    const result = await doOffer(offer);
    charterAcceptOfferId = offerId;
    return result;
  };

  const acceptCharterInvitation = async offerId => {
    const instance = await wellKnown.instance[`${contractName}Charter`];
    const description = INVITATION_MAKERS_DESC;
    const result = await acceptInvitation(offerId, { instance, description });
    charterAcceptOfferId = offerId;
    return result;
  };

  const acceptCommitteeInvitation = async (offerId, index) => {
    const instance = await wellKnown.instance[`${contractName}Committee`];
    const description = `Voter${index}`;
    const result = await acceptInvitation(offerId, { instance, description });
    committeeOfferId = offerId;
    return result;
  };

  const putQuestion = async (offerId, filter, deadline) => {
    const instance = await wellKnown.instance[contractName];

    /** @type {OfferSpec} */
    const offer = {
      id: offerId,
      invitationSpec: {
        source: 'continuing',
        previousOffer: NonNullish(charterAcceptOfferId),
        invitationMakerName: 'VoteOnPauseOffers',
        invitationArgs: harden([instance, filter, deadline]),
      },
      proposal: {},
    };
    return doOffer(offer);
  };

  /**
   * @param {string | number} offerId
   * @param {QuestionDetails} details - TODO: get from vstorage
   * @param {number} position
   */
  const vote = async (offerId, details, position) => {
    const chosenPositions = [details.positions[position]];

    /** @type {OfferSpec} */
    const offer = {
      id: offerId,
      invitationSpec: {
        source: 'continuing',
        previousOffer: NonNullish(committeeOfferId),
        invitationMakerName: 'makeVoteInvitation',
        invitationArgs: harden([chosenPositions, details.questionHandle]),
      },
      proposal: {},
    };
    return doOffer(offer);
  };

  return harden({
    acceptCharterInvitation,
    acceptCommitteeInvitation,
    putQuestion,
    vote,
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
