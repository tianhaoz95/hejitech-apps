package com.hejitech.headway.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsTransit
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.hejitech.headway.app.ui.screens.BoardScreen
import com.hejitech.headway.app.ui.screens.CommuteScreen
import com.hejitech.headway.app.ui.screens.GlassesScreen
import com.hejitech.headway.app.ui.screens.SettingsScreen
import com.hejitech.headway.app.ui.theme.HeadwayTheme

enum class MainTab(val title: String) {
    TRAINS("Trains"),
    COMMUTE("Commute"),
    GLASSES("Glasses"),
    SETTINGS("Settings")
}

class MainActivity : ComponentActivity() {

    private val viewModel: HeadwayViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            HeadwayTheme {
                var currentTab by remember { mutableStateOf(MainTab.TRAINS) }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        NavigationBar {
                            NavigationBarItem(
                                selected = currentTab == MainTab.TRAINS,
                                onClick = { currentTab = MainTab.TRAINS },
                                icon = { Icon(Icons.Default.DirectionsTransit, contentDescription = "Trains") },
                                label = { Text("Trains") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.COMMUTE,
                                onClick = { currentTab = MainTab.COMMUTE },
                                icon = { Icon(Icons.Default.Schedule, contentDescription = "Commute") },
                                label = { Text("Commute") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.GLASSES,
                                onClick = { currentTab = MainTab.GLASSES },
                                icon = { Icon(Icons.Default.Visibility, contentDescription = "Glasses") },
                                label = { Text("Glasses") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.SETTINGS,
                                onClick = { currentTab = MainTab.SETTINGS },
                                icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                                label = { Text("Settings") }
                            )
                        }
                    }
                ) { innerPadding ->
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        when (currentTab) {
                            MainTab.TRAINS -> BoardScreen(viewModel = viewModel)
                            MainTab.COMMUTE -> CommuteScreen(viewModel = viewModel)
                            MainTab.GLASSES -> GlassesScreen(viewModel = viewModel)
                            MainTab.SETTINGS -> SettingsScreen(viewModel = viewModel)
                        }
                    }
                }
            }
        }
    }
}
