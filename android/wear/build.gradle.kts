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
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val googleWebClientId: String = localProperties.getProperty("GOOGLE_WEB_CLIENT_ID", "")

android {
    namespace = "com.hejitech.wear"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.wear"
        minSdk = 30 // Wear OS 3+
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-mvp"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
        buildConfigField("boolean", "USE_FIREBASE_EMULATOR", "false")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
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
}
