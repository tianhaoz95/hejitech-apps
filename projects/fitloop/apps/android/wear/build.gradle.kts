import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// One version for every FitLoop surface (apps/ios/project.yml's MARKETING_VERSION).
val marketingVersion: String = Regex("""MARKETING_VERSION:\s*"([^"]+)"""")
    .find(rootProject.file("../ios/project.yml").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in apps/ios/project.yml")

// Release signing: the same upload key as the phone app (from the environment).
val keystorePath: String? = System.getenv("FITLOOP_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.fitloop.wear"
    compileSdk = 36

    defaultConfig {
        // Same package as the phone app: one Play listing (Wear OS form factor), and the Wearable
        // Data Layer only connects apps with the same package and signing key.
        applicationId = "com.hejitech.fitloop"
        minSdk = 30 // Wear OS 3+
        targetSdk = 36
        // One listing, so the watch bundle's code is the phone's -PversionCode plus one.
        versionCode = (findProperty("versionCode") as String?)?.toInt()?.plus(1) ?: 1
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
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
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
    // Play services bring an old Fragment; ActivityResult (the heart-rate permission) needs 1.3+.
    implementation(libs.fragment)
    implementation(libs.lifecycle.runtime.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.coroutines.guava)
    implementation(libs.kotlinx.coroutines.android)
    // Heart rate while a workout is open (MeasureClient; no exercise session, no foreground service).
    implementation(libs.health.services)
}
