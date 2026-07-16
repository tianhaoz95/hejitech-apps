package com.hejitech.contempo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import com.hejitech.contempo.ui.navigation.ContempoNavHost
import com.hejitech.contempo.ui.signin.SignInScreen
import com.hejitech.contempo.ui.theme.ContempoTheme
import com.google.firebase.Firebase
import com.google.firebase.auth.auth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { ContempoRoot() }
    }
}

/** Named distinctly from the ContempoApp Application class — same name
 *  caused a real overload-resolution-ambiguity compile error (a bare
 *  Application subclass has an implicit no-arg constructor, which collides
 *  with a same-named zero-arg @Composable call site). */
@Composable
private fun ContempoRoot() {
    ContempoTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            AuthGate { ContempoNavHost() }
        }
    }
}

/**
 * Renders SignInScreen until Google Sign-In (see AuthManager) completes, then
 * swaps to `content` — reacts live via FirebaseAuth.AuthStateListener, so
 * signing out from Settings bounces straight back here too.
 */
@Composable
private fun AuthGate(content: @Composable () -> Unit) {
    var signedIn by remember { mutableStateOf(Firebase.auth.currentUser != null) }

    DisposableEffect(Unit) {
        val listener = com.google.firebase.auth.FirebaseAuth.AuthStateListener { auth ->
            signedIn = auth.currentUser != null
        }
        Firebase.auth.addAuthStateListener(listener)
        onDispose { Firebase.auth.removeAuthStateListener(listener) }
    }

    if (signedIn) {
        content()
    } else {
        SignInScreen()
    }
}
