# QPMS — Quran Progress & Memorization Management System

A multi-school system to digitally replace manual Quran progress spreadsheets and give
teachers (Shuyukh), supervisors and administrators real-time visibility into student
memorization (hifdh) progress.

Grounded in the real workflow of **SAK QURAN TARGETS** (11 schools, tracking memorized
surahs per student across Juzu ʿAmma & Juzu Tabāraka, assigned per Sheikh).

## Repository layout (monorepo)

```
qpms/
├── docs/                 # Design & engineering documentation (read these first)
│   ├── 01-requirements.md     # Functional + non-functional requirements, user stories
│   ├── 02-architecture.md     # System architecture, stack, deployment topology
│   ├── 03-database-erd.md     # Data model, ERD, table reference
│   ├── 04-api-spec.md         # REST API surface
│   ├── 05-wireframes.md       # Screen wireframes (web admin + mobile)
│   ├── 06-roadmap.md          # Milestone-by-milestone delivery plan
│   └── 07-audit-report.md     # System audit: findings, fixes, open gaps
├── apps/
│   ├── api/              # NestJS + Prisma backend (PostgreSQL)
│   ├── web/              # Next.js admin panel (super admin, supervisor, school admin)
│   └── mobile/           # Flutter teacher/sheikh app — offline-first
└── codemagic.yaml        # CI for the Flutter app (Android + iOS)
```

## Who uses what

| Surface | Users | Purpose |
|---|---|---|
| **Web admin** | Super Admin, Supervisor, School Admin | Schools, teachers, students, targets, reports, analytics, announcements |
| **Mobile app** | Sheikh / Teacher, School Admin | Daily recording: memorization, revision, assessment, mistakes, remarks, attendance — works offline |

Parent and student portals, and audio recitation uploads, are intentionally **out of scope**
for now: students recite to the teacher, who assesses in person.

## Stack

| Layer        | Technology |
|--------------|------------|
| Backend API  | NestJS (TypeScript), Prisma ORM, JWT + refresh rotation, RBAC, audit log |
| Database     | PostgreSQL 16 |
| Web / Admin  | Next.js (App Router), TypeScript, TailwindCSS |
| Mobile       | Flutter (Material 3), Riverpod, SQLite outbox, offline-first |
| Reports      | Server-side PDF (pdfkit) + Excel (exceljs), branded |
| Notifications| In-app + OS pop-ups; pluggable channel interface (FCM/email/SMS ready) |

## Quick start

```bash
# 1. Start Postgres
docker compose up -d db

# 2. Backend  (http://localhost:4010/api)
cd apps/api && npm install && cp .env.example .env
npx prisma migrate dev && npm run seed && npm run start:dev

# 3. Web admin  (http://localhost:3000)
cd apps/web && npm install && cp .env.example .env.local && npm run dev

# 4. Teacher app
cd apps/mobile && flutter pub get && flutter run
```

Seeded demo accounts (password `Password123!`):
`superadmin@qpms.test` · `supervisor@qpms.test` · `admin.cps@qpms.test` · `nyombi@qpms.test` (teacher)

## Offline-first, safely

The mobile app writes every mutation to a durable outbox *before* sending, so a teacher with
no signal records exactly as they would online. Each queued operation carries a UUID sent as
an `Idempotency-Key`; the API reserves that key before running the handler, so a retry after
a lost response returns the original result rather than duplicating a record. Verified: 10
concurrent same-key requests produce exactly one record.

See [apps/mobile/README.md](apps/mobile/README.md) for the full sync model.

## Theme

Islamic-professional: **Emerald green** primary, **gold** secondary, white accent.
Material 3, light & dark mode, SVG icon system (no emoji).
