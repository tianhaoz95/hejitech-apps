// Real Wear OS capture: mic -> record raw audio -> save locally
// (capture/PendingCaptureStore.kt) -> upload straight to Firebase Storage in
// the background (capture/PendingCaptureSyncer.kt), enqueuing a small
// Firestore doc (core/data/AudioCaptureQueue.kt) pointing at it. The phone
// picks that up and runs it through its existing on-device Whisper + parse
// pipeline whenever it's next opened or via its own periodic background job
// (see app/wear/AudioCaptureProcessor.kt), saving to the same Firestore
// `users/{uid}/entries` collection the phone app reads (see MainActivity.kt,
// complication/, tile/). A WorkManager periodic job here
// (capture/PendingCaptureSyncWorker.kt) retries the upload for whenever this
// watch had no connectivity at record time. Auth and Firestore wiring
// deliberately mirror app/build.gradle.kts (see that file's comments for the
// reasoning) rather than sharing a single AuthManager, since a cross-module
// refactor of the phone app's existing auth code isn't worth the regression
// risk here.
import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.services)
    alias(libs.plugins.play.publisher)
}

// Same automated-publish pattern as app/build.gradle.kts — see that file's
// play {} block for the reasoning (gradle-play-publisher, service account).
// Track is "wear:internal", not plain "internal" — Play models Wear OS
// releases on form-factor-prefixed tracks (wear:production, wear:internal,
// etc). Uploading to the bare "internal" track gets rejected at commit time
// with "requires the Wear OS system feature android.hardware.type.watch. To
// publish this release on the current track, remove this artifact." even
// though the bundle itself uploads fine — confirmed live.
play {
    serviceAccountCredentials.set(rootProject.file("../credentials/play-publisher-service-account.json"))
    defaultToAppBundles.set(true)
    track.set("wear:internal")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val googleWebClientId: String = localProperties.getProperty("GOOGLE_WEB_CLIENT_ID", "")

// Dedicated release keystore for the wear app — deliberately its own
// keystore.properties/.jks pair, not shared with app/build.gradle.kts's
// upload-keystore.jks. Its SHA-1 needed to be freshly generated (rather than
// derived from the debug key like app/'s original setup) because the debug
// key's SHA-1 was already registered against this same package name on the
// now-deleted contempo-platform project and stayed blocked (globally-unique
// (package, SHA-1) pair) through that project's 30-day purge grace period —
// unlike app/, wear had no live Play Console upload-key lineage yet, so
// minting a brand-new keystore was a free fix here (see CLAUDE.md).
val wearKeystoreProperties = Properties().apply {
    val file = rootProject.file("wear-keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.hejitech.wear"
    compileSdk = 36

    defaultConfig {
        // Not just com.hejitech.wear — Hejitech ships more than one product,
        // so the package name needs to disambiguate which product's Wear
        // companion this is, same reasoning as the phone app's
        // com.hejitech.contempoapp exception below. namespace stays
        // com.hejitech.wear (unaffected — only governs the generated R/
        // BuildConfig package, not the installed package name or the Play
        // Console listing this becomes once published).
        applicationId = "com.hejitech.contempoappwear"
        minSdk = 30 // Wear OS 3+
        targetSdk = 36
        versionCode = 2
        versionName = "0.1.0-mvp"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
        buildConfigField("boolean", "USE_FIREBASE_EMULATOR", "false")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file(wearKeystoreProperties.getProperty("storeFile", "wear-upload-keystore.jks"))
            storePassword = wearKeystoreProperties.getProperty("storePassword")
            keyAlias = wearKeystoreProperties.getProperty("keyAlias")
            keyPassword = wearKeystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            buildConfigField("boolean", "USE_FIREBASE_EMULATOR", "true")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":core"))

    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.compose.material.icons.extended)

    // Periodic background sync of the pending-capture backlog — see
    // capture/PendingCaptureSyncWorker.kt.
    implementation(libs.androidx.work.runtime.ktx)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.storage)
    implementation(libs.firebase.appcheck)
    implementation(libs.firebase.appcheck.playintegrity)
    implementation(libs.firebase.appcheck.debug)

    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.coroutines.guava)

    // FusedLocationProviderClient for capturing where a recording was made
    // — see capture/WearCaptureViewModel.kt.
    implementation(libs.play.services.location)

    // Google Sign-In (real, non-emulator path) — see auth/WearAuthManager.kt.
    implementation(libs.credentials)
    implementation(libs.credentials.play.services.auth)
    implementation(libs.googleid)

    // Complication (watch face glanceable) + Tile (swipeable progress card).
    implementation(libs.wear.watchface.complications.data.source.ktx)
    implementation(libs.wear.tiles)
    implementation(libs.wear.protolayout)
    implementation(libs.wear.protolayout.material)

    // Instrumented tests — run against a real device/Wear emulator against
    // the Firebase emulator suite, same conventions as app/build.gradle.kts's
    // androidTest deps (see that file's comments) and core's FirebaseEmulatorTestEnv.
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
    androidTestImplementation(libs.androidx.uiautomator)
    androidTestImplementation(libs.androidx.work.testing)
    androidTestImplementation(libs.kotlinx.coroutines.play.services)
}
