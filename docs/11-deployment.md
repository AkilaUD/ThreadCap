# 11 — Deployment Guide

This guide covers provisioning, operation, and ongoing management of ThreadCap on a **free-first stack**: GitHub (public repo, free CI) + Railway Free (app services only) + Neon (PostgreSQL free) + Upstash (Redis free). The paid Hobby/Pro upgrade path is documented in §10 — free is the default for development and early beta, and we commit to moving off it before any scale gate (D-020).

---

## 1. Free-first stack overview

| What | Provider | Plan (2026, verified) | Why |
|---|---|---|---|
| Code + CI/CD | **GitHub** (public repo) | Free — **unlimited** Actions minutes on public repos, 500 MB artifacts, GitHub Pages | CI/CD at $0; lander/docs hosted free |
| App services (web, api+mcp, skills, lander) | **Railway** | Free — $0/mo, **$1 credit/mo** (no rollover), 1 replica, 1 vCPU / 0.5 GB RAM per service, 0.5 GB volume, 3-day logs | Node services + statics, near-zero cost when idle |
| PostgreSQL 16 + pgvector | **Neon** | Free — **permanent**, 100 CU-hrs/mo, 0.5 GB storage, 5 GB egress, scale-to-zero after 5 min idle, pgvector ✓ | Serverless Postgres that survives $1 Railway budget |
| Redis (rate limits, queues, sessions) | **Upstash** | Free — **permanent**, 256 MB data, 500K cmd/mo, 10 GB bandwidth | Serverless Redis, no always-on footprint |
| Attachments (MVP) | Railway volume | 0.5 GB free (LocalDiskProvider) | Matches the storage abstraction default; R2/S3 later |

**The key constraint:** Railway's $1/month credit **cannot** run the Postgres and Redis add-ons (~$15–25/mo of usage). The free stack moves the add-ons off Railway so the credit is spent only on the Node services, which idle cheaply.

**Budget math (what fits the $1 credit):**
- Static services (web/skills/lander) cost ~$0 (no compute billed when idle; only egress).
- The merged api+mcp service, idle > 90% of the time, consumes roughly **$0.50–0.90/mo** (vCPU + RAM billed per-second). A heavily active beta will exhaust the credit; see §10 for the trigger.
- Neon free's 100 CU-hours + Upstash's 500K commands/mo cover a low-traffic beta; both enforce hard caps that suspend/rate-limit rather than charge.

---

## 2. GitHub repository setup

1. **Create the monorepo as PUBLIC** (unlocks unlimited free Actions minutes + GitHub Pages).
2. **Branch protection** on `main`: require PR reviews + CI passing (lint, typecheck, test, build).
3. **Repository secrets** (Settings → Secrets and variables → Actions):
   - `RAILWAY_TOKEN` — generated in Railway (`Account Settings → Tokens`).
   - `GH_PAGES` deploy key is not needed — Pages deploys from the `gh-pages` branch or Actions artifact.

**Why public:** private repos get 2,000 Actions minutes/month (still generous, ~200–400 CI runs), but public repos get unlimited standard-runner minutes, and lander/docs host free on GitHub Pages. Public also means the con-countermeasure baseline ([00-index](/00-index.md) §6.2) is auditable — a selling point for enterprise trust later.

**Optional (paid later):** mirror a private copy for customers who need closed source.

---

## 3. Railway project setup

1. **Create a new Railway project** at https://railway.app/new.
2. **Add services** (one per `apps/` directory), all in the same project:
   - `apps/web` — Static React build (Vite) — `dist/` output, static hosting.
   - `apps/api` — NestJS/Express REST **+ MCP JSON-RPC** + BullMQ workers on a single service (D-021). Map BOTH `/v1/*` and `/mcp/*` to this one service.
   - `apps/skills` — Static Claude Code skills tarball (serve from `/`).
   - `apps/lander` — Marketing site + docs (Astro); may instead live on GitHub Pages (§2).
3. **No Railway add-ons in the free stack.** Do **not** add the Postgres/Redis add-ons — they consume the $1 credit in days (§1).
4. **Volume**: `/data/uploads` (0.5 GB free) for the local-disk storage provider (MVP). Swaps to R2/S3 later via `STORAGE_BACKEND=s3`.
5. **Set environment variables** (Railway → Service → Variables). Never commit secrets. All free-tier variables:

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | api | **Neon** PostgreSQL connection string (Neon "Connection string" → pooled: `postgresql://…-pooler-…`). Set `?sslmode=require`. |
| `REDIS_URL` | api | **Upstash** Redis REST URL (`https://<region>-<sub>.upstash.io`). |
| `REDIS_TOKEN` | api | **Upstash** REST token (Use: `redis_token` / `UPSTASH_REDIS_REST_TOKEN`). |
| `JWT_SECRET` | api | 32-byte secret for signing access tokens. |
| `JWT_REFRESH_SECRET` | api | 32-byte secret for refresh token rotation. |
| `GOOGLE_CLIENT_ID` | api, lander | Google OAuth client. |
| `GOOGLE_CLIENT_SECRET` | api, lander | Google OAuth client secret. |
| `STRIPE_PUBLIC_KEY` | api | Publishable key for billing. |
| `STRIPE_SECRET_KEY` | api | Secret key for billing (test/live). |
| `STRIPE_WEBHOOK_SECRET` | api | Verify Stripe webhook events. |
| `OPENAI_API_KEY` | api | Model Swap provider (smart capture, summaries). |
| `ANTHROPIC_API_KEY` | api | Model Swap provider. |
| `GEMINI_API_KEY` | api | Model Swap provider. |
| `DEFAULT_EXTRACTION_MODEL` | api | e.g. `gpt-4o-mini`. |
| `STORAGE_BACKEND` | api | `local-disk` on the free stack. |
| `STORAGE_DIR` | api | `/data/uploads` (the mounted volume). |
| `CAPTURE_WORKER_ENABLED` | api | `true` — BullMQ worker in-process (single replica, no separate worker service on free tier). |
| `WORKER_CONCURRENCY` | api | `2` — cap BullMQ concurrency so Redis command volume stays inside Upstash's 500K/mo. |
| `NODE_ENV` | each | `production`. |
| `PORT` | api | Railway-assigned (do not override). |

6. **Set service ports** (Railway dashboard → Service → Port):
   - `apps/api`: Railway-assigned port; it serves `/v1/*` and `/mcp/*`.
   - `apps/web`, `apps/skills`, `apps/lander`: Railway auto-detects static build output dir.
7. **Health check**: `GET /healthz` on the api service (see §6). Railway restarts the service if it misses health checks for 30 s.

---

## 4. CI/CD pipeline (GitHub Actions, unlimited on public repo)

The repo uses GitHub Actions for CI (lint, test, build) and CD (deploy to Railway on push to `main`). On a public repo these minutes are free and unlimited.

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: '9' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: '9' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: '9' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: '9' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/railway-cli-action@v1
        with: railway-token: ${{ secrets.RAILWAY_TOKEN }}
      - run: railway up
```

### `.github/workflows/pages.yml` (lander + docs on GitHub Pages, free)

```yaml
name: Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: '9' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter lander build
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/lander/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Notes:**
- Public repo → Actions minutes are free (no 2,000-min private cap). Artifact storage 500 MB shared with Packages.
- `railway up` deploys all services; each service's build is auto-detected from its `package.json` (`build`/`start` scripts).
- Secrets live in GitHub repo secrets + Railway Variables — never in git.

---

## 5. DNS + custom domains

1. **Railway default domains**: each service gets `https://<service-name>.<random>.railway.app` (free plan included).
2. **Custom domains**: free Let's Encrypt certs are provisioned by Railway for domains you own; add `api.threadcap.app` (→ api service) and `app.threadcap.app` (→ web service) in Settings → Domain.
3. **Lander/docs**: served from GitHub Pages `<user>.github.io/threadcap` or a Pages custom domain.
4. **Subpath routing**: the api service must expose both `/v1/*` (REST) and `/mcp/*` (JSON-RPC) — same origin, no separate domain (D-021).

**Example DNS → targets:**
- `api.threadcap.app CNAME <railway-default>` → api service
- `app.threadcap.app CNAME <railway-default>` → web service
- `docs.threadcap.app CNAME <user>.github.io` → GitHub Pages

---

## 6. Monitoring + observability (free-tier friendly)

ThreadCap emits structured logs and OpenTelemetry traces. Free-tier choices:

| Feature | Tool | Plan impact |
|---|---|---|
| **Structured logs** | Winston (built-in) | JSON to stdout → Railway logs UI; **3-day retention on Free** (export logs to a file on release if needed). |
| **Error tracking** | Sentry | Free tier (5k errors/mo) captures 5xx + capture/injection flow breadcrumbs. |
| **Health checks** | Railway + custom `/healthz` | GET `/healthz` → `{ status: "ok" }` if DB + Redis + AI providers reachable. Railway restarts on failure. |
| **Uptime exceptions** | call me / Healthchecks.io (free) | Free external ping against `/healthz` for egress-side alerting (Railway Free has no SLA). |
| **Neon/Upstash dashboards** | Provider consoles | Compute hours, egress, command counts, rate-limit/suspend alerts — the real free-tier tripwires. |

**Example `/healthz`:**
```ts
@Get('healthz')
async healthz() {
  const dbOk = await this.db.query('SELECT 1').then(() => true).catch(() => false);
  const redisOk = await this.redisPing().then(() => true).catch(() => false);
  const aiOk = await this.aiProvider.checkConnection().then(() => true).catch(() => false);
  if (dbOk && redisOk && aiOk) return { status: 'ok' };
  throw new HttpException('service unavailable', 503);
}
```

**Neon cold-start caveat:** Neon compute scales to zero after 5 min idle; the first query wakes it in a few hundred ms (free tier, fixed). `/healthz`'s DB check may add ~0.3–1 s after an idle period — the API's p95 budgets in [09-mvp-acceptance](/09-mvp-acceptance.md) §5 assume warm steady state.

---

## 7. Backup + disaster recovery (free tier)

| Component | Free-tier strategy | Restore |
|---|---|---|
| **PostgreSQL (Neon)** | Neon free includes a **6-hour instant-restore window** (capped 1 GB change history) + **1 manual snapshot**. Run a nightly `pg_dump` to a `.sql` file in the repo's private release artifact (or a volume) as the durable copy. | `psql $DATABASE_URL < dump.sql`; for point-in-time use Neon's 6-hr restore then replay from dump. |
| **Redis (Upstash)** | Upstash free persists data; schema is re-creatable from code (rate-limit keys, sessions are ephemeral). No backup needed for correctness-critical data. | Recreate on redeploy. |
| **Attachments (Railway volume)** | Volume is regional; 0.5 GB. Keep a release step that tars `/data/uploads` to a backup artifact on demand. | Extract into the recreated volume. |
| **Static assets (web/extension/build)** | Git is source of truth; redeploy from `main` restores everything. | `git checkout main && pnpm run build && railway up`. |
| **Secrets** | Railway Variables + GitHub Actions secrets; never in git. | Re-enter via dashboards. |

**Nightly pg_dump** (GitHub Actions scheduled):
```yaml
name: Daily backup
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: '9' }
      - run: ./scripts/backup-db.sh   # pg_dump $DATABASE_URL | gzip → artifact & volume copy
      - uses: actions/upload-artifact@v4
        with: { name: db-dump, path: .backup/*.sql.gz }
```

---

## 8. Scaling + resource limits (free tier)

| Service | Free-tier ceiling | Scale action |
|---|---|---|
| **api** | **1 replica** · 1 vCPU / 0.5 GB RAM (Railway Free cap) | Can't scale on Free — the trigger to move to Hobby/Pro (§10). |
| **web/skills/lander** | Static; negligible | Static CDN caching; no replica needed. |
| **BullMQ workers** | In-process (`CAPTURE_WORKER_ENABLED=true`, concurrency 2) | No separate worker service on Free (D-021). |
| **Neon** | 100 CU-hrs/mo, 0.5 GB, 5 GB egress | Suspend at limit → upgrade to Launch (§10). |
| **Upstash** | 256 MB, **500K cmd/mo**, 10 GB bandwidth | Rate-limited at limit → upgrade (§10). |

**Concurrency guardrail:** `WORKER_CONCURRENCY=2` and the capture polling backoff (500 ms → 2 s, [04-api-contracts](/04-api-contracts.md) §3) keep Redis command volume ~well under 500K/mo. Watch the Upstash dashboard; if capture traffic passes the budget, the release gate in §11 flags it before it becomes a production outage.

**Hard usage cap (recommended):** enabled Railway "usage cap" at the account level (min $10) so the $1 credit never overruns into a bill. Neon and Upstash hard-cap at free limits by design (no spend risk).

---

## 9. Railway-specific notes (free plan)

- **`nixpacks` auto-detection**: builds from `package.json` scripts; add a `Dockerfile` at the service root if you need a custom runtime.
- **Volume persistence**: `/data/uploads` is regional; 0.5 GB on Free. To switch to R2/S3, set `STORAGE_BACKEND=s3` + `S3_*` vars and drop the volume (recommended before attachments scale).
- **Health check behavior**: service marked down after 30 s without `/healthz`; restarts up to 3 times.
- **Logs**: 3-day retention on Free; stream to Sentry/your own sink for longer-term debugging.
- **Credit exhaustion**: when the monthly $1 credit runs out the service **stops**; it resumes next cycle or on upgrade. This is exactly why the add-ons moved to Neon/Upstash (§1).
- **Cold starts**: Neon scale-to-zero adds ~0.3–1 s to the first DB query after idle; measure and accept on free tier.

---

## 10. Upgrade path (when to leave free-first)

Free is the default for development and early beta (D-020). Move to **Hobby** ($5/mo, includes $5 of usage credit) when any trigger hits:

| Trigger | Free-tier symptom | Upgrade to |
|---|---|---|
| Railway credit exhausted ≥ 2 consecutive months | services stopped mid-month | **Hobby** ($5) |
| Neon free limits hit | compute suspended, writes fail at 0.5 GB | **Neon Launch** (pay-as-you-go) |
| Upstash quota exhausted | commands rate-limited | **Upstash** pay-as-you-go/$10 fixed |
| Attachments beyond 0.5 GB volume | can't store uploads | **R2/S3** + `STORAGE_BACKEND=s3` |
| Need > 1 replica / > 0.5 GB RAM | can't scale api | **Hobby/Pro** |
| Public beta scale gate (roadmap RP-2 gate) | — | **Hobby → Pro ($20)** when > threshold DAU |
| E2EE Enterprise / SLA needed | — | **Neon Scale + Pro + R2** (enterprise stack) |

**Typical timeline:** dev + closed beta on the free stack (months, ~$0); public beta on **Hobby** ($5 + under-credit usage); growth on **Pro** ($20). Since Hobby/Pro fees are *credit floors not caps*, usage beyond the credit is billed on top — set the Railway usage cap accordingly.

---

## 11. Release checklist (pre-deploy)

Before promoting any build to production, run the following gates (mirroring [09-mvp-acceptance.md](/09-mvp-acceptance.md)):

- [ ] All unit + integration tests pass (`pnpm test`).
- [ ] Lint + typecheck pass (`pnpm lint`, `pnpm run typecheck`).
- [ ] OpenAPI YAML validates against the spec (`pnpm run validate-openapi`).
- [ ] JSON Schema for capsule content validates (`pnpm run validate-schema`).
- [ ] ERD structural check passes (`pnpm run check-erd`).
- [ ] Rate limit configs correct for all tiers (Upstash command volume projected under 500K/mo — see §8 guardrail).
- [ ] Stripe webhook endpoint verified (test mode).
- [ ] Google OAuth flow tested.
- [ ] MCP tool definitions compile; skills list appears in Claude Code.
- [ ] Extension MV3 manifest passes CRX validation.
- [ ] All H-REQ acceptance criteria from [09 §3] verified manually or via Playwright E2E.
- [ ] Con-countermeasure baseline verified (D-011: no regressions on C-1..C-13).
- [ ] Feature flags reviewed: every V2/V3 item gated and documented.
- [ ] **Free-tier budget gate**: Neon CU-hours, egress, Upstash commands, and Railway credit usage projected within free limits for the next month — otherwise the release must include the §10 upgrade.
- [ ] **Uptime caveat acknowledged**: 3-day logs, no SLA, cold starts — confirmed acceptable for this release stage.

Failure on any gate blocks the deploy.