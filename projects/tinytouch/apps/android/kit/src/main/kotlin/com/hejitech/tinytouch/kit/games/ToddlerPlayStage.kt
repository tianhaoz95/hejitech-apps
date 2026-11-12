package com.hejitech.tinytouch.kit.games

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.TextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.tinytouch.core.GameMode
import com.hejitech.tinytouch.core.formatRemaining
import kotlinx.coroutines.delay

@Composable
fun ToddlerPlayStage(
    mode: GameMode,
    env: PlayEnv,
    isTimerActive: Boolean = false,
    remainingSeconds: Int = 0,
    lockHoldDuration: Double = 3.0,
    onParentUnlocked: () -> Unit = {},
    showShield: Boolean = true,
    modifier: Modifier = Modifier,
) {
    var showCoPlayToast by remember { mutableStateOf(true) }

    LaunchedEffect(mode) {
        showCoPlayToast = true
        delay(4000)
        showCoPlayToast = false
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // Active Game Canvas
        when (mode) {
            GameMode.BUBBLES -> BubblePopGame(env = env)
            GameMode.ANIMALS -> AnimalFriendsGame(env = env)
            GameMode.SOUND_GARDEN -> SoundGardenGame(env = env)
            GameMode.SPARKLES -> SparkleCanvasGame(env = env)
            GameMode.LULLABY -> SleepyMoonGame(env = env)
        }

        // Top Bar: Shield & subtle Timer indicator
        if (showShield) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 12.dp, top = 8.dp)
            ) {
                ParentShieldButton(
                    holdDurationSeconds = lockHoldDuration,
                    onUnlocked = onParentUnlocked
                )

                if (isTimerActive) {
                    Spacer(modifier = Modifier.padding(start = 6.dp))
                    Box(
                        modifier = Modifier
                            .background(Color.Black.copy(alpha = 0.8f), shape = RoundedCornerShape(12.dp))
                            .border(1.dp, Color(0xFFFF9900).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        BasicText(
                            text = "⏱ ${formatRemaining(true, remainingSeconds)}",
                            style = TextStyle(
                                color = Color(0xFFFF9900),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                }
            }
        }

        // Bottom Co-Play Guidance Banner (temporary prompt for caregiver)
        AnimatedVisibility(
            visible = showCoPlayToast,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 12.dp, start = 16.dp, end = 16.dp)
        ) {
            Box(
                modifier = Modifier
                    .background(Color.Black.copy(alpha = 0.85f), shape = CircleShape)
                    .border(1.dp, Color.White.copy(alpha = 0.2f), shape = CircleShape)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                BasicText(
                    text = mode.coPlayPrompt,
                    style = TextStyle(
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                )
            }
        }
    }
}
