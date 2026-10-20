// Wee Hours · 5 Potential Features + 10 Potential Improvements
// Grounded in projects/weehours/ (CLAUDE.md, docs/decisions.md, spec/event-types.json, HomeView.swift, TimelineView.swift, SettingsView.swift, LogService.swift)
(() => {
  const K = KIT;
  const I = K.icon;
  const { mia, leo } = K;

  // ── 00 · Baseline: Today's app (v0.4.5)
  const baselineNow = () => K.phone(
    `${K.nav("Mia", K.pill("3 weeks"))}
     ${K.statusCard(mia.status)}
     ${K.grid(K.defaultTiles(mia))}`
  );
  const baselineMulti = () => K.phone(
    `${K.nav("Mia &amp; Leo", K.pill("3 weeks"))}
     ${K.childrenPanel("mia")}
     ${K.grid(K.defaultTiles(mia))}`
  );
  const baselineTimeline = () => K.phone(
    `${K.nav("Timeline", `<span class="tbtn">${I("undo", 16)}</span>`)}
     <div class="seg2"><span class="on">All</span><span>Mia</span><span>Leo</span></div>
     <div class="day">Monday, October 19, 2026</div>
     <div class="card evs">${K.sampleEvents.map((e) => K.evRow(e, { multi: true })).join("")}</div>`,
    { tab: "timeline" }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 1: 5 POTENTIAL FEATURES
  // ══════════════════════════════════════════════════════════════════════════

  // ── F01 · Duty Hand-off Digest ("Since Your Last Shift")
  const handoffDigestNow = (expanded = true) => K.phone(
    `${K.nav("Mia", K.pill("3 weeks"))}
     <div class="card status">
       <p class="line">Fed 1h20m ago · left next · diaper 40m ago</p>
       <div class="duty on-me">${I("check", 14, 2.6)}<span><b>You</b> took duty just now (from Alex · 5h 15m shift)</span><b>Hand off</b></div>
     </div>
     ${expanded ? `<div class="card digest">
       <div class="dh">
         <div><span class="badge-tag">HAND-OFF BRIEF</span><h4>While Alex was on duty · 10:00 PM – 3:12 AM</h4></div>
         <span class="xbtn">Dismiss</span>
       </div>
       <div class="dstats">
         <div><b>2 feeds</b><small>170 ml total · 1:40a, 10:30p</small></div>
         <div><b>3 diapers</b><small>2 wet · 1 dirty (12:15a)</small></div>
         <div><b>3h 40m sleep</b><small>2 stretches · up at 1:35a</small></div>
       </div>
       <div class="dnotes">
         <div class="dn med">${I("pill", 14)}<span><b>Infant Tylenol · 1.25 ml</b> given at 12:50 AM (2h 22m ago)</span></div>
         <div class="dn note">${I("note", 14)}<span>“A little fussy after the midnight bottle, burped twice — extra wipes in top drawer”</span></div>
       </div>
     </div>` : ""}
     ${K.grid(K.defaultTiles(mia).slice(0, 6))}`
  );

  const handoffPushLock = () => K.phone(
    `<div class="lockscr">
       <div class="ltime"><b>3:12</b><small>Tuesday, October 20</small></div>
       <div class="lnotif">
         <div class="lnh">${I("stars", 14)}<b>WEE HOURS · SHIFT HAND-OFF</b><small>now</small></div>
         <b>Alex handed off duty to you</b>
         <p>Last 5h: 2 feeds (170 ml), 2 wet + 1 dirty diaper, 3h 40m sleep. Tylenol at 12:50 AM. Next feed due in ~40m.</p>
         <div class="lnbtns"><span>I've got it ✓</span><span>Open log</span></div>
       </div>
       <div class="lwidget">
         <div class="lwh">${I("bottle", 15)}<b>Mia · Fed 1h20m ago</b><span>left next</span></div>
         <small>Diaper 40m ago · You're on duty</small>
       </div>
     </div>`,
    { fab: false, time: "3:12" }
  );

  // ── F02 · Milk Stash & Bottle Prep Ledger (Optional in Settings)
  const milkStashNow = (sheet = false) => K.phone(
    `${K.nav("Mia", K.pill("3 weeks"))}
     ${K.statusCard("Fed 1h20m ago · left next · diaper 40m ago")}
     <div class="card stash-bar">
       <div class="sbh">
         <div><b>Milk stash</b><small>optional · enabled in Settings → Tracking</small></div>
         <span class="pill-cta">Log freezer bag</span>
       </div>
       <div class="sbpods">
         <div class="spod fridge">
           <div class="spi">${I("bottle", 16)}<b>310 ml</b></div>
           <small>Fridge · 3 bottles ready</small>
           <span class="exp ok">oldest 18h ago (good 4d)</span>
         </div>
         <div class="spod freezer">
           <div class="spi">${I("snow", 16)}<b>1,420 ml</b></div>
           <small>Freezer · 9 bags</small>
           <span class="exp">oldest Oct 4 (#01)</span>
         </div>
       </div>
     </div>
     ${K.grid([
       K.tile("Start bottle", "120 ml · fridge milk (FIFO)", "bottle", "feed"),
       K.tile("Pumped", "last: 110 ml · 3h ago", "pump", "other"),
       K.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
       K.tile("Fell asleep", "start sleep", "moon", "sleep"),
     ])}`,
    { overlay: sheet ? `<div class="scrim"></div><div class="bsheet">
      <div class="bsh"><span>Cancel</span><b>Pumped milk</b><span class="pri">Save</span></div>
      <div class="bsf">
        <div class="fgrp">
          <div class="frow"><span>Amount</span><b>110 ml</b></div>
          <div class="frow"><span>Side</span><div class="seg-mini"><span>Left</span><span>Right</span><span class="on">Both</span></div></div>
          <div class="frow"><span>Where</span><div class="seg-mini"><span class="on">Fridge</span><span>Freezer</span><span>Fed now</span></div></div>
        </div>
        <p class="fnote">Voice: <i>“pumped 110 ml into the fridge”</i> or <i>“froze 150 ml bag”</i>. Breast-milk bottles automatically subtract from the oldest fridge milk.</p>
      </div>
    </div>` : "" }
  );

  const milkStashSettings = () => K.phone(
    `${K.nav("Settings", "")}
     <div class="day">Tracking</div>
     <div class="card fgrp">
       <div class="frow"><span>Bottle feeding</span><b class="acc-txt">On</b></div>
       <div class="frow"><span>Nursing</span><b class="acc-txt">On</b></div>
       <div class="frow"><span>Pumping</span><b class="acc-txt">On</b></div>
       <div class="frow"><span><b>Track milk stash</b> (fridge &amp; freezer)</span><b class="acc-txt">On</b></div>
       <div class="frow"><span>Default bottle size</span><b>120 ml</b></div>
     </div>
     <p class="fnote">Off by default. Turn on <b>Track milk stash</b> in Settings → Tracking to show Fridge &amp; Freezer balances on Now and track where pumped milk goes (fridge, freezer, or fed right away). When off, Pumping logs just amount &amp; side with zero extra UI.</p>`,
    { tab: "settings", fab: false }
  );

  // ── F03 · Temporary Caregiver Pass (Scoped QR / Web Link)
  const sitterPassSettings = () => K.phone(
    `${K.navInline("‹ Settings", "Caregiver pass", "")}
     <div class="card pass-card">
       <div class="qrbox">${I("qr", 86, 1.5)}</div>
       <h3>weehours.app/pass/7K9-M2P</h3>
       <p>Grandma (Joan) · expires today at 11:00 PM</p>
       <div class="pbadges">
         <span>${I("check", 12, 2.5)} Can log &amp; see today</span>
         <span>${I("lock", 12, 2.2)} No older history or settings</span>
       </div>
       <div class="pbtns"><span class="bpri">Share link</span><span class="bsec">Revoke now</span></div>
     </div>
     <div class="day">Create a temporary pass</div>
     <div class="card fgrp">
       <div class="frow"><span>Who</span><b>Grandma Joan</b></div>
       <div class="frow"><span>Children</span><b>Mia &amp; Leo</b></div>
       <div class="frow"><span>Valid for</span><div class="seg-mini"><span>4h</span><span class="on">8h</span><span>24h</span><span>Weekend</span></div></div>
       <div class="frow"><span>Works in browser</span><span class="mut">No app install or account needed</span></div>
     </div>`,
    { tab: "settings", fab: false }
  );

  const sitterPassWeb = () => K.phone(
    `<div class="webbar"><span>🔒 weehours.app/pass/7K9-M2P</span><b>Grandma Joan · until 11 PM</b></div>
     <div class="body">
       <div class="nav"><h1>Mia</h1></div>
       <div class="card status"><p class="line">Fed 1h20m ago · bottle 120 ml · diaper 40m ago</p>
         <div class="duty">${I("clock", 14)}<span>Pass active · Sam &amp; Alex see everything you log</span></div>
       </div>
       <div class="card note-pin">
         <b>Pinned by Alex &amp; Sam</b>
         <p>Bottles are on the top shelf of the fridge (warm 3m). Sleep sack is on the crib rail. Ped: Dr. Patel (555) 019-2831.</p>
       </div>
       ${K.grid([
         K.tile("Start bottle", "120 ml", "bottle", "feed"),
         K.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
         K.tile("Fell asleep", "start nap", "moon", "sleep"),
         K.tile("Leave a note", "for Sam & Alex", "note", "other"),
       ])}
     </div>`,
    { fab: false }
  );

  // ── F04 · Solids First-Foods & Reaction Log
  const solidsFirstFoods = (sheet = false) => K.phone(
    `${K.nav("Mia · Solids", K.pill("84 foods tried"))}
     <div class="card solids-sum">
       <div class="ssh"><b>Allergen introductions (9/9)</b><small>tap to log</small></div>
       <div class="achips">
         <span class="aok">✓ Egg (6×)</span>
         <span class="aok">✓ Peanut (4×)</span>
         <span class="aok">✓ Dairy (8×)</span>
         <span class="awarn">! Sesame (mild rash Oct 12)</span>
         <span class="anew">+ Cashew (day 2/3)</span>
         <span class="atodo">Soy</span>
       </div>
     </div>
     <div class="day">Recent solid meals</div>
     <div class="card evs">
       ${K.evRow({ t: "12:15 PM", icon: "fork", cls: "feed", label: "Solids · Avocado + egg yolk, most", by: "Alex", surf: "phone", quote: "ate most of the avocado and egg" }, { extraRight: `<span class="fbadge ok">No reaction</span>` })}
       ${K.evRow({ t: "Yesterday", icon: "fork", cls: "feed", label: "Solids · Tahini oatmeal, some", by: "Sam", surf: "phone" }, { extraRight: `<span class="fbadge warn">Mild chin rash</span>` })}
       ${K.evRow({ t: "Oct 17", icon: "fork", cls: "feed", label: "Solids · Steamed broccoli, taste", by: "Alex", surf: "phone" }, { extraRight: `<span class="fbadge fnew">1st time ★</span>` })}
     </div>`,
    { tab: "timeline", overlay: sheet ? `<div class="scrim"></div><div class="bsheet">
      <div class="bsh"><span>Cancel</span><b>Solids</b><span class="pri">Log</span></div>
      <div class="bsf">
        <div class="rchips"><span class="on">Avocado</span><span class="on">Egg</span><span>Banana</span><span>Oatmeal</span><span>Peanut butter</span><span>+ New food</span></div>
        <div class="fgrp">
          <div class="frow"><span>Amount</span><div class="seg-mini"><span>Taste</span><span>Some</span><span class="on">Most</span><span>All</span></div></div>
          <div class="frow"><span>Reaction</span><div class="seg-mini"><span class="on">None</span><span>Rash</span><span>Spit-up</span><span>Hives</span></div></div>
        </div>
        <p class="fnote">Deterministic food parser extracts food names from speech: <i>“had some mashed avocado and peanut butter”</i>.</p>
      </div>
    </div>` : "" }
  );

  // ── F05 · Doctor Visit Question Queue & Fact Sheet
  const doctorVisitQueue = (copied = false) => K.phone(
    `${K.navInline("‹ Now", "Doctor visit", `<span class="pri">Log visit</span>`)}
     <div class="card facts-box">
       <div class="fbh">
         <div><span class="badge-tag">SINCE LAST VISIT · OCT 2 (17 DAYS)</span><h4>Fact sheet for the pediatrician</h4></div>
         <span class="pill-cta">${copied ? "✓ Copied" : "Copy facts"}</span>
       </div>
       <div class="frows">
         <div><span>Latest measurements</span><b>4.10 kg (+520 g) · 52.0 cm · 36.2 cm head</b></div>
         <div><span>Feeds (last 7d)</span><b>58 feeds · 710 ml/day avg bottle</b></div>
         <div><span>Diapers (last 7d)</span><b>44 wet · 19 dirty (6.3 wet/day)</b></div>
         <div><span>Health entries</span><b>1 fever (38.2 °C Oct 14) · 2 Tylenol doses · 1 rash</b></div>
       </div>
     </div>
     <div class="day">Questions to ask (${I("mic", 11)} say “ask the doctor…”)</div>
     <div class="card qlist">
       <div class="qitem"><i class="qchk on">${I("check", 12, 3)}</i><div><b>Vitamin D drops — keep at 400 IU when switching to half formula?</b><small>Sam · voice note Oct 15</small></div></div>
       <div class="qitem"><i class="qchk"></i><div><b>Mild chin redness after tahini — keep offering sesame or wait?</b><small>Alex · pinned from Oct 18 solids entry</small></div></div>
       <div class="qitem"><i class="qchk"></i><div><b>Left eye tear duct still a bit sticky in the mornings</b><small>Sam · voice note Oct 19</small></div></div>
       <div class="qadd">+ Add a question for the appointment</div>
     </div>`,
    { fab: false }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 2: 10 POTENTIAL IMPROVEMENTS
  // ══════════════════════════════════════════════════════════════════════════

  // ── I01 · Medication Cooldown & Last-Dose Badge on Now
  const impMedCooldown = () => K.phone(
    `${K.nav("Mia", K.pill("3 weeks"))}
     ${K.statusCard(mia.status)}
     ${K.grid([
       K.tile("Start bottle", "120 ml", "bottle", "feed"),
       K.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
       `<div class="tile health med-live">
          <div class="th"><span class="ti">${I("pill", 24)}</span><span class="med-pill">2h 22m ago</span></div>
          <b>Medication</b>
          <small>Infant Tylenol · 1.25 ml at 12:50a</small>
          <div class="med-sub"><b>3 doses in 24h</b> · tap for 1-tap repeat</div>
        </div>`,
       `<div class="tile health">
          <div class="th"><span class="ti">${I("therm", 24)}</span><span class="med-pill warn">37.9 °C</span></div>
          <b>Temperature</b>
          <small>1h 05m ago · down from 38.3 °C</small>
        </div>`,
       K.tile("Fell asleep", "start sleep", "moon", "sleep"),
       K.tile("Weight", "4.10 kg", "scale", "growth"),
     ])}
     <div class="card med-popover">
       <div class="mph"><b>Quick log Medication</b><small>or open full form…</small></div>
       <div class="mpchips">
         <span class="mp-pri">${I("pill", 13)} Repeat Infant Tylenol · 1.25 ml</span>
         <span>Vitamin D · 1 drop</span>
         <span>Gas drops · 0.3 ml</span>
       </div>
     </div>`
  );

  // ── I02 · Backdated Start / Finish Time Picker on Now Tiles
  const impBackdateMenu = () => K.phone(
    `${K.nav("Mia", K.pill("3 weeks"))}
     <div class="card status">
       <p class="line">Sleeping 42m · left next · diaper 1h10m ago</p>
       ${K.duty()}
     </div>
     ${K.grid([
       K.tile("Start bottle", "120 ml", "bottle", "feed"),
       K.tile("Start nursing", "left side", "heart", "feed"),
       K.tile("Diaper", "wet · dirty · both", "drop", "diaper"),
       `<div class="tile sleep active-ring"><div class="th"><span class="ti">${I("sun", 24)}</span><span class="hold-hint">hold: when</span></div><b>Woke up</b><small>sleeping since 2:30 AM</small></div>`,
     ])}`,
    { overlay: `<div class="scrim light"></div>
      <div class="ctx-menu">
        <div class="cm-head">Woke up · Mia</div>
        <div class="cm-item on"><b>Just now</b><span>3:12 AM</span></div>
        <div class="cm-item"><b>5 minutes ago</b><span>3:07 AM</span></div>
        <div class="cm-item"><b>10 minutes ago</b><span>3:02 AM</span></div>
        <div class="cm-item"><b>15 minutes ago</b><span>2:57 AM</span></div>
        <div class="cm-item"><b>30 minutes ago</b><span>2:42 AM</span></div>
        <div class="cm-item pick"><b>Pick a clock time…</b><span>${I("clock", 14)}</span></div>
      </div>` }
  );

  // ── I03 · 24-Hour Day Ribbon & Category Filter Bar on Timeline
  const impTimelineRibbon = () => K.phone(
    `${K.nav("Timeline", `<span class="tbtn">${I("undo", 16)}</span>`)}
     <div class="search-bar">${I("search", 14)}<span>Search notes, medicines, transcripts…</span></div>
     <div class="fchips">
       <span class="on">All</span>
       <span class="feed">Feeds</span>
       <span class="diaper">Diapers</span>
       <span class="sleep">Sleep</span>
       <span class="health">Health</span>
       <span>Notes</span>
     </div>
     <div class="card ribbon-card">
       <div class="rbh"><b>24h rhythm · Today vs Yesterday</b><small>12a → 12a</small></div>
       <div class="rrow">
         <span class="rlbl">Today</span>
         <div class="rbar">
           <i class="sl" style="left:0%;width:16%"></i>
           <i class="fd" style="left:17%;width:4%"></i>
           <i class="sl" style="left:22%;width:19%"></i>
           <i class="fd" style="left:42%;width:4%"></i>
           <i class="dp" style="left:45%;width:2%"></i>
           <i class="sl" style="left:52%;width:11%"></i>
           <i class="fd" style="left:65%;width:4%"></i>
           <i class="sl" style="left:74%;width:14%"></i>
         </div>
       </div>
       <div class="rrow">
         <span class="rlbl">Yest.</span>
         <div class="rbar">
           <i class="sl" style="left:2%;width:14%"></i>
           <i class="fd" style="left:18%;width:4%"></i>
           <i class="sl" style="left:24%;width:17%"></i>
           <i class="fd" style="left:43%;width:4%"></i>
           <i class="sl" style="left:50%;width:13%"></i>
           <i class="fd" style="left:64%;width:4%"></i>
           <i class="sl" style="left:72%;width:18%"></i>
         </div>
       </div>
       <div class="rticks"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>now</span></div>
     </div>
     <div class="day">Today · 6 entries</div>
     <div class="card evs">${K.sampleEvents.slice(0, 4).map((e) => K.evRow(e)).join("")}</div>`,
    { tab: "timeline" }
  );

  // ── I04 · Complete Universal Event Editor (All Types + Convert Session)
  const impCompleteEditor = (type = "med") => K.phone(
    type === "med"
      ? `${K.navInline("Cancel", "Edit Medication", `<b class="pri">Save</b>`)}
         <div class="card fgrp">
           <div class="frow"><span>When</span><b>Today, 12:50 AM</b></div>
           <div class="frow"><span>Child</span><div class="seg-mini"><span class="on">Mia</span><span>Leo</span></div></div>
         </div>
         <div class="day">Fields (spec/event-types.json)</div>
         <div class="card fgrp">
           <div class="frow"><span>Medicine</span><b>Infant Tylenol</b></div>
           <div class="frow"><span>Dose</span><b>1.25 ml</b></div>
         </div>
         <div class="rchips"><span class="on">Infant Tylenol</span><span>Vitamin D</span><span>Gas drops</span><span>Ibuprofen</span></div>
         <div class="day">Change entry type</div>
         <div class="card fgrp">
           <div class="frow"><span>Entry type</span><b class="acc-txt">Medication ▾</b></div>
         </div>
         <div class="card fgrp">
           <div class="frow"><span>Logged by</span><span class="mut">Alex · phone · voice (94%)</span></div>
           <div class="frow"><span>Transcript</span><span class="mut">“gave Mia 1.25 ml of infant tylenol”</span></div>
         </div>`
      : `${K.navInline("Cancel", "Edit Bottle", `<b class="pri">Save</b>`)}
         <div class="card fgrp">
           <div class="frow"><span>Started</span><b>Today, 1:40 AM</b></div>
           <div class="frow"><span>Finished</span><b class="acc-txt">+ Add finish time (close session)</b></div>
           <div class="frow"><span>Or convert to</span><div class="seg-mini"><span class="on">Start + Finish</span><span>One-entry bottle</span></div></div>
         </div>
         <div class="card fgrp">
           <div class="frow"><span>Contents</span><div class="seg-mini"><span class="on">Formula</span><span>Breast milk</span></div></div>
           <div class="frow"><span>Drank</span><div class="seg-mini"><span>¼</span><span>½</span><span class="on">¾</span><span>All</span></div></div>
           <div class="frow"><span>Exact ml (override)</span><b>90 ml</b></div>
         </div>`,
    { tab: "timeline", fab: false }
  );

  // ── I05 · Paired Session Cards in Timeline
  const impPairedSessions = () => K.phone(
    `${K.nav("Timeline", `<span class="tbtn">${I("undo", 16)}</span>`)}
     <div class="day">Today · paired sessions</div>
     <div class="card evs">
       ${K.evRow(K.sampleEvents[0])}
       <div class="ev sess-pair">
         <span class="evi sleep">${I("moon", 15)}</span>
         <div class="evb">
           <div class="evt"><b>Nap · 1h 15m</b><span class="sbadge">1:22 AM → 2:37 AM</span></div>
           <div class="ssteps">
             <span>1:22 AM · Fell asleep (Sam)</span>
             <span>2:37 AM · Woke up (Alex · watch)</span>
           </div>
         </div>
       </div>
       <div class="ev sess-pair">
         <span class="evi feed">${I("bottle", 15)}</span>
         <div class="evb">
           <div class="evt"><b>Bottle · 90 ml (¾) · formula</b><span class="sbadge">15m · 1:40–1:55a</span></div>
           <div class="evq">“finished bottle drank three quarters”</div>
           <div class="ssteps">
             <span>1:40 AM · Start bottle · formula</span>
             <span>1:55 AM · Finish bottle · drank ¾ (90 ml)</span>
           </div>
         </div>
       </div>
       <div class="ev sess-pair">
         <span class="evi feed">${I("heart", 15)}</span>
         <div class="evb">
           <div class="evt"><b>Nursing · 22m · Left → Right</b><span class="sbadge">11:05–11:27p</span></div>
           <div class="ssteps">
             <span>11:05 PM · Start left</span>
             <span>11:16 PM · Switched to right (+11m)</span>
             <span>11:27 PM · Finished (+11m)</span>
           </div>
         </div>
       </div>
     </div>`,
    { tab: "timeline" }
  );

  // ── I06 · Multi-Event Compound Voice Utterances
  const impCompoundVoice = (view = "toast") => view === "toast"
    ? K.phone(
        `${K.nav("Mia", K.pill("3 weeks"))}
         ${K.statusCard("Sleeping just now · left next · diaper just now")}
         ${K.grid(K.defaultTiles({ ...mia, sleeping: true }).slice(0, 6))}`,
        { overlay: `<div class="toastm multi-toast">
            <div class="mth">
              <span class="ok check">${I("check", 13, 3)}</span>
              <div><b>Logged 2 entries from 1 sentence</b><small>“wet diaper and she fell asleep 10 minutes ago”</small></div>
              <b>Undo both</b>
            </div>
            <div class="mtitems">
              <span>${I("drop", 12)} Diaper · wet (3:02 AM)</span>
              <span>${I("moon", 12)} Fell asleep (3:02 AM)</span>
            </div>
          </div>` }
      )
    : K.phone(
        `${K.navInline("‹ Voice", "Current Model (groups2)", "")}
         <div class="day">Can shipped Laya (groups2) do this?</div>
         <div class="card fgrp">
           <div class="frow"><span>Single-pass Laya</span><b class="mut">No (1-label softmax)</b></div>
           <div class="frow"><span>Clause split + 2× Laya</span><b class="acc-txt">Yes (explicit conjunctions)</b></div>
           <div class="frow"><span>Latency for 2 clauses</span><b>~700 ms (2 × 350 ms)</b></div>
         </div>
         <div class="day">How clause-split works on groups2</div>
         <div class="card fgrp">
           <div class="frow"><span>1. Split</span><b>“ and then ” · “ and ” · “, then ”</b></div>
           <div class="frow"><span>2. Guard</span><b>Both sides match distinct category lexicons</b></div>
           <div class="frow"><span>3. Keep intact</span><b>“wet and dirty” · “Mia and Leo”</b></div>
           <div class="frow"><span>4. Run model</span><b>Calls unchanged Laya per clause</b></div>
         </div>
         <p class="fnote"><b>Verdict:</b> Works with the current <code>groups2</code> model <i>only</i> when a deterministic pre-splitter divides the transcript into 2 clauses and calls Laya twice. Implicit compounds without a conjunction or <code>needs_review</code> on one half remain tricky — safe to either ship as a conservative 2-clause splitter or save for the next ML round.</p>`,
        { tab: "settings", fab: false }
      );

  // ── I07 · Live Transcript Preview & Optional Auto-Stop on Silence in ListeningView
  const impLiveListening = (view = "listen") => view === "listen"
    ? K.phone(
        `<div class="listen-scr">
           <div class="ltop">
             <span class="lauto">Auto-log on silence · <b>ON</b> (Settings → Voice)</span>
           </div>
           <h2>Listening…</h2>
           <div class="live-tx">
             <p>“finished the bottle ten minutes ago, drank <span class="word-cur">three quarters</span>”</p>
           </div>
           <div class="live-chips">
             <span class="lc feed">${I("bottle", 13)} Finish bottle</span>
             <span class="lc">¾ (90 ml)</span>
             <span class="lc">3:02 AM (-10m)</span>
           </div>
           <div class="wave-mock">
             ${[18,28,46,72,95,84,60,92,110,88,52,36,64,98,118,90,54,32,22,14].map((h) => `<i style="height:${h}px"></i>`).join("")}
           </div>
           <div class="ltimer">0:04 · pausing 1.8s logs automatically</div>
           <div class="ldone">${I("check", 32, 2.8)}</div>
           <div class="lcancel">Cancel</div>
         </div>`,
        { fab: false }
      )
    : K.phone(
        `${K.nav("Settings", "")}
         <div class="day">Voice</div>
         <div class="card fgrp">
           <div class="frow"><span>Mic button</span><b>Floating</b></div>
           <div class="frow"><span>Quick capture</span><b class="acc-txt">On</b></div>
           <div class="frow"><span><b>Auto-log when you stop speaking</b></span><b class="acc-txt">On</b></div>
           <div class="frow"><span>Decision model</span><b>Laya (on-device)</b></div>
         </div>
         <p class="fnote">Off by default. When <b>Auto-log when you stop speaking</b> is turned on, Wee Hours stops recording after 1.8 seconds of silence following speech and logs right away — no second tap needed when your hands are full. (Switching kids on the fly inside ListeningView is saved for a future iteration.)</p>`,
        { tab: "settings", fab: false }
      );

  // ── I08 · Twins Sync / Swap Action Bar ("Copy to Other Child")
  const impTwinsBar = () => K.phone(
    `${K.nav("Mia &amp; Leo", K.pill("3 weeks"))}
     ${K.childrenPanel("mia")}
     ${K.grid(K.defaultTiles(mia).slice(0, 4))}`,
    { overlay: `<div class="toastm twin-toast">
        <div class="mth">
          <span class="ok check">${I("check", 13, 3)}</span>
          <div><b>Bottle · 90 ml · Mia</b><small>Logged just now</small></div>
          <b>Undo</b>
        </div>
        <div class="twin-actions">
          <span class="ta-btn" style="--k:${leo.color}">${K.dot(leo.color, 8)} <b>+ Log for Leo too</b> (110 ml)</span>
          <span class="ta-swap">${I("swap", 13)} Swap to Leo</span>
        </div>
      </div>` }
  );

  // ── I09 · Apple Watch Bottle Amount, Care Toggles & Both-Children Mode
  const impWatchUpgrade = () => K.phone(
    `${K.nav("Watch Companion", K.pill("watchOS"))}
     <div class="watch-showcase">
       <div class="wframe">
         <div class="wsb"><span>Mia ▾</span><b>3:12</b></div>
         <p class="wline">Feeding 14m · 120 ml bottle</p>
         <div class="wbtn feed">${I("bottle", 14)}<b>Finish bottle…</b></div>
         <div class="wpicker">
           <span>¼</span><span>½</span><span class="on">¾</span><span>All</span>
         </div>
         <div class="wrow2">
           <div class="wmini diaper">${I("drop", 14)}<span>Diaper</span></div>
           <div class="wmini sleep">${I("moon", 14)}<span>Asleep</span></div>
         </div>
       </div>
       <div class="wframe">
         <div class="wsb"><span class="both-tag">Mia + Leo ▾</span><b>3:12</b></div>
         <p class="wline">Mia: Fed 1h20m · Leo: Asleep 35m</p>
         <div class="wbtn mic">${I("mic", 14)}<b>Speak</b></div>
         <div class="wLabel">Pinned trackers</div>
         <div class="wrow2">
           <div class="wmini care">${I("tummy", 14)}<span>Tummy 4m</span></div>
           <div class="wmini health">${I("pill", 14)}<span>Tylenol</span></div>
         </div>
       </div>
     </div>
     <div class="card fgrp">
       <div class="frow"><span>1. Bottle finish</span><b>Asks ¼ · ½ · ¾ · All on wrist</b></div>
       <div class="frow"><span>2. Child picker</span><b>Adds “Both / All” for twins</b></div>
       <div class="frow"><span>3. Pinned tiles</span><b>Top 2 care/timed trackers on watch</b></div>
     </div>`,
    { fab: false }
  );

  // ── I10 · Per-Caregiver Quiet Hours UI & Reminder Snooze Actions
  const impQuietAndSnooze = () => K.phone(
    `${K.navInline("‹ Settings", "Reminders &amp; Quiet Hours", "")}
     <div class="day">Interactive notification actions</div>
     <div class="card notif-preview">
       <div class="lnh">${I("bell", 13)}<b>WEE HOURS · FEED DUE</b><small>now</small></div>
       <b>Mia · Feed due (3h since last bottle)</b>
       <div class="np-actions">
         <span class="pri">Start bottle</span>
         <span>Snooze 15m</span>
         <span>Snooze 30m</span>
       </div>
     </div>
     <div class="day">Quiet hours per caregiver (already in Household.swift!)</div>
     <div class="card fgrp">
       <div class="frow"><span>Night window</span><b>9:00 PM – 7:00 AM</b></div>
       <div class="frow"><span>Sam (You · Dad)</span><b>Quiet 10:00 PM – 3:00 AM</b></div>
       <div class="frow"><span>Alex (Mom)</span><b>Quiet 3:00 AM – 8:00 AM</b></div>
       <div class="frow"><span>Adaptive interval</span><b class="acc-txt">Auto-adjust from 3d median (2h 45m)</b></div>
     </div>
     <p class="fnote">Note: <code>Caregiver.quietStart/quietEnd</code>, <code>ReminderSettings.snoozeMinutes</code>, and <code>adaptive</code> already exist in <code>Household.swift</code> and <code>ReminderPlanner</code>, but had no UI in <code>SettingsView.swift</code>!</p>`,
    { tab: "settings", fab: false }
  );

  // ══════════════════════════════════════════════════════════════════════════
  // REVIEW CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════════
  window.REVIEW = {
    key: "weehours-roadmap-v1",
    dir: "reports/archive/weehours-roadmap",
    title: "Wee Hours · 5 Features & 10 Improvements",
    subtitle: "5 new features + 10 targeted improvements · grounded in v0.4.5",
    heading: "What should we build next for Wee Hours?",
    intro: `Every candidate below is designed strictly around Wee Hours' product rules in <code>docs/decisions.md</code> (<b>facts not advice</b>, <b>one unified on-device Laya model + deterministic parsers</b>, <b>append-only event log synced via Supabase + MCP</b>, <b>3-second sleepy-thumb UX</b>). Browse the <b>5 Potential Features</b> and <b>10 Potential Improvements</b>, ♥ shortlist the ones you want, ★ rate them, leave notes, and click <b>Copy summary</b> to paste back which ones to build.`,
    legend: [
      "<b>5</b> new features",
      "<b>10</b> UX &amp; pipeline improvements",
      "<b>v0.4.5</b> baseline",
    ],
    round: 2,
    frame: "phone",
    groups: [
      { id: "features", name: "Part 1 · 5 Potential Features", note: "New capabilities that stay factual, local-first, and MCP-ready" },
      { id: "improvements", name: "Part 2 · 10 Potential Improvements", note: "High-leverage polish and unfinished wiring in the existing codebase" },
    ],
    candidates: [
      // ── Baseline
      {
        id: "baseline-v045", n: 0, group: "features", baseline: true,
        name: "Today (v0.4.5)",
        tagline: "Current Now & Timeline screens for reference",
        concept: "Wee Hours v0.4.5 today: one-line StatusCard + DutyRow, Log-for bar when 2+ children are shown, 2-column quick action tiles, floating voice button with WhisperKit + fine-tuned Laya, and chronological Timeline.",
        render: () => baselineNow(),
        views: [
          { name: "Now (1 child)", render: () => baselineNow() },
          { name: "Now (twins)", render: () => baselineMulti() },
          { name: "Timeline", render: () => baselineTimeline() },
        ],
      },

      // ── 5 FEATURES
      {
        id: "feat-handoff-digest", n: 1, group: "features", round: 1,
        name: "Duty Hand-off Digest",
        tagline: "A factual “Since your last shift” card + notification when taking or handing off duty",
        concept: "When a parent taps “I've got it” or “Hand off” at 3 a.m., the incoming parent currently has to scroll the Timeline and do mental math. This adds a purely factual shift brief derived from events since the previous duty event: feed count & ml, diaper breakdown, sleep stretches, any medication given (with time since last dose), and notes left during the shift.",
        moves: [
          "Derived deterministically in Derive.swift & @weehours/core from events between the last two `duty` events",
          "Dismissible “While Alex was on duty” card on Now right after a duty change",
          " highlights any medication given in the last 6h and free-text notes from the shift",
          "Also exposed in MCP `get_status` (`last_shift_summary`) so an assistant can brief you immediately",
        ],
        facts: {
          Category: "Feature · Household & Duty",
          Effort: "S–M",
          Needs: "Shift window helper in Derive.swift + core.ts; no new DB tables or model changes",
        },
        render: () => handoffDigestNow(true),
        views: [
          { name: "Now · Shift digest card", render: () => handoffDigestNow(true) },
          { name: "Lock Screen hand-off", render: () => handoffPushLock() },
        ],
      },
      {
        id: "feat-milk-stash", n: 2, group: "features", round: 2,
        name: "Milk Stash & Bottle Ledger (Optional in Settings)",
        tagline: "Optional Settings toggle to track fridge & freezer pumped milk automatically from pump and bottle events",
        concept: "Parents who pump already log `pump` (with `amount_ml`) and `feed.bottle` with `contents: breast_milk`, but not every pumping household wants stash tracking. This adds an optional `Track milk stash (fridge & freezer)` toggle in Settings → Tracking (off by default). When enabled, `pump` gains an optional `storage: fridge | freezer | fed` field, and `Derive` computes live Fridge & Freezer balances and oldest-first FIFO age without a separate inventory database.",
        moves: [
          "Optional toggle in Settings → Tracking: `Track milk stash (fridge & freezer)` (off by default; zero extra UI when off)",
          "When enabled, optional `storage` field on `pump` (defaults to `fridge`); deterministic parser catches “in the fridge” / “into the freezer”",
          "Logging a `breast_milk` bottle automatically deducts from the oldest fridge milk (FIFO)",
          "Compact Fridge / Freezer card on Now (only when `pumping` + `trackMilkStash` are enabled) and `milk_stash` in MCP `get_status`",
        ],
        facts: {
          Category: "Feature · Feeding & Pumping (Optional)",
          Effort: "M",
          Needs: "`trackMilkStash` in `Household.swift` + optional `storage` field on `pump` + stash derivation in Derive.swift & core.ts",
        },
        render: () => milkStashNow(false),
        views: [
          { name: "Now · Milk stash card", render: () => milkStashNow(false) },
          { name: "Settings toggle (optional)", render: () => milkStashSettings() },
          { name: "Log pump sheet", render: () => milkStashNow(true) },
        ],
      },
      {
        id: "feat-sitter-pass", n: 3, group: "features", round: 1,
        name: "Temporary Caregiver Pass",
        tagline: "Time-boxed QR / web link for a babysitter or grandparent — no app install or account",
        concept: "Full household invites (`weehours://join/<code>`) require installing the app, signing in, and grant permanent full access (including deleting household data). A Caregiver Pass mints a scoped, time-boxed token (4h, 8h, 24h, weekend) that opens a clean mobile web view on the Cloudflare Worker (`/pass/<token>`) where a sitter or grandparent can see today's status, read pinned parent notes, and tap to log feeds/diapers/sleep.",
        moves: [
          "Settings → Household → “Create a caregiver pass” with name, child scope, expiry (4h / 8h / 24h), and optional pinned note",
          "Served by the existing Cloudflare Worker (`services/web/src/worker/`) using the same `access_tokens` table with an `expires_at` column",
          "Entries show in Timeline as `Grandma Joan · web` and can be undone by parents",
          "Zero access to past history, settings, MCP tokens, or destructive RPCs",
        ],
        facts: {
          Category: "Feature · Household & Web",
          Effort: "M",
          Needs: "`expires_at` on `weehours.access_tokens` + `/pass/:code` route in `services/web`",
        },
        render: () => sitterPassSettings(),
        views: [
          { name: "Settings · Create pass QR", render: () => sitterPassSettings() },
          { name: "Sitter's phone browser", render: () => sitterPassWeb() },
        ],
      },
      {
        id: "feat-solids-foods", n: 4, group: "features", round: 1,
        name: "Solids First-Foods & Reactions",
        tagline: "Structured food tags, Top-9 allergen checklist & reaction field on `feed.solids`",
        concept: "Today `feed.solids` only records `amount: taste | some | most | all` — it doesn't even record *what* the baby ate! Adding `foods` (tags) and an optional `reaction` choice (`none | rash | hives | vomiting | diarrhea | gas`) to `feed.solids` lets parents log what was eaten by tap or voice (“ate most of the avocado and egg yolk”) and see a factual checklist of tried foods and Top-9 allergens.",
        moves: [
          "Adds `foods` (comma/array of food names) and `reaction` to `feed.solids` in `spec/event-types.json`",
          "Deterministic food lexicon in `Parsers.swift` extracts common foods & Top-9 allergens from voice transcripts without retraining Laya",
          "Solids sheet shows 1-tap recent food chips + amount + reaction",
          "Factual “Foods tried” summary sheet (count + Top-9 allergen exposure count + any flagged reactions)",
        ],
        facts: {
          Category: "Feature · Solids & Health",
          Effort: "M",
          Needs: "`foods` + `reaction` fields on `feed.solids` in `spec/event-types.json` + deterministic food parser",
        },
        render: () => solidsFirstFoods(false),
        views: [
          { name: "Foods tried & allergens", render: () => solidsFirstFoods(false) },
          { name: "Log Solids sheet", render: () => solidsFirstFoods(true) },
        ],
      },
      {
        id: "feat-doctor-pack", n: 5, group: "features", round: 1,
        name: "Doctor Visit Question Queue & Fact Sheet",
        tagline: "Save questions by voice between checkups + 1-tap factual summary since the last visit",
        concept: "Parents think of pediatrician questions at 2 a.m. and forget them in the exam room. And when the doctor asks “how many wet diapers a day, and how much did she gain?”, parents scramble. This turns the `doctor_visit` tile into a live preparation card: say “ask the pediatrician about vitamin D” to queue a question, view pure factual counts since the last `doctor_visit` event, and log the visit + weight/height/head in one place.",
        moves: [
          "Voice notes starting with “ask the doctor / pediatrician…” (or pinned notes in Timeline) collect in the Doctor Visit queue",
          "Pure factual table computed since the previous `doctor_visit` event: latest weight/height/head + delta, 7-day average feeds/day & wet/dirty diapers/day, and any fever/medication/symptom events",
          "One-tap “Copy facts” (plain text for patient portals or your AI assistant) and checkboxes to mark questions answered during the visit",
          "Respects `docs/decisions.md`: zero medical advice or charts, only raw facts since the last checkup",
        ],
        facts: {
          Category: "Feature · Health & Notes",
          Effort: "S–M",
          Needs: "Pin flag on `note` events + DoctorVisitView sheet in `CareView.swift`",
        },
        render: () => doctorVisitQueue(false),
        views: [
          { name: "Doctor visit sheet", render: () => doctorVisitQueue(false) },
        ],
      },

      // ── 10 IMPROVEMENTS
      {
        id: "imp-med-cooldown", n: 6, group: "improvements", round: 1,
        name: "Medication Last-Dose & 1-Tap Repeat",
        tagline: "Show which medicine was given last, how long ago, 24h dose count, and 1-tap repeat",
        concept: "Right now in `CareView.swift`, the Medication tile only says “2h 10m ago” — it doesn't say *which* medicine (Tylenol vs Vitamin D), the dose, or how many doses were given in the last 24 hours, and tapping it always opens a blank keyboard sheet. Showing the last medicine + dose + 24h count right on the tile (and offering 1-tap repeat chips for recent medicines+doses) prevents accidental double-dosing at 4 a.m.",
        moves: [
          "Medication tile subtitle shows `Infant Tylenol · 1.25 ml · 2h 22m ago` + `3 doses in 24h` badge",
          "Temperature tile shows the latest reading (`37.9 °C · 1h ago`) and delta from previous reading, just like Growth tiles",
          "Tapping Medication shows 1-tap `(Medicine + Dose)` preset pairs from recent history before opening the keyboard",
        ],
        facts: {
          Category: "Improvement · CareView.swift",
          Effort: "S",
          Needs: "UI only in `CareView.swift` (uses existing `medication` & `temperature` fields)",
        },
        render: () => impMedCooldown(),
      },
      {
        id: "imp-backdate-tiles", n: 7, group: "improvements", round: 1,
        name: "Long-Press “Started / Ended Xm Ago” on Tiles",
        tagline: "Hold any Now tile to log it 5, 10, 15, or 30 minutes ago without editing afterwards",
        concept: "When a baby falls asleep or finishes nursing, parents rarely tap the button at the exact second it happens — they put the baby down, tiptoe out, and open the phone 10–15 minutes later. Today, tapping `Fell asleep` or `Woke up` always logs at `Date()`, forcing a trip to Timeline → tap row → DatePicker → Save. Adding a context menu on long-press (or in the Finish menu) with `-5m`, `-10m`, `-15m`, `-30m`, and `Pick time…` makes retrospective tap logging 1 gesture.",
        moves: [
          "`.contextMenu` on every `ActionTile` and `CareTile` in `HomeView.swift` / `CareView.swift`",
          "Quick offsets: Just now, 5 min ago, 10 min ago, 15 min ago, 30 min ago, or custom time sheet",
          "Also added as a section inside the `Finish bottle` and `Timed activity` menus",
        ],
        facts: {
          Category: "Improvement · HomeView.swift",
          Effort: "S",
          Needs: "Pass `occurredAt` into `ActionTile` actions in `HomeView.swift` (`model.log` already takes `at: Date`)",
        },
        render: () => impBackdateMenu(),
      },
      {
        id: "imp-timeline-ribbon", n: 8, group: "improvements", round: 1,
        name: "Timeline Search, Category Chips & 24h Rhythm Strip",
        tagline: "Filter Timeline by category, search transcripts/medicines, and compare today vs yesterday",
        concept: "In `TimelineView.swift` today, the only filter is Child (`All | Mia | Leo`) and `showUndone`. Finding “when did we last give Tylenol?” or “what did that note say?” requires scrolling through hundreds of wet diapers. Adding `.searchable` (matching type labels, `fields` strings, and `rawTranscript`), category filter chips, and a compact 24-hour sleep/feed bar comparing Today vs Yesterday makes the log scannable at a glance.",
        moves: [
          "Category filter pills (`All`, `Feeds`, `Diapers`, `Sleep`, `Health`, `Care`, `Notes`) below the child picker",
          "`.searchable` bar filtering by transcript, medicine/vaccine/doctor text, or category",
          "Compact 24-hour horizontal strip at the top of Today showing sleep blocks and feed ticks vs Yesterday",
        ],
        facts: {
          Category: "Improvement · TimelineView.swift",
          Effort: "S–M",
          Needs: "UI-only in `TimelineView.swift` (all data is already in `model.log.all`)",
        },
        render: () => impTimelineRibbon(),
      },
      {
        id: "imp-complete-editor", n: 9, group: "improvements", round: 1,
        name: "Complete Event Editor & Session Repair",
        tagline: "Edit any event's fields in Timeline (notes, meds, temp, solids) and close/convert open sessions",
        concept: "Look at `EditEventView` in `TimelineView.swift` (lines 134–221): it only lets you edit `consumed_fraction`, `diaper` kind, `side`, and `growth` numbers! If you tap a `note`, `medication`, `symptom`, `temperature`, `feed.solids`, `pump`, or a care/activity event in Timeline, none of its fields are editable. Even worse, if you logged `Start bottle` instead of a finished bottle, you can't change its type or attach a finish time. This upgrades `EditEventView` to render all `EventRegistry.shared.type(event.type)?.fields` plus session repair.",
        moves: [
          "Driven by `spec/event-types.json` field specs so `medication`, `temperature`, `symptom`, `potty`, `tummy_time`, `pump` (`amount_ml`), `feed.solids`, and `note` (`transcript`) are all editable",
          "Allows entering exact `consumed_ml` on bottle events (not just ¼ / ½ / ¾ / All)",
          "Session repair: on an open or abandoned `start` event, offer “+ Add finish time” or “Convert to one-entry bottle”",
        ],
        facts: {
          Category: "Improvement · TimelineView.swift",
          Effort: "S",
          Needs: "Reuse `CareSheet`'s spec-driven field controls inside `EditEventView`",
        },
        render: () => impCompleteEditor("med"),
        views: [
          { name: "Edit Medication / Care", render: () => impCompleteEditor("med") },
          { name: "Edit Bottle + Session repair", render: () => impCompleteEditor("bottle") },
        ],
      },
      {
        id: "imp-paired-sessions", n: 10, group: "improvements", round: 1,
        name: "Paired Session Rows in Timeline",
        tagline: "Group `start` + `switch` + `finish` into one readable session card with total duration",
        concept: "`Derive.swift` already pairs `sleep.start` + `sleep.end`, `feed.bottle.start` + `feed.bottle.finish`, and `feed.breast.start` + `switch` + `finish` into `Session` structs (`model.log.sessions`). Yet `TimelineView.swift` ignores `sessions` and dumps raw individual events (`1:55 AM Finish bottle`, `1:40 AM Start bottle`) as separate rows, forcing parents to subtract timestamps in their head to see how long a nap or nursing session lasted.",
        moves: [
          "Collapses completed sessions (start + switches + finish) into a single Timeline card showing total duration (`Nap · 1h 15m`, `Nursing · 22m · L → R`)",
          "Shows the constituent start/switch/finish steps underneath; tapping any step edits that event",
          "Toggle in the toolbar if you want to inspect raw unpaired events",
        ],
        facts: {
          Category: "Improvement · TimelineView.swift",
          Effort: "S–M",
          Needs: "UI grouping in `TimelineView.swift` using existing `model.log.sessions`",
        },
        render: () => impPairedSessions(),
      },
      {
        id: "imp-compound-voice", n: 11, group: "improvements", round: 2,
        name: "Multi-Event Compound Voice Logging",
        tagline: "Feasibility with current Laya (groups2): requires deterministic clause-splitting + 2× model calls (or save for future ML round)",
        concept: "Can the current shipped Laya model (`Laya-ft-Q8_0.gguf`, revision `groups2`) support compound sentences? In a single pass, **no**: Laya is a non-generative encoder (`ModernBERT-large`) whose `category` question is single-label softmax (`P(group)` sums to 1), and `ml/README.md` explicitly lists “two events in one sentence” as untested. However, we *can* support explicit 2-clause conjunctions (“wet diaper and she fell asleep 10m ago”) on the current model by splitting the transcript deterministically in `Interpreter.swift` when both halves contain keywords from *distinct* categories in `KeywordDecisionModel.categoryWords`, then calling `interpreter.interpret` once per clause (~2 × 350 ms). If you prefer not to double on-device latency or add clause-splitting heuristics, we should save this for the next ML round.",
        moves: [
          "Single-pass `groups2` Laya cannot output 2 event types at once (single-label softmax per question)",
          "Workaround on current model: deterministic clause splitter in `Interpreter.swift` splits on `and then` / `and` / `plus` only when each side hits a different category lexicon (never splitting “wet and dirty” or “Mia and Leo”), then runs `groups2` Laya once per clause",
          "Trade-off: ~700 ms total model time (2 × ~350 ms) and only catches explicit conjunctions — good candidate to save for future if we want native model support",
        ],
        facts: {
          Category: "Improvement · Interpreter.swift (Current Model Check)",
          Effort: "M (or Save for Future)",
          Needs: "Either deterministic 2-clause pre-splitter calling `groups2` Laya twice, or defer to future ML training round",
        },
        render: () => impCompoundVoice("analysis"),
        views: [
          { name: "Current model analysis (groups2)", render: () => impCompoundVoice("analysis") },
          { name: "Toast UI preview", render: () => impCompoundVoice("toast") },
        ],
      },
      {
        id: "imp-live-listening", n: 12, group: "improvements", round: 2,
        name: "Live Transcript Preview & Optional Auto-Stop in ListeningView",
        tagline: "See words as you speak and optionally auto-commit when you stop talking (toggled in Settings → Voice)",
        concept: "In `ListeningView.swift` today, the screen only shows an animated waveform and waits up to 30 seconds until you tap the green checkmark. This adds a live partial transcript + parsed field pills while you speak, plus an **optional** `Auto-log when you stop speaking` toggle in `Settings → Voice` (off by default, right under `Quick capture`). When turned on, 1.8s of silence after speech automatically stops recording and commits. (Switching kids on the fly inside ListeningView is saved for future iterations.)",
        moves: [
          "New optional toggle in `Settings → Voice`: `Auto-log when you stop speaking` (`@AppStorage(\"autoStopVoice\")`, off by default)",
          "When enabled, VAD silence detector in `Recorder` auto-stops after speech followed by 1.8s of silence — no second tap needed",
          "Live partial transcript + parsed field pills (`Finish bottle`, `¾`, `-10m`) in `ListeningView` while speaking (on-the-fly child switching saved for future)",
        ],
        facts: {
          Category: "Improvement · ListeningView.swift & SettingsView.swift",
          Effort: "M",
          Needs: "`@AppStorage(\"autoStopVoice\")` toggle in `SettingsView.swift` + silence detector in `Recorder` + live preview in `ListeningView.swift`",
        },
        render: () => impLiveListening("listen"),
        views: [
          { name: "ListeningView (live preview)", render: () => impLiveListening("listen") },
          { name: "Settings → Voice toggle", render: () => impLiveListening("settings") },
        ],
      },
      {
        id: "imp-twins-toast", n: 13, group: "improvements", round: 1,
        name: "Twins “+ Log for Other Child” & “Swap” Toast Actions",
        tagline: "One tap on the confirmation toast to copy an entry to the other twin or fix wrong-child logs",
        concept: "With twins or siblings (`model.shown.count > 1`), two things happen constantly: (1) you tap Diaper with `Mia` selected in the Log-for bar when you actually meant `Leo`, or (2) you finish Mia's bottle and immediately give Leo his bottle too. Adding `+ Leo` (copies the entry with Leo's bottle size) and `Swap to Leo` (calls `service.edit(id, baby: leo)`) directly on the 10-second confirmation toast saves 4 taps.",
        moves: [
          "When `shown.count == 2` and an entry is logged for one child, `ToastView` shows `+ Log for <Other>` and `Swap to <Other>`",
          "`Swap` uses the existing `LogService.edit(_:fields:occurredAt:baby:)` method to move the event cleanly",
          "`+ <Other>` logs a matching event for the sibling sharing the same `group` id",
        ],
        facts: {
          Category: "Improvement · HomeView.swift (ToastView)",
          Effort: "S",
          Needs: "UI-only in `ToastView` + 2 helper methods on `AppModel`",
        },
        render: () => impTwinsBar(),
      },
      {
        id: "imp-watch-upgrade", n: 14, group: "improvements", round: 1,
        name: "Apple Watch Bottle Amounts, “Both” Target & Pinned Care Tiles",
        tagline: "Pick bottle fraction on the wrist, log for Both twins, and stop Tummy Time from the Watch",
        concept: "In `WatchApp.swift` today, tapping “Finish feed” on a bottle logs `feed.bottle.finish` with *no amount* (`fields: [:]`), the child picker only lets you pick one child at a time (no `Both`), and none of the care/health/timed activities (Tummy time, Medication) are reachable on the wrist. This brings the Watch app up to parity with Now.",
        moves: [
          "Finishing a bottle on Apple Watch pops a 4-button `¼ · ½ · ¾ · All` picker (just like `Diaper` pops `Wet · Dirty · Both · Dry`)",
          "Child picker on Watch includes `Both / All` when `children.count > 1`",
          "Shows any running timed activity (`Stop tummy time · 4m`) plus up to 2 pinned care/health tiles",
        ],
        facts: {
          Category: "Improvement · WatchApp.swift & WatchBridge",
          Effort: "S–M",
          Needs: "Add `fraction` + `both` support to `WatchHome` and `WatchBridge.session(_:didReceiveMessage:)`",
        },
        render: () => impWatchUpgrade(),
      },
      {
        id: "imp-quiet-snooze", n: 15, group: "improvements", round: 1,
        name: "Expose Quiet Hours, Adaptive Reminders & Notification Snooze UI",
        tagline: "Surface the quiet-hours, snooze, and adaptive reminder code that's already in LogCore!",
        concept: "Surprise in the codebase: `Caregiver.quietStart` / `quietEnd`, `ReminderSettings.snoozeMinutes`, `ReminderSettings.adaptive`, and `ReminderPlanner.inQuiet` are already implemented and tested in `Household.swift`! But `SettingsView.swift` never added pickers for them, and `ReminderScheduler` in `Services.swift` registers `reminder` without `UNNotificationCategory` actions for Snooze or Start Feed. Wiring up the UI unlocks night-shift peace immediately.",
        moves: [
          "Add Quiet Hours start/end pickers in `ProfileEditor` (Settings → Household → You) using the existing `Caregiver.quietStart`/`quietEnd` fields",
          "Register `UNNotificationCategory(identifier: \"reminder\")` with `Snooze 15m`, `Snooze 30m`, and `Start feed` actions on the Lock Screen / Apple Watch notification",
          "Add the `Adaptive interval` toggle in Settings → Reminders (`draft.reminders.adaptive` already exists in `Household.swift`)",
        ],
        facts: {
          Category: "Improvement · SettingsView.swift & Services.swift",
          Effort: "S",
          Needs: "UI pickers in `SettingsView.swift` + `UNNotificationCategory` registration in `Services.swift` (0 schema changes!)",
        },
        render: () => impQuietAndSnooze(),
      },
    ],
  };
})();
