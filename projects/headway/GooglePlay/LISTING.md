# Headway on Google Play

Play app "Headway: Caltrain Alerts", package `com.hejitech.headway`, app ID `4975322077562037950`
(HEJI TECH LLC console). Phone + Wear OS in one listing. Phone and tablet screenshots come from the
emulator on the local stack (seed rider, demo clock 7:40 am); Wear OS screenshots are the watch app
on live production data. Text adapted from the App Store listing, without what Android lacks (Live
Activities, Lock Screen pins, widgets, Sign in with Apple).

- **Category:** Maps & Navigation · **Contact:** info@hejitech.com · **Website:** https://headway.hejitech.workers.dev/
- **Privacy policy:** https://headway.hejitech.workers.dev/privacy/

## Title (30)

Headway: Caltrain Alerts

## Short description (80)

Live Caltrain departures, delay alerts and leave-by times on phone and watch.

## Full description (4000)

Headway puts your next Caltrain where you'll see it: on your Android phone, your Wear OS watch and Even Realities G2 glasses.

YOUR COMMUTE, ALREADY OPEN
• Save a morning and an evening pair of stations. Headway opens on the right one for the time of day
• Live departures with delays, express and local trains, and how many minutes you have before you need to leave
• Leave-by times from the walk or drive you set, or estimated from where you are (optional)

ALERTS THAT MATTER
• Your train is running late past your threshold, or is cancelled
• Caltrain service alerts for your stations
• A leave-now reminder for your usual train
• A heads-up a few minutes before your stop
• When a later express gets you there sooner

ON THE TRAIN
• Track the train you're on: next stop, arrival time and stops to go
• Share a live ETA link with anyone. It stops when you arrive

ON YOUR WRIST
• A Wear OS app with the next trains for your commute, one tap to flip direction
• A tile and a watch face complication that count down to your next train

FAMILY
• Make a family group of up to 8 and follow each other's trains
• Hear when someone's usual train is late or cancelled, or see a status like Running late
• Nothing is shared until you turn it on and pick who sees it. Your location is never shared

HEADS-UP ON EVEN G2
Pair Even Realities G2 glasses with a 6-digit code and swipe through the next trains with the R1 ring. Glasses are optional.

ASK YOUR ASSISTANT
Connect Claude or another AI assistant over MCP and ask "when's my next train?"

PRIVATE BY DESIGN
No ads, no analytics, no tracking. Location is optional, used for one estimate at a time and never stored.

Caltrain times come from Caltrain's published timetable and 511.org live data. Headway is not affiliated with Caltrain.

## Play Console declarations (state on 2026-11-12)

Done and saved: privacy policy, ads (none), government / financial / health (none), advertising ID
(not used: the merged manifest has no AD_ID permission), trader status (yes, terms URL
https://headway.hejitech.workers.dev/terms/), target audience 18 and over, sign-in details (without
the password; sharing them with Google's device-testing partners switched off).

- **Data safety (saved):** encrypted in transit; accounts by OAuth; deletion URL
  https://headway.hejitech.workers.dev/privacy/. Collected, none shared: precise location (ephemeral,
  optional, app functionality); name (stored, optional, app functionality); email address and user IDs
  (stored, required, app functionality + account management); other user-generated content (stored,
  required, app functionality); device or other IDs, the FCM token (stored, optional, app functionality).
- **Content rating (saved):** All Other App Types; users interact (family groups, invited only, the
  owner can remove people; no reporting or chat moderation); no location shared with other users; no
  purchases, rewards, browser or news. ESRB Everyone, ClassInd All ages, "Users Interact".
- **Production:** United States only (Wear OS inherits it); drafts for phone 3611065 and watch 3611066
  (1.4.3) with release notes.

Still the owner's:

1. **Sign-in password:** App content › Sign in details › edit "Review account" (appreview+headway@hejitech.com),
   add `HEADWAY_REVIEW_PASSWORD` from `~/Credentials/review-accounts.env`, save.
2. **AI asset declaration:** Store listings › Default › Next › "Don't label assets" › Save (no Headway
   asset is AI-made). Until then the listing is a draft and the release preview says "Add a full description".
3. **Video:** upload `background-location-demo.mp4` (in-app disclosure, both Android prompts, the ongoing
   notification) to the HEJI TECH channel as unlisted, then paste the link into:
   - **Location permissions.** App purpose: "Headway shows live Caltrain departures, delays and leave-by
     times for a rider's commute and alerts them when their train is late, cancelled or about to arrive
     at their stop. It also tracks the train the rider is on so delay and arrival alerts follow the
     ride." Location access: "On-train detection (Settings > On a train > 'Also with the app closed').
     When the rider turns it on, Headway notices when they board a Caltrain train, even with the app
     closed, and starts tracking that train so delay and arrival alerts follow the ride. A 'Watching
     for your train' notification shows while it runs. An in-app disclosure explains this before
     Android's location prompts; the rider can switch it off at any time. Location is only used to match
     the train and is not stored."
   - **Foreground service permissions:** FOREGROUND_SERVICE_LOCATION › Background location updates ›
     Other, same link.
4. Publishing overview: send the production releases for review.
