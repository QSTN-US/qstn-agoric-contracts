import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import {
  axelarConfigTestnet as axelarConfig,
  gmpAddresses,
} from '../../contract/src/utils/axelar-config.js';
import { cosmosConfigTestnet as cosmosConfig } from '../../contract/src/utils/cosmos-config.js';
import { eventLoopIteration } from '@agoric/internal/src/testing-utils.js';
import { makePromiseSpace } from '@agoric/vats';
import { makeWellKnownSpaces } from '@agoric/vats/src/core/utils.js';
import {
  produceDiagnostics,
  produceStartUpgradable,
} from '@agoric/vats/src/core/basic-behaviors.js';
import type { ZoeService } from '@agoric/zoe';
import { setUpZoeForTest } from '@agoric/zoe/tools/setup-zoe.js';
import { type Instance } from '@agoric/zoe';
import { E } from '@endo/far';
import { passStyleOf } from '@endo/pass-style';
import * as contractExports from '../../contract/src/qstn.contract.js';
import { toExternalConfig } from '../tools/config-marshal.js';
import {
  QstnDeployConfigShape,
  startQstn,
  type QstnDeployConfig,
} from '../src/qstn.start.js';
import { name as contractName } from '../src/qstn.contract.permit.js';
import type { QstnBootPowers, StartFn } from '../src/qstn.deploy.type.js';
import type { ChainInfoPowers } from '../tools/chain-info.core.js';
import { setupQstnTest } from './utils/supports.ts';
import { deploy as deployWalletFactory } from '../tools/wf-tools.js';

const { entries, keys } = Object;

const getCapDataStructure = cell => {
  const { body, slots } = JSON.parse(cell);
  const structure = JSON.parse(body.replace(/^#/, ''));
  return { structure, slots };
};

const makeBootstrap = async t => {
  const common = await setupQstnTest(t);
  const {
    bootstrap,
    utils: { rootZone },
  } = common;
  const { agoricNamesAdmin, agoricNames } = bootstrap;
  const wk = await makeWellKnownSpaces(agoricNamesAdmin);
  const log = () => {}; // console.log
  const { produce, consume } = makePromiseSpace({ log });
  const zone = rootZone.subZone('bootstrap vat');
  const powers = {
    zone,
    produce,
    consume,
    ...wk,
  } as unknown as BootstrapPowers & QstnBootPowers & ChainInfoPowers;
  // XXX type of zoe from setUpZoeForTest is any???
  const { zoe: zoeAny, bundleAndInstall } = await setUpZoeForTest();
  const zoe: ZoeService = zoeAny;
  const { bld } = common.brands;

  {
    t.log('produce bootstrap entries from commonSetup()', keys(bootstrap));
    for (const [n, v] of entries(bootstrap)) {
      switch (n) {
        case 'timer':
          produce.chainTimerService.resolve(v);
          break;
        case 'storage':
          produce.chainStorage.resolve(v.rootNode);
          break;
        default:
          produce[n].resolve(v);
      }
    }

    for (const [name, { brand, issuer }] of entries({
      BLD: bld,
    })) {
      t.log('produce brand, issuer for', name);
      wk.brand.produce[name].resolve(brand);
      wk.issuer.produce[name].resolve(issuer);
    }

    t.log('produce startUpgradable');

    powers.produce.zoe.resolve(zoe);
    powers.produce.agoricNames.resolve(agoricNames);
    powers.produce.agoricNamesAdmin.resolve(agoricNamesAdmin);

    await produceDiagnostics(powers);
    await produceStartUpgradable(powers);
  }

  const { storage } = bootstrap;
  const readLegible = async (path: string) => {
    await eventLoopIteration();
    return getCapDataStructure(storage.getValues(path).at(-1));
  };
  const getTestJig = () => ({});
  const { provisionSmartWallet } = await deployWalletFactory({
    boot: async () => {
      return {
        ...common.bootstrap,
        zoe: zoe as any, // XXX Guarded<ZoeService>
        utils: { ...common.utils, readLegible, bundleAndInstall, getTestJig },
      };
    },
  });

  produce.chainInfoPublished.resolve(true);
  return { common, powers, zoe, bundleAndInstall, provisionSmartWallet };
};

const qstnOptions = toExternalConfig(
  harden({
    chainConfig: { ...axelarConfig, ...cosmosConfig },
    gmpAddresses: gmpAddresses.testnet,
  } as QstnDeployConfig),
  {},
  QstnDeployConfigShape,
);

test('start qstn eval code without swingset', async t => {
  const { common, powers, bundleAndInstall } = await makeBootstrap(t);
  const { bootstrap } = common;

  // script from agoric run does this step
  t.log('produce installation using test bundle');
  powers.installation.produce[contractName].resolve(
    await bundleAndInstall(contractExports),
  );

  t.log('invoke coreEval');
  await t.notThrowsAsync(startQstn(powers, { options: qstnOptions }));

  const { agoricNames } = bootstrap;
  const instance = (await E(agoricNames).lookup(
    'instance',
    contractName,
  )) as Instance<StartFn>;
  t.log('found instance', instance);
  t.is(passStyleOf(instance), 'remotable');
});
