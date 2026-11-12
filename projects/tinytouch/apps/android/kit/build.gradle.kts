import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.hejitech.tinytouch.kit"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
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
    api(project(":core"))

    // Only Compose UI + foundation + text: the phone adds Material 3, the watch Wear Compose.
    api(platform(libs.compose.bom))
    api(libs.compose.ui)
    api(libs.compose.ui.graphics)
    api(libs.compose.foundation)
    api("androidx.compose.foundation:foundation-layout")


    // Phone <-> watch over the Wearable Data Layer (Bluetooth via Play services, no server).
    api(libs.play.services.wearable)
    api(libs.kotlinx.coroutines.android)
    api(libs.kotlinx.coroutines.play.services)
}
