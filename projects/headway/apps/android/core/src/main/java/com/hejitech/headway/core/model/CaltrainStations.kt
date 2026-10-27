package com.hejitech.headway.core.model

object CaltrainStations {
    val ALL: List<Station> = listOf(
        Station(id = "san_francisco", name = "San Francisco", short = "SF"),
        Station(id = "22nd_street", name = "22nd Street", short = "22ND ST"),
        Station(id = "bayshore", name = "Bayshore", short = "BAYSHORE"),
        Station(id = "south_sf", name = "South San Francisco", short = "S SF"),
        Station(id = "san_bruno", name = "San Bruno", short = "SAN BRUNO"),
        Station(id = "millbrae", name = "Millbrae", short = "MILLBRAE"),
        Station(id = "broadway", name = "Broadway", short = "BROADWAY"),
        Station(id = "burlingame", name = "Burlingame", short = "BURLINGAME"),
        Station(id = "san_mateo", name = "San Mateo", short = "SAN MATEO"),
        Station(id = "hayward_park", name = "Hayward Park", short = "HAYWARD PK"),
        Station(id = "hillsdale", name = "Hillsdale", short = "HILLSDALE"),
        Station(id = "belmont", name = "Belmont", short = "BELMONT"),
        Station(id = "san_carlos", name = "San Carlos", short = "SAN CARLOS"),
        Station(id = "redwood_city", name = "Redwood City", short = "REDWOOD CY"),
        Station(id = "menlo_park", name = "Menlo Park", short = "MENLO PK"),
        Station(id = "palo_alto", name = "Palo Alto", short = "PALO ALTO"),
        Station(id = "stanford", name = "Stanford", short = "STANFORD"),
        Station(id = "california_ave", name = "California Avenue", short = "CAL AVE"),
        Station(id = "san_antonio", name = "San Antonio", short = "SAN ANTONIO"),
        Station(id = "mountain_view", name = "Mountain View", short = "MTN VIEW"),
        Station(id = "sunnyvale", name = "Sunnyvale", short = "SUNNYVALE"),
        Station(id = "lawrence", name = "Lawrence", short = "LAWRENCE"),
        Station(id = "santa_clara", name = "Santa Clara", short = "SANTA CLARA"),
        Station(id = "college_park", name = "College Park", short = "COLLEGE PK"),
        Station(id = "sj_diridon", name = "San Jose Diridon", short = "SJ DIRIDON"),
        Station(id = "tamien", name = "Tamien", short = "TAMIEN"),
        Station(id = "capitol", name = "Capitol", short = "CAPITOL"),
        Station(id = "blossom_hill", name = "Blossom Hill", short = "BLOSSOM HL"),
        Station(id = "morgan_hill", name = "Morgan Hill", short = "MORGAN HL"),
        Station(id = "san_martin", name = "San Martin", short = "SAN MARTIN"),
        Station(id = "gilroy", name = "Gilroy", short = "GILROY")
    )

    private val byIdMap = ALL.associateBy { it.id }
    private val byShortMap = ALL.associateBy { it.short }

    fun findById(id: String): Station? = byIdMap[id]
    fun findByShort(short: String): Station? = byShortMap[short]

    fun nameFor(id: String): String = byIdMap[id]?.name ?: id
    fun shortFor(id: String): String = byIdMap[id]?.short ?: id

    val defaultMorningFrom: Station get() = byIdMap["mountain_view"] ?: ALL.first()
    val defaultMorningTo: Station get() = byIdMap["san_francisco"] ?: ALL.last()
}
