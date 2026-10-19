"""Generates the seed utterance set (spec/utterances.jsonl).

Synthetic but varied: templates written the way tired parents talk, crossed with amounts, sides,
kinds and relative times, plus hand-written messy ones. Deterministic (seeded) so results are
comparable across runs. Week-1 real corrections are meant to be appended to this file.
"""
import json
import random
from pathlib import Path

random.seed(7)
OUT = Path(__file__).resolve().parent.parent / "spec" / "utterances.jsonl"

rows = []


def add(text, type_, open_=None, **fields):
    rows.append({"text": text, "open": open_ or [], "expect": {"type": type_, **fields}})


WHEN = [("", "now"), (" five minutes ago", "5"), (" about fifteen minutes ago", "15"),
        (" half an hour ago", "30"), (" an hour ago", "60")]

# bottle starts
for t in ["starting a bottle", "start drinking", "she's starting her bottle", "giving him a bottle now",
          "bottle started", "okay starting the bottle", "began a bottle of formula", "starting a bottle of breast milk",
          "start bottle", "he's drinking now"]:
    contents = "formula" if "formula" in t else "breast_milk" if "breast milk" in t else "not_stated"
    add(t, "feed.bottle.start", contents=contents, when="now")

# bottle finishes with amounts
AMOUNTS = [("drank half a bottle", "half"), ("drank a quarter", "quarter"), ("drank three quarters", "three_quarters"),
           ("finished the whole thing", "full"), ("a quarter left", "quarter_left"), ("half left", "half_left"),
           ("three quarters left over", "three_quarters_left"), ("drank all of it", "full")]
PREFIX = ["finished drinking, ", "done with the bottle, ", "bottle done, ", "finished, ", "she's done, ", "all done, "]
for i, (a, key) in enumerate(AMOUNTS * 3):
    when_text, when = WHEN[i % len(WHEN)] if i % 3 == 0 else ("", "now")
    add(PREFIX[i % len(PREFIX)] + a + when_text, "feed.bottle.finish", open_=["bottle"] if i % 2 == 0 else [],
        amount=key, when=when)
for t in ["finished drinking", "bottle's done", "done drinking"]:
    add(t, "feed.bottle.finish", open_=["bottle"], amount="not_stated", when="now")
add("he finished his bottle", "feed.bottle.finish", open_=["bottle"], amount="full", when="now")

# singles
for t, a in [("she had a bottle an hour ago, drank half", "half"), ("gave him a full bottle earlier", "full"),
             ("had a bottle half an hour ago and drank three quarters", "three_quarters"),
             ("fed a bottle, drank a quarter", "quarter")]:
    add(t, "feed.bottle.single", amount=a)

# breastfeeding
for side in ["left", "right"]:
    for t in [f"nursing on the {side}", f"starting breastfeeding {side} side", f"latched on the {side}",
              f"start feeding {side} side", f"she's nursing, {side} side"]:
        add(t, "feed.breast.start", side=side, when="now")
    for t in [f"switched to the {side}", f"switching sides, now {side}", f"swapped to {side}"]:
        add(t, "feed.breast.switch", open_=["breast"], side=side, when="now")
for t in ["done nursing", "finished breastfeeding", "she unlatched, done", "finished nursing a few minutes ago",
          "all done nursing"]:
    add(t, "feed.breast.finish", open_=["breast"], when="5" if "few minutes" in t else "now")
add("started nursing", "feed.breast.start", side="not_stated", when="now")
add("switched sides", "feed.breast.switch", open_=["breast"], side="not_stated", when="now")

# diapers
DIAPERS = [("wet diaper", "wet"), ("dirty diaper", "dirty"), ("poopy diaper", "dirty"), ("just pee", "wet"),
           ("changed a wet one", "wet"), ("big poop", "dirty"), ("wet and dirty diaper", "both"),
           ("diaper was dry", "dry"), ("changed her diaper, it was wet", "wet"), ("blowout, poop everywhere", "dirty"),
           ("diaper change, both pee and poop", "both"), ("changed a dirty nappy", "dirty")]
for i, (t, k) in enumerate(DIAPERS * 2):
    when_text, when = WHEN[i % len(WHEN)] if i >= len(DIAPERS) else ("", "now")
    add(t + when_text, "diaper", diaper_kind=k, when=when)
add("changed his diaper", "diaper", diaper_kind="not_stated", when="now")
add("diaper change", "diaper", diaper_kind="not_stated", when="now")

# sleep
for i, t in enumerate(["she fell asleep", "he's asleep", "down for a nap", "went to sleep", "nap time, she's out",
                       "finally asleep", "put him down for the night", "baby's sleeping"]):
    when_text, when = WHEN[i % len(WHEN)] if i % 2 else ("", "now")
    add(t + when_text, "sleep.start", when=when)
for i, t in enumerate(["she woke up", "he's awake", "baby's up", "woke up from the nap", "awake again",
                       "she's up now"]):
    add(t, "sleep.end", open_=["sleep"], when="now")

# pumping, solids, weight
for t, side in [("pumped both sides", "both"), ("pumped 120 ml", "not_stated"), ("pumped the left side, 60 ml", "left"),
                ("done pumping right side", "right"), ("pumped four ounces", "not_stated")]:
    add(t, "pump", side=side)
for t, a in [("she had some banana puree", "some"), ("ate all of her oatmeal", "all"), ("just a taste of avocado", "taste"),
             ("ate most of the cereal", "most")]:
    add(t, "feed.solids", solids_amount=a)
for t in ["she weighs 4.2 kilos", "weighed him, 8 pounds 3 ounces", "weight is 5100 grams", "baby weighs 9 pounds"]:
    add(t, "weight")

# none of these
for t in ["call the pediatrician tomorrow", "we're out of wipes", "she has a little rash on her cheek",
          "remember to buy more formula", "grandma is coming at noon", "the bath water was too cold",
          "temperature is 37.2", "she smiled for the first time"]:
    add(t, "none_of_these")


# more relative-time and explicit-time variety
for i, t in enumerate(["started a bottle", "she started drinking her bottle", "gave her a bottle of formula",
                       "began feeding him a bottle"]):
    for when_text, when in WHEN[1:]:
        contents = "formula" if "formula" in t else "not_stated"
        # "gave her a bottle … ago" is a feed told after it was over: one entry (user's call, 2026-10-18)
        add(t + when_text, "feed.bottle.single" if t.startswith("gave") else "feed.bottle.start", contents=contents, when=when)
for side in ["left", "right"]:
    for when_text, when in WHEN[1:]:
        add(f"started nursing on the {side}{when_text}", "feed.breast.start", side=side, when=when)
for t, ty, extra in [("fell asleep at 2:10", "sleep.start", {}), ("woke up at 3:45", "sleep.end", {}),
                     ("wet diaper at 1:30 am", "diaper", {"diaper_kind": "wet"}),
                     ("finished the bottle at 4:05, drank half", "feed.bottle.finish", {"amount": "half"}),
                     ("started a bottle at 11:50 pm", "feed.bottle.start", {"contents": "not_stated"})]:
    add(t, ty, when="explicit", **extra)
for t, k in [("ugh another poop", "dirty"), ("wet one again", "wet"), ("pee diaper", "wet"), ("soiled diaper", "dirty"),
             ("nappy was wet", "wet"), ("poop and pee", "both")]:
    add(t, "diaper", diaper_kind=k, when="now")
for t in ["she's out like a light", "he dozed off", "asleep in the car seat", "napping now"]:
    add(t, "sleep.start", when="now")
for t in ["eyes open, she's awake", "he woke from his nap", "up from the nap"]:
    add(t, "sleep.end", open_=["sleep"], when="now")
for t, a in [("finished the bottle, about half left", "half_left"), ("she only drank a quarter of it", "quarter"),
             ("drank the whole bottle", "full"), ("done, three quarters gone", "three_quarters"),
             ("finished, quarter of the bottle left", "quarter_left"), ("finished drinking 90 ml", "not_stated")]:
    add(t, "feed.bottle.finish", open_=["bottle"], amount=a, when="now")
for t in ["what time is the appointment", "he sneezed a lot today", "need to wash the bottles", "hiccups again"]:
    add(t, "none_of_these")
# not log entries, written by hand and kept out of ml/'s training topics: health, plans,
# milestones, errands and near-misses that use feeding, diaper or sleep words (2026-10-19)
for t in ["she's teething I think", "he rolled over by himself", "baby's got a bit of a cough",
          "we need more nappies", "is she due for her vaccines soon", "the formula tin is almost empty",
          "put the bottles in the steriliser", "how long since she last ate", "remind me to order diapers",
          "he's been really fussy tonight", "she grabbed my finger", "baby monitor battery is low",
          "nail trimming done", "tummy time on the play mat", "gave her the vitamin D drops",
          "he laughed at the dog", "pediatrician says she's doing great", "the washing machine is done",
          "what's the weather tomorrow", "I need a coffee", "her eyes look a bit goopy",
          "we're going for a walk", "car seat is installed", "she's got baby acne",
          "can't find the pacifier", "he's wearing the blue onesie", "bath at seven tonight",
          "she's staring at the ceiling fan", "booked the six week check", "time to clip his nails"]:
    add(t, "none_of_these")

random.shuffle(rows)
OUT.write_text("".join(json.dumps(r) + "\n" for r in rows))
print(f"wrote {len(rows)} utterances to {OUT}")
