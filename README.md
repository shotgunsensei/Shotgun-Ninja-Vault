SHOTGUN NINJA VAULT

Shotgun Ninja Vault (SNV) is a multi-tenant, security-first evidence and licensing platform designed for IT professionals, MSPs, developers, and digital creators who need verifiable proof, controlled access, and auditable history without enterprise bloat.

Built to run entirely on Replit, SNV combines an Evidence Locker with a Creator License Server, forming the foundation of a modular SaaS platform under the Shotgun Ninjas Productions umbrella.

---

WHAT PROBLEM DOES THIS SOLVE?

Modern technical work fails in three predictable ways:

1. No proof – Work is done, but not defensible or auditable.
2. No control – Files, logs, and assets sprawl across drives, chats, and emails.
3. No monetization guardrails – Digital products are easy to copy and hard to protect.

Shotgun Ninja Vault fixes all three.

---

CORE FEATURES

EVIDENCE LOCKER (MODULE 1)

A secure, tenant-isolated vault for technical proof and documentation.

* Multi-tenant architecture (organizations, clients, assets)
* Evidence uploads (screenshots, logs, PDFs, exports)
* Tagging and full-text search
* Asset and client association
* Role-based access control:

  * OWNER / ADMIN – full control
  * TECH – upload and manage evidence
  * CLIENT – view-only or restricted upload
* Immutable audit logs
* Secure local file storage with cloud-ready abstraction

Use cases:

* MSP compliance evidence
* Incident response documentation
* Cyber insurance proof
* Internal IT change tracking
* Client-facing transparency portals

---

LICENSE SERVER (MODULE 2)

A creator-focused license and entitlement system.

* Product definitions
* Secure license key issuance (hashed at rest)
* Activation limits and expiration
* Device fingerprint tracking
* Public license validation API
* Key revocation with audit trail
* Developer-friendly usage examples

Use cases:

* Prompt packs
* SaaS feature gating
* Desktop or CLI tool licensing
* Digital downloads and templates

---

ARCHITECTURE OVERVIEW

* Frontend: Next.js (App Router) with TypeScript
* Backend: Next.js route handlers and server actions
* Database: PostgreSQL via Prisma ORM
* Authentication: Replit Auth (OIDC) with optional development bypass
* Storage: Local filesystem abstraction (cloud-ready)
* Styling: Tailwind CSS
* Validation: Zod
* Deployment: Replit Autoscale, Reserved VM, and Scheduled jobs

All data is tenant-scoped by design. Cross-tenant access is structurally impossible.

---

DEVELOPMENT PHILOSOPHY

* Security is structural, not optional
* Auditability beats convenience
* Modules over monoliths
* SaaS should scale down before it scales up
* If it cannot be proven, it did not happen

---

GETTING STARTED (REPLIT)

1. Clone or import the repository
2. Install dependencies using npm install
3. Configure environment variables in Replit Secrets

Required variables:

DATABASE_URL
REPLIT_AUTH_ENABLED
REPLIT_AUTH_ISSUER_URL
REPLIT_AUTH_CLIENT_ID
REPLIT_AUTH_CLIENT_SECRET
NEXTAUTH_SECRET
DEV_AUTH_BYPASS
MAX_UPLOAD_MB

During early development, DEV_AUTH_BYPASS can be set to true to enable a local role selector.

4. Initialize the database using Prisma migrations
5. Run the development server using npm run dev

---

MODULE SYSTEM

Shotgun Ninja Vault is module-driven.

Current modules:

* core – authentication, tenants, roles, audit logs, billing stubs
* evidence – Evidence Locker
* license – License Server

Planned modules:

* Status pages
* Compliance report builder
* MSP client portal bundles
* API-only mode

---

SECURITY NOTES

* All data is tenant-scoped at the query layer
* Role checks enforced server-side
* File uploads validated by type, size, and hash
* No plaintext license keys stored
* Audit logs are append-only

The platform is designed to be defensible in front of auditors, insurers, and clients.

---

WHO THIS IS FOR

* Managed Service Providers (MSPs)
* Internal IT teams
* Security consultants
* SaaS builders
* Digital product creators
* Anyone tired of undocumented or unverifiable work

---

ABOUT SHOTGUN NINJAS PRODUCTIONS

Shotgun Ninjas Productions builds tools for builders at the intersection of technology, security, and creativity.

If it matters, lock it.
If you build it, prove it.

---

LICENSE

Released under the MIT License unless otherwise specified.

---

STATUS

Active development
Pre-public SaaS build
Replit-native deployment
Portfolio flagship project
