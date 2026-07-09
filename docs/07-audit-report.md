# 07 — System Audit Report

**Date:** 2026-07-09 · **Auditor:** engineering session (live probes against running system)
**Scope:** API (NestJS + Prisma/PostgreSQL), Web admin (Next.js), database, auth, RBAC, exports, notifications.

Verdict up front: the core platform is sound — global auth guard chain, argon2 hashing,
refresh-token rotation, audit trail, tenant scoping on all *write* paths. The audit found one
real security defect (cross-tenant **read** leak on five record endpoints), one hardening gap
(no per-route login throttle), and a set of robustness/UX gaps. All confirmed defects were
fixed and re-verified live in this session.

---

## 1. Findings & fixes (verified live)

### F-1 · HIGH · Cross-tenant read leak — FIXED ✅
Five GET endpoints returned another school's data to any authenticated user who knew a
student ID (IDOR):

| Endpoint | Before | After |
|---|---|---|
| `GET /students/:id/revisions` | 200 ❌ | 403 ✅ |
| `GET /students/:id/assessments` | 200 ❌ | 403 ✅ |
| `GET /students/:id/mistakes` | 200 ❌ | 403 ✅ |
| `GET /students/:id/remarks` | 200 ❌ | 403 ✅ |
| `GET /attendance/student/:id` | 200 ❌ | 403 ✅ |

Root cause: list methods took only `studentId`; writes used `assertCanWrite` but reads had no
counterpart. Fix: `assertCanRead` (org-wide roles → same organization; school roles → same
school) added to `QuranService` and `AttendanceService`; controllers now pass the caller.
Re-probed: cross-school 403, same-school 200, unauthenticated 401.

### F-2 · MEDIUM · Brute-force window on login — FIXED ✅
Only the global limit (120 req/min) applied to `POST /auth/login`. Now `@Throttle` 10/min on
login, 30/min on refresh. Verified: 12 bad logins → 429.

### F-3 · Verified-good (no change needed)
- Guard chain: Throttler → JWT → Roles, applied globally; `@Public` only on login/refresh.
- Tenant scoping correct on: student detail/list, student report, quran grid (foreign classId
  → 0 rows), schools list (school admin sees 1), classes of foreign school → 403,
  all write endpoints (403 cross-school), teacher roster restriction on writes.
- Refresh tokens: hashed at rest, rotated on use, revoked on logout.
- Audit trail: mutations recorded (verified rows for auth + students).
- Validation: global `ValidationPipe` whitelist+transform; DTOs on all mutating routes.
- Helmet, CORS allow-list, argon2 password hashing.

### F-4 · Build-tooling defect — FIXED (earlier this project) ✅
`tsc --incremental` + `deleteOutDir` made `nest build` silently emit nothing when
`tsconfig.tsbuildinfo` was stale. `incremental` disabled.

---

## 2. Known gaps (open, prioritized)

| # | Gap | Severity | Notes |
|---|---|---|---|
| G-1 | Web fetches often lack `.catch` → silent empty states | Med | Add error boundaries + toast pattern |
| G-2 | No automated tests (unit/e2e) | Med | The live probes above should become a Jest e2e suite |
| G-3 | Global search (students/teachers/schools) missing | Med | Spec feature; students-only search exists |
| G-4 | Notification channels: in-app only | Low | Channel interface ready; FCM/email/SMS adapters pending |
| G-5 | Excel/CSV bulk student import | Med | Manual entry only today |
| G-6 | Flutter mobile app not started | High | Biggest remaining deliverable |
| G-7 | Historical/term-versioned targets UI is minimal | Low | Schema supports terms+targets |
| G-8 | No CI pipeline / deployment hardening docs | Med | Milestone 9 |
| G-9 | Password policy not enforced beyond length | Low | Add complexity + reuse checks |
| G-10 | Attendance day-sheet scope check skipped when class empty | Info | Harmless (returns []), tidy later |

## 3. Phased plan toward the full vision

The expanded brief (parent/student portals, configurable hierarchy, audio recitation uploads,
spaced-repetition muraja'ah, certificates, QR verification, multi-language, offline Flutter
apps for five roles, dynamic theming, feature toggles) is a multi-release roadmap, not one
pass. Recommended order, each phase shippable:

1. **P1 — Hardening (in progress):** fix F-1/F-2 ✅, error-state UX (G-1), e2e test suite (G-2),
   bulk import (G-5), global search (G-3).
2. **P2 — Teacher mobile (Flutter):** login, roster, tracking grid, attendance, offline queue
   + sync endpoint. Single app, role-aware, prepared for CodeMagic builds.
3. **P3 — Engagement:** email/push channels (G-4), achievements/certificates, leaderboard
   expansion, report branding polish (logos/QR/signatures).
4. **P4 — Portals & configurability:** parent/student portals, configurable hierarchy +
   permissions matrix, dynamic theming, feature toggles, multi-language scaffolding.
5. **P5 — Operations:** CI, backups/restore drills, monitoring, deployment guide, security
   re-audit.

## 4. Feature delivery log (this session)

- Notifications module: in-app fan-out broadcast (per-recipient read state), unread count,
  mark-read/all, RBAC (teacher broadcast → 403), pluggable channel interface, web bell with
  live badge + announcement composer.
- Reports: server-side branded PDF + Excel exports (GENERAL roll-up, full student report),
  authenticated browser downloads.
- UI: full SVG icon system (no emojis), leaderboard on dashboard.
- Daily recording: revision / assessment / mistakes / attendance modules + UIs.
