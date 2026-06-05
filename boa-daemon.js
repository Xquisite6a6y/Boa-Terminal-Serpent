#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const SIGNAL_FORMAT = 'boa-signal-v1';
const TEXT_PREFIX = 'BOA-EQ1:';
const KDF_SALT = 'boa-signal-domain-storage-v1';
const KDF_ITERATIONS = 210000;
const KEY_BYTES = 56;
const LAYERS = 7;
const SEALED_PAYLOAD = null;

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(text) {
  return Buffer.from(String(text), 'base64url');
}

function deriveKeys(password) {
  const secret = String(password || '');
  if (!secret) throw new Error('Password is required.');
  const material = crypto.pbkdf2Sync(secret, KDF_SALT, KDF_ITERATIONS, KEY_BYTES, 'sha512');
  const variables = [];
  for (let index = 0; index < LAYERS; index += 1) {
    const slice = material.subarray(index * 8, index * 8 + 8);
    const integer = slice.readBigUInt64BE(0);
    const low = Number(integer & 0xffffffffn);
    const high = Number((integer >> 32n) & 0xffffffffn);
    variables.push(Object.freeze({
      dimension: index,
      hex: slice.toString('hex'),
      integer: integer.toString(),
      amplitude: ((low % 104729) + 1) / 104729,
      phase: high % 65536,
      stride: (low % 251) + 1,
      offset: high % 256,
    }));
  }
  return Object.freeze({
    algorithm: 'PBKDF2-SHA512',
    iterations: KDF_ITERATIONS,
    dimensions: LAYERS,
    fingerprint: sha256(material.toString('hex')).slice(0, 16),
    variables: Object.freeze(variables),
  });
}

function maskFor(keys, byteIndex) {
  const variable = keys.variables[byteIndex % LAYERS];
  const phase = (variable.phase + byteIndex * variable.stride + variable.offset) % 65536;
  const folded = Math.floor((Math.sin((phase + 1) * variable.amplitude) + 1) * 127.5) & 0xff;
  return (folded ^ variable.offset ^ (phase & 0xff) ^ ((phase >> 8) & 0xff)) & 0xff;
}

function byteToSignal(byte, byteIndex, keys) {
  const layer = byteIndex % LAYERS;
  const variable = keys.variables[layer];
  const mask = maskFor(keys, byteIndex);
  const coordinate = byte ^ mask;
  const phaseCoordinate = Number((((coordinate + 1) * (variable.phase + 1) * variable.amplitude) % 1).toFixed(12));
  return Object.freeze({
    n: Math.floor(byteIndex / LAYERS),
    coordinate,
    phase: phaseCoordinate,
    equation: `x${layer}[${Math.floor(byteIndex / LAYERS)}]=(${coordinate}+φ${layer}) mod 256`,
  });
}

function signalToByte(sample, layer, keys) {
  const byteIndex = sample.n * LAYERS + layer;
  return (sample.coordinate ^ maskFor(keys, byteIndex)) & 0xff;
}

function encodeBufferToSignal(buffer, password, metadata = {}) {
  const keys = deriveKeys(password);
  const layers = Array.from({ length: LAYERS }, (_, layer) => ({ layer, samples: [] }));
  for (let index = 0; index < buffer.length; index += 1) {
    const layer = index % LAYERS;
    layers[layer].samples.push(byteToSignal(buffer[index], index, keys));
  }
  return {
    format: SIGNAL_FORMAT,
    createdAt: new Date().toISOString(),
    dimensions: LAYERS,
    length: buffer.length,
    keyFingerprint: keys.fingerprint,
    metadata,
    layers,
  };
}

function decodeSignalToBuffer(signal, password) {
  if (!signal || signal.format !== SIGNAL_FORMAT || !Array.isArray(signal.layers)) {
    throw new Error('Not a BOA signal-domain storage file.');
  }
  const keys = deriveKeys(password);
  const output = Buffer.alloc(Number(signal.length || 0));
  for (let layer = 0; layer < LAYERS; layer += 1) {
    const layerRecord = signal.layers.find((candidate) => candidate.layer === layer);
    if (!layerRecord || !Array.isArray(layerRecord.samples)) {
      throw new Error(`Signal layer ${layer} is missing; retrieval requires all phase layers.`);
    }
    layerRecord.samples.forEach((sample) => {
      const byteIndex = sample.n * LAYERS + layer;
      if (byteIndex < output.length) output[byteIndex] = signalToByte(sample, layer, keys);
    });
  }
  return output;
}

function storedPathFor(filePath) {
  return `${filePath}.boa-signal.json`;
}

function retrievedPathFor(storedPath, signal) {
  const original = signal && signal.metadata && signal.metadata.originalName ? signal.metadata.originalName : 'retrieved.bin';
  return `${storedPath}.${path.basename(original)}.retrieved`;
}

function storeFile(filePath, password, outputPath = storedPathFor(filePath)) {
  const absolute = path.resolve(filePath);
  const input = fs.readFileSync(absolute);
  const signal = encodeBufferToSignal(input, password, {
    originalName: path.basename(filePath),
    originalPathHash: sha256(absolute),
    byteLength: input.length,
  });
  fs.writeFileSync(outputPath, `${JSON.stringify(signal, null, 2)}\n`);
  return outputPath;
}

function retrieveFile(storedPath, password, outputPath) {
  const signal = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
  const decoded = decodeSignalToBuffer(signal, password);
  const target = outputPath || retrievedPathFor(storedPath, signal);
  fs.writeFileSync(target, decoded);
  return target;
}

function computePhase(filePath, password) {
  const signal = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!signal || signal.format !== SIGNAL_FORMAT) throw new Error('computePhase expects a BOA signal file.');
  const keys = deriveKeys(password);
  const layerEquations = signal.layers.map((layer) => {
    const sum = layer.samples.reduce((acc, sample) => (acc + sample.coordinate + Math.round(sample.phase * 1e6)) % 1000000007, 0);
    const variable = keys.variables[layer.layer];
    return `ΣL${layer.layer}=(${sum}*${variable.stride}+${variable.offset}) mod 1000000007`;
  });
  const digest = crypto.createHash('sha512')
    .update(JSON.stringify(layerEquations))
    .update(keys.fingerprint)
    .digest('hex');
  return `BOA-PHASE{${layerEquations.join(';')}}::${digest}`;
}

function obscureText(text, password) {
  const buffer = Buffer.from(String(text), 'utf8');
  const signal = encodeBufferToSignal(buffer, password, { kind: 'text' });
  const compact = signal.layers.flatMap((layer) => layer.samples.map((sample) => `${layer.layer}.${sample.n}.${sample.coordinate}`));
  return `${TEXT_PREFIX}${toBase64Url(JSON.stringify({ length: signal.length, terms: compact }))}`;
}

function deobscureText(obscured, password) {
  const source = String(obscured || '');
  if (!source.startsWith(TEXT_PREFIX)) throw new Error('Text does not use BOA-EQ1 format.');
  const compact = JSON.parse(fromBase64Url(source.slice(TEXT_PREFIX.length)).toString('utf8'));
  const layers = Array.from({ length: LAYERS }, (_, layer) => ({ layer, samples: [] }));
  compact.terms.forEach((term) => {
    const [layerText, nText, coordinateText] = term.split('.');
    const layer = Number(layerText);
    layers[layer].samples.push({ n: Number(nText), coordinate: Number(coordinateText), phase: 0 });
  });
  return decodeSignalToBuffer({ format: SIGNAL_FORMAT, length: compact.length, layers }, password).toString('utf8');
}

function requireSubstrateKey() {
  const key = process.env.BOA_SUBSTRATE_KEY;
  if (!key || !/^[a-fA-F0-9]{32,}$/.test(key)) {
    throw new Error('BOA_SUBSTRATE_KEY must be a hex string of at least 32 characters to seal or run sealed code.');
  }
  return crypto.createHash('sha256').update(Buffer.from(key, 'hex')).digest();
}

function sealSource(sourcePath = __filename, outputPath = path.join(path.dirname(sourcePath), 'boa-daemon.sealed.js')) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const key = requireSubstrateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(source, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = { iv: toBase64Url(iv), tag: toBase64Url(tag), body: toBase64Url(encrypted) };
  const sealed = `#!/usr/bin/env node\n'use strict';\nconst crypto=require('crypto');const vm=require('vm');\nconst SEALED_PAYLOAD=${JSON.stringify(payload)};\nfunction k(){const x=process.env.BOA_SUBSTRATE_KEY;if(!x||!/^[a-fA-F0-9]{32,}$/.test(x))throw new Error('BOA_SUBSTRATE_KEY must be set to run sealed BOA daemon.');return crypto.createHash('sha256').update(Buffer.from(x,'hex')).digest()}\nconst iv=Buffer.from(SEALED_PAYLOAD.iv,'base64url');const tag=Buffer.from(SEALED_PAYLOAD.tag,'base64url');const body=Buffer.from(SEALED_PAYLOAD.body,'base64url');const d=crypto.createDecipheriv('aes-256-gcm',k(),iv);d.setAuthTag(tag);process.env.BOA_SEALED_MODE='1';const src=Buffer.concat([d.update(body),d.final()]).toString('utf8');eval(src);\n`;
  fs.writeFileSync(outputPath, sealed, { mode: 0o700 });
  return outputPath;
}

function configDirectory() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'Boa');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Boa');
  return path.join(os.homedir(), '.boa');
}

function configPath() {
  return path.join(configDirectory(), 'daemon.json');
}

function readDaemonConfig() {
  if (fs.existsSync(configPath())) return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  return {
    endpoint: process.env.BOA_ENDPOINT || 'https://truthunveiled.me',
    deviceToken: process.env.BOA_DEVICE_TOKEN,
    deviceId: process.env.BOA_DEVICE_ID || os.hostname(),
  };
}

function postJson(endpoint, pathname, payload) {
  const target = new URL(pathname, endpoint);
  const body = JSON.stringify(payload);
  const transport = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        const parsed = data ? JSON.parse(data) : {};
        if (response.statusCode < 200 || response.statusCode >= 300) reject(new Error(parsed.error || data));
        else resolve(parsed);
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function heartbeatPayload(config) {
  return {
    deviceToken: config.deviceToken,
    deviceId: config.deviceId,
    platform: process.platform,
    hostname: os.hostname(),
    uptimeSeconds: Math.round(os.uptime()),
    memory: { total: os.totalmem(), free: os.freemem() },
    cpus: os.cpus().length,
    sealed: process.env.BOA_SEALED_MODE === '1',
  };
}

async function heartbeat() {
  const config = readDaemonConfig();
  if (!config.deviceToken) throw new Error('BOA daemon heartbeat requires a paired daemon config or BOA_DEVICE_TOKEN.');
  return postJson(config.endpoint, '/api/daemon/heartbeat', heartbeatPayload(config));
}

function usage() {
  return `BOA daemon CLI\n\nCommands:\n  node boa-daemon.js store <filePath> <password> [outputPath]\n  node boa-daemon.js retrieve <storedPath> <password> [outputPath]\n  node boa-daemon.js obscure <text> <password>\n  node boa-daemon.js deobscure <obscuredText> <password>\n  node boa-daemon.js phase <storedPath> <password>\n  node boa-daemon.js seal [outputPath]\n  node boa-daemon.js daemon\n  node boa-daemon.js heartbeat\n`;
}

async function main(argv = process.argv.slice(2)) {
  const [command, first, second, third] = argv;
  if (!command || command === 'help' || command === '--help') {
    console.log(usage());
  } else if (command === 'store') {
    console.log(JSON.stringify({ storedPath: storeFile(first, second, third) }, null, 2));
  } else if (command === 'retrieve') {
    console.log(JSON.stringify({ retrievedPath: retrieveFile(first, second, third) }, null, 2));
  } else if (command === 'obscure') {
    console.log(obscureText(first, second));
  } else if (command === 'deobscure') {
    console.log(deobscureText(first, second));
  } else if (command === 'phase' || command === 'computePhase') {
    console.log(computePhase(first, second));
  } else if (command === 'seal') {
    console.log(JSON.stringify({ sealedPath: sealSource(__filename, first || third) }, null, 2));
  } else if (command === 'heartbeat') {
    console.log(JSON.stringify(await heartbeat(), null, 2));
  } else if (command === 'daemon') {
    console.log(JSON.stringify(await heartbeat(), null, 2));
    setInterval(() => heartbeat().catch((error) => console.error(error.message)), 30000);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  computePhase,
  deobscureText,
  deriveKeys,
  encodeBufferToSignal,
  decodeSignalToBuffer,
  heartbeat,
  obscureText,
  retrieveFile,
  sealSource,
  storeFile,
};
