# Contributing to BudgetOnTarget

Thanks for your interest in contributing! This guide gets you from a fresh clone to a merged pull request.

## 1. Get set up locally

Setup is intentionally minimal — there is **no backend, no database, and nothing to configure**. You need Node.js 22 and pnpm (both version-pinned by the repo).

```bash
# Fork the repo on GitHub first, then clone YOUR fork:
git clone https://github.com/<your-username>/BudgetOnTarget.git
cd BudgetOnTarget

nvm use            # Node 22 (reads .nvmrc); skip if not using nvm/fnm
corepack enable    # provisions the pinned pnpm — no manual install needed

cd frontend
pnpm install
pnpm dev           # http://localhost:3000
```

Full prerequisites and a troubleshooting table are in the [README → Running Locally](README.md#running-locally). **Windows is fully supported** — see [Developing on Windows](README.md#developing-on-windows) for the small differences in installing Node.

## 2. Understand the layout

The entire application is in `frontend/`. There is no server.

```
frontend/
├── src/
│   ├── app/               # Next.js routes — landing page at root, app under /app/*
│   ├── components/        # UI components
│   └── lib/
│       ├── api.ts         # the API seam — components call this
│       └── local-engine/  # the app core: parsing, categorizing, target math, storage
└── public/                # PWA manifest, service worker, icons
```

- `local-engine/target-engine.ts`, `importer.ts`, and `categorizer.ts` do the real money math.
- Data lives in a user-held `.budget` JSON file plus IndexedDB auto-save. There are no accounts and no network calls.

See [`docs/architecture.md`](docs/architecture.md) for the full technical reference.

## 3. Make your change

1. Branch off `main`: `git checkout -b feature/my-feature` (use `feature/`, `fix/`, or `chore/`).
2. Make your change. Keep commits focused and use clear, imperative-mood messages ("Add Chase CSV parser", not "added stuff").
3. **Verify before you push** — CI runs exactly these two checks:

   ```bash
   cd frontend
   pnpm lint
   pnpm build      # also the strictest type check
   ```

   If both pass locally, CI will pass.

## 4. Open a pull request

1. Push your branch to your fork.
2. Open a PR against `main` on the upstream repo.
3. **CI runs automatically** (lint + build). It must be green.
4. `main` is a protected branch: a maintainer reviews and approves your PR before it can merge. You don't need any special access — just open the PR and it enters the review queue.
5. Once approved and green, it merges and **deploys automatically** to [budgetontarget.com](https://budgetontarget.com).

## Guidelines

- **Never commit financial data.** `.budget` and `.db` files are gitignored and contain real money data — keep it that way. Don't add real transaction exports to the repo, even as test fixtures.
- **Don't break existing `.budget` files.** If you change the file schema, bump `CURRENT_VERSION` in `store.ts` and handle the old shape in `load()` so files in the wild keep opening.
- **Match the surrounding code** — naming, structure, and comment density.

## Good first contributions

- **Test coverage** for the money math in `target-engine.ts` / `importer.ts` / `categorizer.ts` (currently none — highest value).
- **Bank parsers** for Chase, Bank of America, Wells Fargo, etc.
- **Configurable internal-transfer detection** (patterns are currently hardcoded in `importer.ts`).
- **Mobile responsiveness** (the UI is desktop-optimized today).

Questions? Open an issue — happy to help you get started.
