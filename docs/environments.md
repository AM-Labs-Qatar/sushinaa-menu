# Environments

Sushinaa has two databases and two sites. Production is the live restaurant menu. Dev is a copy for building and showing work. They must not share a database.

## Sites

Vercel team for both projects and for the `sushinaa.qa` zone is **`amlabs1`** (billing account **amlabsqatar**). They used to live under `abu-iqbal-projects`.

| Site | URL | Git | Vercel project | Database |
| --- | --- | --- | --- | --- |
| Production on-site | https://menu.sushinaa.qa | `main` | `sushinaa-menu` | Live Turso database `sushinaa-cms` |
| Production pickup | https://order.sushinaa.qa | `main` (same deploy) | `sushinaa-menu` | Live Turso database `sushinaa-cms` |
| Production admin / CMS | https://admin.sushinaa.qa | `main` (same deploy) | `sushinaa-menu` | Live Turso database `sushinaa-cms` |
| Legacy production alias | https://sushinaa-menu.vercel.app | `main` | `sushinaa-menu` | 301 → `menu.sushinaa.qa` (see `src/proxy.ts`) |
| Dev (public) | https://test-dev-abu-iqbal-projects.vercel.app | `dev` (assigned on the domain) | `test-dev` | Dev Turso database `sushinaa-cms-dev` |
| Local | http://localhost:3005 | any branch | none | `file:./data/menu.db`, unless you point it at the dev database |

The public `test-dev` hostname kept its pre-move alias (`test-dev-abu-iqbal-projects.vercel.app`). Do not rename it without updating `SADAD_PUBLIC_ORIGIN` and Sadad sandbox registration.

**`test-dev` always serves the Git `dev` branch** of `AM-Labs-Qatar/sushinaa-menu`. That is done by assigning the public domain to git branch `dev` (Preview). Do **not** set the project's Production Git branch to `dev`: Vercel Production sets `VERCEL_ENV=production`, and the env guard then refuses the development Turso database. Leave the project's Production Git branch on `main` (unused for the public URL).

DNS for `sushinaa.qa` is on Vercel under team `amlabs1` (registrar may still be QHOST). Attach `menu`, `order`, and `admin` on **`sushinaa-menu` only** — never on `test-dev`. Do **not** set `STOREFRONT_MODE` on `sushinaa-menu` Production — host selects the storefront. On `admin.sushinaa.qa`, the CMS is at `/` (`/login` for sign-in); `/admin` redirects to those root paths.

### test-dev isolation

`test-dev` is a separate Vercel project and a separate Turso database. It must **not** share `order.sushinaa.qa`, `menu.sushinaa.qa`, `admin.sushinaa.qa`, live Turso tokens, or live Sadad keys. Sandbox Sadad on `test-dev` uses `SADAD_PUBLIC_ORIGIN=https://test-dev-abu-iqbal-projects.vercel.app` only.

## OXiPOS (on-site / menu host)

See [`docs/OXIPOS.md`](OXIPOS.md). **Separation:** car-collection pickup stays in the **CMS**. On-site ordering on `menu.sushinaa.qa` is the OXiPOS pull target (pay at the branch card machine / counter — not Sadad). Code and host gates are ready; leave `OXIPOS_*` unset on Production until the restaurant maps SKUs and points POS at `https://menu.sushinaa.qa/api/pos/orders` (trailing slash also accepted). Flip-on is env + POS config only — never put `OXIPOS_*` on the pickup path or point POS at `order.*`.

## Storefronts (menu vs pickup)

One deployment serves two customer storefronts from the same catalog:

| Storefront | Typical URL | Channel | Payment | Kitchen |
| --- | --- | --- | --- | --- |
| On-site ordering | `https://menu.sushinaa.qa/{branch}` | `menu` | Branch POS / counter (not Sadad) | **OXiPOS** pull |
| Pickup ordering | `https://order.sushinaa.qa/{branch}` | `pickup` | **Live Sadad** (or pay-at-pickup until cutover) | **CMS** live Orders |

Host `order.*` selects **pickup**. Anything else (including `menu.*`) selects **menu**. For local and for `test-dev` before the `order.` DNS record exists, set `STOREFRONT_MODE=pickup` (or `menu`) to override the host. Legacy aliases `order` / `browse` still work.

"Preview" is a Vercel word for a deployment that is not the production deployment of a project, such as a pull request. It is not the dev site. Do not treat a `sushinaa-menu` preview as a safe place to edit the menu. The dev site is `test-dev`.

https://test-dev-abu-iqbal-projects.vercel.app follows the `dev` branch. A push to `dev` updates that site. It does not update production. `https://test-dev.vercel.app` is not ours. Other branches do not deploy the `test-dev` project.

For a built local phone preview over HTTP, set `SUSHINAA_LOCAL_HTTP_PREVIEW=1` for both build and start, with `VERCEL` and `VERCEL_ENV` unset. This keeps Safari from upgrading local assets to HTTPS. The flag has no effect on hosted deployments. Do not add it to Vercel.

## Databases

Both databases are in Turso org **`amlabsqatar`**, group **`sushinaa`**, region `aws-ap-south-1`. The app reads `CMS_DATABASE_URL` and `CMS_DATABASE_AUTH_TOKEN`. It does not read `TURSO_*`.

The live hostname is fixed in `src/lib/deploy-env.ts`:

`sushinaa-cms-amlabsqatar.aws-ap-south-1.turso.io`

The dev hostname is `sushinaa-cms-dev-amlabsqatar.aws-ap-south-1.turso.io`. The dev database has an `env_marker` row of `development`. Production has no marker. Do not add one.

## Rules

- Do not write, repoint, redeploy, or migrate production. Do not push or merge to `main`. Abu releases `dev` to `main`.
- Do not put the live hostname or the live token on any project except production of `sushinaa-menu`.
- Do not run `npm run db:migrate` against either Turso database or against `data/menu.db`.
- Do not run browser tests against the live database.
- Do not print tokens, passwords, or `.env` files. Do not commit them.
- Each environment variable is its own entry. Do not tick one entry for Production and Development together.
- Tokens are for one database, never a group token. A read-only copy token is created for that run only and is not a Vercel variable. Turso cannot revoke one database token without invalidating every token on that database, which would break production. Do not run `turso db tokens invalidate` on `sushinaa-cms`.

## Variables on `sushinaa-menu`

| Variable | Production | Development | Preview |
| --- | --- | --- | --- |
| `CMS_DATABASE_URL` / `CMS_DATABASE_AUTH_TOKEN` | Live database. Do not edit. | `sushinaa-cms-dev` | Not set. Leave it unset. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Live database. Do not edit. | Not set | Not set |
| `CMS_ADMIN_USERNAME` / `CMS_ADMIN_PASSWORD` | Live admin. Do not edit. | `dev-admin` and a different password | Old preview values. Ignore. |
| `DEV_TURSO_DATABASE_URL` / `DEV_TURSO_AUTH_TOKEN` | Not set | Dev database | Dev database |
| `CMS_ENV_GUARD` | `enforce`. The running production deployment has not been rebuilt with this yet. | `enforce` | `enforce`, and the preview database is the dev database |

`test-dev` has `CMS_DATABASE_URL`, `CMS_DATABASE_AUTH_TOKEN`, and `CMS_ENV_GUARD=enforce` for the dev database only. It has no admin password, so its CMS sign-in fails closed. The dev admin password lives in the Development environment of `sushinaa-menu`, not in git.

Set `CRON_SECRET` on `test-dev` (and any other hosted non-live project that runs `vercel.json` crons) so Vercel Cron can call `/api/cron/purge-orders`. Without it the route returns 401. Do not rely on purge against the live Turso host; the route refuses that database.

### Sadad (online pay before pickup — `order.*` only)

Sadad is only for **pickup** on `order.sushinaa.qa`. Do not bind live Sadad to `menu.sushinaa.qa` (on-site / POS path).

On **`test-dev` Production** (dev database), set each variable separately when the sandbox merchant is ready:

| Variable | Purpose |
| --- | --- |
| `PAYMENT_PROVIDER` | `sadad` |
| `SADAD_SECRET_KEY` | Sandbox secret from Sadad |
| `SADAD_MERCHANT_ID` | Sandbox merchant id |
| `SADAD_PUBLIC_ORIGIN` | `https://test-dev-abu-iqbal-projects.vercel.app` (no trailing slash) |

Register with Sadad: callback `…/api/payments/callback`, webhook `…/api/payments/webhook`. Live Production uses `SADAD_PUBLIC_ORIGIN=https://order.sushinaa.qa` and the same callback/webhook paths on that host. Do not put a live key on Production until sandbox sign-off. Local/CI keeps `PAYMENT_PROVIDER` unset or `mock`.

## Guard

`src/instrumentation.ts` and `initDb()` check the database once at startup.

- Production (`VERCEL_ENV=production`) must use the live hostname and must not use a mock payment provider. Online Sadad (`PAYMENT_PROVIDER=sadad` + `SADAD_*`) is for paying a **pickup** order before collection — enable on `test-dev` with the sandbox key first; do not put a live Sadad secret on production until cutover is approved. Live checkout also requires `ORDERING_LIVE_ENABLED=1`.
- Anything else must not use the live hostname and must see the `development` marker.
- `CMS_ENV_GUARD=enforce` refuses to start. Any other value, including unset, only logs. The log prefix is `cms-env-guard` and it does not include URLs or tokens.
- The flag is `enforce` on dev and on the production variable. The live deployment has not been rebuilt, so the running site does not enforce yet. That starts when `dev` is released to `main`.

The public dev URL is a preview deployment of the `dev` branch, so `VERCEL_ENV` is not `production`. With `enforce`, it starts only because the database is the dev database and the marker is `development`. It sends `noindex`.

On `sushinaa-menu`, a deployment that is not production sends `X-Robots-Tag: noindex, nofollow`, `robots.ts` disallows all, and the page robots meta is noindex.

## Copy and migrations

Catalog vs transactions vs secrets: **`docs/data-kinds.md`**. Day-to-day menu edits are live CMS; copy scripts only move `menu` + `media`. Coupons and orders are never promoted — recreate coupons on live.

`npm run db:copy-to-dev` reads only `menu` and `media` from `SOURCE_DATABASE_URL` with a read-only token, and writes them to `TARGET_DATABASE_URL`. It refuses the live hostname as a target, refuses a target whose marker is not `development`, and writes that marker on an empty target. It does not read sessions, audit, login_attempts, orders, or coupons. Run it again to refresh dev. Those four variables are shell variables for that command, not Vercel variables.

`npm run db:copy-dev-menu-to-live` is the reverse direction for cutover: source must be the **dev** database (marker `development`), target must be **live**, and `CONFIRM_LIVE_MENU_COPY=sushinaa-cms` is required. It writes only `menu` and `media` and does not touch live `env_marker`, sessions, audit, orders, or coupons. Shell variables only — never store the confirmation in Vercel.

Live ordering stays off until `ORDERING_LIVE_ENABLED=1` on `sushinaa-menu` Production. Unset (default) keeps the live Turso host refused for order tables and checkout. After that flag is set, app bootstrap creates order/staff schema on live; do not run `npm run db:migrate` against live.

`npm run db:migrate` applies numbered files in `db/migrations/` and records them in `schema_migrations`. `0001_baseline.sql` is the current schema and uses `IF NOT EXISTS` only. CI fails a migration line that contains `DROP` or `RENAME`.

## Git

Feature branches open pull requests into `dev`. `dev` requires a pull request and a passing `check`. `main` requires a pull request and passing `check` and `browser`. Force-push and deletion are blocked on both. Do not add a rule that blocks all updates to `dev`. That stops merges.

Browser tests run in CI only on pull requests into `main`. CI audits production dependencies (`npm audit --omit=dev --audit-level=high`). The full tree still reports `braces` 3.0.3 through `eslint-config-next`. That is the newest release. Do not use `npm audit fix --force`.
