---
layout: home
hero:
  name: "G2 Digest"
  text: "Your brief, ready before the train"
  tagline: "An agent compiles your brief ahead of time into glanceable cards for Even G2 glasses and audio for your headphones. Swipe to skip, hold the ring to hear the deep dive. Nothing loads or generates while you ride."
  image:
    src: /g2digest/icon.png
    alt: G2 Digest
  actions:
    - theme: brand
      text: Open G2 Digest
      link: https://g2digest.hejitech.workers.dev
    - theme: alt
      text: Decisions
      link: /decisions
    - theme: alt
      text: Deployment
      link: /DEPLOY

features:
  - title: Compiled, not live
    details: Research, writing, audio and validation happen when the edition is built. On the train the plugin only plays a self-contained bundle, offline if it has to.
  - title: Audio first
    details: A card is one screen and a two-second decision. Depth is a three-to-five-minute deep dive in your headphones, never more text on the glasses.
  - title: Your brief, any agent
    details: You edit the brief in the web app. Any agent that speaks MCP and can make audio builds the edition, against a card guide it fetches live and a validator that blocks bad cards.
---

## See it in 30 seconds

<div class="promo-video">
  <iframe src="https://www.youtube-nocookie.com/embed/gcS32dRwPMo?rel=0" title="G2 Digest: your brief, ready before the train, on Even G2 glasses (30 s)" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>

Underground, nothing loads. His brief was ready last night: his own AI agent turned it into cards
for his Even G2 glasses, he swipes the R1 ring to skim and holds it for the deep dive in his
headphones. Briefs in the video are demo data; people and scenes are AI-generated. [Watch on YouTube](https://youtu.be/gcS32dRwPMo).

## How it fits together

- **Web app** (Cloudflare Worker): Google sign-in, pairing codes, the brief editor, the full edition
  with sources, and a G2 preview driven by the same render function and gesture state machine as
  the plugin.
- **Glasses plugin** (Even Hub): pairs once with a 6-digit code, fetches each edition with a
  read-only device token, keeps it for offline, and maps R1 gestures to the cards and audio.
- **Build agent** (MCP): `get_card_authoring_guide`, `get_user_brief`, `create_audio_upload`,
  `validate_cards`, `publish_cards`, `get_last_cards`.
