# Boa-Terminal-Serpent

BOA is a daemon-first protective signal layer with an optional hosted dashboard. The daemon is the local BOA gate. The website is only the control surface for pairing, status, settings, and signal activity.

## Normal user experience: no code

The normal BOA flow is intentionally app-like:

1. User opens the hosted BOA website.
2. User creates an account or logs in.
3. Dashboard shows **Connect This Device**.
4. User clicks it and receives the correct BOA connector for their device.
5. The dashboard shows a simple pairing code/QR text.
6. The BOA daemon pairs with that code and keeps running locally.
7. The dashboard shows online/offline status, last heartbeat, memory/CPU status, BOA signal status, wrapped/unwrapped counts, active routes, sent signals, and received signals.
8. User sends messages, files, or tasks through dashboard panels.
9. BOA wraps outgoing signals automatically and unwraps incoming BOA envelopes automatically.

Normal users should not need terminal commands, package managers, Git, AWS, environment variables, JSON, obscure/deobscure commands, store/retrieve commands, or CLI workflows. Maintainer-only commands still exist for development and deployment, but they are not part of the product flow.

## Daemon-first BOA Gate

BOA is not a website. BOA is the local gate.

- **BOA daemon**: always-on local signal membrane.
- **BOA dashboard**: optional UI/control panel for pairing, observing, and configuring.
- **BOA cloud**: optional relay/sync layer.

The daemon can run without the website. It stores local device identity and policy in the user's BOA config folder, exposes a local-only control API on `127.0.0.1`, and keeps wrapping/unwrapping BOA-routed traffic even when the dashboard is closed.

The MVP protects BOA-aware traffic that goes through the local BOA gate. On normal Android/Termux/Linux/desktop systems, BOA cannot honestly intercept every packet from every app without OS-level VPN, root, kernel, firewall, or system proxy permissions. The staged model is:

1. Local BOA proxy gate for BOA-aware traffic.
2. Dashboard/browser traffic can use the local gate.
3. BOA-aware apps can send through the daemon API.
4. Future Android VPNService, desktop proxy, or firewall integration can enforce full-device routing.
5. Future privileged mode can enforce “no exceptions.”

## What is real in this MVP

- Account creation and dashboard login happen through the BOA site. Passwords are hashed with PBKDF2.
- The installer writes the daemon, local gate runtime, and daemon configuration onto the user's device.
- The daemon starts the local BOA gate and can run without the dashboard/cloud.
- Pairing gives the dashboard permission to observe/configure the daemon; local gate operation does not depend on pairing.
- The local gate supports permissive, protected, and strict policies. Protected mode is the default MVP mode.
- Outgoing BOA-routed payloads are wrapped into inert BOA envelopes automatically.
- Incoming BOA envelopes are unwrapped automatically. Raw inbound payloads are rejected in strict mode.
- The dashboard exposes plain-language panels for account status, connected devices, pairing, signal activity, sending signals, received signals, and automation controls.

> BOA does not include a password backdoor and does not claim full-device packet interception without OS-level integration. It prevents BOA-routed traffic from executing as commands by turning signals into inert envelopes unless a trusted adapter explicitly handles them.

## AWS hosting

For GitHub-connected AWS hosting, use AWS App Runner with the included `apprunner.yaml`. AWS runs the build/start workflow from the repository, exposes the site over HTTPS, and uses `/health` for health checks. Full maintainer setup details are in `DEPLOY_AWS.md`.

## Maintainer reference

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
