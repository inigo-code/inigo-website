// Unit II arithmetic: interest, percentages, profit and loss, ratios, speed and work.
// Every function returns the answer and the numbers needed to show the working.

import { clean } from "../../or-lab/lib/num.js";

// ----- Simple interest: SI = P × R × T / 100, A = P + SI -----

// Give any three of P, R, T and either SI or A (the missing one is null).
export function simpleInterest({ P = null, R = null, T = null, SI = null, A = null }) {
  if (SI === null && A !== null && P !== null) SI = clean(A - P);
  if (P === null) {
    if (SI !== null) P = clean((SI * 100) / (R * T));
    else P = clean(A / (1 + (R * T) / 100)); // A = P (1 + RT/100)
  } else if (R === null) R = clean((SI * 100) / (P * T));
  else if (T === null) T = clean((SI * 100) / (P * R));
  if (SI === null) SI = clean((P * R * T) / 100);
  if (A === null) A = clean(P + SI);
  return { P, R, T, SI, A };
}

// ----- Compound interest: A = P (1 + R / (100 k))^(k T), CI = A − P -----
// k = times compounded a year (1 yearly, 2 half-yearly, 4 quarterly, 12 monthly).

export function compoundInterest({ P = null, R = null, T = null, k = 1, A = null, CI = null }) {
  if (A === null && CI !== null && P !== null) A = clean(P + CI);
  let n, i;
  if (P === null) {
    i = R / (100 * k); n = k * T;
    const g = (1 + i) ** n;
    P = A !== null ? clean(A / g) : clean(CI / (g - 1));
  } else if (R === null) {
    n = k * T;
    R = clean(100 * k * ((A / P) ** (1 / n) - 1));
  } else if (T === null) {
    i = R / (100 * k);
    T = clean(Math.log(A / P) / (k * Math.log(1 + i)));
  }
  i = R / (100 * k); n = k * T;
  if (A === null) A = clean(P * (1 + i) ** n);
  CI = clean(A - P);
  const SI = clean((P * R * T) / 100);
  const rows = [];
  if (Number.isInteger(clean(n)) && n <= 120) {
    let bal = P;
    for (let t = 1; t <= n; t++) { const int = bal * i; rows.push({ t, open: clean(bal), interest: clean(int), close: clean(bal + int) }); bal += int; }
  }
  return { P, R, T, k, i: clean(i), n: clean(n), A, CI, SI, diff: clean(CI - SI), effective: clean(((1 + i) ** k - 1) * 100), rows };
}

// ----- Percentages -----

export const percentOf = (x, y) => clean((x / 100) * y);            // x% of y
export const whatPercent = (x, y) => clean((x / y) * 100);          // x is what % of y
export const change = (a, b) => ({ diff: clean(b - a), pct: clean(((b - a) / a) * 100) }); // from a to b
// Successive changes of a% and b% give a net change of a + b + ab/100 (applied in turn for more).
export function successive(pcts) {
  let factor = 1;
  const steps = pcts.map((p) => { factor *= 1 + p / 100; return clean((factor - 1) * 100); });
  return { net: clean((factor - 1) * 100), steps, factor: clean(factor) };
}

// ----- Profit and loss (profit % is on cost price) -----

export function profitLoss(cp, sp) {
  const d = clean(sp - cp);
  return { kind: d > 0 ? "profit" : d < 0 ? "loss" : "none", amount: Math.abs(d), pct: clean((Math.abs(d) / cp) * 100) };
}
export const spFromProfit = (cp, pct) => clean((cp * (100 + pct)) / 100);   // pct < 0 for a loss
export const cpFromSp = (sp, pct) => clean((sp * 100) / (100 + pct));
export const afterDiscount = (mp, d) => clean((mp * (100 - d)) / 100);
// Successive discounts d1, d2 … equal one discount of 100 − 100 × Π(1 − d/100).
export function equivalentDiscount(ds) {
  const f = ds.reduce((s, d) => s * (1 - d / 100), 1);
  return clean(100 - 100 * f);
}
// Marked price needed to make pct profit after allowing a discount d.
export const markedFor = (cp, pct, d) => clean((cp * (100 + pct)) / (100 - d));

// ----- Ratios and proportion -----

export function divide(amount, parts) {
  const total = parts.reduce((s, p) => s + p, 0);
  return { total: clean(total), shares: parts.map((p) => clean((amount * p) / total)) };
}
export const fourthProportional = (a, b, c) => clean((b * c) / a); // a : b = c : x
export const thirdProportional = (a, b) => clean((b * b) / a);     // a : b = b : x
export const meanProportional = (a, b) => clean(Math.sqrt(a * b)); // a : x = x : b
// a : b in lowest terms (works for decimals by scaling to whole numbers first).
export function simplify(parts) {
  const dp = Math.max(...parts.map((p) => (String(p).split(".")[1] || "").length));
  const ints = parts.map((p) => Math.round(p * 10 ** dp));
  const g = ints.reduce((a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; });
  return ints.map((v) => (g ? v / g : v));
}

// ----- Time, speed and distance -----

export const kmphToMps = (v) => clean((v * 5) / 18);
export const mpsToKmph = (v) => clean((v * 18) / 5);
// Average speed over several legs = total distance ÷ total time.
export function averageSpeed(legs) { // [{ d, v }]
  const D = legs.reduce((s, l) => s + l.d, 0), T = legs.reduce((s, l) => s + l.d / l.v, 0);
  return { D: clean(D), T: clean(T), avg: clean(D / T), times: legs.map((l) => clean(l.d / l.v)) };
}
// Two trains (or a train and a platform): time to pass = total length ÷ relative speed.
export function crossing({ L1, L2 = 0, v1, v2 = 0, same = false }) {
  const rel = same ? Math.abs(v1 - v2) : v1 + v2; // km/h
  const relMps = kmphToMps(rel);
  return { rel: clean(rel), relMps, length: clean(L1 + L2), time: relMps > 0 ? clean((L1 + L2) / relMps) : Infinity };
}

// ----- Time and work -----

// Workers (or pipes) that finish the job alone in d days; a negative d empties (a leaking pipe).
export function together(days) {
  const rates = days.map((d) => 1 / d);
  const rate = rates.reduce((s, r) => s + r, 0);
  return { rates, rate, time: rate > 0 ? clean(1 / rate) : Infinity };
}
// M1 D1 H1 / W1 = M2 D2 H2 / W2: give everything except one value (null).
export function menDays(v) {
  const k = ["M1", "D1", "H1", "W1", "M2", "D2", "H2", "W2"];
  const miss = k.filter((x) => v[x] === null || v[x] === undefined);
  if (miss.length !== 1) return { error: "Leave exactly one box empty: the value to find." };
  const x = miss[0], o = { ...v };
  const L = (o.M1 ?? 1) * (o.D1 ?? 1) * (o.H1 ?? 1), R = (o.M2 ?? 1) * (o.D2 ?? 1) * (o.H2 ?? 1);
  // M1D1H1 × W2 = M2D2H2 × W1
  if (x === "W1") o.W1 = clean((L * o.W2) / R);
  else if (x === "W2") o.W2 = clean((R * o.W1) / L);
  else if (x.endsWith("1")) o[x] = clean((R * o.W1) / (o.W2 * (L / (v[x] ?? 1))));
  else o[x] = clean((L * o.W2) / (o.W1 * (R / (v[x] ?? 1))));
  return { find: x, values: o };
}
