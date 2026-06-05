'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const Boa = require('./boa');

const DEFAULT_STATE = Object.freeze({
  accounts: Object.freeze({}),
  sessions: Object.freeze({}),
  devices: Object.freeze({}),
  planReceipts: Object.freeze([]),
  workspaces: Object.freeze({}),
  casts: Object.freeze({}),
});

function cloneDefaultState() {
  return {
    accounts: {},
    sessions: {},
    devices: {},
    planReceipts: [],
    workspaces: {},
    casts: {},
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
      downloadUrl: `/download/boa-daemon.js?session=${encodeURIComponent(sessionToken)}`,
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
      downloadUrl: `/download/boa-daemon.js?session=${encodeURIComponent(sessionToken)}`,
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
      platform: null,
      dialect: null,
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
    console.log('BOA daemon online for ' + BOA_DAEMON.username + ' on ' + BOA_DAEMON.endpoint);
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
    const devices = Object.values(this.state.devices).filter((device) => device.accountId === account.id).map((device) => ({
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
      receipts: this.state.planReceipts.filter((receipt) => receipt.accountId === account.id),
    };
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
    device.resources = {
      uptimeSeconds: payload.uptimeSeconds,
      memory: payload.memory,
      cpus: payload.cpus,
    };
    this.saveState();
    return { ok: true, deviceId: device.id, status: device.status, dialect: device.dialect };
  }

  castFrame(payload) {
    const tokenHash = sha256(payload.deviceToken || '');
    const device = Object.values(this.state.devices).find((candidate) => candidate.tokenHash === tokenHash);
    if (!device) throw new Error('Unknown BOA daemon token.');
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

  dashboardHtml() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BOA Dashboard</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#08110d;color:#e8fff2;margin:0;padding:2rem}main{max-width:980px;margin:auto}.card{background:#102119;border:1px solid #1f6f46;border-radius:16px;padding:1rem;margin:1rem 0}input,select,button{font:inherit;padding:.7rem;border-radius:10px;border:1px solid #2d8b59;margin:.25rem;background:#07130d;color:#e8fff2}button{cursor:pointer;background:#00a862;border-color:#00ff88;color:#001b0f;font-weight:700}pre{white-space:pre-wrap;background:#030806;padding:1rem;border-radius:12px}</style>
</head>
<body>
<main>
<h1>BOA Dashboard</h1>
<p>Create an account, download your personalized daemon, manage devices, cast frames, tasks, and plan access from this site.</p>
<section class="card"><h2>Create account</h2><label>Username <input id="su-user" autocomplete="username"></label><label>Password <input id="su-pass" type="password" autocomplete="new-password"></label><label>Plan <select id="su-plan"><option>solo</option><option>team</option><option>enterprise</option></select></label><button onclick="signup()">Create + Download Daemon</button></section>
<section class="card"><h2>Login</h2><label>Username <input id="li-user" autocomplete="username"></label><label>Password <input id="li-pass" type="password" autocomplete="current-password"></label><button onclick="login()">Login</button></section>
<section class="card"><h2>Plan</h2><label>Plan <select id="plan"><option>solo</option><option>team</option><option>enterprise</option></select></label><button onclick="purchasePlan()">Activate Plan</button></section>
<section class="card"><h2>Workspace</h2><label>Task title <input id="task-title"></label><button onclick="addTask()">Add Task</button></section>
<section class="card"><h2>Dashboard Data</h2><button onclick="refresh()">Refresh</button><button onclick="downloadDaemon()">Download Daemon</button><pre id="out"></pre></section>
</main>
<script>
let sessionToken = localStorage.getItem('boaSession') || '';
async function api(path, body) { const res = await fetch(path, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body || {}) }); const data = await res.json(); if(!res.ok) throw new Error(data.error); return data; }
function show(value){ document.getElementById('out').textContent = JSON.stringify(value,null,2); }
async function signup(){ const data = await api('/api/signup', { username: val('su-user'), password: val('su-pass'), plan: val('su-plan') }); sessionToken=data.sessionToken; localStorage.setItem('boaSession', sessionToken); show(data); location.href=data.downloadUrl; }
async function login(){ const data = await api('/api/login', { username: val('li-user'), password: val('li-pass') }); sessionToken=data.sessionToken; localStorage.setItem('boaSession', sessionToken); show(data); }
async function purchasePlan(){ show(await api('/api/plan', { sessionToken, plan: val('plan') })); }
async function addTask(){ show(await api('/api/workspace/task', { sessionToken, title: val('task-title') })); }
async function refresh(){ const res = await fetch('/api/dashboard?session=' + encodeURIComponent(sessionToken)); show(await res.json()); }
function downloadDaemon(){ location.href='/download/boa-daemon.js?session=' + encodeURIComponent(sessionToken); }
function val(id){ return document.getElementById(id).value; }
if(sessionToken) refresh().catch((error)=>show({error:error.message}));
</script>
</body>
</html>`;
  }

  async route(request, response) {
    try {
      const url = new URL(request.url, this.baseUrl);
      if (request.method === 'GET' && url.pathname === '/') {
        sendText(response, 200, this.dashboardHtml(), 'text/html; charset=utf-8');
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
      else if (url.pathname === '/api/plan') sendJson(response, 200, this.purchasePlan(body.sessionToken, body.plan));
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
