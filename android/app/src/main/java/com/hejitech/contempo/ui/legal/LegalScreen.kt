package com.hejitech.contempo.ui.legal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.hejitech.contempo.R

/** "privacy" or "terms" — see LegalRoute in ContempoNavHost.kt. */
enum class LegalDoc(val routeArg: String, val document: LegalDocument) {
    PRIVACY("privacy", PrivacyPolicy),
    TERMS("terms", TermsOfService),
    ;

    companion object {
        fun fromRouteArg(arg: String?): LegalDoc = entries.find { it.routeArg == arg } ?: PRIVACY
    }
}

@Composable
fun LegalScreen(doc: LegalDoc, onBack: () -> Unit) {
    val document = doc.document

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.nav_back))
            }
        }
        Spacer(Modifier.height(8.dp))

        Text(document.title, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            document.effectiveDateNotice,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        document.sections.forEachIndexed { index, section ->
            Text(section.heading, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            section.paragraphs.forEach { paragraph ->
                Text(
                    paragraph,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
            }
            if (index != document.sections.lastIndex) {
                Spacer(Modifier.height(8.dp))
                HorizontalDivider()
                Spacer(Modifier.height(16.dp))
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
