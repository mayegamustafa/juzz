# QPMS Teacher — Flutter app

The field app for **Sheikhs / teachers and school administrators**. It is the recording
surface: mark surahs memorized, log revision, assessments, mistakes, remarks, and take
attendance — with or without a connection.

Administration (schools, users, targets, org-wide reports) stays on the **web admin panel**.
Supervisors and students are intentionally not allowed to sign in here.

---

## Running it

```bash
flutter pub get

# Android emulator talks to the host through 10.0.2.2 (the default).
flutter run

# Physical device / staging: point it at a reachable API.
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:4010/api
flutter run --dart-define=API_BASE_URL=https://api.qpms.example/api
```

Demo credentials (from the API seed): `nyombi@qpms.test` / `Password123!`

```bash
flutter analyze   # static analysis — must be clean
flutter test      # unit tests
```

## Building

No binaries are produced here; the project is prepared for CodeMagic.

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.qpms.example/api
flutter build ipa --release --dart-define=API_BASE_URL=https://api.qpms.example/api
```

Set `API_BASE_URL` as a CodeMagic environment variable and pass it through as a
`--dart-define`. Never bake a production URL into source.

---

## How offline mode works

This is the part that matters in a classroom with no signal.

1. **Hydration.** On sign-in the app calls `GET /sync/bootstrap` once and stores the whole
   working set (roster, classes, surahs, target) in SQLite. Every screen reads from that
   cache first, so the app opens instantly and works with the radio off.

2. **Writes always succeed.** Every mutation is written to a durable `outbox` table *before*
   anything is sent. The UI updates optimistically. The teacher never waits on the network
   and never loses a record.

3. **Draining.** `SyncService` replays the outbox oldest-first whenever the device is online,
   on connectivity restore, on app resume, and every 30s. Replaying in order means a later
   edit wins over an earlier one.

4. **Exactly-once.** Each queued op carries a UUID sent as an `Idempotency-Key` header. The
   API reserves that key *before* running the handler, so a retry after a lost response
   returns the original result instead of creating a duplicate. This is the difference
   between "we retry" and "we retry safely" — verified with 10 concurrent same-key requests
   producing exactly one record.

5. **Giving up correctly.** A `4xx` means the server rejected the op on its merits
   (validation, permission); retrying forever would be pointless, so it is dropped and logged.
   A network error keeps the op queued. A `409` means the server already has it.

The banner under the app bar always shows the truth: offline, syncing, queued count, or error.

### Not yet handled

Two devices editing the *same* student's *same* surah while both offline resolve
last-writer-wins on drain, with no merge prompt. Cell writes are upserts, so the data stays
consistent — but an earlier edit can be silently overwritten. Acceptable for one teacher per
roster; revisit if rosters are ever shared.

---

## Notifications

Server notifications surface as OS heads-up ("pop-up") notifications via
`flutter_local_notifications`. Delivery is poll-driven (60s) while the app runs, and on
resume. Already-shown ids are remembered so a notification pops exactly once.

**To add true push** (delivery when the app is closed): register an FCM device token and
call `NotificationService._show` from the `firebase_messaging` handler. The backend already
has a `NotificationChannel` interface — implement an FCM channel and register it in
`NotificationsModule`. No screen or repository code changes.

---

## Layout

```
lib/
  core/       config (API URL, intervals), Material 3 theme (emerald/gold, light+dark)
  models/     plain data models mirroring API payloads
  data/       api_client (JWT + single-flight refresh), token_store (keystore),
              local_db (cache + outbox), sync_service, notification_service, repository
  state/      Riverpod providers + auth controller
  ui/         splash, login, home shell, dashboard, students, student detail (5 tabs),
              attendance, notifications, settings, shared widgets
```

Tokens live in the platform keystore/keychain, never in plain preferences. Signing out wipes
the local cache and outbox so the next user cannot see the previous one's data.
