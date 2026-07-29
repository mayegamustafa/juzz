# Push notifications

Notifications reach a Sheikh's phone two ways:

1. **In-app poll.** While the app is open it asks the API for unread
   notifications every 60 seconds. This has always worked and still does.
2. **Firebase Cloud Messaging (FCM).** The OS push service delivers the message
   even when the app is closed or has been swept away. This is the only
   transport that works when the app is not running: Android and iOS both stop
   an app's own background timers, so no amount of app code can replace it.

Everything below is optional. With no Firebase configuration, the API still
records notifications and the app still shows them on next open.

## What the admin sends

Web admin broadcasts (`POST /notifications/broadcast`) fan out one row per
recipient, then dispatch to every delivery channel. Adding FCM did not change
that flow: `FcmChannel` is simply another channel alongside the log channel, so
any future notification source gets push for free.

## Current state

Firebase project **sir-apollo-kaggwa-supervision** is already set up, with both
apps registered under the bundle/package id `com.juzz.app`:

| Piece | Status |
| --- | --- |
| Android app registered | done |
| `apps/mobile/android/app/google-services.json` | in place (gitignored) |
| iOS app registered | done |
| `apps/mobile/ios/Runner/GoogleService-Info.plist` | in place (gitignored), added to the Xcode target |
| `GOOGLE_SERVICES_JSON` in Codemagic | **still to do** (see below) |
| `FIREBASE_SERVICE_ACCOUNT` on the API | **still to do** (see below) |
| APNs key for iOS | needs an Apple Developer account |

Because the config files are gitignored, a clean checkout (which is what
Codemagic builds from) does not have them. Local builds work; CI needs the
variable below.

## Setting it up

### 1. Create a Firebase project

<https://console.firebase.google.com> > Add project. Analytics is not needed.

### 2. Register the Android app

Project settings > Your apps > Add app > Android.

- Android package name: `com.juzz.app` (must match exactly; it is the
  `applicationId` in `apps/mobile/android/app/build.gradle.kts`)
- Download `google-services.json` into `apps/mobile/android/app/`

Do **not** commit that file; it is gitignored. For CI, run:

```bash
base64 -w0 apps/mobile/android/app/google-services.json
```

and store the output in Codemagic as a secure variable `GOOGLE_SERVICES_JSON`
in the `juzz_firebase` group. The build writes it back out before compiling.

The Gradle config applies the google-services plugin only when the file is
present, so a build without it still succeeds; the app then falls back to
polling.

### 3. Give the API a service account

Firebase console > Project settings > Service accounts > Generate new private
key. Set the whole JSON as `FIREBASE_SERVICE_ACCOUNT` on the API service in
Railway (raw JSON or base64; both are accepted, because some hosts mangle
multi-line values).

On boot the API logs which path it took:

```
Push enabled for Firebase project <id>
FIREBASE_SERVICE_ACCOUNT not set; push notifications are disabled.
```

### 4. iOS, when you get there

The iOS app is registered and `GoogleService-Info.plist` is in place and bundled
into the Xcode target, and `Info.plist` declares the `remote-notification`
background mode. What is still missing is everything gated behind an Apple
Developer account ($99/year):

- An APNs key (Keys > Apple Push Notifications service), uploaded to Firebase
  under Project settings > Cloud Messaging. Without it, Firebase has no way to
  reach an iPhone.
- The Push Notifications capability, which comes from the provisioning profile.
- Signed builds. The iOS workflow currently builds `--no-codesign`, which
  produces a verifiable binary that cannot be installed on a device.

Android needs none of this and works today.

## Device tokens

The app registers its FCM token with `POST /notifications/devices` on every
sign-in, and again whenever FCM rotates it. Sign-out calls
`POST /notifications/devices/remove`, so a shared phone stops receiving the
previous Sheikh's notifications.

Tokens are keyed on the token itself, not the user: FCM can hand the same token
to a device a different Sheikh later signs into, and re-pointing it is what
prevents cross-user leakage. Tokens FCM reports as dead are deleted
automatically when a send fails, so the table does not grow forever.

## What is not possible

**Notifications cannot be forced on a user who declines them.** On Android 13+
`POST_NOTIFICATIONS` is a runtime permission and on iOS consent has always been
required. If the Sheikh taps "Don't allow", the OS discards the notification
before the app ever sees it. There is no API, flag or manifest entry that
overrides this, and apps that try to work around it are exactly what Play
Protect flags as malware, which would undermine getting the app trusted in the
first place.

What the app does instead:

- Asks once, at first launch, through the standard OS prompt.
- Treats refusal as normal rather than an error, and keeps working: the in-app
  bell and notification list still show everything while the app is open.
- Never nags. If a Sheikh wants notifications back on later, it is one tap in
  Android Settings > Apps > Juzz Tracking > Notifications.

In practice the grant rate for a work app a Sheikh has been asked to install is
very high; the realistic gap is a handful of people, not the whole staff.
