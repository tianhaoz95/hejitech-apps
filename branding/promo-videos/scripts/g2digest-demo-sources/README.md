# g2digest-demo sources

Made-up feeds for the G2 Digest walkthrough video (reports/2026-11-02-g2digest-demo-video). The
demo brief's sections read them, so the build agent in chapter 3 really researches, ranks and cuts
items, and nothing on screen is a real headline, company or person. Every item says it's invented.

Served locally by `g2digest-demo-record.mjs` (`python3 -m http.server 8899 --bind 127.0.0.1` from
this folder): `http://127.0.0.1:8899/harbor-line.xml`, `ocean.xml`, `forecast.json`, `items/*.html`.
