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

## Play Console declarations (filled 2026-11-12, except where marked "owner")

- Privacy policy, ads (none), government / financial / health (none): done.
- Data safety (saved, submits once the target audience is set): encrypted in transit; accounts by OAuth;
  deletion URL https://headway.hejitech.workers.dev/privacy/ ("Deleting it": everything Headway keeps is
  removed; the shared HEJI sign-in record itself is not). Collected, none shared:
  - Precise location: ephemeral, optional, app functionality (ride detection, trip estimate).
  - Name (family group name): stored, optional, app functionality.
  - Email address, User IDs: stored, required, app functionality + account management.
  - Other user-generated content (commute, tracked train, family shares/status): stored, required, app functionality.
  - Device or other IDs (FCM push token): stored, optional, app functionality.
- **Sign in details (owner):** "Yes, restricted". The review account from `scripts/review_account.sh headway`
  (appreview+headway@hejitech.com, password in `~/Credentials/review-accounts.env`). Instructions: "On the
  sign-in screen tap 'Sign in with email' and enter these credentials. The account has a saved commute and
  a family group."
- **Content rating (owner):** IARC terms + questionnaire: Travel/transit utility, no violence, sexual
  content, language, controlled substances, gambling; users interact (family groups among invited
  people, no open chat); shares location only with Headway's server, never with other users.
- **Target audience (owner):** 18 and over (commuters); not designed for children.
- **Location permissions (owner, after Sign in details):** background location is used for "On a train →
  Also with the app closed": Headway notices when you board a Caltrain train and starts tracking it so
  delay and arrival alerts follow your ride, with a "Watching for your train" notification showing.
  Video: `background-location-demo.mp4` (upload to YouTube as unlisted; the form wants a link). It shows
  the in-app disclosure, both Android prompts and the ongoing notification.
- **Foreground service permissions (owner):** type `location`, "user-initiated location sharing /
  navigation-like": watches for the user's ride while the app is closed, only after they choose "Also
  with the app closed"; stops when they pick another option. Same video.
- **Trader status (owner):** confirm "Yes, my trader status applies".
