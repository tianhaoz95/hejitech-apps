import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val supabaseUrlOverride: String = localProperties.getProperty("SUPABASE_URL", "")
val supabaseKeyOverride: String = localProperties.getProperty("SUPABASE_PUBLISHABLE_KEY", "")

// One version for every Wee Hours surface: scripts/cut_release.sh bumps MARKETING_VERSION in the
// iPhone app's project.yml, and the Android apps read it from there.
val marketingVersion: String = Regex("""MARKETING_VERSION:\s*"([^"]+)"""")
    .find(rootProject.file("../ios/project.yml").readText())?.groupValues?.get(1)
    ?: error("MARKETING_VERSION not found in apps/ios/project.yml")

// Release signing comes from the environment (the upload key in ~/Credentials/weehours/, or CI
// secrets); without it a release build stays unsigned.
val keystorePath: String? = System.getenv("WEEHOURS_ANDROID_KEYSTORE")

android {
    namespace = "com.hejitech.weehours"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hejitech.weehours"
        minSdk = 26
        targetSdk = 36
        // -PversionCode=<n> for a store build (must grow with every upload).
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = marketingVersion
        buildConfigField("String", "SUPABASE_URL_OVERRIDE", "\"$supabaseUrlOverride\"")
        buildConfigField("String", "SUPABASE_KEY_OVERRIDE", "\"$supabaseKeyOverride\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("WEEHOURS_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("WEEHOURS_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("WEEHOURS_ANDROID_KEY_PASSWORD") ?: System.getenv("WEEHOURS_ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // R8: shrinks the bundle (material-icons-extended alone is several MB).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
        // `-PminifyDebug`: a debug build shrunk like release, to test R8 on the phone.
        debug {
            applicationIdSuffix = ".debug"
            if (project.hasProperty("minifyDebug")) {
                isMinifyEnabled = true
                proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            }
        }
    }

    lint {
        disable += "NullSafeMutableLiveData"
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
    implementation(libs.feedbackkit)
    implementation(libs.androidx.core.splashscreen)
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

    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.fragment)
    implementation(libs.androidx.browser)
    implementation(libs.play.services.wearable)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.coil.compose)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
