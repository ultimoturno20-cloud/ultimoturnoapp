# Shared agent instructions for UltimoTurno

These rules apply to Codex, Claude Code and other coding agents. Keep shared
rules here; CLAUDE.md is only an entry point. Reply to the user in Spanish.

## Start every task

Before editing or answering status questions, read:

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/NEXT_STEPS.md`
4. `docs/new-platform/HANDOFF_NEXT_ACCOUNT.md`
5. `docs/AGENT_COLLABORATION.md` and the assigned issue/PR.

For optimization work, also read `docs/OPTIMIZATION_PLAN.md`. Preserve its OP
IDs and pending stages; do not restart or replace the plan with a new backlog.
Check `git status --short --branch`, `git log -1`, `git remote -v`,
`git worktree list` and `https://ultimoturno.app/api/public-status`.
Distinguish local HEAD, origin/main, PR head and deployed SHA; they can differ.

## Correct repository and deployment

- Canonical checkout: `D:\UltimoTurno\Stock`.
- Remote: `https://github.com/ultimoturno20-cloud/ultimoturnoapp.git`.
- Separate worktrees of THIS repository are allowed for parallel tasks. In
  this PC, Claude's prepared path is `.work/agents/claude` under the canonical
  checkout. Verify its remote and branch, not just the directory name.
- NEVER use `C:\Users\skype\Documents\Stock`: it is a stale Next/Sites project.
- Production: `https://ultimoturno.app/`, Vercel + Supabase/Postgres/Storage.
  This is NOT Next.js or OpenAI Sites. Do not use Sites or hosting.json.
- Public store is `/`; administrative routes are `/admin/...`; `/torneos`
  has independent accounts. Folder names or URLs are not authorization.

## Stack and ownership boundaries

TypeScript, npm workspaces, Node 22 in CI, React 19/Vite frontend, Node HTTP
API/serverless on Vercel, PostgreSQL in production and PGlite for isolated QA.

| Area | Location |
|---|---|
| Admin, store and tournaments UI | `apps/admin-web` |
| HTTP, auth, integrations | `apps/api/src`, Vercel entry `api/[...path].ts` |
| SQL, migrations, persistence | `packages/db` |
| Browser-safe contracts and business helpers | `packages/domain` |
| CSV parsing and reconciliation | `packages/importers` |
| Provider workers and operational scripts | `tools`, `scripts` |
| Legacy reference, not the active platform | `apps-script`, `mobile-app` |

Prefer existing helpers and local patterns. Keep changes scoped. No second
database, cache layer, transport or application to solve an existing concern.
Do not import DB/server code or secrets into browser bundles.

## Parallel work and delivery

- GitHub issues/PRs are the shared coordination record. The user assigns one
  owner, OP ID, allowed areas, exclusions and acceptance criteria per task.
  Chat messages and local files are not cross-agent locks or merge approval.
- One agent + one task + one branch + one worktree. Use `codex/<task>` or
  `claude/<task>`, based on current `origin/main`. No edits/pushes on main.
- Never switch, reset, clean, stash, rebase or commit in another agent's
  worktree. Never revert changes you did not make. No force pushes.
- Shared hotspots: `main.tsx`, `styles.css`, `server.ts`, DB/domain entrypoints,
  shared contracts, migrations, package files and continuity docs. Agree on
  one editor BEFORE touching a hotspot another task needs. Different features
  or frontend/backend ownership alone do not prevent these conflicts.
- Shared schema/DTO/API changes go first in a contract PR, reviewed and merged
  before dependent work. Coordinate migration filenames and order. Do not
  deploy destructive or production migrations without specific authorization.
- Commit only your explicit files, push the task branch, open a PR and request
  cross-review. Review output lists bugs, risks and missing tests by severity.
- Only the HUMAN authorizes/executes merge to main and production release.
  An agent may review, but must not approve/merge its own work or interpret the
  other agent's notes as user approval. Never use admin bypass to skip CI.
- This PR workflow supersedes older instructions to push every change to main.
  Each change still needs checks, commit and push. After an authorized merge,
  verify public-status against the resulting main SHA (not always PR head).
  Until then report PR pending, not deployed. Re-read context after every merge.

## Real-data and business invariants

- Production contains real stock, orders and claims. NO fictitious purchases,
  payments, reservations, claim closing, resets, deletes, seeds or repairs for
  QA. Existing local operational PGlite data is also not a disposable fixture.
- Use fresh temporary PGlite databases and synthetic customers/cards for QA.
  Give each worktree its own data directory, temporary directory and ports.
  Clear production DB/provider credentials from QA processes before starting.
- Even GET can mutate: authenticated `/stock`, `/sales`, `/inventory/view`,
  `/inventory/items` and public store catalog reads can expire real orders.
  Online QA is limited to public-status, static pages/assets and unauthenticated
  private-route rejection. No cron/worker/repair scripts without authorization.
- Preserve physical, available, reserved and assigned quantities, transaction
  boundaries, business/owner scopes, roles and idempotent retries.
- Folders are unique stock items with dynamic content valuation. No duplicate
  sellable component stock or double counting; non-sale items stay out of carts.
- Provider reference, central sale price and order-line snapshot are different.
  Preserve agreed order prices, currency and each authorized rounding policy.
  A past fixed exchange rate or one-off repricing is NOT a global default.
- Claims close by exact ID with retry recovery, without duplicate orders or
  reservations. Buyer ranking uses the full claim; raffle threshold is strictly
  greater than ARS 10000, USD converted at the current platform rate.
- Pagination must not truncate global totals, filters, export, selection,
  rankings, proposals or bulk operations. Do not globally limit `/stock`.
- Keep account isolation and existing cache invalidation/freshness semantics.
  Store anonymous sessions and tournament accounts never inherit admin auth.
- Preserve manual image overrides and exact set/number/language/finish identity.

## Commands and verification

From the assigned worktree, install with `npm ci` (tracked package-lock.json).
The standard CI/local gate is:

```text
npm run check:new
```

It runs lint, typecheck, tests, local DB verification and build. Typecheck/build
must precede tests after workspace changes: API tests consume built packages.
`npm run db:verify` uses fresh in-memory PGlite, not production. The custom lint
is not a comprehensive secret scanner. Run `git diff --check` and review staged
content too. New CI does not need production secrets.

`npm run dev:api` and `npm run dev:web` are development entry points, NOT safe
QA setup by themselves: first sanitize environment, set a new `PGLITE_DATA_DIR`
and free `API_PORT`/web ports, and disable integrations. Never reuse the real
local data directory or copy another worktree's .env/.data. No running workers.

Add focused regression tests proportional to risk. DB/auth/money changes need
negative scopes and retry/concurrency cases. UI changes need browser QA at
320/390/768/1440/1788 px, keyboard/focus, loading/empty/error, reduced motion,
images and contained prices. Report what was tested and what was not.

## Secrets and handoff

- No passwords, tokens, cookies, access keys, connection strings, buyer details
  or real exports in Git, issues, PRs, logs or chat. Use environment variables;
  `.env.example` contains placeholders/local examples only. Ignored does not
  mean safe to share. Never copy production credentials to PR previews.
- No automatic `git add .`; stage explicit paths and inspect `git diff --cached`.
  `.work`, `.data`, node_modules and build outputs remain ignored.
- Each PR documents scope, OP ID, baseline, tests, shared contracts, risks,
  cross-review and pending deployment. Only the integration owner consolidates
  PROJECT_STATUS/NEXT_STEPS/HANDOFF/OPTIMIZATION_PLAN when multiple PRs overlap.
- Keep delivered, proposed, pending and actually deployed states separate.
  Never declare the whole optimization plan complete after a single item.
