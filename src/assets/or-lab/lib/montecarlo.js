// Monte Carlo simulation as taught with random-number tables: give each value a range of random
// numbers in proportion to its probability, then read off one value per random number.

import { EPS, clean, rng } from "./num.js";

// dist = [{ value, p }] where p may be a probability or a frequency.
// Returns the probabilities, cumulative probabilities and random-number ranges (00–99, or 000–999 ...).
export function ranges(dist) {
  const errors = [];
  if (dist.length < 1) errors.push("Add at least one value.");
  dist.forEach((d, k) => {
    if (!Number.isFinite(d.value)) errors.push(`Row ${k + 1}: enter a value.`);
    if (!Number.isFinite(d.p) || d.p < 0) errors.push(`Row ${k + 1}: enter a probability or frequency that is not negative.`);
  });
  if (errors.length) return { errors };
  const total = dist.reduce((s, d) => s + d.p, 0);
  if (total <= 0) return { errors: ["The probabilities (or frequencies) must add up to more than zero."] };
  const isProb = Math.abs(total - 1) < 1e-6;
  if (!isProb && dist.every((d) => d.p <= 1)) return { errors: [`The probabilities add up to ${clean(total)}, not 1. Check them, or enter frequencies instead.`] };
  const probs = dist.map((d) => d.p / total);
  // Use as many digits as the probabilities need: 2 digits for 0.25, 3 for 0.125, up to 4.
  let digits = 0;
  for (const dg of [2, 3, 4]) if (probs.every((p) => Math.abs(p * 10 ** dg - Math.round(p * 10 ** dg)) < 1e-6)) { digits = dg; break; }
  if (!digits) return { errors: [`The probabilities (${probs.map((p) => clean(Number(p.toFixed(6)))).join(", ")}) cannot be written with 2, 3 or 4 decimal places, so random-number ranges cannot be given exactly. Round them first.`] };
  const scale = 10 ** digits;
  let cum = 0;
  const rows = dist.map((d, k) => {
    const lo = Math.round(cum * scale);
    cum += probs[k];
    const hi = Math.round(cum * scale) - 1;
    return { value: d.value, freq: isProb ? null : d.p, p: clean(probs[k]), cum: clean(cum), lo, hi, empty: hi < lo };
  });
  return { errors: [], rows, digits, scale, fromFrequencies: !isProb, mean: clean(rows.reduce((s, r) => s + r.value * r.p, 0)) };
}

export const pad = (n, digits) => String(n).padStart(digits, "0");
export const rangeText = (r, digits) => (r.empty ? "–" : `${pad(r.lo, digits)}–${pad(r.hi, digits)}`);

export function lookup(table, rn) {
  return table.rows.find((r) => !r.empty && rn >= r.lo && rn <= r.hi);
}

// Read a list of random numbers typed by the student ("48 78 19 51" or "48, 78, 19").
export function parseRandoms(text, digits) {
  const parts = String(text || "").split(/[\s,;]+/).filter(Boolean);
  const nums = [], errors = [];
  const top = 10 ** digits - 1;
  parts.forEach((t) => {
    if (!/^\d+$/.test(t)) errors.push(`"${t}" is not a whole number.`);
    else if (Number(t) > top) errors.push(`${t} has more than ${digits} digits. With these probabilities each random number must be between ${pad(0, digits)} and ${top}.`);
    else nums.push(Number(t));
  });
  return { nums, errors };
}

export function randomNumbers(count, digits, seed) {
  const r = rng(seed), scale = 10 ** digits;
  return Array.from({ length: count }, () => Math.floor(r() * scale));
}

// One variable: simulate `rns.length` trials.
export function simulateOne(table, rns) {
  const trials = rns.map((rn, k) => ({ trial: k + 1, rn, value: lookup(table, rn).value }));
  const total = clean(trials.reduce((s, t) => s + t.value, 0));
  return { trials, total, average: trials.length ? clean(total / trials.length) : 0 };
}

// Single-server queue with given distributions of time between arrivals and service time.
// The first customer arrives after the first time between arrivals (the clock starts at 0).
export function simulateQueue(arrTable, srvTable, arrRns, srvRns) {
  const n = Math.min(arrRns.length, srvRns.length);
  const rows = [];
  let clock = 0, freeAt = 0;
  for (let k = 0; k < n; k++) {
    const gap = lookup(arrTable, arrRns[k]).value, service = lookup(srvTable, srvRns[k]).value;
    clock = clean(clock + gap);
    const start = Math.max(clock, freeAt), end = clean(start + service);
    rows.push({ customer: k + 1, arrRn: arrRns[k], gap, arrival: clock, srvRn: srvRns[k], service, start, end, wait: clean(start - clock), idle: clean(start - freeAt), inSystem: clean(end - clock) });
    freeAt = end;
  }
  const sum = (f) => clean(rows.reduce((s, r) => s + r[f], 0));
  const totalWait = sum("wait"), totalIdle = sum("idle"), totalService = sum("service");
  const span = rows.length ? rows[rows.length - 1].end : 0;
  return {
    rows, totalWait, totalIdle, totalService, span,
    avgWait: n ? clean(totalWait / n) : 0,
    avgInSystem: n ? clean(sum("inSystem") / n) : 0,
    waited: rows.filter((r) => r.wait > EPS).length,
    idleShare: span > 0 ? clean(totalIdle / span) : 0,
  };
}
