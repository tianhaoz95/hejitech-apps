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
    }
}

rootProject.name = "tinytouch"
// core: plain Kotlin rules shared by both apps (game modes, sync payloads, timer), unit-tested.
include(":core")
// kit: the five games, sounds, haptics, Parent Shield and the Data Layer plumbing (Compose, no Material).
include(":kit")
// app: the phone companion (remote control, sensory preview, safety guide).
include(":app")
// wear: the Wear OS play app.
include(":wear")
