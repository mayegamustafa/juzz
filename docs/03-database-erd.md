# 03 — Database Design & ERD

PostgreSQL 16, modeled in Prisma (`apps/api/prisma/schema.prisma` is the source of truth).
This document explains the model; the Prisma schema is authoritative.

## 1. Entity-relationship diagram

```
Organization 1───∞ School 1───∞ SchoolClass 1───∞ Stream
                     │                 │
                     │                 └────────────∞ Student ∞────────┐
                     │                                  │              │
                     │                                  │ enrolledIn   │
                     ├───∞ User (role-scoped)           │              │
                     │        │                         │              │
                     │        └── Teacher 1───∞ Assignment ∞── (Class/Stream/Student)
                     │                                  │
                     │                                  ▼
   Term 1───∞ Target │                         MemorizationRecord ∞─── Surah
        │            │                         RevisionRecord     ∞─── Surah
        │            │                         AssessmentRecord
        │            │                         MistakeRecord
        │            │                         AttendanceRecord
        ▼            │                         Remark
   (org/school/class scope)                    Notification
                                               AuditLog
   Surah (reference, 114 rows) ── grouped by Juz
```

Cardinality summary:
- Organization 1—∞ School 1—∞ SchoolClass 1—∞ Stream 1—∞ Student
- School 1—∞ Teacher; Teacher ∞—∞ (Class/Stream/Student) via **Assignment**
- Student 1—∞ MemorizationRecord ∞—1 Surah (unique per (student, surah))
- Student 1—∞ {Revision, Assessment, Mistake, Attendance, Remark}
- Term 1—∞ Target (scoped to org / school / class)
- User 1—1 Teacher (when role = TEACHER); User 1—∞ AuditLog

## 2. Enumerations

| Enum | Values |
|------|--------|
| `Role` | SUPER_ADMIN, SUPERVISOR, SCHOOL_ADMIN, TEACHER, STUDENT |
| `Gender` | MALE, FEMALE |
| `StudentStatus` | ACTIVE, INACTIVE, GRADUATED, TRANSFERRED |
| `Juz` | reference only — stored as int 1–30 on Surah |
| `AssessmentGrade` | EXCELLENT, VERY_GOOD, GOOD, FAIR, POOR |
| `MistakeType` | TAJWEED, MEMORIZATION, PRONUNCIATION |
| `AttendanceStatus` | PRESENT, ABSENT, SICK, PERMISSION |
| `TargetScope` | ORGANIZATION, SCHOOL, CLASS |
| `TargetUnit` | JUZ, SURAH, AYAH |

## 3. Table reference

### Organization
`id, name, code, createdAt, updatedAt` — single row for SAK; structure supports many.

### School
`id, organizationId(FK), code, name, location, isActive, createdAt, updatedAt`
- Indexes: `organizationId`, unique `(organizationId, code)`.
- `code` matches spreadsheet tabs (CPS, MEN, KIS, OK, WIN, NAK, KIT, KPS, KPM, FWAY, KIRA).

### SchoolClass  (a grade level, e.g. P.1)
`id, schoolId(FK), level (e.g. "P.1"), name, order, createdAt, updatedAt`
- Unique `(schoolId, level)`. `order` for sorting P.1→P.7.

### Stream  (optional subdivision)
`id, classId(FK), name, createdAt` — unique `(classId, name)`.

### User
`id, organizationId(FK), schoolId(FK, nullable), role(Role), fullName, email(unique),
phone, passwordHash, isActive, lastLoginAt, createdAt, updatedAt`
- `schoolId` null for SUPER_ADMIN/SUPERVISOR (org-wide); set for SCHOOL_ADMIN/TEACHER.
- Indexes: `email` unique, `schoolId`, `role`.

### RefreshToken
`id, userId(FK), tokenHash, expiresAt, revokedAt, createdAt` — rotation & revocation.

### Teacher  (Sheikh)
`id, userId(FK, nullable, unique), schoolId(FK), fullName, phone, isActive, createdAt`
- A teacher may exist before a login account is issued (nullable userId).
- Matches the "SHEIKH" column (NYOMBI, NAWIIRA, KAMBA, MUGABO, …).

### Student
`id, schoolId(FK), classId(FK), streamId(FK, nullable), admissionNo, fullName, gender,
guardianName, guardianPhone, enrollmentDate, status(StudentStatus), createdAt, updatedAt`
- Unique `(schoolId, admissionNo)`. Indexes: `schoolId`, `classId`, `streamId`.
- A student's primary Sheikh is via Assignment (or a denormalized `primaryTeacherId`).

### Assignment  (teacher ↔ scope)
`id, teacherId(FK), classId(FK, nullable), streamId(FK, nullable), studentId(FK, nullable),
termId(FK, nullable), createdAt`
- Flexible: assign a teacher to a whole class, a stream, or specific students.
- For V1 we also keep `Student.primaryTeacherId` for the simple 1-Sheikh-per-student case.

### Surah  (reference data, 114 rows, seeded)
`id, number(1–114, unique), nameArabic, nameTransliteration, ayahCount, juz(int 1–30),
revelationOrder(nullable)`
- Juzu ʿAmma = juz 30 (surahs 78–114); Juzu Tabāraka = juz 29 (surahs 67–77).
- Drives the surah grid columns and all roll-ups.

### MemorizationRecord  (the core "1" tick)
`id, studentId(FK), surahId(FK), fraction(decimal 0–1, default 1), memorizedAt(date),
recordedById(FK User), startAyah(nullable), endAyah(nullable), ayahCount(nullable),
note(nullable), createdAt, updatedAt`
- **Unique `(studentId, surahId)`** — one cell per student×surah, matching the sheet.
- `fraction` supports the partial values seen in the data (e.g. 0.5).
- Ayah fields are for the finer-grained future UI (FR-D3); null in V1 surah-tick mode.

### RevisionRecord  (schema-ready)
`id, studentId(FK), surahId(FK, nullable), juz(nullable), revisedAt(date),
performanceScore(0–100, nullable), recordedById(FK), note(nullable), createdAt`

### AssessmentRecord  (schema-ready)
`id, studentId(FK), assessedAt(date), grade(AssessmentGrade, nullable),
score(0–100, nullable), recordedById(FK), note(nullable), createdAt`

### MistakeRecord  (schema-ready)
`id, studentId(FK), surahId(FK, nullable), type(MistakeType), count(int),
occurredAt(date), recordedById(FK), note(nullable), createdAt`

### AttendanceRecord  (schema-ready)
`id, studentId(FK), date, status(AttendanceStatus), recordedById(FK), note(nullable)`
- Unique `(studentId, date)`.

### Remark
`id, studentId(FK), authorId(FK User), body(text), createdAt`
- Mirrors the "REMARK" column; many remarks over time per student.

### Term
`id, organizationId(FK), name (e.g. "Term 3 2025"), startDate, endDate, isActive, createdAt`

### Target
`id, termId(FK), scope(TargetScope), organizationId/ schoolId/ classId (one set per scope),
unit(TargetUnit), amount(decimal e.g. 2 = "2 Juzu"), description, createdAt`
- Progress % is computed (not stored) by comparing records against the target.

### Notification
`id, recipientId(FK User, nullable for broadcast), schoolId(FK, nullable), title, body,
type, readAt(nullable), createdAt`

### AuditLog
`id, actorId(FK User, nullable), action (CREATE/UPDATE/DELETE/LOGIN), entity, entityId,
diff(jsonb), ip, createdAt`
- Write-only from the app; indexes on `actorId`, `entity`, `createdAt`.

## 4. Derived/computed values (not stored)

- **Student progress %** = Σ `fraction` of memorized surahs in target scope ÷ surahs in target.
  For a "2 Juzu" target (juz 29+30 = 48 surahs, #67–114): `Σfraction / 48`.
- **Class/School progress** = average of student progress, or Σ memorized / (students×target).
- **GENERAL roll-up** = for each surah, COUNT(students with a MemorizationRecord) grouped by
  class and school — replaces the manual GENERAL tab.
- **Leaderboards** = rank students/classes/schools by progress %.

## 5. Key indexes

- `MemorizationRecord (studentId)`, `(surahId)`, unique `(studentId, surahId)`.
- `Student (schoolId, classId)`.
- `User (email)` unique, `(schoolId, role)`.
- `AuditLog (entity, entityId)`, `(createdAt)`.
- `Surah (number)` unique, `(juz)`.

## 6. Mapping from the existing spreadsheet

| Spreadsheet | QPMS |
|-------------|------|
| Tab (CPS, MENGO…) | `School` (one per tab) |
| Section header (P.1, P.2…) | `SchoolClass.level` |
| "SHEIKH" column | `Teacher` + `Student.primaryTeacherId` / Assignment |
| "NAME" column | `Student.fullName` |
| Surah-number columns (114…67) | `Surah` rows; a `1` → `MemorizationRecord` |
| `1` / `0.5` cell | `MemorizationRecord.fraction` |
| "REMARK" column | `Remark` |
| GENERAL tab counts | computed roll-up (FR-G1) |
| "2 JUZU SURAHS" tab | seeded `Surah` reference (juz 29 & 30) |
