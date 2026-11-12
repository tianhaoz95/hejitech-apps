package com.hejitech.tinytouch.kit.games

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.TextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class AnimalFriend(
    val name: String,
    val emoji: String,
    val sound: String,
    val phrase: String,
    val color: Color,
)

private val ANIMALS = listOf(
    AnimalFriend("Puppy", "🐶", "woof", "Puppy! Woof woof!", Color(0xFFFF9933)),
    AnimalFriend("Kitty", "🐱", "meow", "Kitty! Meow!", Color(0xFFFF80B3)),
    AnimalFriend("Duck", "🦆", "quack", "Duck! Quack quack!", Color(0xFFFFD933)),
    AnimalFriend("Cow", "🐮", "moo", "Cow! Moo!", Color(0xFF66CCF2)),
    AnimalFriend("Frog", "🐸", "ribbit", "Frog! Ribbit ribbit!", Color(0xFF66E680)),
    AnimalFriend("Bunny", "🐰", "boing", "Bunny! Hop hop!", Color(0xFFD999FF)),
)

@Composable
fun AnimalFriendsGame(env: PlayEnv, modifier: Modifier = Modifier) {
    var selectedIndex by remember { mutableIntStateOf(0) }
    val bounceScale = remember { Animatable(1f) }
    val bounceAngle = remember { Animatable(0f) }
    val floatingHearts = remember { mutableStateListOf<Offset>() }
    val scope = rememberCoroutineScope()

    val animal = ANIMALS[selectedIndex]

    fun selectAnimal(idx: Int) {
        val next = idx.coerceIn(0, ANIMALS.size - 1)
        if (next != selectedIndex) {
            selectedIndex = next
            Haptics.crownTick()
            SoundEngine.animal(ANIMALS[next].sound)
        }
    }

    CrownEffect(env.crown) { delta ->
        if (delta > 0.5f) {
            selectAnimal((selectedIndex + 1) % ANIMALS.size)
        } else if (delta < -0.5f) {
            selectAnimal(if (selectedIndex == 0) ANIMALS.size - 1 else selectedIndex - 1)
        }
    }

    fun animateAnimal() {
        env.onTouch()
        Haptics.bounce()
        SoundEngine.animal(animal.sound)
        if (env.voiceEnabled) {
            SoundEngine.speak(animal.phrase)
        }
        scope.launch {
            val angle = rnd(-15f, 15f)
            launch {
                bounceScale.animateTo(1.3f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
                bounceScale.animateTo(1.0f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            }
            launch {
                bounceAngle.animateTo(angle, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
                bounceAngle.animateTo(0f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            }
        }
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .captureTouches(
                onDown = { animateAnimal() }
            )
    ) {
        val haloBrush = Brush.radialGradient(
            colors = listOf(animal.color.copy(alpha = 0.35f), Color.Transparent),
            radius = 180f
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(haloBrush),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(top = env.topInset)
            ) {
                // Animal stage circle
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .clip(CircleShape)
                        .background(animal.color.copy(alpha = 0.25f))
                        .clickable { animateAnimal() },
                    contentAlignment = Alignment.Center
                ) {
                    BasicText(
                        text = animal.emoji,
                        style = TextStyle(fontSize = 76.sp),
                        modifier = Modifier
                            .scale(bounceScale.value)
                            .rotate(bounceAngle.value)
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                BasicText(
                    text = animal.name,
                    style = TextStyle(
                        color = animal.color,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Animal mini carousel selector
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ANIMALS.forEachIndexed { idx, item ->
                        val isSelected = idx == selectedIndex
                        Box(
                            modifier = Modifier
                                .size(if (isSelected) 30.dp else 24.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isSelected) item.color.copy(alpha = 0.4f)
                                    else Color.White.copy(alpha = 0.1f)
                                )
                                .clickable { selectAnimal(idx) },
                            contentAlignment = Alignment.Center
                        ) {
                            BasicText(
                                text = item.emoji,
                                style = TextStyle(fontSize = if (isSelected) 16.sp else 12.sp)
                            )
                        }
                    }
                }
            }
        }
    }
}
