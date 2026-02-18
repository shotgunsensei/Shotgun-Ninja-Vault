# Tech Deck

## Overview
Tech Deck is a multi-tenant SaaS web application designed for IT professionals and Managed Service Providers (MSPs). Its primary purpose is to provide a comprehensive platform for managing MSP operations - from tickets to invoices and everything in-between - offering features such as role-based access control, comprehensive evidence file management, client and asset tracking, and detailed audit logging. The platform is built with a modular architecture to ensure scalability and extensibility, including a dedicated license server module. Tech Deck aims to streamline MSP management workflows, enhance security, and provide robust reporting capabilities for compliance and operational efficiency.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the `shared/modules/index.ts` file.
Do not make changes to the `server/authz.ts` file.

## System Architecture

### UI/UX Decisions
The frontend is built using React with Vite, wouter for routing, TanStack Query for data fetching, shadcn/ui for UI components, and Tailwind CSS for styling. The design prioritizes a clean, intuitive interface suitable for IT professionals and MSPs, focusing on clear navigation, accessible data presentation, and responsive layouts. Key UI components include a persistent app sidebar, dynamic breadcrumb navigation, and a theme provider for consistent theming.

### Technical Implementations
The application follows a modular architecture.
- **Frontend**: React, Vite, wouter, TanStack Query, shadcn/ui, Tailwind CSS.
- **Backend**: Express.js with TypeScript, providing a robust API layer.
- **Database**: PostgreSQL, managed with Drizzle ORM for type-safe and efficient data interaction.
- **Authentication**: Integrates Replit Auth (OIDC) via `passport.js`.
- **Authorization**: A fine-grained authorization system (`server/authz.ts`) enforces permissions based on user roles (OWNER, ADMIN, TECH, CLIENT) and tenant membership, including specific client access control.
- **File Storage**: Local disk storage is implemented with a `StorageProvider` interface, allowing for future integration with cloud storage solutions like S3. Files are stored with SHA-256 deduplication.
- **Module System**: Features a dynamic module registry (`shared/modules/index.ts`) that defines and manages six core modules: `core`, `evidence`, `license`, `webhooks`, `status`, and `reports`. Each module can register its own server routes and client pages, ensuring high modularity and extensibility.
- **Multi-Tenancy**: Every data record is scoped by a `tenantId`, ensuring strict data isolation between tenants.
- **Event-Driven Architecture**: Utilizes an `EventBus` (`server/core/events/bus.ts`) for typed domain events, allowing for decoupled system components. An audit subscriber automatically logs all emitted events.

### Feature Specifications
- **Evidence Management**: Secure upload, SHA-256 deduplication, tagging, searching (Postgres full-text search), filtering, downloading, and inline preview for various file types (images, PDFs, text).
- **License Server**: Manages license products, keys, and activations. Provides a public API for license validation with rate limiting and secure key handling (SHA-256 hash storage). Includes an administrative UI and developer documentation.
- **Client Portal**: A restricted interface for users with the CLIENT role, providing read-only access to their assigned clients and associated evidence.
- **Compliance Reports**: Generates ZIP-based evidence packets, including manifest, SHA-256 sums, evidence files, and an audit trail, with configurable filtering options.
- **Status Pages**: Allows creation and management of public status pages with components and incident reporting.
- **Webhooks**: Supports configurable webhook endpoints for event notifications with HMAC-SHA256 signed deliveries and exponential backoff for retries.
- **Audit Logging**: Comprehensive audit trail for all significant actions, supporting filtering by action type, entity type, and date range.
- **User and Team Management**: Role-based access control, user invitations, and management of client assignments.
- **Dashboard**: Provides an overview of key statistics and recent activity, tailored to user roles.

### API Access Module
- **Schema**: apiTokens table (id, tenantId, name, tokenHash SHA-256, scopes text[], enabled, lastUsedAt, createdAt, updatedAt)
- **Auth Middleware** (server/core/apiAuth.ts): Bearer token validation, scope enforcement, req.apiAuth context
- **API v1 Endpoints**: GET /api/v1/openapi.json, GET /api/v1/status/:slug (public), GET /api/v1/evidence (evidence:read), POST /api/v1/license/validate (license:validate)
- **Admin UI**: /api-tokens page for OWNER/ADMIN with create/revoke, one-time plaintext display
- **API_ONLY Mode**: env API_ONLY=true disables SPA + session auth, serves only /api/v1 + /health

### Billing Module
- **Schema**: subscriptionPlans (code, name, monthlyPriceCents, limits JSON), tenantSubscriptions (tenantId, stripeCustomerId, stripeSubscriptionId, stripePriceId, planCode, status, currentPeriodEnd, cancelAtPeriodEnd), usageCountersMonthly (tenantId, monthKey YYYY-MM, reportsGenerated, webhookDeliveries, evidenceBytesStored)
- **Plans**: solo ($0), pro ($29), msp ($99), enterprise ($299) - seeded on startup via seedSubscriptionPlans()
- **Plan Enforcement**: server/core/billing/enforcePlan.ts - requireFeature() and checkLimit() middleware (not in authz.ts)
- **Stripe Integration**: server/modules/billing/stripe.ts (client init, plan seeding), webhook.ts (checkout.session.completed, subscription updates/deletions), routes.ts (plans, subscription, checkout-session, customer-portal)
- **Usage Tracking**: Reports increment reportsGenerated counter on job creation; webhooks increment webhookDeliveries on delivery attempt
- **Client Pages**: /billing (plan cards, usage dashboard, Stripe checkout/portal), /billing/success, /billing/cancel
- **Env Vars**: APP_URL (auto-resolved via REPLIT_DOMAINS in production)
- **Stripe Credentials**: Managed via Replit Stripe connector (not env vars)
- **Enterprise Plan**: $299/month, all plans purchasable via Stripe checkout

### System Admin Module
- **Schema**: `isSystemAdmin` boolean on users table (default false)
- **Middleware**: server/core/middleware/requireSystemAdmin.ts - checks isSystemAdmin flag via storage lookup
- **Admin Routes**: server/modules/admin/routes.ts - GET /api/admin/tenants, GET /api/admin/users, POST /api/admin/tenants/:id/pause, POST /api/admin/tenants/:id/unpause, DELETE /api/admin/tenants/:id
- **Auth Check**: GET /api/auth/admin-check returns { isSystemAdmin: boolean }
- **Client Page**: /system-admin with tenant/user tabs, pause/unpause/delete controls

### Payment Grace Period System
- **Schema**: `pausedAt` timestamp on tenantSubscriptions (nullable)
- **Middleware**: server/core/middleware/requireNotPaused.ts - blocks POST/PUT/PATCH/DELETE on paused accounts (returns 402 with paused metadata), allows GET and evidence downloads
- **Webhook Integration**: server/modules/billing/webhook.ts automatically sets pausedAt on past_due/canceled/unpaid status, clears on active/trialing
- **Grace Cleanup**: server/core/billing/graceCleanup.ts - scheduled job runs every 6 hours, auto-deletes tenants paused 90+ days with race-condition protection (re-checks pausedAt before deletion)
- **Pause Status API**: GET /api/tenant/pause-status returns { paused, pausedAt, daysRemaining, status }
- **Frontend Enforcement**: When paused, routes restricted to /evidence, /billing, /system-admin only; sidebar shows only Evidence and Billing; paused banner with countdown and action buttons
- **Billing Routes Exempt**: Users can access billing page while paused to fix payment issues

### Pending Invitations (Auto-Join)
- **Schema**: pending_invitations table (id, tenantId, email, role, createdAt) with unique index on (tenantId, email)
- **Auth Hook**: server/replit_integrations/auth/replitAuth.ts - processPendingInvitations() runs after every OIDC login, checks email against pending invitations, auto-joins user to tenant(s) with assigned role, then deletes the invitation
- **Invite Route**: POST /api/members/invite now stores a pending_invitations record (previously only emitted an event)
- **Race Protection**: Duplicate membership insert is caught and ignored; unique index prevents duplicate invitations

### CSV Import/Export
- **Backend**: server/modules/core/routes.ts - CSV template downloads and bulk import endpoints
- **Parser**: papaparse for server-side CSV parsing
- **Templates**: GET /api/{clients,sites,assets}/template.csv - downloadable CSV templates with example data
- **Import Endpoints**: POST /api/{clients,sites,assets}/import - accepts `{ csv: string }` body, max 500 rows per batch
- **Validation**: Per-row validation with error reporting (row number + message), client/site name matching (case-insensitive)
- **Client Limit Enforcement**: Client import checks tenant maxClients limit before importing
- **Audit**: All imported records emit domain events with `source: "csv_import"` metadata
- **UI**: Import dialog on Clients, Sites, and Assets pages with template download and file upload

### Ticketing System
- **Schema**: tickets (id, tenantId, title, description, status, priority, clientId, siteId, assetId, assignedToId, createdById, slaProfileId, slaResponseDeadline, slaResolutionDeadline, respondedAt, resolvedAt, closedAt, createdAt, updatedAt), ticketComments (id, tenantId, ticketId, userId, content, isInternal, createdAt, updatedAt)
- **SLA Profiles**: sla_profiles table with per-priority response/resolution minutes, default profile support
- **Routes**: server/modules/tickets/routes.ts - full CRUD for tickets/comments/SLA profiles
- **UI**: /tickets (list with filters), /tickets/:id (detail with inline edit, comments, SLA status indicators)
- **SLA Status**: breached (past deadline), at_risk (<1hr), on_track (>1hr), met (resolved before deadline)

### Dispatch Calendar
- **Schema**: appointments (id, tenantId, title, description, startTime, endTime, ticketId, clientId, siteId, assignedToId, createdById, createdAt, updatedAt)
- **Routes**: server/modules/calendar/routes.ts - CRUD with date range filtering
- **UI**: /calendar - weekly grid view with time slots, appointment blocks, create/edit dialogs

### Time Tracking
- **Schema**: time_entries (id, tenantId, ticketId, clientId, userId, description, minutes, billable, rateOverrideCents, date, invoiceId, createdAt, updatedAt)
- **Routes**: server/modules/time/routes.ts - CRUD with multi-filter support
- **UI**: /time - table view with filters, log time dialog, hours summary

### Invoicing System
- **Schema**: billing_configs (company info, rates, invoice prefix/numbering, payment terms), invoices (id, tenantId, clientId, invoiceNumber, status, dates, amounts, publicToken), invoice_line_items (description, quantity, unitPriceCents, totalCents, timeEntryId)
- **Invoice Status**: draft, sent, viewed, paid, partial, overdue, cancelled
- **Routes**: server/modules/invoicing/routes.ts - billing config, invoice CRUD, line items, send/mark-paid, public view
- **UI**: /invoices (list), /invoices/:id (detail with line items), /billing-settings (config)
- **Public View**: GET /api/public/invoices/:token - shareable invoice link

### Knowledge Base
- **Schema**: kb_articles (id, tenantId, title, slug, content, category, isPublished, authorId, createdAt, updatedAt)
- **Routes**: server/modules/kb/routes.ts - CRUD with category/search filtering
- **UI**: /kb (article list), /kb/:id (article detail/editor with publish toggle)

### Recurring Ticket Templates
- **Schema**: recurring_ticket_templates (id, tenantId, title, description, priority, clientId, siteId, assetId, assignedToId, cronExpression, enabled, lastGeneratedAt, nextRunAt, createdAt, updatedAt)
- **Routes**: server/modules/recurring/routes.ts - CRUD with cron scheduling
- **UI**: /recurring-tickets - template management with enable/disable toggle

### Client Portal Extensions
- **Portal Tickets**: GET/POST /api/portal/tickets, GET/POST /api/portal/tickets/:id/comments
- **Portal Invoices**: GET /api/portal/invoices, GET /api/portal/invoices/:id
- **UI**: /portal/tickets (submit tickets, view comments), /portal/invoices (view sent invoices)

### Dashboard Widgets
- **Stats**: Open tickets, overdue tickets, upcoming appointments, unpaid invoice total, unbilled time
- **Alerts**: Overdue ticket warning banner with SLA breach count

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Replit Auth (OIDC)**: Used for user authentication.
- **Express.js**: Backend web framework.
- **React**: Frontend library.
- **Vite**: Frontend build tool.
- **wouter**: Frontend router.
- **TanStack Query**: Data fetching and caching library for React.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **papaparse**: CSV parsing library (server-side, for bulk import).
- **Stripe**: Payment processing via Replit connector (not direct env vars).