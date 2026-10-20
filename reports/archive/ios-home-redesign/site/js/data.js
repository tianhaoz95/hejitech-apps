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
