package com.hejitech.contempo.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL

private const val CONFIG_URL = "https://contempo.hejitech.workers.dev/app-config.json"
private const val DEFAULT_CLOUD_AI_ENABLED = true

/**
 * Remote kill switch for cloud AI spend (`cloud_ai_enabled`), read from the Contempo Worker's
 * static app-config.json (projects/contempo/services/web/public/app-config.json): edit it and
 * push to flip it, no app release. Replaces Firebase Remote Config; defaults to on if unreachable.
 */
class RemoteConfigStore {
    private val _cloudAiEnabled = MutableStateFlow(DEFAULT_CLOUD_AI_ENABLED)
    val cloudAiEnabled: StateFlow<Boolean> = _cloudAiEnabled.asStateFlow()

    suspend fun refresh() {
        runCatching {
            val json = withContext(Dispatchers.IO) { URL(CONFIG_URL).readText() }
            _cloudAiEnabled.value = JSONObject(json).optBoolean("cloud_ai_enabled", DEFAULT_CLOUD_AI_ENABLED)
        }
    }
}
