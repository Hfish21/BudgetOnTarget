# GitHub Copilot instructions

This repository's agent guidance lives in [`AGENTS.md`](../AGENTS.md) at the repo root. Read it first — it covers setup, how to verify changes, project structure, and the guardrails.

Essentials:

- Browser-only static Next.js PWA. **No backend, no database.** The whole app is in `frontend/`; ignore any `backend/` folder.
- Setup: `corepack enable`, then `cd frontend && pnpm install && pnpm dev`.
- Verify before proposing changes (there is no test suite): `cd frontend && pnpm lint && pnpm build`.
- **Never commit `.budget` or `.db` files** — real financial data.
- Money is stored as integer cents; `target-engine.ts`, `importer.ts`, `categorizer.ts` do the money math and have no tests.
- Changing the `.budget` schema requires bumping `CURRENT_VERSION` in `store.ts`.

See [`AGENTS.md`](../AGENTS.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full picture.
