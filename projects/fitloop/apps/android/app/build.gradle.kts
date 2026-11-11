import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// One version for every FitLoop surface: scripts/cut_release.sh bumps MARKETING_VERSION in the
// iPhone app's project.yml, and the Android app reads it from there.
val marketingVersion: String = Regex("""MARKETING_VERSION:\s*"([^"]+)"""")
    .find(rootProject.file("../ios/project.yml").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in apps/ios/project.yml")

// Release signing comes from the environment (the owner's upload keystore); without it a release
// build stays unsigned.
val keystorePath: String? = System.getenv("FITLOOP_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.fitloop"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.fitloop"
        minSdk = 26
        targetSdk = 36
        // -PversionCode=<n> for a store build (must grow with every upload).
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = marketingVersion
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("FITLOOP_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("FITLOOP_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("FITLOOP_ANDROID_KEY_PASSWORD") ?: System.getenv("FITLOOP_ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // R8: the bundle drops from ~11 MB (material-icons-extended) to a few MB.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
        // `-PminifyDebug`: a debug build shrunk like release, to test R8 against the local stack.
        debug {
            if (project.hasProperty("minifyDebug")) {
                isMinifyEnabled = true
                proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            }
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
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.activity.compose)
    implementation(libs.browser)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
}
