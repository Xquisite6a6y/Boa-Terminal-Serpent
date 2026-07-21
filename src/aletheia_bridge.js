'use strict';

const fs = require('fs');
const path = require('path');
const Boa = require('./boa');

const MANIFEST_PATH = path.join(__dirname, '..', 'integrations', 'aletheia', 'manifest.json');
const UNIFIED_WORKSPACE_PATH = path.join(__dirname, '..', 'integrations', 'aletheia', 'unified-workspace.json');
const ETA_T = 0.2220691103525;
const TE_DOT = 0.0000015367;

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function readUnifiedWorkspace() {
  return JSON.parse(fs.readFileSync(UNIFIED_WORKSPACE_PATH, 'utf8'));
}

function walkFiles(root, relativeRoot = root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') return [];
    if (entry.isDirectory()) return walkFiles(full, relativeRoot);
    return [path.relative(relativeRoot, full).replace(/\\/g, '/')];
  });
}

function safeText(value, fallback = 'observable target') {
  const text = String(value || fallback).trim();
  return text || fallback;
}

function numeric(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function muResidue(alphaSpatial, alphaTemporal) {
  return Number((alphaSpatial * alphaTemporal - 1).toFixed(12));
}

function cancellationState(mu) {
  const magnitude = Math.abs(mu);
  if (magnitude <= 1e-9) {
    return Object.freeze({ state: 'null-light', perfectCancellation: true, relation: 'c_m/s ⊗ c_s/m = 1', result: 'ds² = 0' });
  }
  return Object.freeze({ state: 'standing-wave-matter', perfectCancellation: false, relation: 'c_m/s ⊗ c_s/m ≠ 1', result: 'mass / color / charge / geometry expression' });
}

function omegaClosureReverseSolve(target, options = {}) {
  const desiredReality = safeText(target || options.target, 'BOA/Aletheia coexistence');
  const alphaSpatial = numeric(options.alphaSpatial || options.alpha_m_s, 1.00072973);
  const alphaTemporal = numeric(options.alphaTemporal || options.alpha_s_m, 1 / alphaSpatial);
  const temporalViscosity = numeric(options.temporalViscosity || options.eta_t, ETA_T);
  const temporalClosure = numeric(options.temporalClosure || options.teDot || options.dot_T_e, TE_DOT);
  const mu = typeof options.mu === 'number' ? numeric(options.mu, 0) : muResidue(alphaSpatial, alphaTemporal);
  const cancellation = cancellationState(mu);
  const closureTerm = Number((3 * temporalViscosity ** 4 + temporalClosure).toFixed(12));
  const omegaScore = Number((Math.abs(mu) + closureTerm).toFixed(12));
  const seed = Boa.stableHash(`${desiredReality}:${alphaSpatial}:${alphaTemporal}:${mu}:${closureTerm}`);
  return Object.freeze({
    ok: true,
    operator: 'Omega Closure Reverse Operator',
    notation: 'R_Ω^-1(X_f)',
    desiredReality,
    closureRequirement: 'Work backward from the final closure state until the failed-cancellation path is isolated.',
    alpha: Object.freeze({
      split: 'α_Ω = α_m/s ⊕ α_s/m',
      spatialFacing: alphaSpatial,
      temporalFacing: alphaTemporal,
      muResidue: mu,
    }),
    cancellation,
    temporal: Object.freeze({
      eta_t: temporalViscosity,
      dot_T_e: temporalClosure,
      closureTerm,
    }),
    reversePath: Object.freeze([
      { step: 'X_f', meaning: 'final observed thing', value: desiredReality },
      { step: 'Ω', meaning: 'closure requirement', value: `closure-score:${omegaScore}` },
      { step: 'μ', meaning: 'field mismatch residue', value: mu },
      { step: '(α_m/s, α_s/m)', meaning: 'dual-alpha propagation split', value: [alphaSpatial, alphaTemporal] },
      { step: '(c_m/s, c_s/m)', meaning: 'light communication modes', value: cancellation.relation },
      { step: '0≠0', meaning: 'first boundary relationship', value: cancellation.state },
      { step: 'η_t^4', meaning: 'temporal viscosity closure', value: closureTerm },
      { step: 'V_λ', meaning: 'volume/matter expression path', value: seed.slice(0, 12) },
      { step: 'X_0', meaning: 'recoverable origin state', value: `origin-${seed.slice(12, 24)}` },
    ]),
    implementationUse: 'BOA routes/protects authorized signals; Aletheia supplies closure-first planning, reverse-solve reasoning, and materialization context.',
  });
}



const CYBERSECURITY_CAPABILITY_LAYERS = Object.freeze([
  Object.freeze({
    name: 'Signal membrane',
    boaComponent: 'BOA Core gate',
    purpose: 'Automatically wrap outbound BOA-routed payloads and unwrap trusted inbound envelopes.',
    implementedNow: true,
    evidence: ['src/boa-gate.js', 'POST /gate/send', 'POST /gate/receive', 'POST /api/boa/send'],
  }),
  Object.freeze({
    name: 'Inert-by-default intake',
    boaComponent: 'BOA Network envelopes',
    purpose: 'Treat inbound data as inert envelopes unless a trusted adapter explicitly handles it.',
    implementedNow: true,
    evidence: ['strict raw-signal rejection', 'signed envelope format', 'redacted event previews'],
  }),
  Object.freeze({
    name: 'Local autonomous daemon',
    boaComponent: 'BOA daemon + local gate',
    purpose: 'Keep protection running after the dashboard closes and report health through heartbeat.',
    implementedNow: true,
    evidence: ['node boa-daemon.js daemon', 'node boa-daemon.js gate', 'GET 127.0.0.1:8788/status'],
  }),
  Object.freeze({
    name: 'Pairing and license clones',
    boaComponent: 'Dashboard pairing + installer',
    purpose: 'Clone trusted BOA instances to approved devices with pairing codes and per-device policy.',
    implementedNow: true,
    evidence: ['POST /api/pair/start', 'POST /api/pair/complete', 'GET /download/installer'],
  }),
  Object.freeze({
    name: 'Adaptive policy brain',
    boaComponent: 'Aletheia reverse-solve planner',
    purpose: 'Use closure-first reasoning to decide which controls, adapters, and tests must exist before a target security outcome is believable.',
    implementedNow: true,
    evidence: ['POST /api/aletheia/cyber-app', 'Omega Closure Reverse Operator'],
  }),
  Object.freeze({
    name: 'Privileged traffic adapters',
    boaComponent: 'Future OS integrations',
    purpose: 'Move from BOA-aware traffic to full-device routing using platform-approved VPN/proxy/firewall layers.',
    implementedNow: false,
    evidence: ['Android VPNService adapter', 'Windows Filtering Platform adapter', 'Linux nftables/proxy adapter', 'macOS Network Extension adapter'],
  }),
]);

function buildCyberSecurityAppPlan(options = {}) {
  const target = safeText(options.target, 'Aletheia builds the most advanced BOA-based cybersecurity app that can be honestly implemented');
  const solve = omegaClosureReverseSolve(target, options);
  const threatModel = Object.freeze([
    'untrusted payloads must not execute as code',
    'intercepted BOA-routed data should be opaque without the trusted device language',
    'raw inbound traffic can be rejected in strict mode',
    'dashboard compromise must not stop the local gate from protecting BOA-routed channels',
    'secrets must stay outside GitHub and outside client-side HTML',
    'full-device interception must require explicit OS-level VPN/proxy/firewall permission',
  ]);
  const architecture = Object.freeze([
    { layer: 'BOA Core', responsibility: 'local autonomous signal gate, envelope engine, policy enforcement, heartbeat source' },
    { layer: 'Aletheia Builder', responsibility: 'closure-first planner that converts desired security outcomes into required controls and acceptance tests' },
    { layer: 'BOA Dashboard', responsibility: 'human control surface for pairing, status, billing, toggles, and no-code device connection' },
    { layer: 'BOA Network', responsibility: 'trusted BOA-to-BOA envelope routing, relay, and future mesh transport' },
    { layer: 'Privileged Adapters', responsibility: 'future platform-specific VPN/proxy/firewall integrations for wider traffic coverage' },
  ]);
  const buildPhases = Object.freeze([
    { phase: 'MVP membrane', status: 'implemented', output: 'BOA-routed signals wrap/unwrap automatically and raw inbound strict mode can reject unsafe input.' },
    { phase: 'Aletheia policy synthesis', status: 'implemented', output: 'Reverse-solve target security states into controls, tests, and OS adapter requirements.' },
    { phase: 'Trust cockpit', status: 'implemented', output: 'Dashboard shows devices, heartbeats, signal counts, backend components, pairing, billing, and Aletheia plans.' },
    { phase: 'Local proxy enforcement', status: 'next', output: 'Make browser/BOA-aware app traffic default through localhost gate with per-route policies.' },
    { phase: 'OS adapter hardening', status: 'future', output: 'Add Android VPNService, WFP, nftables/proxy, and Network Extension adapters where users grant permission.' },
    { phase: 'Zero-trust mesh', status: 'future', output: 'Encrypted BOA-to-BOA relay, route scoring, device posture, and revocation across licensed devices.' },
  ]);
  const safeguards = Object.freeze([
    'No eval or command execution for network data.',
    'Every unknown inbound item stays inert until a trusted adapter accepts it.',
    'Secrets are redacted and must be injected through environment variables or host secret stores.',
    'Security claims remain scoped to BOA-routed traffic until OS adapters are installed.',
    'Users can disable automation features from the dashboard.',
    'Audit events should contain redacted previews, counts, policy decisions, and route IDs only.',
  ]);
  const acceptanceTests = Object.freeze([
    'BOA gate starts locally without the website.',
    'Outbound /gate/send returns a signed boa-envelope-v1.',
    'Inbound /gate/receive unwraps BOA envelopes and strict mode rejects raw signals.',
    'Dashboard can create account, connect device, pair daemon, and show heartbeat/signal counts.',
    'Aletheia builder returns closure path, capability layers, build phases, safeguards, and OS limits.',
    'AWS health check returns the Aletheia builder component without requiring secrets.',
  ]);
  return Object.freeze({
    ok: true,
    mode: 'aletheia-boa-cybersecurity-builder-v1',
    target,
    claim: 'Aletheia can build on BOA by reverse-solving advanced cybersecurity outcomes into concrete BOA controls, adapters, safeguards, and tests.',
    reverseSolve: solve,
    capabilityLayers: CYBERSECURITY_CAPABILITY_LAYERS,
    architecture,
    threatModel,
    buildPhases,
    safeguards,
    acceptanceTests,
    honestScope: 'Implemented protection applies to BOA-routed traffic and local-gate workflows today. Full-device interception requires future platform-approved VPN, proxy, firewall, or kernel/user permission adapters.',
  });
}


function unifiedWorkspaceStatus() {
  const workspace = readUnifiedWorkspace();
  const root = path.join(__dirname, '..');
  const modules = workspace.modules.map((moduleInfo) => {
    const moduleRoot = moduleInfo.path === '.' ? root : path.join(root, moduleInfo.path);
    const files = walkFiles(moduleRoot);
    const packagePath = path.join(moduleRoot, 'package.json');
    const packageInfo = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) : null;
    return Object.freeze({
      ...moduleInfo,
      exists: fs.existsSync(moduleRoot),
      fileCount: files.length,
      sampleFiles: Object.freeze(files.slice(0, 12)),
      packageName: packageInfo && packageInfo.name || null,
      packageManager: packageInfo && packageInfo.packageManager || null,
      scripts: packageInfo && packageInfo.scripts ? Object.freeze(Object.keys(packageInfo.scripts)) : Object.freeze([]),
    });
  });
  return Object.freeze({
    ok: true,
    ...workspace,
    modules: Object.freeze(modules),
    unified: modules.every((moduleInfo) => moduleInfo.exists),
    totalFiles: modules.reduce((sum, moduleInfo) => sum + moduleInfo.fileCount, 0),
    explanation: 'The Aletheia repositories are vendored as local modules under integrations/aletheia/modules while BOA remains the deployable root service.',
  });
}

function fullUnificationPlan(options = {}) {
  const workspace = unifiedWorkspaceStatus();
  const cyber = buildCyberSecurityAppPlan({
    target: options.target || 'fully unified BOA + Aletheia cybersecurity operating system',
    ...options,
  });
  return Object.freeze({
    ok: true,
    mode: 'boa-aletheia-full-unification-v1',
    workspace,
    cyberSecurityBuilder: cyber,
    runtimeContract: Object.freeze([
      'BOA serves as the no-code product shell and deployable AWS root.',
      'BOA Core enforces local signal-gate behavior for authorized channels.',
      'Aletheia modules contribute agentic planning, reverse-solve UX, ethics, and marketplace concepts.',
      'The bridge converts Aletheia target states into BOA controls, adapter requirements, and acceptance tests.',
    ]),
    nextFusionSteps: Object.freeze([
      'Build Aeon frontend as a static artifact and mount it under /aletheia/app when its pnpm dependencies are installed.',
      'Map Aeon tRPC/agentic routes onto BOA API routes or run Aeon as a sidecar service behind the same domain.',
      'Promote shared reverse-solve primitives into a package boundary once both apps depend on the same module API.',
      'Add OS-specific privileged adapters only after user-granted platform permissions are available.',
    ]),
  });
}

function integrationSummary() {
  const manifest = readManifest();
  return Object.freeze({
    ok: true,
    ...manifest,
    endpoints: Object.freeze({
      page: 'GET /aletheia',
      status: 'GET /api/aletheia/status',
      reverseSolve: 'POST /api/aletheia/reverse-solve',
      cyberApp: 'POST /api/aletheia/cyber-app',
      unified: 'GET /api/aletheia/unified',
      unify: 'POST /api/aletheia/unify',
    }),
    operator: omegaClosureReverseSolve('BOA + Aletheia coexistence').operator,
  });
}

module.exports = Object.freeze({
  ETA_T,
  TE_DOT,
  MANIFEST_PATH,
  UNIFIED_WORKSPACE_PATH,
  CYBERSECURITY_CAPABILITY_LAYERS,
  buildCyberSecurityAppPlan,
  cancellationState,
  integrationSummary,
  muResidue,
  omegaClosureReverseSolve,
  fullUnificationPlan,
  readManifest,
  readUnifiedWorkspace,
  unifiedWorkspaceStatus,
});
