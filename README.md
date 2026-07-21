# Boa-Terminal-Serpent

BOA is a daemon-first protective signal layer with an optional hosted dashboard. The daemon is the local BOA Core trust gateway. The website is only the control surface for pairing, licensing, status, settings, and signal activity. The protocol between trusted instances is BOA Network.

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

BOA is not a website. BOA is the local trust gateway.

- **BOA Core**: always-on local translator/signal membrane.
- **BOA Dashboard**: optional UI/control panel for licensing, pairing, observing, and configuring.
- **BOA Network**: envelope protocol/relay layer for trusted BOA instances.

The daemon can run without the website. It stores local device identity and policy in the user's BOA config folder, exposes a local-only control API on `127.0.0.1`, and keeps wrapping/unwrapping BOA-routed traffic even when the dashboard is closed.

BOA should become the default trust gateway for all communication channels it is authorized to manage. The MVP protects BOA-aware traffic that goes through the local BOA gate. On normal Android/Termux/Linux/desktop systems, BOA cannot honestly intercept every packet from every app without OS-level VPN, root, kernel, firewall, or system proxy permissions. The staged model is:

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
- Intercepted BOA-routed files, messages, and tasks appear as opaque gibberish envelopes without the trusted device language/secret.
- The dashboard exposes plain-language panels for account status, connected devices, pairing, signal activity, sending signals, received signals, and automation controls.

> BOA does not include a password backdoor and does not claim full-device packet interception without OS-level integration. It prevents BOA-routed traffic from executing as commands by turning signals into inert envelopes unless a trusted adapter explicitly handles them.

## Product architecture notes

The notebook intent is captured in `BOA_ARCHITECTURE.md`: BOA Core is the translator around authorized channels, the dashboard is the control panel, the license clones trusted BOA instances to approved devices, and passwords shape the communication language between those trusted instances.

## Payments and plans

Stripe Checkout is integrated through the dashboard upgrade flow. In production, configure `STRIPE_SECRET_KEY` and plan price IDs such as `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_TEAM`, and `STRIPE_PRICE_ENTERPRISE`. If Stripe is not configured, the MVP keeps a demo activation path so the product can be tested end-to-end without normal users touching code.

## Per-device pricing model

The daemon security feature should stay free. BOA charges for connected-device value: pairing extra devices, cloud relay, resource sharing, screen/intent casting, and mesh routes. The MVP quote model keeps one protected device free, then estimates paid connectivity as a small base plan plus per-extra-device pricing. The dashboard exposes this as a plain-language quote so users do not have to understand billing code.

## Phase lattice simulator

The dashboard includes a safe simulation inspired by the geophone experiments. It demonstrates two product ideas without claiming impossible hardware behavior: a correct password-derived language can recover a phase-transformed vector, while a wrong language produces garbage; repeated app/file patterns can be modeled as dedupe-style compression. The simulation is explicitly labeled as a model, not a claim that BOA physically creates CPU, RAM, or storage.

## Safe environment variable sharing

Real secrets cannot be pre-added to the repository because anything committed to GitHub can be copied, logged, or leaked. The repo includes `.env.example` with placeholder values only. To ask for help safely, send a redacted checklist such as `STRIPE_SECRET_KEY=present`, `STRIPE_PRICE_SOLO=present`, and never paste the actual `sk_`, `rk_`, or `pk_` values. BOA currently needs the backend Stripe key under `STRIPE_SECRET_KEY`; the publishable/public key is not used by the hosted Checkout flow.

## AWS hosting

For GitHub-connected AWS hosting, use AWS App Runner with the included `apprunner.yaml`. AWS runs the build/start workflow from the repository, exposes the site over HTTPS, and uses `/health` for health checks. GitHub Actions can also hand off to AWS through the manual OIDC deploy workflow in `.github/workflows/aws-deploy.yml`. Full maintainer setup details are in `DEPLOY_AWS.md`.

## Maintainer reference

Developer commands, local acceptance checks, AWS bundles, Docker builds, protocol tests, and raw daemon utilities remain available in `package.json`, `DEPLOY_AWS.md`, and source comments. They are advanced/developer mode only, not normal user documentation.

## 3D coordinate phase stack

BOA now includes a concrete MVP phase stack: data is stored at a deterministic `(x, y, z)` coordinate and an equation-depth layer. To read it, BOA isolates the coordinate, follows the exact equation path for that layer depth, and brings the payload forward through the password-derived language. Unified-device efficiency and pricing are modeled from connected devices, stack reuse, and entry depth; actual hardware gains still require real adapters and workload measurement.

## Aletheia coexistence bridge

BOA can now coexist with the Aletheia repositories without breaking the pure Node.js AWS deployment. The bridge is intentionally namespaced under `integrations/aletheia/` and exposed through `src/aletheia_bridge.js`.

- `GET /aletheia` shows the BOA + Aletheia product boundary.
- `GET /api/aletheia/status` returns connected repository metadata and capabilities.
- `POST /api/aletheia/reverse-solve` runs the structured Omega Closure Reverse Operator.

This means BOA remains the local signal gate and dashboard, while Aletheia is represented as the closure-first reverse-solve intelligence layer. The separate Aletheia app can be deployed beside BOA or vendored later behind a package boundary, but secrets and deployment credentials must never be committed.


## Aletheia Cybersecurity Builder

Aletheia now builds on BOA through a concrete reverse-solve planning API. `POST /api/aletheia/cyber-app` starts from the desired product outcome — an advanced but honest BOA-based cybersecurity app — then uses the Omega Closure Reverse Operator to produce capability layers, threat model, build phases, safeguards, acceptance tests, and OS-integration limits.

This is not a magic claim that BOA controls every packet today. It is the product brain that tells BOA what must exist before that claim becomes true: local gate coverage, inert-by-default intake, pairing/license clones, dashboard visibility, strict policy modes, and future Android VPNService / Windows Filtering Platform / Linux firewall-proxy / macOS Network Extension adapters.


## Fully unified workspace

The Aletheia repositories are now vendored as local modules under `integrations/aletheia/modules/` and described by `integrations/aletheia/unified-workspace.json`. BOA remains the root app that builds and deploys on AWS, while the Aletheia modules are available locally for reverse-solve UX, agentic planning, ethics, marketplace, and future sidecar/static mounting.

- `GET /api/aletheia/unified` reports the local module workspace, file counts, package scripts, and package managers.
- `POST /api/aletheia/unify` returns the full BOA + Aletheia unification plan: runtime contract, cybersecurity builder output, and next fusion steps.

Deployment-specific scripts/docs and generated platform runtime files were intentionally not vendored because they can contain machine-specific details and are not needed for the unified product boundary.

## Production UI and deployment audit

The deployable product UI now lives in `public/app.html` with assets under `public/assets/`, and BOA serves it at `GET /app` from the same Node server that serves the API. This prevents frontend/backend split-brain deployments and keeps App Runner simple.

Production verification endpoints:

- `GET /health` verifies service health, static UI presence, and deployment decision metadata.
- `GET /api/public-config` gives the UI same-origin API config, backend components, Aletheia status, and unified workspace data.
- `GET /api/deployment/audit` returns the production deployment decision and static root.

The full audit and deployment decision are documented in `PRODUCTION_AUDIT.md` and `AWS_DEPLOYMENT_DECISION.md`.
