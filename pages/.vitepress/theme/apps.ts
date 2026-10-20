// The apps on the home page, for the hero dock (HeroDock.vue) and the search index (config.mts adds
// each app's synonyms to the home page's search entry). The cards themselves stay in index.md; each
// card's id is the app's id, so #<id> jumps to it.
export interface App {
  id: string;
  name: string;
  tagline: string;
  /** Under the site base (pages/public/ or a synced project's public/). */
  icon: string;
  platforms: string[];
  /** The "how it's built" lens. */
  backend: string;
  ai: string;
  code: string;
  /** Words people search with that the card doesn't say. */
  synonyms: string[];
}

export const APPS: App[] = [
  {
    id: "waypack",
    name: "Waypack",
    tagline: "Your trip, packed.",
    icon: "/waypack/favicon.svg",
    platforms: ["iPhone", "Android", "Mac", "MCP"],
    backend: "Shared Supabase, waypack schema",
    ai: "Your assistant plans over MCP",
    code: "projects/waypack",
    synonyms: ["travel", "trip planner", "itinerary", "offline maps", "no signal", "packing"],
  },
  {
    id: "weehours",
    name: "Wee Hours",
    tagline: "A newborn log built for 3am.",
    icon: "/weehours/icon.png",
    platforms: ["iPhone", "Apple Watch", "Even G2 glasses", "MCP"],
    backend: "Shared Supabase, weehours schema",
    ai: "Voice model on the phone",
    code: "projects/weehours",
    synonyms: ["baby log", "baby tracker", "newborn", "feeding", "diapers", "sleep", "nap", "parents"],
  },
  {
    id: "voxbrief",
    name: "Voxbrief",
    tagline: "Speak an idea, get a clean note.",
    icon: "/voxbrief/icon.png",
    platforms: ["iPhone", "Apple Watch", "Mac"],
    backend: "None: no account, no server",
    ai: "Whisper + Qwen3 on the device",
    code: "projects/voxbrief",
    synonyms: ["voice memo", "voice notes", "dictation", "transcription", "markdown notes"],
  },
  {
    id: "meowtrix",
    name: "Meowtrix",
    tagline: "A remote workspace for vibe engineering.",
    icon: "/meowtrix/icon.png",
    platforms: ["Web", "macOS app", "Linux"],
    backend: "None: runs on your own machine",
    ai: "Agent tools · MCP",
    code: "projects/meowtrix",
    synonyms: ["terminal", "remote shell", "code editor", "coding agents", "tmux"],
  },
  {
    id: "contempo",
    name: "Contempo",
    tagline: "Hours that survive an audit.",
    icon: "/contempo/icon.png",
    platforms: ["Android · Wear OS", "iPhone · Apple Watch", "Web"],
    backend: "Shared Supabase, contempo schema",
    ai: "Voice understood on the device",
    code: "projects/contempo",
    synonyms: ["short-term rental", "airbnb host", "time tracking", "irs", "material participation", "tax"],
  },
  {
    id: "toddlercam",
    name: "ToddlerCam",
    tagline: "A dual camera made for little hands.",
    icon: "/toddlercam/icon.png",
    platforms: ["iPhone · iPad", "Apple Watch"],
    backend: "None: nothing leaves the device",
    ai: "Face tracking on the device",
    code: "projects/toddlercam",
    synonyms: ["kids camera", "toddler", "photos", "children", "watch remote"],
  },
  {
    id: "tinytouch",
    name: "TinyTouch",
    tagline: "Calm play for Apple Watch.",
    icon: "/tinytouch/icon.png",
    platforms: ["Apple Watch", "iPhone"],
    backend: "None",
    ai: "None",
    code: "projects/tinytouch",
    synonyms: ["toddler", "kids game", "watch lock", "baby", "music"],
  },
  {
    id: "feedbackkit",
    name: "FeedbackKit",
    tagline: "In-app feedback that closes the loop.",
    icon: "/feedbackkit-logo.png",
    platforms: ["iOS · macOS · watchOS", "Android", "Web", "Flutter · RN"],
    backend: "Its own Supabase project",
    ai: "Coding agents fix reports",
    code: "projects/feedbackkit",
    synonyms: ["bug report", "user feedback", "screenshot", "sdk", "issue tracker"],
  },
];
