# AWS deployment

BOA is a dependency-free Node.js HTTP service. The dashboard stores local JSON state by default, so production AWS deployments should set `BOA_STATE_PATH` to a mounted persistent volume path or replace the state adapter before accepting real customers.

## Local build checks

```bash
npm run check
npm test
npm run build
```

## Run locally like AWS

```bash
PORT=8787 BOA_SITE_HOST=0.0.0.0 BOA_BASE_URL=http://127.0.0.1:8787 npm start
```

## Elastic Beanstalk / App Runner bundle

```bash
npm run aws:elasticbeanstalk
```

Upload `boa-aws-bundle.zip`. The included `Procfile` starts the web process with `npm start`.

## Docker build for ECS, App Runner, or Lightsail

```bash
docker build -t boa-terminal-serpent .
docker run --rm -p 8787:8787 -e BOA_BASE_URL=http://localhost:8787 boa-terminal-serpent
```

## Runtime environment variables

- `PORT`: port AWS assigns; defaults to `8787`.
- `BOA_SITE_HOST`: bind address; use `0.0.0.0` on AWS.
- `BOA_BASE_URL`: public HTTPS URL used inside issued daemon files.
- `BOA_STATE_PATH`: JSON state file path. Use persistent storage for production.
- `BOA_SITE_PORT`: optional fallback port for direct CLI serving.

## Important production note

This repository is an MVP/prototype. It demonstrates daemon sign-on, password-language envelopes, cast variables, and sandbox quarantine behavior. It does not make a formal claim that malware is impossible; it prevents this dashboard from executing untrusted input by translating it into inert, auditable BOA envelopes first.
