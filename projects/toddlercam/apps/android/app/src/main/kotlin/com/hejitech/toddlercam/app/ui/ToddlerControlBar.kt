package com.hejitech.toddlercam.app.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ToddlerControlBar(
    onShutter: () -> Unit,
    onOpenGallery: () -> Unit,
    onOpenParentZone: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isPressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.88f else 1.0f, label = "shutterScale")

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Gallery Button (Guarded by Parent Gate)
        IconButton(
            onClick = onOpenGallery,
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(Color(0x66000000))
        ) {
            Icon(
                imageVector = Icons.Default.PhotoLibrary,
                contentDescription = "Gallery",
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
        }

        // Giant Bouncy Shutter Button (86dp)
        Box(
            modifier = Modifier
                .size(86.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(Color(0xFFFFB74D), Color(0xFFFF9800), Color(0xFFF57C00))
                    )
                )
                .pointerInput(Unit) {
                    detectTapGestures(
                        onPress = {
                            isPressed = true
                            tryAwaitRelease()
                            isPressed = false
                            onShutter()
                        }
                    )
                },
            contentAlignment = Alignment.Center
        ) {
            // Inner ring
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "📸", fontSize = 34.sp)
            }
        }

        // Parent Zone Button (Guarded by Parent Gate)
        IconButton(
            onClick = onOpenParentZone,
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(Color(0x66000000))
        ) {
            Icon(
                imageVector = Icons.Default.Settings,
                contentDescription = "Parent Zone",
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
        }
    }
}
