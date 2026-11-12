package com.hejitech.toddlercam.app.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import com.hejitech.toddlercam.app.R
import com.hejitech.toddlercam.core.SoundType

class SoundManager(context: Context) {

    private val soundPool: SoundPool
    private val soundMap = mutableMapOf<SoundType, Int>()

    init {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(8)
            .setAudioAttributes(audioAttributes)
            .build()

        loadSounds(context)
    }

    private fun loadSounds(context: Context) {
        soundMap[SoundType.SHUTTER] = soundPool.load(context, R.raw.shutter, 1)
        soundMap[SoundType.WOOF] = soundPool.load(context, R.raw.woof, 1)
        soundMap[SoundType.MEOW] = soundPool.load(context, R.raw.meow, 1)
        soundMap[SoundType.QUACK] = soundPool.load(context, R.raw.quack, 1)
        soundMap[SoundType.GIGGLE] = soundPool.load(context, R.raw.giggle, 1)
        soundMap[SoundType.HORN] = soundPool.load(context, R.raw.horn, 1)
        soundMap[SoundType.BOING] = soundPool.load(context, R.raw.boing, 1)
        soundMap[SoundType.POP] = soundPool.load(context, R.raw.pop, 1)
    }

    fun play(sound: SoundType) {
        val soundId = soundMap[sound] ?: return
        soundPool.play(soundId, 1.0f, 1.0f, 1, 0, 1.0f)
    }

    fun release() {
        soundPool.release()
    }
}
