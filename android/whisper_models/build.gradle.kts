// Play Asset Delivery install-time asset pack for the two bundled Whisper
// ASR models (sherpa-onnx-whisper-tiny.en, sherpa-onnx-whisper-tiny — see
// agent/WhisperTranscriber.kt). Moved out of app/src/main/assets/ into their
// own versioned pack so that app updates that don't touch these ~99MB-each,
// essentially-static model files don't re-transfer them — they still ship
// with the very first install exactly as before (`deliveryType =
// "install-time"`, not on-demand), so there's no change to install-time UX
// or a first-run network dependency.
plugins {
    id("com.android.asset-pack")
}

assetPack {
    packName.set("whisper_models")
    dynamicDelivery {
        deliveryType.set("install-time")
    }
}
