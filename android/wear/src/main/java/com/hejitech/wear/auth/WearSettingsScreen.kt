package com.hejitech.wear.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.firebase.Firebase
import com.google.firebase.auth.auth

/**
 * Sign-out lives on its own page now (see MainActivity's HorizontalPager),
 * separate from WearCaptureScreen — confirmed live: with both on one page,
 * this would've sat right below capture's actual controls with no visual
 * separation strong enough to prevent mis-taps. Mirrors watchOS's equivalent
 * split (WatchSettingsScreen.swift) and the phone app's Settings screen
 * showing the signed-in email above the sign-out action.
 */
@Composable
fun WearSettingsScreen(onSignOut: () -> Unit) {
    val email = Firebase.auth.currentUser?.email
    Box(
        modifier = Modifier.fillMaxSize().padding(PaddingValues(horizontal = 16.dp, vertical = 8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (!email.isNullOrBlank()) {
                Text(
                    email,
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.onBackground.copy(alpha = 0.7f),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(12.dp))
            }
            Chip(
                onClick = onSignOut,
                icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
                label = { Text("Sign Out", style = MaterialTheme.typography.button) },
                colors = ChipDefaults.chipColors(backgroundColor = MaterialTheme.colors.error),
            )
        }
    }
}
