# Shotgun Ninja Vault (SNV)

## Overview
A multi-tenant SaaS web application for IT professionals and MSPs to securely manage digital evidence. Features role-based access control, evidence file management, client/asset tracking, and audit logging.

## Architecture
- **Frontend**: React + Vite + wouter + TanStack Query + shadcn/ui + Tailwind
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OIDC) via passport
- **File Storage**: Local disk storage with `StorageProvider` interface (swappable to S3)

## Project Structure
```
client/src/
  pages/         - All page components (dashboard, clients, assets, evidence, etc.)
  components/    - Reusable components (app-sidebar, breadcrumbs, evidence-preview, theme-provider)
  hooks/         - Custom hooks (use-auth, use-toast)
  lib/           - Utilities (queryClient, types, auth-utils)
server/
  index.ts       - Express server entry point
  routes.ts      - All API routes with RBAC middleware
  authz.ts       - Centralized authorization middleware (requireUser, requireTenant, requireRole, requireClientAccess)
  storage.ts     - DatabaseStorage implementing IStorage interface
  fileStorage.ts - StorageProvider for file upload/download with sha256 dedup
  db.ts          - Drizzle + pg pool setup
  replit_integrations/auth/ - Replit Auth integration
shared/
  schema.ts      - All Drizzle schemas and types
  models/auth.ts - Auth-specific schemas (users, sessions)
```

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

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key
- `MAX_UPLOAD_MB` - Maximum file upload size in MB (default: 25)

## Recent Changes
- Initial build: Full schema, frontend, backend, auth integration
- Added Zod validation on all POST routes using createInsertSchema
- Added server-side MIME type filtering for evidence uploads
- Added SEO meta tags in index.html
- Centralized authorization into authz.ts module
- Added SHA-256 file deduplication and tenant-scoped file paths
- Implemented Postgres full-text search for evidence with advanced filters
- Enhanced audit logging with role change tracking and metadata
- Added breadcrumb navigation and evidence preview modal
- Evidence list page with search filters (client, date range, text search)
