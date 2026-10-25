// The home page's G2 preview: the example plan driven by the same Navigator as the glasses.
import { dayState, Navigator, WEEKDAYS, type Checkin, type Input, type Plan, type World } from "@fitloop/core";
import example from "@fitloop/core/fixtures/example-plan.json";

const plan = example as unknown as Plan;
// Today's weekday from the sample week, whatever the date.
const date = new Date().toISOString().slice(0, 10);
const weekday = WEEKDAYS[(new Date().getDay() + 6) % 7];
const sample: Plan = { ...plan, starts_on: date, ends_on: undefined, overrides: { [date]: plan.week[weekday].workouts.length ? plan.week[weekday] : plan.week.mon } };
const checkins: Checkin[] = [];
const nav = new Navigator();
const g2 = document.getElementById("g2")!;
const world = (): World => ({ date, now: Date.now(), day: dayState(sample, date, checkins), planVersion: 1, hr: 118 + Math.round(Math.random() * 20), showHr: true, autoRest: true });

const render = () => (g2.textContent = nav.lines(world()).join("\n"));
document.querySelectorAll<HTMLButtonElement>(".ring button").forEach((b) => b.addEventListener("click", () => {
  for (const c of nav.input(b.dataset.in as Input, world())) if (c.kind === "checkin") checkins.push({ ...c.checkin, plan_version: 1, at: new Date().toISOString() });
  render();
}));
render();
setInterval(() => { if (nav.ticking(Date.now())) render(); }, 1000);
