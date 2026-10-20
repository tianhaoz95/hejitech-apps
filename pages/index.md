---
layout: home
hero:
  name: "HEJI Apps"
  text: "Small apps, carefully made"
  tagline: "Each one does one job well, works when the network doesn't, and lets your own AI assistant in through an open door: MCP."
  image:
    src: /heji.svg
    alt: HEJI
---

<script setup>
import AppCards from "./.vitepress/theme/AppCards.vue";
</script>

<div class="heji-bg" aria-hidden="true"><span></span><span></span><span></span></div>

<div class="heji-section" id="apps">

## The apps

<AppCards />

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
