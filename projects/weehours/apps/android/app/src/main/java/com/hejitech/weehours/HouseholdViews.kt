package com.hejitech.weehours

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChildCare
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.NightlightRound
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.hejitech.weehours.core.Baby
import com.hejitech.weehours.core.Caregiver
import com.hejitech.weehours.core.Household
import com.hejitech.weehours.core.LogCoding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.roundToInt

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingScreen(model: AppModel) {
    val context = LocalContext.current
    var householdName by remember { mutableStateOf("Our Family") }
    var caregiverName by remember { mutableStateOf("Parent") }
    var babyName by remember { mutableStateOf("Baby") }
    var dateStr by remember {
        mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()))
    }
    var isExpecting by remember { mutableStateOf(false) }
    var bottleMl by remember { mutableDoubleStateOf(120.0) }
    var defaultFeed by remember { mutableStateOf("bottle") }

    var authMode by remember { mutableStateOf("setup") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignUp by remember { mutableStateOf(true) }
    var inviteCode by remember { mutableStateOf("") }
    var passToken by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(WeeColors.Amber),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.NightlightRound,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }
            Column {
                Text(
                    text = "Wee Hours",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Eyes-half-shut baby & pregnancy log",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(
                "setup" to "New Household",
                "join" to "Join by Code",
                "pass" to "Caregiver Pass",
                "email" to "Cloud Sign-In"
            ).forEach { (key, title) ->
                FilterChip(
                    selected = authMode == key,
                    onClick = { authMode = key },
                    label = { Text(title) }
                )
            }
        }

        when (authMode) {
            "setup" -> {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Set up your household",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        OutlinedTextField(
                            value = householdName,
                            onValueChange = { householdName = it },
                            label = { Text("Household Name") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = caregiverName,
                            onValueChange = { caregiverName = it },
                            label = { Text("Your Name (e.g. Mom, Dad, Alex)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        HorizontalDivider()
                        OutlinedTextField(
                            value = babyName,
                            onValueChange = { babyName = it },
                            label = { Text(if (isExpecting) "Baby's Name or Nickname" else "Child's Name") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Currently expecting (pregnancy mode)", fontWeight = FontWeight.Medium)
                                Text(
                                    "Enables fetal movement & 10-kick counter",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Switch(checked = isExpecting, onCheckedChange = { isExpecting = it })
                        }
                        OutlinedTextField(
                            value = dateStr,
                            onValueChange = { dateStr = it },
                            label = { Text(if (isExpecting) "Expected Due Date (YYYY-MM-DD)" else "Birth Date (YYYY-MM-DD)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Default Feed:", style = MaterialTheme.typography.bodyMedium)
                            FilterChip(
                                selected = defaultFeed == "bottle",
                                onClick = { defaultFeed = "bottle" },
                                label = { Text("Bottle") }
                            )
                            FilterChip(
                                selected = defaultFeed == "breast",
                                onClick = { defaultFeed = "breast" },
                                label = { Text("Nursing") }
                            )
                        }
                        OutlinedTextField(
                            value = bottleMl.roundToInt().toString(),
                            onValueChange = { v -> v.toDoubleOrNull()?.let { bottleMl = it.coerceIn(15.0, 500.0) } },
                            label = { Text("Standard Bottle Size (ml)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Button(
                            onClick = {
                                val parsedDate = LogCoding.parseISO(dateStr) ?: Date()
                                val baby = Baby(
                                    id = model.household.babyId,
                                    name = babyName.trim().ifEmpty { "Baby" },
                                    birthDate = if (isExpecting) null else parsedDate,
                                    dueDate = if (isExpecting) parsedDate else null,
                                    bottleMl = bottleMl,
                                    defaultFeed = defaultFeed,
                                    color = "amber"
                                )
                                val cgId = model.service.me
                                val updated = Household(
                                    id = model.household.id,
                                    name = householdName.trim().ifEmpty { "Our Family" },
                                    babies = listOf(baby),
                                    bottleMl = bottleMl,
                                    defaultFeed = defaultFeed,
                                    caregivers = listOf(Caregiver(id = cgId, name = caregiverName.trim().ifEmpty { "Parent" }, role = "parent"))
                                ).apply { trackMovementsIfExpecting() }
                                model.saveHousehold(updated)
                                model.markOnboardingDone()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = WeeColors.Amber)
                        ) {
                            Text("Start Logging", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            "join" -> {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("Join Partner's Household", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        OutlinedTextField(
                            value = inviteCode,
                            onValueChange = { inviteCode = it.uppercase(Locale.US) },
                            label = { Text("6-Character Invite Code") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = caregiverName,
                            onValueChange = { caregiverName = it },
                            label = { Text("Your Name") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Button(
                            onClick = { model.joinByInviteCode(inviteCode, caregiverName) },
                            enabled = inviteCode.isNotBlank(),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.GroupAdd, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Join Household")
                        }
                    }
                }
            }

            "pass" -> {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("Redeem Caregiver Pass", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Enter the temporary pass token shared by the parents (grandparent, nanny, or night nurse pass).",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        OutlinedTextField(
                            value = passToken,
                            onValueChange = { passToken = it },
                            label = { Text("Pass Token") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = caregiverName,
                            onValueChange = { caregiverName = it },
                            label = { Text("Your Name") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Button(
                            onClick = { model.redeemCaregiverPass(passToken, caregiverName) },
                            enabled = passToken.isNotBlank(),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Redeem Pass")
                        }
                    }
                }
            }

            "email" -> {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("Cloud Sync Sign-In", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = isSignUp, onClick = { isSignUp = true }, label = { Text("Create Account") })
                            FilterChip(selected = !isSignUp, onClick = { isSignUp = false }, label = { Text("Sign In") })
                        }
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            label = { Text("Email") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Password") },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = caregiverName,
                            onValueChange = { caregiverName = it },
                            label = { Text("Your Display Name") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Button(
                            onClick = { model.signInWithEmail(email, password, isSignUp, caregiverName) },
                            enabled = email.isNotBlank() && password.length >= 6,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Lock, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(if (isSignUp) "Sign Up & Sync" else "Sign In & Sync")
                        }
                        OutlinedButton(
                            onClick = {
                                val uri = model.beginGoogleOAuth()
                                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Continue with Google")
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ChildEditorSheet(
    initial: Baby?,
    canDelete: Boolean,
    onDismiss: () -> Unit,
    onSave: (Baby) -> Unit,
    onDelete: ((UUID) -> Unit)? = null
) {
    val existing = initial ?: Baby(name = "", birthDate = Date(), color = "amber")
    var name by remember { mutableStateOf(existing.name) }
    var isExpecting by remember { mutableStateOf(existing.isExpected) }
    val fmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    var dateText by remember {
        mutableStateOf(
            existing.dueDate?.let { fmt.format(it) }
                ?: existing.birthDate?.let { fmt.format(it) }
                ?: fmt.format(Date())
        )
    }
    var colorKey by remember { mutableStateOf(existing.color ?: "amber") }
    var defaultFeed by remember { mutableStateOf(existing.defaultFeed ?: "bottle") }
    var bottleMlText by remember { mutableStateOf((existing.bottleMl ?: 120.0).roundToInt().toString()) }
    var archived by remember { mutableStateOf(existing.archived) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(Icons.Default.ChildCare, contentDescription = null, tint = WeeColors.childColor(colorKey))
                Text(
                    text = if (initial == null) "Add Child" else "Edit ${existing.name.ifBlank { "Child" }}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Expecting (Pregnancy mode)", fontWeight = FontWeight.Medium)
                    Text(
                        "Tracks fetal movements & kick counts until birth",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(checked = isExpecting, onCheckedChange = { isExpecting = it })
            }

            OutlinedTextField(
                value = dateText,
                onValueChange = { dateText = it },
                label = { Text(if (isExpecting) "Due Date (YYYY-MM-DD)" else "Birth Date (YYYY-MM-DD)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Text("Color Badge", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf("amber", "sage", "sky", "plum", "coral", "teal").forEach { swatch ->
                    val c = WeeColors.childColor(swatch)
                    val selected = colorKey == swatch
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(c)
                            .border(
                                width = if (selected) 3.dp else 0.dp,
                                color = if (selected) MaterialTheme.colorScheme.onSurface else Color.Transparent,
                                shape = CircleShape
                            )
                            .clickable { colorKey = swatch },
                        contentAlignment = Alignment.Center
                    ) {
                        if (selected) {
                            Icon(Icons.Default.Check, contentDescription = swatch, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }

            if (!isExpecting) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Default Feed:")
                    FilterChip(
                        selected = defaultFeed == "bottle",
                        onClick = { defaultFeed = "bottle" },
                        label = { Text("Bottle") }
                    )
                    FilterChip(
                        selected = defaultFeed == "breast",
                        onClick = { defaultFeed = "breast" },
                        label = { Text("Nursing") }
                    )
                }

                OutlinedTextField(
                    value = bottleMlText,
                    onValueChange = { bottleMlText = it },
                    label = { Text("Bottle Size (ml)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            if (initial != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Archive child (hide from Now bar)")
                    Switch(checked = archived, onCheckedChange = { archived = it })
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (initial != null && canDelete && onDelete != null) {
                    TextButton(
                        onClick = {
                            onDelete(existing.id)
                            onDismiss()
                        },
                        colors = ButtonDefaults.textButtonColors(contentColor = WeeColors.Crimson)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Delete")
                    }
                } else {
                    Spacer(Modifier.width(1.dp))
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = {
                            val parsedDate = LogCoding.parseISO(dateText) ?: Date()
                            val saved = existing.copy(
                                name = name.trim().ifEmpty { "Baby" },
                                birthDate = if (isExpecting) null else parsedDate,
                                dueDate = if (isExpecting) parsedDate else null,
                                bottleMl = bottleMlText.toDoubleOrNull() ?: 120.0,
                                defaultFeed = defaultFeed,
                                color = colorKey,
                                archived = archived
                            )
                            onSave(saved)
                            onDismiss()
                        }
                    ) {
                        Text("Save")
                    }
                }
            }
            Spacer(modifier = Modifier.height(18.dp))
        }
    }
}
