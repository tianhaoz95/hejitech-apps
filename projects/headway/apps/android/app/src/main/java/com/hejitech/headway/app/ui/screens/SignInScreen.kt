package com.hejitech.headway.app.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsTransit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.BuildConfig
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.CaltrainRed
import com.hejitech.headway.app.ui.theme.StatusGrey
import com.hejitech.headway.app.ui.theme.StatusRed

/** Opens a page in a browser tab over the app (Google sign-in, help, privacy). */
fun openUrl(context: Context, url: String) {
    runCatching { CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url)) }
        .onFailure { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
}

/** Signed out: Google for people, email for accounts Headway hands out. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignInScreen(viewModel: HeadwayViewModel) {
    val context = LocalContext.current
    val error by viewModel.errorMessage.collectAsState()
    val busy by viewModel.isLoading.collectAsState()
    val isLocal by viewModel.isLocalBackend.collectAsState()
    var emailSheet by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(48.dp))
        Box(
            modifier = Modifier.size(96.dp).background(CaltrainRed, RoundedCornerShape(22.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.DirectionsTransit, contentDescription = null, tint = Color.White, modifier = Modifier.size(56.dp))
        }
        Text("Headway", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            "Your next Caltrain at a glance, and an alert on your phone when it's late, cancelled or almost at your stop.",
            style = MaterialTheme.typography.bodyLarge,
            color = StatusGrey,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(32.dp))

        Button(
            onClick = { openUrl(context, viewModel.startGoogleSignIn()) },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("google-signin")
        ) {
            if (busy) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White)
            else Text("Continue with Google")
        }

        if (BuildConfig.DEBUG && isLocal) {
            OutlinedButton(onClick = { viewModel.signInLocalSeed() }, modifier = Modifier.fillMaxWidth().testTag("local-signin")) {
                Text("Sign in (local seed rider)")
            }
        }

        TextButton(onClick = { viewModel.clearError(); emailSheet = true }, modifier = Modifier.testTag("email-signin")) {
            Text("Sign in with email", color = StatusGrey)
        }

        Text(
            "Your account is shared with other HEJI apps. Headway keeps only your commute, alert choices and devices.",
            style = MaterialTheme.typography.bodySmall,
            color = StatusGrey,
            textAlign = TextAlign.Center
        )
        if (!emailSheet) error?.let { Text(it, color = StatusRed, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }

        if (BuildConfig.DEBUG) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Local dev stack", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                Spacer(Modifier.width(8.dp))
                Switch(checked = isLocal, onCheckedChange = { viewModel.setBackendMode(it) })
            }
        }
    }

    if (emailSheet) {
        ModalBottomSheet(onDismissRequest = { emailSheet = false }) {
            EmailSignIn(viewModel = viewModel, error = error, onDone = { emailSheet = false })
        }
    }
}

/**
 * Email sign-in for accounts Headway hands out, such as the store review demo account. People sign
 * up with Google (or Apple on iPhone); there is no email sign-up or password reset.
 */
@Composable
private fun EmailSignIn(viewModel: HeadwayViewModel, error: String?, onDone: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val canSubmit = !busy && email.isNotBlank() && password.isNotEmpty()
    val submit = {
        if (canSubmit) {
            busy = true
            viewModel.signInWithEmailAccount(email, password) { ok ->
                busy = false
                if (ok) onDone()
            }
        }
    }

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Sign in with email", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("For accounts Headway gave you. New here? Continue with Google.", style = MaterialTheme.typography.bodyMedium, color = StatusGrey)
        OutlinedTextField(
            value = email, onValueChange = { email = it }, label = { Text("Email") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth().testTag("email-field")
        )
        OutlinedTextField(
            value = password, onValueChange = { password = it }, label = { Text("Password") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { submit() }),
            modifier = Modifier.fillMaxWidth().testTag("password-field")
        )
        error?.let { Text(it, color = StatusRed, style = MaterialTheme.typography.bodySmall) }
        Button(onClick = { submit() }, enabled = canSubmit, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("email-submit")) {
            if (busy) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White) else Text("Sign in")
        }
    }
}
