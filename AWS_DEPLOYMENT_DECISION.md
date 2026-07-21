# AWS Deployment Decision

## Current stack

BOA is a full-stack Node.js application:

- backend/API: pure Node.js HTTP server in `src/boa_site.js`, launched by `npm start`;
- frontend: production static UI in `public/app.html` and `public/assets/*`, served by the same Node server at `/app`;
- daemon/gate: local BOA gate and daemon scripts generated/downloaded by the backend;
- Aletheia: vendored local modules under `integrations/aletheia/modules/` plus runtime bridge APIs from `src/aletheia_bridge.js`.

## Deployment choice

Primary target: **AWS App Runner**.

Reason: the app is a single long-running Node.js web process that reads AWS `PORT`, binds to `0.0.0.0`, serves both UI and API from the same origin, and exposes `GET /health`. That is simpler and safer than S3/CloudFront because BOA is not static-only, and simpler than ECS/EC2 because the app does not require a custom multi-container runtime for the MVP.

Fallbacks:

- Elastic Beanstalk with `Procfile` for a supported Node web app.
- Docker/ECS/Fargate using the included `Dockerfile` if container orchestration becomes necessary.

## Production commands

Build:

```bash
npm run build
```

Start:

```bash
npm start
```

Health check:

```bash
curl -fsS https://YOUR_APP/health
```

Product UI:

```text
https://YOUR_APP/app
```

## Required environment

- `NODE_ENV=production`
- `PORT` supplied by AWS App Runner
- `BOA_SITE_HOST=0.0.0.0`
- `BOA_BASE_URL=https://YOUR_APP_RUNNER_OR_CUSTOM_DOMAIN`
- `STRIPE_SECRET_KEY` and plan price IDs only when live billing is enabled

## Deployment blockers fixed

- Static UI is included under `public/` and served by the Node backend.
- UI calls same-origin APIs instead of assuming localhost.
- Docker and Elastic Beanstalk bundles include `public/` and `integrations/`.
- `/health` reports `staticUi` and deployment decision data.
- CI smoke test verifies `/health`, `/app`, and `/api/public-config`.


## Safe deployment automation

The repo includes two maintainer scripts:

```bash
npm run aws:preflight
npm run aws:deploy:apprunner
```

`aws:preflight` validates `AWS_REGION`, `APP_RUNNER_SERVICE_ARN`, and one safe authentication source. `aws:deploy:apprunner` triggers `aws apprunner start-deployment` using your already-configured AWS CLI/OIDC environment. Neither script stores keys, prints secrets, or requires secrets in the repository.
