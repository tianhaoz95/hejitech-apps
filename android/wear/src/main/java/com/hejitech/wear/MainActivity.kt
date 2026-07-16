package com.hejitech.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

/**
 * Placeholder only — real Wear capture (mic tap -> parse -> confirm on the
 * watch, syncing to the same Firestore entries as the phone app) is
 * fast-follow, see reports/mvp-scope-v0.html Section 5.1. This exists so
 * `:wear` is a real, installable module today, not just a folder name.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { WearComingSoonScreen() }
    }
}

@Composable
private fun WearComingSoonScreen() {
    MaterialTheme {
        Box(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = stringResource(R.string.wear_coming_soon),
                textAlign = TextAlign.Center,
            )
        }
    }
}
