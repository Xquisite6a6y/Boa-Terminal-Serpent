'use strict';

/**
 * BOA protocol primitives.
 *
 * This module is a single-file MVP that keeps three ideas separate:
 * 1. license identity: username, plan, device limits, and workspace rights;
 * 2. password language: the private lattice alphabet/state for protection;
 * 3. equations: portable intent/file/screen/memory transfer descriptors.
 *
 * BOA never executes translated commands by itself. It emits signed envelopes
 * that a trusted adapter can inspect before dispatching on a real device.
 */

const DEFAULT_HEARTBEAT_URL = 'https://truthunveiled.me';

const PLAN_LIMITS = Object.freeze({
  solo: Object.freeze({ devices: 1, handshakes: false, workspaces: 1, resourceShare: false }),
  team: Object.freeze({ devices: 8, handshakes: true, workspaces: 8, resourceShare: false }),
  enterprise: Object.freeze({ devices: 64, handshakes: true, workspaces: 64, resourceShare: true }),
});


const PER_DEVICE_PRICING = Object.freeze({
  freeSecurityDevices: 1,
  includedPaidDevices: 3,
  monthlyBaseUsd: 4,
  monthlyPerExtraDeviceUsd: 2,
  annualDiscount: 0.17,
  freeIncludes: Object.freeze(['daemon security', 'local BOA gate', 'one protected device', 'sandbox demo']),
});

function estimatePerDevicePricing(deviceCount = 1, options = {}) {
  const devices = Math.max(1, Math.floor(Number(deviceCount) || 1));
  const base = Number(options.monthlyBaseUsd || PER_DEVICE_PRICING.monthlyBaseUsd);
  const perExtra = Number(options.monthlyPerExtraDeviceUsd || PER_DEVICE_PRICING.monthlyPerExtraDeviceUsd);
  const included = Number(options.includedPaidDevices || PER_DEVICE_PRICING.includedPaidDevices);
  if (devices <= PER_DEVICE_PRICING.freeSecurityDevices) {
    return Object.freeze({
      model: 'free-security-per-device-connectivity',
      devices,
      monthlyUsd: 0,
      annualUsd: 0,
      freeSecurity: true,
      explanation: 'Daemon security stays free for the first protected device; paid value starts when users connect more devices.',
    });
  }
  const extraDevices = Math.max(0, devices - included);
  const efficiency = options.efficiency || calculateUnifiedEfficiency({ connectedDevices: devices, stackedEntries: options.stackedEntries || 0, reuse: options.reuse || 1 });
  const efficiencyPremium = Math.max(0, Math.ceil((efficiency.efficiencyMultiplier - 1) * 2));
  const monthlyUsd = Number((base + extraDevices * perExtra + efficiencyPremium).toFixed(2));
  const annualUsd = Number((monthlyUsd * 12 * (1 - PER_DEVICE_PRICING.annualDiscount)).toFixed(2));
  return Object.freeze({
    model: 'free-security-per-device-connectivity',
    devices,
    includedPaidDevices: included,
    extraDevices,
    monthlyBaseUsd: base,
    monthlyPerExtraDeviceUsd: perExtra,
    efficiencyMultiplier: efficiency.efficiencyMultiplier,
    efficiencyPremiumUsd: efficiencyPremium,
    monthlyUsd,
    annualUsd,
    freeSecurity: true,
    explanation: 'Users pay for connected devices, cloud relay, mesh routing, casting, and resource sharing—not for base daemon security.',
  });
}

function seededUnit(seed, index) {
  const value = parseInt(stableHash(`${seed}:unit:${index}`).slice(0, 8), 16) / 0xffffffff;
  return value * 2 - 1;
}

function buildPhasePermutation(seed, size) {
  const order = Array.from({ length: size }, (_, index) => index);
  for (let index = size - 1; index > 0; index -= 1) {
    const swap = seededNumber(seed, `perm:${index}`) % (index + 1);
    const current = order[index];
    order[index] = order[swap];
    order[swap] = current;
  }
  return order;
}

function phaseEncodeVector(vector, keySeed, phase) {
  const seed = String(keySeed || 'boa-phase-key');
  const permutation = buildPhasePermutation(seed, vector.length);
  return permutation.map((sourceIndex, outputIndex) => {
    const angle = phase * ((outputIndex % 7) + 1);
    const sign = seededNumber(seed, `sign:${outputIndex}`) % 2 === 0 ? 1 : -1;
    return Number((vector[sourceIndex] * sign * Math.cos(angle)).toFixed(12));
  });
}

function phaseDecodeVector(encoded, keySeed, phase) {
  const seed = String(keySeed || 'boa-phase-key');
  const permutation = buildPhasePermutation(seed, encoded.length);
  const output = Array.from({ length: encoded.length }, () => 0);
  permutation.forEach((sourceIndex, outputIndex) => {
    const angle = phase * ((outputIndex % 7) + 1);
    const sign = seededNumber(seed, `sign:${outputIndex}`) % 2 === 0 ? 1 : -1;
    const scale = Math.cos(angle) || 1e-9;
    output[sourceIndex] = Number((encoded[outputIndex] / sign / scale).toFixed(12));
  });
  return output;
}

function meanSquaredError(a, b) {
  const length = Math.min(a.length, b.length);
  return a.slice(0, length).reduce((sum, value, index) => sum + ((value - b[index]) ** 2), 0) / Math.max(1, length);
}

function simulatePhaseLattice(options = {}) {
  const size = Math.max(8, Math.min(1024, Number(options.size || 128)));
  const phases = Math.max(2, Math.min(128, Number(options.phases || 32)));
  const layers = Math.max(2, Math.min(128, Number(options.layers || 16)));
  const steps = Math.max(1, Math.min(365, Number(options.steps || 90)));
  const keySeed = options.keySeed || 'boa-user-language';
  const wrongKeySeed = options.wrongKeySeed || 'wrong-language';
  const phase = Number(options.phase || Math.PI / 3);
  const vector = Array.from({ length: size }, (_, index) => Number(seededUnit('boa-phase-data', index).toFixed(12)));
  const encoded = phaseEncodeVector(vector, keySeed, phase);
  const decodedCorrect = phaseDecodeVector(encoded, keySeed, phase);
  const decodedWrong = phaseDecodeVector(encoded, wrongKeySeed, phase);
  const correctMse = meanSquaredError(vector, decodedCorrect);
  const wrongMse = meanSquaredError(vector, decodedWrong);

  let compressionFactor = 1;
  let logicalStorage = 0;
  let rawWork = 0;
  let actualWork = 0;
  const snapshots = [];
  for (let step = 0; step < steps; step += 1) {
    const installSize = 50 + Math.abs(seededUnit(keySeed, `install:${step}`)) * 450;
    const redundancy = 1 + (seededNumber(keySeed, `category:${step}`) % phases) / phases;
    logicalStorage += installSize;
    rawWork += installSize;
    const pressure = Math.min(1, installSize / (logicalStorage + 1));
    const interaction = Math.log(redundancy + 1);
    const saturation = 1 + (compressionFactor / 100000) ** 1.2;
    compressionFactor += (0.015 * interaction * (compressionFactor ** 1.15) * (1 + pressure)) / saturation;
    compressionFactor -= Math.log(compressionFactor + 1) / 60;
    if (compressionFactor < 1) compressionFactor = 1;
    actualWork += installSize / compressionFactor;
    if (step % Math.max(1, Math.floor(steps / 6)) === 0 || step === steps - 1) {
      snapshots.push(Object.freeze({
        step,
        logicalStorageMb: Number(logicalStorage.toFixed(2)),
        simulatedCompressedMb: Number((logicalStorage / compressionFactor).toFixed(2)),
        compressionFactor: Number(compressionFactor.toFixed(4)),
      }));
    }
  }

  return Object.freeze({
    mode: 'boa-phase-lattice-simulation-v1',
    safetyNote: 'Simulation only: this demonstrates password/phase isolation and dedupe-style efficiency modeling. It does not claim to physically create CPU, RAM, or storage capacity.',
    dimensions: Object.freeze({ size, phases, layers, steps }),
    recovery: Object.freeze({
      correctKeyMse: Number(correctMse.toExponential(6)),
      wrongKeyMse: Number(wrongMse.toExponential(6)),
      wrongKeyLooksLikeGarbage: wrongMse > 0.01,
    }),
    compression: Object.freeze({
      logicalStorageMb: Number(logicalStorage.toFixed(2)),
      simulatedCompressedMb: Number((logicalStorage / compressionFactor).toFixed(2)),
      compressionFactor: Number(compressionFactor.toFixed(4)),
      rawWork: Number(rawWork.toFixed(2)),
      actualWork: Number(actualWork.toFixed(2)),
      efficiencyGain: Number((rawWork / Math.max(actualWork, 1e-9)).toFixed(4)),
      snapshots: Object.freeze(snapshots),
    }),
    pricing: estimatePerDevicePricing(Number(options.devices || 5)),
  });
}


function coordinateKey(coordinate) {
  return `${coordinate.x}:${coordinate.y}:${coordinate.z}`;
}

class PhaseCoordinateStack {
  constructor(ownerLicense, options = {}) {
    this.owner = ownerLicense;
    this.gridSize = Math.max(2, Math.min(256, Number(options.gridSize || 16)));
    this.maxDepth = Math.max(1, Math.min(128, Number(options.maxDepth || ownerLicense.passwordLanguage.phaseWidth || 8)));
    this.cells = new Map();
    this.entries = new Map();
  }

  coordinateFor(id) {
    const seed = `${this.owner.privacyScope}:${id}`;
    return Object.freeze({
      x: seededNumber(seed, 'x') % this.gridSize,
      y: seededNumber(seed, 'y') % this.gridSize,
      z: seededNumber(seed, 'z') % this.gridSize,
    });
  }

  equationFor(coordinate, depth) {
    const variable = this.owner.passwordLanguage.layerVariables[depth % this.owner.passwordLanguage.layerVariables.length];
    const value = (coordinate.x * variable.multiplier + coordinate.y * variable.fold + coordinate.z + variable.offset + depth) % this.gridSize;
    return `L${depth}:(${coordinate.x}*${variable.multiplier}+${coordinate.y}*${variable.fold}+${coordinate.z}+${variable.offset}+${depth}) mod ${this.gridSize}=${value}`;
  }

  store(id, payload, metadata = {}) {
    const entryId = String(id || `entry-${this.entries.size + 1}`);
    const coordinate = this.coordinateFor(entryId);
    const depth = (seededNumber(`${this.owner.privacyScope}:${entryId}`, 'depth') % this.maxDepth) + 1;
    const equationPath = Array.from({ length: depth }, (_, layer) => this.equationFor(coordinate, layer));
    const encoded = createTransferEquation(payload, this.owner, { kind: metadata.kind || 'phase-stack-entry', coordinate, depth });
    const record = Object.freeze({
      id: entryId,
      coordinate,
      depth,
      equationPath: Object.freeze(equationPath),
      encoded,
      metadata: Object.freeze({ ...metadata, storedAt: new Date().toISOString() }),
      byteLength: encodeValue(payload).length,
    });
    const key = coordinateKey(coordinate);
    const cell = this.cells.get(key) || [];
    cell[depth] = record;
    this.cells.set(key, cell);
    this.entries.set(entryId, record);
    return record;
  }

  isolate(locator) {
    const coordinate = locator.coordinate || locator;
    const depth = Number(locator.depth || 0);
    const cell = this.cells.get(coordinateKey(coordinate));
    if (!cell || !cell[depth]) throw new Error('No BOA phase-stack entry exists at that coordinate/depth.');
    const record = cell[depth];
    const expected = record.equationPath.join('|');
    const actual = (locator.equationPath || record.equationPath).join('|');
    if (expected !== actual) throw new Error('Equation path mismatch; this BOA language cannot bring the entry forward.');
    return record;
  }

  bringForward(locator, readerLicense = this.owner) {
    const record = this.isolate(locator);
    return solveTransferEquation(record.encoded, readerLicense);
  }

  snapshot(connectedDevices = 1) {
    const entries = [...this.entries.values()];
    const logicalBytes = entries.reduce((sum, entry) => sum + entry.byteLength, 0);
    const uniqueCoordinates = new Set(entries.map((entry) => coordinateKey(entry.coordinate))).size;
    const reuse = entries.length / Math.max(1, uniqueCoordinates);
    const unifiedEfficiency = calculateUnifiedEfficiency({ connectedDevices, stackedEntries: entries.length, reuse });
    return Object.freeze({
      mode: 'boa-3d-phase-coordinate-stack-v1',
      gridSize: this.gridSize,
      maxDepth: this.maxDepth,
      entries: entries.length,
      uniqueCoordinates,
      logicalBytes,
      reuse: Number(reuse.toFixed(4)),
      unifiedEfficiency,
    });
  }
}

function calculateUnifiedEfficiency(options = {}) {
  const connectedDevices = Math.max(1, Math.floor(Number(options.connectedDevices || options.devices || 1)));
  const stackedEntries = Math.max(0, Math.floor(Number(options.stackedEntries || 0)));
  const reuse = Math.max(1, Number(options.reuse || 1));
  const deviceMeshGain = Math.log2(connectedDevices + 1) / 4;
  const stackGain = Math.log(stackedEntries + 1) / 12;
  const reuseGain = Math.log(reuse + 1) / 8;
  const efficiencyMultiplier = Number((1 + deviceMeshGain + stackGain + reuseGain).toFixed(4));
  return Object.freeze({
    connectedDevices,
    stackedEntries,
    reuse: Number(reuse.toFixed(4)),
    efficiencyMultiplier,
    pricingSignal: Number((connectedDevices * efficiencyMultiplier).toFixed(4)),
    note: 'Modeled efficiency from unified-device sharing and phase-stack reuse; real gains depend on adapters, workloads, and OS permissions.',
  });
}

function runPhaseStackDemo(options = {}) {
  const license = deriveLicense(options.username || 'phase-user', options.password || 'phase stack password', { plan: options.plan || 'team' });
  const stack = new PhaseCoordinateStack(license, { gridSize: options.gridSize || 12, maxDepth: options.maxDepth || 9 });
  const payload = options.payload || { fileName: 'demo.txt', body: 'BOA brings this exact payload forward from a 3D coordinate.' };
  const stored = stack.store(options.id || 'demo-file', payload, { kind: 'file' });
  const recovered = stack.bringForward(stored, license);
  const snapshot = stack.snapshot(options.devices || 5);
  return Object.freeze({
    ok: true,
    mode: 'boa-phase-stack-demo-v1',
    stored,
    recovered,
    matches: encodeValue(recovered) === encodeValue(payload),
    snapshot,
  });
}

const DEFAULT_DIALECTS = Object.freeze({
  posix: Object.freeze({
    name: 'POSIX Shell',
    aliases: ['linux', 'macos', 'darwin', 'unix', 'posix'],
    verbs: Object.freeze({
      list: 'ls',
      read: 'cat',
      move: 'mv',
      copy: 'cp',
      remove: 'rm',
      where: 'pwd',
      makeDirectory: 'mkdir',
    }),
    flagMap: Object.freeze({ long: '-la', recursive: '-R', force: '-f' }),
  }),
  powershell: Object.freeze({
    name: 'PowerShell',
    aliases: ['windows', 'win32', 'powershell', 'pwsh'],
    verbs: Object.freeze({
      list: 'Get-ChildItem',
      read: 'Get-Content',
      move: 'Move-Item',
      copy: 'Copy-Item',
      remove: 'Remove-Item',
      where: 'Get-Location',
      makeDirectory: 'New-Item -ItemType Directory',
    }),
    flagMap: Object.freeze({ long: '-Force', recursive: '-Recurse', force: '-Force' }),
  }),
  boa: Object.freeze({
    name: 'BOA Internal Lattice',
    aliases: ['boa', 'serpent', 'lattice'],
    verbs: Object.freeze({
      list: 'coil.scan',
      read: 'coil.read',
      move: 'coil.move',
      copy: 'coil.copy',
      remove: 'coil.quarantine',
      where: 'coil.anchor',
      makeDirectory: 'coil.grow',
      send: 'coil.transfer',
      cast: 'coil.cast',
      task: 'coil.task',
    }),
    flagMap: Object.freeze({ long: '@detail', recursive: '@recursive', force: '@assert' }),
  }),
});

const DANGEROUS_PATTERNS = Object.freeze([
  /\b(eval|exec|Invoke-Expression|iex|powershell\s+-enc|curl\s+[^|]+\|\s*sh|wget\s+[^|]+\|\s*sh)\b/i,
  /(?:^|\s)(rm\s+-rf\s+\/|del\s+\/f\s+\/s|format\s+[a-z]:|shutdown\s+\/s)(?:\s|$)/i,
  /[`$][({]|;|&&|\|\||\|/,
]);

function stableHash(input) {
  const text = String(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function clampPlan(plan) {
  const normalized = String(plan || 'solo').toLowerCase();
  return PLAN_LIMITS[normalized] ? normalized : 'solo';
}

function seededNumber(seed, offset) {
  return parseInt(stableHash(`${seed}:${offset}`).slice(0, 8), 16) >>> 0;
}

function buildAlphabet(seed) {
  const base = 'abcdefghijklmnopqrstuvwxyz0123456789._-@';
  const chars = base.split('');
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = seededNumber(seed, index) % (index + 1);
    const current = chars[index];
    chars[index] = chars[swapIndex];
    chars[swapIndex] = current;
  }
  return chars.join('');
}

function derivePasswordLanguage(password, options = {}) {
  const secret = String(password || '');
  if (!secret) {
    throw new Error('A password is required to derive the BOA lattice language.');
  }

  const namespace = options.namespace || 'boa-language';
  const languageSeed = stableHash(`${namespace}:language:${secret}`);
  const equationSeed = stableHash(`${namespace}:equations:${secret}`);
  const alphabet = buildAlphabet(languageSeed);
  const phaseWidth = (parseInt(languageSeed.slice(0, 2), 16) % 8) + 5;
  const baseCursor = parseInt(languageSeed.slice(2, 6), 16) % 4096;
  const dialectShift = parseInt(languageSeed.slice(6, 8), 16) % alphabet.length;
  const layerVariables = Array.from({ length: phaseWidth }, (_, layer) => Object.freeze({
    layer,
    multiplier: (seededNumber(equationSeed, `m:${layer}`) % 31) + 1,
    offset: seededNumber(equationSeed, `o:${layer}`) % alphabet.length,
    fold: (seededNumber(equationSeed, `f:${layer}`) % 7) + 1,
  }));

  return Object.freeze({
    languageId: stableHash(`${languageSeed}:public`).slice(0, 12),
    languageSeed,
    equationSeed,
    alphabet,
    phaseWidth,
    baseCursor,
    dialectShift,
    layerVariables: Object.freeze(layerVariables),
  });
}

function deriveLicense(username, password, options = {}) {
  const normalizedUser = String(username || '').trim().toLowerCase();
  if (!normalizedUser) {
    throw new Error('A username is required to derive a BOA license lattice.');
  }

  const tenant = options.tenant || 'boa-local';
  const version = options.version || 1;
  const plan = clampPlan(options.plan);
  const heartbeatUrl = options.heartbeatUrl || DEFAULT_HEARTBEAT_URL;
  const passwordLanguage = derivePasswordLanguage(password, { namespace: `${tenant}:v${version}` });
  const usernameSeed = stableHash(`${tenant}:username:${normalizedUser}`);
  const licenseId = `boa-${normalizedUser}-${stableHash(`${usernameSeed}:${plan}:license`).slice(0, 10)}`;

  return Object.freeze({
    username: normalizedUser,
    usernameKey: stableHash(`${usernameSeed}:public`).slice(0, 12),
    tenant,
    version,
    plan,
    planLimits: PLAN_LIMITS[plan],
    heartbeatUrl,
    licenseId,
    // Same username + same password/language can see each other automatically.
    privacyScope: stableHash(`${usernameSeed}:${passwordLanguage.languageId}`).slice(0, 16),
    passwordLanguage,
    // Backward-compatible convenience fields.
    seed: passwordLanguage.languageSeed,
    phaseOffset: passwordLanguage.baseCursor % passwordLanguage.phaseWidth,
    latticeCursor: passwordLanguage.baseCursor,
    dialectShift: passwordLanguage.dialectShift,
  });
}

function detectRuntimeDialect(platform) {
  const runtimePlatform = String(
    platform ||
      (typeof process !== 'undefined' && process.platform) ||
      (typeof navigator !== 'undefined' && navigator.platform) ||
      'boa',
  ).toLowerCase();

  if (runtimePlatform.includes('win')) return 'powershell';
  if (runtimePlatform.includes('linux') || runtimePlatform.includes('darwin') || runtimePlatform.includes('mac')) {
    return 'posix';
  }
  return 'boa';
}

function resolveDialect(target, dialects = DEFAULT_DIALECTS) {
  const requested = String(target || detectRuntimeDialect()).toLowerCase();
  const direct = dialects[requested];
  if (direct) return direct;

  const match = Object.values(dialects).find((dialect) =>
    dialect.name.toLowerCase() === requested || dialect.aliases.includes(requested),
  );
  if (!match) {
    throw new Error(`Unsupported device dialect: ${target}`);
  }
  return match;
}

function splitCommand(input) {
  return String(input || '').trim().split(/\s+/).filter(Boolean);
}

function normalizeIntent(input) {
  const tokens = splitCommand(input);
  const head = (tokens[0] || '').toLowerCase();
  const flags = new Set();
  const args = [];

  let verb = 'unknown';
  if (['ls', 'dir', 'get-childitem', 'list'].includes(head)) verb = 'list';
  if (['cat', 'type', 'get-content', 'read'].includes(head)) verb = 'read';
  if (['mv', 'move', 'move-item'].includes(head)) verb = 'move';
  if (['cp', 'copy', 'copy-item'].includes(head)) verb = 'copy';
  if (['rm', 'del', 'remove-item', 'remove'].includes(head)) verb = 'remove';
  if (['pwd', 'cd', 'get-location', 'where'].includes(head)) verb = 'where';
  if (['mkdir', 'md', 'new-item'].includes(head)) verb = 'makeDirectory';
  if (['send', 'transfer'].includes(head)) verb = 'send';
  if (['cast', 'screencast'].includes(head)) verb = 'cast';
  if (['task', 'todo'].includes(head)) verb = 'task';

  tokens.slice(1).forEach((token) => {
    const lowered = token.toLowerCase();
    if (['-la', '-l', '/a', '-force'].includes(lowered)) flags.add('long');
    else if (['-r', '-recurse', '-recursive', '/s'].includes(lowered)) flags.add('recursive');
    else if (['-f', '-force', '/f'].includes(lowered)) flags.add('force');
    else args.push(token);
  });

  return Object.freeze({ raw: String(input || ''), verb, flags: [...flags], args });
}

function isPotentiallyHostile(input) {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(String(input || '')));
}

function sanitizeArgument(argument) {
  return String(argument || '').replace(/[^\w@%+=:,./\\-]/g, '_');
}

function buildDialectCommand(intent, dialect) {
  if (!dialect.verbs[intent.verb]) return null;
  const translatedFlags = intent.flags.map((flag) => dialect.flagMap[flag]).filter(Boolean);
  const translatedArgs = intent.args.map(sanitizeArgument);
  return [dialect.verbs[intent.verb], ...translatedFlags, ...translatedArgs].join(' ');
}

function rotateAlphabetCharacter(char, language, index, direction = 1) {
  const alphabet = language.alphabet;
  const position = alphabet.indexOf(char.toLowerCase());
  if (position === -1) return char === ' ' ? '·' : char;
  const layer = language.layerVariables[index % language.layerVariables.length];
  const shift = (language.dialectShift + layer.offset + index * layer.fold) % alphabet.length;
  const next = (position + direction * shift + alphabet.length * 4) % alphabet.length;
  const rotated = alphabet[next];
  return char === char.toUpperCase() ? rotated.toUpperCase() : rotated;
}

function obscureForLicense(text, license) {
  const language = license.passwordLanguage || license;
  return String(text || '')
    .split('')
    .map((char, index) => rotateAlphabetCharacter(char, language, index, 1))
    .join('');
}

function unobscureForLicense(text, license) {
  const language = license.passwordLanguage || license;
  return String(text || '')
    .split('')
    .map((char, index) => (char === '·' ? ' ' : rotateAlphabetCharacter(char, language, index, -1)))
    .join('');
}

function signPayload(license, payload, context = 'boa') {
  return stableHash(`${license.privacyScope}:${license.passwordLanguage.equationSeed}:${context}:${payload}`);
}

function translateCommand(input, targetDevice, license) {
  const intent = normalizeIntent(input);
  const hostile = isPotentiallyHostile(input);
  const dialect = resolveDialect(targetDevice);
  const command = hostile ? null : buildDialectCommand(intent, dialect);
  const status = hostile || !command ? 'quarantined' : 'ready';
  const payload = command || `boa.quarantine ${stableHash(input)}`;
  const obscured = obscureForLicense(payload, license);
  const signature = signPayload(license, payload, `${targetDevice}:${status}`);

  return Object.freeze({
    status,
    targetDevice: targetDevice || detectRuntimeDialect(),
    dialect: dialect.name,
    intent,
    command,
    obscured,
    signature,
    equation: createTransferEquation(payload, license, { kind: 'intent', targetDevice }),
    reason: hostile ? 'Input matched BOA quarantine patterns.' : undefined,
  });
}

function encodeValue(value) {
  return JSON.stringify(value);
}

function rleCompress(text) {
  if (!text) return [];
  const runs = [];
  let last = text[0];
  let count = 1;
  for (let index = 1; index < text.length; index += 1) {
    const char = text[index];
    if (char === last) count += 1;
    else {
      runs.push([last, count]);
      last = char;
      count = 1;
    }
  }
  runs.push([last, count]);
  return runs;
}

function rleExpand(runs) {
  return runs.map(([char, count]) => char.repeat(count)).join('');
}

function equationMask(layer, index) {
  return (layer.multiplier * 257 + layer.offset * 17 + index * layer.fold) & 0xffff;
}

function encodeEquationChunk(char, index, license) {
  const code = char.charCodeAt(0);
  const language = license.passwordLanguage;
  const layer = language.layerVariables[index % language.layerVariables.length];
  const variable = code ^ equationMask(layer, index);
  return Object.freeze({ layer: layer.layer, variable, count: 1 });
}

function decodeEquationChunk(chunk, index, license) {
  const language = license.passwordLanguage;
  const layer = language.layerVariables[chunk.layer % language.layerVariables.length];
  const code = chunk.variable ^ equationMask(layer, index);
  return String.fromCharCode(code).repeat(chunk.count || 1);
}

function createTransferEquation(payload, license, options = {}) {
  const encoded = encodeValue(payload);
  const chunks = encoded.split('').map((char, index) => encodeEquationChunk(char, index, license));
  return Object.freeze({
    kind: options.kind || 'data',
    mode: 'phase-equation-v1',
    usernameKey: license.usernameKey,
    languageId: license.passwordLanguage.languageId,
    payloadHash: stableHash(encoded),
    phaseWidth: license.passwordLanguage.phaseWidth,
    layers: Object.freeze(chunks),
    meta: Object.freeze({ ...options, kind: undefined }),
  });
}

function solveTransferEquation(equation, license) {
  if (equation.languageId !== license.passwordLanguage.languageId) {
    throw new Error('Password language mismatch: BOA cannot solve this equation.');
  }
  const encoded = equation.layers.map((chunk, index) => decodeEquationChunk(chunk, index, license)).join('');
  if (stableHash(encoded) !== equation.payloadHash) {
    throw new Error('Equation integrity check failed.');
  }
  return JSON.parse(encoded);
}

function runSandboxScenario(input, options = {}) {
  const username = options.username || 'sandbox';
  const password = options.password || 'sandbox demonstration password';
  const target = options.target || 'linux';
  const license = deriveLicense(username, password, { plan: options.plan || 'team' });
  const translated = translateCommand(input, target, license);
  const memory = new PhaseStackMemory(license, { phaseWidth: 6 });
  memory.push({ stage: 'raw-intent', input: String(input || '') });
  memory.push({ stage: 'boa-envelope', status: translated.status, obscured: translated.obscured });
  memory.push({ stage: 'adapter-decision', command: translated.command, reason: translated.reason || 'Trusted adapter may dispatch this inert envelope.' });
  const sixVariableCast = createCastVariables({
    pointerX: Number(options.pointerX || 0),
    pointerY: Number(options.pointerY || 0),
    inputState: translated.intent.verb,
    frameHash: stableHash(String(input || '')),
    viewport: options.viewport || 'sandbox',
    phase: memory.snapshot().headHash,
  }, license);
  return Object.freeze({
    verdict: translated.status === 'quarantined' ? 'quarantined' : 'translated',
    safetyNote: translated.status === 'quarantined'
      ? 'The input matched hostile patterns and was converted into an inert BOA quarantine envelope instead of executable code.'
      : 'The input was normalized into intent, signed, obscured, and wrapped as a solvable BOA equation.',
    translated,
    memory: memory.snapshot(),
    sixVariableCast,
  });
}

function createCastVariables(frame, license) {
  const variables = {
    intent: String(frame.inputState || 'idle'),
    x: Number(frame.pointerX || 0),
    y: Number(frame.pointerY || 0),
    viewport: String(frame.viewport || 'main'),
    frameHash: String(frame.frameHash || stableHash(JSON.stringify(frame))),
    phase: String(frame.phase || license.privacyScope),
  };
  return Object.freeze({
    mode: 'boa-six-variable-cast-v1',
    variables: Object.freeze(variables),
    equation: createTransferEquation(variables, license, { kind: 'cast' }),
    signature: signPayload(license, JSON.stringify(variables), 'cast'),
  });
}

class PhaseStackMemory {
  constructor(license, options = {}) {
    this.license = license;
    this.phaseWidth = options.phaseWidth || license.passwordLanguage.phaseWidth;
    this.frames = [];
  }

  push(value, metadata = {}) {
    const previousHash = this.frames.length ? this.frames[this.frames.length - 1].hash : 'root';
    const phase = (this.license.phaseOffset + this.frames.length) % this.phaseWidth;
    const equation = createTransferEquation(value, this.license, { kind: 'memory', phase, previousHash });
    const encoded = encodeValue(value);
    const compressed = rleCompress(obscureForLicense(encoded, this.license));
    const hash = stableHash(`${previousHash}:${phase}:${equation.payloadHash}`);
    const frame = Object.freeze({
      index: this.frames.length,
      phase,
      cursor: (this.license.latticeCursor + this.frames.length) % 4096,
      hash,
      previousHash,
      equation,
      compressed,
      byteLength: encoded.length,
      compressedUnits: compressed.length,
      metadata: Object.freeze({ ...metadata }),
    });
    this.frames.push(frame);
    return frame;
  }

  read(index = this.frames.length - 1) {
    const frame = this.frames[index];
    if (!frame) return undefined;
    return solveTransferEquation(frame.equation, this.license);
  }

  snapshot() {
    const rawBytes = this.frames.reduce((sum, frame) => sum + frame.byteLength, 0);
    const compressedUnits = this.frames.reduce((sum, frame) => sum + frame.compressedUnits, 0);
    return Object.freeze({
      frames: this.frames.length,
      phases: this.phaseWidth,
      rawBytes,
      compressedUnits,
      compressionRatio: rawBytes === 0 ? 1 : Number((compressedUnits / rawBytes).toFixed(4)),
      headHash: this.frames.length ? this.frames[this.frames.length - 1].hash : 'root',
    });
  }
}

function compareVisibility(localLicense, remoteLicense) {
  if (localLicense.usernameKey !== remoteLicense.usernameKey) {
    return Object.freeze({ state: 'isolated', reason: 'different-username' });
  }
  if (localLicense.privacyScope === remoteLicense.privacyScope) {
    return Object.freeze({ state: 'visible', reason: 'same-username-same-password' });
  }
  return Object.freeze({ state: 'blocked', reason: 'same-username-different-password' });
}

class HandshakeBroker {
  constructor(options = {}) {
    this.clock = options.clock || (() => Date.now());
    this.handshakes = new Map();
  }

  request(requester, target, scope = 'workspace', options = {}) {
    const visibility = compareVisibility(requester, target);
    const planAllowsHandshake = requester.planLimits.handshakes && target.planLimits.handshakes;
    const state = visibility.state === 'visible' || planAllowsHandshake ? 'pending' : 'blocked';
    const id = `hs-${stableHash(`${requester.licenseId}:${target.licenseId}:${scope}:${this.clock()}`)}`;
    const record = Object.freeze({
      id,
      requester: requester.licenseId,
      target: target.licenseId,
      requesterScope: requester.privacyScope,
      targetScope: target.privacyScope,
      sameUsername: requester.usernameKey === target.usernameKey,
      scope,
      state,
      expiresAt: this.clock() + Number(options.ttlMs || 15 * 60 * 1000),
      reason: state === 'blocked' ? 'Both plans must support paid handshakes.' : visibility.reason,
    });
    this.handshakes.set(id, record);
    return record;
  }

  respond(handshakeId, approved, responderLicense) {
    const record = this.handshakes.get(handshakeId);
    if (!record) throw new Error(`Unknown handshake: ${handshakeId}`);
    if (record.target !== responderLicense.licenseId) throw new Error('Only the target BOA can answer this handshake.');
    const state = approved && record.state !== 'blocked' ? 'approved' : 'denied';
    const grant = Object.freeze({
      ...record,
      state,
      token: state === 'approved' ? stableHash(`${record.id}:${responderLicense.privacyScope}:grant`) : null,
      approvedAt: this.clock(),
    });
    this.handshakes.set(handshakeId, grant);
    return grant;
  }

  isApproved(handshakeId) {
    const record = this.handshakes.get(handshakeId);
    return Boolean(record && record.state === 'approved' && record.expiresAt >= this.clock());
  }
}

class DeviceMesh {
  constructor(license) {
    this.license = license;
    this.devices = new Map();
  }

  registerDevice(deviceId, profile = {}) {
    const id = String(deviceId || '').trim();
    if (!id) throw new Error('deviceId is required');
    if (this.devices.size >= this.license.planLimits.devices) {
      throw new Error(`Plan ${this.license.plan} allows ${this.license.planLimits.devices} device(s).`);
    }
    const dialect = resolveDialect(profile.dialect || profile.os || detectRuntimeDialect());
    const resources = Object.freeze({
      cpuWeight: Number(profile.cpuWeight || 1),
      memoryMb: Number(profile.memoryMb || 0),
      storageMb: Number(profile.storageMb || 0),
    });
    const record = Object.freeze({ id, dialect: dialect.name, resources, privacyScope: this.license.privacyScope });
    this.devices.set(id, record);
    return record;
  }

  capacity() {
    const devices = [...this.devices.values()];
    const totals = devices.reduce(
      (acc, device) => ({
        cpuWeight: acc.cpuWeight + device.resources.cpuWeight,
        memoryMb: acc.memoryMb + device.resources.memoryMb,
        storageMb: acc.storageMb + device.resources.storageMb,
      }),
      { cpuWeight: 0, memoryMb: 0, storageMb: 0 },
    );
    const cooperativeMultiplier = Number((1 + Math.log2(devices.length + 1) / 10).toFixed(4));
    return Object.freeze({ devices: devices.length, totals, cooperativeMultiplier });
  }

  envelopeFor(deviceId, input) {
    const record = this.devices.get(deviceId);
    if (!record) throw new Error(`Unknown BOA device: ${deviceId}`);
    return translateCommand(input, record.dialect, this.license);
  }
}

class Workspace {
  constructor(ownerLicense, options = {}) {
    this.owner = ownerLicense;
    this.id = options.id || `ws-${stableHash(`${ownerLicense.licenseId}:${options.name || 'workspace'}`)}`;
    this.name = options.name || 'BOA Workspace';
    this.tasks = [];
    this.submissions = [];
  }

  addTask(title, details = {}, authorLicense = this.owner) {
    if (authorLicense.usernameKey !== this.owner.usernameKey) {
      throw new Error('Only BOAs in the licensed username group can add tasks to this workspace.');
    }
    const task = Object.freeze({
      id: `task-${stableHash(`${this.id}:${title}:${this.tasks.length}`)}`,
      title: String(title),
      details: createTransferEquation(details, this.owner, { kind: 'task' }),
      state: 'open',
      signature: signPayload(authorLicense, title, this.id),
    });
    this.tasks.push(task);
    return task;
  }

  submitTask(taskId, result, workerLicense, handshakeGrant) {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    if (workerLicense.usernameKey !== this.owner.usernameKey) {
      throw new Error('Workspace submissions require the same licensed username group.');
    }
    const samePrivateScope = workerLicense.privacyScope === this.owner.privacyScope;
    if (!samePrivateScope && (!handshakeGrant || handshakeGrant.state !== 'approved')) {
      throw new Error('Different password language requires an approved handshake before submitting.');
    }
    const submission = Object.freeze({
      id: `sub-${stableHash(`${taskId}:${workerLicense.licenseId}:${this.submissions.length}`)}`,
      taskId,
      worker: workerLicense.licenseId,
      resultEquation: createTransferEquation(result, samePrivateScope ? this.owner : workerLicense, { kind: 'submission' }),
      leavesWorkerObscured: false,
      signature: signPayload(workerLicense, `${taskId}:${encodeValue(result)}`, this.id),
    });
    this.submissions.push(submission);
    return submission;
  }
}

function createUnifiedNode(username, password, options = {}) {
  const license = deriveLicense(username, password, options);
  const mesh = new DeviceMesh(license);
  const memory = new PhaseStackMemory(license);
  const workspace = new Workspace(license, { name: options.workspaceName });
  return Object.freeze({ license, mesh, memory, workspace, dialect: detectRuntimeDialect(options.platform) });
}

function createMaintainerPolicy(options = {}) {
  const fingerprint = options.publicKeyFingerprint || null;
  return Object.freeze({
    heartbeatUrl: options.heartbeatUrl || DEFAULT_HEARTBEAT_URL,
    publicKeyFingerprint: fingerprint,
    canAcceptUpdate(message) {
      if (!fingerprint) return false;
      return stableHash(String(message && message.publicKey || '')).slice(0, 16) === fingerprint;
    },
  });
}

const BoaProtocol = Object.freeze({
  DEFAULT_DIALECTS,
  DEFAULT_HEARTBEAT_URL,
  PLAN_LIMITS,
  PER_DEVICE_PRICING,
  PhaseCoordinateStack,
  DeviceMesh,
  HandshakeBroker,
  PhaseStackMemory,
  Workspace,
  buildDialectCommand,
  compareVisibility,
  createCastVariables,
  createMaintainerPolicy,
  estimatePerDevicePricing,
  calculateUnifiedEfficiency,
  createTransferEquation,
  createUnifiedNode,
  deriveLicense,
  derivePasswordLanguage,
  detectRuntimeDialect,
  isPotentiallyHostile,
  normalizeIntent,
  obscureForLicense,
  resolveDialect,
  runSandboxScenario,
  runPhaseStackDemo,
  simulatePhaseLattice,
  signPayload,
  solveTransferEquation,
  stableHash,
  translateCommand,
  unobscureForLicense,
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BoaProtocol;
}

if (typeof window !== 'undefined') {
  window.BoaProtocol = BoaProtocol;
}
