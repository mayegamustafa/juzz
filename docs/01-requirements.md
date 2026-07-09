# 01 — Requirements Analysis

> Quran Progress & Memorization Management System (QPMS)

## 1. Problem statement

Across ~11 Islamic schools, Quran memorization (hifdh) progress is tracked in a single
shared Excel workbook (`SAK QURAN TARGETS`). Each school has a tab; within it students are
grouped by class (P.1–P.7) and assigned to a Sheikh; each memorized surah is marked with a
`1` across columns for Juzu ʿAmma (surahs 114→78) and Juzu Tabāraka (77→67). A GENERAL tab
manually rolls up how many students reached each surah.

**Pain points:** no real-time access, error-prone manual roll-ups, no per-student history,
no offline field entry, no analytics, no access control, single point of failure (one file).

**Goal:** a multi-school web (PWA) + later mobile system that mirrors this workflow exactly,
removes the manual roll-up, and adds history, roles, reporting and analytics.

## 2. Domain glossary

| Term | Meaning |
|------|---------|
| Organization | The umbrella body owning all schools. |
| School | A physical school (CPS, Mengo, Kisaasi, …). |
| Class | A grade level within a school (P.1 … P.7). |
| Stream | Optional subdivision of a class (e.g. P.4 East/West). |
| Sheikh / Teacher | Quran teacher assigned to students. |
| Supervisor | Org-level monitor across all schools (read + report). |
| Surah | One of 114 chapters of the Quran. |
| Juzu (Juz) | One of 30 parts. Juzu ʿAmma = #30 (surahs 78–114); Juzu Tabāraka = #29 (surahs 67–77). |
| Ayah | A verse within a surah. |
| Target | Memorization goal for a term (e.g. "2 Juzu"). |
| Memorization record | Evidence a student has memorized (a surah, or an ayah range). |
| Revision (Murajaʿah) | Re-reciting previously memorized material. |

## 3. Actors / roles

1. **Super Admin** — full control of org, schools, users, targets, terms, settings, backups.
2. **Organization Supervisor** — read-only across all schools + reports, rankings, comparisons.
3. **School Administrator** — manages teachers/classes/students within their school; school reports.
4. **Sheikh / Teacher** — records progress/revision/attendance/remarks for assigned students only.
5. **Student/Guardian** (future) — read-only view of own progress and targets.

## 4. Functional requirements

### FR-A Authentication & accounts
- FR-A1 Email/phone + password login, JWT access token + refresh token rotation.
- FR-A2 Role-based access control (RBAC) enforced server-side on every endpoint.
- FR-A3 Password reset; admin-driven user creation & deactivation.
- FR-A4 Every mutating action recorded in an audit log (actor, entity, before/after, time).

### FR-B Organization & school structure
- FR-B1 Manage Organization (one, extensible to many).
- FR-B2 CRUD Schools (code, name, location, status).
- FR-B3 CRUD Classes (level P.1–P.7) and optional Streams per school.
- FR-B4 CRUD academic Terms (e.g. "Term 3 2025", start/end dates, active flag).

### FR-C People
- FR-C1 CRUD Teachers (Sheikhs); link a teacher user account to a school.
- FR-C2 Assign teachers to classes/streams/students.
- FR-C3 CRUD Students with profile: admission no., full name, gender, class, stream,
  school, guardian name, guardian phone, enrollment date, status.
- FR-C4 Bulk import students from Excel/CSV (to migrate the existing workbook).

### FR-D Quran tracking (core)
- FR-D1 Reference data: all 114 surahs (number, Arabic+transliterated name, ayah count, juz).
- FR-D2 Record a surah as **memorized** for a student (the "1" tick), with optional partial
  (0–1 fraction) and date — mirrors current sheet exactly.
- FR-D3 (Schema-ready, later UI) Memorization by **ayah range** (surah, start ayah, end ayah,
  count, date) for finer granularity.
- FR-D4 (Schema-ready) Revision records: surah/juz revised, date, performance score.
- FR-D5 (Schema-ready) Daily assessment: grade (Excellent…Poor) or 0–100 score.
- FR-D6 (Schema-ready) Mistake tracking: tajweed / memorization / pronunciation counts.
- FR-D7 Free-text teacher remarks per student (and per record).
- FR-D8 A student's surah grid: visual checklist of Juzu ʿAmma + Tabāraka (extensible to 30 juz).

### FR-E Targets & progress
- FR-E1 Define targets per term at org/school/class level (e.g. "memorize 2 Juzu").
- FR-E2 Auto-calculate actual progress vs target and % achieved per student/class/school.
- FR-E3 Surah/juz completion percentage derived from memorization records.

### FR-F Attendance (schema-ready, later UI)
- FR-F1 Daily attendance per student: Present / Absent / Sick / Permission.
- FR-F2 Attendance reports per student/class/term.

### FR-G Reporting & analytics
- FR-G1 Roll-up equivalent to the GENERAL tab: per class/school, count of students who
  reached each surah, with enrollment and totals — generated automatically.
- FR-G2 Reports: Student, Class, Teacher, School, Organization.
- FR-G3 Export PDF & Excel; printable views.
- FR-G4 Dashboards: student/class/teacher/school analytics, trends.
- FR-G5 Leaderboards: top students, classes, teachers, schools.

### FR-H Notifications (architecture-ready)
- FR-H1 In-app notifications; pluggable channels (push, email, SMS) behind one interface.
- FR-H2 Target/progress reminders, achievement alerts, admin announcements.

### FR-I Offline (mobile milestone)
- FR-I1 Teachers record offline; local store; auto-sync with conflict resolution on reconnect.

### FR-J Search
- FR-J1 Global scoped search: students, teachers, schools, classes, progress.

## 5. Non-functional requirements

- **NFR-Security**: hashed passwords (argon2/bcrypt), JWT + refresh rotation, RBAC, rate
  limiting, input validation, audit trails, per-school data isolation (tenant scoping).
- **NFR-Performance**: list endpoints paginated; surah grid loads < 500 ms for a class;
  indexes on all FKs and hot query paths.
- **NFR-Availability**: stateless API (horizontal scale); daily DB backups.
- **NFR-Usability**: mobile-first responsive PWA; works on low-end Android phone browsers;
  light & dark mode; Islamic-professional theme (emerald/gold).
- **NFR-Localization-ready**: surah names in Arabic + transliteration; i18n-ready strings.
- **NFR-Maintainability**: TypeScript end-to-end; modular Nest modules; typed API client.
- **NFR-Auditability**: immutable audit log of all mutations.
- **NFR-Data integrity**: unique (student, surah) memorization; referential integrity via FKs.

## 6. User stories (selected, by role)

**Sheikh**
- As a Sheikh, I open my class and see a grid of students × surahs so I can tick what each
  student has memorized today, even on my phone.
- As a Sheikh, I add a remark like "Needs more revision on Juzu 12" to a student.
- As a Sheikh, I see each student's % of the 2-Juzu target completed.

**School Administrator**
- As a school admin, I add a new student and assign them to a class and a Sheikh.
- As a school admin, I import last term's students from our Excel file.
- As a school admin, I print a class report for parents' day.

**Supervisor**
- As a supervisor, I compare completion rates across all schools and see the ranking.
- As a supervisor, I view the auto-generated GENERAL roll-up for any class.

**Super Admin**
- As a super admin, I create the "Term 3 2025" term and set a "2 Juzu" target.
- As a super admin, I review the audit log to see who changed a record.

## 7. Acceptance criteria for V1 (this milestone)

1. A Sheikh can log in, see only their assigned students, and tick/untick memorized surahs.
2. A school admin can CRUD schools/classes/students/teachers and assign teachers.
3. The surah grid matches the spreadsheet semantics (1 = memorized) for Juzu ʿAmma+Tabāraka.
4. Per-student, per-class and per-school progress % is auto-calculated.
5. The GENERAL roll-up report is generated automatically (no manual counting).
6. RBAC prevents a Sheikh from one school seeing another school's data.
7. All mutations are written to the audit log.
8. The UI is usable on a phone browser, in light and dark mode.
