# Shotgun Ninja Vault (SNV)

## Overview
A multi-tenant SaaS web application for IT professionals and MSPs to securely manage digital evidence. Features role-based access control, evidence file management, client/asset tracking, audit logging, and a license server module. Built with a modular architecture.

## Architecture
- **Frontend**: React + Vite + wouter + TanStack Query + shadcn/ui + Tailwind
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OIDC) via passport
- **File Storage**: Local disk storage with `StorageProvider` interface (swappable to S3)
- **Module System**: Shared module registry with per-module server routes and client pages

## Project Structure
```
shared/
  schema.ts             - All Drizzle schemas and types
  models/auth.ts        - Auth-specific schemas (users, sessions)
  modules/
    index.ts            - Module registry (lists all modules, enabled state)
    types.ts            - ModuleDefinition, ModuleRegistry types

server/
  index.ts              - Express server entry point
  routes.ts             - Slim orchestrator: imports + registers module routes
  authz.ts              - Authorization middleware (requireUser, requireTenant, requireRole, requireClientAccess)
  storage.ts            - DatabaseStorage implementing IStorage interface
  fileStorage.ts        - StorageProvider for file upload/download with sha256 dedup
  db.ts                 - Drizzle + pg pool setup
  replit_integrations/auth/ - Replit Auth integration
  modules/
    core/routes.ts      - Core API routes (tenants, clients, sites, assets, members, audit, client-access, dashboard, modules)
    evidence/routes.ts  - Evidence API routes (CRUD, upload, download, delete, tags)
    license/routes.ts   - License Server API routes (products, keys, validate, activations)

client/src/
  App.tsx               - Root app with routing, imports from module barrels
  pages/                - Re-export stubs pointing to module pages (backward compat)
  components/           - Shared components (app-sidebar, breadcrumbs, theme-provider, ui/)
  hooks/                - Custom hooks (use-auth, use-toast)
  lib/                  - Utilities (queryClient, types, auth-utils)
  modules/
    core/
      index.ts          - Barrel exports for all core pages
      pages/            - dashboard, clients, client-detail, sites, assets, team, audit, client-access, settings, onboarding, landing
    evidence/
      index.ts          - Barrel exports for all evidence pages + components
      pages/            - evidence, evidence-detail, evidence-upload
      components/       - evidence-preview
    license/
      index.ts          - Barrel exports for license pages
      pages/            - licenses (products + keys management), developer (API docs)
```

## Module System
- **Registry**: `shared/modules/index.ts` defines all modules with metadata (id, name, description, version, category, enabled, requiredPlan, navItems)
- **Three modules**: `core` (always enabled, category: core), `evidence` (Evidence Locker, category: feature), `license` (License Server, category: feature)
- **API**: `GET /api/modules` returns the module list to the frontend
- **Settings page**: Shows enabled modules with status badges, versions, and plan requirements
- **Server routes**: Each module registers its own Express routes via a `register*Routes(app)` function
- **Client pages**: Each module has a barrel `index.ts` re-exporting page components; App.tsx imports from these barrels
- **Backward compatibility**: Original `client/src/pages/` files are kept as re-export stubs

## Authorization (server/authz.ts)
- `requireUser` - Ensures request has authenticated user
- `requireTenant` - Validates tenant membership, attaches tenantId + role to request
- `requireRole(...roles)` - Validates user has required role within tenant
- `requireClientAccess(clientId)` - For CLIENT role, ensures user has access to specified client
- All queries in storage.ts are tenant-scoped, preventing cross-tenant data access

## Multi-Tenancy
- Every record is scoped to a `tenantId`
- Roles: OWNER, ADMIN, TECH, CLIENT
- CLIENT role can only view evidence assigned to their client(s)
- TECH can manage evidence; ADMIN/OWNER can manage everything

## Evidence System
- **Upload**: SHA-256 deduplication within tenant, configurable MAX_UPLOAD_MB (default 25MB)
- **File types**: png, jpg, jpeg, pdf, txt, log, csv, json
- **Storage path**: `data/uploads/{tenantId}/{yyyy}/{mm}/{filename}`
- **Search**: Postgres full-text search (to_tsvector) over title, notes, client/asset names with ILIKE fallback
- **Filters**: date range, client, asset, tag, free-text search
- **Preview**: Inline preview for images and PDFs via modal dialog

## License Server System
- **Data Model**: LicenseProduct, LicenseKey, LicenseActivation, WebhookEndpoint (all tenant-scoped)
- **Key Format**: SNV-XXXX-XXXX-XXXX-XXXX (base32-ish, crypto.randomInt)
- **Key Storage**: Only SHA-256 hash stored; plaintext shown once at creation
- **Public Validate API**: POST /api/license/validate (no auth required)
  - Input: productSlug, licenseKey, deviceFingerprint
  - Validates: product active, key not revoked, not expired, activation count < max
  - Creates activation for new deviceFingerprint if valid
  - Returns: { valid, reason, remainingActivations, expiresAt }
- **Rate Limiting**: 30 requests/minute per IP on validate endpoint (in-memory)
- **Security**: Key existence not leaked; generic "invalid_key" response for missing/wrong keys
- **Admin UI**: Products list/detail, issue keys, view activations, revoke keys (OWNER/ADMIN only)
- **Developer Tab**: cURL, JavaScript, and Node.js code snippets for validate API integration
- **Audit Events**: create_license_product, issue_license_key, revoke_license_key, license_validate_activation

## Key Features
1. Dashboard with stats, search, and recent uploads
2. Clients management with detail pages
3. Sites tracking linked to clients
4. Assets tracking (devices, servers)
5. Evidence Locker - upload, tag, search, download, delete, inline preview
6. Team management with role-based invites
7. Audit logging for all key actions (uploads, deletes, role changes, invites)
8. Billing stub with plan limits
9. Breadcrumb navigation on detail pages
10. Module registry with settings page showing enabled modules
11. License Server - product management, key issuance, activation tracking, public validate API, developer docs

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key
- `MAX_UPLOAD_MB` - Maximum file upload size in MB (default: 25)

## CLIENT Portal Access Control
- **ClientUserAccess** join table (`clientUserAssignments`): tenantId, clientId, userId, canUpload flag
- CLIENT users only see assigned clients and their evidence (filtered server-side)
- CLIENT cannot access Sites, Assets, Team, Audit, or Settings pages (routes hidden + server-enforced)
- CLIENT cannot delete evidence; Delete button hidden in UI and blocked server-side
- CLIENT upload requires `canUpload=true` permission on their client assignment
- TECH can only delete own uploads (server-enforced)
- ADMIN/OWNER manage client access assignments via `/client-access` admin page
- Dashboard shows ClientPortalDashboard for CLIENT role (assigned clients + evidence)
- `/api/dashboard` restricted to OWNER/ADMIN/TECH roles server-side

## Event-Driven Architecture
- **Event Bus**: `server/core/events/bus.ts` - typed EventEmitter singleton, all domain events flow through it
- **Event Types**: `server/core/events/types.ts` - DomainEvent type with type, tenantId, actorUserId, entityType, entityId, details
- **Audit Subscriber**: `server/core/events/subscribers.ts` - auto-writes audit logs for all emitted events
- All route handlers emit events via `eventBus.emit()` instead of direct `createAuditLog` calls

## Webhooks Module
- **Schema**: `webhookEndpoints` (url, secret, eventTypes[], active) + `webhookDeliveries` (status, attempts, response)
- **Routes**: `server/modules/webhooks/routes.ts` - CRUD for webhook endpoints (OWNER/ADMIN only)
- **Worker**: `server/modules/webhooks/worker.ts` - polls pending deliveries every 5s, HMAC-SHA256 signed (X-SNV-Event, X-SNV-Timestamp, X-SNV-Signature), exponential backoff (5 retries)
- **UI**: `client/src/modules/webhooks/pages/webhooks.tsx` - manage webhook endpoints

## Evidence Packet Export
- **Endpoint**: `POST /api/evidence/export-packet` - generates ZIP with manifest.json, sha256sums.txt, evidence files, and audit/events.json
- **UI**: Evidence Locker page has Export button with multi-select mode (checkboxes + select all/deselect all)
- **Access**: OWNER, ADMIN, TECH roles only

## Audit Log Filters
- **Endpoint**: `GET /api/audit` supports query params: action, entityType, userId, dateFrom, dateTo
- **Endpoint**: `GET /api/audit-actions` returns distinct action types for filter dropdown
- **UI**: Audit page has collapsible filter panel with action type, entity type, date range filters

## Recent Changes
- Added event-driven architecture with EventBus, typed domain events, and audit subscriber
- Added Webhooks module with HMAC-signed delivery, exponential backoff retries, admin UI
- Added audit log filters (action type, entity type, date range) with UI filter panel
- Added Evidence Packet export (ZIP with manifest, sha256sums, files, audit trail) with multi-select UI
- Added License Server module: data model (products, keys, activations, webhooks), storage layer, API routes with rate-limited public validate endpoint, admin UI, developer docs tab
- Registered license module in shared/modules/index.ts
- Added sidebar navigation group "License Server" with Licenses and Developer links
- Refactored to module-ready architecture: shared/modules registry, server/modules/{core,evidence,license}/routes.ts, client/src/modules/{core,evidence,license}/ with barrel exports
