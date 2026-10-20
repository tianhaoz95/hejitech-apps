// The apps on the home page: the hero dock (HeroDock.vue), the cards (AppCards.vue) and the search
// index (config.mts adds a search-only section per app, under the card's #<id> anchor).
export interface App {
  id: string;
  name: string;
  tagline: string;
  /** The card's text after the tagline. */
  desc: string;
  /** Under the site base (pages/public/ or a synced project's public/). */
  icon: string;
  /** The card's tags in the "what it does" lens. */
  platforms: string[];
  /** Absent when there's nothing to visit (FeedbackKit is an SDK). */
  appUrl?: string;
  /** Site path, or a full URL for docs built outside this site (FeedbackKit's own VitePress). */
  docs: string;
  /** The "how it's built" lens. */
  backend: string;
  ai: string;
  /** Words people search with that the card doesn't say. */
  synonyms: string[];
}

export const REPO = "https://github.com/tianhaoz95/hejitech-apps";

export const APPS: App[] = [
  {
    id: "waypack",
    name: "Waypack",
    tagline: "Your trip, packed.",
    desc: "Your AI assistant plans it; Waypack turns the plan into a self-contained bundle with offline vector maps that works with no signal at all.",
    icon: "/waypack/favicon.svg",
    platforms: ["iPhone", "Android", "Mac", "MCP"],
    appUrl: "https://waypack.hejitech.workers.dev",
    docs: "/waypack/",
    backend: "Shared Supabase, waypack schema",
    ai: "Your assistant plans over MCP",
    synonyms: ["travel", "trip planner", "itinerary", "offline maps", "no signal", "packing"],
  },
  {
    id: "weehours",
    name: "Wee Hours",
    tagline: "A newborn log built for 3am.",
    desc: "Log a feed, diaper or nap in three seconds by voice, a tap, your watch or your glasses; the voice model runs on the phone.",
    icon: "/weehours/icon.png",
    platforms: ["iPhone", "Apple Watch", "Even G2 glasses", "MCP"],
    appUrl: "https://weehours.hejitech.workers.dev",
    docs: "/weehours/",
    backend: "Shared Supabase, weehours schema",
    ai: "Voice model on the phone",
    synonyms: ["baby log", "baby tracker", "newborn", "feeding", "diapers", "sleep", "nap", "parents"],
  },
  {
    id: "voxbrief",
    name: "Voxbrief",
    tagline: "Speak an idea, get a clean note.",
    desc: "One tap on Apple Watch records it; the iPhone or Mac turns it into structured Markdown with Whisper and Qwen3 running on the device. No account, no server.",
    icon: "/voxbrief/icon.png",
    platforms: ["iPhone", "Apple Watch", "Mac", "On-device AI"],
    appUrl: "https://tianhaoz95.github.io/hejitech-apps/voxbrief/site/",
    docs: "/voxbrief/",
    backend: "None: no account, no server",
    ai: "Whisper + Qwen3 on the device",
    synonyms: ["voice memo", "voice notes", "dictation", "transcription", "markdown notes"],
  },
  {
    id: "meowtrix",
    name: "Meowtrix",
    tagline: "A remote workspace for vibe engineering.",
    desc: "Split panes of real terminals, browsers and a code editor, served from your own machine and reachable from any device. Shells survive refreshes and device switches.",
    icon: "/meowtrix/icon.png",
    platforms: ["Web", "macOS app", "Linux", "Agent tools · MCP"],
    appUrl: "https://tianhaoz95.github.io/hejitech-apps/meowtrix/site/",
    docs: "/meowtrix/",
    backend: "None: runs on your own machine",
    ai: "Agent tools · MCP",
    synonyms: ["terminal", "remote shell", "code editor", "coding agents", "tmux"],
  },
  {
    id: "contempo",
    name: "Contempo",
    tagline: "Hours that survive an audit.",
    desc: "Short-term-rental hosts log work by voice on the phone or watch; Contempo turns it into contemporaneous, risk-checked records for the IRS material-participation tests.",
    icon: "/contempo/icon.png",
    platforms: ["Android · Wear OS", "iPhone · Apple Watch", "Web", "On-device AI"],
    appUrl: "https://contempo.hejitech.workers.dev",
    docs: "/contempo/",
    backend: "Shared Supabase, contempo schema",
    ai: "Voice understood on the device",
    synonyms: ["short-term rental", "airbnb host", "time tracking", "irs", "material participation", "tax"],
  },
  {
    id: "toddlercam",
    name: "ToddlerCam",
    tagline: "A dual camera made for little hands.",
    desc: "Front and rear cameras at once, a big bouncy shutter, face-tracking masks and a toddler lock, with the parent's Apple Watch as the remote. Nothing leaves the device.",
    icon: "/toddlercam/icon.png",
    platforms: ["iPhone · iPad", "Apple Watch", "Kids Category"],
    appUrl: "https://tianhaoz95.github.io/hejitech-apps/toddlercam/site/",
    docs: "/toddlercam/",
    backend: "None: nothing leaves the device",
    ai: "Face tracking on the device",
    synonyms: ["kids camera", "toddler", "photos", "children", "watch remote"],
  },
  {
    id: "tinytouch",
    name: "TinyTouch",
    tagline: "Calm play for Apple Watch.",
    desc: "Hand your Apple Watch to a toddler without 911 calls or swiped-away apps. Every touch becomes calm, pentatonic play, exits sit behind a 3-second parent hold, and the iPhone is the remote.",
    icon: "/tinytouch/icon.png",
    platforms: ["Apple Watch", "iPhone", "Kids Category"],
    appUrl: "https://tianhaoz95.github.io/hejitech-apps/tinytouch/site/",
    docs: "/tinytouch/",
    backend: "None",
    ai: "None: pure play",
    synonyms: ["toddler", "kids game", "watch lock", "baby", "music"],
  },
  {
    id: "feedbackkit",
    name: "FeedbackKit",
    tagline: "In-app feedback that closes the loop.",
    desc: "Users report with a screenshot, a coding agent fixes it, and the reporter is asked \"is it fixed?\" in the next build. The tool every HEJI app ships with.",
    icon: "/feedbackkit-logo.png",
    platforms: ["iOS · macOS · watchOS", "Android", "Web", "Flutter · RN · desktop", "MCP"],
    docs: "https://tianhaoz95.github.io/hejitech-apps/feedbackkit/",
    backend: "Its own Supabase project",
    ai: "Coding agents fix reports",
    synonyms: ["bug report", "user feedback", "screenshot", "sdk", "issue tracker"],
  },
];
