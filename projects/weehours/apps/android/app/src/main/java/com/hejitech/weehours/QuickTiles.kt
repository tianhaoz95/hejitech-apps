package com.hejitech.weehours

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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.ChildFriendly
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.WaterDrop
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.hejitech.weehours.core.FieldValue
import com.hejitech.weehours.core.LogService
import com.hejitech.weehours.core.Session
import com.hejitech.weehours.core.SolidsSummary
import com.hejitech.weehours.core.StoolColor
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun QuickTilesSection(model: AppModel) {
    val now by model.nowTick.collectAsState()
    val revision by model.revision.collectAsState()
    val baby = remember(revision, now) { model.primaryBaby }
    val derived = remember(revision) { model.derived(baby.id) }
    val status = remember(revision, now) { model.status(baby.id, now) }
    val openFeed = remember(revision) { derived.openFeedSession() }
    val openSleep = remember(revision) { derived.openSession(Session.Kind.SLEEP) }

    var showFeedSheet by remember { mutableStateOf(false) }
    var showDiaperSheet by remember { mutableStateOf(false) }
    var showPumpSheet by remember { mutableStateOf(false) }
    var showSolidsSheet by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Row 1: Feed & Sleep
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Feed Tile
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (openFeed != null) WeeColors.FeedOrange.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surface
                ),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier
                    .weight(1f)
                    .clickable { showFeedSheet = true }
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(WeeColors.FeedOrange),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.LocalDrink, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                        Column {
                            Text("Feed", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                            val sub = if (openFeed != null) {
                                val mins = max(0L, (now.time - (openFeed.start?.time ?: now.time)) / 60000L)
                                "Open · ${mins}m"
                            } else {
                                status.nextSide?.let { "Next: ${it.replaceFirstChar { c -> c.uppercase() }}" }
                                    ?: model.formatVolume(model.household.bottleMl(baby.id))
                            }
                            Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                    if (openFeed != null) {
                        if (openFeed.kind == Session.Kind.BREAST) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                OutlinedButton(
                                    onClick = { model.switchNursingSide(baby.id) },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.SwapHoriz, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Switch")
                                }
                                Button(
                                    onClick = { model.finishNursing(baby.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = WeeColors.FeedOrange),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Done")
                                }
                            }
                        } else {
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                listOf(0.5 to "½", 0.75 to "¾", 1.0 to "All").forEach { (frac, label) ->
                                    Button(
                                        onClick = { model.finishBottle(fraction = frac, babyId = baby.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.FeedOrange),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(label)
                                    }
                                }
                            }
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Button(
                                onClick = { model.toggleFeed(baby.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.FeedOrange),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Start")
                            }
                            OutlinedButton(
                                onClick = { showFeedSheet = true },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("More")
                            }
                        }
                    }
                }
            }

            // Sleep Tile
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (openSleep != null) WeeColors.SleepBlue.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surface
                ),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier
                    .weight(1f)
                    .clickable { model.toggleSleep(baby.id) }
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(WeeColors.SleepBlue),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Bedtime, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                        Column {
                            Text("Sleep", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                            val sub = if (openSleep != null) {
                                val mins = max(0L, (now.time - (openSleep.start?.time ?: now.time)) / 60000L)
                                "Asleep · ${mins}m"
                            } else {
                                status.lastWakeAt?.let {
                                    val mins = max(0L, (now.time - it.time) / 60000L)
                                    "Awake ${mins}m"
                                } ?: "Tap when asleep"
                            }
                            Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                    Button(
                        onClick = { model.toggleSleep(baby.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.SleepBlue),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (openSleep != null) "Woke Up" else "Fell Asleep")
                    }
                }
            }
        }

        // Row 2: Diaper Quick Bar (Wet / Dirty / Both / Details)
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(WeeColors.DiaperGreen),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.WaterDrop, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                        Text("Diaper", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    }
                    TextButton(onClick = { showDiaperSheet = true }) {
                        Text("Color & Details")
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { model.logDiaper(kind = "wet", babyId = baby.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.DiaperGreen),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Wet")
                    }
                    Button(
                        onClick = { model.logDiaper(kind = "dirty", babyId = baby.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.DiaperGreen),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Dirty")
                    }
                    Button(
                        onClick = { model.logDiaper(kind = "both", babyId = baby.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.DiaperGreen),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Both")
                    }
                }
            }
        }

        // Row 3: Pumping & Solids (if enabled)
        val enabled = model.household.enabled
        if ("pumping" in enabled || "solids" in enabled) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if ("pumping" in enabled) {
                    OutlinedButton(
                        onClick = { showPumpSheet = true },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.LocalDrink, contentDescription = null, tint = WeeColors.PumpTeal)
                        Spacer(Modifier.width(6.dp))
                        Text("Log Pumping")
                    }
                }
                if ("solids" in enabled) {
                    OutlinedButton(
                        onClick = { showSolidsSheet = true },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Restaurant, contentDescription = null, tint = WeeColors.SolidsSage)
                        Spacer(Modifier.width(6.dp))
                        Text("Log Solids")
                    }
                }
            }
        }
    }

    if (showFeedSheet) {
        FeedSheet(model = model, onDismiss = { showFeedSheet = false })
    }
    if (showDiaperSheet) {
        DiaperSheet(model = model, onDismiss = { showDiaperSheet = false })
    }
    if (showPumpSheet) {
        PumpSheet(model = model, onDismiss = { showPumpSheet = false })
    }
    if (showSolidsSheet) {
        SolidsSheet(model = model, onDismiss = { showSolidsSheet = false })
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FeedSheet(model: AppModel, onDismiss: () -> Unit) {
    val baby = model.primaryBaby
    val defaultMl = model.household.bottleMl(baby.id)
    var mlText by remember { mutableStateOf(defaultMl.roundToInt().toString()) }
    var contents by remember { mutableStateOf("breast_milk") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Log Feed for ${baby.name}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            Text("Nursing (Breastfeeding)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = {
                        model.startNursing("left", baby.id)
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = WeeColors.FeedOrange),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Start Left (L)")
                }
                Button(
                    onClick = {
                        model.startNursing("right", baby.id)
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = WeeColors.FeedOrange),
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Start Right (R)")
                }
            }

            HorizontalDivider()

            Text("Bottle Feed", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(60, 90, 120, 150, 180, 210).forEach { preset ->
                    FilterChip(
                        selected = mlText == preset.toString(),
                        onClick = { mlText = preset.toString() },
                        label = { Text("${preset} ml") }
                    )
                }
            }

            OutlinedTextField(
                value = mlText,
                onValueChange = { mlText = it },
                label = { Text("Amount (ml)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "breast_milk" to "Breast Milk",
                    "formula" to "Formula",
                    "mixed" to "Mixed"
                ).forEach { (k, label) ->
                    FilterChip(
                        selected = contents == k,
                        onClick = { contents = k },
                        label = { Text(label) }
                    )
                }
            }

            Button(
                onClick = {
                    val ml = mlText.toDoubleOrNull() ?: defaultMl
                    model.finishBottle(consumedMl = ml, contents = contents, babyId = baby.id)
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.FeedOrange),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Log Complete Bottle (${mlText} ml)")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiaperSheet(model: AppModel, onDismiss: () -> Unit) {
    val baby = model.primaryBaby
    var kind by remember { mutableStateOf("dirty") }
    var stoolColor by remember { mutableStateOf<String?>(null) }
    var rash by remember { mutableStateOf(false) }
    var blowout by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Diaper Details · ${baby.name}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("wet" to "Wet", "dirty" to "Dirty", "both" to "Both").forEach { (k, label) ->
                    FilterChip(
                        selected = kind == k,
                        onClick = { kind = k },
                        label = { Text(label) }
                    )
                }
            }

            if (kind == "dirty" || kind == "both") {
                Text("Stool Color", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val swatchColors = mapOf(
                        StoolColor.YELLOW to "#E5B832",
                        StoolColor.BROWN to "#7A5230",
                        StoolColor.GREEN to "#558246",
                        StoolColor.BLACK to "#262626",
                        StoolColor.RED to "#C93B3B",
                        StoolColor.WHITE to "#E8E4DC"
                    )
                    StoolColor.entries.forEach { swatch ->
                        val hexColor = Color(android.graphics.Color.parseColor(swatchColors[swatch] ?: "#7A5230"))
                        val isSelected = stoolColor == swatch.rawValue
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.clickable { stoolColor = swatch.rawValue }
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(hexColor)
                                    .border(
                                        width = if (isSelected) 3.dp else 1.dp,
                                        color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Gray,
                                        shape = CircleShape
                                    )
                            )
                            Text(swatch.label, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
                stoolColor?.let { code ->
                    if (StoolColor.fromRaw(code)?.isFlagged(null) == true) {
                        Text(
                            text = "Note: Red, white/chalky, or black stool can warrant checking with your pediatrician.",
                            color = WeeColors.Crimson,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Diaper rash noticed")
                Switch(checked = rash, onCheckedChange = { rash = it })
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Blowout / leak")
                Switch(checked = blowout, onCheckedChange = { blowout = it })
            }

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note (optional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Button(
                onClick = {
                    model.logDiaper(
                        kind = kind,
                        stoolColor = stoolColor,
                        rash = rash,
                        blowout = blowout,
                        note = note.ifBlank { null },
                        babyId = baby.id
                    )
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.DiaperGreen),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Diaper")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PumpSheet(model: AppModel, onDismiss: () -> Unit) {
    var leftText by remember { mutableStateOf("60") }
    var rightText by remember { mutableStateOf("60") }
    var durationText by remember { mutableStateOf("15") }
    var storage by remember { mutableStateOf("fridge") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Log Pumping", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = leftText,
                    onValueChange = { leftText = it },
                    label = { Text("Left (ml)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = rightText,
                    onValueChange = { rightText = it },
                    label = { Text("Right (ml)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = durationText,
                onValueChange = { durationText = it },
                label = { Text("Duration (minutes)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "fridge" to "Fridge (4d)",
                    "freezer" to "Freezer (6m)",
                    "fed_now" to "Fed Immediately"
                ).forEach { (k, label) ->
                    FilterChip(
                        selected = storage == k,
                        onClick = { storage = k },
                        label = { Text(label) }
                    )
                }
            }

            Button(
                onClick = {
                    val l = leftText.toDoubleOrNull() ?: 0.0
                    val r = rightText.toDoubleOrNull() ?: 0.0
                    val dur = durationText.toDoubleOrNull()
                    model.logPump(
                        leftMl = l,
                        rightMl = r,
                        totalMl = l + r,
                        durationMinutes = dur,
                        storage = if (storage == "fed_now") null else storage
                    )
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.PumpTeal),
                modifier = Modifier.fillMaxWidth()
            ) {
                val total = (leftText.toIntOrNull() ?: 0) + (rightText.toIntOrNull() ?: 0)
                Text("Log Pump ($total ml)")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SolidsSheet(model: AppModel, onDismiss: () -> Unit) {
    val selectedFoods = remember { mutableStateListOf<String>() }
    var customFood by remember { mutableStateOf("") }
    var reaction by remember { mutableStateOf("liked") }
    var note by remember { mutableStateOf("") }

    val commonFoods = listOf(
        "avocado", "banana", "sweet potato", "oatmeal", "apple", "pear",
        "carrot", "peas", "broccoli", "egg", "peanut", "yogurt", "salmon",
        "chicken", "tofu", "strawberry", "blueberry", "wheat toast"
    )

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Log Solids · ${model.primaryBaby.name}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            Text("Tap foods tried today (allergens highlighted):", style = MaterialTheme.typography.labelLarge)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                commonFoods.forEach { food ->
                    val isAllergen = SolidsSummary.topAllergens.any { spec -> spec.keywords.any { kw -> food.contains(kw) } }
                    val picked = food in selectedFoods
                    FilterChip(
                        selected = picked,
                        onClick = {
                            if (picked) selectedFoods.remove(food) else selectedFoods.add(food)
                        },
                        label = {
                            Text(if (isAllergen) "$food ⚠️" else food)
                        }
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = customFood,
                    onValueChange = { customFood = it },
                    label = { Text("Add another food") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                Button(
                    onClick = {
                        val trimmed = customFood.trim().lowercase(Locale.US)
                        if (trimmed.isNotEmpty() && trimmed !in selectedFoods) {
                            selectedFoods.add(trimmed)
                            customFood = ""
                        }
                    }
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add")
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    "loved" to "Loved",
                    "liked" to "Accepted",
                    "meh" to "Meh",
                    "rash" to "Reaction/Rash"
                ).forEach { (k, label) ->
                    FilterChip(
                        selected = reaction == k,
                        onClick = { reaction = k },
                        label = { Text(label) }
                    )
                }
            }

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Notes") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Button(
                onClick = {
                    val foods = selectedFoods.toList() + listOfNotNull(customFood.trim().takeIf { it.isNotEmpty() })
                    if (foods.isNotEmpty()) {
                        model.logSolids(foods = foods, reaction = reaction, note = note.ifBlank { null })
                        onDismiss()
                    }
                },
                enabled = selectedFoods.isNotEmpty() || customFood.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.SolidsSage),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Solids")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GrowthSheet(model: AppModel, onDismiss: () -> Unit) {
    val baby = model.primaryBaby
    var weightKg by remember { mutableStateOf("") }
    var lengthCm by remember { mutableStateOf("") }
    var headCm by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    val ageDays = remember(baby) {
        val bd = baby.birthDate ?: Date()
        max(0.0, (System.currentTimeMillis() - bd.time) / 86_400_000.0)
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Log Growth · ${baby.name}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = weightKg,
                onValueChange = { weightKg = it },
                label = { Text("Weight (kg, e.g. 4.8)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                supportingText = {
                    weightKg.toDoubleOrNull()?.let { w ->
                        Text("${(w * 1000).roundToInt()} g")
                    }
                }
            )

            OutlinedTextField(
                value = lengthCm,
                onValueChange = { lengthCm = it },
                label = { Text("Length / Height (cm, e.g. 56.5)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = headCm,
                onValueChange = { headCm = it },
                label = { Text("Head Circumference (cm, e.g. 38.0)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note (e.g. 2-month checkup)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Button(
                onClick = {
                    model.logGrowth(
                        weightKg = weightKg.toDoubleOrNull(),
                        lengthCm = lengthCm.toDoubleOrNull(),
                        headCm = headCm.toDoubleOrNull(),
                        note = note.ifBlank { null },
                        babyId = baby.id
                    )
                    onDismiss()
                },
                enabled = weightKg.toDoubleOrNull() != null || lengthCm.toDoubleOrNull() != null || headCm.toDoubleOrNull() != null,
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.GrowthPurple),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Measurement")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun CareActivitySheet(
    model: AppModel,
    initialCategory: String = "temperature",
    onDismiss: () -> Unit
) {
    val baby = model.primaryBaby
    var category by remember { mutableStateOf(initialCategory) }
    var celsiusText by remember { mutableStateOf("37.0") }
    var medName by remember { mutableStateOf("Acetaminophen") }
    var medDose by remember { mutableStateOf("2.5 ml") }
    var durationMin by remember { mutableStateOf("15") }
    var milestoneTitle by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    val lastMedEvent = remember(category, medName) {
        if (category == "medicine") {
            model.derived(baby.id).lastMedicine(name = medName)
        } else null
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Care & Health · ${baby.name}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf(
                    "temperature" to "Temperature",
                    "medicine" to "Medicine",
                    "vitamin_d" to "Vitamin D",
                    "bath" to "Bath",
                    "tummy_time" to "Tummy Time",
                    "skin_to_skin" to "Skin-to-Skin",
                    "crying" to "Crying",
                    "milestone" to "Milestone",
                    "custom" to "Note"
                ).forEach { (k, label) ->
                    FilterChip(
                        selected = category == k,
                        onClick = { category = k },
                        label = { Text(label) }
                    )
                }
            }

            when (category) {
                "temperature" -> {
                    OutlinedTextField(
                        value = celsiusText,
                        onValueChange = { celsiusText = it },
                        label = { Text("Temperature (°C)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    val c = celsiusText.toDoubleOrNull() ?: 37.0
                    if (c >= 38.0) {
                        Text(
                            text = "⚠️ Fever threshold (≥ 38.0°C / 100.4°F). For infants under 3 months, contact your pediatrician promptly.",
                            color = WeeColors.Crimson,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
                "medicine" -> {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("Acetaminophen", "Ibuprofen", "Gas Drops", "Saline Drops").forEach { preset ->
                            FilterChip(
                                selected = medName == preset,
                                onClick = { medName = preset },
                                label = { Text(preset) }
                            )
                        }
                    }
                    if (lastMedEvent != null) {
                        val hoursAgo = ((System.currentTimeMillis() - lastMedEvent.occurredAt.time) / 3600_000.0)
                        Text(
                            text = String.format(Locale.US, "Last %s dose: %.1f hours ago", medName, hoursAgo),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (hoursAgo < 4.0) WeeColors.Crimson else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    OutlinedTextField(
                        value = medName,
                        onValueChange = { medName = it },
                        label = { Text("Medication Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = medDose,
                        onValueChange = { medDose = it },
                        label = { Text("Dose (e.g. 2.5 ml)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
                "tummy_time", "skin_to_skin", "crying", "bath" -> {
                    OutlinedTextField(
                        value = durationMin,
                        onValueChange = { durationMin = it },
                        label = { Text("Duration (minutes)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    if (CoreBridge.isTimedActivity(category)) {
                        OutlinedButton(
                            onClick = {
                                model.startTimedActivity(category, baby.id)
                                onDismiss()
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Start Live Timer Instead")
                        }
                    }
                }
                "milestone" -> {
                    OutlinedTextField(
                        value = milestoneTitle,
                        onValueChange = { milestoneTitle = it },
                        label = { Text("Milestone (e.g. First smile, Rolled over)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            }

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note (optional)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Button(
                onClick = {
                    val fields = mutableMapOf<String, FieldValue>()
                    if (note.isNotBlank()) fields["note"] = FieldValue.Str(note.trim())
                    when (category) {
                        "temperature" -> {
                            celsiusText.toDoubleOrNull()?.let { fields["celsius"] = FieldValue.Num(it) }
                        }
                        "medicine" -> {
                            fields["name"] = FieldValue.Str(medName.trim())
                            if (medDose.isNotBlank()) fields["dose"] = FieldValue.Str(medDose.trim())
                        }
                        "tummy_time", "skin_to_skin", "crying", "bath" -> {
                            durationMin.toDoubleOrNull()?.let { fields["duration_min"] = FieldValue.Num(it) }
                        }
                        "milestone" -> {
                            if (milestoneTitle.isNotBlank()) fields["title"] = FieldValue.Str(milestoneTitle.trim())
                        }
                    }
                    model.logCare(category = category, fields = fields, babyId = baby.id)
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.CareCoral),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Log ${category.replace('_', ' ').replaceFirstChar { it.uppercase() }}")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
