/// <reference types="@agoric/vats/src/core/types-ambient"/>

/**
 * @file QSTN Committee and Charter Governance Setup
 *
 * This proposal sets up the governance infrastructure for the QSTN Router:
 * 1. Start the QSTN Committee (for voting)
 * 2. Start the QSTN Charter (for managing governance proposals)
 * 3. Connect the QSTN Router governor to the charter
 * 4. Distribute charter member invitations to committee voters
 */

import { E } from '@endo/far';
import { deeplyFulfilled } from '@endo/marshal';
import { makeTracer } from '@agoric/internal';

const { Fail } = assert;

const trace = makeTracer('qstnCommittee');

// These should be exported by Agoric, somewhere.
const pathSegmentPattern = /^[a-zA-Z0-9_-]{1,100}$/;
/** @type {(name: string) => void} */
const assertPathSegment = name => {
  pathSegmentPattern.test(name) ||
    Fail`Path segment names must consist of 1 to 100 characters limited to ASCII alphanumerics, underscores, and/or dashes: ${name}`;
};

/** @type {(name: string) => string} */
const sanitizePathSegment = name => {
  const candidate = name.replace(/[ ,]/g, '_');
  assertPathSegment(candidate);
  return candidate;
};

const { values } = Object;

const COMMITTEES_ROOT = 'committees';

/** @type {<X, Y>(xs: X[], ys: Y[]) => [X, Y][]} */
const zip = (xs, ys) => xs.map((x, i) => [x, ys[i]]);

export const reserveThenGetNamePaths = async (nameAdmin, paths) => {
  /**
   * @param {ERef<import('@agoric/vats').NameAdmin>} nextAdmin
   * @param {string[]} path
   */
  const nextPath = async (nextAdmin, path) => {
    const [nextName, ...rest] = path;
    assert.typeof(nextName, 'string');

    // Ensure we wait for the next name until it exists.
    await E(nextAdmin).reserve(nextName);

    if (rest.length === 0) {
      // Now return the readonly lookup of the name.
      const nameHub = E(nextAdmin).readonly();
      return E(nameHub).lookup(nextName);
    }

    // Wait until the next admin is resolved.
    const restAdmin = await E(nextAdmin).lookupAdmin(nextName);
    return nextPath(restAdmin, rest);
  };

  return Promise.all(
    paths.map(async path => {
      Array.isArray(path) || Fail`path ${path} is not an array`;
      return nextPath(nameAdmin, path);
    }),
  );
};

/**
 * @param {string} debugName
 * @param {ERef<import('@agoric/vats').NameAdmin>} namesByAddressAdmin
 * @param {string} addr
 * @param {ERef<Payment>[]} payments
 */
export const reserveThenDeposit = async (
  debugName,
  namesByAddressAdmin,
  addr,
  payments,
) => {
  const [depositFacet] = await reserveThenGetNamePaths(namesByAddressAdmin, [
    [addr, 'depositFacet'],
  ]);
  await Promise.allSettled(
    payments.map(async (paymentP, i) => {
      const payment = await paymentP;
      await E(depositFacet).receive(payment);
      console.info(
        `confirmed deposit ${i + 1}/${payments.length} for`,
        debugName,
      );
    }),
  );
};

/**
 * @typedef {{
 *   committeeName?: string;
 *   voterAddresses: Record<string, string>;
 *   [key: string]: unknown;
 * }} CommitteeOptions
 */

/**
 * @param {import('@agoric/inter-protocol/src/proposals/econ-behaviors.js').EconomyBootstrapPowers} powers
 * @param {{ options: CommitteeOptions }} config
 */
export const startQstnCommittee = async (
  {
    consume: { board, chainStorage, diagnostics, zoe },
    produce: { qstnCommitteeKit, qstnCommitteeCreatorFacet },
    installation: {
      consume: { committee },
    },
    instance: {
      produce: { qstnCommittee },
    },
  },
  { options },
) => {
  trace('startQstnCommittee');
  const {
    // NB: the electorate (and size) of the committee may change, but the name must not
    committeeName = 'QSTN Committee',
    voterAddresses,
    ...rest
  } = options;
  const committeeSize = Object.keys(voterAddresses).length;

  const storageNode = E(
    E(chainStorage).makeChildNode(COMMITTEES_ROOT),
  ).makeChildNode(sanitizePathSegment(committeeName));

  // force the node to appear
  await E(storageNode).setValue('');

  const privateArgs = await deeplyFulfilled(
    harden({
      storageNode,
      marshaller: E(board).getPublishingMarshaller(),
    }),
  );
  trace('startQstnCommittee awaiting startInstance');
  const startResult = await E(zoe).startInstance(
    committee,
    {},
    { committeeName, committeeSize, ...rest },
    privateArgs,
    'qstnCommittee',
  );
  qstnCommitteeKit.resolve(harden({ ...startResult, label: 'qstnCommittee' }));

  trace('startQstnCommittee awaiting save');
  await E(diagnostics).savePrivateArgs(startResult.instance, privateArgs);
  qstnCommitteeCreatorFacet.resolve(startResult.creatorFacet);
  qstnCommittee.resolve(startResult.instance);
};
harden(startQstnCommittee);

/**
 * @param {import('@agoric/inter-protocol/src/proposals/econ-behaviors').EconomyBootstrapPowers} powers
 * @param {{ options: { voterAddresses: Record<string, string> } }} param1
 */
export const inviteCommitteeMembers = async (
  { consume: { namesByAddressAdmin, qstnCommitteeCreatorFacet } },
  { options: { voterAddresses } },
) => {
  const invitations = await E(qstnCommitteeCreatorFacet).getVoterInvitations();
  assert.equal(invitations.length, values(voterAddresses).length);

  /** @param {[string, Promise<Invitation>][]} addrInvitations */
  const distributeInvitations = async addrInvitations => {
    await Promise.all(
      addrInvitations.map(async ([addr, invitationP]) => {
        const debugName = `qstn committee member ${addr}`;
        await reserveThenDeposit(debugName, namesByAddressAdmin, addr, [
          invitationP,
        ]).catch(err => console.error(`failed deposit to ${debugName}`, err));
      }),
    );
  };

  // This doesn't resolve until the committee members create their smart wallets.
  void distributeInvitations(zip(values(voterAddresses), invitations));
};
harden(inviteCommitteeMembers);

/** @param {import('@agoric/inter-protocol/src/proposals/econ-behaviors').EconomyBootstrapPowers} powers */
export const startQstnCharter = async ({
  consume: { zoe },
  produce: { qstnCharterKit },
  installation: {
    consume: { binaryVoteCounter: counterP, qstnCommitteeCharter: installP },
  },
  instance: {
    produce: { qstnCommitteeCharter: instanceP },
  },
}) => {
  const [charterInstall, counterInstall] = await Promise.all([
    installP,
    counterP,
  ]);
  const terms = harden({
    binaryVoteCounterInstallation: counterInstall,
  });

  const startResult = E(zoe).startInstance(
    charterInstall,
    undefined,
    terms,
    undefined,
    'qstnCommitteeCharter',
  );

  instanceP.resolve(E.get(startResult).instance);
  qstnCharterKit.resolve(startResult);
};
harden(startQstnCharter);

/**
 * Introduce charter to governed creator facets.
 *
 * @param {import('@agoric/inter-protocol/src/proposals/econ-behaviors').EconomyBootstrapPowers} powers
 */
export const addGovernorToQstnCharter = async ({
  consume: { qstnCharterKit, qstnKit },
  instance: {
    consume: { qstnRouter },
  },
}) => {
  const { creatorFacet } = E.get(qstnCharterKit);

  await Promise.all(
    [
      {
        label: 'qstnRouter',
        instanceP: qstnRouter,
        facetP: E.get(qstnKit).governorCreatorFacet,
      },
    ].map(async ({ label, instanceP, facetP }) => {
      const [instance, govFacet] = await Promise.all([instanceP, facetP]);

      return E(creatorFacet).addInstance(instance, govFacet, label);
    }),
  );
};
harden(addGovernorToQstnCharter);

/**
 * @param {import('@agoric/inter-protocol/src/proposals/econ-behaviors').EconomyBootstrapPowers} powers
 * @param {{ options: { voterAddresses: Record<string, string> } }} param1
 */
export const inviteToQstnCharter = async (
  { consume: { namesByAddressAdmin, qstnCharterKit } },
  { options: { voterAddresses } },
) => {
  const { creatorFacet } = E.get(qstnCharterKit);

  // This doesn't resolve until the committee members create their smart wallets.
  // Don't block bootstrap on it.
  void Promise.all(
    values(voterAddresses).map(async addr => {
      const debugName = `QSTN charter member ${addr}`;

      reserveThenDeposit(debugName, namesByAddressAdmin, addr, [
        E(creatorFacet).makeCharterMemberInvitation(),
      ]).catch(err => console.error(`failed deposit to ${debugName}`, err));
      console.log(`Would deposit invitation to ${debugName}`);
    }),
  );
};
harden(inviteToQstnCharter);

export const getManifestForInviteCommittee = async (
  { restoreRef },
  { voterAddresses, qstnCommitteeCharterRef, committeeName },
) => ({
  manifest: {
    [startQstnCommittee.name]: {
      consume: {
        board: true,
        chainStorage: true,
        diagnostics: true,
        zoe: true,
      },
      produce: {
        qstnCommitteeKit: true,
        qstnCommitteeCreatorFacet: true,
      },
      installation: {
        consume: { committee: true },
      },
      instance: {
        produce: { qstnCommittee: true },
      },
    },
    [inviteCommitteeMembers.name]: {
      consume: {
        namesByAddressAdmin: true,
        qstnCommitteeCreatorFacet: true,
        highPrioritySendersManager: true,
      },
    },
    [startQstnCharter.name]: {
      consume: {
        zoe: true,
      },
      produce: {
        qstnCharterKit: true,
      },
      installation: {
        consume: {
          binaryVoteCounter: true,
          qstnCommitteeCharter: true,
        },
      },
      instance: {
        produce: {
          qstnCommitteeCharter: true,
        },
      },
    },
    [addGovernorToQstnCharter.name]: {
      consume: {
        qstnCharterKit: true,
        zoe: true,
        agoricNames: true,
        namesByAddressAdmin: true,
        qstnCommitteeCreatorFacet: true,
        qstnKit: true,
      },
      installation: {
        consume: { binaryVoteCounter: true },
      },
      instance: {
        consume: {
          qstnRouter: true,
        },
      },
    },
    [inviteToQstnCharter.name]: {
      consume: {
        namesByAddressAdmin: true,
        qstnCharterKit: true,
      },
    },
  },
  installations: {
    qstnCommitteeCharter: restoreRef(qstnCommitteeCharterRef),
  },
  options: { voterAddresses, committeeName },
});
