import '@agoric/zoe/exported.js';

import { M } from '@agoric/store';
import { TimestampShape } from '@agoric/time';
import { prepareExo, provideDurableMapStore } from '@agoric/vat-data';
import {
  InstanceHandleShape,
  InstallationShape,
} from '@agoric/zoe/src/typeGuards.js';
import { E } from '@endo/far';

import '@agoric/governance/exported.js';
import '@agoric/zoe/src/contracts/exported.js';

/**
 * @import {ZCF, Installation, Instance} from '@agoric/zoe/src/zoeService/zoe.js';
 * @import {MapStore} from '@agoric/store'
 * @import {Baggage} from '@agoric/swingset-liveslots';
 * @import {TimestampValue} from '@agoric/time/src/types-index'
 */

const INVITATION_MAKERS_DESC = 'charter member invitation';

export const meta = {
  customTermsShape: {
    binaryVoteCounterInstallation: InstallationShape,
  },
  upgradability: 'canUpgrade',
};
harden(meta);

/**
 * @param {ZCF<{ binaryVoteCounterInstallation: Installation }>} zcf
 * @param {undefined} _privateArgs
 * @param {Baggage} baggage
 */
export const start = async (zcf, _privateArgs, baggage) => {
  const { binaryVoteCounterInstallation: counter } = zcf.getTerms();
  /** @type {MapStore<Instance, GovernorCreatorFacet<any>>} */
  const instanceToGovernor = provideDurableMapStore(
    baggage,
    'instanceToGovernor',
  );

  const makeOfferFilterInvitation = (instance, strings, deadline) => {
    const voteOnOfferFilterHandler = seat => {
      seat.exit();

      const governor = instanceToGovernor.get(instance);
      return E(governor).voteOnOfferFilter(counter, deadline, strings);
    };

    return zcf.makeInvitation(voteOnOfferFilterHandler, 'vote on offer filter');
  };

  /**
   * @param {Instance} instance
   * @param {string} methodName
   * @param {string[]} methodArgs
   * @param {TimestampValue} deadline
   */
  const makeApiInvocationInvitation = (
    instance,
    methodName,
    methodArgs,
    deadline,
  ) => {
    const voteOnApiCallHandler = seat => {
      seat.exit();

      const governor = instanceToGovernor.get(instance);
      return E(governor).voteOnApiInvocation(
        methodName,
        methodArgs,
        counter,
        deadline,
      );
    };

    return zcf.makeInvitation(voteOnApiCallHandler, 'vote on API call');
  };

  const MakerI = M.interface('Charter InvitationMakers', {
    VoteOnPauseOffers: M.call(
      InstanceHandleShape,
      M.arrayOf(M.string()),
      TimestampShape,
    ).returns(M.promise()),
    VoteOnApiCall: M.call(
      InstanceHandleShape,
      M.string(),
      M.arrayOf(M.any()),
      TimestampShape,
    ).returns(M.promise()),
  });

  const invitationMakers = prepareExo(
    baggage,
    'Charter Invitation Makers',
    MakerI,
    {
      VoteOnPauseOffers: makeOfferFilterInvitation,
      VoteOnApiCall: makeApiInvocationInvitation,
    },
  );

  const charterMemberHandler = seat => {
    seat.exit();
    return invitationMakers;
  };

  const CharterCreatorI = M.interface('Charter creatorFacet', {
    addInstance: M.call(InstanceHandleShape, M.any())
      .optional(M.string())
      .returns(),
    makeCharterMemberInvitation: M.call().returns(M.promise()),
  });

  const creatorFacet = prepareExo(
    baggage,
    'Charter creatorFacet',
    CharterCreatorI,
    {
      /**
       * @param {Instance} governedInstance
       * @param {GovernorCreatorFacet<any>} governorFacet
       * @param {string} [label] for diagnostic use only
       */
      addInstance: (governedInstance, governorFacet, label) => {
        console.log('charter: adding instance', label);
        instanceToGovernor.init(governedInstance, governorFacet);
      },
      makeCharterMemberInvitation: () =>
        zcf.makeInvitation(charterMemberHandler, INVITATION_MAKERS_DESC),
    },
  );

  return { creatorFacet };
};

harden(start);

/**
 * @typedef {import('@agoric/zoe/src/zoeService/utils.js').StartedInstanceKit<start>} QstnCharterStartResult
 */
