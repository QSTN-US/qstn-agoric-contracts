#!/usr/bin/env -S node --import ts-blank-space/register
import '@endo/init/debug.js';

import { fetchNetworkConfig } from '@agoric/client-utils';
import {
  installBundles,
  runBuilder,
  submitCoreEval,
  txFlags,
  waitForBlock,
} from '@agoric/deploy-script-support/src/permissioned-deployment.js';
import { toCLIOptions } from '@agoric/internal/src/cli-utils.js';
import { makeCmdRunner, makeFileRd } from '@agoric/pola-io';
import { execa } from 'execa';
import fsp from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { parseArgs, type ParseArgsConfig } from 'node:util';

const TITLE = 'QSTN Evaluation Proposal';

const USAGE = 'deploy-cli <builder> <key=val>... [--net N] [--from K]';

const options = /** @type {const} */ {
  net: { type: 'string', default: 'devnet' },
  from: { type: 'string', default: 'genesis' },
  title: { type: 'string', default: TITLE },
  description: { type: 'string' },
} as const satisfies ParseArgsConfig['options'];

type ParsedArgs = {
  net: string;
  from: string;
  title: string;
  description?: string;
};

const inheritSterr = opts => ({
  ...opts,
  stdio: [...opts.stdio.slice(0, 2), 'inherit'],
});

const main = async (
  argv = process.argv,
  {
    fetch = globalThis.fetch,
    execFile = (cmd, args, opts) =>
      execa({ verbose: 'short' })(cmd, args, inheritSterr(opts)),
  } = {},
) => {
  const getVersion = () =>
    makeCmdRunner('git', { execFile })
      .exec('describe --tags --dirty --always'.split(' '))
      .then(it => it.stdout.trim());

  await null;
  // Parse CLI arguments: builder script path and optional key=value bindings
  const {
    values: { from, net, title, description: descriptionArg },
    positionals: [builder, ...bindings],
  } = parseArgs({ args: argv.slice(2), options, allowPositionals: true }) as {
    positionals: string[];
    values: ParsedArgs;
  };

  const description = descriptionArg || (await getVersion());
  if (!builder) throw Error(USAGE);
  if (!['followmain', 'devnet', 'local'].includes(net)) {
    throw Error(
      `Invalid net: ${net}. Must be 'followmain', 'devnet', or 'local'`,
    );
  }

  // Set working directory to package root
  const pkg = path.join(url.fileURLToPath(import.meta.url), '../../');
  process.chdir(pkg);

  const pkgRd = makeFileRd(pkg, { fsp, path });

  // Step 1: Build the main contract core-eval plan
  const agoric = makeCmdRunner('npx', { execFile }).subCommand('agoric');
  // Convert key=value bindings to --key value CLI options
  const opts = [
    '--net',
    net,
    ...bindings
      .map(b => {
        const [n, v] = b.split('=', 2);
        return [`--${n}`, v];
      })
      .flat(),
  ];
  console.log('running', builder);
  const plan = await runBuilder(agoric, pkgRd.join(builder), opts, {
    cwd: pkgRd,
  });
  console.log(`${plan.name}.js`, 'etc.');

  // Step 2: Install contract bundles to the chain
  const {
    chainName: chainId,
    rpcAddrs: [node],
  } = await fetchNetworkConfig(net, { fetch });
  const agdq = makeCmdRunner('agd', { execFile }).withFlags('--node', node);
  const agdTx = agdq.withFlags(
    ...toCLIOptions(txFlags({ node, from, chainId })),
    '--yes',
  );

  // Each bundle contains the contract code and must be installed before core-eval
  for (const b of plan.bundles) {
    const shortID = b.bundleID.slice(0, 8);
    console.log('installing', shortID, '...');
    await waitForBlock(agdq);
    const [{ txhash }] = await installBundles(agdTx, [b], pkgRd);
    console.log('installed', shortID, txhash);
  }

  // Step 3: Submit the core-eval proposal to deploy the contract
  const timeShort = new Date().toISOString().substring(11, 16);
  await waitForBlock(agdq);
  const info = await submitCoreEval(agdTx, [plan], {
    title: `${title} ${timeShort}`,
    description,
  });
  console.log(title, info);

  // Step 4: Auto-vote on local network to immediately pass the proposal
  if (net === 'local') {
    console.log('Local network detected, submitting vote...');
    const yarn = makeCmdRunner('yarn', { execFile });
    await yarn.exec(['docker:make', 'vote']);
    console.log('Vote submitted successfully');
  }

  throw Error('TODO: wait for tx? wait for voting end?');
};

main().catch(err => {
  console.log(err);
  process.exit(1);
});
