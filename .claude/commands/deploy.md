# Deploy BudgetOnTarget to Production

Deploy the PWA to budgetontarget.com via GitHub Pages.

## Steps

1. **Pre-flight checks**:
   - Run `cd frontend && pnpm build` to verify the static export succeeds
   - Run `git status` to ensure working tree is clean (all changes committed)
   - Run `git log --oneline -3` to confirm you're on the right branch with expected commits

2. **Push to main**:
   - If on a feature branch: create a PR with `gh pr create`, get approval, then merge
   - If on main with committed changes: `git push origin main`
   - The GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) triggers automatically on push to main

3. **Monitor deployment**:
   - Run `gh run list -L 1` to get the run ID
   - Run `gh run watch <run-id>` to stream progress
   - Both the `build` and `deploy` jobs must pass

4. **Verify**:
   - Run `curl -sI https://budgetontarget.com` — should return HTTP 200
   - Open https://budgetontarget.com in the browser and confirm the app loads

5. **If deployment fails**:
   - Run `gh run view <run-id> --log-failed` to see what broke
   - Common issues: pnpm lockfile mismatch (run `pnpm install` and commit lockfile), TypeScript errors (fix and re-push)
   - The workflow can also be manually triggered: `gh workflow run "Deploy to GitHub Pages"`

## Important
- NEVER push `.budget` files or `budgetontarget.db` — these contain real financial data
- The site has no backend — everything runs in the user's browser
- Custom domain `budgetontarget.com` is configured in GitHub Pages settings (no basePath needed)
