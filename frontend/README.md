# frontend/

This is the entire BudgetOnTarget application — a Next.js 16 static-export PWA.
There is no backend; everything runs in the browser (see the
[root README](../README.md) and [architecture docs](../docs/architecture.md)).

## Quick reference

```bash
# from the repo root, first time only:
nvm use            # Node 22 (reads /.nvmrc)
corepack enable    # provisions the pinned pnpm — no manual install

# then:
cd frontend
pnpm install
pnpm dev           # http://localhost:3000
```

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Dev server with hot reload at http://localhost:3000 |
| `pnpm build` | Static export → `out/` (also the strictest type check) |
| `pnpm preview` | Serve the built `out/` locally |
| `pnpm lint` | ESLint |

**Full setup instructions and troubleshooting:** [root README → Running Locally](../README.md#running-locally).
**Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md).
