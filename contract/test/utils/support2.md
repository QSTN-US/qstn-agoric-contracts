/* eslint-disable jsdoc/require-returns-type */
/* eslint-disable @jessie.js/safe-await-separator */

import childProcessAmbient from 'child_process';
import { promises as fsAmbientPromises } from 'fs';
import { createRequire } from 'node:module';
import { basename, join } from 'path';
import { inspect } from 'util';

import { buildSwingset } from '@agoric/cosmic-swingset/src/launch-chain.js';
import { makeHelpers } from '@agoric/cosmic-swingset/tools/inquisitor.mjs';
import {
  BridgeId,
  makeTracer,
  NonNullish,
  VBankAccount,
} from '@agoric/internal';
import { unmarshalFromVstorage } from '@agoric/internal/src/marshal.js';
import { makeFakeStorageKit } from '@agoric/internal/src/storage-test-utils.js';
import { krefOf } from '@agoric/kmarshal';
import { makeTestAddress } from '@agoric/orchestration/tools/make-test-address.js';
import { initSwingStore } from '@agoric/swing-store';
import { makeSlogSender } from '@agoric/telemetry';
import { makeRunUtils } from '@agoric/swingset-vat/tools/run-utils.js';
import { loadSwingsetConfigFile } from '@agoric/swingset-vat';
import { TimeMath } from '@agoric/time';
import { fakeLocalChainBridgeTxMsgHandler } from '@agoric/vats/tools/fake-bridge.js';
import { Fail } from '@endo/errors';

import { computronCounter } from '@agoric/cosmic-swingset/src/computron-counter.js';
import {
  defaultBeansPerVatCreation,
  defaultBeansPerXsnapComputron,
} from '@agoric/cosmic-swingset/src/sim-params.js';
import {
  boardSlottingMarshaller,
  slotToBoardRemote,
} from '@agoric/vats/tools/board-utils.js';

import { FileSystemCache, NodeFetchCache } from 'node-fetch-cache';
import { icaMocks, protoMsgMockMap, protoMsgMocks } from './ibc/mocks.js';

/** @import { Remote } from '@agoric/internal'; */
/** @import { Timestamp } from '@agoric/time'; */
/** @import { Amount, Brand } from '@agoric/ertp'; */
/** @import { EndoZipBase64Bundle, ManagerType, SwingSetConfig } from '@agoric/swingset-vat'; */
/** @import { RunHarness, RunUtils } from '@agoric/swingset-vat/tools/run-utils.js'; */
/** @import { ExecutionContext as AvaT } from 'ava'; */
/** @import { CoreEvalSDKType } from '@agoric/cosmic-proto/swingset/swingset.js'; */
/** @import { EconomyBootstrapPowers } from '@agoric/inter-protocol/src/proposals/econ-behaviors.js'; */
/** @import { SwingsetController } from '@agoric/swingset-vat/src/controller/controller.js'; */
/** @import { BridgeHandler, IBCDowncallMethod, IBCMethod } from '@agoric/vats'; */
/** @import { BootstrapRootObject } from '@agoric/vats/src/core/lib-boot.js'; */
/** @import { EProxy, ERef } from '@endo/eventual-send'; */
/** @import { TypedPublished } from '@agoric/client-utils'; */

const trace = makeTracer('BSTSupport', false);

// Releases are immutable, so we can cache them.
// Doesn't help in CI but speeds up local development.
// CI is on Github Actions, so fetching is reliable.
// Files appear in a .cache directory.
export const fetchCached = /** @type {typeof globalThis.fetch} */ (
  /** @type {unknown} */ (
    NodeFetchCache.create({
      cache: new FileSystemCache(),
    })
  )
);

/**
 * @template {string} N
 * @typedef {N extends keyof EconomyBootstrapPowers['consume']
 *   ? EconomyBootstrapPowers['consume'][N]
 *   : unknown} ConsumeBootrapItem
 */

// XXX should satisfy EVProxy from run-utils.js but that's failing to import
/**
 * Elaboration of EVProxy with knowledge of bootstrap space in these tests.
 * @typedef {EProxy & {
 *   sendOnly: (presence: unknown) => Record<string, (...args: any) => void>;
 *   vat: (name: string) => ;
 * }} BootstrapEV
 */

/**
 * @type {(controller: SwingsetController, harness?: RunHarness) => Omit<RunUtils, 'EV'> & { EV: BootstrapEV }}
 */
const makeBootstrapRunUtils = /** @type {any} */ (makeRunUtils);

/**
 * @template K, V
 * @param {K[]} keys
 * @param {(key: K, i: number) => V} valueMaker
 * @returns {Record<string, V>}
 */
const keysToObject = (keys, valueMaker) => {
  return Object.fromEntries(keys.map((key, i) => [key, valueMaker(key, i)]));
};

/**
 * AVA's default t.deepEqual() is nearly unreadable for sorted arrays of
 * strings.
 *
 * Compare two arrays of property keys for equality in a way that's more readable
 * in AVA test output than the default t.deepEqual().
 *
 * @param {AvaT} t - AVA test context
 * @param {PropertyKey[]} a - First array of property keys to compare
 * @param {PropertyKey[]} b - Second array of property keys to compare
 * @param {string} [message] - Optional message to display on failure
 * @returns The result of t.deepEqual() on objects created from the arrays
 */
export const keyArrayEqual = (t, a, b, message) => {
  const aobj = keysToObject(a, () => 1);
  const bobj = keysToObject(b, () => 1);
  return t.deepEqual(aobj, bobj, message);
};

/**
 * Prepares a SwingSet configuration for testing vaults.
 *
 * @param {object} options - Configuration options
 * @param {string} options.bundleDir - Directory to store bundle cache files
 * @param {string} options.configPath - Path to the base config file
 * @param {ManagerType} [options.defaultManagerType] - SwingSet manager type to use
 * @param {string} [options.discriminator] - Optional string to include in the config filename
 * @returns {Promise<string>} Path to the generated config file
 */
export const getNodeTestVaultsConfig = async ({
  bundleDir,
  configPath,
  defaultManagerType = /** @type {ManagerType} */ ('local'),
  discriminator = '',
}) => {
  /** @type {SwingSetConfig & { coreProposals?: any[] }} */
  const config = NonNullish(await loadSwingsetConfigFile(configPath));

  // Manager types:
  //   'local':
  //     - much faster (~3x speedup)
  //     - much easier to use debugger
  //     - exhibits inconsistent GC behavior from run to run
  //   'xs-worker'
  //     - timing results more accurately reflect production
  config.defaultManagerType = defaultManagerType;
  // speed up build (60s down to 10s in testing)
  config.bundleCachePath = bundleDir;
  await fsAmbientPromises.mkdir(bundleDir, { recursive: true });

  if (config.coreProposals) {
    // remove Pegasus because it relies on IBC to Golang that isn't running
    config.coreProposals = config.coreProposals.filter(
      v => v !== '@agoric/pegasus/scripts/init-core.js',
    );
  }

  // make an almost-certainly-unique file name with a fixed-length prefix
  const configFilenameParts = [
    'config',
    discriminator,
    new Date().toISOString().replaceAll(/[^0-9TZ]/g, ''),
    `${Math.random()}`.replace(/.*[.]/, '').padEnd(8, '0').slice(0, 8),
    basename(configPath),
  ].filter(s => !!s);
  const testConfigPath = `${bundleDir}/${configFilenameParts.join('.')}`;
  await fsAmbientPromises.writeFile(
    testConfigPath,
    JSON.stringify(config),
    'utf-8',
  );
  return testConfigPath;
};

/**
 * @typedef {object} Powers
 * @property {Pick<typeof import('node:child_process'), 'execFileSync'>} childProcess
 * @property {typeof import('node:fs/promises')} fs
 */

/**
 * Creates a function that can build and extract proposal data from package scripts.
 *
 * @param {Powers} powers - Object containing required capabilities
 * @param {string} [resolveBase]
 * @returns A function that builds and extracts proposal data
 */
export const makeProposalExtractor = (
  { childProcess, fs },
  resolveBase = import.meta.url,
) => {
  const importSpec = createRequire(resolveBase).resolve;
  /**
   * @param {string} outputDir
   * @param {string} scriptPath
   * @param {NodeJS.ProcessEnv} env
   * @param {string[]} [cliArgs]
   */
  const runPackageScript = (outputDir, scriptPath, env, cliArgs = []) => {
    console.info('running package script:', scriptPath);
    return childProcess.execFileSync(
      importSpec('agoric/src/entrypoint.js'),
      ['run', scriptPath, ...cliArgs],
      {
        cwd: outputDir,
        env,
      },
    );
  };

  const loadJSON = async filePath =>
    harden(JSON.parse(await fs.readFile(filePath, 'utf8')));

  // XXX parses the output to find the files but could write them to a path that can be traversed
  /**
   * @param {string} txt
   */
  const parseProposalParts = txt => {
    const evals = [
      ...txt.matchAll(/swingset-core-eval (?<permit>\S+) (?<script>\S+)/g),
    ].map(m => {
      if (!m.groups) throw Fail`Invalid proposal output ${m[0]}`;
      const { permit, script } = m.groups;
      return { permit, script };
    });
    evals.length ||
      Fail`No swingset-core-eval found in proposal output: ${txt}`;

    const bundles = [
      ...txt.matchAll(/swingset install-bundle @([^\n]+)/gm),
    ].map(([, bundle]) => bundle);
    bundles.length || Fail`No bundles found in proposal output: ${txt}`;

    return { evals, bundles };
  };

  /**
   * @param {string} builderPath
   * @param {string[]} [args]
   */
  const buildAndExtract = async (builderPath, args = []) => {
    // XXX rebuilds every time
    const tmpDir = join(process.cwd(), '/tmp');
    await fsAmbientPromises.mkdir(tmpDir, { recursive: true });

    const built = parseProposalParts(
      runPackageScript(tmpDir, builderPath, process.env, args).toString(),
    );

    const loadPkgFile = fileName => fs.readFile(join(tmpDir, fileName), 'utf8');

    const evalsP = Promise.all(
      built.evals.map(async ({ permit, script }) => {
        const [permits, code] = await Promise.all([
          loadPkgFile(permit),
          loadPkgFile(script),
        ]);
        // Fire and forget. There's a chance the Node process could terminate
        // before the deletion completes. This is a minor inconvenience to clean
        // up manually and not worth slowing down the test execution to prevent.
        void fsAmbientPromises.rm(tmpDir, { recursive: true, force: true });
        return /** @type {CoreEvalSDKType} */ ({
          json_permits: permits,
          js_code: code,
        });
      }),
    );

    const bundlesP = Promise.all(
      built.bundles.map(
        async bundleFile =>
          /** @type {Promise<EndoZipBase64Bundle>} */ (loadJSON(bundleFile)),
      ),
    );
    return Promise.all([evalsP, bundlesP]).then(([evals, bundles]) => ({
      evals,
      bundles,
    }));
  };
  return buildAndExtract;
};
harden(makeProposalExtractor);

/**
 * Compares two references for equality using krefOf.
 *
 * @param {AvaT} t - AVA test context
 * @param {unknown} ref1 - First reference to compare
 * @param {unknown} ref2 - Second reference to compare
 * @param {string} [message] - Optional message to display on failure
 * @returns The result of t.is() on the kref values
 */
export const matchRef = (t, ref1, ref2, message) =>
  t.is(krefOf(ref1), krefOf(ref2), message);

/**
 * Compares an amount object with expected brand and value.
 *
 * @param {AvaT} t - AVA test context
 * @param {Amount} amount - Amount object to test
 * @param {Brand} refBrand - Expected brand reference
 * @param {any} refValue - Expected value
 * @param {string} [message] - Optional message to display on failure
 */
export const matchAmount = (t, amount, refBrand, refValue, message) => {
  matchRef(t, amount.brand, refBrand);
  t.is(amount.value, refValue, message);
};

/**
 * Compares a value object with a reference value object.
 * Checks brand, denom, issuer, issuerName, and proposedName.
 *
 * @param {AvaT} t - AVA test context
 * @param {any} value - Value object to test
 * @param {any} ref - Reference value object to compare against
 */
export const matchValue = (t, value, ref) => {
  matchRef(t, value.brand, ref.brand);
  t.is(value.denom, ref.denom);
  matchRef(t, value.issuer, ref.issuer);
  t.is(value.issuerName, ref.issuerName);
  t.is(value.proposedName, ref.proposedName);
};

/**
 * Checks that an iterator is not done and its current value matches the reference.
 *
 * @param {AvaT} t - AVA test context
 * @param {any} iter - Iterator to test
 * @param {any} valueRef - Reference value to compare against the iterator's current value
 */
export const matchIter = (t, iter, valueRef) => {
  t.is(iter.done, false);
  matchValue(t, iter.value, valueRef);
};

/**
 * Enumeration of acknowledgment behaviors for IBC bridge messages.
 */
export const AckBehavior = /** @type {const} */ ({
  /** inbound responses are queued. use `flushInboundQueue()` to simulate the remote response */
  Queued: 'QUEUED',
  /** inbound messages are delivered immediately */
  Immediate: 'IMMEDIATE',
  /** inbound responses never arrive (to simulate mis-configured connections etc.) */
  Never: 'NEVER',
});

/** @typedef {(typeof AckBehavior)[keyof typeof AckBehavior]} AckBehaviorType */

/**
 * Start a SwingSet kernel to be used by tests and benchmarks.
 *
 * In the case of Ava tests, this kernel is expected to be shared across all
 * tests in a given test module. By default Ava tests run in parallel, so be
 * careful to avoid ordering dependencies between them.  For example, test
 * accounts balances using separate wallets or test vault factory metrics using
 * separate collateral managers. (Or use test.serial)
 *
 * The shutdown() function _must_ be called after the test or benchmarks are
 * complete, else V8 will see the xsnap workers still running, and will never
 * exit (leading to a timeout error). Ava tests should use
 * t.after.always(shutdown), because the normal t.after() hooks are not run if a
 * test fails.
 *
 * @param log
 * @param bundleDir directory to write bundles and config to
 * @param [options]
 * @param [options.configSpecifier] bootstrap config specifier
 * @param [options.label] bootstrap config specifier
 * @param [options.storage]
 * @param [options.verbose]
 * @param [options.slogFile]
 * @param [options.profileVats]
 * @param [options.debugVats]
 * @param [options.defaultManagerType]
 * @param [options.harness]
 */
/**
 * Creates a SwingSet test environment with various utilities for testing.
 *
 * This function sets up a complete SwingSet kernel with mocked bridges and
 * utilities for time manipulation, proposal evaluation, and more.
 *
 * @param {(...args: any[]) => void} log - Logging function
 * @param {string} [bundleDir] - Directory to store bundle cache files
 * @param {object} [options] - Configuration options
 * @param {string} [options.configSpecifier] - Path to the base config file
 * @param {string | undefined} [options.label] - Optional label for the test environment
 * @param {any} [options.storage] - Storage kit to use (defaults to fake storage)
 * @param {boolean} [options.verbose] - Whether to enable verbose logging
 * @param {string | undefined} [options.slogFile] - Path to write slog output
 * @param {string[]} [options.profileVats] - Array of vat names to profile
 * @param {string[]} [options.debugVats] - Array of vat names to debug
 * @param {ManagerType} [options.defaultManagerType] - SwingSet manager type to use
 * @param {RunHarness | undefined} [options.harness] - Optional run harness
 * @param {string} [options.resolveBase] - Base URL or path for resolving module paths
 * @returns {Promise<SwingsetTestKit>} A test kit with various utilities for interacting with the SwingSet
 */
export const makeSwingsetTestKit = async (
  log,
  bundleDir = 'bundles',
  {
    configSpecifier = '@agoric/vm-config/decentral-itest-vaults-config.json',
    label = /** @type {string | undefined} */ (undefined),
    storage = makeFakeStorageKit('bootstrapTests'),
    verbose = false,
    slogFile = /** @type {string | undefined} */ (undefined),
    profileVats = /** @type {string[]} */ ([]),
    debugVats = /** @type {string[]} */ ([]),
    defaultManagerType = /** @type {ManagerType} */ ('local'),
    harness = /** @type {RunHarness | undefined} */ (undefined),
    resolveBase = import.meta.url,
  } = {},
) => {
  const importSpec = createRequire(resolveBase).resolve;
  console.time('makeBaseSwingsetTestKit');
  const configPath = await getNodeTestVaultsConfig({
    bundleDir,
    configPath: importSpec(configSpecifier),
    discriminator: label,
    defaultManagerType,
  });
  const swingStore = initSwingStore();
  const { kernelStorage, hostStorage } = swingStore;
  const { fromCapData } = boardSlottingMarshaller(slotToBoardRemote);

  /**
   * @param {string} path
   * @returns {any}
   */
  const readLatest = path => {
    const data = unmarshalFromVstorage(storage.data, path, fromCapData, -1);
    trace('readLatest', path, 'returning', inspect(data, false, 20, true));
    return data;
  };

  /**
   * @template {string} T
   * @param {T} subpath
   * @returns {TypedPublished<T>}
   */
  const readPublished = subpath =>
    /** @type {TypedPublished<T>} */ (readLatest(`published.${subpath}`));

  let lastBankNonce = 0n;
  let ibcSequenceNonce = 0;
  let lcaSequenceNonce = 0;
  let lcaAccountsCreated = 0;

  const outboundMessages = new Map();

  /** @type {Awaited<ReturnType<typeof buildSwingset>>['bridgeInbound'] | undefined} */
  let bridgeInbound;

  /** @type {Awaited<ReturnType<typeof buildSwingset>>['bridgeInbound']} */
  const inbound = (...args) => {
    console.log('inbound', ...args);
    bridgeInbound(...args);
  };
  /**
   * Config DIBC bridge behavior.
   * Defaults to `Queued` unless specified.
   * Current only configured for `channelOpenInit` but can be
   * extended to support `sendPacket`.
   * @type {Partial<Record<BridgeId, Partial<Record<IBCDowncallMethod, AckBehaviorType>>>>}
   */
  const ackBehaviors = {
    [BridgeId.DIBC]: {
      startChannelOpenInit: AckBehavior.Queued,
    },
  };

  /**
   * @param {BridgeId} bridgeId
   * @param {IBCDowncallMethod} method
   */
  const shouldAckImmediately = (bridgeId, method) =>
    ackBehaviors?.[bridgeId]?.[method] === AckBehavior.Immediate;

  /**
   * configurable `bech32Prefix` for DIBC bridge
   * messages that involve creating an ICA.
   */
  let bech32Prefix = 'cosmos';
  /**
   * Adds the sequence so the bridge knows what response to connect it to.
   * Then queue it send it over the bridge over this returns.
   * Finally return the packet that will be sent.
   * @param {IBCMethod<'sendPacket'>} obj
   * @param {string} ack
   */
  const ackImmediately = (obj, ack) => {
    ibcSequenceNonce += 1;
    const msg = icaMocks.ackPacketEvent(obj, ibcSequenceNonce, ack);
    setTimeout(() => {
      /**
       * Mock when Agoric receives the ack from another chain over DIBC. Always
       * happens after the packet is returned.
       */
      inbound(BridgeId.DIBC, msg);
    });
    return msg.packet;
  };

  /** @type {[bridgeId: BridgeId, arg1: unknown][]} */
  const inboundQueue = [];
  /**
   * Add a message that will be sent to the bridge by flushInboundQueue.
   * @param {BridgeId} bridgeId
   * @param {unknown} arg1
   */
  const pushInbound = (bridgeId, arg1) => {
    inboundQueue.push([bridgeId, arg1]);
  };
  /**
   * Like ackImmediately but defers in the inbound receiverAck
   * until `bridgeQueue()` is awaited.
   * @param {IBCMethod<'sendPacket'>} obj
   * @param {string} ack
   */
  const ackLater = (obj, ack) => {
    ibcSequenceNonce += 1;
    const msg = icaMocks.ackPacketEvent(obj, ibcSequenceNonce, ack);
    pushInbound(BridgeId.DIBC, msg);
    return msg.packet;
  };

  /**
   * Mock the bridge outbound handler. The real one is implemented in Golang so
   * changes there will sometimes require changes here.
   * @param {BridgeId} bridgeId
   * @param {any} obj
   */
  const bridgeOutbound = (bridgeId, obj) => {
    // store all messages for querying by tests
    if (!outboundMessages.has(bridgeId)) {
      outboundMessages.set(bridgeId, []);
    }
    outboundMessages.get(bridgeId).push(obj);

    switch (bridgeId) {
      case BridgeId.BANK: {
        trace(
          'bridgeOutbound bank',
          obj.type,
          obj.recipient,
          obj.amount,
          obj.denom,
        );
        break;
      }
      case BridgeId.STORAGE:
        return storage.toStorage(obj);
      case BridgeId.PROVISION:
      case BridgeId.PROVISION_SMART_WALLET:
      case BridgeId.WALLET:
        console.warn('Bridge returning undefined for', bridgeId, ':', obj);
        return undefined;
      default:
        break;
    }

    const bridgeTargetRegistered = new Set();
    const bridgeType = `${bridgeId}:${obj.type}`;
    switch (bridgeType) {
      case `${BridgeId.BANK}:VBANK_GET_MODULE_ACCOUNT_ADDRESS`: {
        // bridgeOutbound bank : {
        //   moduleName: 'vbank/reserve',
        //   type: 'VBANK_GET_MODULE_ACCOUNT_ADDRESS'
        // }
        const { moduleName } = obj;
        const moduleDescriptor = Object.values(VBankAccount).find(
          ({ module }) => module === moduleName,
        );
        if (!moduleDescriptor) {
          return 'undefined';
        }
        return moduleDescriptor.address;
      }

      // Observed message:
      // address: 'agoric1megzytg65cyrgzs6fvzxgrcqvwwl7ugpt62346',
      // denom: 'ibc/toyatom',
      // type: 'VBANK_GET_BALANCE'
      case `${BridgeId.BANK}:VBANK_GET_BALANCE`: {
        // TODO consider letting config specify vbank assets
        // empty balances for test.
        return '0';
      }

      case `${BridgeId.BANK}:VBANK_GRAB`:
      case `${BridgeId.BANK}:VBANK_GIVE`: {
        lastBankNonce += 1n;
        // Also empty balances.
        return harden({
          type: 'VBANK_BALANCE_UPDATE',
          nonce: `${lastBankNonce}`,
          updated: [],
        });
      }

      case `${BridgeId.CORE}:IBC_METHOD`:
      case `${BridgeId.DIBC}:IBC_METHOD`:
      case `${BridgeId.VTRANSFER}:IBC_METHOD`: {
        switch (obj.method) {
          case 'startChannelOpenInit': {
            const message = icaMocks.channelOpenAck(obj, bech32Prefix);
            if (
              ackBehaviors?.[bridgeId]?.startChannelOpenInit ===
              AckBehavior.Never
            ) {
              return undefined;
            }
            const handle = shouldAckImmediately(
              bridgeId,
              'startChannelOpenInit',
            )
              ? inbound
              : pushInbound;
            handle(BridgeId.DIBC, message);
            return undefined;
          }
          case 'sendPacket': {
            if (protoMsgMockMap[obj.packet.data]) {
              return ackLater(obj, protoMsgMockMap[obj.packet.data]);
            }
            // An error that would be triggered before reception on another chain
            return ackImmediately(obj, protoMsgMocks.error.ack);
          }
          default:
            return undefined;
        }
      }
      case `${BridgeId.VTRANSFER}:BRIDGE_TARGET_REGISTER`: {
        bridgeTargetRegistered.add(obj.target);
        return undefined;
      }
      case `${BridgeId.VTRANSFER}:BRIDGE_TARGET_UNREGISTER`: {
        bridgeTargetRegistered.delete(obj.target);
        return undefined;
      }
      case `${BridgeId.VLOCALCHAIN}:VLOCALCHAIN_ALLOCATE_ADDRESS`: {
        const address = makeTestAddress(lcaAccountsCreated);
        lcaAccountsCreated += 1;
        return address;
      }
      case `${BridgeId.VLOCALCHAIN}:VLOCALCHAIN_EXECUTE_TX`: {
        lcaSequenceNonce += 1;
        return obj.messages.map(message =>
          fakeLocalChainBridgeTxMsgHandler(message, lcaSequenceNonce),
        );
      }
      default: {
        throw Error(`FIXME missing support for ${bridgeId}: ${obj.type}`);
      }
    }
  };

  let slogSender;
  if (slogFile) {
    slogSender = await makeSlogSender({
      stateDir: '.',
      env: {
        ...process.env,
        SLOGFILE: slogFile,
        SLOGSENDER: '',
      },
    });
  }
  const mailboxStorage = new Map();
  const buildResult = await buildSwingset(
    mailboxStorage,
    bridgeOutbound,
    kernelStorage,
    configPath,
    [],
    {},
    {
      callerWillEvaluateCoreProposals: false,
      debugName: 'TESTBOOT',
      verbose,
      slogSender,
      profileVats,
      debugVats,
    },
  );

  const { controller, timer } = buildResult;
  bridgeInbound = buildResult.bridgeInbound;

  console.timeLog('makeBaseSwingsetTestKit', 'buildSwingset');

  // XXX This initial run() might not be necessary. Tests pass without it as of
  // 2025-02, but we suspect that `makeSwingsetTestKit` just isn't being
  // exercised in the right way.
  await controller.run();
  const runUtils = makeBootstrapRunUtils(controller, harness);

  const buildProposal = makeProposalExtractor({
    childProcess: childProcessAmbient,
    fs: fsAmbientPromises,
  });

  /**
   * @param {ERef<Awaited<ReturnType<typeof buildProposal>>>} proposalP
   */
  const evalProposal = async proposalP => {
    const { EV } = runUtils;

    const proposal = harden(await proposalP);

    for await (const bundle of proposal.bundles) {
      await controller.validateAndInstallBundle(bundle);
    }
    log('installed', proposal.bundles.length, 'bundles');

    log('executing proposal');
    const bridgeMessage = {
      type: 'CORE_EVAL',
      evals: proposal.evals,
    };
    log({ bridgeMessage });
    /** @type {BridgeHandler} */
    const coreEvalBridgeHandler = await EV.vat('bootstrap').consumeItem(
      'coreEvalBridgeHandler',
    );
    await EV(coreEvalBridgeHandler).fromBridge(bridgeMessage);
    log(`proposal executed`);
  };

  console.timeEnd('makeBaseSwingsetTestKit');

  let currentTime = 0n;
  const updateTimer = async time => {
    await timer.poll(time);
  };
  /**
   * @param {Timestamp} targetTime
   */
  const jumpTimeTo = targetTime => {
    targetTime = TimeMath.absValue(targetTime);
    targetTime >= currentTime ||
      Fail`cannot reverse time :-(  (${targetTime} < ${currentTime})`;
    currentTime = targetTime;
    trace('jumpTimeTo', currentTime);
    return runUtils.queueAndRun(() => updateTimer(currentTime), true);
  };
  /**
   * @param {Timestamp} targetTime
   */
  const advanceTimeTo = async targetTime => {
    targetTime = TimeMath.absValue(targetTime);
    targetTime >= currentTime ||
      Fail`cannot reverse time :-(  (${targetTime} < ${currentTime})`;
    while (currentTime < targetTime) {
      trace('stepping time from', currentTime, 'towards', targetTime);
      currentTime += 1n;
      await runUtils.queueAndRun(() => updateTimer(currentTime), true);
    }
  };
  /**
   * @param {number} n
   * @param {'seconds' | 'minutes' | 'hours' | 'days'} unit
   */
  const advanceTimeBy = (n, unit) => {
    const multiplier = {
      seconds: 1,
      minutes: 60,
      hours: 60 * 60,
      days: 60 * 60 * 24,
    };
    const targetTime = currentTime + BigInt(multiplier[unit] * n);
    trace('advanceTimeBy', n, unit, 'to', targetTime);
    return advanceTimeTo(targetTime);
  };

  const shutdown = async () =>
    Promise.all([controller.shutdown(), hostStorage.close()]).then(() => {});

  const getCrankNumber = () => Number(kernelStorage.kvStore.get('crankNumber'));

  const bridgeUtils = {
    /** Immediately handle the inbound message */
    inbound: bridgeInbound,
    /**
     * @param {string} bridgeId
     */
    getOutboundMessages: bridgeId =>
      harden([...outboundMessages.get(bridgeId)]),
    getInboundQueueLength: () => inboundQueue.length,
    /**
     * @param {BridgeId} bridgeId
     * @param {IBCDowncallMethod} method
     * @param {AckBehaviorType} behavior
     * @returns {void}
     */
    setAckBehavior(bridgeId, method, behavior) {
      if (!ackBehaviors?.[bridgeId]?.[method])
        throw Fail`ack behavior not yet configurable for ${bridgeId} ${method}`;
      console.log('setting', bridgeId, method, 'ack behavior to', behavior);
      ackBehaviors[bridgeId][method] = behavior;
    },
    /**
     * @param {BridgeId} bridgeId
     * @param {IBCDowncallMethod} method
     * @returns {AckBehaviorType}
     */
    lookupAckBehavior(bridgeId, method) {
      if (!ackBehaviors?.[bridgeId]?.[method])
        throw Fail`ack behavior not yet configurable for ${bridgeId} ${method}`;
      return ackBehaviors[bridgeId][method];
    },
    /**
     * @param {string} prefix
     * @returns {void}
     */
    setBech32Prefix(prefix) {
      bech32Prefix = prefix;
    },
    /**
     * @param {number} [max] the max number of messages to flush
     * @returns {Promise<number>} the number of messages flushed
     */
    async flushInboundQueue(max = Number.POSITIVE_INFINITY) {
      console.log('🚽');
      let i = 0;
      for (i = 0; i < max; i += 1) {
        const args = inboundQueue.shift();
        if (!args) break;

        await runUtils.queueAndRun(() => inbound(...args), true);
      }
      console.log('🧻');
      return i;
    },
    /**
     * @param {BridgeId} bridgeId
     * @param {unknown} msg
     */
    async runInbound(bridgeId, msg) {
      await runUtils.queueAndRun(() => inbound(bridgeId, msg), true);
    },
  };

  /**
   * @param {string} nameSubstr
   */
  const getVatDetailsByName = async nameSubstr => {
    // XXX make every time because vatsByName is a snapshot during makeHelpers()
    const { stable } = makeHelpers({
      db: swingStore.internal.db,
      EV: runUtils.EV,
    });
    // array-ify so we can flatten the array when names collide
    const allVats = [...stable.vatsByName.values()].flat(1);
    const matches = allVats.filter(v => v.name.includes(nameSubstr));

    return matches.map(vat => {
      const stmt = stable.db.prepare(
        'SELECT incarnation FROM transcriptSpans WHERE isCurrent = 1 AND vatID = ?',
      );
      const { incarnation } = /** @type {any} */ (stmt.get(vat.vatID));
      return { ...vat, incarnation };
    });
  };

  return {
    advanceTimeBy,
    advanceTimeTo,
    bridgeUtils,
    buildProposal,
    controller,
    evalProposal,
    getCrankNumber,
    getVatDetailsByName,
    jumpTimeTo,
    readLatest,
    readPublished,
    runUtils,
    shutdown,
    storage,
    swingStore,
    timer,
  };
};

/** @typedef {Awaited<ReturnType<typeof makeSwingsetTestKit>>} SwingsetTestKit */

/**
 * Return a harness that can be dynamically configured to provide a computron-
 * counting run policy (and queried for the count of computrons recorded since
 * the last reset).
 */
/**
 * Creates a harness for measuring computron usage in SwingSet tests.
 *
 * The harness can be dynamically configured to provide a computron-counting
 * run policy and queried for the count of computrons recorded since the last reset.
 *
 * @returns A harness object with methods to control and query computron counting
 */
export const makeSwingsetHarness = () => {
  const c2b = defaultBeansPerXsnapComputron;
  const beansPerUnit = {
    // see https://cosgov.org/agoric?msgType=parameterChangeProposal&network=main
    blockComputeLimit: 65_000_000n * c2b,
    vatCreation: defaultBeansPerVatCreation,
    xsnapComputron: c2b,
  };

  /** @type {ReturnType<typeof computronCounter> | undefined} */
  let policy;
  let policyEnabled = false;

  const meter = harden({
    provideRunPolicy: () => {
      if (policyEnabled && !policy) {
        policy = computronCounter({ beansPerUnit });
      }
      return policy;
    },
    /** @param {boolean} forceEnabled */
    useRunPolicy: forceEnabled => {
      policyEnabled = forceEnabled;
      if (!policyEnabled) {
        policy = undefined;
      }
    },
    totalComputronCount: () => (policy?.totalBeans() || 0n) / c2b,
    resetRunPolicy: () => (policy = undefined),
  });
  return meter;
};

/**
 * Validates that a string is a valid SwingSet manager type.
 *
 * @param {string} mt - The manager type string to validate
 * @returns {asserts mt is ManagerType}
 * @throws If the string is not a valid manager type
 */
export function insistManagerType(mt) {
  assert(['local', 'node-subprocess', 'xsnap', 'xs-worker'].includes(mt));
}

// TODO explore doing this as part of a post-install script
// and having the test import it statically instead of fetching lazily
/**
 * Fetch a core-eval from a Github Release.
 *
 * NB: has ambient authority to fetch and cache to disk. Allowable as a testing utility.
 * @param {{ repo: string; release: string; name: string }} config
 * @param {string} [artifacts]
 * @param {string} [planUrl]
 */
export const fetchCoreEvalRelease = async (
  config,
  artifacts = `https://github.com/${config.repo}/releases/download/${config.release}`,
  planUrl = `${artifacts}/${config.name}-plan.json`,
) => {
  const fetch = fetchCached;

  try {
    const planResponse = await fetch(planUrl);
    if (planResponse.ok) {
      const plan = /**
         @type {{
        name: string;
        permit: string;
        script: string;
        bundles: Array<{
          bundleID: string;
          entrypoint: string;
          fileName: string;
        }>;
      }} */ (await planResponse.json());

      assert.equal(plan.name, config.name);
      const script = await fetch(`${artifacts}/${plan.script}`).then(r =>
        r.text(),
      );
      const permit = await fetch(`${artifacts}/${plan.permit}`).then(r =>
        r.text(),
      );
      /** @type {EndoZipBase64Bundle[]} */
      const bundles = await Promise.all(
        plan.bundles.map(b =>
          fetch(`${artifacts}/${b.bundleID}.json`).then(r => r.json()),
        ),
      );

      return { bundles, evals: [{ js_code: script, json_permits: permit }] };
    }
  } catch (error) {
    console.warn(
      `Plan file not found at ${planUrl}. Falling back to direct artifact detection.`,
    );
  }

  try {
    // Assume standard naming conventions for script and permit
    const scriptName = `${config.name}.js`;
    const permitName = `${config.name}-permit.json`;

    // Fetch script and permit directly
    const scriptResponse = await fetch(`${artifacts}/${scriptName}`);
    if (!scriptResponse.ok) {
      throw new Error(`Script not found at ${artifacts}/${scriptName}`);
    }
    const script = await scriptResponse.text();

    const permitResponse = await fetch(`${artifacts}/${permitName}`);
    if (!permitResponse.ok) {
      throw new Error(`Permit not found at ${artifacts}/${permitName}`);
    }
    const permit = await permitResponse.text();

    // Parse script to detect bundle references
    const bundlePattern = /"(b1-[a-f0-9]+)"/g;
    const bundleMatches = [];

    let match = bundlePattern.exec(script);
    while (match !== null) {
      if (match[1]) {
        bundleMatches.push(match[1]);
      }
      match = bundlePattern.exec(script);
    }

    const uniqueBundleIds = [...new Set(bundleMatches)];
    if (uniqueBundleIds.length === 0) {
      throw new Error(
        'No bundle IDs found in script. Cannot proceed without bundle information.',
      );
    }
    /** @type {EndoZipBase64Bundle[]} */
    const bundles = await Promise.all(
      uniqueBundleIds.map(bundleId =>
        fetch(`${artifacts}/${bundleId}.json`).then(r => r.json()),
      ),
    );

    return { bundles, evals: [{ js_code: script, json_permits: permit }] };
  } catch (error) {
    console.error('Fallback approach failed:', error);
    throw new Error(
      `Failed to fetch release artifacts for ${config.name}: ${error.message}`,
    );
  }
};
