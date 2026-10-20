// Voxbrief candidates, 2026-10-19: 5 features to build and 5 performance/quality improvements.
// Each candidate renders the change as the iPhone app would show it (light + dark), plus a
// "How it works" spec card grounded in the files it touches.
(() => {
  const { icon: I, phone, nav, capture, row, section, note, notes, spec, srcIcon, logo } = KIT;
  const views = (render, specHtml, extra = []) => [
    { name: "Light", dark: false, render },
    { name: "Dark", dark: true, render },
    ...extra,
    { name: "How it works", frame: "card", dark: false, render: () => specHtml },
  ];

  // ── baseline: NoteListView today
  const baseline = () => phone(`${nav()}
    ${section(`${I("pin", 12)} Pinned`, row(note("kitchen")), "acc")}
    ${section("Notes", notes.filter((n) => !n.isPinned).map((n) => row(n)).join(""))}
    ${capture()}`, "list");

  // ── F1 Ask Voxbrief
  const ask = ({ searched = "", by = "Answered on this iPhone from 1 of 214 notes · Flash" } = {}) => phone(`${nav({ left: `<span class="acc">${I("back", 22)}</span>`, title: "Ask Voxbrief", right: [] })}
    <div class="chat">
      <div class="q">What did I promise Priya, and by when?</div>
      ${searched ? `<div class="kw">${I("search", 11)} <span>Searched 214 notes for ${searched}</span></div>` : ""}
      <div class="a">
        <p>You told Priya you'd do two things:</p>
        <ul>
          <li>Send the offline-mode spec <b>by Wednesday</b> so it ships before the holiday freeze. <span class="cite">${I("mac", 10)} Q4 roadmap sync · 12:40</span></li>
          <li>Share the Android estimate in the <b>first January planning</b> meeting. <span class="cite">${I("mac", 10)} Q4 roadmap sync · 27:05</span></li>
        </ul>
        <p>She owns the pricing page herself. <span class="cite">${I("mac", 10)} Q4 roadmap sync · 18:22</span></p>
        <div class="by">${I("chip", 12)} ${by}</div>
      </div>
      <div class="sugg"><span>Open tasks from last week</span><span>Everything about the kitchen</span><span>What did Dana recommend?</span></div>
    </div>
    <div class="ask"><span>Ask about your notes…</span><b>${I("send", 16, 2.4)}</b></div>`, "ask");

  // ── F2 Daily Brief
  const brief = () => phone(`${nav({ left: `<span class="acc">${I("back", 22)}</span>`, title: "", right: [I("gear", 20)] })}
    <div class="bh"><small>MONDAY, OCTOBER 19</small><h1>Your brief</h1><p>4 notes since Friday · 9 open action items · 2 high priority</p></div>
    <div class="sh">High priority</div>
    <div class="ig">
      <div class="task"><i></i><div><b>Get a firm quote from the contractor</b><small>Kitchen reno · due Friday</small></div><em class="hi">High</em></div>
      <div class="task"><i></i><div><b>Send Priya the offline-mode spec</b><small>Q4 roadmap sync · by Wednesday</small></div><em class="hi">High</em></div>
    </div>
    <div class="sh">Also open</div>
    <div class="ig">
      <div class="task"><i></i><div><b>Ask if the permit covers moving the sink</b><small>Kitchen reno</small></div><em>Med</em></div>
      <div class="task"><i class="done">${I("check", 12, 3)}</i><div><b class="strike">Pharmacy pickup</b><small>Errands before Thursday</small></div></div>
      <div class="task"><i></i><div><b>Return the drill</b><small>Errands before Thursday</small></div><em>Low</em></div>
      <div class="more">+ 4 more from 2 notes ${I("chevron", 12)}</div>
    </div>
    <div class="sh">Since Friday</div>
    <div class="ig recap"><p>Mostly planning: the <b>Q4 roadmap</b> settled on offline mode first, the <b>kitchen</b> is waiting on a quote, and one call with the bank still has only a transcript.</p><small>${I("sparkle", 11)} Written on-device · Apple Intelligence</small></div>`, "brief");
  const briefLock = () => `<div class="lock">${KIT.statusBar()}<div class="lt"><small>Monday, October 19</small><b>7:30</b></div>
    <div class="notif"><span class="ni">${logo(30)}</span><div><b>Your Voxbrief</b><small>now</small><p>9 open items, 2 high: the contractor quote (Fri) and Priya's spec (Wed).</p></div></div>
    <div class="wdg"><div class="w1">${logo(22)}<b>2</b><small>high</small></div><div class="w2"><b>Send Priya the spec</b><small>Wed · Q4 roadmap</small></div></div>
    ${KIT.homeBar()}</div>`;

  // ── F3 iCloud library sync
  const sync = () => phone(`${nav({ left: `<span class="acc">${I("back", 22)}</span>`, title: "iCloud Library", right: [] })}
    <div class="hero">${I("cloud", 40, 1.6)}<b>One library on every device</b><p>Notes recorded on your Mac, iPhone and Apple Watch end up in the same list. Stored in your private iCloud; nothing touches our servers.</p></div>
    <div class="ig"><div class="tg"><span>Sync with iCloud</span><i class="on"></i></div><div class="tg"><span>Include audio</span><i class="on"></i></div><div class="ikv"><span>iCloud storage used</span><b>1.4 GB</b></div></div>
    <div class="sh">Devices</div>
    <div class="ig">
      <div class="dev">${I("phone", 18)}<div><b>iPhone 17 Pro</b><small>This iPhone · up to date</small></div><i class="dot ok"></i></div>
      <div class="dev">${I("mac", 18)}<div><b>MacBook Pro</b><small>Synced 2 min ago · 3 notes from today</small></div><i class="dot ok"></i></div>
      <div class="dev">${I("watch", 18)}<div><b>Apple Watch</b><small>Through this iPhone</small></div><i class="dot"></i></div>
    </div>
    <div class="sh">Just arrived</div>
    <div class="ig">${row(note("roadmap"), `<span class="from">${I("mac", 10)} from Mac</span>`)}</div>
    <p class="foot">If a note is edited on two devices before they sync, both versions are kept and the older one is marked “Edited on Mac”.</p>`, "sync");

  // ── F4 Import & Share
  const imp = () => phone(`<div class="dim">${nav()}<div class="ig">${notes.slice(0, 3).map((n) => row(n)).join("")}</div></div>
    <div class="sheet">
      <div class="grab"></div>
      <div class="file">${I("wave", 22)}<div><b>Team standup.m4a</b><small>Audio · 14:32 · 6.8 MB</small></div></div>
      <div class="apps">
        <div><span class="app a1">${I("doc", 22)}</span>Files</div>
        <div><span class="app a2">${I("send", 22)}</span>Messages</div>
        <div class="ipick"><span class="app vx">${logo(34)}</span>Voxbrief</div>
        <div><span class="app a3">${I("folder", 22)}</span>Drive</div>
      </div>
      <div class="acts"><div>Copy ${I("copy", 18)}</div><div>Save to Files ${I("folder", 18)}</div></div>
    </div>`, "imp");
  const impList = () => phone(`${nav()}
    ${section("Notes", `${row({ title: "Team standup", summary: "", duration: "14:32", date: "Oct 19", source: "imported", status: "Transcribing 34%" }, `<span class="from">${I("folder", 10)} Imported</span>`)}${notes.slice(0, 3).map((n) => row(n)).join("")}`)}
    ${capture()}`, "imp");

  // ── F5 Live transcript
  const live = () => phone(`<div class="rec">
      <div class="rh"><span class="dotr"></span> Recording · iPhone</div>
      <div class="tm">01:12</div>
      <div class="wv">${Array.from({ length: 36 }, (_, i) => `<i style="height:${10 + Math.round(34 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .45)))}px"></i>`).join("")}</div>
      <div class="lt"><p>okay so for the contractor I need to ask about the cabinet lead time because if it's more than six weeks we miss the holidays</p><p>and whether the permit covers moving the sink <span class="tail">to the island and um what the</span><span class="caret"></span></p></div>
      <div class="hint">${I("chip", 12)} Transcribing as you speak. Lite tidies it up the moment you stop.</div>
      <div class="ctl"><span class="sec">${I("pause", 22, 2.6)}</span><span class="stopb">${I("stop", 30)}</span><span class="sec">${I("pin", 20)}</span></div>
      <small class="cap2">Stop &amp; Save · note ready in about 3 s instead of after transcription</small>
    </div>`, "live");

  // ── I1 Long memos in parts
  const longm = () => phone(`${nav({ left: `<span class="acc">${I("back", 22)}</span>`, title: "", right: [I("share", 20)] })}
    <div class="dh"><span class="chip">Meeting Notes</span><h1>Q4 roadmap sync with Priya</h1><small>${I("mac", 11)} Mac · Oct 19 · 31:12 · 4,630 words</small></div>
    <div class="banner">${I("doc", 16)}<div><b>Long memo, read in 4 parts</b><small>Each part was summarised, then merged. Nothing past minute 8 was dropped.</small></div></div>
    <div class="card"><h4>Summary</h4><p>Offline mode ships before the holiday freeze; Priya owns the pricing page; Android is revisited in January.</p></div>
    <div class="card"><h4>Decisions</h4><ul><li>Offline mode is the only Q4 launch</li><li>Pricing page moves to Priya</li><li>No Android work until January planning</li></ul></div>
    <div class="card"><h4>Action items</h4><ul class="cl"><li class="d">Share the freeze date with support</li><li>Send Priya the offline-mode spec by Wednesday</li><li>Draft the Android estimate</li><li>Book a design review for sync conflicts</li></ul></div>
    <div class="card parts"><h4>Parts</h4><div><span>0:00</span>Freeze date and what fits before it</div><div><span>8:10</span>Offline mode scope, sync conflicts</div><div><span>16:40</span>Pricing page ownership</div><div><span>24:05</span>Android, hiring, next steps</div></div>`, "longm");

  // ── I2 One pass, shared prompt cache
  const bar = (label, a, b, cls = "") => `<div class="br ${cls}"><span>${label}</span><div><i style="width:${a}%"></i></div><b>${b}</b></div>`;
  const onepass = () => phone(`${nav({ left: `<span class="acc">${I("back", 22)}</span>`, title: "Pipeline", right: [] })}
    <div class="seg3"><span>Note</span><span>Transcript</span><span class="on">Pipeline</span></div>
    <div class="sh">Today · 3 full reads of the transcript</div>
    <div class="ig bars">
      ${bar("Transcribe", 30, "6.1 s")}
      ${bar("Pick template", 14, "2.8 s", "x")}
      ${bar("Write note", 46, "9.4 s")}
      ${bar("Light rewrite", 38, "7.7 s", "x")}
      <div class="tot">Ready after <b>26 s</b></div>
    </div>
    <div class="sh">Proposed · read once, reuse the cache</div>
    <div class="ig bars pro">
      ${bar("Transcribe", 30, "6.1 s")}
      ${bar("Template + note", 48, "9.8 s")}
      ${bar("Light rewrite", 16, "3.2 s")}
      <div class="tot">Ready after <b>16 s</b> · light text after 19 s</div>
    </div>
    <p class="foot">Illustrative timings for a 2½-minute memo on Lite. The first step is to measure the real split with signposts on a device.</p>`, "onepass");

  // ── I3 Close the eval gaps
  const evalBar = (label, p, t, target) => `<div class="ev"><span>${label}</span><div><i style="width:${(100 * p) / t}%"></i><em style="left:${target}%"></em></div><b>${p}/${t}</b></div>`;
  const evalg = () => phone(`${nav({ left: `<span class="acc">${I("back", 22)}</span>`, title: "", right: [I("share", 20)] })}
    <div class="dh"><span class="chip">Action Items</span><h1>Migrate billing to <mark>Kubernetes</mark> before the <mark>Stripe</mark> renewal</h1><small>${I("watch", 11)} Apple Watch · Oct 19 · 1:54</small></div>
    <div class="card"><h4>Action items</h4><ul class="cl"><li>Ask Lena whether <mark>Kubernetes</mark> autoscaling is on</li><li>Move the <mark>Stripe</mark> webhooks first</li><li>Keep the cron job on the old box until December</li></ul></div>
    <div class="card fx"><h4>${I("check", 13, 3)} Dictionary terms kept</h4><p>Heard “cooper netties” and “stripe” → <b>Kubernetes</b>, <b>Stripe</b>. “Strip the old box” stays as said: no term forced onto ordinary words.</p></div>
    <div class="sh">Lite eval today (baseline.json, 44 cases × 3)</div>
    <div class="ig evs">
      ${evalBar("Template choice", 30, 30, 95)}
      ${evalBar("Dictionary", 14, 69, 80)}
      ${evalBar("No false terms", 20, 27, 90)}
      ${evalBar("Light rewrite", 1, 6, 80)}
      ${evalBar("All checks", 65, 132, 85)}
      <small class="leg"><i></i> pass rate · <em></em> target</small>
    </div>`, "evalg");

  // ── I4 Instant launch with a big library
  const year = (y, items) => `<div class="sh">${y}</div><div class="ig">${items.map((n) => row(n)).join("")}</div>`;
  const fast = () => phone(`${nav()}
    <div class="perf">${I("bolt", 13)} First frame 0.2 s · 2,318 notes · 3 years</div>
    ${year("This week", notes.slice(0, 3))}
    ${year("Earlier in October", notes.slice(3, 6))}
    <div class="sh">2025</div><div class="ig"><div class="sk"></div><div class="sk"></div><div class="sk s"></div></div>
    ${capture()}`, "fast");

  // ── I5 Keeps processing in the background
  const bg = () => `<div class="lock">${KIT.statusBar()}<div class="lt"><small>Monday, October 19</small><b>9:41</b></div>
    <div class="bgp"><div class="bt">${logo(26)}<b>Voxbrief</b><small>Processing</small></div>
      <p>Tidying 3 Apple Watch memos · 2 of 3</p><div class="pb"><i style="width:68%"></i></div>
      <small>Continues while the phone is locked. Lite unloads when it's done.</small></div>
    <div class="notif"><span class="ni">${logo(30)}</span><div><b>Kitchen reno: questions for the contractor</b><small>now</small><p>Ready · 3 action items</p></div></div>
    ${KIT.homeBar()}</div>`;

  window.REVIEW = {
    key: "voxbrief-candidates-2026-10-19-v1",
    dir: "reports/archive/voxbrief-candidates-2026-10-19",
    title: "Voxbrief · 5 Features & 5 Improvements · 2026-10-19",
    subtitle: "Round 2 · 11 candidates + today's notes list",
    heading: "What should Voxbrief do next?",
    intro: "Five features that aren't in the app yet and five performance/quality fixes, each grounded in the code as of 1.26.7. Open one to see it in light, dark and a <b>How it works</b> card (today vs proposed, files, how we'd measure it). Heart, rate and note as many as you like, crown one per group, then <b>Copy summary</b> and paste it back.",
    legend: ["<b>5</b> features", "<b>5</b> improvements", "<b>7</b> sample notes"],
    round: 2,
    frame: "phone",
    size: [560, 700],
    groups: [
      { id: "feat", name: "Features", note: "New things Voxbrief can do" },
      { id: "impr", name: "Performance & quality", note: "Make what's there faster, sturdier or more accurate" },
    ],
    candidates: [
      {
        id: "current", n: 0, name: "Notes list today", baseline: true, group: "feat",
        tagline: "NoteListView in 1.26.7, for scale",
        concept: "The list as it ships: inline title with the V-Wave mark, Pinned and Notes sections, rows from NoteRowView (colour bar, status, 2-line summary, duration, reading time, action-item progress, date) and the orange capture button.",
        facts: { Source: "VoxbriefApp/Views/NoteListView.swift, NoteRowView.swift" },
        render: baseline,
      },
      {
        id: "ask2", n: 11, name: "Ask Voxbrief · same model as the rewrite", group: "feat", round: 2, mine: true,
        tagline: "01 with no new model: keyword search + the Stage 2 engine",
        concept: "Your round-1 note on 01: answer with the on-device model that already writes the notes, for now. No embedding model to bundle or download: the question is turned into search keywords by that same engine, a keyword (BM25) index over note sections and transcript windows finds the passages, and the engine LLMCopywriterService would pick for a rewrite (Apple Intelligence, else Flash, else Lite) writes the cited answer. Finds what was said in other words less well than embeddings; an embedding index can be added later behind the same Ask screen.",
        moves: ["Engine choice reuses LLMCopywriterService's order and Settings pick: no new model, no new download", "Call 1 (short): question → keywords + synonyms + a date range (“last week”) as JSON", "BM25 over summaries, sections and ~30 s transcript windows, boosted by recency and dictionary terms", "Call 2: top passages (kept under ~2,500 tokens so Apple Intelligence's 4,096 fits) → answer JSON with (noteId, start) citations", "The answer says which engine wrote it and what it searched for"],
        facts: { Effort: "M", Needs: "A keyword index store (rebuilt on restore); ask prompts in LLMCopywriterService + ml/voxbrief_ml/app_prompts.py; an “ask” eval category. Lite's answers will be the weakest" },
        render: () => ask({ searched: "<b>Priya</b>, promise, send, by", by: "Answered on this iPhone · Lite, the model that writes your notes" }),
        views: views(() => ask({ searched: "<b>Priya</b>, promise, send, by", by: "Answered on this iPhone · Lite, the model that writes your notes" }), spec({
          title: "Ask Voxbrief · same model as the rewrite",
          today: ["Search: substring match over title, summary, transcript, sections, tags (NoteListViewModel)", "Stage 2 engine order: Ollama (if on) → Apple Intelligence → Flash / Lite (OnDeviceLLMService)", "No index of any kind"],
          proposed: ["NoteSearchIndex actor: BM25 postings for sections + transcript windows, updated after a note is saved", "AskService: keywords call (≈64 tokens out) → retrieve top 6 passages → answer call", "Runs through the same engine selection as processTranscript, so Settings and fallbacks behave identically", "Citations open NoteDetailView and seek the audio"],
          files: ["VoxbriefApp/Services/NoteSearchIndex.swift (new)", "VoxbriefApp/Services/AskService.swift (new)", "LLMCopywriterService.swift", "NoteListView.swift", "evals/llm/cases.json", "ml/voxbrief_ml/app_prompts.py"],
          measure: ["“ask” eval: the right note is cited on 40 hand-written questions, per engine", "Question → answer time on Lite for a 200-note library"],
          risks: ["Questions phrased unlike the note (“money” vs “budget”) rely on the keyword call's synonyms", "Two LLM calls per question; Lite answers may need a “check the note” hint"],
        })),
      },
      {
        id: "ask", n: 1, name: "Ask Voxbrief", group: "feat", round: 1,
        tagline: "Ask a question, get an answer from your own notes",
        concept: "Search today matches words in titles and transcripts. Ask lets you ask in plain words and answers from the notes that matter, with tappable citations that jump to the exact second of audio. It all runs on the phone: an on-device embedding index finds the notes, the active engine (Apple Intelligence, Flash or Lite) writes the answer. Lite's answers will be weaker than Flash's.",
        moves: ["Embedding index of every note's sections and transcript windows, updated after Stage 2", "Ask screen from the search bar, with suggested questions", "Citations open the note and seek to TranscriptTimingSegment.start", "Also index notes in Spotlight so iOS search finds them"],
        facts: { Effort: "L", Needs: "An on-device embedding model + vector index (new store next to notes_store.json); a retrieval prompt in LLMCopywriterService and eval cases for it" },
        render: () => ask(),
        views: views(() => ask(), spec({
          title: "Ask Voxbrief",
          today: ["Search is substring matching over title, summary, tags and transcript (NoteListViewModel)", "No index, no cross-note answers", "Notes never reach Spotlight (no CoreSpotlight)"],
          proposed: ["NoteIndex actor: embeds summary, each section and ~30 s transcript windows after a note is ready", "Top-k chunks → one generate() call with a cite-your-sources JSON shape", "Answer rendered by our code, citations = (noteId, start) pairs", "CSSearchableItem per note for system search"],
          files: ["VoxbriefApp/Services/NoteIndex.swift (new)", "LLMCopywriterService.swift", "NoteListView.swift", "evals/llm/cases.json"],
          measure: ["New eval category “ask”: answer cites the right note on 40 hand-written questions", "Index size and build time for 1,000 notes on an iPhone 15"],
          risks: ["Lite (0.6B) may answer poorly; gate Ask on Flash / Apple Intelligence or label Lite answers", "Index must be rebuilt on restore from backup"],
        })),
      },
      {
        id: "brief", n: 2, name: "Daily Brief", group: "feat", round: 1,
        tagline: "Every morning: what's open, what's urgent, what you said",
        concept: "Action items already have priorities and checkmarks, but they live inside each note. The brief collects every open item across notes, puts high priority first, and adds a short recap of what you recorded since last time, delivered as a morning notification and a Lock Screen widget. It is the product's name made literal.",
        moves: ["Brief screen from a toolbar button and the notification", "Open items across notes, grouped by actionItemPriorities, tick-off syncs back to each note", "Short on-device recap of new notes since the last brief", "Morning notification (time in Settings) + Lock Screen widget"],
        facts: { Effort: "M", Needs: "Due dates aren't stored (only priority); a widget kind in VoxbriefWidgets (today it has only the Live Activity); a scheduled local notification" },
        render: brief,
        views: views(brief, spec({
          title: "Daily Brief",
          today: ["actionItems, completedActionItems, actionItemPriorities exist per note", "Progress shows as n/m on each row only", "NoteCompletionNotifier only posts “Ready to paste” for keyboard recordings"],
          proposed: ["BriefBuilder: open items across non-archived notes, sorted High → Low → newest", "Recap: one generate() call over the new notes' summaries (short input, fast even on Lite)", "UNCalendarNotificationTrigger at the chosen time; widget reads a small shared snapshot in the app group", "Optional: extract “by Wednesday” as a due date in the generation JSON"],
          files: ["VoxbriefApp/Services/BriefBuilder.swift (new)", "VoxbriefApp/Views/BriefView.swift (new)", "VoxbriefWidgets/", "NoteCompletionNotifier.swift"],
          measure: ["Share of users who open the brief from the notification", "Action items ticked from the brief vs from notes"],
        }), [{ name: "Lock Screen", dark: true, render: briefLock }]),
      },
      {
        id: "sync", n: 3, name: "iCloud Library", group: "feat", round: 1,
        tagline: "Mac, iPhone and Watch notes in one list",
        concept: "The Mac app keeps its own notes_store.json, so a meeting recorded on the Mac never shows up on the iPhone and vice versa. Syncing the library through the user's private iCloud (CloudKit) makes it one library without giving Voxbrief a server, so BACKEND stays none. Audio can be included or left local.",
        moves: ["Private CloudKit database, one record per note + audio as an asset", "Settings → iCloud Library: on/off, include audio, devices", "Rows show where a note came from (“from Mac”)", "Conflicts keep both versions instead of overwriting"],
        facts: { Effort: "L", Needs: "CloudKit container + entitlement on iOS and Mac; per-note change tracking (NoteRepository rewrites the whole array today); a merge rule for edits on two devices" },
        render: sync,
        views: views(sync, spec({
          title: "iCloud Library",
          today: ["iPhone: Application Support/notes_store.json", "Mac: its own notes_store.json (VoxbriefMacApp passes customStorageURL)", "Moving notes = JSON backup export/import by hand"],
          proposed: ["NoteSyncEngine on CKSyncEngine (iOS 17+/macOS 14+), private database only", "VoiceNote gets modifiedAt + a device id; last-writer-wins per field, both kept on a true conflict", "Audio as CKAsset, optional", "Stage 2 runs once, on whichever device recorded the note"],
          files: ["VoxbriefApp/Services/NoteSyncEngine.swift (new, Shared with Mac)", "NoteRepository.swift", "Shared/Models/VoiceNote.swift", "project.yml (iCloud entitlement)"],
          measure: ["A note recorded on the Mac appears on the iPhone in < 30 s on Wi-Fi", "Zero lost edits in a two-device edit test"],
          risks: ["New VoiceNote fields need the decodeIfPresent treatment (no migration layer)", "Privacy text and App Store labels change: data now stored in the user's iCloud"],
        })),
      },
      {
        id: "imp", n: 4, name: "Import & Share", group: "feat", round: 1,
        tagline: "Send any recording to Voxbrief from the share sheet",
        concept: "Voxbrief only processes what it recorded itself. A share extension (and Files import) lets people send in a recorded call, a lecture, a voice message or an old voice memo and get the same transcript and structured note. Cheap to build because the pipeline already takes an audio file.",
        moves: ["Share extension that accepts audio and video files", "Copy into the app group, create a note with a new “Imported” source, run the pipeline", "Import button in the list's menu (fileImporter for audio)", "Long files show progress per stage on the row"],
        facts: { Effort: "M", Needs: "A share-extension target; NoteSource.imported (old builds decoding new JSON must not break); long files depend on candidate 6 (Long memos)" },
        render: imp,
        views: views(imp, spec({
          title: "Import & Share",
          today: ["Notes come from the Watch (WCSession), the iPhone recorder, the Mac and the keyboard", "Settings has a fileImporter, but only for JSON backups"],
          proposed: ["VoxbriefShare extension: NSExtensionActivationSupportsAttachmentsWithMaxCount, UTType.audio/.movie", "Writes to the app group + a pending-import marker; the app ingests on next launch or via a URL handoff", "AVAssetExportSession to m4a when the input is video", "NoteSource.imported (displayName “Imported”, icon folder)"],
          files: ["VoxbriefShare/ (new target)", "project.yml", "Shared/Models/VoiceNote.swift", "AudioFileManager.swift", "NoteListView.swift"],
          measure: ["A 15-minute file shared from Files becomes a ready note without opening Voxbrief first"],
        }), [{ name: "After sharing", dark: false, render: impList }]),
      },
      {
        id: "live", n: 5, name: "Live transcript", group: "feat", round: 1, prefers: "dark",
        tagline: "See your words while you speak on iPhone and Mac",
        concept: "Recording on the iPhone shows a waveform and a timer; the transcript only exists after you stop and Stage 1 runs. Streaming WhisperKit while recording shows the words live (so you can tell it's hearing you) and means Stage 2 can start the moment you stop. The Watch keeps recording only, by design.",
        moves: ["Stream audio buffers into WhisperKit during iPhone/Mac recordings", "Live words under the waveform, confirmed text solid, the tail grey", "On stop, the streamed transcript is final: skip straight to Stage 2", "Falls back to today's after-the-fact pass if streaming lagged"],
        facts: { Effort: "M", Needs: "A streaming path in ASRService (WhisperKit's AudioStreamTranscriber) next to transcribeAudioWithTimings; more battery while recording" },
        render: live,
        views: views(live, spec({
          title: "Live transcript",
          today: ["AudioRecordingService records to a file; QuickRecordSheet shows waveform + timer", "Stage 1 starts after stop (NoteProcessingPipeline.process)", "Partial text exists only during processing (streamingTranscripts)"],
          proposed: ["ASRService.streamTranscription(from:) fed by the recorder's tap", "QuickRecordSheet + Mac overlay render the live text", "Pipeline accepts a precomputed transcript + timings and skips Stage 1", "Watch unchanged: capture stays instant and battery-cheap"],
          files: ["ASRService.swift", "AudioRecordingService.swift", "QuickRecordSheet.swift", "NoteProcessingPipeline.swift", "VoxbriefMac/Views/OverlayView.swift"],
          measure: ["Stop → note ready time for a 2-minute iPhone memo, before vs after", "Word error rate of the streamed transcript vs the batch pass on the same audio"],
          risks: ["Streaming quality can be lower than a full-file pass; keep the batch pass as a fallback"],
        })),
      },
      {
        id: "longm", n: 6, name: "Long memos in parts", group: "impr", round: 1,
        tagline: "A 30-minute meeting gets a full note, not a failure",
        concept: "Stage 2 sends the whole transcript in one prompt. Apple Intelligence's context is 4,096 tokens, roughly a 15-minute memo, so longer ones fail there and fall back to Lite, which then has to digest thousands of words with a 1,024-token answer budget. Splitting long transcripts into parts, extracting from each and merging keeps every minute in the note.",
        moves: ["Token-count the transcript first; past a threshold, split on segment/sentence boundaries", "Extract template sections per part (same JSON shape), then merge and de-duplicate", "One final short call for title + summary over the merged sections", "Note shows “read in 4 parts” and a Parts outline with timestamps"],
        facts: { Effort: "M", Needs: "A tokenizer count per engine; eval cases with 20–40-minute transcripts (none today)" },
        render: longm,
        views: views(longm, spec({
          title: "Long memos in parts",
          today: ["processWithAppleFoundationModelFull / processWithOnDeviceLLMFull pass the full transcript", "No context-window check: an over-long prompt throws, and the note silently moves to Lite", "Lite: maxTokens 1024 for the whole note"],
          proposed: ["StageTwoChunker: ~1,500-token parts with 1-sentence overlap", "Map: extract sections per part · Reduce: merge lists, drop near-duplicates", "Title/summary from the merged sections, not the raw text", "Store part boundaries (start times) for the outline"],
          files: ["LLMCopywriterService.swift", "NoteProcessingPipeline.swift", "evals/llm/cases.json (long cases)", "ml/voxbrief_ml/app_prompts.py"],
          measure: ["New eval category “long”: action items from minute 25 present in the note", "No Apple Intelligence → Lite fallback for memos under 60 minutes"],
        })),
      },
      {
        id: "onepass", n: 7, name: "One pass, shared cache", group: "impr", round: 1,
        tagline: "Stop reading the same transcript three times",
        concept: "A new note costs three full reads of its transcript: the template classification, the generation and the light rewrite, each prefilling the same text from scratch on one GPU queue. Reusing the transcript's prompt cache in MLX (and folding the template pick into the generation JSON) cuts the work without changing the output. Needs eval proof that template choice stays at 30/30.",
        moves: ["Measure first: signposts around classify, generate, light on a device", "Put the transcript first in the prompt so its KV cache can be shared across calls", "Ask for {\"template\": …} as the first key of the generation answer, or keep the 24-token call on the cached prefix", "Same change for Apple Intelligence: one LanguageModelSession per note"],
        facts: { Effort: "M", Needs: "Prompt-cache reuse in MLX Swift 2.29.1 (check the API at the pinned tag); an eval run before/after" },
        render: onepass,
        views: views(onepass, spec({
          title: "One pass, shared cache",
          today: ["processWithOnDeviceLLMFull: classification generate() (24 tokens) then generation generate() (1,024)", "generateLightCleanup runs a third full prompt afterwards", "Each call builds a fresh UserInput and prefill; AppleFoundationModelService makes a new LanguageModelSession per call"],
          proposed: ["Transcript-first prompt layout + cached prefix shared by the 3 calls", "Or: one generation call that names its template (then validate it against the list)", "Light rewrite starts from the cached prefix", "Timing per stage stored on the note for the Pipeline tab"],
          files: ["OnDeviceLLMService.swift", "LLMCopywriterService.swift", "AppleFoundationModelService.swift", "NoteProcessingPipeline.swift"],
          measure: ["Stop → ready time on Lite and Flash, median of 10 memos", "Eval: template 30/30 holds, overall ≥ 65/132"],
          risks: ["Reordering prompts changes outputs: needs the eval and an ml/ prompt-port update"],
        })),
      },
      {
        id: "evalg", n: 8, name: "Close the eval gaps", group: "impr", round: 1,
        tagline: "Dictionary 14/69 and Light 1/6 are the weakest spots",
        concept: "The first full Lite eval passes 65 of 132 checks: template choice is perfect, but dictionary terms survive in only 14 of 69 runs, terms get forced onto ordinary words in 7 of 27, and the light rewrite passes 1 of 6. Ship the Lite LoRA from ml/ once it beats the baseline on these categories, plus targeted prompt fixes for the light pass.",
        moves: ["Prompt fixes for the light pass first (cheap, measurable today)", "Run the ml/ fine-tune with the eval as the gate; ship the adapter only if every category improves", "Add a case to cases.json for each real dictionary report", "Show the target per category in the eval report"],
        facts: { Effort: "L", Needs: "DGX time for the fine-tune; a bundled-model swap (≈350 MB) or a LoRA adapter load path in OnDeviceLLMService" },
        render: evalg,
        views: views(evalg, spec({
          title: "Close the eval gaps",
          today: ["evals/llm/baseline.json: classification 30/30, dictionary 14/69, false-positive 20/27, light 1/6, overall 65/132", "“has term” 63/102, “no term” 51/120", "DictionaryCorrector fixes known aliases before the LLM; unknown sound-alikes rely on the prompt"],
          proposed: ["Light prompt: examples of keeping wording + dropping ASR tags", "Lite LoRA trained on ml/ synthetic data, filtered by the eval's own checks", "Ship only when no category regresses", "Monthly eval keeps tracking it"],
          files: ["LLMCopywriterService.swift (buildLightSystemPrompt)", "ml/", "evals/llm/", "OnDeviceLLMService.swift (model folder)"],
          measure: ["Dictionary ≥ 55/69, light ≥ 5/6, false-positive ≥ 24/27, overall ≥ 110/132"],
          risks: ["Over-fitting to synthetic cases; keep real reports in cases.json as the hold-out"],
        })),
      },
      {
        id: "fast", n: 9, name: "Instant launch, big library", group: "impr", round: 1,
        tagline: "Open in a blink with thousands of notes",
        concept: "NoteRepository.init decodes the whole notes_store.json on the main actor before the first frame, and every edit re-encodes every note (pretty-printed, sorted keys), including full transcripts and per-segment timings the list never shows. That's fine at 50 notes and slow at 2,000. Split the store into a small list index and one file per note, loaded on demand.",
        moves: ["index.json with only what NoteRowView needs; notes/<id>.json for the rest", "Decode the index off the main actor; show the list as soon as it lands", "Write only the note that changed, compact JSON", "One-time migration from notes_store.json, kept as a backup"],
        facts: { Effort: "M", Needs: "A migration step (there is no migration layer today); a 2,000-note fixture to benchmark launch" },
        render: fast,
        views: views(fast, spec({
          title: "Instant launch, big library",
          today: ["loadNotes() runs synchronously in NoteRepository.init (@MainActor)", "NotePersistenceWriter re-encodes the full array per save burst, .prettyPrinted + .sortedKeys", "Each VoiceNote carries rawTranscript, segments, transcriptSegments, both rewrites"],
          proposed: ["NoteIndexStore (list fields) + NoteBodyStore (per-note files)", "NoteDetailView loads the body on open (cached)", "Search over transcripts moves to a background index", "DataBackupService exports the same JSON shape as today"],
          files: ["NoteRepository.swift", "NoteListViewModel.swift", "NoteDetailViewModel.swift", "DataBackupService.swift", "VoxbriefMac (same repository)"],
          measure: ["Cold launch → first list frame with a 2,000-note fixture, before vs after", "Bytes written per checkbox tap"],
          risks: ["Migration bugs lose notes: keep notes_store.json until the new store has loaded twice"],
        })),
      },
      {
        id: "bg", n: 10, name: "Finish in the background", group: "impr", round: 1, prefers: "dark",
        tagline: "Memos keep processing after you lock the phone",
        concept: "Processing only runs while the app is in front: a backlog of Watch memos waits until you open Voxbrief, then runs one by one, and locking the phone mid-way leaves a note half done until the next launch. iOS 26's continued-processing tasks let the user-started work finish with a system progress view, and unloading the models after the queue empties keeps Voxbrief from being the first app iOS kills.",
        moves: ["BGContinuedProcessingTask for queues started from Stop & Save or a sync the user triggered", "System progress: “Tidying 3 Apple Watch memos · 2 of 3”", "Unload Lite/Flash and WhisperKit after the queue is empty or on a memory warning", "On launch, re-queue notes stuck in transcribingASR/cleaningLLM automatically"],
        facts: { Effort: "M", Needs: "iOS 26 for continued processing (GPU only on supported devices); Watch syncs that arrive on their own still wait for the app to open" },
        render: bg,
        views: views(bg, spec({
          title: "Finish in the background",
          today: ["beginBackgroundTask in WatchSyncService / RecordingCoordinator (~30 s of grace)", "Stuck notes are re-run when the list becomes active (NoteListViewModel.refresh), serially", "OnDeviceLLMService keeps smallContainer/largeContainer for the app's lifetime; no memory-warning handling"],
          proposed: ["ProcessingQueue owns the backlog and reports progress to a BGContinuedProcessingTask", "ModelResidency: unload after 2 min idle, on memory warning, on background with an empty queue; MLX GPU cache limit", "Resume pending notes at launch, not only on scene activation"],
          files: ["NoteProcessingPipeline.swift", "OnDeviceLLMService.swift", "ASRService.swift", "WatchSyncService.swift (iOS)", "VoxbriefApp.swift"],
          measure: ["3 Watch memos synced, phone locked: all ready within 2 min", "Peak memory with Flash loaded, and memory 2 min after the queue empties"],
        })),
      },
    ],
  };
})();
