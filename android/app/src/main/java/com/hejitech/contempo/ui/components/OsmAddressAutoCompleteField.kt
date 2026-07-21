package com.hejitech.contempo.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.PopupProperties
import com.hejitech.contempo.data.OsmAddressRepository
import com.hejitech.contempo.data.OsmAddressSuggestion
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun OsmAddressAutoCompleteField(
    value: String,
    onValueChange: (String) -> Unit,
    label: @Composable (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true
) {
    var suggestions by remember { mutableStateOf<List<OsmAddressSuggestion>>(emptyList()) }
    var expanded by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }

    val repository = remember { OsmAddressRepository() }
    val scope = rememberCoroutineScope()
    var searchJob by remember { mutableStateOf<Job?>(null) }

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = { newValue ->
                onValueChange(newValue)

                searchJob?.cancel()
                if (newValue.trim().length >= 3) {
                    isLoading = true
                    expanded = true
                    searchJob = scope.launch {
                        // 3 seconds maximum rate limit throttle
                        delay(3000)
                        suggestions = repository.searchAddress(newValue)
                        isLoading = false
                        expanded = suggestions.isNotEmpty()
                    }
                } else {
                    isLoading = false
                    suggestions = emptyList()
                    expanded = false
                }
            },
            label = label,
            trailingIcon = {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = singleLine
        )

        DropdownMenu(
            expanded = expanded && (isLoading || suggestions.isNotEmpty()),
            onDismissRequest = { expanded = false },
            properties = PopupProperties(focusable = false)
        ) {
            if (isLoading) {
                DropdownMenuItem(
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Start,
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Searching address (3s limit)...",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.Gray
                            )
                        }
                    },
                    onClick = { }
                )
            } else {
                suggestions.forEach { suggestion ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(
                                    text = suggestion.title,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                if (suggestion.subtitle.isNotBlank()) {
                                    Text(
                                        text = suggestion.subtitle,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color.Gray
                                    )
                                }
                            }
                        },
                        onClick = {
                            onValueChange(suggestion.fullAddress)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
