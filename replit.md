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
  components/    - Reusable components (app-sidebar, theme-provider, theme-toggle)
  hooks/         - Custom hooks (use-auth, use-toast)
  lib/           - Utilities (queryClient, types, auth-utils)
server/
  index.ts       - Express server entry point
  routes.ts      - All API routes with RBAC middleware
  storage.ts     - DatabaseStorage implementing IStorage interface
  fileStorage.ts - StorageProvider for file upload/download
  db.ts          - Drizzle + pg pool setup
  replit_integrations/auth/ - Replit Auth integration
shared/
  schema.ts      - All Drizzle schemas and types
  models/auth.ts - Auth-specific schemas (users, sessions)
```

## Multi-Tenancy
- Every record is scoped to a `tenantId`
- Roles: OWNER, ADMIN, TECH, CLIENT
- CLIENT role can only view evidence assigned to their client(s)
- TECH can manage evidence; ADMIN/OWNER can manage everything

## Key Features
1. Dashboard with stats, search, and recent uploads
2. Clients management with detail pages
3. Sites tracking linked to clients
4. Assets tracking (devices, servers)
5. Evidence Locker - upload, tag, search, download, delete
6. Team management with role-based invites
7. Audit logging for all key actions
8. Billing stub with plan limits

## Recent Changes
- Initial build: Full schema, frontend, backend, auth integration
- Added Zod validation on all POST routes (tenants, clients, sites, assets) using createInsertSchema
- Added server-side MIME type filtering in multer fileFilter for evidence uploads
- Added SEO meta tags (title, description, OG tags) in index.html
- Fixed data-testid attributes to use hyphens instead of spaces
