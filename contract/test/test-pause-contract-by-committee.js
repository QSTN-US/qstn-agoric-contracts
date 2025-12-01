// @ts-check
import { test as anyTest } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { createRequire } from 'node:module';
import { E } from '@endo/far';

import { extractPowers } from '@agoric/vats/src/core/utils.js';

import { main, permit } from '../src/proposals/qstn.proposal.js';

import { mockBootstrapPowers } from './utilities/boot-tools.js';
import { makeBundleCacheContext } from '../tools/bundle-tools.js';
import { NonNullish } from '../src/utilities/objectTools.js';
import { mockWalletFactory, seatLike } from './utilities/wallet-tools.js';
import { INVITATION_MAKERS_DESC } from '../src/utilities/start-governed-contract.js';
import { installGovContracts } from './lib-gov-test/puppet-gov.js';

/**
 * @import {QuestionDetails} from '@agoric/governance/src/types.js';
 * @import {OfferSpec} from '@agoric/smart-wallet/src/offers.js';
 * @import {MockWallet} from './utilities/wallet-tools.js';
 * @import {ExecutionContext, TestFn} from 'ava';
 */

/**
 * @typedef {Awaited<ReturnType<makeTestContext>>} TestContext
 */

const test = /** @type {TestFn<TestContext>}} */ (anyTest);

const nodeRequire = createRequire(import.meta.url);

const contractName = 'qstn';
export const assets = {
  [contractName]: nodeRequire.resolve(`../src/${contractName}.contract.js`),
};

const makeTestContext = async t => {
  const bc = await makeBundleCacheContext(t);
  t.log('bootstrap');
  const { powers, vatAdminState } = await mockBootstrapPowers(t.log);

  await installGovContracts(t, powers, bc.bundleCache);

  return { ...bc, powers, vatAdminState };
};

test.before(async t => (t.context = await makeTestContext(t)));

/**
 * @param {ExecutionContext} t
 * @param {MockWallet} wallet
 * @param {{ instance: BootstrapPowers['instance']['consume']}} wellKnown
 */
const makeVoter = (t, wallet, wellKnown) => {
  let charterAcceptOfferId;
  let committeeOfferId;

  const doOffer = async offer => {
    t.snapshot(offer, `voter offer: ${offer.id}`);
    const updates = wallet.offers.executeOffer(offer);
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

const voterAddresses = {
  mem1: 'agoric18jr9nlvp300feu726y3v4n07ykfjwup3twnlyn',
};

test.serial('provision Voter1 account', async t => {
  const { powers } = t.context;
  const { zoe, namesByAddressAdmin } = powers.consume;

  await null;
  const walletFactory = mockWalletFactory(
    { zoe, namesByAddressAdmin },
    { Invitation: await powers.issuer.consume.Invitation },
  );

  const victor = makeVoter(
    t,
    await walletFactory.makeSmartWallet(voterAddresses.mem1),
    { instance: powers.instance.consume },
  );
  t.pass();

  Object.assign(t.context.shared, { victor });
});

test.serial('install bundle', async t => {
  const { bundleCache, vatAdminState } = t.context;
  const bundle = await bundleCache.load(assets.qstn, contractName);
  const bundleID = `b1-${bundle.endoZipBase64Sha512}`;
  t.log('publish bundle', bundleID.slice(0, 8));
  vatAdminState.installBundle(bundleID, bundle);
  Object.assign(t.context.shared, { bundleID });
  t.pass();
});

test.serial('core eval: start qstn committee, charter, contract', async t => {
  const { powers, shared } = t.context;

  const permittedPowers = extractPowers(permit, powers);
  const { bundleID } = shared;
  const config = {
    options: {
      [contractName]: { bundleID },
      [`${contractName}Committee`]: {
        voterAddresses,
      },
    },
  };

  t.log('run core eval', config);

  const { installation, committeeFacets } = await main(permittedPowers, config);

  const kit = await powers.consume[`${contractName}Kit`];
  t.log(`${contractName}Kit`, 'facets', Object.keys(kit));
  t.is(typeof kit.governorCreatorFacet, 'object');
  t.is(typeof committeeFacets.instance, 'object');
  t.is(typeof installation, 'object');
  t.is(typeof (await powers.instance.consume[contractName]), 'object');
  t.is(
    typeof (await powers.instance.consume[`${contractName}Committee`]),
    'object',
  );
  t.is(
    typeof (await powers.instance.consume[`${contractName}Charter`]),
    'object',
  );
});

test.serial('Voter0 accepts charter, committee invitations', async t => {
  /** @type {ReturnType<typeof makeVoter>} */
  const victor = t.context.shared.victor;
  await victor.acceptCommitteeInvitation('v0-join-committee', 0);
  await victor.acceptCharterInvitation('v0-accept-charter');
  t.pass();
});

test.serial('vote to pause contract', async t => {
  const { powers } = t.context;
  const { zoe } = powers.consume;

  /** @type {ReturnType<typeof makeVoter>} */
  const victor = t.context.shared.victor;
  const qstnPowers = powers;

  // const qstnPub = E(zoe).getPublicFacet(
  //   qstnPowers.instance.consume[contractName],
  // );

  const cmtePub = E(zoe).getPublicFacet(
    qstnPowers.instance.consume[`${contractName}Committee`],
  );

  const deadline = BigInt(new Date(2025, 6, 1, 9, 10).valueOf() / 1000);
  const result = await victor.putQuestion(
    'pauseContract',
    ['makeSendTransactionInvitation'],
    deadline,
  );

  t.log('question is posed', result);

  // TODO: .latestQuestion from vstorage
  const qSub = await E(cmtePub).getQuestionSubscriber();
  const { value: details } = await E(qSub).getUpdateSince();
  // t.is(details.electionType, 'param_change');
  const voteResult = await victor.vote('voteToPauseContract', details, 0);
  t.log('victor voted:', voteResult);

  const timer = details.closingRule.timer;
  await E(timer).tickN(11);

  // TODO: .latestOutcome from vstorage
  const counterHandle = await E(
    E(cmtePub).getQuestion(details.questionHandle),
  ).getVoteCounter();
  const counterPub = await E(zoe).getPublicFacet(counterHandle);
  const outcome = await E(counterPub).getOutcome();

  t.log(outcome);
});
