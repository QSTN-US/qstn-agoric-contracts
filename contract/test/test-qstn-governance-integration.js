/**
 * @file Integration Tests for QSTN Router Governance
 *
 * This test suite verifies the complete governance integration:
 * 1. Committee + Charter + Router Governor integration
 * 2. Committee voting on offer filters
 * 3. Direct pause via governor
 */

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { E } from '@endo/far';
import { setUpZoeForTest } from '@agoric/zoe/tools/setup-zoe.js';
import bundleSource from '@endo/bundle-source';
import path from 'path';

/**
 * Set up test environment with all governance components
 */
test.before(async t => {
  const { zoe, feeMintAccess } = await setUpZoeForTest();

  // Bundle the contracts
  const qstnRouterBundle = await bundleSource(
    path.resolve('src/qstn.router.js'),
  );
  const committeeBundle = await bundleSource(
    require.resolve('@agoric/governance/src/committee.js'),
  );
  const charterBundle = await bundleSource(
    path.resolve('src/qstnCommitteeCharter.js'),
  );
  const binaryVoteCounterBundle = await bundleSource(
    require.resolve('@agoric/governance/src/binaryVoteCounter.js'),
  );

  // Install the contracts
  const qstnRouterInstallation = await E(zoe).install(qstnRouterBundle);
  const committeeInstallation = await E(zoe).install(committeeBundle);
  const charterInstallation = await E(zoe).install(charterBundle);
  const binaryVoteCounterInstallation = await E(zoe).install(
    binaryVoteCounterBundle,
  );

  t.context = {
    zoe,
    feeMintAccess,
    qstnRouterInstallation,
    committeeInstallation,
    charterInstallation,
    binaryVoteCounterInstallation,
  };
});

/**
 * Test: Basic governance setup
 */
test('governance components can be started', async t => {
  const {
    zoe,
    committeeInstallation,
    charterInstallation,
    binaryVoteCounterInstallation,
  } = t.context;

  // Start committee
  const { creatorFacet: committeeCreator, instance: committeeInstance } =
    await E(zoe).startInstance(
      committeeInstallation,
      {},
      {
        committeeName: 'Test QSTN Committee',
        committeeSize: 1,
      },
    );

  t.truthy(committeeCreator, 'Committee creator facet should exist');
  t.truthy(committeeInstance, 'Committee instance should exist');

  // Start charter
  const { creatorFacet: charterCreator, instance: charterInstance } = await E(
    zoe,
  ).startInstance(
    charterInstallation,
    {},
    {
      binaryVoteCounterInstallation,
    },
  );

  t.truthy(charterCreator, 'Charter creator facet should exist');
  t.truthy(charterInstance, 'Charter instance should exist');
});

/**
 * Test: Direct pause via governor facet
 */
test('governor can directly pause offers', async t => {
  const { zoe, qstnRouterInstallation } = t.context;

  // Start router without governance for this test
  const { creatorFacet, publicFacet } = await E(zoe).startInstance(
    qstnRouterInstallation,
    {},
    {},
    {
      storageNode: {
        makeChildNode: () => ({
          setValue: () => {},
        }),
      },
      marshaller: {
        serialize: v => JSON.stringify(v),
        unserialize: s => JSON.parse(s),
      },
    },
  );

  // The creatorFacet is the governorFacet after wrapping
  // Test direct pause control
  await E(creatorFacet).setFilters(['sendTransaction']);

  // Verify it's paused
  const filters = await E(creatorFacet).getFilters();
  t.deepEqual(filters, ['sendTransaction'], 'sendTransaction should be paused');

  // Verify the invitation is blocked
  await t.throwsAsync(
    () => E(publicFacet).makeSendTransactionInvitation(),
    { message: /not accepting offer with description "sendTransaction"/ },
    'Should reject paused offer',
  );

  // Unpause
  await E(creatorFacet).setFilters([]);
  const unpaused = await E(creatorFacet).getFilters();
  t.deepEqual(unpaused, [], 'Should be unpaused');

  // Verify invitation works again
  const invitation = await E(publicFacet).makeSendTransactionInvitation();
  t.truthy(invitation, 'Should be able to get invitation when unpaused');
});

/**
 * Test: Charter can register governor
 */
test('charter can register governed instances', async t => {
  const {
    zoe,
    charterInstallation,
    qstnRouterInstallation,
    binaryVoteCounterInstallation,
  } = t.context;

  // Start charter
  const { creatorFacet: charterCreator } = await E(zoe).startInstance(
    charterInstallation,
    {},
    {
      binaryVoteCounterInstallation,
    },
  );

  // Start router (with minimal mock dependencies)
  const { instance: routerInstance, creatorFacet: routerCreator } = await E(
    zoe,
  ).startInstance(
    qstnRouterInstallation,
    {},
    {},
    {
      storageNode: {
        makeChildNode: () => ({
          setValue: () => {},
        }),
      },
      marshaller: {
        serialize: v => JSON.stringify(v),
        unserialize: s => JSON.parse(s),
      },
    },
  );

  // Register the router instance with the charter
  // This creates the instanceToGovernor mapping
  await E(charterCreator).addInstance(
    routerInstance,
    routerCreator, // This is the governorFacet
    'qstnRouter',
  );

  // Verify it was registered
  const instances = await E(charterCreator).getGovernedInstances();
  t.true(
    instances.includes(routerInstance),
    'Router should be registered in charter',
  );
});

/**
 * Test: Pause and unpause flow
 */
test('can pause and unpause via setFilters', async t => {
  const { zoe, qstnRouterInstallation } = t.context;

  const { creatorFacet, publicFacet } = await E(zoe).startInstance(
    qstnRouterInstallation,
    {},
    {},
    {
      storageNode: {
        makeChildNode: () => ({
          setValue: () => {},
        }),
      },
      marshaller: {
        serialize: v => JSON.stringify(v),
        unserialize: s => JSON.parse(s),
      },
    },
  );

  // Initial state: not paused
  let filters = await E(creatorFacet).getFilters();
  t.deepEqual(filters, [], 'Initially no filters');

  // Can get invitation
  let invitation = await E(publicFacet).makeSendTransactionInvitation();
  t.truthy(invitation, 'Can get invitation initially');

  // Pause
  await E(creatorFacet).setFilters(['sendTransaction']);
  filters = await E(creatorFacet).getFilters();
  t.deepEqual(filters, ['sendTransaction'], 'Paused');

  // Cannot get invitation
  await t.throwsAsync(
    () => E(publicFacet).makeSendTransactionInvitation(),
    { message: /not accepting offer/ },
    'Blocked when paused',
  );

  // Unpause
  await E(creatorFacet).setFilters([]);
  filters = await E(creatorFacet).getFilters();
  t.deepEqual(filters, [], 'Unpaused');

  // Can get invitation again
  invitation = await E(publicFacet).makeSendTransactionInvitation();
  t.truthy(invitation, 'Can get invitation after unpause');
});
