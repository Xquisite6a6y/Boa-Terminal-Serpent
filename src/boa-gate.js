'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const ENVELOPE_FORMAT = 'boa-envelope-v1';
const DEFAULT_GATE_PORT = 8788;
const MAX_BODY_BYTES = 1_000_000;
let activeGate = null;

function nowIso() {
  return new Date().toISOString();
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function configDirectory() {
  if (process.env.BOA_CONFIG_DIR) return process.env.BOA_CONFIG_DIR;
  if (process.platform === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'Boa');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Boa');
  return path.join(os.homedir(), '.boa');
}

function configPath() {
  return process.env.BOA_DAEMON_CONFIG || path.join(configDirectory(), 'daemon.json');
}

function safeJsonRead(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {};
  }
  return {};
}

function loadGateConfig(overrides = {}) {
  const fileConfig = safeJsonRead(configPath());
  const deviceId = overrides.deviceId || process.env.BOA_DEVICE_ID || fileConfig.deviceId || `boa-local-${sha256(os.hostname()).slice(0, 10)}`;
  const secret = overrides.transportSecret || process.env.BOA_TRANSPORT_SECRET || fileConfig.transportSecret || fileConfig.deviceToken || randomToken(32);
  const config = {
    endpoint: overrides.endpoint || process.env.BOA_ENDPOINT || fileConfig.endpoint || 'https://truthunveiled.me',
    deviceId,
    deviceToken: overrides.deviceToken || process.env.BOA_DEVICE_TOKEN || fileConfig.deviceToken,
    deviceName: overrides.deviceName || fileConfig.deviceName || os.hostname(),
    gateHost: overrides.host || process.env.BOA_GATE_HOST || fileConfig.gateHost || '127.0.0.1',
    gatePort: Number(overrides.port || process.env.BOA_GATE_PORT || fileConfig.gatePort || DEFAULT_GATE_PORT),
    policy: normalizePolicy(overrides.policy || process.env.BOA_GATE_POLICY || fileConfig.policy || 'protected'),
    target: overrides.target || process.env.BOA_GATE_TARGET || fileConfig.target,
    transportSecret: secret,
    createdAt: fileConfig.createdAt || nowIso(),
  };
  if (overrides.persist !== false) persistGateConfig(config);
  return config;
}

function persistGateConfig(config) {
  const filePath = configPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const existing = safeJsonRead(filePath);
  const next = { ...existing, ...config, updatedAt: nowIso() };
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}

function normalizePolicy(policy) {
  const normalized = String(policy || 'protected').toLowerCase();
  return ['permissive', 'protected', 'strict'].includes(normalized) ? normalized : 'protected';
}

function payloadToString(payload) {
  if (Buffer.isBuffer(payload)) return payload.toString('utf8');
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload ?? null);
}

function redactPreview(payload) {
  return payloadToString(payload).replace(/[A-Za-z0-9_=-]{24,}/g, '[redacted]').slice(0, 120);
}

function signEnvelope(secret, body) {
  return crypto.createHmac('sha256', String(secret)).update(body).digest('base64url');
}

function wrapOutbound(payload, context = {}, gate = activeGate) {
  const config = (gate && gate.config) || loadGateConfig({ persist: false });
  const body = Buffer.from(payloadToString(payload), 'utf8').toString('base64url');
  const envelope = {
    format: ENVELOPE_FORMAT,
    id: `sig-${sha256(`${config.deviceId}:${Date.now()}:${body}`).slice(0, 16)}`,
    direction: 'outbound',
    deviceId: config.deviceId,
    createdAt: nowIso(),
    context: sanitizeContext(context),
    body,
    bodyEncoding: 'utf8-base64url',
  };
  envelope.signature = signEnvelope(config.transportSecret, `${envelope.id}:${envelope.body}:${JSON.stringify(envelope.context)}`);
  recordEvent(gate, 'Signal wrapped', { direction: 'outbound', envelopeId: envelope.id, preview: redactPreview(payload) });
  return envelope;
}

function isBoaEnvelope(payload) {
  return payload && typeof payload === 'object' && payload.format === ENVELOPE_FORMAT && typeof payload.body === 'string';
}

function unwrapInbound(payload, context = {}, gate = activeGate) {
  const config = (gate && gate.config) || loadGateConfig({ persist: false });
  if (!isBoaEnvelope(payload)) {
    if (config.policy === 'strict') {
      recordEvent(gate, 'Raw signal rejected', { policy: config.policy, preview: redactPreview(payload) });
      return { ok: false, code: 'BOA_GATE_REJECTED_RAW_SIGNAL' };
    }
    const warning = config.policy === 'protected' ? 'BOA_GATE_ACCEPTED_RAW_SIGNAL_WITH_WARNING' : undefined;
    recordEvent(gate, 'Raw signal received', { policy: config.policy, warning, preview: redactPreview(payload) });
    return { ok: true, payload, raw: true, warning };
  }
  const expected = signEnvelope(config.transportSecret, `${payload.id}:${payload.body}:${JSON.stringify(payload.context || {})}`);
  const actual = Buffer.from(String(payload.signature || ''));
  const expectedBuffer = Buffer.from(expected);
  const verified = !payload.signature || (actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual));
  const unwrapped = Buffer.from(payload.body, 'base64url').toString('utf8');
  recordEvent(gate, 'Signal received', { direction: 'inbound', envelopeId: payload.id, verified, preview: redactPreview(unwrapped) });
  return { ok: true, payload: unwrapped, envelope: payload, verified, context: sanitizeContext(context) };
}

function sanitizeContext(context = {}) {
  return Object.fromEntries(Object.entries(context || {}).filter(([key]) => !/secret|password|token/i.test(key)).slice(0, 20));
}

function recordEvent(gate, type, details = {}) {
  if (!gate) return;
  const event = { id: `evt-${sha256(`${type}:${Date.now()}:${Math.random()}`).slice(0, 12)}`, type, at: nowIso(), details };
  gate.events.push(event);
  if (gate.events.length > 200) gate.events.shift();
}

function gateStatus(gate = activeGate) {
  const selected = gate || { config: loadGateConfig({ persist: false }), events: [] };
  return {
    ok: true,
    service: 'boa-gate',
    status: gate && gate.server ? 'online' : 'offline',
    deviceId: selected.config.deviceId,
    deviceName: selected.config.deviceName,
    policy: selected.config.policy,
    host: selected.config.gateHost,
    port: selected.port || selected.config.gatePort,
    signalStatus: 'BOA gate active',
    wrappedCount: selected.stats ? selected.stats.wrapped : 0,
    unwrappedCount: selected.stats ? selected.stats.unwrapped : 0,
    rejectedCount: selected.stats ? selected.stats.rejected : 0,
    activeRoutes: ['/status', '/gate/send', '/gate/receive', '/gate/wrap', '/gate/unwrap', '/gate/config', '/gate/events'],
    lastEvent: selected.events[selected.events.length - 1] || null,
    startedAt: selected.startedAt || null,
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('BOA gate request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (error) { reject(new Error('Invalid JSON request body.')); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function handleIncomingRequest(request, response, gate = activeGate) {
  try {
    if (request.method === 'OPTIONS') return sendJson(response, 200, { ok: true });
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (request.method === 'GET' && url.pathname === '/status') return sendJson(response, 200, gateStatus(gate));
    if (request.method === 'GET' && url.pathname === '/gate/events') return sendJson(response, 200, { ok: true, events: (gate && gate.events) || [] });
    if (request.method !== 'POST') return sendJson(response, 404, { ok: false, error: 'Route not found.' });
    const body = await readBody(request);
    if (url.pathname === '/gate/wrap') {
      const envelope = wrapOutbound(body.payload, body.context || {}, gate);
      if (gate) gate.stats.wrapped += 1;
      return sendJson(response, 200, { ok: true, envelope });
    }
    if (url.pathname === '/gate/unwrap') {
      const result = unwrapInbound(body.envelope || body.payload, body.context || {}, gate);
      if (gate) result.ok ? gate.stats.unwrapped += 1 : gate.stats.rejected += 1;
      return sendJson(response, result.ok ? 200 : 422, result);
    }
    if (url.pathname === '/gate/send') {
      const envelope = wrapOutbound(body.payload, { ...(body.context || {}), route: body.route || 'local' }, gate);
      if (gate) gate.stats.wrapped += 1;
      if (body.target || (gate && gate.config.target)) {
        const forwarded = await forwardThroughGate({ envelope, target: body.target || gate.config.target, method: body.method || 'POST' }, gate);
        return sendJson(response, 200, { ok: true, envelope, forwarded });
      }
      return sendJson(response, 200, { ok: true, envelope, status: 'Signal wrapped and ready.' });
    }
    if (url.pathname === '/gate/receive') {
      const result = unwrapInbound(body.envelope || body.payload, body.context || {}, gate);
      if (gate) result.ok ? gate.stats.unwrapped += 1 : gate.stats.rejected += 1;
      return sendJson(response, result.ok ? 200 : 422, result);
    }
    if (url.pathname === '/gate/config') {
      if (!gate) return sendJson(response, 503, { ok: false, error: 'BOA gate is not running.' });
      gate.config = persistGateConfig({ ...gate.config, policy: normalizePolicy(body.policy || gate.config.policy), target: body.target || gate.config.target });
      recordEvent(gate, 'Gate configuration updated', { policy: gate.config.policy, target: gate.config.target ? '[configured]' : null });
      return sendJson(response, 200, { ok: true, status: gateStatus(gate) });
    }
    return sendJson(response, 404, { ok: false, error: 'Route not found.' });
  } catch (error) {
    return sendJson(response, 400, { ok: false, error: error.message });
  }
}

function forwardThroughGate(request = {}, gate = activeGate) {
  const target = new URL(request.target || (gate && gate.config.target) || '');
  const transport = target.protocol === 'https:' ? https : http;
  const body = JSON.stringify(request.envelope || wrapOutbound(request.payload, request.context || {}, gate));
  return new Promise((resolve, reject) => {
    const outbound = transport.request(target, {
      method: request.method || 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        let parsed = data;
        try { parsed = data ? JSON.parse(data) : {}; } catch (error) { /* keep text */ }
        if (isBoaEnvelope(parsed)) parsed = unwrapInbound(parsed, { source: target.origin }, gate);
        resolve({ statusCode: response.statusCode, body: parsed });
      });
    });
    outbound.on('error', reject);
    outbound.write(body);
    outbound.end();
  });
}

function startGate(options = {}) {
  if (activeGate && activeGate.server) return Promise.resolve(activeGate);
  const config = loadGateConfig(options);
  const gate = {
    config,
    events: [],
    stats: { wrapped: 0, unwrapped: 0, rejected: 0 },
    startedAt: nowIso(),
    server: null,
    port: config.gatePort,
  };
  const server = http.createServer((request, response) => handleIncomingRequest(request, response, gate));
  gate.server = server;
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(config.gatePort, config.gateHost, () => {
      gate.port = server.address().port;
      activeGate = gate;
      recordEvent(gate, 'BOA gate started', { host: config.gateHost, port: gate.port, policy: config.policy });
      resolve(gate);
    });
  });
}

function stopGate() {
  if (!activeGate || !activeGate.server) return Promise.resolve({ ok: true, stopped: false });
  const gate = activeGate;
  activeGate = null;
  return new Promise((resolve) => {
    gate.server.close(() => resolve({ ok: true, stopped: true }));
  });
}

module.exports = {
  DEFAULT_GATE_PORT,
  ENVELOPE_FORMAT,
  forwardThroughGate,
  gateStatus,
  handleIncomingRequest,
  isBoaEnvelope,
  loadGateConfig,
  startGate,
  stopGate,
  unwrapInbound,
  wrapOutbound,
};
