# 06 — Development Roadmap

Incremental delivery. Each milestone ends with something runnable and reviewable.
✅ = built in this session · ⏳ = planned.

## Milestone 0 — Design ✅
- Requirements, architecture, ERD, API spec, wireframes, roadmap (this `docs/` folder).

## Milestone 1 — Foundation & data model ✅ / ⏳
- ✅ Monorepo + `docker-compose` Postgres.
- ✅ Prisma schema for the full domain (people, quran, targets, audit) + migration.
- ✅ Seed: 114 surahs (juz tagged), the 11 schools, P.1–P.7 classes, demo teachers/students,
  one Term + a "2 Juzu" target, demo users per role.
- ✅ NestJS bootstrap: config, validation, helmet, throttler, Prisma module, health.

## Milestone 2 — Auth & RBAC ✅
- ✅ Login / refresh / me / change-password; argon2 hashing; JWT + refresh rotation.
- ✅ `JwtAuthGuard`, `RolesGuard`, tenant scoping helper; `@Public`, `@Roles`, `@CurrentUser`.
- ✅ Audit interceptor → `AuditLog`.

## Milestone 3 — Core CRUD ✅
- ✅ Schools, classes/streams, teachers (+assignments), students (CRUD + progress summary).
- ⏳ Student bulk import from Excel/CSV (endpoint stub + parser).

## Milestone 4 — Quran tracking (core) ✅
- ✅ Surah reference endpoint; **grid** endpoint (students × surahs); cell upsert; bulk upsert.
- ✅ Remarks; per-student memorization list & progress %.
- ✅ Revision / assessment / mistakes endpoints + UIs (student-profile tabs).
- ✅ Attendance module (class day-sheet, per-student upsert, history) + Attendance screen.

## Milestone 5 — Web admin (Next.js) ✅
- ✅ Auth flow, themed layout (emerald/gold, light/dark), dashboard.
- ✅ Students list/profile, schools/classes/teachers management.
- ✅ **Tracking grid** screen wired to the API.
- ✅ Reports center incl. GENERAL roll-up; targets.
- ✅ PDF/XLSX export (server-side, branded); SVG icon set (no emojis).

## Milestone 6 — Reports & analytics ✅ / ⏳
- ✅ GENERAL roll-up export (PDF + Excel, branded, server-streamed with auth).
- ✅ Student report export (PDF + multi-sheet Excel: summary, memorization, revision, assessment, attendance).
- ✅ Dashboard KPIs + per-school progress + Top-students leaderboard wired in.
- ⏳ Trend charts over time, teacher/class comparison reports.

## Milestone 7 — Notifications ✅ / ⏳
- ✅ In-app notifications: per-recipient fan-out broadcast, unread count, mark read/read-all, RBAC.
- ✅ Pluggable `NotificationChannel` interface (log adapter shipped; FCM/email/SMS drop in).
- ✅ Web: topbar bell with live unread badge + announcement composer for admins.
- ✅ Mobile: OS heads-up ("pop-up") notifications via `flutter_local_notifications`, poll-driven.
- ⏳ True push when the app is closed (FCM device tokens + FCM channel).

## Milestone 8 — Mobile (Flutter) ✅ / ⏳
- ✅ `apps/mobile` — role-aware **teacher/sheikh app** (teachers + school admins only).
- ✅ Login (JWT + single-flight refresh), tokens in platform keystore.
- ✅ Screens: splash, login, dashboard, students, student detail (memorization grid, revision,
  assessment, mistakes, remarks), attendance day-sheet, notifications, settings.
- ✅ **Offline-first**: `GET /sync/bootstrap` hydration → SQLite cache; durable outbox for all
  writes; drain on reconnect/resume/interval; `Idempotency-Key` gives exactly-once replay.
- ✅ Material 3 emerald/gold theme, light + dark, skeletons, empty/error/offline states.
- ✅ `flutter analyze` clean, 7 unit tests pass, release compile verified. `codemagic.yaml` added.
- ⏳ Conflict UI for concurrent offline edits (currently last-writer-wins on upserts).

## Milestone 9 — Hardening & DevOps ⏳
- ✅ Idempotency table + interceptor (verified: 10 concurrent same-key requests → 1 record).
- ✅ Login/refresh rate limits; cross-tenant read leak closed (see `07-audit-report.md`).
- ⏳ API e2e test suite, CI pipeline, structured logging, backups, deployment guide.

## Out of scope (for now, by decision)
Parent & student portals/apps, audio recitation uploads. Students recite to the teacher, who
assesses in person — so the assessment flow is the record. Revisit later if needed.

---

## How to run what exists now
```bash
# from repo root
docker compose up -d db                 # Postgres on :5432
cd apps/api
cp .env.example .env                     # set DATABASE_URL + JWT secrets
npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev                        # API on :4000

# new terminal
cd apps/web
cp .env.example .env.local               # NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm install
npm run dev                              # web on :3000
```
Demo logins are printed by the seed script (super admin, supervisor, school admin, teacher).
