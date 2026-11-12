package com.hejitech.toddlercam.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import kotlin.random.Random

@Composable
fun ParentGateDialog(
    onSuccess: () -> Unit,
    onDismiss: () -> Unit
) {
    val num1 = remember { Random.nextInt(3, 8) }
    val num2 = remember { Random.nextInt(2, 6) }
    val correctAnswer = remember { num1 + num2 }

    var selectedAnswer by remember { mutableStateOf<Int?>(null) }
    var isError by remember { mutableStateOf(false) }

    // Generate 3 choices (1 correct, 2 distractors)
    val choices = remember {
        val list = mutableSetOf(correctAnswer)
        while (list.size < 3) {
            val distractor = correctAnswer + Random.nextInt(-4, 5)
            if (distractor > 0 && distractor != correctAnswer) {
                list.add(distractor)
            }
        }
        list.toList().shuffled()
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color(0xFF212121),
            modifier = Modifier.padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "🔒 Parental Gate",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Ask a parent: What is $num1 + $num2?",
                    fontSize = 14.sp,
                    color = Color.LightGray
                )

                if (isError) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Oops, try again!",
                        color = Color(0xFFFF5252),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    for (choice in choices) {
                        Button(
                            onClick = {
                                if (choice == correctAnswer) {
                                    onSuccess()
                                } else {
                                    isError = true
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF424242),
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(text = "$choice", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = Color.Gray)
                }
            }
        }
    }
}
