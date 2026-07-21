#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { collectPreflight } = require('./aws-apprunner-preflight');

function hasArg(name) {
  return process.argv.includes(name);
}

function main() {
  const preflight = collectPreflight({ skipAwsCli: false });
  if (!preflight.ok) {
    process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  if (hasArg('--dry-run')) {
    process.stdout.write(`${JSON.stringify({ ok: true, dryRun: true, preflight }, null, 2)}\n`);
    return;
  }
  const result = spawnSync('aws', [
    'apprunner',
    'start-deployment',
    '--region', process.env.AWS_REGION,
    '--service-arn', process.env.APP_RUNNER_SERVICE_ARN,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return;
  }
}

if (require.main === module) main();
