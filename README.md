# Boa-Terminal-Serpent

BOA is a local-first account dashboard, daemon issuer, and protocol layer for
turning user intent into safe, auditable, device-specific envelopes. The current
repository is runnable with Node only; no package install is required.

## What is real in this MVP

- **Account creation and dashboard login** happen through the BOA site served by
  `node bin/boa-node.js serve`. The submitted password is hashed with PBKDF2 and
  becomes the dashboard login secret.
- **Immediate daemon download** is issued by the site after signup. The daemon is
  a personalized JavaScript file with a device token, heartbeat logic, and cast
  frame submission logic. It does not contain the user's password.
- **Password lattice language** is derived from the user's password and controls
  the alphabet, starting cursor, phase width, and per-layer variables.
- **Transfer equations** are separate from the protection language and are used
  for intent, file, workspace, cast, and memory payload transfer between BOAs
  that can solve the same password language.
- **Plans** are enforced locally for device limits and feature access. The
  dashboard records activated plan receipts and immediately applies the selected
  limits to daemon downloads and dashboard capabilities.
- **Daemon/site heartbeat** defaults to `https://truthunveiled.me` in protocol
  metadata, while the local dashboard server handles development traffic.

> BOA does not include a password backdoor and does not claim malware is
> impossible. The daemon uses device tokens, the dashboard uses password hashes,
> and untrusted commands are converted into inert envelopes until a trusted
> adapter validates them.

## Run the account site

```bash
node bin/boa-node.js serve --host 127.0.0.1 --port 8787
```

Open `http://127.0.0.1:8787`, create an account, and the site will immediately
issue `boa-daemon.js` as a download. The same dashboard also supports login,
plan activation, task creation, daemon downloads, device status, and cast frame
inspection.

## Run the downloaded daemon

```bash
node boa-daemon.js install
node boa-daemon.js heartbeat
node boa-daemon.js daemon
node boa-daemon.js cast "Terminal" "build completed successfully"
```

The daemon only touches the site through authenticated device-token calls. The
`install` command copies the downloaded daemon into `~/.boa/boa-daemon.js`,
locks the file permissions to the current user, and writes local device metadata.
Heartbeat and cast commands then post resource data and cast frames to the
dashboard APIs.

## CLI account bootstrap

If you want to create an account without the browser, provide real values through
environment variables or flags:

```bash
BOA_USERNAME="$USER" BOA_PASSWORD="$BOA_PASSWORD" BOA_PLAN=team \
  node bin/boa-node.js site-signup --state .boa-state.json
```

## Protocol example

```js
const Boa = require('./src/boa');

const owner = Boa.deriveLicense(process.env.BOA_USERNAME, process.env.BOA_PASSWORD, {
  plan: 'team',
});

const envelope = Boa.translateCommand('ls -la /tmp', 'linux', owner);

console.log(envelope.status);   // "ready"
console.log(envelope.command);  // "ls -la /tmp"
console.log(envelope.obscured); // password-language-shaped BOA text
```

## Password language vs equations

The password determines the lattice language; equations are the portable layer
used for transfer and storage.

```js
const first = Boa.deriveLicense(process.env.BOA_USERNAME, process.env.BOA_PASSWORD, { plan: 'team' });
const second = Boa.deriveLicense(process.env.BOA_USERNAME, process.env.BOA_PASSWORD, { plan: 'team' });

console.log(Boa.compareVisibility(first, second).state); // "visible"

const fileEquation = Boa.createTransferEquation('file bytes', first, { kind: 'file' });
console.log(Boa.solveTransferEquation(fileEquation, second)); // "file bytes"
```

## Handshake, workspace, memory, and mesh

- `HandshakeBroker` blocks same-username/different-password BOAs by default and
  creates temporary grants when both plans permit handshakes and the target
  approves.
- `Workspace` lets users in the same licensed username group add tasks and submit
  signed results.
- `PhaseStackMemory` stores payloads as phase-indexed equations plus compressed
  obscured frames.
- `DeviceMesh` enforces plan device limits and translates envelopes for each
  registered device dialect.

## File equation bundle

```bash
BOA_USERNAME="$USER" BOA_PASSWORD="$BOA_PASSWORD" BOA_PLAN=team \
  node bin/boa-node.js wrap --input README.md --output boa.bundle.json
```

## Test

```bash
node test/boa.test.js
```

## Upload-ready daemon files

The repository includes three standalone daemon entrypoints in `dist/` that you
can upload to the site as static downloads:

- `dist/boa-daemon-linux.js`
- `dist/boa-daemon-windows.js`
- `dist/boa-daemon-macos.js`

Each daemon pairs with a dashboard account using a real session token and the
site API. After login/signup, run the downloaded platform file with the dashboard
session token:

```bash
node boa-daemon-linux.js install --endpoint https://truthunveiled.me --session "$BOA_SESSION"
node boa-daemon-linux.js heartbeat
node boa-daemon-linux.js daemon
node boa-daemon-linux.js cast --title Terminal --frame "build completed successfully"
```

For local testing, point `--endpoint` at the local dashboard, such as
`http://127.0.0.1:8787`. The install command stores device credentials in the
OS-specific BOA config directory and never stores the dashboard password.

## Signal-domain BOA daemon

`boa-daemon.js` is the cross-platform daemon source for signal-domain storage,
password-language obscurification, phase computation, sealing, and heartbeat mode.
It is pure Node.js and can be run directly or compiled with `pkg` using the
scripts in `package.json`.

```bash
node boa-daemon.js store ./file.txt "$BOA_PASSWORD"
node boa-daemon.js retrieve ./file.txt.boa-signal.json "$BOA_PASSWORD"
node boa-daemon.js obscure "message" "$BOA_PASSWORD"
node boa-daemon.js deobscure "$BOA_EQUATION_TEXT" "$BOA_PASSWORD"
node boa-daemon.js phase ./file.txt.boa-signal.json "$BOA_PASSWORD"
BOA_SUBSTRATE_KEY=00112233445566778899aabbccddeeff node boa-daemon.js seal
node boa-daemon.js daemon
```

The storage hierarchy is implemented as `password -> PBKDF2-SHA512 seven-variable
keyspace -> seven phase/layer signal lattice -> equations`. Correct-password
retrieval reconstructs bytes exactly; wrong-password retrieval intentionally
emits opaque bytes instead of throwing a password error.

## Build and deploy commands

Use these commands before deploying to Amazon Web Services:

```bash
npm run check
npm test
npm run build
```

Start the app locally or on AWS with:

```bash
npm start -- --host 0.0.0.0 --port 8787
```

For AWS Elastic Beanstalk or App Runner source upload, create a bundle with:

```bash
npm run aws:elasticbeanstalk
```

For container hosting on ECS, App Runner, or Lightsail:

```bash
docker build -t boa-terminal-serpent .
docker run --rm -p 8787:8787 -e BOA_BASE_URL=http://localhost:8787 boa-terminal-serpent
```

See `DEPLOY_AWS.md` for runtime environment variables and deployment notes.

## Interactive sandbox on the main page

The dashboard home page includes a BOA sandbox where visitors can submit normal
intents or hostile-looking shell injections. The sandbox never executes the
input. It derives a demonstration BOA password language, translates safe intents,
quarantines hostile patterns, produces a signed obscured envelope, shows the
phase-stack compression snapshot, and emits the six-variable cast equation used
for low-bandwidth intent casting demos.
