// Top-level build file — plugin versions only, applied `false` here and
// actually applied per-module in app/build.gradle.kts, core/build.gradle.kts,
// wear/build.gradle.kts.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.android.asset.pack) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.play.publisher) apply false
}

// supabase-kt's auth module pulls androidx.browser 1.10, which requires AGP 8.9.1+; this project
// is on AGP 8.7.2 (see gradle/libs.versions.toml). 1.8.0 has everything Custom Tabs sign-in uses.
allprojects {
    configurations.all {
        resolutionStrategy.force("androidx.browser:browser:1.8.0")
    }
}
