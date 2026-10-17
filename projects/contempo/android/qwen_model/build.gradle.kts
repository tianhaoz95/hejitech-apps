// The bundled on-device model (Qwen3-0.6B, LiteRT-LM, ~345MB) as an install-time Play Asset
// Delivery pack, like :whisper_models. Not in git (over GitHub's file limit): fetch it with
// projects/contempo/scripts/fetch-models.sh before building. LiteRtLlm copies it to a file once.
plugins {
    id("com.android.asset-pack")
}

assetPack {
    packName.set("qwen_model")
    dynamicDelivery {
        deliveryType.set("install-time")
    }
}
