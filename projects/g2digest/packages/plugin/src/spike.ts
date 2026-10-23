// The audio-on-lock spike (PRD §7.3, build order step 1). Load it on the glasses with
//   evenhub qr --url https://g2digest.hejitech.workers.dev/spike/
// press Start, lock the phone, listen, and use the R1 (tap = play/pause) with the phone locked.
// Unlock and the page reports whether audio kept going (how far playback advanced while the page
// was hidden) and which ring events arrived while locked. Results persist in local storage, so a
// WebView that was killed still shows the last run when reopened.
import { CreateStartUpPageContainer, OsEventTypeList, TextContainerProperty, waitForEvenAppBridge, type EvenAppBridge, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { BRIDGE_TIMEOUT_MS } from "./plugin.ts";

interface Run {
  started: string;
  hiddenAt?: number;
  hiddenAudioPos?: number;
  shownAt?: number;
  shownAudioPos?: number;
  eventsWhileHidden: string[];
  log: string[];
  verdict?: string;
}

const KEY = "g2digest:spike";

export async function bootSpike(root: HTMLElement, audioUrl: string) {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), BRIDGE_TIMEOUT_MS));
  const bridge = (await Promise.race([waitForEvenAppBridge().catch(() => null), timeout])) as EvenAppBridge | null;
  const save = async (r: Run) => {
    const v = JSON.stringify(r);
    if (bridge) await bridge.setLocalStorage(KEY, v).catch(() => false);
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  };
  const load = async (): Promise<Run | null> => {
    const v = (bridge ? await bridge.getLocalStorage(KEY).catch(() => "") : "") || (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    return v ? (JSON.parse(v) as Run) : null;
  };

  root.innerHTML = `
    <div class="plugin spike">
      <header><b>Audio spike</b><span class="pill">${bridge ? "in the Even app" : "browser (no bridge)"}</span></header>
      <p class="muted">Start, then lock the phone for 30 to 120 seconds (the clip is about three minutes). Tap the R1 once while locked (pause), once more (resume). Unlock and read the verdict.</p>
      <div class="row"><button class="primary start">Start</button><button class="stop">Stop</button></div>
      <p class="verdict"></p>
      <pre class="log"></pre>
    </div>`;
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
  const audio = new Audio(audioUrl);
  let run: Run | null = await load();
  const print = () => {
    $<HTMLElement>(".verdict").textContent = run?.verdict ?? "";
    $<HTMLElement>(".log").textContent = run ? run.log.join("\n") : "No run yet.";
  };
  const log = (m: string) => {
    if (!run) return;
    run.log.push(`${new Date().toLocaleTimeString()} ${m}`);
    void save(run);
    print();
  };

  if (bridge) {
    bridge.onEvenHubEvent((e: EvenHubEvent) => {
      const sys = e.sysEvent ?? e.textEvent ?? e.listEvent;
      if (!sys) return;
      const t = OsEventTypeList.fromJson(sys.eventType ?? 0);
      const name = t === undefined ? `event ${sys.eventType}` : OsEventTypeList[t];
      if (t === OsEventTypeList.CLICK_EVENT) {
        if (audio.paused) void audio.play(); else audio.pause();
      }
      if (run && document.visibilityState === "hidden") run.eventsWhileHidden.push(`${name} (audio ${audio.paused ? "paused" : "playing"})`);
      log(`ring/glasses: ${name} → audio ${audio.paused ? "paused" : "playing"}`);
    });
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [new TextContainerProperty({ containerID: 1, containerName: "spike", xPosition: 0, yPosition: 0, width: 576, height: 288, content: "AUDIO SPIKE\n\nTap: play / pause\nLock the phone now", isEventCapture: 1 })],
    }));
  }

  document.addEventListener("visibilitychange", () => {
    if (!run) return;
    if (document.visibilityState === "hidden") {
      run.hiddenAt = Date.now();
      run.hiddenAudioPos = audio.currentTime;
      run.eventsWhileHidden = [];
      log(`hidden (locked?) at audio ${audio.currentTime.toFixed(1)} s, ${audio.paused ? "paused" : "playing"}`);
    } else {
      run.shownAt = Date.now();
      run.shownAudioPos = audio.currentTime;
      const away = (run.shownAt - (run.hiddenAt ?? run.shownAt)) / 1000;
      const advanced = (run.shownAudioPos ?? 0) - (run.hiddenAudioPos ?? 0);
      const kept = away > 5 && advanced > away * 0.5;
      run.verdict = away < 5
        ? "Lock for longer than five seconds and try again."
        : kept
          ? `PASS: audio advanced ${advanced.toFixed(0)} s during ${away.toFixed(0)} s locked. Ring events while locked: ${run.eventsWhileHidden.length ? run.eventsWhileHidden.join(", ") : "none (tap the ring while locked to test control)"}.`
          : `FAIL: audio advanced ${advanced.toFixed(1)} s during ${away.toFixed(0)} s locked. Use the podcast-feed fallback.`;
      log(`shown after ${away.toFixed(0)} s, audio at ${audio.currentTime.toFixed(1)} s. ${run.verdict}`);
    }
  });

  $<HTMLButtonElement>(".start").addEventListener("click", async () => {
    run = { started: new Date().toISOString(), eventsWhileHidden: [], log: [] };
    try {
      await audio.play();
      log(`playing (${bridge ? "Even WebView" : "browser"}; ${navigator.userAgent.slice(0, 80)})`);
    } catch (e) {
      log(`play() refused: ${(e as Error).message}`);
    }
  });
  $<HTMLButtonElement>(".stop").addEventListener("click", () => {
    audio.pause();
    log("stopped");
  });
  print();
}
