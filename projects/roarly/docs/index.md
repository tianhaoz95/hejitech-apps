---
layout: home
hero:
  name: "Roarly"
  text: "Stories that roar back."
  tagline: "Tell any story out loud and Roarly adds the sounds: the lion roars when it jumps out, the rain begins when it starts to pour, and a tiger running away stays quiet. Everything runs on your iPhone."
  image:
    src: /roarly/icon.png
    alt: Roarly
  actions:
    - theme: brand
      text: Privacy
      link: /privacy
    - theme: alt
      text: Support
      link: /support
    - theme: alt
      text: Decisions
      link: /decisions

features:
  - title: Follows the story
    details: Context rules read each sentence ("a tiger is chasing you" plays, "the tiger ran away" doesn't), and Apple's on-device model settles the unsure ones where the iPhone has Apple Intelligence.
  - title: You stay in charge
    details: When Roarly isn't sure, the sound waits as a big card to tap, on the iPhone or your Apple Watch. Bedtime mode keeps big sounds soft and fades everything out at "good night".
  - title: Nothing leaves the phone
    details: No account, no backend, no recordings. Speech is turned into text on the device and forgotten when the story ends.
---

## How it works

```
microphone ─▶ SpeechAnalyzer (on device, partial + final text)
                   │
                   ▼
            StoryEngine (RoarlyKit) ── context rules ──▶ play / start a loop / stop a loop
                   │                                     suggest (tap to play)
                   └── unsure, finished sentence ──▶ Apple's on-device model (yes/no, ~0.25 s)
                   │
                   ▼
            AudioHub: one AVAudioEngine for mic + sounds (echo cancellation), or the watch speaker
```

- **iPhone app** (iOS 26+): the listener, the sound library (141 sounds, 12 free), Bedtime/Playtime,
  how-automatic setting, your own trigger words, Roarly Pro (yearly with a free week, or lifetime).
- **Apple Watch app**: start/stop, the suggestions as big buttons, the loops, replay, and sounds on the
  watch speaker when you pick it.

Source: [`projects/roarly`](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/roarly).
