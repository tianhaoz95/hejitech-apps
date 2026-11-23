package com.hejitech.fitloop

import android.app.Activity
import android.os.Bundle
import com.hejitech.fitloop.core.BackendConfig
import com.hejitech.fitloop.ui.openUrl

/** What Health Connect opens to explain FitLoop's health permissions: the privacy policy. */
class HealthRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openUrl(this, "${BackendConfig.PRODUCTION.site}/privacy/")
        finish()
    }
}
