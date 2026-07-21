# Aletheia coexistence bridge

This folder is the safe merge point between BOA and the Aletheia repositories.

BOA stays the daemon-first local gate and hosted dashboard. Aletheia stays its own agentic/reverse-solve product surface. The bridge lets the BOA dashboard see Aletheia status and run a structured Omega Closure Reverse Operator without dumping a separate Vite/pnpm app into BOA's pure Node.js runtime.

## Why this is namespaced instead of copied wholesale

- `AeonUnifiedAletheia_FullFeatured` is a separate full-stack TypeScript/Vite/pnpm application.
- BOA is intentionally a pure Node.js dashboard/daemon MVP for easy AWS App Runner deployment.
- Copying an entire second application into BOA's root would create dependency conflicts, duplicate servers, and deployment uncertainty.
- This bridge defines the coexistence contract first: BOA Core protects/routes, BOA Dashboard controls/observes, Aletheia provides reverse-solve intelligence.

## What is integrated now

- Repository metadata and roles.
- Backend status surfaced through BOA health/backend component APIs.
- A dashboard link and `/aletheia` page.
- A structured `/api/aletheia/reverse-solve` endpoint for the Omega Closure Reverse Operator.

## Future direct merge path

If the Aletheia UI/API should run inside BOA later, do it as a package boundary such as `integrations/aletheia/app/` with its own package manager lockfile, build output, and secrets policy. Do not commit real tokens, Stripe keys, server passwords, private deployment files, or machine-specific credentials.


## Local modules included

The workspace now includes local source snapshots:

- `modules/aeon-unified-aletheia` — the Aeon/Aletheia TypeScript/Vite/pnpm app source, with deployment-only and generated platform files excluded.
- `modules/myaletheia222069` — the MyAletheia222069 foundation README/source snapshot.

The BOA bridge reports these modules through `/api/aletheia/unified` and uses them in `/api/aletheia/unify` to describe the full product runtime contract.
