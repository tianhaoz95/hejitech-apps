package com.hejitech.fitloop.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hejitech.fitloop.AppModel
import com.hejitech.fitloop.BuildConfig
import com.hejitech.fitloop.R
import kotlinx.coroutines.launch

fun openUrl(context: Context, url: String) {
    runCatching { CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url)) }
        .onFailure { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
}

@Composable
fun SignInScreen(model: AppModel) {
    val context = LocalContext.current
    var emailSheet by rememberSaveable { mutableStateOf(false) }
    Column(
        Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.height(48.dp))
        Image(
            painterResource(R.drawable.mark), contentDescription = null,
            modifier = Modifier.size(96.dp).clip(RoundedCornerShape(22.dp)).background(Color(0xFF0D0B1E)),
        )
        Text("FitLoop", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            "The plan your AI agent writes for you, on your phone and Even G2. Check in as you go; your agent reads it back.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
        Button(onClick = { openUrl(context, model.startGoogleSignIn()) }, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("google-signin")) {
            Text("Continue with Google")
        }
        if (BuildConfig.DEBUG && model.isLocal) {
            var email by rememberSaveable { mutableStateOf("athlete@example.com") }
            var password by rememberSaveable { mutableStateOf("") }
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                password, { password = it }, label = { Text("Password (fitloop-dev)") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(),
            )
            OutlinedButton(onClick = { model.signInLocal(email, password) }, modifier = Modifier.fillMaxWidth().testTag("local-signin")) { Text("Sign in (local seed)") }
        }
        TextButton(onClick = { emailSheet = true }, modifier = Modifier.testTag("email-signin")) { Text("Sign in with email") }
        Text(
            "Your account is shared with other HEJI apps. FitLoop keeps your plans, check-ins, notes for your agent and only the health data you switch on. FitLoop isn't medical advice.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { openUrl(context, "${model.backend.config.site}/terms/") }) { Text("Terms") }
            TextButton(onClick = { openUrl(context, "${model.backend.config.site}/privacy/") }) { Text("Privacy") }
        }
        if (!emailSheet) model.error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center) }
    }
    if (emailSheet) EmailSignInSheet(model) { emailSheet = false }
}

/**
 * Email sign-in for accounts FitLoop hands out, such as the store reviewers' demo account. People
 * sign up with Google; there is no email sign-up or password reset.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmailSignInSheet(model: AppModel, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val canSubmit = !busy && email.isNotBlank() && password.isNotEmpty()
    fun submit() {
        if (!canSubmit) return
        busy = true
        scope.launch {
            model.error = null
            if (model.signInWithEmailAccount(email, password)) onDismiss() else error = model.error
            busy = false
        }
    }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 24.dp).imePadding(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Sign in with email", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Secondary("For accounts FitLoop gave you. New here? Continue with Google.")
            OutlinedTextField(
                email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("email"),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            )
            OutlinedTextField(
                password, { password = it }, label = { Text("Password") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("password"),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { submit() }),
            )
            error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
            Button(onClick = ::submit, enabled = canSubmit, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Sign in")
            }
        }
    }
}
