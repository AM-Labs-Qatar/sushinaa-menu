# Data kinds

Sushinaa does not “sync databases.” Data is three kinds. Environments (`sushinaa-cms` live vs `sushinaa-cms-dev`) are separate Turso databases; hosts (`menu` / `order` / `admin`) share the **live** DB.

## Catalog

| Tables | `menu`, `media` |
| --- | --- |
| Day-to-day | Edit **live** in CMS (`https://admin.sushinaa.qa`). |
| Refresh dev | `npm run db:copy-to-dev` — live → dev, menu + media only. |
| Relaunch content | `npm run db:copy-dev-menu-to-live` with `CONFIRM_LIVE_MENU_COPY=sushinaa-cms` — dev → live, menu + media only. |

Scripts refuse anything outside this allowlist (`scripts/copy-to-dev.ts` → `CATALOG_TABLES`).

## Transactions (env-local)

| Includes | Orders, payment attempts/events, order edits/outbox, sessions, staff users/sessions, login attempts, audit, **coupons** |
| --- | --- |
| Rule | **Never promote** between live and dev. |
| Coupons | Recreate fresh on live after cutover. Do not copy from `sushinaa-cms-dev`. |

Dev test orders stay on dev forever.

## Config / secrets (not DB rows)

| Lives in | Vercel project env vars (and local `.env`) |
| --- | --- |
| Live (`sushinaa-menu` Production) | Live Turso URL/token, CMS admin password, live Sadad, `OXIPOS_*` when ready |
| Dev (`test-dev`) | Dev Turso only, sandbox Sadad, no `*.sushinaa.qa` domains |
| Git | Never |

## Schema / code

New tables and migrations are proven on **dev** / test-dev, then released by merging `dev` → `main`. Do not promote schema by copying database files. Do not run `npm run db:migrate` against Turso casually — see `docs/environments.md`.

## Operating cheat sheet

| Situation | Do this |
| --- | --- |
| Change a price or photo | Live CMS |
| Test a big menu on test-dev, then ship it | Promote menu + media only |
| New ordering/payment schema | Code + migrations on `dev`, merge to `main` |
| Coupons for production | Create new ones on live |
| Keep hacking after release | Leave `dev` + test-dev as the permanent playground |
