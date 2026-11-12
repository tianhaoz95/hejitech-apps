package com.hejitech.tinytouch.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SafetyGuideScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Safety & Lock Guide", fontWeight = FontWeight.Bold) },
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
        },
        containerColor = Color(0xFF121212)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF1E1E1E))
                    .padding(16.dp)
            ) {
                Column {
                    Text("🛡️ Parent Safety Blueprint", fontWeight = FontWeight.Bold, color = Color(0xFF66B3FF), fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Toddlers love grabbing watches. TinyTouch combined with Wear OS safety features creates an accidental-touch shield designed for held toddlers.",
                        color = Color.LightGray,
                        fontSize = 12.sp
                    )
                }
            }

            GuideCard(
                number = "1",
                emoji = "🔒",
                title = "In-App 3-Second Parent Shield",
                subtitle = "Prevents toddlers from changing games or accessing settings.",
                steps = listOf(
                    "Look at the lock icon at the top-left corner of the watch screen.",
                    "To unlock the Parent Dashboard, press and hold the lock icon for 3 full seconds.",
                    "A progress ring will fill with ticking haptic feedback.",
                    "Releasing early instantly resets the lock, keeping toddlers out."
                )
            )

            GuideCard(
                number = "2",
                emoji = "⏱️",
                title = "Automatic Lullaby Wind-Down",
                subtitle = "Gentle transition avoiding tears when play time ends.",
                steps = listOf(
                    "Parents can set a 3, 5, or 10-minute session limit on this phone or directly on the watch.",
                    "When the timer reaches zero, TinyTouch will not abruptly turn off or exit.",
                    "Instead, it smoothly transitions into Sleepy Moon mode with soothing lullaby music.",
                    "This prepares your child for naptime without triggering tantrums."
                )
            )

            GuideCard(
                number = "3",
                emoji = "🖐️",
                title = "Screen Containment & Rotary Dial",
                subtitle = "Edge-to-edge touch interception.",
                steps = listOf(
                    "While TinyTouch is active on Wear OS, 100% of screen touches are absorbed as sensory play.",
                    "Turning the watch crown or rotating bezel turns into musical chimes, bubble inflation, and sparkles rather than scrolling system menus.",
                    "The screen stays awake with gentle low-stimulation colors compliant with AAP guidelines."
                )
            )
        }
    }
}

@Composable
private fun GuideCard(
    number: String,
    emoji: String,
    title: String,
    subtitle: String,
    steps: List<String>
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF1E1E1E))
            .padding(16.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(emoji, fontSize = 22.sp)
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(title, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 14.sp)
                    Text(subtitle, color = Color.Gray, fontSize = 11.sp)
                }
            }

            Divider(color = Color.White.copy(alpha = 0.08f))

            steps.forEachIndexed { idx, step ->
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text("${idx + 1}.", color = Color(0xFF66B3FF), fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.width(20.dp))
                    Text(step, color = Color.LightGray, fontSize = 12.sp)
                }
            }
        }
    }
}
