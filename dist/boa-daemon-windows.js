#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const BOA_DAEMON_PLATFORM = {"id": "windows", "name": "Windows", "service": "Task Scheduler"};
const DEFAULT_ENDPOINT = process.env.BOA_ENDPOINT || 'https://truthunveiled.me';

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return fallback;
}

function configDirectory() {
  if (BOA_DAEMON_PLATFORM.id === 'windows') {
    return path.join(process.env.APPDATA || os.homedir(), 'Boa');
  }
  if (BOA_DAEMON_PLATFORM.id === 'macos') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Boa');
  }
  return path.join(os.homedir(), '.boa');
}

function configPath() {
  return path.join(configDirectory(), 'daemon.json');
}

function postJson(endpoint, pathname, payload) {
  const target = new URL(pathname, endpoint);
  const body = JSON.stringify(payload);
  const transport = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        let parsed = {};
        if (data) {
          try { parsed = JSON.parse(data); } catch (error) { parsed = { raw: data }; }
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`BOA request failed ${response.statusCode}: ${parsed.error || data}`));
          return;
        }
        resolve(parsed);
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function readConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) {
    throw new Error(`BOA daemon is not installed. Run: node ${path.basename(__filename)} install --session <dashboard-session-token>`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeConfig(config) {
  const dir = configDirectory();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(configPath(), 0o600);
}

async function install() {
  const endpoint = readArg('endpoint', DEFAULT_ENDPOINT).replace(/\/$/, '');
  const sessionToken = readArg('session', process.env.BOA_SESSION);
  const label = readArg('label', `${os.hostname()}-${BOA_DAEMON_PLATFORM.id}`);
  if (!sessionToken) {
    throw new Error('Install requires --session <dashboard-session-token> or BOA_SESSION. Create/login on the BOA dashboard first.');
  }
  const issued = await postJson(endpoint, '/api/daemon/issue', {
    sessionToken,
    label,
    platform: BOA_DAEMON_PLATFORM.id,
  });
  fs.mkdirSync(configDirectory(), { recursive: true, mode: 0o700 });
  const installPath = path.join(configDirectory(), path.basename(__filename));
  fs.copyFileSync(__filename, installPath);
  if (process.platform !== 'win32') fs.chmodSync(installPath, 0o700);
  const config = {
    endpoint,
    installPath,
    platform: BOA_DAEMON_PLATFORM,
    deviceId: issued.daemon.deviceId,
    deviceToken: issued.daemon.deviceToken,
    account: issued.account,
    installedAt: new Date().toISOString(),
  };
  writeConfig(config);
  return { installPath, configPath: configPath(), deviceId: config.deviceId, endpoint };
}

async function heartbeat() {
  const config = readConfig();
  return postJson(config.endpoint, '/api/daemon/heartbeat', {
    deviceToken: config.deviceToken,
    deviceId: config.deviceId,
    platform: BOA_DAEMON_PLATFORM.id,
    runtimePlatform: process.platform,
    hostname: os.hostname(),
    uptimeSeconds: Math.round(os.uptime()),
    memory: { total: os.totalmem(), free: os.freemem() },
    cpus: os.cpus().length,
  });
}

async function castFrame() {
  const config = readConfig();
  const title = readArg('title', process.argv[3] || os.hostname());
  const frame = readArg('frame', process.argv.slice(4).join(' ') || JSON.stringify({ hostname: os.hostname(), platform: process.platform }));
  return postJson(config.endpoint, '/api/cast/frame', {
    deviceToken: config.deviceToken,
    title,
    frame,
    capturedAt: new Date().toISOString(),
  });
}

function status() {
  const config = readConfig();
  return {
    platform: BOA_DAEMON_PLATFORM,
    endpoint: config.endpoint,
    deviceId: config.deviceId,
    account: config.account,
    configPath: configPath(),
    installedAt: config.installedAt,
  };
}

function usage() {
  return {
    platform: BOA_DAEMON_PLATFORM,
    commands: {
      install: 'Pair this daemon with a dashboard session and persist device credentials.',
      heartbeat: 'Send CPU, memory, uptime, hostname, and platform heartbeat to the BOA site.',
      daemon: 'Run continuously and heartbeat every 30 seconds.',
      cast: 'Send a cast frame string to the BOA site.',
      status: 'Print local daemon pairing information.',
    },
    installExample: `node ${path.basename(__filename)} install --endpoint ${DEFAULT_ENDPOINT} --session <dashboard-session-token>`,
  };
}

async function main() {
  const command = process.argv[2] || 'help';
  if (command === 'install') console.log(JSON.stringify(await install(), null, 2));
  else if (command === 'heartbeat') console.log(JSON.stringify(await heartbeat(), null, 2));
  else if (command === 'cast') console.log(JSON.stringify(await castFrame(), null, 2));
  else if (command === 'status') console.log(JSON.stringify(status(), null, 2));
  else if (command === 'daemon') {
    console.log(JSON.stringify(await heartbeat(), null, 2));
    setInterval(() => heartbeat().catch((error) => console.error(error.message)), 30000);
  } else console.log(JSON.stringify(usage(), null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
