import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// One version for every ToddlerCam surface: scripts/cut_release.sh bumps MARKETING_VERSION in
// project.yml, and the Android apps read it from there.
val marketingVersion: String = Regex("""MARKETING_VERSION:\s*"([^"]+)"""")
    .find(rootProject.file("../../project.yml").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in project.yml")

// Release signing comes from the environment (the owner's upload key in ~/Credentials/); without
// it a release build stays unsigned.
val keystorePath: String? = System.getenv("TODDLERCAM_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.toddlercam.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.toddlercam"
        minSdk = 26
        targetSdk = 36
        // -PversionCode=<n> for a store build (minutes since 2020-01-01 UTC, grows with every upload).
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = marketingVersion
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("TODDLERCAM_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TODDLERCAM_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("TODDLERCAM_ANDROID_KEY_PASSWORD") ?: System.getenv("TODDLERCAM_ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
        // `-PminifyDebug`: a debug build shrunk like release, to test R8 on the phone.
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
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.activity.compose)
    // Play services pulls in an old Fragment; release lint (InvalidFragmentVersionForActivityResult)
    // needs 1.3+ for the permission launchers.
    implementation(libs.fragment.ktx)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.navigation.compose)

    // CameraX
    implementation(libs.camera.core)
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.view)

    // Play Services Wearable (for Watch connection)
    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.play.services)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.espresso.core)
}
