import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Plain Kotlin (no Android): models, the Worker + sign-in client and the reminder planner, so the
// tests run on the JVM against the same fixtures as the iPhone app's FitLoopKit.
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

// The Worker's real responses for the seed athlete, shared with FitLoopKit's tests.
sourceSets["test"].resources.srcDir("../../ios/FitLoopKit/Tests/FitLoopKitTests/Fixtures")

dependencies {
    api(libs.kotlinx.coroutines.core)
    api(libs.kotlinx.serialization.json)
    api(libs.okhttp)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
