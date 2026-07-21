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


## If your host tries to run `node dist/index.js`

Some platforms auto-detect Node apps and force a start command like `node dist/index.js`. BOA now creates that compatibility entry during `npm run build`, but the preferred start command is still:

```bash
npm start
```

If you see `Cannot find module '/app/dist/index.js'`, redeploy the latest commit and make sure the platform build command is `npm run build`.

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


## GitHub Actions to AWS handoff

If GitHub workflows/runners are enabled, BOA can trigger AWS App Runner without storing AWS access keys in the repo. Use `.github/workflows/aws-deploy.yml` with GitHub OIDC.

Configure these GitHub repository **Variables**:

```text
AWS_REGION=us-east-1
APP_RUNNER_SERVICE_ARN=arn:aws:apprunner:...:service/...
AWS_ROLE_TO_ASSUME=arn:aws:iam::ACCOUNT_ID:role/GitHubBoaDeployRole
```

The workflow is manual-only. Open **Actions → BOA AWS Deploy → Run workflow**, type `DEPLOY`, and GitHub will:

1. run `npm run aws:preflight -- --skip-aws-cli` to validate deployment variables without needing long-term keys,
2. run `npm run build`,
3. request short-lived AWS credentials through OIDC,
4. run `npm run aws:deploy:apprunner` to call `aws apprunner start-deployment` for the configured service.

This lets me help from GitHub logs without you pasting AWS keys into chat. The AWS role should be narrowly scoped to App Runner deployment and log inspection, not administrator access.

## Runtime environment variables

Use `.env.example` as the safe template. Add the real values in AWS App Runner or Elastic Beanstalk, not in Git.

### Redacted Stripe/AWS checklist

When asking for help, share this checklist with values hidden:

```text
BOA_BASE_URL=present
BOA_STATE_PATH=present
STRIPE_SECRET_KEY=present (value hidden)
STRIPE_PRICE_SOLO=present
STRIPE_PRICE_TEAM=present
STRIPE_PRICE_ENTERPRISE=present
```

Do not share root AWS credentials, Stripe secret keys, or unrestricted long-term keys in chat. If an AWS access key was pasted into a message or screenshot, immediately deactivate/delete that key in IAM and create a new least-privilege deployment path.


- `PORT`: Set by AWS. The app falls back to `8787` locally.
- `BOA_SITE_HOST`: Use `0.0.0.0` on AWS. The npm start script sets this through a CLI flag.
- `BOA_BASE_URL`: Public HTTPS URL used inside issued daemon files, for example your App Runner URL or custom domain.
- `BOA_STATE_PATH`: JSON state file path. `/tmp/boa-state.json` is okay for a demo; production needs persistent storage.
- `BOA_SITE_PORT`: Optional fallback if `PORT` is not present.

## Important production note

This repository is an MVP/prototype. It demonstrates daemon sign-on, password-language envelopes, cast variables, and sandbox quarantine behavior. It does not make a formal claim that malware is impossible; it prevents this dashboard from executing untrusted input by translating it into inert, auditable BOA envelopes first.

## Local AWS CLI deployment without pasting keys

If you deploy from your own machine, configure AWS CLI/SSO/profile outside the repository, then run:

```bash
npm run aws:preflight
npm run build
npm run aws:deploy:apprunner
```

Required environment variables:

```text
AWS_REGION=us-east-1
APP_RUNNER_SERVICE_ARN=arn:aws:apprunner:REGION:ACCOUNT_ID:service/SERVICE_NAME/SERVICE_ID
```

Authentication can come from one of these safe sources:

- GitHub OIDC role via `AWS_ROLE_TO_ASSUME`,
- local AWS SSO/profile via `AWS_PROFILE`,
- local environment variables created from a newly rotated, least-privilege key.

Never put `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` into Git, screenshots, docs, or chat.
