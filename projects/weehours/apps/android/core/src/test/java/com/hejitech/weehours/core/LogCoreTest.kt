package com.hejitech.weehours.core

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.net.URI
import java.net.URLDecoder
import java.security.MessageDigest
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

class LogCoreTest {
    private val H = UUID.fromString("00000000-0000-4000-8000-0000000000aa")
    private val B = UUID.fromString("00000000-0000-4000-8000-0000000000bb")
    private val A = UUID.fromString("00000000-0000-4000-8000-00000000000a")
    private val P2 = UUID.fromString("00000000-0000-4000-8000-00000000000b")
    private val MIA = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private val LEO = UUID.fromString("00000000-0000-4000-8000-0000000000b2")

    private fun fixedNow(): Date = LogCoding.parseISO("2026-10-14T15:00:00Z")!!

    private fun service(categories: List<String>? = null, defaultFeed: String = "bottle"): LogService {
        val h = Household(
            id = H,
            babyId = B,
            bottleMl = 120.0,
            defaultFeed = defaultFeed,
            caregivers = listOf(Caregiver(id = A, name = "Alex"), Caregiver(id = P2, name = "Sam"))
        ).apply {
            this.categories = categories ?: EventRegistry.shared.categories.map { it.id }
        }
        return LogService(
            store = SQLiteLogStore.inMemory(),
            household = h,
            me = A,
            interpreter = VoiceInterpreter(model = KeywordDecisionModel())
        )
    }

    private fun twins(): LogService {
        val h = Household(
            id = H,
            babies = listOf(Baby(id = MIA, name = "Mia", position = 0), Baby(id = LEO, name = "Leo", bottleMl = 150.0, position = 1)),
            bottleMl = 120.0,
            caregivers = listOf(Caregiver(id = A, name = "Alex"), Caregiver(id = P2, name = "Sam"))
        ).apply {
            this.categories = EventRegistry.shared.categories.map { it.id }
        }
        return LogService(
            store = SQLiteLogStore.inMemory(),
            household = h,
            me = A,
            interpreter = VoiceInterpreter(model = KeywordDecisionModel())
        )
    }

    private fun commit(s: LogService, r: LogService.VoiceResult): LogEvent {
        r.committed?.let { return it }
        val e = s.resolveCapture(r.capture.id, 0).firstOrNull()
        assertNotNull(e)
        return e!!
    }

    private fun ctx(events: List<LogEvent> = emptyList(), at: Date = fixedNow()): InterpretContext =
        InterpretContext(
            reference = at,
            log = DerivedLog(events = events),
            enabledCategories = EventRegistry.shared.categories.map { it.id }.toSet()
        )

    @Test
    fun testStatusFixtures() {
        val stream = javaClass.classLoader?.getResourceAsStream("fixtures/status.json")
            ?: javaClass.getResourceAsStream("/fixtures/status.json")
        assertNotNull("fixtures/status.json must be on classpath", stream)
        val root = LogCoding.json.parseToJsonElement(stream!!.bufferedReader(Charsets.UTF_8).use { it.readText() }).jsonObject
        val now = LogCoding.parseISO(root["now"]!!.jsonPrimitive.content)!!
        val giversObj = root["caregivers"]!!.jsonObject
        val givers = giversObj.mapValues { UUID.fromString(it.value.jsonPrimitive.content) }
        val casesArr = root["cases"]!!.jsonArray
        for (cElem in casesArr) {
            val c = cElem.jsonObject
            val name = c["name"]!!.jsonPrimitive.content
            val ids = mutableMapOf<String, UUID>()
            fun id(s: String): UUID {
                givers[s]?.let { return it }
                ids[s]?.let { return it }
                val u = UUID.randomUUID()
                ids[s] = u
                return u
            }
            val events = mutableListOf<LogEvent>()
            val evArr = c["events"]!!.jsonArray
            for (eElem in evArr) {
                val e = eElem.jsonObject
                val fields = mutableMapOf<String, FieldValue>()
                val fObj = e["fields"] as? JsonObject
                if (fObj != null) {
                    for ((k, vElem) in fObj) {
                        val prim = vElem as? JsonPrimitive ?: continue
                        if (prim.isString) {
                            val s = prim.content
                            fields[k] = FieldValue.Str(
                                if (k in setOf("original", "duplicate", "caregiver")) id(s).uuidString() else s
                            )
                        } else if (prim.booleanOrNull != null) {
                            fields[k] = FieldValue.Bool(prim.booleanOrNull!!)
                        } else if (prim.doubleOrNull != null) {
                            fields[k] = FieldValue.Num(prim.doubleOrNull!!)
                        }
                    }
                }
                val minsAgo = e["minutes_ago"]!!.jsonPrimitive.doubleOrNull!!
                val occurred = Date(now.time - (minsAgo * 60_000.0).toLong())
                val loggedMinsAgo = e["logged_minutes_ago"]?.jsonPrimitive?.doubleOrNull
                val logged = if (loggedMinsAgo != null) Date(now.time - (loggedMinsAgo * 60_000.0).toLong()) else occurred
                events.add(
                    LogEvent(
                        id = id(e["id"]!!.jsonPrimitive.content),
                        householdId = H,
                        babyId = e["baby"]?.jsonPrimitive?.content?.let(::id) ?: B,
                        type = e["type"]!!.jsonPrimitive.content,
                        fields = fields,
                        occurredAt = occurred,
                        loggedAt = logged,
                        loggedBy = id(e["by"]!!.jsonPrimitive.content),
                        provenance = Provenance(
                            surface = Surface.fromRaw(e["surface"]?.jsonPrimitive?.content ?: "phone"),
                            input = InputKind.TAP
                        ),
                        supersedes = e["supersedes"]?.jsonPrimitive?.content?.let(::id)
                    )
                )
            }
            val log = DerivedLog(events = events, baby = c["for_baby"]?.jsonPrimitive?.content?.let(::id))
            val status = StatusSnapshot(log = log, now = now)
            val expect = c["expect"]!!.jsonObject
            expect["line"]?.jsonPrimitive?.content?.let { assertEquals(name, it, status.line(now)) }
            expect["to_review"]?.jsonPrimitive?.intOrNull?.let { assertEquals(name, it, status.toReview) }
            expect["last_feed_kind"]?.jsonPrimitive?.content?.let { assertEquals(name, it, status.lastFeedKind) }
            expect["open_feed_kind"]?.jsonPrimitive?.content?.let { assertEquals(name, it, status.openFeedKind) }
            expect["next_side"]?.jsonPrimitive?.content?.let { assertEquals(name, it, status.nextSide) }
            expect["sleeping"]?.jsonPrimitive?.booleanOrNull?.let { assertEquals(name, it, status.sleepingSince != null) }
            expect["sessions"]?.jsonPrimitive?.intOrNull?.let { assertEquals(name, it, log.sessions.size) }
            expect["on_duty"]?.jsonPrimitive?.content?.let { assertEquals(name, id(it), status.onDuty) }
            val statusObj = expect["status"] as? JsonObject
            if (statusObj != null) {
                for ((k, v) in statusObj) {
                    assertEquals("$name: $k", v.jsonPrimitive.content, log.status[id(k)]?.rawValue)
                }
            }
        }
    }

    @Test
    fun testStartThenFinishHalfMakesOneSessionWithDuration() = runBlocking {
        val s = service()
        val t0 = Date(System.currentTimeMillis() - 1_200_000L)
        val r1 = s.processVoice(transcript = "start drinking", surface = Surface.PHONE, capturedAt = t0)
        assertEquals("feed.bottle.start", r1.interpretation.best?.type)
        if (r1.committed == null) s.resolveCapture(r1.capture.id, 0)
        val r2 = s.processVoice(transcript = "finished, drank half a bottle", surface = Surface.PHONE, capturedAt = Date(t0.time + 900_000L))
        assertEquals("feed.bottle.finish", r2.interpretation.best?.type)
        if (r2.committed == null) s.resolveCapture(r2.capture.id, 0)
        val log = s.derived()
        val bottle = log.sessions.filter { it.kind == Session.Kind.BOTTLE }
        assertEquals(1, bottle.size)
        assertEquals(0.5, bottle[0].consumedFraction!!, 0.001)
        assertEquals(900.0, bottle[0].duration ?: 0.0, 1.0)
        val h = s.household
        val finish = log.effective.first { it.type == "feed.bottle.finish" }
        assertEquals(60.0, h.milliliters(finish)!!, 0.01)
    }

    @Test
    fun testQuarterLeftLogsSeventyFivePercent() = runBlocking {
        val s = service()
        val r = s.processVoice(transcript = "finished, a quarter left", surface = Surface.PHONE)
        assertEquals(FieldValue.Num(0.75), r.interpretation.best?.fields?.get("consumed_fraction"))
    }

    @Test
    fun testUndoKeepsHistoryAsUndone() {
        val s = service()
        val e = s.log(type = "diaper", fields = mapOf("kind" to FieldValue.Str("wet")), provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        val before = s.status().line(Date())
        assertTrue(before.contains("diaper"))
        s.undo(e.id)
        val log = s.derived()
        assertEquals(EventStatus.UNDONE, log.status[e.id])
        val after = s.status().line(Date())
        assertFalse(after.contains("diaper"))
        assertTrue(log.all.any { it.id == e.id })
    }

    @Test
    fun testAnotherLanguageKeepsTheSpokenWordsAndTheEnglish() = runBlocking {
        val s = service()
        val r = s.processVoice(transcript = "Diaper, wet.", spoken = "Pañal mojado.", surface = Surface.PHONE)
        assertEquals("Diaper, wet.", r.interpretation.transcript)
        assertEquals("Pañal mojado. (Diaper, wet.)", r.capture.transcript)
        val e = commit(s, r)
        assertEquals("diaper", e.type)
        assertEquals("Pañal mojado. (Diaper, wet.)", e.provenance.rawTranscript)

        val note = s.processVoice(transcript = "She has a cute smile", spoken = "她笑得很可爱", surface = Surface.PHONE)
        val kept = s.dismissCapture(note.capture.id)
        assertEquals("她笑得很可爱 (She has a cute smile)", kept?.string("transcript"))
    }

    @Test
    fun testDisplayTranscriptIsTheEnglishAloneWhenNothingElseWasSaid() {
        assertEquals("wet diaper", VoiceTranscript.display(" wet diaper ", null))
        assertEquals("OK", VoiceTranscript.display("OK", "ok"))
        assertEquals("尿布湿了", VoiceTranscript.display("", "尿布湿了"))
    }

    @Test
    fun testEveryVoiceEventHasCompleteProvenance() = runBlocking {
        val s = service()
        val r = s.processVoice(transcript = "wet diaper", surface = Surface.WATCH)
        val e = commit(s, r)
        assertEquals(Surface.WATCH, e.provenance.surface)
        assertEquals(InputKind.VOICE, e.provenance.input)
        assertEquals("wet diaper", e.provenance.rawTranscript)
        assertNotNull(e.provenance.confidenceTier)
        assertEquals("keywords-1", e.provenance.modelVersion)
        assertFalse(e.provenance.confidence.isEmpty())
        assertEquals(r.capture.id, e.provenance.captureId)
    }

    @Test
    fun testFeedReminderFiresAtIntervalAndIsDismissedByLogging() {
        val s = service()
        val h = s.household
        h.reminders.feedEveryMinutes = 180
        s.setHousehold(h)
        val fed = Date(System.currentTimeMillis() - 3_600_000L)
        s.log(type = "feed.bottle.single", fields = mapOf("consumed_fraction" to FieldValue.Num(1.0)), occurredAt = fed, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        var plan = ReminderPlanner.plan(log = s.derived(), household = h, me = A, now = Date())
        assertEquals(PlannedReminder.Kind.FEED, plan.firstOrNull()?.kind)
        assertEquals(180 * 60.0, (plan.first().fireAt.time - fed.time) / 1000.0, 1.0)
        assertEquals(2, plan.size)
        s.log(type = "feed.bottle.start", provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        plan = ReminderPlanner.plan(log = s.derived(), household = h, me = A, now = Date())
        assertTrue(plan.none { it.kind == PlannedReminder.Kind.FEED })
        assertEquals(listOf(PlannedReminder.Kind.STILL_FEEDING), plan.map { it.kind })
    }

    @Test
    fun testFeedReminderCanBeToggledOffAndPredictsNextFeedTime() {
        val s = service()
        val h = s.household
        val fed = Date(System.currentTimeMillis() - 3_600_000L)
        s.log(type = "feed.bottle.single", fields = mapOf("consumed_fraction" to FieldValue.Num(1.0)), occurredAt = fed, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))

        val status = StatusSnapshot(log = s.derived(), now = Date())
        assertEquals(fed.time / 1000.0, status.lastFeedAt!!.time / 1000.0, 0.1)

        h.reminders.feedEveryMinutes = 150
        val nextFeed = status.nextFeedDue(h.reminders.feedEveryMinutes)
        assertNotNull(nextFeed)
        assertEquals(150 * 60.0, (nextFeed!!.time - fed.time) / 1000.0, 1.0)

        val activePlan = ReminderPlanner.plan(log = s.derived(), household = h, me = A, now = Date())
        assertTrue(activePlan.any { it.kind == PlannedReminder.Kind.FEED })

        h.reminders.feedEveryMinutes = null
        val disabledFeed = status.nextFeedDue(h.reminders.feedEveryMinutes)
        assertNull(disabledFeed)

        val disabledPlan = ReminderPlanner.plan(log = s.derived(), household = h, me = A, now = Date())
        assertFalse(disabledPlan.any { it.kind == PlannedReminder.Kind.FEED })
    }

    @Test
    fun testHierarchicalQuestionsAreShort() {
        val i = VoiceInterpreter(model = KeywordDecisionModel())
        val qs = i.questions(ctx())
        assertEquals("category", qs.firstOrNull()?.id)
        assertTrue(qs.all { it.options.size <= 8 })
        assertFalse(qs.any { it.id == "when" })
    }

    @Test
    fun testCombinePhaseWithinCategory() {
        val i = VoiceInterpreter(model = KeywordDecisionModel())
        val c = ctx()
        val cat = DecisionAnswer(options = listOf("feeding", "diaper", VoiceInterpreter.noneKey), probabilities = listOf(0.9, 0.05, 0.05))
        val entry = DecisionAnswer(options = listOf("bottle", "breast", "pumping", "solids"), probabilities = listOf(0.85, 0.05, 0.05, 0.05))
        val phase = DecisionAnswer(options = listOf("start", "switch", "finish", "single"), probabilities = listOf(0.1, 0.05, 0.8, 0.05))
        val t = i.combine(mapOf("category" to cat, "feeding_entry" to entry, "phase" to phase), c)
        assertEquals("feed.bottle.finish", t.top.first)
        assertEquals(0.05, t.p("diaper") + t.p("potty"), 0.001)
    }

    @Test
    fun testPolicyTiers() {
        val i = VoiceInterpreter(model = KeywordDecisionModel())
        fun interp(typeP: Double): Interpretation {
            val types = EventRegistry.shared.types.map { it.id } + VoiceInterpreter.noneKey
            val probs = MutableList(types.size) { (1.0 - typeP) / (types.size - 1).toDouble() }
            probs[types.indexOf("sleep.start")] = typeP
            return i.build(transcript = "she fell asleep", answers = mapOf("event_type" to DecisionAnswer(types, probs)), context = ctx())
        }
        assertEquals(ConfidenceTier.AUTO, interp(0.95).tier)
        assertEquals(ConfidenceTier.PICK, interp(0.7).tier)
        assertEquals(2, interp(0.7).candidates.size)
        assertEquals(ConfidenceTier.FULL_LIST, interp(0.3).tier)
    }

    @Test
    fun testNoneOfTheseGoesToFullList() = runBlocking {
        val i = VoiceInterpreter(model = KeywordDecisionModel())
        val r = i.interpret("call the pediatrician tomorrow", ctx())
        assertEquals(ConfidenceTier.FULL_LIST, r.tier)
    }

    @Test
    fun testGrowthMeasurementsPickTheirType() = runBlocking {
        val i = VoiceInterpreter(model = KeywordDecisionModel())
        val height = i.interpret("she is 52 cm tall", ctx())
        assertEquals("height", height.best?.type)
        assertEquals(52.0, height.best?.fields?.get("height_cm")?.number!!, 0.01)
        val head = i.interpret("head circumference is 35.5 cm", ctx())
        assertEquals("head", head.best?.type)
        assertEquals(35.5, head.best?.fields?.get("head_cm")?.number!!, 0.01)
        val weight = i.interpret("she weighs 4.2 kilos", ctx())
        assertEquals("weight", weight.best?.type)
        assertEquals(4200.0, weight.best?.fields?.get("grams")?.number!!, 0.01)
        assertEquals("Head size · 35.5 cm", VoiceInterpreter.label(type = "head", fields = mapOf("head_cm" to FieldValue.Num(35.5))))
    }

    @Test
    fun testDiaperKindIsRequired() = runBlocking {
        val r = VoiceInterpreter(model = KeywordDecisionModel()).interpret("changed his diaper", ctx())
        assertEquals("diaper", r.best?.type)
        assertNotEquals(ConfidenceTier.AUTO, r.tier)
    }

    @Test
    fun testRelativeAndExplicitTimes() = runBlocking {
        val i = VoiceInterpreter(model = KeywordDecisionModel())
        val r = i.interpret("wet diaper fifteen minutes ago", ctx())
        assertEquals(-900.0, (r.best!!.occurredAt.time - fixedNow().time) / 1000.0, 1.0)
        val r2 = i.interpret("fell asleep at 2:10", ctx())
        val cal = Calendar.getInstance().apply { time = r2.best!!.occurredAt }
        assertEquals(10, cal.get(Calendar.MINUTE))
        assertFalse(r2.best!!.occurredAt.after(fixedNow()))
    }

    @Test
    fun testCalibrationSharpensAndFlattens() {
        val a = DecisionAnswer(options = listOf("x", "y"), probabilities = listOf(0.6, 0.4))
        assertTrue(Calibration(temperatures = mapOf("q" to 0.5)).apply(a, "q").p("x") > 0.6)
        assertTrue(Calibration(temperatures = mapOf("q" to 2.0)).apply(a, "q").p("x") < 0.6)
    }

    @Test
    fun testBundledCalibrationLoads() {
        assertNotNull(Calibration.bundled.temperatures["category"])
    }

    @Test
    fun testSystemOneBodyKeepsOptionOrder() {
        val q = DecisionQuestion(
            id = "q",
            instructions = "Which?",
            options = listOf(
                DecisionQuestion.Option(key = "zeta", description = null),
                DecisionQuestion.Option(key = "alpha", description = "first \"quoted\"")
            )
        )
        val body = DecisionRequest(state = "s", questions = listOf(q)).systemOneJSON()
        assertTrue(body.indexOf("zeta") < body.indexOf("alpha"))
        LogCoding.json.parseToJsonElement(body)
    }

    @Test
    fun testParseServerAnswer() {
        val q = DecisionQuestion(
            id = "q",
            instructions = "?",
            options = listOf(DecisionQuestion.Option("a", null), DecisionQuestion.Option("b", null))
        )
        val json = """{"answers":{"q":{"type":"choice","choice":"b","probabilities":{"a":0.2,"b":0.8},"confidence":0.6}}}"""
        val a = SystemOneHTTPModel.parse(json, listOf(q))
        assertEquals("b", a["q"]?.top?.first)
    }

    @Test
    fun testParsers() {
        assertEquals(90.0, Parsers.milliliters("drank 90 ml")!!, 0.01)
        assertEquals(118.0, Parsers.milliliters("pumped four ounces")!!, 0.01)
        assertNull(Parsers.milliliters("drank half"))

        assertEquals(4200.0, Parsers.grams("she weighs 4.2 kilos")!!, 0.01)
        assertEquals(3714.0, Parsers.grams("8 pounds 3 ounces")!!, 0.01)
        assertEquals(5100.0, Parsers.grams("weight is 5100 grams")!!, 0.01)

        assertEquals(52.0, Parsers.centimeters("she's 52 cm long")!!, 0.01)
        assertEquals(35.5, Parsers.centimeters("head is 35.5 centimeters")!!, 0.01)
        assertEquals(50.8, Parsers.centimeters("twenty inches")!!, 0.01)
        assertEquals(50.8, Parsers.centimeters("1 foot 8 inches tall")!!, 0.01)
        assertNull(Parsers.centimeters("fed at 4 in the morning"))

        assertEquals("head", Parsers.growthMeasure("head circumference 35 cm"))
        assertEquals("height", Parsers.growthMeasure("she's 52 cm tall"))
        assertEquals("weight", Parsers.growthMeasure("she weighs 4.2 kilos"))
        assertNull(Parsers.growthMeasure("changed a wet diaper"))

        assertEquals(30, Parsers.minutesAgo("half an hour ago"))
        assertEquals(15, Parsers.minutesAgo("about fifteen minutes ago"))
        assertEquals(120, Parsers.minutesAgo("two hours ago"))
        assertNull(Parsers.minutesAgo("just now"))

        val ref = fixedNow()
        val t = Parsers.explicitTime("at 11:50 pm", ref)!!
        assertTrue(t.before(ref))
        assertTrue(t.after(Date(ref.time - 86_400_000L)))
    }

    @Test
    fun testLayaPrompt() {
        val q = DecisionQuestion(
            id = "q",
            instructions = "Which?",
            options = listOf(DecisionQuestion.Option("a", "first"), DecisionQuestion.Option("b", null))
        )
        assertEquals(
            "[CLS]choice question: Which?[SEP][MASK] a: first[MASK] b[SEP]hello  [SEP]",
            LayaPrompt.render("hello [MASK]", q)
        )
        val cls = 1
        val sep = 2
        val mask = 3
        val toks = listOf(cls, 10, 11, 12, sep, mask, 20, 21, 22, 23, 24, 25, mask, 30, 31, sep, 40, 41, sep)
        val l = LayaPrompt.layout(tokens = toks, mask = mask, sep = sep, nOptions = 2, maxHeadTokens = 24, maxOptionTokens = 3)
        assertEquals(2, l.markers.size)
        assertEquals(mask, l.tokens[l.markers[0]])
        assertEquals(mask, l.tokens[l.markers[1]])
        assertEquals(sep, l.tokens.last())
        assertEquals(4, l.markers[1] - l.markers[0])

        assertEquals("choice.2", LayaPrompt.temperatureKey(2))
        assertEquals("choice.6_10", LayaPrompt.temperatureKey(8))
        assertEquals("choice.11", LayaPrompt.temperatureKey(13))
    }

    @Test
    fun testValidationAndStoolColorAndGrowth() {
        val s = service(categories = listOf("diaper"))
        try {
            s.log(type = "feed.bottle.start", provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
            fail("expected disabled category")
        } catch (_: LogService.LogError.DisabledCategory) {}
        try {
            s.log(type = "diaper", fields = mapOf("kind" to FieldValue.Str("purple")), provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
            fail("expected invalid field")
        } catch (_: LogService.LogError.InvalidField) {}

        val p = Provenance(surface = Surface.PHONE, input = InputKind.TAP)
        val e = s.log(type = "diaper", fields = mapOf("kind" to FieldValue.Str("dirty"), "stool_color" to FieldValue.Str("green")), provenance = p)
        assertEquals("Diaper · dirty, green", VoiceInterpreter.label(type = e.type, fields = e.fields))
        try {
            s.log(type = "diaper", fields = mapOf("kind" to FieldValue.Str("dirty"), "stool_color" to FieldValue.Str("purple")), provenance = p)
            fail("expected invalid stool_color")
        } catch (_: LogService.LogError.InvalidField) {}
        assertTrue(StoolColor.WHITE.isFlagged(10))
        assertFalse(StoolColor.BLACK.isFlagged(2))
        assertTrue(StoolColor.BLACK.isFlagged(10))

        val gs = service(categories = listOf("growth"))
        for ((type, field) in listOf("height" to "height_cm", "head" to "head_cm")) {
            try {
                gs.log(type = type, provenance = p)
                fail("expected $field required")
            } catch (_: LogService.LogError.InvalidField) {}
            try {
                gs.log(type = type, fields = mapOf(field to FieldValue.Num(-3.0)), provenance = p)
                fail("expected positive $field")
            } catch (_: LogService.LogError.InvalidField) {}
            val ge = gs.log(type = type, fields = mapOf(field to FieldValue.Num(50.5)), provenance = p)
            assertEquals(50.5, ge.fields[field]?.number!!, 0.01)
        }
    }

    @Test
    fun testCaptureDeterminismAndAttachDetailAndDismissAndDiscard() = runBlocking {
        val capture = UUID.randomUUID()
        val s1 = service()
        val s2 = service()
        val r1 = s1.processVoice(transcript = "big poop", surface = Surface.GLASSES, captureId = capture, loggedBy = P2)
        val r2 = s2.processVoice(transcript = "big poop", surface = Surface.GLASSES, captureId = capture, loggedBy = P2)
        val e1 = commit(s1, r1)
        val e2 = commit(s2, r2)
        assertEquals(e1.id, e2.id)
        assertEquals(P2, e1.loggedBy)

        val s = service()
        s.toggleFeed(surface = Surface.RING, input = InputKind.GESTURE)
        val finish = s.toggleFeed(surface = Surface.RING, input = InputKind.GESTURE)
        assertEquals("feed.bottle.finish", finish.type)
        val r = s.processVoice(transcript = "drank half", surface = Surface.GLASSES, attachTo = finish.id)
        val e = commit(s, r)
        assertEquals(finish.id, e.supersedes)
        assertEquals("feed.bottle.finish", e.type)
        assertEquals(FieldValue.Num(0.5), e.fields["consumed_fraction"])
        val log = s.derived()
        assertEquals(0.5, log.sessions.first { it.kind == Session.Kind.BOTTLE }.consumedFraction!!, 0.001)

        val rNote = s.processVoice(transcript = "we're out of wipes", surface = Surface.PHONE)
        assertNull(rNote.committed)
        val note = s.dismissCapture(rNote.capture.id)
        assertEquals("note", note?.type)
        assertEquals("we're out of wipes", note?.string("transcript"))

        val sDiscard = service()
        val rDiscard = sDiscard.processVoice(transcript = "we're out of wipes", surface = Surface.PHONE)
        assertNull(rDiscard.committed)
        sDiscard.discardCapture(rDiscard.capture.id)
        val cap = sDiscard.store.captures().first { it.id == rDiscard.capture.id }
        assertEquals(Capture.Status.DISMISSED, cap.status)
        val dLog = sDiscard.derived()
        val notes = dLog.all.filter { it.type == "note" }
        assertEquals(1, notes.size)
        assertEquals(EventStatus.UNDONE, dLog.status[notes[0].id])
        sDiscard.reopenCapture(rDiscard.capture.id, emptyList())
        val again = sDiscard.store.captures().first { it.id == rDiscard.capture.id }
        assertEquals(Capture.Status.NEEDS_REVIEW, again.status)
    }

    @Test
    fun testStoreAndBatchesAndRehomeAndOffline() = runBlocking {
        val e = LogEvent(householdId = H, babyId = B, type = "diaper", fields = mapOf("kind" to FieldValue.Str("wet")), occurredAt = Date(), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        val f = LogEvent(householdId = H, babyId = B, type = "sleep.start", fields = emptyMap(), occurredAt = Date(), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        val undo = LogEvent(householdId = H, babyId = B, type = "undo", fields = emptyMap(), occurredAt = Date(), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP), supersedes = e.id)
        val batches = SupabaseClient.sameShapeBatches(listOf(e, f, undo, e), LogEvent.serializer())
        val counts = batches.map { LogCoding.json.parseToJsonElement(it).jsonArray.size }
        assertEquals(listOf(2, 1, 1), counts)

        val store = SQLiteLogStore.inMemory()
        store.append(e)
        val changed = e.copy(fields = mapOf("kind" to FieldValue.Str("dirty")))
        store.append(changed)
        assertEquals("wet", store.events().first().string("kind"))
        assertEquals(1, store.unsyncedEvents().size)
        store.markSynced(listOf(e.id))
        assertEquals(0, store.unsyncedEvents().size)
        store.setValue("42", "seq")
        assertEquals("42", store.value("seq"))

        val store2 = SQLiteLogStore.inMemory()
        val local = UUID.randomUUID()
        val account = UUID.randomUUID()
        val newHousehold = UUID.randomUUID()
        val newBaby = UUID.randomUUID()
        val synced = LogEvent(householdId = H, babyId = B, type = "diaper", fields = mapOf("kind" to FieldValue.Str("wet")), occurredAt = Date(), loggedBy = local, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        val pending = LogEvent(householdId = H, babyId = B, type = "duty", fields = mapOf("caregiver" to FieldValue.Str(local.uuidString())), occurredAt = Date(), loggedBy = local, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        store2.append(synced)
        store2.markSynced(listOf(synced.id))
        store2.append(pending)
        store2.rehome(newHousehold, { newBaby }, local to account)
        val all = store2.events().associateBy { it.id }
        assertEquals(H, all[synced.id]?.householdId)
        assertEquals(newHousehold, all[pending.id]?.householdId)
        assertEquals(newBaby, all[pending.id]?.babyId)
        assertEquals(account, all[pending.id]?.loggedBy)
        assertEquals(account.uuidString(), all[pending.id]?.string("caregiver"))

        val s = service()
        s.log(type = "diaper", fields = mapOf("kind" to FieldValue.Str("wet")), provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        val report = s.sync()
        assertEquals(0, report.pushed)
        assertEquals(0, s.processRemoteCaptures())
        assertTrue(s.status().line(Date()).contains("diaper just now"))
    }

    @Test
    fun testChildrenAndMultiChildVoiceAndReminders() = runBlocking {
        val json = """{"id":"${H.uuidString()}","name":"Ours","baby_id":"${B.uuidString()}","baby_name":"Mia","birth_date":"2026-09-26","bottle_ml":90}"""
        val h = LogCoding.json.decodeFromString(Household.serializer(), json)
        assertEquals(listOf("Mia"), h.babies.map { it.name })
        assertEquals(B, h.babyId)
        assertNotNull(h.birthDate)

        val hArch = Household(babies = listOf(Baby(id = MIA, name = "Mia", archived = true), Baby(id = LEO, name = "Leo", position = 1)))
        assertEquals(listOf(LEO), hArch.active.map { it.id })
        assertEquals(LEO, hArch.babyId)
        assertEquals("Mia, Leo & Ava", Household.names(listOf(Baby(name = "Mia"), Baby(name = "Leo"), Baby(name = "Ava"))))

        val kids = listOf(Baby(id = MIA, name = "Mia"), Baby(id = LEO, name = "Leo"))
        assertEquals(listOf(LEO), Parsers.children("Leo had 90 ml", kids))
        assertEquals(listOf(MIA), Parsers.children("changed Mia's diaper", kids))
        assertEquals(listOf(MIA, LEO), Parsers.children("the twins fell asleep", kids))
        assertEquals(listOf(MIA, LEO), Parsers.children("Mia and Leo both ate", kids))
        assertNull(Parsers.children("wet and dirty, both", kids))
        assertNull(Parsers.children("fed on both sides", kids))
        assertNull(Parsers.children("Leo had 90 ml", listOf(Baby(id = LEO, name = "Leo"))))
        assertNull(Parsers.children("Leonard is here", kids))

        val s = twins()
        s.toggleFeed(baby = MIA, surface = Surface.PHONE)
        s.toggleFeed(baby = LEO, surface = Surface.PHONE)
        val leoFinish = s.toggleFeed(baby = LEO, surface = Surface.PHONE)
        assertEquals("feed.bottle.finish", leoFinish.type)
        assertEquals(LEO, leoFinish.babyId)
        assertNotNull(s.status(baby = MIA).openFeedSince)
        assertNull(s.status(baby = LEO).openFeedSince)
        assertEquals(0, s.derived().duplicates.size)

        val rTwins = s.processVoice(transcript = "the twins fell asleep", surface = Surface.PHONE)
        var events = rTwins.events
        if (events.isEmpty()) events = s.resolveCapture(rTwins.capture.id, 0)
        assertEquals(setOf(MIA, LEO), events.map { it.babyId }.toSet())
        assertEquals(1, events.map { it.string("group") }.toSet().size)
        assertNotEquals(events[0].id, events[1].id)
        s.undoGroup(events[0].id)
        assertNull(s.status(baby = MIA).sleepingSince)
        assertNull(s.status(baby = LEO).sleepingSince)
    }

    @Test
    fun testRoadmapFeatures() {
        val now = fixedNow()
        val h = Household(id = H, babyId = B, bottleMl = 120.0, caregivers = listOf(Caregiver(id = A, name = "Alex"), Caregiver(id = P2, name = "Sam")))
        val start = Date(now.time - 4 * 3_600_000L)
        val end = Date(now.time - 60_000L)
        val events = listOf(
            LogEvent(householdId = H, babyId = B, type = "duty", fields = mapOf("caregiver" to FieldValue.Str(A.uuidString())), occurredAt = start, loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "feed.bottle.single", fields = mapOf("consumed_fraction" to FieldValue.Num(0.75)), occurredAt = Date(start.time + 1_800_000L), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "diaper", fields = mapOf("kind" to FieldValue.Str("both")), occurredAt = Date(start.time + 3_600_000L), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "medication", fields = mapOf("medicine" to FieldValue.Str("Tylenol"), "dose" to FieldValue.Str("2.5 ml")), occurredAt = Date(start.time + 5_400_000L), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "duty", fields = mapOf("caregiver" to FieldValue.Str(P2.uuidString())), occurredAt = end, loggedBy = P2, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        )
        val log = DerivedLog(events = events)
        val summary = log.shiftSummary(household = h, now = now)
        assertNotNull(summary)
        assertEquals(A, summary?.caregiver)
        assertEquals(1, summary?.feedCount)
        assertEquals(90.0, summary?.bottleMl!!, 0.01)
        assertEquals(1, summary.wetDiapers)
        assertEquals(1, summary.dirtyDiapers)
        assertEquals(listOf("Tylenol"), summary.medications.map { it.medicine })

        val t1 = Date(now.time - 6 * 3_600_000L)
        val t2 = Date(now.time - 3 * 3_600_000L)
        val t3 = Date(now.time - 1 * 3_600_000L)
        val stashEvents = listOf(
            LogEvent(householdId = H, babyId = B, type = "pump", fields = mapOf("side" to FieldValue.Str("both"), "amount_ml" to FieldValue.Num(100.0), "storage" to FieldValue.Str("fridge")), occurredAt = t1, loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "pump", fields = mapOf("side" to FieldValue.Str("both"), "amount_ml" to FieldValue.Num(140.0), "storage" to FieldValue.Str("freezer")), occurredAt = t2, loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "feed.bottle.single", fields = mapOf("consumed_fraction" to FieldValue.Num(0.5), "contents" to FieldValue.Str("breast_milk")), occurredAt = t3, loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        )
        val stash = DerivedLog(events = stashEvents).milkStash(household = h)
        assertEquals(40.0, stash.fridgeMl, 0.01)
        assertEquals(140.0, stash.freezerMl, 0.01)
        assertEquals(t1, stash.oldestFridgeAt)

        val solidsEvents = listOf(
            LogEvent(householdId = H, babyId = B, type = "feed.solids", fields = mapOf("amount" to FieldValue.Str("some"), "foods" to FieldValue.Str("avocado,egg"), "reaction" to FieldValue.Str("rash")), occurredAt = Date(now.time - 3_600_000L), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP)),
            LogEvent(householdId = H, babyId = B, type = "note", fields = mapOf("transcript" to FieldValue.Str("ask pediatrician about vitamin D"), "for_doctor" to FieldValue.Bool(true)), occurredAt = Date(now.time - 1_800_000L), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.VOICE)),
            LogEvent(householdId = H, babyId = B, type = "weight", fields = mapOf("grams" to FieldValue.Num(5400.0)), occurredAt = Date(now.time - 600_000L), loggedBy = A, provenance = Provenance(surface = Surface.PHONE, input = InputKind.TAP))
        )
        val solidsLog = DerivedLog(events = solidsEvents)
        val solids = solidsLog.solidsSummary()
        assertEquals(setOf("Avocado", "Egg"), solids.triedFoods.toSet())
        assertEquals(1, solids.allergenCounts["egg"])
        assertEquals(1, solids.reactions.size)
        val pack = solidsLog.doctorVisitPack(household = h, now = now)
        assertEquals(1, pack.questions.size)
        assertEquals(5400.0, pack.latestWeightGrams!!, 0.01)
        assertTrue(pack.plainTextSummary("Mia", h).contains("ask pediatrician about vitamin D"))
    }

    @Test
    fun testCareTypesAndRequiredFields() = runBlocking {
        val r = EventRegistry.shared
        val grouped = r.modelGroups.flatMap { it.categories }
        assertEquals(grouped.size, grouped.toSet().size)
        assertEquals(r.categories.filter { it.inModel }.map { it.id }.toSet(), grouped.toSet())

        val s = service(categories = r.categories.map { it.id })
        val bath = s.processVoice(transcript = "gave her a bath", surface = Surface.PHONE)
        assertEquals("bath", bath.interpretation.best?.type)
        val med = s.processVoice(transcript = "gave him some infant tylenol", surface = Surface.PHONE)
        assertEquals("medication", med.interpretation.best?.type)
        assertEquals(FieldValue.Str("gave him some infant tylenol"), med.interpretation.best?.fields?.get("medicine"))

        assertEquals("Symptom · Runny nose", VoiceInterpreter.label(type = "symptom", fields = mapOf("symptom" to FieldValue.Str("runny_nose"))))
        assertEquals("38.2 °C", VoiceInterpreter.numberText(38.2, "celsius", Locale.UK))
        assertEquals("100.8 °F", VoiceInterpreter.numberText(38.2, "celsius", Locale.US))
    }

    @Test
    fun testNotALogAndQuickCapture() = runBlocking {
        val noneModel = object : DecisionModel {
            override val version: String = "none-stub"
            override suspend fun decide(request: DecisionRequest): Map<String, DecisionAnswer> {
                val out = KeywordDecisionModel().decide(request).toMutableMap()
                val q = request.questions.firstOrNull { it.id == "category" }
                if (q != null) {
                    val none = 0.97
                    val rest = (1.0 - none) / (q.options.size - 1).toDouble()
                    out["category"] = DecisionAnswer(
                        options = q.options.map { it.key },
                        probabilities = q.options.map { if (it.key == VoiceInterpreter.noneKey) none else rest }
                    )
                }
                return out
            }
        }
        val h = Household(id = H, babyId = B, bottleMl = 120.0, caregivers = listOf(Caregiver(id = A, name = "Alex"))).apply {
            categories = EventRegistry.shared.categories.map { it.id }
        }
        val s = LogService(store = SQLiteLogStore.inMemory(), household = h, me = A, interpreter = VoiceInterpreter(model = noneModel))
        val r = s.processVoice(transcript = "grandma is coming at noon", surface = Surface.PHONE)
        assertEquals(Capture.Status.DISMISSED, r.capture.status)
        assertEquals(listOf(SystemType.NOTE), r.events.map { it.type })

        val ks = service()
        val quick = ks.processVoice(transcript = "just pee", surface = Surface.PHONE, quickCapture = true)
        assertEquals(Capture.Status.DONE, quick.capture.status)
        assertEquals(quick.interpretation.best?.type, quick.events.firstOrNull()?.type)
    }

    @Test
    fun testOAuthPkce() {
        val client = SupabaseClient(config = BackendConfig.local)
        val (url, verifier) = client.oauthStart("google", "weehours://login-callback")
        val uri = URI(url)
        assertEquals("/auth/v1/authorize", uri.path)
        val params = uri.rawQuery.split("&").associate {
            val parts = it.split("=", limit = 2)
            URLDecoder.decode(parts[0], "UTF-8") to URLDecoder.decode(parts.getOrElse(1) { "" }, "UTF-8")
        }
        assertEquals("google", params["provider"])
        assertEquals("weehours://login-callback", params["redirect_to"])
        assertEquals("s256", params["code_challenge_method"])
        val expectedChallenge = SupabaseClient.base64UrlEncode(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.UTF_8)))
        assertEquals(expectedChallenge, params["code_challenge"])
        assertTrue(verifier.length >= 43)
    }

    @Test
    fun testPhotosAndPregnancyAndTimedAndTilt() {
        val s = service()
        val tap = Provenance(surface = Surface.PHONE, input = InputKind.TAP)
        val tummy = s.log(type = "tummy_time", fields = mapOf("minutes" to FieldValue.Num(10.0)), provenance = tap)
        val taken = Date(System.currentTimeMillis() - 60_000L)
        val p1 = s.attachPhoto(to = tummy, width = 2048, height = 1536, takenAt = taken)
        s.attachPhoto(to = tummy, width = 1536, height = 2048, takenAt = null)
        var log = s.derived()
        val photos = log.photos(tummy)
        assertEquals(2, photos.size)
        assertEquals(p1.id, photos[0].id)
        assertEquals("${H.toString().lowercase(Locale.ROOT)}/photos/${p1.id.toString().lowercase(Locale.ROOT)}.jpg", photos[0].storageKey)
        assertFalse(log.effective.any { it.type == SystemType.PHOTO })
        assertEquals(2, log.allPhotos.size)

        val diaper = s.log(type = "diaper", fields = mapOf("kind" to FieldValue.Str("wet")), provenance = tap)
        val dp = s.attachPhoto(to = diaper, width = 100, height = 100, takenAt = null)
        val edited = s.edit(diaper.id, fields = mapOf("kind" to FieldValue.Str("dirty")))
        log = s.derived()
        assertEquals(listOf(dp.id), log.photos(edited).map { it.id })

        val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(2027, Calendar.FEBRUARY, 10, 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val due = cal.time
        val baby = Baby(name = "Bean", dueDate = due)
        assertTrue(baby.isExpected)
        assertEquals(40, baby.gestation(due, cal)?.first)
        val g = baby.gestation(Date(due.time - (11 * 7 + 4) * 86_400_000L), cal)!!
        assertEquals(28, g.first)
        assertEquals(3, g.second)
        assertTrue(baby.canLog("movement"))
        assertFalse(baby.canLog("bottle"))

        val tStart = Date(System.currentTimeMillis() - 12 * 60_000L)
        val timed = s.startTimed("tummy_time", at = tStart)
        assertEquals(FieldValue.Bool(true), s.derived().effective.first { it.id == timed.id }.fields["ongoing"])
        s.stopTimed(timed.id)
        val done = s.derived().effective.first { it.type == "tummy_time" && it.fields["ongoing"] == null && it.supersedes == timed.id }
        assertEquals(FieldValue.Num(12.0), done.fields["minutes"])

        val t0 = Date(1_000_000_000L)
        fun runLock(lock: TiltLock, seconds: Double, reading: (Double) -> Triple<Double, Double, Double>): TiltCompass.Direction? {
            val steps = (seconds * 30).toInt()
            for (i in 0 until steps) {
                val t = i.toDouble() / 30.0
                val (x, y, r) = reading(t)
                val d = lock.update(x = x, y = y, rotation = r, at = Date(t0.time + (t * 1000.0).toLong()))
                if (d != null) return d
            }
            return null
        }
        assertNull(runLock(TiltLock(), 0.9) { Triple(0.0, 25.0, 0.1) })
        assertEquals(TiltCompass.Direction.NORTH, runLock(TiltLock(), 1.2) { Triple(0.0, 25.0, 0.1) })
        val westLock = TiltLock()
        assertEquals(TiltCompass.Direction.WEST, runLock(westLock, 1.2) { Triple(-30.0, 5.0, 0.1) })
        assertEquals(TiltLock.Phase.Locked(TiltCompass.Direction.WEST), westLock.phase)
        assertNull(runLock(TiltLock(), 10.0) { t ->
            Triple(0.0, 25.0 * sin(2.0 * Math.PI * 0.8 * t), 2.5 * abs(cos(2.0 * Math.PI * 0.8 * t)) + 0.6)
        })
    }
}
