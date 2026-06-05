#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Boa = require('../src/boa');
const { BoaSite } = require('../src/boa_site');

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return fallback;
}

function loadIdentity() {
  const username = readArg('username', process.env.BOA_USERNAME);
  const password = readArg('password', process.env.BOA_PASSWORD);
  const plan = readArg('plan', process.env.BOA_PLAN || 'solo');
  if (!username || !password) {
    throw new Error('Provide --username/--password or BOA_USERNAME/BOA_PASSWORD. Do not commit real passwords.');
  }
  return Boa.deriveLicense(username, password, { plan });
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function commandInit() {
  const license = loadIdentity();
  print({
    licenseId: license.licenseId,
    usernameKey: license.usernameKey,
    privacyScope: license.privacyScope,
    languageId: license.passwordLanguage.languageId,
    plan: license.plan,
    heartbeatUrl: license.heartbeatUrl,
    detectedDialect: Boa.detectRuntimeDialect(),
  });
}

function commandTranslate() {
  const license = loadIdentity();
  const target = readArg('target', Boa.detectRuntimeDialect());
  const intent = readArg('intent', process.argv.slice(3).filter((arg) => !arg.startsWith('--')).join(' '));
  print(Boa.translateCommand(intent, target, license));
}

function commandWrap() {
  const license = loadIdentity();
  const inputPath = readArg('input');
  const outputPath = readArg('output', 'boa.bundle.json');
  if (!inputPath) throw new Error('wrap requires --input <file>.');
  const payload = fs.readFileSync(inputPath, 'utf8');
  const equation = Boa.createTransferEquation(payload, license, { kind: 'file', path: inputPath });
  const bundle = {
    format: 'boa-unified-bundle-v1',
    heartbeatUrl: license.heartbeatUrl,
    usernameKey: license.usernameKey,
    languageId: license.passwordLanguage.languageId,
    reader: 'Load src/boa.js, derive the same username/password license, then call solveTransferEquation(bundle.equation, license).',
    equation,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
  print({ outputPath, payloadHash: equation.payloadHash, languageId: equation.languageId });
}

async function commandServe() {
  const port = Number(readArg('port', process.env.BOA_SITE_PORT || 8787));
  const host = readArg('host', process.env.BOA_SITE_HOST || '127.0.0.1');
  const statePath = readArg('state', process.env.BOA_STATE_PATH || '.boa-state.json');
  const baseUrl = readArg('base-url', process.env.BOA_BASE_URL || `http://${host}:${port}`);
  const site = new BoaSite({ statePath, baseUrl, port });
  await site.listen({ port, host });
  print({ status: 'online', dashboard: baseUrl, statePath });
}

function commandSiteSignup() {
  const username = readArg('username', process.env.BOA_USERNAME);
  const password = readArg('password', process.env.BOA_PASSWORD);
  const plan = readArg('plan', process.env.BOA_PLAN || 'solo');
  const statePath = readArg('state', process.env.BOA_STATE_PATH || '.boa-state.json');
  const site = new BoaSite({ statePath, baseUrl: readArg('base-url', 'http://127.0.0.1:8787') });
  print(site.createAccount({ username, password, plan }));
}

function usage() {
  print({
    commands: {
      init: 'Show derived license/lattice metadata without printing the password.',
      translate: 'Translate --intent for --target using the password language.',
      wrap: 'Create a unified equation bundle from --input and write --output.',
      serve: 'Run the BOA account/dashboard site that issues daemon downloads.',
      'site-signup': 'Create a dashboard account in the site state store from the CLI.',
    },
    identity: 'Use BOA_USERNAME, BOA_PASSWORD, and BOA_PLAN or pass --username/--password/--plan.',
  });
}

async function main() {
  const command = process.argv[2] || 'help';
  if (command === 'init') commandInit();
  else if (command === 'translate') commandTranslate();
  else if (command === 'wrap') commandWrap();
  else if (command === 'serve') await commandServe();
  else if (command === 'site-signup') commandSiteSignup();
  else usage();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
