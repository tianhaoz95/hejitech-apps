import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// One version for every Headway surface: scripts/cut_release.sh bumps MARKETING_VERSION in the
// iPhone app's project.yml, and the Android app reads it from there.
val marketingVersion: String = Regex("""MARKETING_VERSION:\s*"([^"]+)"""")
    .find(rootProject.file("../ios/project.yml").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in apps/ios/project.yml")

// Release signing comes from the environment (the owner's upload keystore); without it a release
// build stays unsigned.
val keystorePath: String? = System.getenv("HEADWAY_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.headway.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.headway"
        minSdk = 26
        targetSdk = 36
        // -PversionCode=<n> for a store build (must grow with every upload).
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = marketingVersion
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("HEADWAY_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("HEADWAY_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("HEADWAY_ANDROID_KEY_PASSWORD") ?: System.getenv("HEADWAY_ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // R8: material-icons-extended alone is most of an unshrunk bundle.
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
    implementation(libs.core.splashscreen)
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
    // Google sign-in opens in a browser tab and comes back to headway://login-callback.
    implementation(libs.browser)

    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.play.services)
    // Alerts from the Worker (FCM). No google-services plugin: res/values/firebase.xml holds what it would generate.
    implementation(libs.firebase.messaging)
    // Play services pull in an old Fragment; the permission launchers need 1.3.0 or newer (lint: InvalidFragmentVersionForActivityResult).
    implementation(libs.fragment)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.espresso.core)
}
