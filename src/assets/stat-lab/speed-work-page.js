// Time, speed and distance; trains; time and work; men, days and hours.
import { h, block, formula, answer, fmt, parseNum, calcPage, need, F, fracText } from "./kit.js";
import * as A from "./lib/arith.js";

// "2 hours 30 minutes", or "2.4167 hours" when the minutes are not whole.
function hours(t) {
  const hh = Math.floor(t + 1e-9), mm = (t - hh) * 60, r = Math.round(mm);
  if (Math.abs(mm - r) < 1e-6) return [hh ? `${hh} hour${hh === 1 ? "" : "s"}` : "", r ? `${r} minute${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "0 hours";
  return `${fmt(t)} hours (about ${hh ? `${hh} h ` : ""}${fmt(mm, 1)} min)`;
}
const isBlank = (s) => String(s ?? "").trim() === "";

const WHAT = [["pole", "A pole or a person standing"], ["platform", "A platform, bridge or tunnel"], ["opposite", "A train coming the other way"], ["same", "A train going the same way"]];

const MODES = {
  sdt: {
    label: "Speed, distance and time",
    hint: "Fill in any two and leave the third empty. Distance = speed × time.",
    fields: [{ k: "D", label: "Distance (km)" }, { k: "S", label: "Speed (km/h)" }, { k: "T", label: "Time (hours)" }],
    example: { D: "195", S: "", T: "3.25" },
    solve(v) {
      const empty = ["D", "S", "T"].filter((k) => isBlank(v[k]));
      if (empty.length !== 1) return { errors: ["Fill in exactly two of distance, speed and time, and leave the one to find empty."] };
      const { x, errors } = need(v, [["D", "the distance", "positive"], ["S", "the speed", "positive"], ["T", "the time", "positive"]].filter(([k]) => k !== empty[0]));
      if (errors.length) return { errors };
      if (empty[0] === "D") { const d = x.S * x.T; return [answer("Distance", `${fmt(d)} km`), block("Working", formula(`Distance = speed × time = ${fmt(x.S)} × ${fmt(x.T)} = ${fmt(d)} km`))]; }
      if (empty[0] === "S") { const s = x.D / x.T; return [answer("Speed", `${fmt(s)} km/h`, h("p", {}, `That is ${fmt(A.kmphToMps(s))} m/s.`)), block("Working", formula(`Speed = distance / time = ${fmt(x.D)} / ${fmt(x.T)} = ${fmt(s)} km/h`))]; }
      const t = x.D / x.S;
      return [answer("Time", hours(t)), block("Working", formula(`Time = distance / speed = ${fmt(x.D)} / ${fmt(x.S)} = ${fmt(t)} hours`))];
    },
  },
  convert: {
    label: "km/h and m/s",
    hint: "Fill in one of the two. 1 km/h = 1000 m / 3600 s = 5/18 m/s.",
    fields: [{ k: "kmph", label: "Speed in km/h" }, { k: "mps", label: "Speed in m/s" }],
    example: { kmph: "72", mps: "" },
    solve(v) {
      const a = !isBlank(v.kmph), b = !isBlank(v.mps);
      if (a === b) return { errors: ["Fill in one of the two speeds and leave the other empty."] };
      const { x, errors } = need(v, a ? [["kmph", "the speed in km/h"]] : [["mps", "the speed in m/s"]]);
      if (errors.length) return { errors };
      return a ? [answer(`${fmt(x.kmph)} km/h`, `${fmt(A.kmphToMps(x.kmph))} m/s`), block("Working", formula(`${fmt(x.kmph)} × 5 / 18 = ${fmt(A.kmphToMps(x.kmph))} m/s`))]
        : [answer(`${fmt(x.mps)} m/s`, `${fmt(A.mpsToKmph(x.mps))} km/h`), block("Working", formula(`${fmt(x.mps)} × 18 / 5 = ${fmt(A.mpsToKmph(x.mps))} km/h`))];
    },
  },
  avg: {
    label: "Average speed over a journey",
    hint: "Enter each part of the journey: its distance and the speed for it. The average speed is the total distance ÷ the total time, not the average of the speeds.",
    table: { k: "legs", head: ["Distance (km)", "Speed (km/h)"], min: 2, add: "Add a part", label: "Parts of the journey" },
    example: { legs: [["120", "60"], ["120", "40"]] },
    solve(v) {
      const rows = v.legs.filter((r) => r.some((c) => c.trim())), errors = [];
      const legs = rows.map((r, i) => {
        const d = parseNum(r[0]), s = parseNum(r[1]);
        if (!(d > 0)) errors.push(`Part ${i + 1}: the distance must be a number more than zero.`);
        if (!(s > 0)) errors.push(`Part ${i + 1}: the speed must be a number more than zero.`);
        return { d, v: s };
      });
      if (rows.length < 2) errors.push("Enter at least two parts of the journey.");
      if (errors.length) return { errors };
      const r = A.averageSpeed(legs);
      const lines = legs.map((l, i) => `Part ${i + 1}: time = ${fmt(l.d)} / ${fmt(l.v)} = ${fmt(r.times[i])} hours`);
      lines.push(`Total distance = ${legs.map((l) => fmt(l.d)).join(" + ")} = ${fmt(r.D)} km`, `Total time = ${r.times.map((t) => fmt(t)).join(" + ")} = ${fmt(r.T)} hours`, `Average speed = ${fmt(r.D)} / ${fmt(r.T)} = ${fmt(r.avg)} km/h`);
      const same = legs.length === 2 && legs[0].d === legs[1].d;
      return [answer("Average speed", `${fmt(r.avg)} km/h`), block("Working", formula(...lines),
        same ? h("p", { class: "lab-hint" }, `Equal distances at x and y km/h give 2xy / (x + y) = 2 × ${fmt(legs[0].v)} × ${fmt(legs[1].v)} / (${fmt(legs[0].v)} + ${fmt(legs[1].v)}) = ${fmt(r.avg)} km/h, the same answer.`) : null)];
    },
  },
  train: {
    label: "Trains: time to pass",
    hint: "Lengths in metres, speeds in km/h. The train must cover its own length, plus the length of whatever it passes.",
    fields: (v) => [[{ k: "what", label: "The train passes", type: "select", options: WHAT, size: "w-l", redraw: true }],
      [{ k: "L1", label: "Train length (m)" }, { k: "v1", label: "Train speed (km/h)" }, ...(v.what !== "pole" ? [{ k: "L2", label: v.what === "platform" ? "Its length (m)" : "Other train's length (m)" }] : []), ...(v.what === "opposite" || v.what === "same" ? [{ k: "v2", label: "Other train's speed (km/h)" }] : [])]],
    example: { what: "opposite", L1: "150", v1: "54", L2: "100", v2: "36" },
    solve(v) {
      const spec = [["L1", "the train's length", "positive"], ["v1", "the train's speed", "positive"]];
      if (v.what !== "pole") spec.push(["L2", v.what === "platform" ? "the length it passes" : "the other train's length", "positive"]);
      if (v.what === "opposite" || v.what === "same") spec.push(["v2", "the other train's speed", "nonneg"]);
      const { x, errors } = need(v, spec);
      if (!errors.length && v.what === "same" && x.v1 === x.v2) errors.push("At the same speed in the same direction, one train never passes the other.");
      if (errors.length) return { errors };
      const r = A.crossing({ L1: x.L1, L2: x.L2 ?? 0, v1: x.v1, v2: x.v2 ?? 0, same: v.what === "same" });
      const lines = [];
      if (v.what === "opposite") lines.push(`Moving towards each other, the speeds add: ${fmt(x.v1)} + ${fmt(x.v2)} = ${fmt(r.rel)} km/h`);
      if (v.what === "same") lines.push(`Moving the same way, the relative speed is the difference: ${fmt(Math.max(x.v1, x.v2))} − ${fmt(Math.min(x.v1, x.v2))} = ${fmt(r.rel)} km/h`);
      lines.push(`Speed in m/s = ${fmt(r.rel)} × 5 / 18 = ${fmt(r.relMps)} m/s`);
      lines.push(v.what === "pole" ? `Distance = the train's length = ${fmt(r.length)} m` : `Distance = ${fmt(x.L1)} + ${fmt(x.L2)} = ${fmt(r.length)} m`);
      lines.push(`Time = distance / speed = ${fmt(r.length)} / ${fmt(r.relMps)} = ${fmt(r.time)} seconds`);
      return [answer("Time to pass", `${fmt(r.time)} seconds`), block("Working", formula(...lines))];
    },
  },
  work: {
    label: "Working together (people or pipes)",
    hint: "Enter the time each one takes alone. For a pipe that empties the tank, use a minus sign (−12 means it empties a full tank in 12 hours).",
    table: { k: "rows", head: ["Time alone"], cellAttrs: () => ({ inputmode: "text" }), min: 2, add: "Add another", label: "Workers" },
    example: { rows: [["10"], ["15"], ["-30"]] },
    solve(v) {
      const rows = v.rows.filter((r) => r[0].trim()), errors = [];
      const t = rows.map((r, i) => { const f = F.parse(r[0]); if (!f || f.isZero()) errors.push(`Row ${i + 1}: enter a time that is not zero.`); return f; });
      if (rows.length < 2) errors.push("Enter at least two times.");
      if (errors.length) return { errors };
      const rate = t.reduce((s, f) => s.add(new F(1n).div(f)), new F(0n));
      const one = new F(1n), rateOf = (f) => (f.isInt() ? `1/${f}` : String(one.div(f)));
      const parts = t.map((f) => (f.sign() < 0 ? `− ${rateOf(f.neg())}` : `+ ${rateOf(f)}`)).join(" ").replace(/^\+ /, "");
      if (rate.sign() <= 0) return [answer("The work is never finished", rate.isZero() ? "Rates cancel" : "It empties faster"), block("Working", formula(`Work done in one unit of time = ${parts} = ${rate}`), h("p", { class: "lab-hint" }, "The emptying is at least as fast as the filling, so the tank never fills."))];
      const time = new F(1n).div(rate);
      return [answer("Together they finish in", fracText(time)),
        block("Working", formula(`In one unit of time they do ${parts} = ${rate} of the work`, `Time for the whole work = 1 ÷ ${rate} = ${time}${time.isInt() ? "" : ` ≈ ${fmt(time.toNumber())}`}`),
          h("p", { class: "lab-hint" }, "The answer is in the same unit as the times you entered (days or hours)."))];
    },
  },
  mdh: {
    label: "Men, days and hours (M₁D₁H₁/W₁ = M₂D₂H₂/W₂)",
    hint: "Fill in both rows and leave the one value to find empty. If the problem says nothing about hours, leave both hour boxes empty; if the work is the same in both, leave both work boxes empty.",
    fields: [[{ k: "M1", label: "Men M₁", size: "w-s" }, { k: "D1", label: "Days D₁", size: "w-s" }, { k: "H1", label: "Hours a day H₁", size: "w-s" }, { k: "W1", label: "Work W₁", size: "w-s" }],
      [{ k: "M2", label: "Men M₂", size: "w-s" }, { k: "D2", label: "Days D₂", size: "w-s" }, { k: "H2", label: "Hours a day H₂", size: "w-s" }, { k: "W2", label: "Work W₂", size: "w-s" }]],
    example: { M1: "12", D1: "18", H1: "8", W1: "", M2: "", D2: "12", H2: "9", W2: "" },
    solve(v) {
      const vals = { ...v }, NAMES = { M: "men", D: "days", H: "hours a day", W: "work" };
      const noH = isBlank(v.H1) && isBlank(v.H2), noW = isBlank(v.W1) && isBlank(v.W2);
      if (noH) vals.H1 = vals.H2 = "1";
      if (noW) vals.W1 = vals.W2 = "1";
      const keys = ["M1", "D1", "H1", "W1", "M2", "D2", "H2", "W2"];
      const empty = keys.filter((k) => isBlank(vals[k]));
      if (empty.length !== 1) return { errors: ["Leave exactly one box empty: the value to find."] };
      const { x, errors } = need(vals, keys.filter((k) => k !== empty[0]).map((k) => [k, `${NAMES[k[0]]} (${k[1] === "1" ? "first" : "second"} row)`, "positive"]));
      if (errors.length) return { errors };
      const r = A.menDays(Object.fromEntries(keys.map((k) => [k, k === empty[0] ? null : x[k]])));
      const o = r.values, f = empty[0];
      const used = ["M", "D", ...(noH ? [] : ["H"])];
      const side = (n) => `${used.map((c) => (c + n === f ? "x" : fmt(o[c + n]))).join(" × ")}${noW ? "" : ` / ${"W" + n === f ? "x" : fmt(o["W" + n])}`}`;
      const sub = { 1: "₁", 2: "₂" };
      return [answer(`${NAMES[f[0]][0].toUpperCase()}${NAMES[f[0]].slice(1)} (${f[0]}${sub[f[1]]})`, fmt(o[f])),
        block("Working", formula(`${used.map((c) => c + "₁").join(" × ")}${noW ? "" : " / W₁"} = ${used.map((c) => c + "₂").join(" × ")}${noW ? "" : " / W₂"}`, `${side(1)} = ${side(2)}`, `x = ${fmt(o[f])}`),
          h("p", { class: "lab-hint" }, "More men or more hours finish the same work in fewer days: men, days and hours are inversely related, and each is directly related to the work."))];
    },
  },
};

calcPage(MODES).boot();
