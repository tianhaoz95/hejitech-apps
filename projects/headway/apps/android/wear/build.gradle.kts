import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// One version for every Headway surface (apps/ios/project.yml's MARKETING_VERSION).
val marketingVersion: String = Regex("""MARKETING_VERSION:\s*"([^"]+)"""")
    .find(rootProject.file("../ios/project.yml").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in apps/ios/project.yml")

// Release signing comes from the environment (the same upload key as the phone app).
val keystorePath: String? = System.getenv("HEADWAY_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.headway.wear"
    compileSdk = 36

    defaultConfig {
        // Same package as the phone app: one Play listing (Wear OS form factor) and the Wearable
        // Data Layer only connects apps with the same package and signing key.
        applicationId = "com.hejitech.headway"
        minSdk = 30 // Wear OS 3+
        targetSdk = 36
        // Phone and watch share the listing, so their version codes must differ: the watch bundle
        // is the phone's -PversionCode plus one.
        versionCode = (findProperty("versionCode") as String?)?.toInt()?.plus(1) ?: 1
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
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
        // `-PminifyDebug`: a debug build shrunk like release, to test R8 on the watch.
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

    // Wear Compose
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.wear.compose.navigation)

    // Google Play Wearable DataLayer & Coroutines
    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.coroutines.guava)

    // Wear Tiles & ProtoLayout
    implementation(libs.wear.tiles)
    implementation(libs.wear.protolayout)
    implementation(libs.wear.protolayout.material)

    // Watch Face Complications
    implementation(libs.wear.watchface.complications)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.espresso.core)
}
