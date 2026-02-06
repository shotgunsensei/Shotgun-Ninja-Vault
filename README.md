# Shotgun Ninja Vault (SNV)

Shotgun Ninja Vault (SNV) is a **multi-tenant, security-first evidence + licensing platform** designed for MSPs, IT teams, and digital creators who need verifiable proof, controlled access, and auditable history — without enterprise bloat.

It currently ships with three enabled modules:

- **Core Platform** (tenants, roles, team, audit log, client access)
- **Evidence Locker** (uploads, tags, search, preview, SHA-256 dedup)
- **License Server** (products, keys, validation API, activations)

Planned modules (roadmap): status pages, compliance report builder, MSP client portal bundles, API-only mode.

---

## Stack (what this repo actually runs)

- **Frontend**: React + Vite + TypeScript  
  wouter (routing), TanStack Query (data), shadcn/ui + Tailwind (UI)
- **Backend**: Express + TypeScript (single port; serves API + UI)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Replit Auth (OIDC) via passport/openid-client  
  **Optional dev bypass**: `DEV_AUTH_BYPASS=true` (non-production only)
- **Storage**: local disk via `StorageProvider` abstraction (S3-ready)

> Note: If you saw older docs referencing Next.js/Prisma, that was an earlier direction. This repo is Vite + Express + Drizzle.

---

## Quick start (Replit)

1. Import repo into Replit
2. `npm install`
3. Create a Postgres DB in Replit (or attach external Postgres) and set secrets:

### Required secrets

- `DATABASE_URL` (postgres connection string)
- `SESSION_SECRET` (random long string)

### Replit Auth (OIDC) secrets (production / real login)

- `REPL_ID` (Replit OIDC client id)
- `ISSUER_URL` (usually `https://replit.com/oidc`)

### Optional secrets

- `MAX_UPLOAD_MB` (default enforced in server if present)
- `DEV_AUTH_BYPASS` (`true` to bypass OIDC in dev only)
- `DEV_USER_ID` (default: `dev-user`)
- `DEV_USER_EMAIL` (default: `dev@localhost`)
- `DEV_TENANT_SLUG` (default: `dev`)

4. Initialize schema:
   - `npm run db:push`

5. Run:
   - `npm run dev`

Deployment build/start:
- Build: `npm run build`
- Start: `npm run start`

---

## Module system

Modules are registered in `shared/modules/index.ts` and implemented as:

- server routes: `server/modules/<module>/routes.ts`
- client pages: `client/src/modules/<module>/...`

Enabled modules inject navigation items into the sidebar.

---

## Security notes (non-negotiables)

- Tenant scoping is enforced server-side (queries are tenant-filtered)
- Role checks are enforced server-side
- Uploads are validated and hashed (SHA-256) for dedup + integrity tracking
- License keys are **hashed at rest** (no plaintext storage)
- Audit logs are append-only

---

## License

MIT (see package.json)
