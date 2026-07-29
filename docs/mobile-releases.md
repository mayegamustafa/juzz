# Mobile releases: building and auto-updating the teacher app

The teacher app is distributed as a sideloaded APK, not through the Play Store.
This document covers how a build reaches a Sheikh's phone and updates itself
without anyone uninstalling anything.

## Why updates work without uninstalling

Android replaces an installed app in place, keeping its data and login, only
when **both** of these hold:

1. **The signing key is identical.** A different key makes Android treat the APK
   as a different, conflicting app: the install fails with "App not installed"
   and the only way forward is uninstalling, which wipes the Sheikh's offline
   records. This is why the keystore is created once and never regenerated.
2. **The `versionCode` is strictly greater** than the installed one. Android
   silently refuses to "downgrade" or reinstall the same versionCode.

Everything below exists to guarantee those two properties on every build.

## One-time setup

### 1. Create the release keystore

Run this once, on a machine you control, and keep the output safe forever.
Losing it means no existing install can ever be updated again.

```bash
keytool -genkey -v -keystore juzz-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias juzz
```

Back the `.jks` file and its passwords up somewhere durable (not only this
laptop). It is gitignored and must never be committed.

### 2. Upload it to Codemagic

Codemagic > Teams / App settings > **Code signing identities** > Android
keystores. Upload `juzz-release.jks` and set:

- Reference name: `juzz_keystore` (matches `codemagic.yaml`)
- Keystore password, key alias (`juzz`), key password

`codemagic.yaml` references it under `environment.android_signing`, and the
Gradle config in `apps/mobile/android/app/build.gradle.kts` picks it up through
the generated `key.properties`. When that file is absent (a local build), Gradle
falls back to the debug key, so local `flutter run --release` still works.

### 3. Create the environment variable groups

Codemagic > Environment variables. Create **one** group named `juzz_release`
and put everything below in it. Mark every secret as **Secure**. Codemagic
fails the build if the group does not exist, so create it even while some
variables are still blank.

Group `juzz_release`:

| Variable | Example | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | `https://api.juzz.sakcps.org/api` | Baked into the APK at build time |
| `PUBLISH_API_URL` | `https://api.juzz.sakcps.org/api` | Where the build registers the new release |
| `PUBLISH_EMAIL` | `releases@sakcps.org` | An admin account used only by CI |
| `PUBLISH_PASSWORD` | (secure) | That account's password |
| `GITHUB_TOKEN` | (secure) | Fine-grained token with **Contents: read and write** |
| `GITHUB_REPO` | `mayegamustafa/juzz` | Where releases are published |
| `GOOGLE_SERVICES_JSON` | (secure) | base64 of `google-services.json`, for push |

If `GITHUB_TOKEN` or `PUBLISH_PASSWORD` is missing, the build still succeeds and
just skips publishing, so you can fall back to the manual path below.

## What happens on every build

1. Codemagic bumps `PROJECT_BUILD_NUMBER`, which becomes the Android
   `versionCode`, and the version name becomes `1.0.<build number>`.
2. `flutter analyze` and `flutter test` run; failures stop the build.
3. The APK is built and signed with `juzz_keystore`. The build then reads the
   certificate back with `apksigner` and fails if the APK is unsigned, so a
   debug-signed one can never reach a Sheikh. It also compares the certificate
   against the fingerprint pinned in `codemagic.yaml` and warns on a mismatch,
   since a silent key change is what breaks updates. **If you ever rotate the
   keystore, update that `EXPECTED` value** — and expect every existing install
   to need a manual reinstall.
4. The APK is attached to a GitHub release tagged `v1.0.<build number>`, giving
   it a stable public download URL.
5. The build signs in to the API and `POST`s the new version to `/app-release`.

The next time a Sheikh opens the app, `UpdateService` compares the installed
`versionCode` against the published one and offers the update. Tapping
**Update now** opens the download URL; installing over the existing app keeps
their data and login.

Mark a release `mandatory` (from the Teacher app admin page) only when an older
build would actually misbehave, since it blocks the Sheikh until they update.

## Publishing manually instead

If you would rather not give CI an API account, leave `PUBLISH_PASSWORD` unset.
Then after each build:

1. Download the APK from the Codemagic build artifacts.
2. Upload it somewhere with a stable public URL (a GitHub release works).
3. Open the web admin > **Teacher app**, and enter the version code, version
   name, and download URL.

The version code you enter must match the build number Codemagic used, or the
app will not recognise the update.

## First install

There is no update path for the very first install: send Sheikhs the APK link
directly. Android will warn about installing from an unknown source, which is
expected for a sideloaded app; they allow it once for the browser or file
manager they used. Every later release then updates in place.

## Install warnings, and how to remove them

A sideloaded APK **always** triggers warnings, and no change to the app can
suppress them. This is deliberate on both platforms: the warning exists because
the operating system genuinely cannot vouch for software it did not distribute.
Expect, on Android:

- "Install unknown apps" consent, once per source app (browser, Files, WhatsApp)
- A Play Protect scan notice, and sometimes "unsafe app blocked" for an app with
  no install history

The app is already configured to look as unremarkable as possible to those
scanners: it requests only `INTERNET`, `ACCESS_NETWORK_STATE` and
`POST_NOTIFICATIONS`, blocks cleartext traffic except to local development
addresses, and is signed with a stable release key. There is nothing further to
gain from the app side.

Removing the warnings entirely means letting the platform distribute the app.
For a staff-sized audience both routes are free or cheap:

### Android: Play Console internal testing

- One-off $25 Google Play developer registration.
- Upload the AAB to the **internal testing** track and add Sheikhs by email
  (up to 100). No public listing, no review queue of any consequence.
- They install from the Play Store like any other app: no unknown-source
  prompt, no Play Protect warning, and **Play handles updates automatically**,
  which makes the in-app update prompt redundant.
- Build the bundle by adding `flutter build appbundle` alongside the APK step.

### iOS: TestFlight

- Requires the $99/year Apple Developer Program. There is no legitimate way to
  install an iOS app outside the App Store, TestFlight, or a $299/year
  enterprise programme with strict eligibility rules.
- TestFlight allows up to 10,000 testers, installs without warnings, and
  auto-updates.

Until then, sideloading works fine; the warnings are a one-time nuisance per
Sheikh, not an ongoing one.
