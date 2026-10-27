package com.hejitech.headway.core.net

data class BackendConfig(
    val site: String,
    val supabaseUrl: String,
    val anonKey: String
) {
    companion object {
        val PRODUCTION = BackendConfig(
            site = "https://headway.hejitech.workers.dev",
            supabaseUrl = "https://jitdzllkxfhlrxxvljhp.supabase.co",
            anonKey = "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
        )

        // Android emulator maps 10.0.2.2 to host machine's 127.0.0.1
        val LOCAL_EMULATOR = BackendConfig(
            site = "http://10.0.2.2:8792",
            supabaseUrl = "http://10.0.2.2:55421",
            anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        )
    }
}
