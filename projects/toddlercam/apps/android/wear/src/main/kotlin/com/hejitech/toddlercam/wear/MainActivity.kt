package com.hejitech.toddlercam.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels

class MainActivity : ComponentActivity() {

    private val viewModel: WearViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WearApp(viewModel = viewModel)
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.checkConnectivity()
        viewModel.requestStatus()
    }
}
