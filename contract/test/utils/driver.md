/* eslint-disable jsdoc/require-param */
import { Fail } from '@endo/errors';
import { NonNullish } from '@agoric/internal';
import { Offers } from '@agoric/inter-protocol/src/clientSupport.js';
import { SECONDS_PER_MINUTE } from '@agoric/inter-protocol/src/proposals/econ-behaviors.js';
import { unmarshalFromVstorage } from '@agoric/internal/src/marshal.js';
import { slotToRemotable } from '@agoric/internal/src/storage-test-utils.js';
import { oracleBrandFeedName } from '@agoric/inter-protocol/src/proposals/utils.js';

import { boardSlottingMarshaller } from '@agoric/vats/tools/board-utils.js';

/** @import { Amount } from '@agoric/ertp'; */
/** @import { FakeStorageKit } from '@agoric/internal/src/storage-test-utils.js'; */
/** @import { AgoricNamesRemotes } from '@agoric/vats/tools/board-utils.js'; */
/** @import { CurrentWalletRecord, SmartWallet, UpdateRecord } from '@agoric/smart-wallet/src/smartWallet.js'; */
/** @import { WalletFactoryStartResult } from '@agoric/vats/src/core/startWalletFactory.js'; */
/** @import { OfferSpec } from '@agoric/smart-wallet/src/offers.js'; */
/** @import { TimerService } from '@agoric/time'; */
/** @import { OfferMaker } from '@agoric/smart-wallet/src/types.js'; */
/** @import { RunUtils } from '@agoric/swingset-vat/tools/run-utils.js'; */
/** @import { Instance, InvitationDetails } from '@agoric/zoe'; */
/** @import { SwingsetTestKit } from './support2.js'; */
/** @import { ERef } from '@endo/far'; */
/** @import { BankManager } from '@agoric/vats'; */

// XXX SwingsetTestKit would simplify this
/**
 * @param {RunUtils} runUtils
 * @param {FakeStorageKit} storage
 * @param {AgoricNamesRemotes} agoricNamesRemotes
 */
export const makeWalletFactoryDriver = async (
  runUtils,
  storage,
  agoricNamesRemotes,
) => {
  const { EV } = runUtils;

  /** @type {WalletFactoryStartResult} */
  const walletFactoryStartResult = await EV.vat('bootstrap').consumeItem(
    'walletFactoryStartResult',
  );
  /** @type {ERef<BankManager>} */
  const bankManager = await EV.vat('bootstrap').consumeItem('bankManager');
  const namesByAddressAdmin = await EV.vat('bootstrap').consumeItem(
    'namesByAddressAdmin',
  );

  const marshaller = boardSlottingMarshaller(slotToRemotable);

  /**
   * @param {string} walletAddress
   * @param {SmartWallet} walletPresence
   * @param {boolean} isNew
   */
  const makeWalletDriver = (walletAddress, walletPresence, isNew) => ({
    isNew,
    getAddress: () => walletAddress,

    /**
     * @param {OfferSpec} offer
     * @returns {Promise<void>}
     */
    executeOffer(offer) {
      const offerCapData = marshaller.toCapData(
        harden({
          method: 'executeOffer',
          offer,
        }),
      );
      return EV(walletPresence).handleBridgeAction(offerCapData, true);
    },
    /**
     * @param {OfferSpec} offer
     * @returns {Promise<void>}
     */
    sendOffer(offer) {
      const offerCapData = marshaller.toCapData(
        harden({
          method: 'executeOffer',
          offer,
        }),
      );

      return EV.sendOnly(walletPresence).handleBridgeAction(offerCapData, true);
    },
    /**
     * @param {string} offerId
     */
    tryExitOffer(offerId) {
      const capData = marshaller.toCapData(
        harden({
          method: 'tryExitOffer',
          offerId,
        }),
      );
      return EV(walletPresence).handleBridgeAction(capData, true);
    },
    /**
     * @template {OfferMaker} M
     * @param {M} makeOffer
     * @param {Parameters<M>[1]} firstArg
     * @param {Parameters<M>[2]} [secondArg]
     * @returns {Promise<void>}
     */
    executeOfferMaker(makeOffer, firstArg, secondArg) {
      const offer = makeOffer(agoricNamesRemotes, firstArg, secondArg);
      return this.executeOffer(offer);
    },
    /**
     * @template {OfferMaker} M
     * @param {M} makeOffer
     * @param {Parameters<M>[1]} firstArg
     * @param {Parameters<M>[2]} [secondArg]
     * @returns {Promise<void>}
     */
    sendOfferMaker(makeOffer, firstArg, secondArg) {
      const offer = makeOffer(agoricNamesRemotes, firstArg, secondArg);
      return this.sendOffer(offer);
    },

    /**
     * @returns {CurrentWalletRecord}
     */
    getCurrentWalletRecord() {
      return /** @type {CurrentWalletRecord} */ (
        unmarshalFromVstorage(
          storage.data,
          `published.wallet.${walletAddress}.current`,
          (...args) => Reflect.apply(marshaller.fromCapData, marshaller, args),
          -1,
        )
      );
    },

    /**
     * @returns {UpdateRecord}
     */
    getLatestUpdateRecord() {
      return /** @type {UpdateRecord} */ (
        unmarshalFromVstorage(
          storage.data,
          `published.wallet.${walletAddress}`,
          (...args) => Reflect.apply(marshaller.fromCapData, marshaller, args),
          -1,
        )
      );
    },
  });

  return {
    /**
     * Skip the provisionPool for tests
     * @param {string} walletAddress
     * @returns {Promise<ReturnType<typeof makeWalletDriver>>}
     */
    async provideSmartWallet(walletAddress) {
      const bank = await EV(bankManager).getBankForAddress(walletAddress);
      return EV(walletFactoryStartResult.creatorFacet)
        .provideSmartWallet(walletAddress, bank, namesByAddressAdmin)
        .then(([walletPresence, isNew]) =>
          makeWalletDriver(walletAddress, walletPresence, isNew),
        );
    },
  };
};

/** @typedef {Awaited<ReturnType<typeof makeWalletFactoryDriver>>} WalletFactoryDriver */

/** @typedef {Awaited<ReturnType<WalletFactoryDriver['provideSmartWallet']>>} SmartWalletDriver */

/**
 * @param {string} collateralBrandKey
 * @param {AgoricNamesRemotes} agoricNamesRemotes
 * @param {WalletFactoryDriver} walletFactoryDriver
 * @param {string[]} oracleAddresses
 */
export const makePriceFeedDriver = async (
  collateralBrandKey,
  agoricNamesRemotes,
  walletFactoryDriver,
  oracleAddresses,
) => {
  const priceFeedName = oracleBrandFeedName(collateralBrandKey, 'USD');

  const oracleWallets = await Promise.all(
    oracleAddresses.map(addr => walletFactoryDriver.provideSmartWallet(addr)),
  );

  let nonce = 0;
  let adminOfferId;
  const acceptInvitations = async () => {
    const priceFeedInstance = agoricNamesRemotes.instance[priceFeedName];
    priceFeedInstance || Fail`no price feed ${priceFeedName}`;
    nonce += 1;
    adminOfferId = `accept-${collateralBrandKey}-oracleInvitation${nonce}`;
    return Promise.all(
      oracleWallets.map(w =>
        w.executeOffer({
          id: adminOfferId,
          invitationSpec: {
            source: 'purse',
            instance: priceFeedInstance,
            description: 'oracle invitation',
          },
          proposal: {},
        }),
      ),
    );
  };
  await acceptInvitations();

  // zero is the initial lastReportedRoundId so causes an error: cannot report on previous rounds
  let roundId = 1n;
  return {
    /**
     * @param {number} price
     */
    async setPrice(price) {
      await Promise.all(
        oracleWallets.map(w =>
          w.executeOfferMaker(
            Offers.fluxAggregator.PushPrice,
            {
              offerId: `push-${price}-${Date.now()}`,
              roundId,
              unitPrice: BigInt(price * 1_000_000),
            },
            adminOfferId,
          ),
        ),
      );
      // prepare for next round
      oracleWallets.push(NonNullish(oracleWallets.shift()));
      roundId += 1n;
      // TODO confirm the new price is written to storage
    },
    async refreshInvitations() {
      roundId = 1n;
      await acceptInvitations();
    },
  };
};
harden(makePriceFeedDriver);

/** @typedef {Awaited<ReturnType<typeof makePriceFeedDriver>>} PriceFeedDriver */

/**
 * @param {SwingsetTestKit} testKit
 * @param {AgoricNamesRemotes} agoricNamesRemotes
 * @param {WalletFactoryDriver} walletFactoryDriver
 * @param {string[]} committeeAddresses
 */
export const makeGovernanceDriver = async (
  testKit,
  agoricNamesRemotes,
  walletFactoryDriver,
  committeeAddresses,
) => {
  const { EV } = testKit.runUtils;
  const charterMembershipId = 'charterMembership';
  const committeeMembershipId = 'committeeMembership';

  /** @type {ERef<TimerService>} */
  const chainTimerService =
    await EV.vat('bootstrap').consumeItem('chainTimerService');

  let invitationsAccepted = false;

  const smartWallets = await Promise.all(
    committeeAddresses.map(address =>
      walletFactoryDriver.provideSmartWallet(address),
    ),
  );

  /**
   * @param {SmartWalletDriver} wallet
   * @param {string} descriptionSubstr
   */
  const findInvitation = (wallet, descriptionSubstr) => {
    return wallet
      .getCurrentWalletRecord()
      .purses[0].balance.value.find(v =>
        v.description.startsWith(descriptionSubstr),
      );
  };

  const ecMembers = smartWallets.map(w => ({
    ...w,
    /**
     * @param {string} [charterOfferId]
     * @param {Instance} [instance]
     */
    acceptOutstandingCharterInvitation: async (
      charterOfferId = charterMembershipId,
      instance = agoricNamesRemotes.instance.econCommitteeCharter,
    ) => {
      if (!findInvitation(w, 'charter member invitation')) {
        console.log('No charter member invitation found');
        return;
      }
      await w.executeOffer({
        id: charterOfferId,
        invitationSpec: {
          source: 'purse',
          instance,
          description: 'charter member invitation',
        },
        proposal: {},
      });
    },
    /**
     * @param {string} [committeeOfferId]
     * @param {Instance} [instance]
     */
    acceptOutstandingCommitteeInvitation: async (
      committeeOfferId = committeeMembershipId,
      instance = agoricNamesRemotes.instance.economicCommittee,
    ) => {
      const invitation = findInvitation(w, 'Voter');
      if (!invitation) {
        console.log('No committee member invitation found');
        return;
      }
      await w.executeOffer({
        id: committeeOfferId,
        invitationSpec: {
          source: 'purse',
          instance,
          description: invitation.description,
        },
        proposal: {},
      });
    },
    /**
     * @param {string} [voteId]
     * @param {string} [committeeId]
     */
    voteOnLatestProposal: async (
      voteId = 'voteInNewLimit',
      committeeId = committeeMembershipId,
    ) => {
      const latestQuestionRecord = testKit.readPublished(
        'committees.Economic_Committee.latestQuestion',
      );

      const chosenPositions = [latestQuestionRecord.positions[0]];

      await w.executeOffer({
        id: voteId,
        invitationSpec: {
          source: 'continuing',
          previousOffer: committeeId,
          invitationMakerName: 'makeVoteInvitation',
          // (positionList, questionHandle)
          invitationArgs: harden([
            chosenPositions,
            latestQuestionRecord.questionHandle,
          ]),
        },
        proposal: {},
      });
    },
    findOracleInvitation: async () => {
      const purse = w
        .getCurrentWalletRecord()
        // TODO: manage brands by object identity #10167
        .purses.find(p => p.brand.toString().includes('Invitation'));
      /** @type {Amount<'set', InvitationDetails>} */
      const invBalance = /** @type {any} */ (purse?.balance);
      const invitation = invBalance.value.find(
        v => v.description === 'oracle invitation',
      );
      return invitation;
    },
  }));

  const ensureInvitationsAccepted = async () => {
    if (invitationsAccepted) {
      return;
    }
    await null;
    for (const member of ecMembers) {
      await member.acceptOutstandingCharterInvitation();
      await member.acceptOutstandingCommitteeInvitation();
    }
    invitationsAccepted = true;
  };

  /**
   * @param {Instance} instance
   * @param {object} params
   * @param {object} path
   * @param {(typeof ecMembers)[0] | null} [ecMember]
   * @param {string} [questionId]
   * @param {string} [charterOfferId]
   */
  const proposeParams = async (
    instance,
    params,
    path,
    ecMember = null,
    questionId = 'propose',
    charterOfferId = charterMembershipId,
  ) => {
    const now = await EV(chainTimerService).getCurrentTimestamp();

    await (ecMember || ecMembers[0]).executeOffer({
      id: questionId,
      invitationSpec: {
        invitationMakerName: 'VoteOnParamChange',
        previousOffer: charterOfferId,
        source: 'continuing',
      },
      offerArgs: {
        deadline: SECONDS_PER_MINUTE + now.absValue,
        instance,
        params,
        path,
      },
      proposal: {},
    });
  };

  /**
   * @param {Instance} instance
   * @param {string} methodName
   * @param {any[]} methodArgs
   * @param {(typeof ecMembers)[0] | null} [ecMember]
   * @param {string} [questionId]
   * @param {string} [charterOfferId]
   */
  const proposeApiCall = async (
    instance,
    methodName,
    methodArgs,
    ecMember = null,
    questionId = 'propose',
    charterOfferId = charterMembershipId,
  ) => {
    const now = await EV(chainTimerService).getCurrentTimestamp();
    const deadline = SECONDS_PER_MINUTE + now.absValue;
    await (ecMember || ecMembers[0]).executeOffer({
      id: questionId,
      invitationSpec: {
        invitationMakerName: 'VoteOnApiCall',
        previousOffer: charterOfferId,
        source: 'continuing',
        invitationArgs: [instance, methodName, methodArgs, deadline],
      },
      proposal: {},
    });
  };

  /**
   * @param {typeof ecMembers} [members]
   * @param {string} [voteId]
   * @param {string} [committeeId]
   */
  const enactLatestProposal = async (
    members = ecMembers,
    voteId = 'voteInNewLimit',
    committeeId = committeeMembershipId,
  ) => {
    const promises = members.map(member =>
      member.voteOnLatestProposal(voteId, committeeId),
    );
    await Promise.all(promises);
  };

  const getLatestOutcome = () =>
    testKit.readPublished('committees.Economic_Committee.latestOutcome');

  return {
    proposeParams,
    proposeApiCall,
    enactLatestProposal,
    getLatestOutcome,
    /**
     * @param {Instance} instance
     * @param {object} params
     * @param {object} [path]
     */
    async changeParams(instance, params, path) {
      instance || Fail`missing instance`;
      await ensureInvitationsAccepted();
      await proposeParams(instance, params, path);
      await enactLatestProposal();
      await testKit.advanceTimeBy(1, 'minutes');
    },
    ecMembers,
  };
};
harden(makeGovernanceDriver);

/** @typedef {Awaited<ReturnType<typeof makeGovernanceDriver>>} GovernanceDriver */

/**
 * @param {SwingsetTestKit} testKit
 */
export const makeZoeDriver = async testKit => {
  const { EV } = testKit.runUtils;
  const zoe = await EV.vat('bootstrap').consumeItem('zoe');
  const chainStorage = await EV.vat('bootstrap').consumeItem('chainStorage');
  const storageNode = await EV(/** @type {any} */ (chainStorage)).makeChildNode(
    'prober-asid9a',
  );
  let creatorFacet;
  let adminFacet;
  let brand;
  /**
   * @param {{ brand: any; value: bigint }} a
   * @param {bigint} v
   */
  const sub = (a, v) => {
    return { brand: a.brand, value: a.value - v };
  };

  return {
    /**
     * @param {any} probeContractBundle
     */
    async instantiateProbeContract(probeContractBundle) {
      const installation = await EV(zoe).install(probeContractBundle);
      const startResults = await EV(zoe).startInstance(
        installation,
        undefined,
        undefined,
        { storageNode },
        'probe',
      );
      ({ creatorFacet, adminFacet } = startResults);

      const issuers = await EV(zoe).getIssuers(startResults.instance);
      const brands = await EV(zoe).getBrands(startResults.instance);
      brand = brands.Ducats;
      return { creatorFacet, issuer: issuers.Ducats, brand };
    },
    /**
     * @param {any} probeContractBundle
     */
    async upgradeProbe(probeContractBundle) {
      /**
       * @param {any} bundle
       */
      const fabricateBundleId = bundle => {
        return `b1-${bundle.endoZipBase64Sha512}`;
      };

      await EV(adminFacet).upgradeContract(
        fabricateBundleId(probeContractBundle),
      );
    },

    verifyRealloc() {
      return EV(creatorFacet).getAllocation();
    },
    /**
     * @param {any} value
     * @param {any} payment
     */
    async probeReallocation(value, payment) {
      const stagingInv = await EV(creatorFacet).makeProbeStagingInvitation();

      const stagingSeat = await EV(zoe).offer(
        stagingInv,
        { give: { Ducats: value } },
        { Ducats: payment },
      );
      const helperPayments = await EV(stagingSeat).getPayouts();

      const helperInv = await EV(creatorFacet).makeProbeHelperInvitation();
      const helperSeat = await EV(zoe).offer(
        helperInv,
        { give: { Ducats: sub(value, 1n) } },
        { Ducats: helperPayments.Ducats },
      );
      const internalPayments = await EV(helperSeat).getPayouts();

      const internalInv = await EV(creatorFacet).makeProbeInternalInvitation();
      const internalSeat = await EV(zoe).offer(
        internalInv,
        { give: { Ducats: sub(value, 2n) } },
        { Ducats: internalPayments.Ducats },
      );
      const leftoverPayments = await EV(internalSeat).getPayouts();

      return {
        stagingResult: await EV(stagingSeat).getOfferResult(),
        helperResult: await EV(helperSeat).getOfferResult(),
        internalResult: await EV(internalSeat).getOfferResult(),
        leftoverPayments,
      };
    },
    async faucet() {
      const faucetInv = await EV(creatorFacet).makeFaucetInvitation();
      const seat = await EV(zoe).offer(faucetInv);

      return EV(seat).getPayout('Ducats');
    },
  };
};
harden(makeZoeDriver);

/** @typedef {Awaited<ReturnType<typeof makeZoeDriver>>} ZoeDriver */
