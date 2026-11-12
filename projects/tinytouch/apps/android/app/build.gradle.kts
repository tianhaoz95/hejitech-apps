import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// One version for every TinyTouch surface: scripts/cut_release.sh bumps MARKETING_VERSION in the
// Xcode project, and the Android apps read it from there.
val marketingVersion: String = Regex("""MARKETING_VERSION = ([0-9.]+);""")
    .find(rootProject.file("../../ToddlerPlay.xcodeproj/project.pbxproj").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in ToddlerPlay.xcodeproj")

// Release signing comes from the environment (the owner's upload key in ~/Credentials/); without
// it a release build stays unsigned.
val keystorePath: String? = System.getenv("TINYTOUCH_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.tinytouch.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.tinytouch"
        minSdk = 26
        targetSdk = 36
        // -PversionCode=<n> for a store build (minutes since 2020-01-01 UTC, grows with every upload).
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = marketingVersion
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("TINYTOUCH_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TINYTOUCH_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("TINYTOUCH_ANDROID_KEY_PASSWORD") ?: System.getenv("TINYTOUCH_ANDROID_KEYSTORE_PASSWORD")
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
    implementation(project(":kit"))

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

    testImplementation(libs.junit)
}
