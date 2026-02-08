# Shotgun Ninja Vault (SNV)

## Overview
Shotgun Ninja Vault (SNV) is a multi-tenant SaaS web application designed for IT professionals and Managed Service Providers (MSPs). Its primary purpose is to provide a secure platform for managing digital evidence, offering features such as role-based access control, comprehensive evidence file management, client and asset tracking, and detailed audit logging. The platform is built with a modular architecture to ensure scalability and extensibility, including a dedicated license server module. SNV aims to streamline digital evidence management workflows, enhance security, and provide robust reporting capabilities for compliance and operational efficiency.

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
- **Env Vars**: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_SOLO, STRIPE_PRICE_PRO, STRIPE_PRICE_MSP, APP_URL

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