import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.hejitech.core"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        // Only exercised by :core:connectedAndroidTest (see
        // src/androidTest/.../FirebaseEmulatorTestEnv.kt) — this module has
        // no google-services.json of its own (only app/wear apply that
        // plugin), so those tests build FirebaseOptions by hand and talk to
        // a locally running emulator suite, same "contempo-str" project
        // id CoreFlowTest.kt (app module) already assumes.
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
    // The shared HEJI Supabase project (projects/contempo/backend.env): Postgres (schema contempo)
    // with RLS, Auth, Storage and Realtime. api(): app and wear use the client directly.
    api(platform(libs.supabase.bom))
    api(libs.supabase.postgrest)
    api(libs.supabase.auth)
    api(libs.supabase.storage)
    api(libs.supabase.realtime)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.kotlinx.coroutines.play.services)
    api(libs.kotlinx.serialization.json)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.kotlinx.coroutines.play.services)
}
