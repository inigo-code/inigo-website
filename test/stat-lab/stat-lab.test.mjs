// Stats Lab: every model checked against examples worked by hand (textbook figures where they are
// standard), plus random checks of the algebra.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng } from "../../src/assets/or-lab/lib/num.js";
import { F } from "../../src/assets/stat-lab/lib/frac.js";
import * as M from "../../src/assets/stat-lab/lib/matrix.js";
import * as S from "../../src/assets/stat-lab/lib/stats.js";
import * as C from "../../src/assets/stat-lab/lib/correlation.js";
import * as T from "../../src/assets/stat-lab/lib/timeseries.js";
import * as A from "../../src/assets/stat-lab/lib/arith.js";
import * as P from "../../src/assets/stat-lab/lib/counting.js";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const mat = (rows) => rows.map((r) => r.map((v) => F.parse(String(v))));
const str = (A) => A.map((r) => r.map(String));

// ---------- Fractions ----------

test("fractions read decimals, fractions and signs exactly", () => {
  assert.equal(String(F.parse("0.25")), "1/4");
  assert.equal(String(F.parse("−3/6")), "−1/2");
  assert.equal(String(F.parse("1,200")), "1200");
  assert.equal(String(F.parse("2.5e2")), "250");
  assert.equal(F.parse("abc"), null);
  assert.equal(F.parse("1/0"), null);
  assert.equal(String(F.parse("1/3").add("1/6")), "1/2");
  assert.equal(F.parse("3/7").approx().text, "0.4286");
});

// ---------- Unit I: matrices ----------

test("2 × 2: determinant, adjoint and inverse", () => {
  const A = mat([[1, 2], [3, 4]]);
  assert.equal(String(M.det(A)), "−2");
  assert.deepEqual(str(M.adjoint(A)), [["4", "−2"], ["−3", "1"]]);
  assert.deepEqual(str(M.inverse(A).inv), [["−2", "1"], ["3/2", "−1/2"]]);
});

test("3 × 3: determinant 4 and inverse with quarters", () => {
  const A = mat([[2, 1, 1], [1, 2, 1], [1, 1, 2]]);
  assert.equal(String(M.det(A)), "4");
  assert.deepEqual(str(M.inverse(A).inv), [["3/4", "−1/4", "−1/4"], ["−1/4", "3/4", "−1/4"], ["−1/4", "−1/4", "3/4"]]);
  assert.ok(M.equal(M.multiply(A, M.inverse(A).inv).result, M.identity(3)));
  assert.equal(M.inverse(mat([[1, 2], [2, 4]])).singular, true);
});

test("addition and multiplication check the orders", () => {
  assert.ok(M.add(mat([[1, 2]]), mat([[1], [2]])).error);
  assert.ok(M.multiply(mat([[1, 2]]), mat([[1, 2]])).error);
  const p = M.multiply(mat([[1, 2, 3]]), mat([[4], [5], [6]]));
  assert.equal(String(p.result[0][0]), "32");
  assert.equal(p.work[0][0].terms.length, 3);
});

test("random matrices: A·A⁻¹ = I, |AB| = |A||B|, (AB)ᵀ = BᵀAᵀ", () => {
  const r = rng(5);
  const rand = (n) => Array.from({ length: n }, () => Array.from({ length: n }, () => new F(BigInt(Math.floor(r() * 19) - 9))));
  for (let t = 0; t < 300; t++) {
    const n = 1 + (t % 4), X = rand(n), Y = rand(n);
    const inv = M.inverse(X);
    if (!inv.singular) assert.ok(M.equal(M.multiply(X, inv.inv).result, M.identity(n)));
    const XY = M.multiply(X, Y).result;
    assert.ok(M.det(XY).eq(M.det(X).mul(M.det(Y))));
    assert.ok(M.equal(M.transpose(XY), M.multiply(M.transpose(Y), M.transpose(X)).result));
  }
});

test("Cramer's rule: x + y + z = 6, 2x − y + z = 3, x + 2y − z = 2 gives 1, 2, 3", () => {
  const res = M.cramer(mat([[1, 1, 1], [2, -1, 1], [1, 2, -1]]), [6, 3, 2].map((v) => new F(BigInt(v))));
  assert.equal(res.unique, true);
  assert.deepEqual(res.solution.map(String), ["1", "2", "3"]);
  assert.equal(String(res.D), "7"); // 1(1 − 2) − 1(−2 − 1) + 1(4 + 1)
  const bad = M.cramer(mat([[1, 1], [2, 2]]), [new F(2n), new F(5n)]);
  assert.equal(bad.unique, false);
  assert.equal(bad.inconsistent, true);
});

// ---------- Unit III: central tendency and dispersion ----------

test("individual series: odd and even counts, Gupta's interpolation", () => {
  const a = S.individual([5, 7, 9, 10, 12, 15, 20]);
  near(a.mean, 78 / 7);
  assert.equal(a.median, 10);
  assert.equal(a.q1, 7);
  assert.equal(a.q3, 15);
  assert.equal(a.qd, 4);
  assert.equal(a.mode.none, true);
  const b = S.individual([8, 2, 6, 4]);
  assert.equal(b.median, 5);
  assert.equal(b.q1, 2.5);
  assert.equal(b.q3, 7.5);
});

test("individual series: standard deviation 2 and CV 40% for 2, 4, 4, 4, 5, 5, 7, 9", () => {
  const r = S.individual([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(r.mean, 5);
  assert.equal(r.sd, 2);
  assert.equal(r.cv, 40);
  assert.equal(r.mode.value, 4);
  assert.equal(r.range, 7);
  near(r.mdMean, 1.5);
});

test("discrete series: mean, median and quartiles from cumulative frequencies", () => {
  const r = S.discrete([1, 2, 3, 4, 5].map((x, i) => ({ x, f: [2, 3, 5, 4, 1][i] })));
  assert.equal(r.n, 15);
  near(r.mean, 44 / 15);
  assert.equal(r.median, 3);
  assert.equal(r.q1, 2);
  assert.equal(r.q3, 4);
  assert.equal(r.mode.value, 3);
});

test("continuous series: 0–10 … 40–50 with f 5, 8, 12, 10, 5", () => {
  const rows = [[0, 10, 5], [10, 20, 8], [20, 30, 12], [30, 40, 10], [40, 50, 5]].map(([lo, hi, f]) => ({ lo, hi, f }));
  assert.deepEqual(S.validateContinuous(rows).errors, []);
  const r = S.continuous(rows);
  assert.equal(r.mean, 25.5);
  near(r.median, 20 + (7 / 12) * 10);
  near(r.modeValue, 20 + (4 / 6) * 10);
  assert.equal(r.q1, 16.25);
  assert.equal(r.q3, 35);
  assert.equal(r.qd, 9.375);
  near(r.sd, Math.sqrt(144.75));
  assert.equal(r.step.sumFd, 2);
  assert.equal(r.step.sumFd2, 58);
  near(10 * Math.sqrt(58 / 40 - (2 / 40) ** 2), r.sd);
});

test("inclusive classes 10–19, 20–29 become 9.5–19.5, 19.5–29.5", () => {
  const r = S.continuous([{ lo: 10, hi: 19, f: 3 }, { lo: 20, hi: 29, f: 5 }, { lo: 30, hi: 39, f: 2 }]);
  assert.equal(r.adjusted, true);
  assert.deepEqual(r.rows.map((x) => [x.lo, x.hi]), [[9.5, 19.5], [19.5, 29.5], [29.5, 39.5]]);
  assert.ok(S.validateContinuous([{ lo: 0, hi: 10, f: 1 }, { lo: 5, hi: 15, f: 1 }]).errors.length);
});

test("random data: the three series agree with each other and with a direct calculation", () => {
  const r = rng(8);
  for (let t = 0; t < 400; t++) {
    const xs = Array.from({ length: 3 + Math.floor(r() * 30) }, () => Math.floor(r() * 50));
    const ind = S.individual(xs);
    const counts = new Map();
    for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
    const dis = S.discrete([...counts].map(([x, f]) => ({ x, f })));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    near(ind.mean, mean); near(dis.mean, mean);
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
    near(ind.sd, sd); near(dis.sd, sd);
    assert.ok(ind.q1 <= ind.median && ind.median <= ind.q3);
    assert.ok(dis.q1 <= dis.median && dis.median <= dis.q3);
  }
});

// ---------- Unit IV: correlation and regression ----------

test("Karl Pearson and both regression lines for X 1–5, Y 2, 4, 5, 4, 5", () => {
  const X = [1, 2, 3, 4, 5], Y = [2, 4, 5, 4, 5];
  const p = C.pearson(X, Y);
  assert.equal(p.Sxy, 6);
  assert.equal(p.Sxx, 10);
  assert.equal(p.Syy, 6);
  near(p.r, 6 / Math.sqrt(60));
  const g = C.regression(X, Y);
  assert.equal(g.byx, 0.6);
  assert.equal(g.bxy, 1);
  assert.equal(g.a, 2.2);
  assert.equal(g.c, -1);
  near(g.check, p.r);
  assert.equal(g.yAt(10), 8.2);
});

test("Spearman: perfect reversal is −1, and the tie correction", () => {
  assert.equal(C.spearman([10, 20, 30, 40, 50], [50, 40, 30, 20, 10]).R, -1);
  const s = C.spearman([10, 20, 20, 30], [1, 2, 3, 4]);
  assert.equal(s.sumD2, 0.5);
  assert.equal(s.CF, 0.5);
  assert.equal(s.R, 0.9);
  assert.deepEqual(C.rank([30, 20, 20, 10]).ranks, [1, 2.5, 2.5, 4]);
});

test("Spearman without ties equals Pearson on the ranks", () => {
  const r = rng(4);
  for (let t = 0; t < 200; t++) {
    const n = 4 + Math.floor(r() * 10);
    const perm = (k) => { const a = Array.from({ length: k }, (_, i) => i + 1); for (let i = k - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const X = perm(n), Y = perm(n);
    near(C.spearman(X, Y).R, C.pearson(X, Y).r, 1e-9);
  }
});

test("regression from summary figures", () => {
  const g = C.fromSummary({ mx: 20, my: 30, sx: 4, sy: 6, r: 0.5 });
  assert.equal(g.byx, 0.75);
  near(g.bxy, 1 / 3);
  assert.equal(g.a, 15);
  assert.equal(g.yAt(24), 33);
  assert.ok(C.validateSummary({ mx: 1, my: 1, sx: 1, sy: 1, r: 1.2 }).length);
});

// ---------- Unit V: time series and index numbers ----------

test("semi-averages: even and odd numbers of years", () => {
  const t = [2018, 2019, 2020, 2021, 2022, 2023];
  const r = T.semiAverage(t, [10, 12, 14, 16, 18, 20]);
  assert.equal(r.A.avg, 12);
  assert.equal(r.B.avg, 18);
  assert.equal(r.slope, 2);
  assert.deepEqual(r.trend, [10, 12, 14, 16, 18, 20]);
  const o = T.semiAverage([1, 2, 3, 4, 5], [4, 6, 100, 8, 10]);
  assert.equal(o.odd, true);
  assert.equal(o.left.y, 100);
  assert.equal(o.A.avg, 5);
  assert.equal(o.B.avg, 9);
});

test("moving averages: odd period and centred even period", () => {
  const m3 = T.movingAverage([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], 3);
  assert.deepEqual(m3.rows.map((r) => r.trend ?? null), [null, 4, 6, 8, null]);
  const y = [1, 2, 3, 4, 5, 6, 7, 8];
  const m4 = T.movingAverage(y, y, 4);
  assert.deepEqual(m4.totals, [10, 14, 18, 22, 26]);
  assert.deepEqual(m4.rows.map((r) => r.trend ?? null), [null, null, 3, 4, 5, 6, null, null]);
  assert.ok(T.validateSeries([2020, 2021, 2023, 2024], [1, 2, 3, 4]).length);
});

test("Laspeyres 125, Paasche 126.21 and Fisher 125.6, with both reversal tests", () => {
  const items = [[2, 8, 4, 6], [5, 10, 6, 5], [4, 14, 5, 10], [2, 19, 2, 13]].map(([p0, q0, p1, q1]) => ({ p0, q0, p1, q1 }));
  const r = T.indexNumbers(items);
  assert.deepEqual(r.T, { p1q0: 200, p0q0: 160, p1q1: 130, p0q1: 103 });
  assert.equal(r.L, 125);
  near(r.P, 12621.359223 / 100, 1e-8);
  near(r.F, Math.sqrt(125 * (13000 / 103)), 1e-9);
  assert.equal(r.trt.holds, true);
  assert.equal(r.frt.holds, true);
});

// ---------- Unit II: percentages, interest, speed, work ----------

test("simple interest, and finding the rate", () => {
  assert.deepEqual(A.simpleInterest({ P: 5000, R: 8, T: 3 }), { P: 5000, R: 8, T: 3, SI: 1200, A: 6200 });
  assert.equal(A.simpleInterest({ P: 5000, T: 3, SI: 1200 }).R, 8);
  assert.equal(A.simpleInterest({ R: 8, T: 3, A: 6200 }).P, 5000);
  assert.equal(A.simpleInterest({ P: 5000, R: 8, A: 6200 }).T, 3);
});

test("compound interest: yearly and half-yearly, and CI − SI", () => {
  const y = A.compoundInterest({ P: 10000, R: 10, T: 2 });
  assert.equal(y.A, 12100);
  assert.equal(y.CI, 2100);
  assert.equal(y.diff, 100);
  assert.equal(y.rows.length, 2);
  assert.equal(A.compoundInterest({ P: 10000, R: 10, T: 2, k: 2 }).A, 12155.0625);
  near(A.compoundInterest({ P: 10000, T: 2, A: 12100 }).R, 10);
  near(A.compoundInterest({ P: 10000, R: 10, A: 12100 }).T, 2);
  near(A.compoundInterest({ R: 10, T: 2, CI: 2100 }).P, 10000);
});

test("percentages, profit and loss, discounts and ratios", () => {
  assert.equal(A.percentOf(15, 200), 30);
  assert.equal(A.whatPercent(30, 200), 15);
  assert.deepEqual(A.change(80, 100), { diff: 20, pct: 25 });
  assert.equal(A.successive([20, -20]).net, -4);
  assert.deepEqual(A.profitLoss(400, 500), { kind: "profit", amount: 100, pct: 25 });
  assert.deepEqual(A.profitLoss(500, 400), { kind: "loss", amount: 100, pct: 20 });
  assert.equal(A.spFromProfit(400, 25), 500);
  assert.equal(A.cpFromSp(500, 25), 400);
  assert.equal(A.equivalentDiscount([10, 20]), 28);
  assert.equal(A.markedFor(100, 20, 20), 150);
  assert.deepEqual(A.divide(1200, [2, 3, 5]).shares, [240, 360, 600]);
  assert.equal(A.fourthProportional(2, 3, 4), 6);
  assert.equal(A.meanProportional(4, 9), 6);
  assert.deepEqual(A.simplify([0.5, 1.25]), [2, 5]);
});

test("speed, trains and work", () => {
  assert.equal(A.kmphToMps(54), 15);
  assert.equal(A.averageSpeed([{ d: 60, v: 40 }, { d: 60, v: 60 }]).avg, 48);
  assert.equal(A.crossing({ L1: 120, L2: 80, v1: 54, v2: 36 }).time, 8);
  assert.equal(A.crossing({ L1: 120, L2: 80, v1: 54, v2: 36, same: true }).time, 40);
  assert.equal(A.together([10, 15]).time, 6);
  assert.equal(A.together([4, -6]).time, 12);
  assert.equal(A.menDays({ M1: 10, D1: 12, H1: 1, W1: 1, M2: 15, D2: null, H2: 1, W2: 1 }).values.D2, 8);
  assert.equal(A.menDays({ M1: 10, D1: 12, H1: 8, W1: 1, M2: null, D2: 10, H2: 6, W2: 2 }).values.M2, 32);
});

// ---------- Unit II: permutations, combinations, probability ----------

test("permutations, combinations and words with repeated letters", () => {
  assert.equal(P.nPr(5, 3), 60n);
  assert.equal(P.nCr(5, 3), 10n);
  assert.equal(P.nCr(52, 5), 2598960n);
  assert.equal(P.factorial(10), 3628800n);
  assert.equal(P.wordArrangements("MISSISSIPPI").total, 34650n);
  for (let n = 0; n <= 30; n++) for (let r = 0; r <= n; r++) assert.equal(P.nCr(n, r), P.factorial(n) / (P.factorial(r) * P.factorial(n - r)));
});

test("dice, coins, a bag of balls and cards", () => {
  assert.equal(String(P.diceEvent(2, (s) => s === 7).p), "1/6");
  assert.equal(String(P.diceEvent(2, (s) => s >= 10).p), "1/6");
  assert.equal(String(P.coins(3, 2).p), "3/8");
  assert.equal(String(P.bag([5, 3], [2, 0]).p), "5/14");
  assert.equal(String(P.bag([4, 5, 6], [1, 1, 1]).p), "24/91");
  assert.equal(String(P.cards(4, 2, 2).p), "1/221");
  assert.equal(String(P.cards(26, 1, 1).p), "1/2");
});
