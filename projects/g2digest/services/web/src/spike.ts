// The audio-on-lock spike page (PRD §7.3): `evenhub qr --url https://g2digest.hejitech.workers.dev/spike/`.
import { bootSpike } from "@g2digest/plugin";

void bootSpike(document.getElementById("app")!, "/fixture/2026-10-22/proteina-binders-deep-dive.mp3");
