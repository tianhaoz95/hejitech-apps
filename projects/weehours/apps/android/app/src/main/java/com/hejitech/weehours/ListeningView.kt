package com.hejitech.weehours

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MergeType
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.weehours.core.Capture
import com.hejitech.weehours.core.LogEvent

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ListeningSheet(model: AppModel) {
    val voiceState by model.voice.state.collectAsState()
    val liveTranscript by model.voice.liveTranscript.collectAsState()
    val rmsLevel by model.voice.rmsLevel.collectAsState()
    val errorMsg by model.voice.errorMessage.collectAsState()
    var manualInput by remember(liveTranscript) { mutableStateOf(liveTranscript) }
    val animatedLevel by animateFloatAsState(targetValue = rmsLevel.coerceIn(0.1f, 1f), label = "rms")

    val targetNames = model.shownBabies.joinToString(" & ") { it.name }

    ModalBottomSheet(
        onDismissRequest = { model.closeListeningSheet() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = when (voiceState) {
                            VoiceService.State.LISTENING -> "Listening for $targetNames…"
                            VoiceService.State.PROCESSING -> "Understanding…"
                            VoiceService.State.ERROR -> "Voice Capture"
                            VoiceService.State.IDLE -> "Speak or Type Log Entry"
                        },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Natural English or Chinese · e.g. \"fed 120ml 10 min ago\" or \"刚喝了120毫升\"",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = { model.closeListeningSheet() }) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            Box(
                modifier = Modifier
                    .size((72 + (animatedLevel * 36)).dp)
                    .clip(CircleShape)
                    .background(
                        if (voiceState == VoiceService.State.LISTENING)
                            WeeColors.Amber.copy(alpha = 0.25f)
                        else
                            MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(WeeColors.Amber)
                        .clickable {
                            if (voiceState == VoiceService.State.LISTENING) {
                                model.voice.stopListeningAndCommit()
                            } else {
                                model.voice.startListening()
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (voiceState == VoiceService.State.LISTENING) Icons.Default.Stop else Icons.Default.Mic,
                        contentDescription = "Microphone",
                        tint = Color.White,
                        modifier = Modifier.size(30.dp)
                    )
                }
            }

            if (!errorMsg.isNullOrBlank()) {
                Text(
                    text = errorMsg ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }

            OutlinedTextField(
                value = manualInput,
                onValueChange = { manualInput = it },
                label = { Text("What happened?") },
                placeholder = { Text("e.g. Wet and dirty diaper 15m ago") },
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = {
                    IconButton(
                        onClick = {
                            if (manualInput.isNotBlank()) {
                                model.voice.submitTypedTranscript(manualInput)
                            }
                        },
                        enabled = manualInput.isNotBlank()
                    ) {
                        Icon(Icons.Default.Send, contentDescription = "Submit", tint = WeeColors.Amber)
                    }
                }
            )

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "Tap an example phrase:",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        "Had 120 ml bottle",
                        "Nursed left side 15 min",
                        "Wet and dirty diaper",
                        "Fell asleep 10m ago",
                        "Woke up now",
                        "Pumped 90 ml",
                        "喝了120毫升奶",
                        "换了尿布又湿又脏",
                        "刚睡着"
                    ).forEach { sample ->
                        AssistChip(
                            onClick = { model.voice.submitTypedTranscript(sample) },
                            label = { Text(sample) }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewSheet(model: AppModel) {
    val revision by model.revision.collectAsState()
    val pendingCaptures: List<Capture> = remember(revision) { model.service.pendingCaptures() }
    val pendingPicks: List<LogEvent> = remember(revision) { model.service.pendingPickEvents() }
    val duplicates = remember(revision) { model.service.derived(baby = null).duplicates }

    ModalBottomSheet(
        onDismissRequest = { model.closeReviewSheet() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Review Queue",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = { model.closeReviewSheet() }) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            if (pendingCaptures.isEmpty() && pendingPicks.isEmpty() && duplicates.isEmpty()) {
                Text(
                    text = "All caught up! No ambiguous voice captures or duplicate entries need review.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 16.dp)
                )
            }

            if (pendingCaptures.isNotEmpty()) {
                Text(
                    text = "Voice Captures (${pendingCaptures.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                pendingCaptures.forEach { cap ->
                    val candidates = cap.interpretation?.candidates.orEmpty()
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "\"${cap.transcript ?: "Audio capture"}\"",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                            if (candidates.isNotEmpty()) {
                                candidates.forEachIndexed { idx, candidate ->
                                    Button(
                                        onClick = { model.resolveCaptureCandidate(cap.id, idx) },
                                        modifier = Modifier.fillMaxWidth(),
                                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.Amber)
                                    ) {
                                        Icon(Icons.Default.Check, contentDescription = null)
                                        Spacer(Modifier.width(6.dp))
                                        Text("Confirm: ${candidate.label}")
                                    }
                                }
                            } else {
                                Text(
                                    text = "Couldn't automatically parse this note.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(onClick = { model.dismissCapture(cap.id) }) {
                                    Text("Save as Note / Dismiss")
                                }
                            }
                        }
                    }
                }
            }

            if (duplicates.isNotEmpty()) {
                HorizontalDivider()
                Text(
                    text = "Possible Duplicates (${duplicates.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                val allLog = model.service.derived(baby = null)
                duplicates.forEach { flag ->
                    val orig = allLog.all.firstOrNull { it.id == flag.original }
                    val dup = allLog.all.firstOrNull { it.id == flag.duplicate }
                    if (orig != null && dup != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "${model.household.babyName(orig.babyId)} · ${model.service.describe(orig)}",
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "Logged twice within a short window (${orig.provenance.surface.rawValue} & ${dup.provenance.surface.rawValue}).",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = { model.resolveDuplicate(flag.original, flag.duplicate, merge = true) }
                                    ) {
                                        Icon(Icons.Default.MergeType, contentDescription = null)
                                        Spacer(Modifier.width(4.dp))
                                        Text("Merge into One")
                                    }
                                    OutlinedButton(
                                        onClick = { model.resolveDuplicate(flag.original, flag.duplicate, merge = false) }
                                    ) {
                                        Text("Keep Both")
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
