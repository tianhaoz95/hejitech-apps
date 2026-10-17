package com.hejitech.contempo.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.WavingHand
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hejitech.contempo.R
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.ui.capture.CaptureMode

private enum class OnboardingStep {
    WELCOME, CAPTURE_MODE, QUICK_CAPTURE, DONE
}

private val onboardingSteps = OnboardingStep.entries

/**
 * First-launch walkthrough — shown once per device (gated by
 * ServiceLocator.onboardingStore, see MainActivity's ContempoRoot) ahead of
 * AuthGate, so it appears regardless of whether this device already has a
 * signed-in account. Walks through the two settings worth deciding before
 * the user starts logging hours: default capture mode (voice-first vs
 * typing) and Quick Capture. Visually mirrors HelpWalkthroughDialog's
 * sequential-card chrome (progress dots, Skip, Back/Next) but full-screen,
 * since this is the very first thing shown, not an overlay on already-visible
 * content — and two of its four steps are interactive settings, not just
 * static explanation.
 */
@Composable
fun OnboardingScreen(onFinished: () -> Unit) {
    var step by remember { mutableIntStateOf(0) }
    val current = onboardingSteps[step]
    val isLastStep = current == OnboardingStep.DONE

    val captureModeStore = ServiceLocator.captureModeStore
    val quickCaptureStore = ServiceLocator.quickCaptureSettingsStore
    val defaultCaptureMode by captureModeStore.defaultMode.collectAsState()
    val quickCaptureEnabled by quickCaptureStore.enabled.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                onboardingSteps.forEachIndexed { index, _ ->
                    Box(
                        modifier = Modifier
                            .size(if (index == step) 18.dp else 8.dp, 8.dp)
                            .clip(CircleShape)
                            .background(
                                if (index == step) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.outlineVariant,
                            ),
                    )
                }
            }
            if (!isLastStep) {
                TextButton(onClick = onFinished) {
                    Text(stringResource(R.string.onboarding_skip_button))
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            when (current) {
                OnboardingStep.WELCOME -> WelcomeStep()
                OnboardingStep.CAPTURE_MODE -> CaptureModeStep(
                    selected = defaultCaptureMode,
                    onSelect = captureModeStore::setDefaultMode,
                )
                OnboardingStep.QUICK_CAPTURE -> QuickCaptureStep(
                    enabled = quickCaptureEnabled,
                    onEnabledChange = quickCaptureStore::setEnabled,
                )
                OnboardingStep.DONE -> DoneStep()
            }
        }

        Spacer(Modifier.height(24.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            if (step > 0) {
                OutlinedButton(onClick = { step -= 1 }) {
                    Text(stringResource(R.string.onboarding_back_button))
                }
            } else {
                Spacer(Modifier.height(1.dp))
            }
            Button(onClick = { if (isLastStep) onFinished() else step += 1 }) {
                Text(
                    stringResource(
                        if (isLastStep) R.string.onboarding_get_started_button
                        else R.string.onboarding_next_button,
                    ),
                )
            }
        }
    }
}

@Composable
private fun WelcomeStep() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        IconBadge(Icons.Filled.WavingHand)
        Spacer(Modifier.height(20.dp))
        Text(
            stringResource(R.string.onboarding_welcome_title),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.onboarding_welcome_body),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun CaptureModeStep(selected: CaptureMode, onSelect: (CaptureMode) -> Unit) {
    Column {
        Text(stringResource(R.string.onboarding_capture_mode_title), style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        // Same wording as Settings' "Default capture mode" hint, so this
        // reads as the same setting when the user later finds it there.
        Text(
            stringResource(R.string.settings_capture_default_mode_hint),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(20.dp))
        OnboardingOptionCard(
            icon = Icons.Filled.Mic,
            title = stringResource(R.string.onboarding_capture_mode_audio_first_title),
            description = stringResource(R.string.onboarding_capture_mode_audio_first_description),
            isSelected = selected == CaptureMode.AUDIO_FIRST,
            onClick = { onSelect(CaptureMode.AUDIO_FIRST) },
        )
        Spacer(Modifier.height(12.dp))
        OnboardingOptionCard(
            icon = Icons.Filled.Keyboard,
            title = stringResource(R.string.onboarding_capture_mode_typing_title),
            description = stringResource(R.string.onboarding_capture_mode_typing_description),
            isSelected = selected == CaptureMode.TYPING,
            onClick = { onSelect(CaptureMode.TYPING) },
        )
    }
}

@Composable
private fun QuickCaptureStep(enabled: Boolean, onEnabledChange: (Boolean) -> Unit) {
    Column {
        Text(stringResource(R.string.onboarding_quick_capture_title), style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        // Same copy as Settings' "About Quick Capture" explanation, so this
        // reads as the same explanation, not a shorter/different one.
        Text(
            stringResource(R.string.onboarding_quick_capture_intro),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        QuickCaptureBulletRow(Icons.Filled.Bolt, stringResource(R.string.onboarding_quick_capture_bullet_1))
        Spacer(Modifier.height(8.dp))
        QuickCaptureBulletRow(Icons.Filled.CloudUpload, stringResource(R.string.onboarding_quick_capture_bullet_2))
        Spacer(Modifier.height(8.dp))
        QuickCaptureBulletRow(Icons.Filled.AutoAwesome, stringResource(R.string.onboarding_quick_capture_bullet_3))
        Spacer(Modifier.height(20.dp))
        HorizontalDivider()
        Spacer(Modifier.height(16.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                stringResource(R.string.onboarding_quick_capture_enable_label),
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
            Switch(checked = enabled, onCheckedChange = onEnabledChange)
        }
    }
}

@Composable
private fun QuickCaptureBulletRow(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(12.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DoneStep() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        IconBadge(Icons.Filled.Verified)
        Spacer(Modifier.height(20.dp))
        Text(
            stringResource(R.string.onboarding_done_title),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.onboarding_done_body),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun IconBadge(icon: ImageVector) {
    Box(
        modifier = Modifier
            .size(88.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(40.dp),
        )
    }
}

@Composable
private fun OnboardingOptionCard(
    icon: ImageVector,
    title: String,
    description: String,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(
                if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                RoundedCornerShape(16.dp),
            )
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                shape = RoundedCornerShape(16.dp),
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Text(description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(8.dp))
        Icon(
            if (isSelected) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
        )
    }
}
