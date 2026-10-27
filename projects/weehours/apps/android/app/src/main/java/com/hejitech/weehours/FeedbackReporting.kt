package com.hejitech.weehours

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hejitech.weehours.core.LogCoding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

object FeedbackReporting {
    private const val ENDPOINT_URL = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback"
    private const val PROJECT_KEY = "pk_bdbb442ad21b2c2b2a6d63bdbd8621aa1b79"
    private val http = OkHttpClient()

    @Serializable
    private data class Payload(
        @SerialName("project_key") val projectKey: String,
        val category: String,
        val message: String,
        @SerialName("contact_email") val contactEmail: String? = null,
        @SerialName("app_version") val appVersion: String = "0.13.2",
        val platform: String = "android",
        @SerialName("os_version") val osVersion: String = "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})",
        @SerialName("device_model") val deviceModel: String = "${Build.MANUFACTURER} ${Build.MODEL}"
    )

    suspend fun submit(
        category: String,
        message: String,
        email: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        val bodyJson = LogCoding.json.encodeToString(
            Payload.serializer(),
            Payload(
                projectKey = PROJECT_KEY,
                category = category,
                message = message.trim(),
                contactEmail = email?.trim()?.ifEmpty { null }
            )
        )
        val req = Request.Builder()
            .url(ENDPOINT_URL)
            .header("Content-Type", "application/json")
            .header("x-project-key", PROJECT_KEY)
            .post(bodyJson.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()
        try {
            http.newCall(req).execute().use { resp ->
                resp.isSuccessful
            }
        } catch (_: Exception) {
            false
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackSheet(
    onDismiss: () -> Unit,
    onSubmitted: (Boolean) -> Unit
) {
    var category by remember { mutableStateOf("bug") }
    var message by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Send Feedback",
                style = MaterialTheme.typography.titleLarge
            )
            Text(
                text = "Found a bug or have an idea for Wee Hours? Let us know and it goes straight to our engineering queue.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "bug" to "Bug Report",
                    "feature" to "Feature Idea",
                    "general" to "General"
                ).forEach { (key, label) ->
                    FilterChip(
                        selected = category == key,
                        onClick = { category = key },
                        label = { Text(label) }
                    )
                }
            }

            OutlinedTextField(
                value = message,
                onValueChange = { message = it },
                label = { Text("What happened or what would help?") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 6
            )

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email (optional, for follow-up)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onDismiss, enabled = !submitting) {
                    Text("Cancel")
                }
                Button(
                    onClick = {
                        if (message.isBlank()) return@Button
                        submitting = true
                        scope.launch {
                            val ok = FeedbackReporting.submit(category, message, email)
                            submitting = false
                            onSubmitted(ok)
                            onDismiss()
                        }
                    },
                    enabled = message.isNotBlank() && !submitting
                ) {
                    Text(if (submitting) "Sending…" else "Send")
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
