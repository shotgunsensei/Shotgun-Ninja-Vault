# Shotgun Ninja Vault (SNV)

## Overview
A multi-tenant SaaS web application for IT professionals and MSPs to securely manage digital evidence. Features role-based access control, evidence file management, client/asset tracking, and audit logging. Built with a modular architecture.

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
```

## Module System
- **Registry**: `shared/modules/index.ts` defines all modules with metadata (id, name, description, version, category, enabled, requiredPlan, navItems)
- **Two modules**: `core` (always enabled, category: core) and `evidence` (Evidence Locker, category: feature)
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

## Recent Changes
- Refactored to module-ready architecture: shared/modules registry, server/modules/{core,evidence}/routes.ts, client/src/modules/{core,evidence}/ with barrel exports
- server/routes.ts is now a slim orchestrator importing module route registrars
- Settings page shows enabled modules with version, category, and status
- GET /api/modules endpoint serves module registry to frontend
- Old client/src/pages/ files kept as re-export stubs for backward compatibility
