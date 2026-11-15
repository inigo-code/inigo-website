// Simple and compound interest: find the interest and amount, or the principal, rate or time.
import { h, block, scroller, resultTable, formula, answer, fmt, calcPage, need } from "./kit.js";
import * as A from "./lib/arith.js";

const m2 = (x) => fmt(x, 2);
const K = [["1", "Yearly"], ["2", "Half-yearly"], ["4", "Quarterly"], ["12", "Monthly"]];
const PERIOD = { 1: "Year", 2: "Half-year", 4: "Quarter", 12: "Month" };

const P = { k: "P", label: "Principal (P)" }, R = { k: "R", label: "Rate (% a year)", size: "w-s" }, T = { k: "T", label: "Time (years)", size: "w-s" };
const Am = { k: "A", label: "Amount (A)" }, I = (n) => ({ k: "I", label: `or the ${n} interest` });
const Kf = { k: "k", label: "Compounded", type: "select", options: K, size: "w-m" };

// "2 years 6 months", or "5.6782 years" when it is not a whole number of months.
function years(t) {
  const y = Math.floor(t + 1e-9), mo = (t - y) * 12, r = Math.round(mo);
  if (Math.abs(mo - r) < 1e-6) return [y ? `${y} year${y === 1 ? "" : "s"}` : "", r ? `${r} month${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "0 years";
  return `${fmt(t)} years (about ${y ? `${y} year${y === 1 ? "" : "s"} ` : ""}${fmt(mo, 1)} months)`;
}

// Read the amount or the interest, whichever was given (exactly one of them).
function amountOrInterest(v, x, errors, word) {
  const a = need(v, [["A", "the amount", "optional positive"], ["I", `the ${word} interest`, "optional positive"]]);
  errors.push(...a.errors);
  if (!a.errors.length) {
    if (a.x.A === null && a.x.I === null) errors.push(`Enter the amount or the ${word} interest.`);
    else if (a.x.A !== null && a.x.I !== null) errors.push(`Enter either the amount or the ${word} interest, not both.`);
  }
  x.A = a.x.A; x.I = a.x.I;
}

// ----- Simple interest -----

function simple(v, find) {
  const spec = [["P", "the principal", "positive"], ["R", "the rate", "positive"], ["T", "the time", "positive"]].filter(([k]) => k !== find);
  const { x, errors } = need(v, spec);
  if (find !== "SI") amountOrInterest(v, x, errors, "simple");
  if (!errors.length && find !== "P" && find !== "SI" && x.A !== null && x.A <= x.P) errors.push("The amount must be more than the principal.");
  if (errors.length) return { errors };
  const r = A.simpleInterest({ P: x.P ?? null, R: x.R ?? null, T: x.T ?? null, SI: find === "SI" ? null : x.I, A: find === "SI" ? null : x.A });
  const base = "SI = P × R × T / 100, and A = P + SI.";
  const lines = [];
  if (find !== "SI" && x.A !== null && find !== "P") lines.push(`SI = A − P = ${m2(x.A)} − ${m2(x.P)} = ${m2(r.SI)}`);
  if (find === "SI") lines.push(`SI = ${m2(r.P)} × ${fmt(r.R)} × ${fmt(r.T)} / 100 = ${m2(r.SI)}`, `A = ${m2(r.P)} + ${m2(r.SI)} = ${m2(r.A)}`);
  if (find === "P") lines.push(x.A !== null ? `A = P (1 + RT/100), so P = A / (1 + ${fmt(r.R)} × ${fmt(r.T)} / 100) = ${m2(x.A)} / ${fmt(1 + (r.R * r.T) / 100)} = ${m2(r.P)}` : `P = SI × 100 / (R × T) = ${m2(r.SI)} × 100 / (${fmt(r.R)} × ${fmt(r.T)}) = ${m2(r.P)}`);
  if (find === "R") lines.push(`R = SI × 100 / (P × T) = ${m2(r.SI)} × 100 / (${m2(r.P)} × ${fmt(r.T)}) = ${fmt(r.R)}%`);
  if (find === "T") lines.push(`T = SI × 100 / (P × R) = ${m2(r.SI)} × 100 / (${m2(r.P)} × ${fmt(r.R)}) = ${fmt(r.T)} years`);
  const big = { SI: ["Simple interest", m2(r.SI), `Amount ${m2(r.A)}`], P: ["Principal", m2(r.P), `Simple interest ${m2(r.SI)}, amount ${m2(r.A)}`], R: ["Rate of interest", `${fmt(r.R)}% a year`, `Simple interest ${m2(r.SI)}`], T: ["Time", years(r.T), `Simple interest ${m2(r.SI)}`] }[find];
  return [answer(big[0], big[1], h("p", {}, big[2] + ".")), block("Working", h("p", { class: "lab-hint" }, base), formula(...lines))];
}

// ----- Compound interest -----

function compound(v, find) {
  const spec = [["P", "the principal", "positive"], ["R", "the rate", "positive"], ["T", "the time", "positive"]].filter(([k]) => k !== find);
  const { x, errors } = need(v, spec);
  const k = Number(v.k) || 1;
  if (find !== "CI") amountOrInterest(v, x, errors, "compound");
  if (!errors.length && (find === "R" || find === "T") && x.A !== null && x.A <= x.P) errors.push("The amount must be more than the principal.");
  if (errors.length) return { errors };
  const r = A.compoundInterest({ P: x.P ?? null, R: x.R ?? null, T: x.T ?? null, k, A: find === "CI" ? null : x.A, CI: find === "CI" ? null : x.I });
  if (![r.P, r.R, r.T, r.A].every(Number.isFinite)) return { errors: ["These values do not give an answer; check them."] };
  const per = PERIOD[k].toLowerCase(), g = (1 + r.i) ** r.n;
  const lines = find === "R" ? [] : [`i = R / (100 × ${k}) = ${fmt(r.R)} / ${100 * k} = ${fmt(r.i, 6)} for each ${per}`];
  if (find !== "T") lines.push(`n = ${k} × T = ${k} × ${fmt(r.T)} = ${fmt(r.n)} ${per}s`);
  if (find !== "CI" && x.I !== null && find !== "P") lines.push(`A = P + CI = ${m2(x.P)} + ${m2(x.I)} = ${m2(r.A)}`);
  if (find === "CI") lines.push(`A = P (1 + i)^n = ${m2(r.P)} × (${fmt(1 + r.i, 6)})^${fmt(r.n)} = ${m2(r.P)} × ${fmt(g, 6)} = ${m2(r.A)}`, `CI = A − P = ${m2(r.A)} − ${m2(r.P)} = ${m2(r.CI)}`);
  if (find === "P") lines.push(x.A !== null ? `P = A / (1 + i)^n = ${m2(x.A)} / ${fmt(g, 6)} = ${m2(r.P)}` : `CI = P [(1 + i)^n − 1], so P = ${m2(x.I)} / (${fmt(g, 6)} − 1) = ${m2(r.P)}`);
  if (find === "R") lines.push(`(1 + i)^n = A / P = ${m2(r.A)} / ${m2(r.P)} = ${fmt(r.A / r.P, 6)}`, `1 + i = (${fmt(r.A / r.P, 6)})^(1/${fmt(r.n)}) = ${fmt(1 + r.i, 6)}`, `R = 100 × ${k} × i = ${fmt(r.R)}% a year`);
  if (find === "T") lines.push(`(1 + i)^n = A / P = ${fmt(r.A / r.P, 6)}`, `n = log(A / P) / log(1 + i) = ${fmt(Math.log10(r.A / r.P), 6)} / ${fmt(Math.log10(1 + r.i), 6)} = ${fmt(r.n)} ${per}s`, `T = n / ${k} = ${fmt(r.T)} years`);
  const big = { CI: ["Compound interest", m2(r.CI), `Amount ${m2(r.A)}`], P: ["Principal", m2(r.P), `Compound interest ${m2(r.CI)}, amount ${m2(r.A)}`], R: ["Rate of interest", `${fmt(r.R)}% a year`, `Compounded ${K.find((q) => +q[0] === k)[1].toLowerCase()}`], T: ["Time", years(r.T), `Compounded ${K.find((q) => +q[0] === k)[1].toLowerCase()}`] }[find];
  const blocks = [answer(big[0], big[1], h("p", {}, big[2] + ".")), block("Working", h("p", { class: "lab-hint" }, "A = P (1 + i)^n, where i is the rate for one period and n the number of periods; CI = A − P."), formula(...lines))];
  const more = [`Simple interest on the same principal, rate and time = ${m2(r.P)} × ${fmt(r.R)} × ${fmt(r.T)} / 100 = ${m2(r.SI)}, so CI − SI = ${m2(r.diff)}.`];
  if (k > 1) more.push(`Effective annual rate = [(1 + i)^${k} − 1] × 100 = ${fmt(r.effective)}%, against ${fmt(r.R)}% compounded yearly.`);
  blocks.push(block("Compared with simple interest", formula(...more)));
  if (r.rows.length) blocks.push(block(`${PERIOD[k]} by ${per}`, scroller(resultTable([PERIOD[k], "Opening balance", "Interest", "Closing balance"], r.rows.map((q) => [String(q.t), m2(q.open), m2(q.interest), m2(q.close)])), "Table")));
  return blocks;
}

const MODES = {
  si: { label: "Simple interest and amount", hint: "Enter the principal, the rate a year and the time in years (6 months is 0.5).", fields: [P, R, T], example: { P: "12000", R: "8", T: "3" }, solve: (v) => simple(v, "SI") },
  "si-p": { label: "Simple interest: find the principal", hint: "Enter the rate and time, and either the amount or the interest.", fields: [[R, T], [Am, I("simple")]], example: { R: "6", T: "4", A: "12400", I: "" }, solve: (v) => simple(v, "P") },
  "si-r": { label: "Simple interest: find the rate", hint: "Enter the principal and time, and either the amount or the interest.", fields: [[P, T], [Am, I("simple")]], example: { P: "5000", T: "3", A: "6200", I: "" }, solve: (v) => simple(v, "R") },
  "si-t": { label: "Simple interest: find the time", hint: "Enter the principal and rate, and either the amount or the interest.", fields: [[P, R], [Am, I("simple")]], example: { P: "8000", R: "7.5", A: "", I: "1500" }, solve: (v) => simple(v, "T") },
  ci: { label: "Compound interest and amount", hint: "Enter the principal, the rate a year, the time in years and how often interest is added.", fields: [[P, R, T], [Kf]], example: { P: "10000", R: "10", T: "2", k: "2" }, solve: (v) => compound(v, "CI") },
  "ci-p": { label: "Compound interest: find the principal", hint: "Enter the rate, time and compounding, and either the amount or the interest.", fields: [[R, T, Kf], [Am, I("compound")]], example: { R: "8", T: "2", k: "1", A: "11664", I: "" }, solve: (v) => compound(v, "P") },
  "ci-r": { label: "Compound interest: find the rate", hint: "Enter the principal, time and compounding, and either the amount or the interest.", fields: [[P, T, Kf], [Am, I("compound")]], example: { P: "5000", T: "2", k: "1", A: "5832", I: "" }, solve: (v) => compound(v, "R") },
  "ci-t": { label: "Compound interest: find the time", hint: "Enter the principal, rate and compounding, and either the amount or the interest.", fields: [[P, R, Kf], [Am, I("compound")]], example: { P: "4000", R: "10", k: "1", A: "5324", I: "" }, solve: (v) => compound(v, "T") },
};

calcPage(MODES, { runLabel: "Work it out" }).boot();
