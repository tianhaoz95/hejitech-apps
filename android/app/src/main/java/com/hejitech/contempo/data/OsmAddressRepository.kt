package com.hejitech.contempo.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class OsmAddressSuggestion(
    val title: String,
    val subtitle: String,
    val fullAddress: String
)

class OsmAddressRepository {

    suspend fun searchAddress(query: String): List<OsmAddressSuggestion> = withContext(Dispatchers.IO) {
        val trimmed = query.trim()
        if (trimmed.length < 3) return@withContext emptyList()

        try {
            val encodedQuery = URLEncoder.encode(trimmed, "UTF-8")
            val urlString = "https://photon.komoot.io/api/?q=$encodedQuery&limit=5&lang=en"
            val url = URL(urlString)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 3000
                readTimeout = 3000
                setRequestProperty("User-Agent", "ContempoApp/1.0 (Android)")
            }

            if (connection.responseCode != 200) return@withContext emptyList()

            val responseText = connection.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(responseText)
            val features = json.getJSONArray("features")

            val suggestions = mutableListOf<OsmAddressSuggestion>()

            for (i in 0 until features.length()) {
                val feature = features.getJSONObject(i)
                val props = feature.getJSONObject("properties")

                val housenumber = props.optString("housenumber", "")
                val street = props.optString("street", props.optString("name", ""))
                val city = props.optString("city", props.optString("town", props.optString("village", "")))
                val state = props.optString("state", "")
                val postcode = props.optString("postcode", "")

                val line1 = listOf(housenumber, street).filter { it.isNotBlank() }.joinToString(" ")
                val line2 = listOf(city, state, postcode).filter { it.isNotBlank() }.joinToString(", ")

                if (line1.isNotBlank()) {
                    val full = listOf(line1, line2).filter { it.isNotBlank() }.joinToString(", ")
                    suggestions.add(
                        OsmAddressSuggestion(
                            title = line1,
                            subtitle = line2,
                            fullAddress = full
                        )
                    )
                }
            }
            suggestions
        } catch (e: Exception) {
            emptyList()
        }
    }
}
