// Sample home-screen data. Every field maps to something the app already has:
// RemoteTrip/LocalTrip (title, dates, size, status, role/ownerEmail, receivedNearby, accent),
// AppState (bookmarks, download progress, lastSynced) and the bundle manifest
// (travelers.{adults,children[].age,pets}, theme.scene).
window.WP = window.WP || {};

WP.today = new Date(2026, 9, 8); // Thu Oct 8, 2026

WP.trips = [
  {
    id: "kyoto", title: "Kyoto fall break", start: "2026-10-20", end: "2026-10-27",
    status: "ready", bytes: 182e6, bookmarked: true, accent: "#C2562D",
    travelers: { adults: 2, kids: [9, 6], pets: 0 },
    scene: { sky: ["#F7C59F", "#FBE3C8"], sun: "low-sun", mountains: "rolling", trees: "autumn", ground: "grass", water: "none" },
    next: "Day 1 · Fushimi Inari at 8:30",
  },
  {
    id: "lisbon", title: "Grandma's 80th in Lisbon", start: "2026-12-18", end: "2026-12-28",
    status: "update", bytes: 96e6, accent: "#2F7F9E", sharedBy: "aunt.may@example.com",
    travelers: { adults: 4, kids: [9, 6], pets: 0 },
    scene: { sky: ["#9ED0E6", "#FCE6C9"], sun: "sun", mountains: "none", water: "ocean", ground: "city", skyline: true },
  },
  {
    id: "tahoe", title: "Tahoe ski weekend", start: "2027-02-12", end: "2027-02-15",
    status: "downloading", progress: 0.64, stage: "Offline map", bytes: 240e6, accent: "#3F6EA8",
    travelers: { adults: 2, kids: [9, 6], pets: 1 },
    scene: { sky: ["#B9D3EE", "#EEF4FA"], sun: "sun", mountains: "snowy-peaks", trees: "snowy-pine", ground: "snow", water: "frozen-lake" },
  },
  {
    id: "obx", title: "Outer Banks beach week", start: "2027-07-10", end: "2027-07-17",
    status: "cloud", bytes: 154e6, accent: "#D99A2B",
    travelers: { adults: 2, kids: [10, 7], pets: 1 },
    scene: { sky: ["#FFD08A", "#FFF1D6"], sun: "sun", mountains: "none", water: "ocean", trees: "palm", ground: "sand" },
  },
  {
    id: "maui", title: "Maui spring break", start: "2026-03-28", end: "2026-04-05", past: true,
    status: "ready", bytes: 210e6, accent: "#E0703A",
    travelers: { adults: 2, kids: [8, 5], pets: 0 },
    scene: { sky: ["#F49B6C", "#FFD7A8"], sun: "low-sun", mountains: "rolling", water: "ocean", trees: "palm", ground: "sand" },
  },
  {
    id: "disney", title: "Disneyland with the cousins", start: "2025-12-20", end: "2025-12-23", past: true,
    status: "ready", bytes: 64e6, accent: "#8A5BB8", nearby: true,
    travelers: { adults: 4, kids: [8, 7, 5, 3], pets: 0 },
    scene: { sky: ["#C9B6E8", "#FBE1E6"], sun: "moon", mountains: "none", ground: "city", skyline: true, water: "none" },
  },
  {
    id: "smokies", title: "Smokies camping", start: "2025-07-04", end: "2025-07-08", past: true,
    status: "ready", bytes: 128e6, accent: "#4E7D4F",
    travelers: { adults: 2, kids: [7, 4], pets: 1 },
    scene: { sky: ["#BFD9C2", "#F4EBD3"], sun: "sun", mountains: "peaks", trees: "pine", ground: "grass", water: "river" },
  },
];

WP.upcoming = WP.trips.filter((t) => !t.past);
WP.past = WP.trips.filter((t) => t.past);
WP.family = "Parker";
WP.syncedAgo = "2 min ago";

// ── Extra sample data for the inner screens. Mirrors manifest.json (days[].items, places,
// emergency_numbers), the assistant transcript and Settings (plan, tokens, storage).
WP.kyoto = WP.trips[0];
WP.dayPlan = {
  n: 3, title: "Arashiyama & the monkeys", date: "2026-10-22", shownAt: "11:20",
  items: [
    { time: "8:00", title: "Breakfast at the ryokan", done: true },
    { time: "9:15", title: "Bamboo grove walk", place: "Arashiyama Bamboo Grove", done: true, notes: "Go early, it's quiet before 10. Stroller-friendly path on the left." },
    { time: "11:00", end: "12:30", title: "Iwatayama Monkey Park", place: "Iwatayama Monkey Park", now: true, notes: "20-min uphill walk, bring water. Kids love the feeding hut at the top." },
    { time: "13:00", title: "Lunch: Yoshimura soba", place: "Arashiyama Yoshimura", notes: "Window seats look over the river. Kids' tempura set." },
    { time: "15:00", title: "Togetsukyo Bridge & rowboats", place: "Togetsukyo Bridge" },
    { time: "18:30", title: "Dinner back in Gion", place: "Gion Kappa" },
  ],
};
WP.lodging = { name: "Ryokan Yachiyo", address: "34 Nanzenji Fukuchicho, Sakyo-ku", notes: "Check-in 3 pm · onsen bath 6–11 pm" };
WP.emergency = [["Police", "110"], ["Fire & ambulance", "119"], ["US Embassy Tokyo", "+81 3-3224-5000"]];
WP.chat = [
  { q: "Where can we eat nearby?", a: "Arashiyama Yoshimura (soba) is a 6-minute walk from the Monkey Park, and it's on your plan for 1:00 pm. For something quicker, % Arabica by the bridge has pastries and hot chocolate for the kids." },
  { q: "What's plan B if the weather turns?", a: "Your plan lists the Kyoto Railway Museum as the rainy-day swap for Day 3. It's indoors, 25 minutes by JR from Saga-Arashiyama, and kids under 3 are free." },
];
WP.suggestions = ["What's next?", "Where can we eat nearby?", "Plan B if it rains?", "What should we pack today?", "Nearest hospital"];
WP.me = { email: "parent@example.com", plan: "Waypack Pro · Annual", planSub: "Offline maps · up to 10 active trips", storage: "1.1 GB" };
WP.tokens = [{ prefix: "wp_7f3a", label: "Created in app", used: "2 days ago" }];
WP.mcp = "https://waypack.app/mcp";
