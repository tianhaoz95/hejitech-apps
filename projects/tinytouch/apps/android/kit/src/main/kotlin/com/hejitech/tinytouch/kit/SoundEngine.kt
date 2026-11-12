package com.hejitech.tinytouch.kit

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import android.speech.tts.TextToSpeech
import android.util.Log
import com.hejitech.tinytouch.core.Sounds
import java.util.Locale

/**
 * Low-latency sound effects, the lullaby loop and spoken words (the watch's `SoundManager`).
 * Short WAVs are preloaded into a [SoundPool] so a tap sounds at once; the lullaby loops in a
 * [MediaPlayer]; words use the system text-to-speech with the same warm, slow child voice
 * (pitch 1.25). Watches without a speaker or a TTS voice simply stay quiet.
 */
object SoundEngine {
    private const val VOLUME = 0.8f
    private const val TAG = "TinyTouchSound"

    private val RAW = mapOf(
        "bubble_pop" to R.raw.bubble_pop, "boing" to R.raw.boing, "sparkle" to R.raw.sparkle,
        "quack" to R.raw.quack, "woof" to R.raw.woof, "meow" to R.raw.meow, "moo" to R.raw.moo,
        "ribbit" to R.raw.ribbit, "unlock" to R.raw.unlock,
        "chime_c4" to R.raw.chime_c4, "chime_d4" to R.raw.chime_d4, "chime_e4" to R.raw.chime_e4,
        "chime_g4" to R.raw.chime_g4, "chime_a4" to R.raw.chime_a4, "chime_c5" to R.raw.chime_c5,
    )

    var soundEnabled: Boolean = true
        set(value) {
            field = value
            if (!value) stopLullaby()
        }
    var voiceEnabled: Boolean = true

    private lateinit var app: Context
    private var pool: SoundPool? = null
    private val ids = HashMap<String, Int>()
    private var lullaby: MediaPlayer? = null
    private var tts: TextToSpeech? = null
    @Volatile private var ttsReady = false

    fun init(context: Context) {
        if (pool != null) return
        app = context.applicationContext
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val p = SoundPool.Builder().setMaxStreams(8).setAudioAttributes(attrs).build()
        Sounds.ALL.forEach { name -> RAW[name]?.let { ids[name] = p.load(app, it, 1) } }
        pool = p
        tts = TextToSpeech(app) { status ->
            val engine = tts ?: return@TextToSpeech
            if (status == TextToSpeech.SUCCESS) {
                engine.language = Locale.US
                engine.setPitch(1.25f) // warm, friendly child-friendly pitch
                engine.setSpeechRate(0.85f) // gentle, slower speed for toddlers
                ttsReady = true
            } else {
                Log.i(TAG, "No text-to-speech on this device; spoken words stay off")
            }
        }
    }

    fun play(name: String) {
        if (!soundEnabled) return
        val id = ids[name] ?: return
        pool?.play(id, VOLUME, VOLUME, 1, 0, 1f)
    }

    fun pop() = play("bubble_pop")
    fun boing() = play("boing")
    fun sparkle() = play("sparkle")
    fun chime(index: Int) = play(Sounds.chime(index))
    fun animal(name: String) = play(Sounds.animal(name))
    fun unlockChime() = play("unlock")

    fun startLullaby() {
        if (!soundEnabled || !::app.isInitialized) return
        if (lullaby?.isPlaying == true) return
        stopLullaby()
        lullaby = try {
            MediaPlayer.create(app, R.raw.lullaby)?.apply {
                isLooping = true
                setVolume(VOLUME * 0.7f, VOLUME * 0.7f)
                start()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not start lullaby", e)
            null
        }
    }

    fun stopLullaby() {
        lullaby?.let {
            runCatching { it.stop() }
            it.release()
        }
        lullaby = null
    }

    fun speak(text: String) {
        if (!voiceEnabled || !soundEnabled || !ttsReady) return
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tinytouch")
    }
}
