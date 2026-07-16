import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
}

// Real (non-emulator) Google Sign-In needs the Firebase project's OAuth Web
// Client ID. Read from local.properties rather than depending on the
// google-services plugin's auto-generated `default_web_client_id` resource —
// that resource only exists once google-services.json actually has an
// oauth_client entry, and referencing a resource that may not exist yet would
// be a compile-time failure, not a runtime one. See auth/AuthManager.kt.
val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val googleWebClientId: String = localProperties.getProperty("GOOGLE_WEB_CLIENT_ID", "")

android {
    namespace = "com.hejitech.contempo"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.contempo"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-mvp"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
        // Default for every build type except debug (which overrides to
        // true below) — without a default here, release has no value for
        // this field at all and fails to compile (ContempoApp.kt/
        // AuthManager.kt reference it unconditionally).
        buildConfigField("boolean", "USE_FIREBASE_EMULATOR", "false")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Only arm64-v8a native libs are vendored (see
        // agent/WhisperTranscriber.kt kdoc and jniLibs/arm64-v8a) — sherpa-onnx
        // has no Maven artifact, so its .so files were hand-copied from a
        // GitHub release rather than resolved per-ABI by Gradle. Real
        // devices in 2026 are arm64; skipping the other ABIs avoids a build
        // that silently produces an APK with no native lib on them at all.
        ndk {
            abiFilters += "arm64-v8a"
        }
    }

    // The Whisper tiny.en model (~99MB, see assets/sherpa-onnx-whisper-tiny.en)
    // is already int8-quantized/compressed; letting AAPT recompress it as a
    // resource on install would waste time for no size benefit, and .onnx
    // isn't an asset type AAPT would treat specially anyway — noExtract
    // avoids any doubt.
    androidResources {
        noCompress += listOf("onnx")
    }

    buildTypes {
        release {
            isMinifyEnabled = false // flip on once there's an actual release build to tune
            // Reuses the default debug keystore/signing config rather than a
            // dedicated release key — that debug keystore's SHA-1/SHA-256 are
            // what's registered with the real contempo-platform Firebase
            // project for Google Sign-In (see CLAUDE.md), and there's no Play
            // Store distribution pipeline yet to need a real release key for.
            // This build type means "real Firebase backend, installable for
            // testing" — not "ready to publish."
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            // Lets the app use Firebase's debug App Check provider against the
            // emulator without needing real attestation — see backend/README.md.
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

// Kotlin 2.3 removed the old android.kotlinOptions { jvmTarget = "..." } DSL
// (hard error, not just deprecated) — this is the replacement.
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
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.navigation.compose)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.storage)
    implementation(libs.firebase.functions)
    implementation(libs.firebase.appcheck)
    implementation(libs.firebase.appcheck.playintegrity)
    // Plain implementation, not debugImplementation: ContempoApp.kt
    // references DebugAppCheckProviderFactory unconditionally (it's only
    // *installed* when BuildConfig.USE_FIREBASE_EMULATOR is true, but the
    // class still has to be on the compile classpath for every build type,
    // including release/prod).
    implementation(libs.firebase.appcheck.debug)

    // Firebase AI Logic hybrid inference — kept for GeminiNanoLlm (see
    // agent/OnDeviceLlm.kt), an alternate OnDeviceLlm implementation that's
    // no longer the active one (AICore's device coverage is too narrow) but
    // is left in place in case it's worth revisiting. Not yet in the
    // Firebase BoM as of this writing, pinned directly.
    implementation(libs.firebase.ai)
    implementation(libs.firebase.ai.ondevice)

    // LiteRT-LM — the active on-device LLM runtime (Gemma 4 E2B). See
    // agent/OnDeviceLlm.kt / agent/LiteRtLlm.kt.
    implementation(libs.litertlm.android)

    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.serialization.json)

    // Google Sign-In (real, non-emulator path) — see auth/AuthManager.kt.
    implementation(libs.credentials)
    implementation(libs.credentials.play.services.auth)
    implementation(libs.googleid)

    // Instrumented tests — run on-device/emulator against the Firebase
    // emulator suite (see androidTest/.../CoreFlowTest.kt). Firebase/core
    // classes don't need re-declaring here: androidTest links against the
    // app-under-test's own classpath automatically.
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
    androidTestImplementation(libs.androidx.uiautomator)
}
