// The packed plugin (.ehpk): @g2digest/plugin talking to the hosted web app. No secrets here, ever
// (PRD §3): the only credential is the device token the user pairs into the bridge's storage.
// `?api=http://<lan-ip>:8790` points a dev build at a local Worker.
import { bootPlugin } from "@g2digest/plugin";
import "./style.css";

const PRODUCTION = "https://g2digest.hejitech.workers.dev";
const apiBase = new URLSearchParams(location.search).get("api") ?? (import.meta.env.VITE_API_BASE || PRODUCTION);
void bootPlugin({ apiBase, root: document.getElementById("app")! });
