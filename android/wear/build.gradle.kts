// Deliberately minimal — Wear OS capture is a fast-follow target (see
// reports/mvp-scope-v0.html Section 5.1), not MVP scope. This module exists
// now, compiling and installable, specifically so the multi-module
// structure is real rather than aspirational — the whole reason native
// Android was chosen over cross-platform (Section 6) was Wear OS
// integration, so the module needs to actually exist, not just be a folder
// name. Build the real capture screen here when that fast-follow starts.
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.hejitech.wear"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.wear"
        minSdk = 30 // Wear OS 3+
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-mvp"
    }

    buildFeatures {
        compose = true
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
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.play.services.wearable)
}
