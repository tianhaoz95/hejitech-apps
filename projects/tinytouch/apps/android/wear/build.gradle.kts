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
    namespace = "com.hejitech.tinytouch.wear"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.tinytouch"
        minSdk = 30 // Wear OS 3+
        targetSdk = 36
        // Phone and watch share one Play listing (same package), so their version codes must differ:
        // the watch bundle is the phone's -PversionCode plus one.
        versionCode = (findProperty("versionCode") as String?)?.toInt()?.plus(1) ?: 1
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

    // Wear Compose
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)

    testImplementation(libs.junit)
}
