package com.hejitech.tinytouch.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.tinytouch.core.GameMode
import com.hejitech.tinytouch.kit.games.PlayEnv
import com.hejitech.tinytouch.kit.games.ToddlerPlayStage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamePreviewScreen(
    lowStimulation: Boolean,
    voiceEnabled: Boolean,
    onBack: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val modes = GameMode.entries

    val env = remember(lowStimulation, voiceEnabled) {
        PlayEnv(
            lowStimulation = lowStimulation,
            voiceEnabled = voiceEnabled,
            onTouch = {},
            crown = null
        )
    }

    Column(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        TopAppBar(
            title = { Text("Sensory Sandbox Preview", fontWeight = FontWeight.Bold) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Black,
                titleContentColor = Color.White,
                navigationIconContentColor = Color.White
            )
        )

        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color(0xFF1E1E1E),
            contentColor = Color.White,
            edgePadding = 8.dp
        ) {
            modes.forEachIndexed { index, mode ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = mode.title,
                            fontSize = 12.sp,
                            fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                            color = if (selectedTab == index) Color(mode.themeColor) else Color.Gray
                        )
                    }
                )
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            ToddlerPlayStage(
                mode = modes[selectedTab],
                env = env,
                showShield = false
            )
        }
    }
}
