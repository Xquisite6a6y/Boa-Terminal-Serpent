#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

function hasArg(name) {
  return process.argv.includes(name);
}

function mask(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 10) return 'present';
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
}

function awsCliAvailable() {
  const result = spawnSync('aws', ['--version'], { encoding: 'utf8' });
  return result.status === 0;
}

function collectPreflight(options = {}) {
  const env = process.env;
  const required = ['AWS_REGION', 'APP_RUNNER_SERVICE_ARN'];
  const missing = required.filter((name) => !env[name]);
  const authModes = {
    oidcRole: Boolean(env.AWS_ROLE_TO_ASSUME),
    accessKeyEnv: Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
    profile: Boolean(env.AWS_PROFILE),
  };
  if (!authModes.oidcRole && !authModes.accessKeyEnv && !authModes.profile) {
    missing.push('AWS_ROLE_TO_ASSUME or AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY');
  }
  const cliAvailable = options.skipAwsCli ? true : awsCliAvailable();
  if (!cliAvailable) missing.push('aws CLI');
  return {
    ok: missing.length === 0,
    missing,
    safe: true,
    message: missing.length === 0 ? 'AWS App Runner deployment environment is ready.' : 'AWS App Runner deployment environment is incomplete.',
    values: {
      AWS_REGION: env.AWS_REGION || null,
      APP_RUNNER_SERVICE_ARN: mask(env.APP_RUNNER_SERVICE_ARN),
      AWS_ROLE_TO_ASSUME: mask(env.AWS_ROLE_TO_ASSUME),
      AWS_PROFILE: env.AWS_PROFILE || null,
      AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID ? mask(env.AWS_ACCESS_KEY_ID) : null,
      AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY ? 'present-redacted' : null,
      awsCliAvailable: cliAvailable,
    },
    nextSteps: missing.length === 0 ? [
      'Run npm run build.',
      'Run npm run aws:deploy:apprunner to trigger App Runner.',
      'Open AWS App Runner logs/events and verify /health and /app after deploy.',
    ] : [
      'Delete any AWS access key that was pasted into chat or screenshots.',
      'Prefer GitHub OIDC: set AWS_REGION, APP_RUNNER_SERVICE_ARN, and AWS_ROLE_TO_ASSUME as GitHub repository Variables.',
      'If deploying locally, configure AWS CLI with a new key or SSO/profile outside this repository.',
    ],
  };
}

function main() {
  const result = collectPreflight({ skipAwsCli: hasArg('--skip-aws-cli') });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok && !hasArg('--allow-missing')) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { collectPreflight, mask };
