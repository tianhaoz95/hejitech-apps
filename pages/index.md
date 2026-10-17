---
layout: home
hero:
  name: "HEJI Apps"
  text: "Small apps, carefully made"
  tagline: "Each one does one job well, works when the network doesn't, and lets your own AI assistant in through an open door: MCP."
  image:
    src: /heji.svg
    alt: HEJI
  actions:
    - theme: brand
      text: See the apps
      link: "#apps"
    - theme: alt
      text: How they're built
      link: /monorepo
---

<div class="heji-section" id="apps">

## The apps

<div class="heji-apps">

<div class="heji-app">
  <img src="/waypack/favicon.svg" alt="" width="64" height="64">
  <div class="heji-app-body">
    <h3><a class="no-icon" href="./waypack/">Waypack</a></h3>
    <p>Your trip, packed. Your AI assistant plans it; Waypack turns the plan into a self-contained bundle with offline vector maps that works with no signal at all.</p>
    <span class="heji-tags"><span>iPhone</span><span>Android</span><span>Mac</span><span>MCP</span></span>
    <span class="heji-links"><a class="heji-btn brand no-icon" href="https://waypack.hejitech.workers.dev">Visit app</a><a class="heji-btn no-icon" href="./waypack/">Docs →</a></span>
  </div>
</div>

<div class="heji-app">
  <img src="/weehours/icon.png" alt="" width="64" height="64">
  <div class="heji-app-body">
    <h3><a class="no-icon" href="./weehours/">Wee Hours</a></h3>
    <p>A newborn log built for 3am. Log a feed, diaper or nap in three seconds by voice, a tap, your watch or your glasses; the voice model runs on the phone.</p>
    <span class="heji-tags"><span>iPhone</span><span>Apple Watch</span><span>Even G2 glasses</span><span>MCP</span></span>
    <span class="heji-links"><a class="heji-btn brand no-icon" href="https://weehours.hejitech.workers.dev">Visit app</a><a class="heji-btn no-icon" href="./weehours/">Docs →</a></span>
  </div>
</div>

<div class="heji-app">
  <img src="/voxbrief/icon.png" alt="" width="64" height="64">
  <div class="heji-app-body">
    <h3><a class="no-icon" href="./voxbrief/">Voxbrief</a></h3>
    <p>Speak an idea, get a clean note. One tap on Apple Watch records it; the iPhone or Mac turns it into structured Markdown with Whisper and Qwen3 running on the device. No account, no server.</p>
    <span class="heji-tags"><span>iPhone</span><span>Apple Watch</span><span>Mac</span><span>On-device AI</span></span>
    <span class="heji-links"><a class="heji-btn brand no-icon" href="https://tianhaoz95.github.io/hejitech-apps/voxbrief/site/" target="_self">Visit app</a><a class="heji-btn no-icon" href="./voxbrief/">Docs →</a></span>
  </div>
</div>

<div class="heji-app">
  <img src="/meowtrix/icon.png" alt="" width="64" height="64">
  <div class="heji-app-body">
    <h3><a class="no-icon" href="./meowtrix/">Meowtrix</a></h3>
    <p>A remote workspace for vibe engineering: split panes of real terminals, browsers and a code editor, served from your own machine and reachable from any device. Shells survive refreshes and device switches.</p>
    <span class="heji-tags"><span>Web</span><span>macOS app</span><span>Linux</span><span>Agent tools · MCP</span></span>
    <span class="heji-links"><a class="heji-btn brand no-icon" href="https://tianhaoz95.github.io/hejitech-apps/meowtrix/site/" target="_self">Visit app</a><a class="heji-btn no-icon" href="./meowtrix/">Docs →</a></span>
  </div>
</div>

<div class="heji-app">
  <img src="/contempo/icon.png" alt="" width="64" height="64">
  <div class="heji-app-body">
    <h3><a class="no-icon" href="./contempo/">Contempo</a></h3>
    <p>Hours that survive an audit. Short-term-rental hosts log work by voice on the phone or watch; Contempo turns it into contemporaneous, risk-checked records for the IRS material-participation tests.</p>
    <span class="heji-tags"><span>Android · Wear OS</span><span>iPhone · Apple Watch</span><span>Web</span><span>On-device AI</span></span>
    <span class="heji-links"><a class="heji-btn brand no-icon" href="https://contempo.hejitech.workers.dev">Visit app</a><a class="heji-btn no-icon" href="./contempo/">Docs →</a></span>
  </div>
</div>

<div class="heji-app">
  <img src="/feedbackkit-logo.png" alt="" width="64" height="64">
  <div class="heji-app-body">
    <h3><a class="no-icon" href="https://tianhaoz95.github.io/hejitech-apps/feedbackkit/" target="_self">FeedbackKit</a></h3>
    <p>In-app feedback that closes the loop: users report with a screenshot, a coding agent fixes it, and the reporter is asked "is it fixed?" in the next build. The tool every HEJI app ships with.</p>
    <span class="heji-tags"><span>iOS · macOS · watchOS</span><span>Android</span><span>Web</span><span>Flutter · RN · desktop</span><span>MCP</span></span>
    <span class="heji-links"><a class="heji-btn no-icon" href="https://tianhaoz95.github.io/hejitech-apps/feedbackkit/" target="_self">Docs →</a></span>
  </div>
</div>

</div>

</div>

<div class="heji-section">

## How we build

<div class="heji-principles">
<div>
  <h3>Works offline first</h3>
  <p>Trips open without signal; the baby log lives on the phone and syncs when it can. The network is a bonus, not a dependency.</p>
</div>
<div>
  <h3>Your assistant, invited</h3>
  <p>Every app speaks MCP with proper OAuth, so the assistant you already use can read and act on your data, with your permission.</p>
</div>
<div>
  <h3>Private by design</h3>
  <p>Voice is understood on the device. Each app keeps its own data, even where they share an account.</p>
</div>
<div>
  <h3>Built to stand alone</h3>
  <p>The apps share one repository and one backend while they're small, with rules that let any of them move to its own the day it needs to.</p>
</div>
</div>

</div>
