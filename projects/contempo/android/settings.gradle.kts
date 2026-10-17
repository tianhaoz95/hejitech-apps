pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // FeedbackKit's Android SDK only (libs.feedbackkit).
        maven("https://jitpack.io") {
            content { includeGroup("com.github.tianhaoz95") }
        }
    }
}

rootProject.name = "contempo"
include(":app")
include(":core")
include(":wear")
include(":whisper_models")
include(":qwen_model")
