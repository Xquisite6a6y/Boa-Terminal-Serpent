# AWS deployment from GitHub

BOA is a dependency-free Node.js 20 HTTP service. If you want Amazon Web Services to point directly at your GitHub repository, use **AWS App Runner connected to GitHub**. App Runner pulls this repo, runs the build command, starts the web server, and gives you an HTTPS URL.

The app includes:

- `apprunner.yaml` for GitHub-connected App Runner source deployments.
- `Procfile` for Elastic Beanstalk Node.js deployments.
- `Dockerfile` for App Runner/ECS/Lightsail container deployments.
- `buildspec.yml` for CodeBuild/CodePipeline validation if you add a pipeline later.
- `/health` for AWS health checks.

## Recommended: App Runner connected directly to GitHub

1. Push this branch to GitHub.
2. Open **AWS Console → App Runner → Create service**.
3. Choose **Source code repository**.
4. Connect GitHub and select this repository/branch.
5. Deployment settings: choose **Automatic** if you want AWS to redeploy every push.
6. Configuration source: choose **Use a configuration file** so App Runner reads `apprunner.yaml`.
7. Runtime: Node.js 20 is already declared in `apprunner.yaml`.
8. Health check path: set `/health`.
9. Add environment variables:
   - `BOA_BASE_URL=https://YOUR_APP_RUNNER_URL` after AWS gives you the service URL. Update this again if you later attach a custom domain.
   - `BOA_STATE_PATH=/tmp/boa-state.json` for demo deployments. For real customer data, use a persistent database/state adapter instead of `/tmp` because App Runner instances are ephemeral.
10. Create the service. App Runner will run:

```bash
npm run build
npm start
```

## Exact commands AWS should use

Build command:

```bash
npm run build
```

Start command:

```bash
npm start
```

Health check path:

```text
/health
```

The `start` script binds to `0.0.0.0` and reads the AWS-provided `PORT` environment variable, which is what managed AWS web services expect.

## What users do after AWS is live

1. Visit your App Runner or custom-domain HTTPS URL.
2. Create an account or log in.
3. Click **Auto-install BOA on this device**.
4. Open the downloaded installer for their platform.
5. Return to the dashboard to see the daemon heartbeat and toggle resource sharing, casting, intent translation, daemon autostart, or phase-stack memory.

Users do not need to copy/paste build commands. The commands in this document are for AWS and maintainers.

## Local build checks before pushing

```bash
npm run check
npm test
npm run build
```

## Run locally the same way AWS runs it

```bash
PORT=8787 BOA_SITE_HOST=0.0.0.0 BOA_BASE_URL=http://127.0.0.1:8787 npm start
```

Then verify:

```bash
curl -fsS http://127.0.0.1:8787/health
```

## Elastic Beanstalk from GitHub or upload bundle

Elastic Beanstalk can use the included `Procfile`:

```text
web: npm start
```

If you want a zip upload instead of GitHub integration, build the bundle:

```bash
npm run aws:elasticbeanstalk
```

Upload `boa-aws-bundle.zip` to an Elastic Beanstalk Node.js environment and set the same runtime environment variables listed below.

## Docker option for ECS, App Runner container mode, or Lightsail

```bash
docker build -t boa-terminal-serpent .
docker run --rm -p 8787:8787 -e BOA_BASE_URL=http://localhost:8787 boa-terminal-serpent
```

## Runtime environment variables

- `PORT`: Set by AWS. The app falls back to `8787` locally.
- `BOA_SITE_HOST`: Use `0.0.0.0` on AWS. The npm start script sets this through a CLI flag.
- `BOA_BASE_URL`: Public HTTPS URL used inside issued daemon files, for example your App Runner URL or custom domain.
- `BOA_STATE_PATH`: JSON state file path. `/tmp/boa-state.json` is okay for a demo; production needs persistent storage.
- `BOA_SITE_PORT`: Optional fallback if `PORT` is not present.

## Important production note

This repository is an MVP/prototype. It demonstrates daemon sign-on, password-language envelopes, cast variables, and sandbox quarantine behavior. It does not make a formal claim that malware is impossible; it prevents this dashboard from executing untrusted input by translating it into inert, auditable BOA envelopes first.
