# 02 — System Architecture

## 1. High-level topology

```
                        ┌──────────────────────────────┐
                        │           Clients            │
                        │                              │
   ┌───────────────┐    │  Web Admin / Teacher PWA     │   ┌────────────────────┐
   │  Browser (PWA)│◀──▶│  Next.js (App Router, TS)    │   │ Flutter app (later)│
   └───────────────┘    │  Tailwind + shadcn/ui        │◀─▶│ offline-first sync │
                        └──────────────┬───────────────┘   └─────────┬──────────┘
                                       │  HTTPS / REST (JWT)          │
                                       ▼                              │
                        ┌──────────────────────────────┐             │
                        │        Backend API           │◀────────────┘
                        │  NestJS (TypeScript)         │
                        │  ┌────────────────────────┐  │
                        │  │ Auth / RBAC guard       │  │
                        │  │ Modules: schools,       │  │
                        │  │  classes, students,     │  │
                        │  │  teachers, quran,       │  │
                        │  │  targets, reports,      │  │
                        │  │  attendance, audit,     │  │
                        │  │  notifications          │  │
                        │  └────────────────────────┘  │
                        │  Prisma ORM                  │
                        └───────┬───────────┬──────────┘
                                │           │
                ┌───────────────▼──┐    ┌───▼──────────────┐
                │  PostgreSQL 16   │    │ Redis (later)    │
                │  (primary store) │    │ cache / queues   │
                └──────────────────┘    └──────────────────┘
                                │
                       ┌────────▼─────────┐
                       │ S3-compatible    │  (later: report files, avatars, backups)
                       │ object storage   │
                       └──────────────────┘
```

## 2. Why this stack

- **One language (TypeScript)** across API and web → shared DTO/types, faster iteration,
  one hiring profile. Frontend is fixed as Next.js, so NestJS keeps the whole thing in TS.
- **NestJS** gives opinionated modular structure (modules/controllers/services/guards),
  first-class DI, validation pipes, and clean RBAC via guards + decorators.
- **Prisma** gives a typed schema-as-source-of-truth, migrations, and an ergonomic client.
- **PostgreSQL** for relational integrity, strong indexing, JSON where useful, mature ops.
- **Next.js App Router + shadcn/ui** for a fast, accessible, themeable admin & PWA.

## 3. Backend module map (NestJS)

```
apps/api/src/
├── main.ts                 # bootstrap, global pipes, CORS, helmet, rate-limit
├── app.module.ts
├── prisma/                 # PrismaModule + PrismaService (DB access)
├── common/
│   ├── decorators/         # @Roles, @CurrentUser, @Public
│   ├── guards/             # JwtAuthGuard, RolesGuard, TenantGuard
│   ├── interceptors/       # AuditInterceptor (writes audit log)
│   └── dto/                # pagination, common response shapes
├── auth/                   # login, refresh, JwtStrategy, password hashing
├── users/                  # user CRUD, role assignment
├── orgs/                   # organization
├── schools/                # schools CRUD
├── classes/                # classes + streams
├── students/               # students CRUD + bulk import
├── teachers/               # teachers + assignments
├── quran/                  # surah reference + memorization/revision/assessment records
├── targets/                # terms + targets + progress calc
├── attendance/             # attendance (schema-ready)
├── reports/                # roll-ups, exports
└── audit/                  # audit log read
```

## 4. Web app structure (Next.js)

```
apps/web/src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── schools/
│   │   ├── classes/
│   │   ├── students/[id]/
│   │   ├── teachers/
│   │   ├── tracking/        # the surah grid (core screen)
│   │   ├── targets/
│   │   ├── reports/
│   │   └── settings/
│   └── layout.tsx           # theme provider, fonts
├── components/ui/           # shadcn components
├── components/              # app components (SurahGrid, StudentTable, …)
├── lib/
│   ├── api.ts               # typed fetch client (attaches JWT, refresh on 401)
│   ├── auth.ts              # session handling
│   └── utils.ts
└── styles/
```

## 5. Security architecture

- **AuthN**: `POST /auth/login` → `{ accessToken (15m), refreshToken (7d) }`. Access token is
  a JWT (sub, role, schoolId, orgId). Refresh token rotated and stored hashed.
- **AuthZ**: global `JwtAuthGuard` (opt-out with `@Public`). `RolesGuard` reads `@Roles(...)`.
  `TenantGuard` injects the caller's `schoolId`/`orgId` scope into queries so a Sheikh or
  school admin can never read another school's rows. Supervisors/super-admins are org-scoped.
- **Passwords**: argon2id hashing. Never returned by the API.
- **Hardening**: helmet headers, CORS allowlist, `@nestjs/throttler` rate limiting,
  `class-validator` DTO validation, parameterized queries via Prisma (no raw SQL injection).
- **Audit**: `AuditInterceptor` records every non-GET request: actor, action, entity, ids,
  diff, IP, timestamp → `AuditLog` table.

## 6. Data isolation (multi-tenant)

Single database, **row-level tenant scoping** by `schoolId`/`organizationId` enforced in the
service layer via the authenticated user's scope. This is simpler to operate than
schema-per-tenant and fits one organization with many schools. Can evolve to RLS policies in
Postgres if stricter isolation is later required.

## 7. Offline strategy (mobile milestone)

Flutter app uses a local SQLite store (drift) mirroring the surah-grid subset. Mutations are
queued with client-generated UUIDs + timestamps. On reconnect, a `/sync` endpoint applies
changes idempotently (upsert by UUID) with last-write-wins per (student, surah) cell, and
returns server state. The web PWA gets read caching via service worker; full offline write is
the native app's job.

## 8. Environments & DevOps

- **Local**: `docker compose` for Postgres (+ Redis later). API and web run via npm.
- **Config**: `.env` per app (DATABASE_URL, JWT secrets, etc.); never committed.
- **CI (later)**: lint + typecheck + test + prisma validate on PR.
- **Deploy (later)**: API as container (Fly/Render/VPS), web on Vercel or same VPS,
  managed Postgres, nightly `pg_dump` to object storage.

## 9. Observability (later)

Structured request logging (pino), health endpoint `/health`, error tracking (Sentry-ready),
DB query metrics.
