# 04 — API Specification

Base URL: `/api` · Format: JSON · Auth: `Authorization: Bearer <accessToken>` unless `@Public`.
All list endpoints support `?page=&pageSize=&q=&sort=` and return
`{ data: [...], meta: { page, pageSize, total } }`.

Roles abbreviations: SA=Super Admin, SUP=Supervisor, ADM=School Admin, T=Teacher.

## Auth
| Method | Path | Roles | Body / Notes |
|--------|------|-------|--------------|
| POST | `/auth/login` | public | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | public | `{ refreshToken }` → new token pair (rotated) |
| POST | `/auth/logout` | any | revokes refresh token |
| GET  | `/auth/me` | any | current user + scope |
| POST | `/auth/change-password` | any | `{ currentPassword, newPassword }` |

## Users
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/users` | SA, ADM | scoped to school for ADM |
| POST | `/users` | SA, ADM | create user (role-limited: ADM may create TEACHER) |
| PATCH | `/users/:id` | SA, ADM | update / deactivate |
| DELETE | `/users/:id` | SA | soft-delete |

## Organization & Schools
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/org` | SA, SUP | the organization |
| GET | `/schools` | SA, SUP, ADM | ADM sees own school only |
| POST | `/schools` | SA | |
| GET | `/schools/:id` | SA, SUP, ADM | |
| PATCH | `/schools/:id` | SA, ADM | |
| DELETE | `/schools/:id` | SA | |

## Classes & Streams
| Method | Path | Roles |
|--------|------|-------|
| GET | `/schools/:schoolId/classes` | SA, SUP, ADM, T |
| POST | `/schools/:schoolId/classes` | SA, ADM |
| PATCH | `/classes/:id` | SA, ADM |
| DELETE | `/classes/:id` | SA, ADM |
| GET/POST | `/classes/:classId/streams` | SA, ADM |

## Teachers
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/teachers` | SA, SUP, ADM | school-scoped |
| POST | `/teachers` | SA, ADM | optionally create linked user |
| PATCH | `/teachers/:id` | SA, ADM | |
| POST | `/teachers/:id/assignments` | SA, ADM | assign to class/stream/students |
| GET | `/teachers/:id/students` | SA, ADM, T(self) | assigned students |

## Students
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/students` | SA, SUP, ADM, T | T sees only assigned; filters: schoolId, classId, streamId, teacherId |
| POST | `/students` | SA, ADM | |
| GET | `/students/:id` | SA, SUP, ADM, T(assigned) | profile + progress summary |
| PATCH | `/students/:id` | SA, ADM | |
| DELETE | `/students/:id` | SA, ADM | soft-delete |
| POST | `/students/import` | SA, ADM | multipart Excel/CSV bulk import |
| GET | `/students/:id/progress` | SA, SUP, ADM, T(assigned) | memorized surahs + % vs target |

## Quran — reference & records
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/surahs` | any | 114 surahs; `?juz=29,30` for the 2-Juzu set |
| GET | `/quran/grid?classId=&streamId=&juz=29,30` | SA,SUP,ADM,T | **the surah grid**: students × surahs matrix of memorized cells |
| PUT | `/quran/memorization` | ADM, T(assigned) | upsert one cell `{ studentId, surahId, fraction?, memorizedAt? }` (fraction 0 deletes) |
| POST | `/quran/memorization/bulk` | ADM, T | array upsert for offline sync |
| GET | `/students/:id/memorization` | SA,SUP,ADM,T(assigned) | list records |
| POST | `/quran/revision` | ADM, T | revision record (schema-ready) |
| POST | `/quran/assessment` | ADM, T | assessment record |
| POST | `/quran/mistakes` | ADM, T | mistake record |

## Remarks
| Method | Path | Roles |
|--------|------|-------|
| GET | `/students/:id/remarks` | SA,SUP,ADM,T(assigned) |
| POST | `/students/:id/remarks` | ADM, T(assigned) |

## Terms & Targets
| Method | Path | Roles |
|--------|------|-------|
| GET/POST | `/terms` | GET: any · POST: SA |
| PATCH | `/terms/:id` | SA |
| GET/POST | `/targets` | GET: any · POST: SA |
| GET | `/targets/progress?targetId=&scopeId=` | SA,SUP,ADM | computed actual vs target |

## Attendance (schema-ready)
| Method | Path | Roles |
|--------|------|-------|
| GET | `/attendance?classId=&date=` | SA,SUP,ADM,T |
| PUT | `/attendance` | ADM,T | upsert `{ studentId, date, status }` |

## Reports & Analytics
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/reports/general?schoolId=&classId=&juz=` | SA,SUP,ADM | the GENERAL roll-up (count per surah) |
| GET | `/reports/student/:id` | SA,SUP,ADM,T | JSON; `?format=pdf|xlsx` to export |
| GET | `/reports/class/:classId` | SA,SUP,ADM,T | |
| GET | `/reports/school/:schoolId` | SA,SUP,ADM | |
| GET | `/reports/organization` | SA,SUP | |
| GET | `/analytics/dashboard` | role-scoped | KPIs for the dashboard |
| GET | `/leaderboards?type=students|classes|schools` | SA,SUP,ADM | rankings |

## Notifications
| Method | Path | Roles |
|--------|------|-------|
| GET | `/notifications` | any |
| POST | `/notifications/read/:id` | any |
| POST | `/notifications/broadcast` | SA, ADM |

## Audit
| Method | Path | Roles |
|--------|------|-------|
| GET | `/audit?entity=&actorId=&from=&to=` | SA |

## Sync (mobile milestone)
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | `/sync` | T,ADM | `{ since, changes: [...] }` → applies idempotent upserts, returns server delta |

## Errors
Standard shape: `{ statusCode, message, error }`. Validation → 400 with field details.
Auth → 401; forbidden scope/role → 403; not found → 404; conflict (unique) → 409.

## Response example — surah grid
```json
GET /api/quran/grid?classId=...&juz=29,30
{
  "surahs": [ { "id":"...", "number":114, "nameTransliteration":"An-Nas", "juz":30 }, ... ],
  "students": [
    { "id":"...", "fullName":"KYAGULANYI REHAN", "teacher":"NYOMBI",
      "cells": { "<surahId114>": 1, "<surahId113>": 1, "<surahId112>": 0.5 },
      "progress": { "memorized": 9, "target": 48, "percent": 18.75 } }
  ]
}
```
