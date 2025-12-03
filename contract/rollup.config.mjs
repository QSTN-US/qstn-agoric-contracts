/**
 * @file rollup configuration to bundle core-eval script
 *
 * Supports developing core-eval script, permit as a module:
 *   - import { E } from '@endo/far'
 *     We can strip this declaration during bundling
 *     since the core-eval scope includes exports of @endo/far
 *   - `bundleID = ...` is replaced using updated/cached bundle hash
 *   - `main` export is appended as script completion value
 *   - `permit` export is emitted as JSON
 */
// @ts-check
import process from 'node:process';
import {
  coreEvalGlobals,
  moduleToScript,
  configureBundleID,
  emitPermit,
  configureOptions,
} from './tools/rollup-plugin-core-eval.js';
import { permit as qstnPermit } from './src/proposals/qstn.proposal.js';
import { getBuildOpts } from './tools/qstn-builder.js';
import { deployConfig } from './config.js';

/**
 * @param {*} opts
 * @returns {import('rollup').RollupOptions}
 */
const config1 = ({
  name,
  coreEntry = `./src/proposals/${name}.proposal.js`,
  contractEntry = `./src/${name}.contract.js`,
  coreScript = `bundles/deploy-${name}.js`,
  coreScriptOptions = undefined,
  permitFile = `deploy-${name}-permit.json`,
  permit,
}) => ({
  input: coreEntry,
  output: {
    globals: coreEvalGlobals,
    file: coreScript,
    format: 'es',
    footer: 'main',
  },
  external: ['@endo/far'],
  plugins: [
    ...(contractEntry
      ? [
          configureBundleID({
            name,
            rootModule: contractEntry,
            cache: 'bundles',
          }),
        ]
      : []),
    ...(coreScriptOptions
      ? [configureOptions({ options: coreScriptOptions })]
      : []),
    moduleToScript(),
    emitPermit({ permit, file: permitFile }),

  ],
});

const { env } = process;

/** @type {Promise<import('rollup').RollupOptions[]>} */
const config = getBuildOpts(deployConfig.network, deployConfig.peers).then(
  buildOpts => [
    config1({
      name: 'qstn',
      permit: qstnPermit,
      contractEntry: './dist/qstn.contract.bundle.js',
      coreScriptOptions: {
        qstnCommittee: {
          voterAddresses: env.SWAP_GOV_ADDR ? { v1: env.SWAP_GOV_ADDR } : {},
        },
        qstn: buildOpts,
      },
    }),
  ],
);


export default config;
