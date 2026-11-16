package com.hejitech.fitloop.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.fitloop.ProStore
import kotlinx.coroutines.launch

/** What FitLoop Pro is called and shows; the rest of the screen is the same in every HEJI app. */
private object ProCopy {
    const val NAME = "FitLoop"
    const val HOOK = "Your agent writes the plan. You just press play."
    val perks: List<Pair<ImageVector, String>> = listOf(
        Icons.Filled.Checklist to "Daily plan",
        Icons.Filled.FitnessCenter to "Workout player",
        Icons.Filled.Favorite to "Heart rate",
        Icons.Filled.Forum to "Check-ins",
    )
    const val GLIMPSE_TITLE = "Today"
    val glimpse = listOf(
        Triple("7:00", "Push day", "6 exercises · 50 min"),
        Triple("8:30", "Breakfast", "Greek yogurt bowl · 31 g protein"),
        Triple("12:30", "Lunch", "Chicken rice bowl · 42 g protein"),
        Triple("19:00", "Dinner", "Salmon and greens · 38 g protein"),
        Triple("21:30", "Check-in", "How did today feel?"),
    )
}

/**
 * The paywall ("Peek", as on iPhone and the web): a sheet over a blurred sample of the app. Shown after
 * sign-in when the account has no FitLoop Pro from any store; Google Play sells it here.
 */
@Composable
fun ProScreen(store: ProStore, site: String, email: String?, onSignOut: () -> Unit) {
    val offers by store.offers.collectAsState()
    val busy by store.busy.collectAsState()
    val error by store.error.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selected by rememberSaveable { mutableStateOf(ProStore.ANNUAL) }
    val accent = MaterialTheme.colorScheme.primary
    fun open(url: String) = context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // A fixed sample, never the live app: nothing loads before Pro.
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(20.dp).blur(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(ProCopy.GLIMPSE_TITLE, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            for ((lead, title, detail) in ProCopy.glimpse) {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(14.dp)) {
                    Text(lead, color = accent, fontWeight = FontWeight.Bold, modifier = Modifier.width(72.dp))
                    Column { Text(title, fontWeight = FontWeight.SemiBold); Text(detail, style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.background.copy(alpha = 0.6f)))))

        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().heightIn(max = 760.dp)
                .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
                .background(MaterialTheme.colorScheme.surfaceContainer)
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.align(Alignment.CenterHorizontally).size(width = 36.dp, height = 5.dp).clip(RoundedCornerShape(3.dp)).background(MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Lock, null, tint = accent, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text("UNLOCK ${ProCopy.NAME.uppercase()}", color = accent, fontWeight = FontWeight.ExtraBold, fontSize = 12.5.sp, letterSpacing = 0.8.sp)
            }
            Text(ProCopy.HOOK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for ((icon, label) in ProCopy.perks) {
                    Column(
                        Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(12.dp)).background(accent.copy(alpha = 0.13f)).padding(vertical = 10.dp, horizontal = 2.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(icon, null, tint = accent, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.height(6.dp))
                        Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, lineHeight = 13.sp)
                    }
                }
            }

            val loaded by store.offersLoaded.collectAsState()
            if (offers.annual == null && offers.lifetime == null) {
                if (!loaded) CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                else {
                    Text("FitLoop Pro isn't available from Google Play right now. Check that FitLoop came from Google Play and that you're signed in to it, then try again.", style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { store.restore() }, enabled = busy == null) { Text("Try Again") }
                }
            }
            offers.annualPrice?.let { price ->
                PlanRow(
                    title = "Yearly",
                    detail = if (offers.trial) "1 week free, then $price/year" else "$price every year",
                    price = "$price/year",
                    tag = if (offers.trial) "1 WEEK FREE" else null,
                    on = selected == ProStore.ANNUAL,
                ) { selected = ProStore.ANNUAL }
            }
            offers.lifetimePrice?.let { price ->
                PlanRow(title = "Lifetime", detail = "Pay once, keep it for good", price = "$price once", tag = null, on = selected == ProStore.LIFETIME) { selected = ProStore.LIFETIME }
            }
            val chosenPrice = if (selected == ProStore.ANNUAL) offers.annualPrice else offers.lifetimePrice
            if (chosenPrice != null) {
                Button(
                    onClick = { (context as? Activity)?.let { store.buy(it, selected) } },
                    enabled = busy == null,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Text(
                        when {
                            busy == selected -> "Opening Google Play…"
                            selected == ProStore.LIFETIME -> "Unlock for life · $chosenPrice"
                            offers.trial -> "Try 1 week free"
                            else -> "Continue · $chosenPrice/year"
                        },
                        fontWeight = FontWeight.Bold, fontSize = 17.sp,
                    )
                }
                Text(
                    when {
                        selected == ProStore.LIFETIME -> "One payment. Yours for good."
                        offers.trial -> "Then $chosenPrice a year. Cancel anytime."
                        else -> "Renews every year. Cancel anytime."
                    },
                    style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center,
                )
            }
            offers.annualPrice?.let { price ->
                Text(
                    "${if (offers.trial) "Free for 1 week, then " else ""}$price a year, charged to your Google Play account. Renews automatically unless you cancel at least 24 hours before the end of the current period; manage or cancel it in Google Play › Payments & subscriptions. Lifetime is a one-time purchase.",
                    style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            Text(
                "Already have FitLoop Pro from the iPhone app or the web? It's here as soon as you're signed in to the same account${email?.let { " ($it)" } ?: ""}.",
                style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { store.restore() }, enabled = busy == null) { Text(if (busy == "restore") "Restoring…" else "Restore Purchases") }
                TextButton(onClick = { open("$site/terms/") }) { Text("Terms") }
                TextButton(onClick = { open("$site/privacy/") }) { Text("Privacy") }
            }
            TextButton(onClick = { scope.launch { onSignOut() } }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Not ${email ?: "you"}? Sign out")
            }
        }
    }
}

@Composable
private fun PlanRow(title: String, detail: String, price: String, tag: String?, on: Boolean, onClick: () -> Unit) {
    val accent = MaterialTheme.colorScheme.primary
    Box(Modifier.fillMaxWidth().padding(top = if (tag != null) 8.dp else 0.dp)) {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                .background(if (on) accent.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceVariant)
                .border(2.dp, if (on) accent else Color.Transparent, RoundedCornerShape(16.dp))
                .clickable(role = Role.RadioButton, onClick = onClick)
                .padding(start = 14.dp, end = 14.dp, top = 18.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(if (on) Icons.Filled.RadioButtonChecked else Icons.Filled.RadioButtonUnchecked, null, tint = if (on) accent else MaterialTheme.colorScheme.outline)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(price, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        if (tag != null) {
            Text(
                tag, color = MaterialTheme.colorScheme.onPrimary, fontSize = 10.5.sp, fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.align(Alignment.TopEnd).offset(x = (-14).dp, y = (-9).dp).clip(RoundedCornerShape(99.dp)).background(accent).padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
    }
}
