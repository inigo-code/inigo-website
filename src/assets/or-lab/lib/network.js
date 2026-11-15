// Network analysis for an activity-on-arrow (i-j) project network: CPM, PERT and a
// Monte Carlo simulation of the project time.
//
// Notation (as in B.B.A. textbooks):
//   E(i), L(i)  earliest and latest time of event i
//   For activity i -> j with duration t:
//     ES = E(i), EF = E(i) + t, LF = L(j), LS = L(j) - t
//     Total float       = L(j) - E(i) - t
//     Free float        = E(j) - E(i) - t
//     Independent float = max(0, E(j) - L(i) - t)
//   PERT: te = (a + 4m + b) / 6, variance = ((b - a) / 6)^2
// A dummy activity has duration 0 (a = m = b = 0 in PERT).

import { EPS, clean, normCdf, normInv, rng } from "./num.js";

export const MAX_PATHS = 50;

export const pertTime = (a, m, b) => clean((a + 4 * m + b) / 6);
export const pertVar = (a, b) => clean(((b - a) / 6) ** 2);

// Check the activity list. `acts` is [{ id, start, end, t }] for CPM or
// [{ id, start, end, a, m, b }] for PERT. Returns a list of error messages.
export function validate(acts, mode = "cpm") {
  const errors = [];
  const ids = new Map(), pairs = new Map();
  if (!acts.length) errors.push("Add at least one activity.");
  acts.forEach((x, k) => {
    const row = `Row ${k + 1}`;
    if (!x.id) errors.push(`${row}: give the activity an ID.`);
    if (!x.start || !x.end) errors.push(`${row}${x.id ? ` (${x.id})` : ""}: give both a start event and an end event.`);
    else if (x.start === x.end) errors.push(`${row} (${x.id}): the start and end events must be different.`);
    if (mode === "cpm") {
      if (!Number.isFinite(x.t)) errors.push(`${row} (${x.id}): enter a duration.`);
      else if (x.t < 0) errors.push(`${row} (${x.id}): a duration cannot be negative. Use 0 for a dummy activity.`);
    } else {
      if (![x.a, x.m, x.b].every(Number.isFinite)) errors.push(`${row} (${x.id}): enter all three times a, m and b.`);
      else if (x.a < 0) errors.push(`${row} (${x.id}): times cannot be negative. Use 0, 0, 0 for a dummy activity.`);
      else if (!(x.a <= x.m && x.m <= x.b)) errors.push(`${row} (${x.id}): the times must satisfy a ≤ m ≤ b (optimistic ≤ most likely ≤ pessimistic).`);
    }
    if (x.id) {
      if (ids.has(x.id)) errors.push(`Activity ID ${x.id} is used twice (rows ${ids.get(x.id) + 1} and ${k + 1}).`);
      else ids.set(x.id, k);
    }
    if (x.start && x.end && x.start !== x.end) {
      const key = x.start + "\u0000" + x.end;
      if (pairs.has(key)) errors.push(`${acts[pairs.get(key)].id} and ${x.id} both run from event ${x.start} to event ${x.end}. Two activities cannot share both events: add a new event and a dummy activity.`);
      else pairs.set(key, k);
    }
  });
  return errors;
}

// Build the event structure once; it is reused by every pass and every simulation run.
function structure(acts) {
  const nodes = [], seen = new Set(), succ = new Map(), pred = new Map();
  const add = (n) => { if (!seen.has(n)) { seen.add(n); nodes.push(n); succ.set(n, []); pred.set(n, []); } };
  acts.forEach((x, k) => { add(x.start); add(x.end); succ.get(x.start).push(k); pred.get(x.end).push(k); });

  // Look for a loop (depth-first search) and report it as a list of events.
  const colour = new Map(nodes.map((n) => [n, 0])), parent = new Map();
  for (const root of nodes) {
    if (colour.get(root)) continue;
    const stack = [[root, 0]];
    colour.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const out = succ.get(top[0]);
      if (top[1] >= out.length) { colour.set(top[0], 2); stack.pop(); continue; }
      const next = acts[out[top[1]++]].end;
      if (colour.get(next) === 0) { colour.set(next, 1); parent.set(next, top[0]); stack.push([next, 0]); }
      else if (colour.get(next) === 1) {
        const loop = [next];
        for (let cur = top[0]; cur !== next; cur = parent.get(cur)) loop.push(cur);
        loop.push(next);
        return { loop: loop.reverse() };
      }
    }
  }

  // Topological order, keeping the order in which events were first entered.
  const indeg = new Map(nodes.map((n) => [n, pred.get(n).length]));
  const queue = nodes.filter((n) => indeg.get(n) === 0), order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    for (const k of succ.get(n)) {
      const e = acts[k].end;
      indeg.set(e, indeg.get(e) - 1);
      if (indeg.get(e) === 0) queue.push(e);
    }
  }
  return {
    order, succ, pred,
    starts: order.filter((n) => !pred.get(n).length),
    ends: order.filter((n) => !succ.get(n).length),
  };
}

function passes(acts, s, dur) {
  const early = new Map(), late = new Map();
  for (const n of s.order) {
    let v = 0;
    for (const k of s.pred.get(n)) v = Math.max(v, early.get(acts[k].start) + dur[k]);
    early.set(n, clean(v));
  }
  const total = Math.max(...s.ends.map((n) => early.get(n)));
  for (let i = s.order.length - 1; i >= 0; i--) {
    const n = s.order[i], out = s.succ.get(n);
    if (!out.length) { late.set(n, total); continue; }
    let v = Infinity;
    for (const k of out) v = Math.min(v, late.get(acts[k].end) - dur[k]);
    late.set(n, clean(v));
  }
  return { early, late, total };
}

// Forward and backward passes, floats and critical paths. `dur[k]` is the time used for activity k.
export function analyse(acts, dur) {
  const res = { ok: false, errors: [], warnings: [] };
  const s = structure(acts);
  if (s.loop) {
    res.errors.push(`The network has a loop: events ${s.loop.join(" → ")}. An activity cannot lead back to an earlier event, so the network cannot be analysed.`);
    return res;
  }
  if (s.starts.length > 1) res.warnings.push(`The network has more than one start event (${s.starts.join(", ")}). A project network should begin at a single event; here they all start at time 0.`);
  if (s.ends.length > 1) res.warnings.push(`The network has more than one end event (${s.ends.join(", ")}). A project network should finish at a single event; here they are all given the project end as their latest time.`);

  const { early, late, total } = passes(acts, s, dur);
  const rows = acts.map((x, k) => {
    const t = dur[k];
    const tf = clean(late.get(x.end) - early.get(x.start) - t);
    return {
      id: x.id, start: x.start, end: x.end, t,
      es: early.get(x.start), ef: clean(early.get(x.start) + t),
      ls: clean(late.get(x.end) - t), lf: late.get(x.end),
      tf,
      ff: clean(early.get(x.end) - early.get(x.start) - t),
      ifl: clean(Math.max(0, early.get(x.end) - late.get(x.start) - t)),
      critical: Math.abs(tf) < EPS,
      dummy: t === 0 && (x.t === 0 || (x.a === 0 && x.b === 0)),
    };
  });

  // Every chain of zero-float activities from a start event to an end event that finishes at the project time.
  const paths = [];
  let truncated = false;
  const walk = (node, chain) => {
    if (paths.length >= MAX_PATHS) { truncated = true; return; }
    const out = s.succ.get(node);
    if (!out.length) { if (Math.abs(early.get(node) - total) < EPS) paths.push(chain.slice()); return; }
    for (const k of out) if (rows[k].critical) { chain.push(k); walk(acts[k].end, chain); chain.pop(); }
  };
  for (const n of s.starts) if (Math.abs(late.get(n)) < EPS) walk(n, []);

  Object.assign(res, {
    ok: true, total, rows, early, late,
    order: s.order, starts: s.starts, ends: s.ends,
    paths, truncated,
    critical: rows.filter((r) => r.critical).map((r) => r.id),
  });
  return res;
}

export const cpm = (acts) => analyse(acts, acts.map((x) => x.t));

// PERT: expected times and variances, the critical path(s), and the project's variance.
// When several paths are critical, the one with the largest variance is used (the usual textbook rule).
export function pert(acts) {
  const te = acts.map((x) => pertTime(x.a, x.m, x.b));
  const res = analyse(acts, te);
  if (!res.ok) return res;
  res.rows.forEach((r, k) => { r.a = acts[k].a; r.m = acts[k].m; r.b = acts[k].b; r.variance = pertVar(acts[k].a, acts[k].b); r.sd = Math.sqrt(r.variance); });
  res.pathStats = res.paths.map((p) => {
    const variance = clean(p.reduce((s, k) => s + res.rows[k].variance, 0));
    return { path: p, variance, sd: Math.sqrt(variance) };
  });
  const top = res.pathStats.reduce((best, p) => (!best || p.variance > best.variance + EPS ? p : best), null);
  res.variance = top ? top.variance : 0;
  res.sd = Math.sqrt(res.variance);
  return res;
}

// Probability of finishing by time T: Z = (T - Te) / σ.
export function probabilityBy(Te, sd, T) {
  if (sd < EPS) return { z: T >= Te - EPS ? Infinity : -Infinity, p: T >= Te - EPS ? 1 : 0 };
  const z = (T - Te) / sd;
  return { z, p: normCdf(z) };
}

// Time by which the project finishes with probability p: T = Te + Zp × σ.
export function timeFor(Te, sd, p) {
  const z = normInv(p);
  return { z, T: Te + z * sd };
}

// ----- Monte Carlo simulation of the project time -----

// Gamma(shape, 1) for shape >= 1 (Marsaglia and Tsang).
function gamma(shape, rand) {
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do {
      // Standard normal by Box–Muller.
      x = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// One random activity time from (a, m, b).
export function sampler(dist) {
  if (dist === "triangular") {
    return (a, m, b, rand) => {
      if (b - a < EPS) return a;
      const u = rand(), f = (m - a) / (b - a);
      return u < f ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m));
    };
  }
  if (dist === "uniform") return (a, m, b, rand) => a + (b - a) * rand();
  // Beta-PERT: the beta distribution PERT assumes, with mean (a + 4m + b) / 6.
  return (a, m, b, rand) => {
    if (b - a < EPS) return a;
    const al = 1 + 4 * (m - a) / (b - a), be = 1 + 4 * (b - m) / (b - a);
    const x = gamma(al, rand), y = gamma(be, rand);
    return a + (b - a) * x / (x + y);
  };
}

// Run `runs` random projects. Returns the project times (sorted), summary statistics and,
// for each activity, the share of runs in which it was critical.
export function simulate(acts, { runs = 10000, seed = 1, dist = "beta" } = {}) {
  const s = structure(acts);
  if (s.loop) return { ok: false };
  const rand = rng(seed), draw = sampler(dist);
  const times = new Float64Array(runs), critCount = new Array(acts.length).fill(0);
  const dur = new Array(acts.length);
  for (let r = 0; r < runs; r++) {
    for (let k = 0; k < acts.length; k++) dur[k] = draw(acts[k].a, acts[k].m, acts[k].b, rand);
    const { early, late, total } = passes(acts, s, dur);
    times[r] = total;
    for (let k = 0; k < acts.length; k++) {
      if (Math.abs(late.get(acts[k].end) - early.get(acts[k].start) - dur[k]) < 1e-7) critCount[k]++;
    }
  }
  const sorted = Array.from(times).sort((x, y) => x - y);
  const mean = sorted.reduce((a, b) => a + b, 0) / runs;
  const sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (runs - 1 || 1));
  const quantile = (q) => sorted[Math.min(runs - 1, Math.max(0, Math.ceil(q * runs) - 1))];
  return {
    ok: true, runs, seed, dist, times: sorted, mean, sd,
    min: sorted[0], max: sorted[runs - 1], quantile,
    probBy: (T) => { // share of runs finishing on or before T
      let lo = 0, hi = runs;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= T + 1e-9) lo = mid + 1; else hi = mid; }
      return lo / runs;
    },
    criticality: acts.map((x, k) => ({ id: x.id, share: critCount[k] / runs })),
  };
}

// Equal-width bins for a histogram.
export function histogram(sorted, bins = 30) {
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  if (hi - lo < EPS) return [{ from: lo, to: hi, count: sorted.length }];
  const w = (hi - lo) / bins, out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  for (const x of sorted) out[Math.min(bins - 1, Math.floor((x - lo) / w))].count++;
  return out;
}
