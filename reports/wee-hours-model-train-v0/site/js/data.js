// Every number on the page comes from here (run manifests, training logs, logeval summaries).
window.REPORT = {
  // Per event type in the full run: plans, utterances written, kept by the blind check, training rows.
  funnel: [
    ["feed.bottle.finish", 862, 2584, 1280, 1102],
    ["none_of_these", 840, 2516, 2132, 1870],
    ["diaper", 833, 2497, 1680, 1427],
    ["feed.bottle.start", 739, 2217, 1185, 1053],
    ["feed.breast.start", 537, 1610, 894, 711],
    ["sleep.start", 457, 1371, 636, 536],
    ["sleep.end", 407, 1221, 456, 371],
    ["feed.breast.finish", 399, 1197, 471, 418],
    ["feed.solids", 373, 1118, 890, 757],
    ["feed.breast.switch", 364, 1092, 805, 660],
    ["feed.bottle.single", 362, 1084, 204, 190],
    ["pump", 355, 1065, 662, 597],
    ["weight", 201, 596, 596, 531],
    ["height", 145, 425, 425, 383],
    ["head", 126, 373, 373, 352],
  ],
  // Mean training loss per epoch (laya.train RLCD), 4 epochs each.
  loss: {
    pilot: [0.9545, 0.2043, 0.0780, 0.1284],
    v1: [0.6534, 0.3982, 0.2699, 0.1855],
    v2: [0.6477, 0.4221, 0.2753, 0.1698],
    topup: [0.6873, 0.4540, 0.3584, 0.2639],
  },
  lossNote: "RLCD = soft cross-entropy + a GRPO-style policy-gradient term (noisy option scores rewarded by a proper scoring rule), so single steps swing and dip below zero; the epoch means fall steadily. The pilot's epoch-4 bump is 10 updates on 612 items.",
  // The full run (v1) on the Spark clock; [stage, start, end].
  timeline: [
    ["teacher up", "10:54:27", "11:04:40"],
    ["utterances (gpt-oss-120b)", "11:04:40", "12:45:27"],
    ["tts rest", "12:45:29", "13:33:22"],
    ["asr", "13:33:22", "13:37:09"],
    ["build", "13:37:09", "13:39:44"],
    ["train", "13:39:44", "14:20:26"],
    ["convert", "14:20:26", "14:21:30"],
  ],
  evalRows: 178,
  best: "Top-up",
  // [tier, sentence, expected, got] for every row a run gets wrong (pick = offered as one of two).
  misses: {
    "Top-up": [
      ["auto", "remember to buy more formula", "not a log entry", "Bottle (one entry) · formula"],
      ["pick", "switching sides, now left", "Switch side · left", "Switch side, side unsure (pick-two, not logged)"],
      ["pick", "switching sides, now right", "Switch side · right", "Switch side, side unsure (pick-two, not logged)"],
      ["full_list", "finished drinking", "Finish bottle · amount not stated", "Finish bottle · drank all (full list, not logged)"],
    ],
    "v2 full": [
      ["auto", "had a bottle half an hour ago and drank three quarters", "Bottle (one entry)", "Finish bottle · drank ¾"],
      ["auto", "she had a bottle an hour ago, drank half", "Bottle (one entry)", "Finish bottle · drank ½"],
      ["auto", "need to wash the bottles", "not a log entry", "Finish bottle"],
      ["pick", "swapped to right", "Switch side · right", "Switch side, side unsure (pick-two, not logged)"],
    ],
    "v1 full": [
      ["auto", "fed a bottle, drank a quarter", "Bottle (one entry)", "Finish bottle · drank ¼"],
      ["auto", "had a bottle half an hour ago and drank three quarters", "Bottle (one entry)", "Finish bottle · drank ¾"],
      ["auto", "she had a bottle an hour ago, drank half", "Bottle (one entry)", "Finish bottle · drank ½"],
      ["auto", "need to wash the bottles", "not a log entry", "Finish bottle"],
      ["pick", "gave him a full bottle earlier", "Bottle (one entry)", "Finish bottle · drank all (wrong pick-two)"],
    ],
  },
  // logeval on spec/utterances.jsonl (178 rows), raw (no fitted calibration), through llama-server.
  // wrong = wrong auto-commits (count); auto = auto-commit rate.
  evals: [
    { name: "Stock Laya", note: "what the app ships today", type: 83.7, full: 66.9, category: 37.1, phase: 67.5, auto: 2.8, wrong: 0 },
    { name: "Pilot", note: "600 utterances, 336 rows", type: 92.1, full: 87.6, category: 96.1, phase: 89.2, auto: 71.3, wrong: 7, oldEval: true },
    { name: "v1 full", note: "10,958 rows", type: 97.2, full: 97.2, category: 98.3, phase: 96.7, auto: 92.1, wrong: 4 },
    { name: "v2 full", note: "same data, corrected export", type: 97.8, full: 97.8, category: 97.8, phase: 98.3, auto: 91.6, wrong: 3 },
    { name: "Top-up", note: "12,653 rows, new phase wording (branch)", type: 99.4, full: 97.8, category: 98.3, phase: 100, auto: 88.2, wrong: 1 },
    { name: "Stock, new wording", note: "why the wording ships only with the model", type: 72.5, full: 56.7, category: 37.1, phase: 66.7, auto: 2.8, wrong: 0 },
  ],
  topupOutcome: "<b>Best run.</b> Type 99.4%, phase 100%, 1 wrong auto-commit (was 3). Both past bottles and “need to wash the bottles” now right. One-entry bottle rows 190 → 1,195.",
  verdict: "<b>Recommendation: ship the top-up model, raw (no fitted calibration), together with the phase wording</b>, after the on-device checks in <a href=\"#ship\">§10</a>. On the app's eval it takes type accuracy from 83.7% to 99.4% and lets the app log 88% of sentences without asking, with 1 wrong auto-commit in 178.",
  shipVerdict: "<b>Shipped: the top-up model, raw, with the phase wording, in Wee Hours 0.4.0.</b> It passes the README's bar (category, phase and type accuracy rise) except that wrong auto-commits go from 0 to 1 — stock reaches 0 only by almost never committing (2.8%). Don't adopt the fitted calibration: on the 89 odd rows it raises wrong auto-commits to 3.7% and the pick-two hit rate collapses, so set <code>spec/calibration.json</code> temperatures to 1.0 for this model (the GGUF already carries the trainer's fitted temperatures). Watch side detection (“switching sides, now left” lands in pick-two).",
};
