import { test as anyTest } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { AckBehavior } from '../tools/boot-tools/supports.ts';
import { BridgeId } from '@agoric/internal';
import {
  defaultMarshaller,
  documentStorageSchema,
} from '@agoric/internal/src/storage-test-utils.js';
import type { TestFn } from 'ava';
import {
  makeWalletFactoryContext,
  type WalletFactoryTestContext,
} from '../tools/walletFactory.ts';
import { name as contractName } from '../src/qstn.contract.permit.js';
import { chainInfo as mockChainInfo } from '../tools/static-config.js';

const test: TestFn<WalletFactoryTestContext> = anyTest;

/** maps between on-chain identites and boardIDs */
const showValue = (v: string) => defaultMarshaller.fromCapData(JSON.parse(v));

test.before('bootstrap', async t => {
  const config = '@agoric/vm-config/decentral-itest-orchestration-config.json';
  // TODO: impact testing
  const ctx = await makeWalletFactoryContext(t, config);

  t.context = ctx;
});

test.after.always(t => t.context.shutdown?.());

test.serial('publish chainInfo etc.', async t => {
  const { buildProposal, evalProposal, runUtils } = t.context;
  const materials = buildProposal('../tools/chain-info.build.js', [
    '--chainInfo',
    JSON.stringify(mockChainInfo('devnet')),
  ]);
  await evalProposal(materials);
  const { EV } = runUtils;
  const agoricNames = await EV.vat('bootstrap').consumeItem('agoricNames');
  for (const chain of [
    'agoric',
    'axelar',
    'neutron',
    'osmosis',
    'Avalanche',
    'Optimism',
    'Arbitrum',
    'Ethereum',
  ]) {
    const info = await EV(agoricNames).lookup('chain', chain);
    t.log(info);
    t.truthy(info);
  }

  const { storage } = t.context;
  await documentStorageSchema(t, storage, {
    node: 'agoricNames.chain',
    owner: 'chain governance',
    showValue,
  });
  await documentStorageSchema(t, storage, {
    node: 'agoricNames.chainConnection',
    owner: 'chain governance',
    showValue,
  });
});

test.serial('contract starts; appears in agoricNames', async t => {
  const {
    agoricNamesRemotes,
    bridgeUtils,
    buildProposal,
    evalProposal,
    refreshAgoricNamesRemotes,
    storage,
  } = t.context;

  // inbound `startChannelOpenInit` responses immediately.
  // needed since the portfolio creation relies on an ICA being created
  bridgeUtils.setAckBehavior(
    BridgeId.DIBC,
    'startChannelOpenInit',
    AckBehavior.Immediate,
  );

  const materials = buildProposal('../src/qstn.build.js', ['--net', 'local']);

  await evalProposal(materials);

  // update now that contract is instantiated
  refreshAgoricNamesRemotes();
  t.truthy(agoricNamesRemotes.instance[`${contractName}`]);

  await documentStorageSchema(t, storage, {
    node: 'agoricNames.instance',
    owner: 'chain governance',
    showValue,
  });
  await documentStorageSchema(t, storage, {
    node: contractName,
    owner: contractName,
    showValue,
  });
});
