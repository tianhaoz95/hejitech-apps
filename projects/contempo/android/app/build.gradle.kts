import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
    alias(libs.plugins.firebase.crashlytics)
    alias(libs.plugins.firebase.perf)
    alias(libs.plugins.play.publisher)
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

// Play Store upload-signing key. Checked into the repo (android/upload-keystore.jks
// + android/keystore.properties) at the user's explicit direction — Play App
// Signing means this is only the *upload* key (Google re-signs with its own
// managed key for distribution), and Google can rotate this key on request if
// it's ever compromised.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

// gradle-play-publisher — automated releases after the required first manual
// upload (Play App Signing enrollment can't happen via the API). See
// CLAUDE.md's "Play Store publishing service account" note.
play {
    serviceAccountCredentials.set(rootProject.file("../credentials/play-publisher-service-account.json"))
    defaultToAppBundles.set(true)
    track.set("internal")
}

android {
    namespace = "com.hejitech.contempo"
    compileSdk = 36

    defaultConfig {
        // Play Console already locked this app's listing to
        // com.hejitech.contempoapp from an earlier upload — package names are
        // permanent once set, so this has to match rather than the
        // com.hejitech.<app> convention elsewhere in the repo (namespace below
        // is unaffected — it only governs the generated R/BuildConfig
        // package, not the installed package name).
        applicationId = "com.hejitech.contempoapp"
        minSdk = 26
        targetSdk = 36
        versionCode = 71
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

    // The two Whisper ASR models live in the :whisper_models install-time
    // Play Asset Delivery pack (see whisper_models/build.gradle.kts), not
    // app/src/main/assets/ — moved out so routine app updates that don't
    // touch these ~99MB-each, essentially-static files don't re-transfer
    // them. Still delivered with the very first install, same as before.
    assetPacks += listOf(":whisper_models")

    signingConfigs {
        create("release") {
            storeFile = rootProject.file(keystoreProperties.getProperty("storeFile", "upload-keystore.jks"))
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false // flip on once there's an actual release build to tune
            signingConfig = signingConfigs.getByName("release")
            // Best-effort: the vendored .so files (sherpa-onnx Whisper model,
            // jniLibs/arm64-v8a) are prebuilt third-party binaries we don't
            // control the debug info for — this just has AGP extract whatever
            // symbol table survived in them, rather than nothing at all.
            ndk {
                debugSymbolLevel = "SYMBOL_TABLE"
            }
        }
        debug {
            // Lets the app use Firebase's debug App Check provider against the
            // emulator without needing real attestation — see backend/README.md.
            buildConfigField("boolean", "USE_FIREBASE_EMULATOR", "true")
        }
    }
    lint {
        // NonNullableMutableLiveDataDetector (pulled in transitively via
        // androidx.lifecycle) crashes lintVitalAnalyzeRelease outright on
        // this AGP/Kotlin toolchain combo ("Found class
        // KaCallableMemberCall, but interface was expected" — a Kotlin
        // Analysis API version mismatch inside the detector itself, not a
        // finding about our code). This app has zero LiveData usage
        // (StateFlow throughout, see CLAUDE.md), so the check has nothing
        // to say here anyway — disabling it is the fix lint's own crash
        // message suggests, and unblocks `./gradlew :app:assembleRelease`/
        // `installRelease`, which otherwise fail before packaging even
        // starts.
        disable += "NullSafeMutableLiveData"
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
    implementation(libs.androidx.core.splashscreen)
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
    // Crash + non-fatal reporting — see ContempoApp.kt/AuthAwareFlow.kt.
    implementation(libs.firebase.crashlytics)
    // Custom performance traces — see ContempoApp.kt/PerformanceTrace.kt.
    implementation(libs.firebase.performance)
    // Remote kill switch for cloud AI usage — see RemoteConfigStore.kt.
    implementation(libs.firebase.remoteconfig)

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

    // Wear Data Layer API (MessageClient) — relays a Firebase custom token
    // to the paired Wear OS watch for first-time sign-in there — see
    // wear/auth/WatchAuthTokenClient.kt and auth/WatchAuthTokenRelay.kt.
    implementation(libs.play.services.wearable)

    // FusedLocationProviderClient for GPS mileage-trip tracking — see
    // mileage/MileageTrackingService.kt.
    implementation(libs.play.services.location)

    // Periodic background processing of the watch's pending-audio backlog
    // — see wear/PendingAudioProcessWorker.kt.
    implementation(libs.androidx.work.runtime.ktx)

    // Image loading for entry attachment previews (image/* attachments) —
    // see EntryDetailScreen.kt.
    implementation(libs.coil.compose)
    // Video playback for entry attachment previews (video/* attachments) —
    // see EntryDetailScreen.kt.
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)

    // Mini-map on Entry Detail (captured-location pin / trip start-end
    // line) — OpenStreetMap tiles, no API key. See ui/entrydetail/EntryLocationMap.kt.
    implementation(libs.osmdroid.android)

    // Instrumented tests — run on-device/emulator against the Firebase
    // emulator suite (see androidTest/.../CoreFlowTest.kt). Firebase/core
    // classes don't need re-declaring here: androidTest links against the
    // app-under-test's own classpath automatically.
    androidTestImplementation(libs.androidx.test.ext.junit)
    // Declared explicitly — see core/build.gradle.kts's comment on the same
    // dependency: androidx.test.runner.AndroidJUnitRunner was missing from
    // the test APK's runtime classpath without it, crashing every
    // connectedAndroidTest run before a single test could execute.
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
    androidTestImplementation(libs.androidx.uiautomator)
}
