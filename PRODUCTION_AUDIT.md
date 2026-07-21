# BOA Production Audit

## Current-state audit

The repository is a **full-stack Node.js app with a same-origin static frontend**:

- `bin/boa-node.js` starts the web server.
- `src/boa_site.js` serves API routes, installer downloads, static UI assets, and health checks.
- `public/app.html` and `public/assets/*` are the production UI shell.
- `src/boa-gate.js` and `boa-daemon.js` provide local daemon/gate behavior.
- `integrations/aletheia/modules/*` contains local Aletheia source modules that are inspected and surfaced by the BOA bridge.

## Deployment blockers identified

- The deployable Node root had backend routes and inline HTML, but no packaged production static app shell.
- Docker and AWS bundle packaging omitted `public/`, so a completed frontend would not ship.
- CI smoke tested only `/health`, so a deployment could pass while the frontend was missing.
- Aletheia modules were local, but production UI did not expose a cohesive unified workspace experience.
- There was no explicit machine-readable deployment decision endpoint for AWS validation.

## Deployment decision

Primary AWS target: **AWS App Runner**.

Reason: BOA is not static-only. It is a single Node.js web service that serves frontend, backend APIs, installer generation, Stripe checkout fallback, Aletheia bridge APIs, and health checks. App Runner is the simplest correct managed AWS target because it supports `npm run build`, `npm start`, managed HTTPS, and AWS-provided `PORT`.

Fallbacks: Elastic Beanstalk via `Procfile`, or Docker/ECS using `Dockerfile`.

## Fixes implemented

- Added `public/app.html`, `public/assets/app.css`, and `public/assets/app.js` as a complete production UI.
- Added static serving for `/app` and `/assets/*` from the BOA Node server.
- Added `/api/public-config` and `/api/deployment/audit` so the frontend and CI can verify deployment decisions and backend wiring.
- Updated `/health` to report `staticUi` and deployment decision status.
- Updated Dockerfile and AWS bundle scripts to include `public/` and `integrations/`.
- Updated CI smoke test to validate `/health`, `/app`, and `/api/public-config`.

## Production run commands

```bash
npm run build
npm start
```

AWS health path:

```text
/health
```

Production UI path:

```text
/app
```


## IAM/key safety finding

A long-term IAM access key should not be pasted into chat, screenshots, docs, GitHub issues, or source files. If that happens, treat the key as compromised: deactivate/delete it in AWS IAM, then use GitHub OIDC or a newly rotated least-privilege key outside the repository. The deployment scripts only read credentials from the runtime environment or AWS CLI profile and redact values in output.
