/**
 * @file Test using bundleSource() on the contract.
 */

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { createRequire } from 'module';
import bundleSource from '@endo/bundle-source';
import { E, passStyleOf } from '@endo/far';
import { makeZoeKitForTest } from '@agoric/zoe/tools/setup-zoe.js';
import { promisify } from 'util';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { Buffer } from 'buffer';
import { gzip } from 'zlib';
import { makeNodeBundleCache } from '@endo/bundle-source/cache.js';

const myRequire = createRequire(import.meta.url);
const contractPath = myRequire.resolve(`../dist/qstn.contract.bundle.js`);

const trace = (...msgs) => console.log('[build-proposal.test]', ...msgs);

test.before(async t => {
  const bundleCache = await makeNodeBundleCache('bundles', {}, s => import(s));

  console.log('running..');

  /**
   * @param {string} name of an _already cached_ bundle
   */
  const compressBundle = async name => {
    // NOTE load options must match those used in the proposal builder
    const bundle = await bundleCache.load('', name, trace, {
      elideComments: true,
    });
    const fileContents = JSON.stringify(bundle);
    const buffer = Buffer.from(fileContents, 'utf-8');
    const compressed = await promisify(gzip)(buffer);
    return { bundle, compressed };
  };

  const $ = (file, ...args) => {
    console.log('$', file, ...args);

    return new Promise((resolve, reject) => {
      execFile(file, args, { encoding: 'utf8' }, (err, out) => {
        if (err) return reject(err);
        resolve(out);
      });
    });
  };

  const runPackageScript = async (scriptName, ...args) =>
    $('yarn', 'run', '--silent', scriptName, ...args);

  const listBundles = async (bundleDir = 'bundles') => {
    const candidates = await fs.readdir(bundleDir);
    const matches = candidates.filter(n => /^bundle-.*\.js$/.test(n));
    console.log('listBundles', { candidates, matches });
    return matches.map(base => {
      const name = base.replace(/^bundle-/, '').replace(/\.js$/, '');
      return name;
    });
  };
  t.context = { compressBundle, $, runPackageScript, listBundles };
});

test('bundleSource() bundles the contract for use with zoe', async t => {
  const { runPackageScript } = t.context;

  await runPackageScript('build');

  const bundle = await bundleSource(contractPath);
  t.is(bundle.moduleFormat, 'endoZipBase64');
  t.log(bundle.endoZipBase64Sha512);
  t.true(bundle.endoZipBase64.length > 10_000);

  const { zoeService: zoe } = await makeZoeKitForTest();
  const installation = await E(zoe).install(bundle);
  t.log(installation);

  t.is(passStyleOf(installation), 'remotable');
});
