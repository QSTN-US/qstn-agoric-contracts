#! /usr/bin/env node
import { execa } from 'execa';
import fs from 'fs';

const planFile = process.env.planFile;
if (!planFile) throw new Error('PLAN_FILE environment variable is required.');

const CI = process.env.CI === 'true';
const runInsideContainer = process.env.runInsideContainer === 'true';

const CHAINID = 'agoricdev-25';
const GAS_ADJUSTMENT = '1.2';
const SIGN_BROADCAST_OPTS = `--chain-id=${CHAINID} --gas=auto --gas-adjustment=${GAS_ADJUSTMENT} --yes -b block --node https://devnet.rpc.agoric.net`;
const WALLET_NAME = 'qstn';

let script = '';
let permit = '';
let bundleFiles = [];

/**
 * Execute a command either directly or inside a Docker container
 * @param {string} cmd - Command to execute
 */
const execCmd = async (cmd) => {
  const args = ['-c', cmd];
  const opts = { stdio: 'inherit' };
  return runInsideContainer
    ? // @ts-ignore
      execa('docker', ['exec', '-i', 'agoric', 'bash', ...args], opts)
    : // @ts-ignore
      execa('bash', args, opts);
};

/**
 * Extract a value from the plan file using jq
 * @param {string} jqCmd - jq query command
 */
const jqExtract = async (jqCmd) => {
  const { stdout } = await execa('jq', ['-r', jqCmd, planFile]);
  return stdout;
};

/**
 * Parse script and permit paths from plan file
 */
const setPermitAndScript = async () => {
  console.log('Parsing script and permit from plan file...');
  script = await jqExtract('.script');
  permit = await jqExtract('.permit');

  if (CI) {
    script = `./${script}`;
    permit = `./${permit}`;
  }

  if (!script || !permit) {
    throw new Error(`Failed to parse script and permit from ${planFile}`);
  }
};

/**
 * Parse bundle file paths from plan file
 */
const setBundleFiles = async () => {
  console.log('Parsing bundle files from plan...');
  const sourceKey = CI ? '.bundles[].fileName' : '.bundles[].bundleID';
  const suffix = CI ? '' : '.json';

  const result = await jqExtract(sourceKey);
  bundleFiles = result
    .split('\n')
    .filter(Boolean)
    .map((line) => `${line}${suffix}`);
};

/**
 * Copy bundle files to target directory (non-CI environments)
 */
const copyFilesLocally = async () => {
  if (CI) {
    console.log('Skipping file copy: running in CI environment');
    return;
  }

  const targetDir = './';

  console.log('Copying bundle files...');
  const files = (await jqExtract('.bundles[].fileName')).split('\n');
  for (const file of files) {
    if (fs.existsSync(file)) {
      await execa('cp', [file, targetDir]);
    } else {
      console.warn(`Warning: File ${file} not found.`);
    }
  }
};

/**
 * Install bundles on the Agoric chain
 */
const installBundles = async () => {
  for (const b of bundleFiles) {
    const cmd = `cd . && echo 'Installing ${b}' && ls -sh '${b}' && agd tx swingset install-bundle --compress '@${b}' --from ${WALLET_NAME} -bblock ${SIGN_BROADCAST_OPTS}`;
    console.log(`Installing bundle: ${b}`);
    await execCmd(cmd);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};

/**
 * Submit and accept core-eval proposal
 */
const acceptProposal = async () => {
  console.log(`Submitting core-eval proposal for ${script}`);

  const baseDir = '.';
  const submitCommand = `cd ${baseDir} && agd tx gov submit-proposal swingset-core-eval ${permit} ${script} --title='Install QSTN Router' --description='Deploy QSTN Router Contract' --deposit=1000000ubld --from ${WALLET_NAME} ${SIGN_BROADCAST_OPTS} -o json`;
  await execCmd(submitCommand);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const queryCmd = `cd ${baseDir} && agd query gov proposals --node https://devnet.rpc.agoric.net --output json | jq -c '[.proposals[] | if .proposal_id == null then .id else .proposal_id end | tonumber] | max'`;

  const result = runInsideContainer
    ? await execa('docker', ['exec', '-i', 'agoric', 'bash', '-c', queryCmd])
    : await execa('bash', ['-c', queryCmd]);

  const proposalId = runInsideContainer
    ? result.stdout
    : (() => {
        const match = result.stdout.match(/\n(\d+)$/);
        return match?.[1];
      })();

  console.log(`Submitted proposal ID: ${proposalId}`);
};

/**
 * Main deployment flow
 */
const main = async () => {
  try {
    if (!fs.existsSync('/usr/bin/jq')) {
      console.log('Installing jq...');
      await execCmd('apt-get install -y jq');
    }

    await setPermitAndScript();
    await setBundleFiles();

    console.log('Configuration:');
    console.log('  Bundle files:', bundleFiles);
    console.log('  Script:', script);
    console.log('  Permit:', permit);

    await copyFilesLocally();
    await installBundles();
    await acceptProposal();

    console.log('Deployment completed successfully!');
  } catch (err) {
    console.error('Deployment failed:', err.message);
    process.exit(1);
  }
};

main();
