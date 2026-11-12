package com.hejitech.tinytouch.core

/**
 * Toddler play modes, the same five as the Apple Watch app (`ToddlerPlay/Sources/Models/GameMode.swift`).
 * [raw] is what the apps send each other, so an Android phone and an iPhone speak the same values.
 */
enum class GameMode(
    val raw: String,
    val title: String,
    val developmentalFocus: String,
    val coPlayPrompt: String,
    /** ARGB, as on the watch. */
    val themeColor: Long,
) {
    BUBBLES(
        "bubbles", "Bubble Pop", "Motor coordination & cause-and-effect",
        "Can you find the yellow star bubble?", 0xFF4DCCF2,
    ),
    ANIMALS(
        "animals", "Animal Friends", "Speech recognition & animal sounds",
        "What sound does the duck make? Quack quack!", 0xFFFF9933,
    ),
    SOUND_GARDEN(
        "soundGarden", "Sound Garden", "Auditory harmony & rhythm exploration",
        "Let's tap the colors and play music!", 0xFF66E680,
    ),
    SPARKLES(
        "sparkles", "Magic Sparkles", "Free sensory exploration & visual tracking",
        "Draw a big rainbow swirl with your finger!", 0xFFD973FF,
    ),
    LULLABY(
        "lullaby", "Sleepy Lullaby", "Calm sensory wind-down & soothing transition",
        "Shh, let's say goodnight to the sleepy moon.", 0xFF99B3FF,
    );

    companion object {
        /** Accepts lowercase, camelCase, TitleCase, spaced or legacy values ("Xylophone"), like the watch. */
        fun parse(value: String?): GameMode? {
            val n = value?.lowercase()?.trim()?.replace(" ", "")?.replace("_", "") ?: return null
            return when (n) {
                "bubbles", "bubble", "bubblepop" -> BUBBLES
                "animals", "animal", "animalfriends" -> ANIMALS
                "soundgarden", "sound", "xylophone", "chimes" -> SOUND_GARDEN
                "sparkles", "sparkle", "magicsparkles" -> SPARKLES
                "lullaby", "lullabies", "sleepymoon", "sleep" -> LULLABY
                else -> null
            }
        }
    }
}
