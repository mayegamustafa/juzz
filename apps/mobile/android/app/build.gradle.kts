import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Push notifications are optional. The google-services plugin hard-fails the
// build when google-services.json is missing, which would block anyone building
// the app before Firebase is set up, so apply it only when the file is there.
// Without it the app still builds and falls back to polling while it is open.
val googleServicesJson = file("google-services.json")
if (googleServicesJson.exists()) {
    apply(plugin = "com.google.gms.google-services")
    logger.lifecycle("google-services.json found: Firebase push enabled.")
} else {
    logger.lifecycle("google-services.json absent: building without Firebase push.")
}

// Release signing. The app is distributed as a sideloaded APK, not through the
// Play Store, so every release MUST be signed with the same key: Android only
// installs an update over an existing app when the signatures match. A key
// change would force Sheikhs to uninstall first, losing their offline data.
//
// key.properties and the keystore itself are gitignored; CI writes them from
// encrypted variables. When absent (a local `flutter run --release`), fall back
// to the debug key so the build still works.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}
val hasReleaseKeystore = keystorePropertiesFile.exists()

android {
    namespace = "com.juzz.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // flutter_local_notifications schedules against the java.time APIs,
        // which do not exist on older Android. Desugaring back-ports them, and
        // the plugin refuses to build without it.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Must match the package name registered in Firebase, or google-services
        // cannot resolve this app and push silently never arrives.
        //
        // Changing this after the first APK ships would read as a different app:
        // existing installs would not update, they would sit alongside it.
        applicationId = "com.juzz.app"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

dependencies {
    // Supplies the back-ported APIs that isCoreLibraryDesugaringEnabled turns on.
    // flutter_local_notifications requires 2.1.4 or newer.
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
