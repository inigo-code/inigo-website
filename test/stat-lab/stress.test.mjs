// Stats Lab stress tests: thousands of random problems, each checked against a method that shares
// no code with the tool (Gaussian elimination for determinants, direct formulas for the measures,
// expanded lists for frequency series, exact identities for counting and probability).
// Set STRESS=20 (or any multiplier) for a longer run.
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

const K = Number(process.env.STRESS || 1);
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ok = (a, b, msg, tol) => assert.ok(close(a, b, tol), `${msg}: ${a} vs ${b}`);
const R = (seed) => {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  return { r, int, pick: (arr) => arr[int(0, arr.length - 1)] };
};
const sum = (a) => a.reduce((s, v) => s + v, 0);

// ---------- Matrices: determinant by Gaussian elimination, exact ----------

function gaussDet(A) {
  const m = A.map((r) => r.slice()), n = m.length;
  let d = new F(1n);
  for (let c = 0; c < n; c++) {
    const p = m.findIndex((r, i) => i >= c && !r[c].isZero());
    if (p < 0) return new F(0n);
    if (p !== c) { [m[p], m[c]] = [m[c], m[p]]; d = d.neg(); }
    d = d.mul(m[c][c]);
    for (let i = c + 1; i < n; i++) {
      const f = m[i][c].div(m[c][c]);
      m[i] = m[i].map((v, j) => v.sub(f.mul(m[c][j])));
    }
  }
  return d;
}
const randMat = (g, n, cols = n) => Array.from({ length: n }, () => Array.from({ length: cols }, () => (g.r() < 0.15 ? new F(BigInt(g.int(-9, 9)), BigInt(g.int(1, 6))) : new F(BigInt(g.int(-9, 9))))));

test("matrices: determinant, adjoint and inverse agree with elimination and A × A⁻¹ = I", () => {
  for (let s = 1; s <= 1500 * K; s++) {
    const g = R(s), n = g.int(1, 4), A = randMat(g, n);
    if (g.r() < 0.15 && n > 1) A[n - 1] = A[0].map((v, j) => v.add(A[1 % n][j])); // a singular one now and then
    const d = M.det(A);
    assert.ok(d.eq(gaussDet(A)), `det, seed ${s}`);
    assert.ok(M.det(M.transpose(A)).eq(d), `det of transpose, seed ${s}`);
    const adjA = M.multiply(M.adjoint(A), A).result;
    assert.ok(M.equal(adjA, M.identity(n).map((r) => r.map((v) => v.mul(d)))), `adj(A) A = |A| I, seed ${s}`);
    const inv = M.inverse(A);
    if (d.isZero()) assert.ok(inv.singular, `singular, seed ${s}`);
    else {
      assert.ok(M.equal(M.multiply(A, inv.inv).result, M.identity(n)), `A A⁻¹, seed ${s}`);
      assert.ok(M.equal(M.multiply(inv.inv, A).result, M.identity(n)), `A⁻¹ A, seed ${s}`);
    }
    const B = randMat(g, n);
    assert.ok(M.det(M.multiply(A, B).result).eq(d.mul(M.det(B))), `|AB| = |A||B|, seed ${s}`);
  }
});

test("matrices: multiplying non-square matrices matches the row-by-column definition", () => {
  for (let s = 1; s <= 500 * K; s++) {
    const g = R(s), m = g.int(1, 4), k = g.int(1, 4), n = g.int(1, 4);
    const A = randMat(g, m, k), B = randMat(g, k, n), AB = M.multiply(A, B).result;
    assert.deepEqual([AB.length, AB[0].length], [m, n]);
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      let v = new F(0n);
      for (let t = 0; t < k; t++) v = v.add(A[i][t].mul(B[t][j]));
      assert.ok(AB[i][j].eq(v), `seed ${s}`);
    }
  }
});

test("Cramer's rule: recovers a planted solution; Δ = 0 is told apart correctly", () => {
  for (let s = 1; s <= 1500 * K; s++) {
    const g = R(s), n = g.int(2, 3), A = randMat(g, n), x = Array.from({ length: n }, () => new F(BigInt(g.int(-12, 12)), BigInt(g.int(1, 4))));
    const b = A.map((r) => r.reduce((t, v, j) => t.add(v.mul(x[j])), new F(0n)));
    const res = M.cramer(A, b);
    if (!gaussDet(A).isZero()) { assert.ok(res.unique); res.solution.forEach((v, j) => assert.ok(v.eq(x[j]), `x${j}, seed ${s}`)); }
    // A dependent system that is consistent (the last row is the sum of the others): never "inconsistent".
    const D = A.map((r) => r.slice()), e = b.slice();
    D[n - 1] = D[0].map((v, j) => D.slice(0, n - 1).reduce((t, r) => t.add(r[j]), new F(0n)));
    e[n - 1] = e.slice(0, n - 1).reduce((t, v) => t.add(v), new F(0n));
    const dep = M.cramer(D, e);
    assert.ok(!dep.unique && !dep.inconsistent, `dependent but consistent, seed ${s}`);
    // Make it contradict itself: if any Δi is non-zero it must be reported as inconsistent.
    e[n - 1] = e[n - 1].add(new F(1n));
    const bad = M.cramer(D, e);
    assert.ok(!bad.unique);
    assert.equal(bad.inconsistent, bad.parts.some((p) => !p.det.isZero()), `seed ${s}`);
    if (n === 2 && !D[0].every((v) => v.isZero())) assert.ok(bad.inconsistent, `2 × 2 contradiction, seed ${s}`);
  }
});

// ---------- Measures of central tendency and dispersion ----------

// Gupta's interpolated item at position pos (1-based) in a sorted list.
const at = (xs, pos) => (pos <= 1 ? xs[0] : pos >= xs.length ? xs.at(-1) : xs[Math.floor(pos) - 1] + (pos - Math.floor(pos)) * (xs[Math.floor(pos)] - xs[Math.floor(pos) - 1]));
const scaleOf = (g) => g.pick([1, 1, 1, 0.01, 1000, 1e6]);

test("individual series: every measure against the direct formula", () => {
  for (let s = 1; s <= 2000 * K; s++) {
    const g = R(s), n = g.int(2, 40), sc = scaleOf(g), off = g.pick([0, 0, -50, 1e4]);
    const xs = Array.from({ length: n }, () => off + g.int(-30, 90) * sc);
    const r = S.individual(xs), sorted = xs.slice().sort((a, b) => a - b), mean = sum(xs) / n;
    ok(r.mean, mean, `mean ${s}`);
    ok(r.median, at(sorted, (n + 1) / 2), `median ${s}`);
    ok(r.q1, at(sorted, (n + 1) / 4), `Q1 ${s}`);
    ok(r.q3, at(sorted, (3 * (n + 1)) / 4), `Q3 ${s}`);
    ok(r.range, sorted.at(-1) - sorted[0], `range ${s}`);
    ok(r.sd, Math.sqrt(sum(xs.map((x) => (x - mean) ** 2)) / n), `sd ${s}`, 1e-5);
    ok(r.mdMean, sum(xs.map((x) => Math.abs(x - mean))) / n, `MD ${s}`, 1e-5);
    ok(r.qd, (r.q3 - r.q1) / 2, `QD ${s}`);
    assert.ok(r.sd >= 0 && r.q1 <= r.median + 1e-9 && r.median <= r.q3 + 1e-9, `order ${s}`);
    if (r.mean !== 0) ok(r.cv, (r.sd / r.mean) * 100, `CV ${s}`, 1e-5);
    assert.ok(Number.isFinite(r.modeValue), `mode is a number, seed ${s}`);
  }
});

test("discrete series: same mean and SD as the list written out; median by cumulative frequency", () => {
  for (let s = 1; s <= 1500 * K; s++) {
    const g = R(s), k = g.int(2, 12), sc = scaleOf(g);
    const vals = [...new Set(Array.from({ length: k }, () => g.int(-20, 60) * sc))];
    if (vals.length < 2) continue;
    const rows = vals.map((x) => ({ x, f: g.r() < 0.1 ? 0 : g.int(1, 25) }));
    if (sum(rows.map((q) => q.f)) === 0) rows[0].f = 1;
    assert.deepEqual(S.validateDiscrete(rows), []);
    const r = S.discrete(rows);
    const list = rows.flatMap((q) => Array(q.f).fill(q.x)).sort((a, b) => a - b), N = list.length, mean = sum(list) / N;
    ok(r.mean, mean, `mean ${s}`);
    ok(r.sd, Math.sqrt(sum(list.map((x) => (x - mean) ** 2)) / N), `sd ${s}`, 1e-5);
    ok(r.median, list[Math.min(N, Math.ceil((N + 1) / 2 - 1e-9)) - 1], `median ${s}`);
    // The mode is a value with the highest frequency (or the empirical one when several tie).
    const top = Math.max(...rows.map((q) => q.f)), modes = rows.filter((q) => q.f === top).map((q) => q.x);
    if (modes.length === 1) ok(r.modeValue, modes[0], `mode ${s}`);
  }
});

test("continuous series: mean, median, quartiles, mode and SD against the class formulas", () => {
  for (let s = 1; s <= 1500 * K; s++) {
    const g = R(s), k = g.int(2, 10), h = g.pick([5, 10, 20, 0.5, 100]), start = g.int(0, 10) * h;
    const rows = Array.from({ length: k }, (_, i) => ({ lo: start + i * h, hi: start + (i + 1) * h, f: g.r() < 0.1 ? 0 : g.int(1, 30) }));
    if (sum(rows.map((q) => q.f)) === 0) rows[0].f = 3;
    assert.deepEqual(S.validateContinuous(rows).errors, []);
    const r = S.continuous(rows), N = sum(rows.map((q) => q.f)), m = rows.map((q) => (q.lo + q.hi) / 2);
    const mean = sum(rows.map((q, i) => q.f * m[i])) / N;
    ok(r.mean, mean, `mean ${s}`);
    ok(r.sd, Math.sqrt(sum(rows.map((q, i) => q.f * (m[i] - mean) ** 2)) / N), `sd ${s}`, 1e-5);
    if (r.step) ok(r.mean, r.step.A + (r.step.sumFd / N) * r.step.h, `step deviation mean ${s}`);
    if (r.step) ok(r.sd, Math.sqrt(r.step.sumFd2 / N - (r.step.sumFd / N) ** 2) * r.step.h, `step deviation sd ${s}`, 1e-5);
    const loc = (pos) => {
      let cf = 0;
      for (const q of rows) { if (q.f > 0 && cf + q.f >= pos - 1e-9) return q.lo + ((pos - cf) / q.f) * h; cf += q.f; }
      return rows.at(-1).hi;
    };
    ok(r.median, loc(N / 2), `median ${s}`);
    ok(r.q1, loc(N / 4), `Q1 ${s}`);
    ok(r.q3, loc((3 * N) / 4), `Q3 ${s}`);
    assert.ok(r.median >= rows[0].lo - 1e-9 && r.median <= rows.at(-1).hi + 1e-9, `median inside the classes, seed ${s}`);
    if (r.mode.value !== undefined) {
      const c = rows[r.mode.i];
      assert.ok(r.mode.value >= c.lo - 1e-9 && r.mode.value <= c.hi + 1e-9, `mode inside the modal class, seed ${s}`);
    }
    assert.ok(Number.isFinite(r.modeValue), `mode is a number, seed ${s}`);
  }
});

test("inclusive classes (10–19, 20–29) are widened by half the gap, and nothing else changes", () => {
  for (let s = 1; s <= 300 * K; s++) {
    const g = R(s), k = g.int(2, 8), h = g.pick([10, 5, 100]);
    const inc = Array.from({ length: k }, (_, i) => ({ lo: i * h, hi: (i + 1) * h - 1, f: g.int(1, 20) }));
    const exc = inc.map((q) => ({ lo: q.lo - 0.5, hi: q.hi + 0.5, f: q.f }));
    const a = S.continuous(inc), b = S.continuous(exc);
    assert.ok(a.adjusted);
    for (const key of ["mean", "median", "q1", "q3", "sd", "modeValue"]) ok(a[key], b[key], `${key}, seed ${s}`);
  }
});

// ---------- Correlation and regression ----------

const pearsonDirect = (X, Y) => {
  const n = X.length, mx = sum(X) / n, my = sum(Y) / n;
  const sxy = sum(X.map((x, i) => (x - mx) * (Y[i] - my))), sxx = sum(X.map((x) => (x - mx) ** 2)), syy = sum(Y.map((y) => (y - my) ** 2));
  return sxy / Math.sqrt(sxx * syy);
};

test("Karl Pearson's r: direct formula, bounds, and unchanged by a change of origin and scale", () => {
  for (let s = 1; s <= 2000 * K; s++) {
    const g = R(s), n = g.int(3, 30), sc = scaleOf(g);
    const X = Array.from({ length: n }, () => g.int(-20, 80) * sc), b = g.int(-3, 3);
    const Y = X.map((x) => b * x + g.int(-40, 40) * sc);
    if (C.validatePairs(X, Y).length) continue;
    const p = C.pearson(X, Y);
    ok(p.r, pearsonDirect(X, Y), `r ${s}`, 1e-6);
    assert.ok(Math.abs(p.r) <= 1 + 1e-12, `|r| <= 1, seed ${s}`);
    const a = g.pick([2, 0.5, 10]), c = g.int(-100, 100);
    ok(C.pearson(X.map((x) => a * x + c), Y).r, p.r, `origin and scale ${s}`, 1e-6);
    ok(C.pearson(X.map((x) => -x), Y).r, -p.r, `sign ${s}`, 1e-6);
  }
});

test("Spearman: ranks (1 = largest, ties averaged) and R match Pearson on the ranks when nothing ties", () => {
  for (let s = 1; s <= 2000 * K; s++) {
    const g = R(s), n = g.int(3, 25), wide = g.r() < 0.5;
    const X = Array.from({ length: n }, () => g.int(0, wide ? 1000 : 8)), Y = Array.from({ length: n }, () => g.int(0, wide ? 1000 : 8));
    if (C.validatePairs(X, Y).length) continue;
    const rk = (v) => v.map((x) => v.filter((y) => y > x).length + (v.filter((y) => y === x).length + 1) / 2);
    const s1 = C.spearman(X, Y);
    s1.rows.forEach((row, i) => { assert.equal(row.rx, rk(X)[i]); assert.equal(row.ry, rk(Y)[i]); });
    const D2 = sum(X.map((_, i) => (rk(X)[i] - rk(Y)[i]) ** 2));
    const tieCF = (v) => [...new Set(v)].map((u) => v.filter((w) => w === u).length).filter((m) => m > 1).reduce((t, m) => t + (m ** 3 - m) / 12, 0);
    ok(s1.R, 1 - (6 * (D2 + tieCF(X) + tieCF(Y))) / (n ** 3 - n), `R ${s}`);
    if (new Set(X).size === n && new Set(Y).size === n) ok(s1.R, pearsonDirect(rk(X), rk(Y)), `no ties: Pearson on ranks ${s}`);
    assert.ok(s1.R <= 1 + 1e-12 && Number.isFinite(s1.R), `seed ${s}`);
    // Ranks given directly give the same answer.
    ok(C.spearman(rk(X), rk(Y), true).R, s1.R, `ranks given ${s}`);
  }
});

test("regression: both lines pass through the means, byx × bxy = r², and the summary route agrees", () => {
  for (let s = 1; s <= 2000 * K; s++) {
    const g = R(s), n = g.int(3, 30), sc = scaleOf(g);
    const X = Array.from({ length: n }, () => g.int(-20, 80) * sc), Y = X.map((x) => g.int(-3, 3) * x + g.int(-40, 40) * sc);
    if (C.validatePairs(X, Y).length) continue;
    const q = C.regression(X, Y), mx = sum(X) / n, my = sum(Y) / n;
    // Through the means, to 12 significant digits of the terms being added.
    assert.ok(Math.abs(q.yAt(mx) - my) <= 1e-9 * Math.max(1, Math.abs(my), Math.abs(q.byx * mx)), `Y on X through the means ${s}`);
    assert.ok(Math.abs(q.xAt(my) - mx) <= 1e-9 * Math.max(1, Math.abs(mx), Math.abs(q.bxy * my)), `X on Y through the means ${s}`);
    ok(q.byx * q.bxy, q.r ** 2, `byx bxy = r² ${s}`, 1e-6);
    assert.ok(Math.sign(q.byx) === Math.sign(q.bxy) && (q.byx === 0 || Math.sign(q.byx) === Math.sign(q.r)), `same signs ${s}`);
    // Least squares: Y on X has the smallest sum of squared errors among nearby lines.
    const sse = (a, b) => sum(X.map((x, i) => (Y[i] - a - b * x) ** 2));
    const best = sse(q.a, q.byx);
    for (const [da, db] of [[1e-3, 0], [-1e-3, 0], [0, 1e-4], [0, -1e-4]]) assert.ok(sse(q.a + da * sc, q.byx + db) >= best * (1 - 1e-9) - 1e-9, `least squares ${s}`);
    const sd = (v, m) => Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / n);
    const f = C.fromSummary({ mx, my, sx: sd(X, mx), sy: sd(Y, my), r: q.r });
    ok(f.byx, q.byx, `summary byx ${s}`, 1e-6);
    ok(f.bxy, q.bxy, `summary bxy ${s}`, 1e-6);
  }
});

// ---------- Time series and index numbers ----------

test("time series: a straight-line series is its own trend; moving averages are the window means", () => {
  for (let s = 1; s <= 1500 * K; s++) {
    const g = R(s), n = g.int(4, 25), t0 = g.int(1990, 2020), gap = g.pick([1, 1, 2, 5]);
    const t = Array.from({ length: n }, (_, i) => t0 + i * gap), a = g.int(-50, 500), b = g.int(-20, 20) / g.pick([1, 2, 4]);
    const line = t.map((x) => a + b * (x - t0));
    assert.deepEqual(T.validateSeries(t, line), []);
    T.semiAverage(t, line).trend.forEach((v, i) => ok(v, line[i], `semi-average of a line ${s}`));
    const k = g.int(2, Math.min(8, n - 1));
    T.movingAverage(t, line, k).rows.forEach((r, i) => { if (r.trend !== undefined) ok(r.trend, line[i], `moving average of a line ${s}`); });
    const y = t.map(() => g.int(0, 900) / g.pick([1, 10]));
    const ma = T.movingAverage(t, y, k), mean = (i, j) => sum(y.slice(i, j)) / (j - i);
    let count = 0;
    ma.rows.forEach((r, i) => {
      if (r.trend === undefined) return;
      count++;
      if (k % 2) ok(r.trend, mean(i - (k - 1) / 2, i + (k + 1) / 2), `odd window ${s}`);
      else ok(r.trend, (mean(i - k / 2, i + k / 2) + mean(i - k / 2 + 1, i + k / 2 + 1)) / 2, `centred window ${s}`);
    });
    assert.equal(count, k % 2 ? n - k + 1 : n - k, `number of trend values, seed ${s}`);
    // Semi-averages leave out the middle year only when n is odd.
    const sa = T.semiAverage(t, y);
    assert.equal(sa.A.y.length + sa.B.y.length + (sa.odd ? 1 : 0), n);
  }
});

test("index numbers: Fisher passes both tests; L = P when quantities change in proportion", () => {
  for (let s = 1; s <= 2000 * K; s++) {
    const g = R(s), k = g.int(1, 8);
    const items = Array.from({ length: k }, () => ({ p0: g.int(1, 200) / g.pick([1, 10]), q0: g.int(0, 50), p1: g.int(0, 300) / g.pick([1, 10]), q1: g.int(0, 50) }));
    if (T.validateIndex(items).length) continue;
    const x = T.indexNumbers(items), S0 = (f) => sum(items.map(f));
    ok(x.L, (S0((i) => i.p1 * i.q0) / S0((i) => i.p0 * i.q0)) * 100, `L ${s}`);
    ok(x.P, (S0((i) => i.p1 * i.q1) / S0((i) => i.p0 * i.q1)) * 100, `P ${s}`);
    ok(x.F, Math.sqrt(x.L * x.P), `F ${s}`);
    assert.ok(x.trt.holds, `time reversal, seed ${s}`);
    assert.ok(x.frt.holds, `factor reversal, seed ${s}`);
    assert.ok(Math.min(x.L, x.P) - 1e-9 <= x.F && x.F <= Math.max(x.L, x.P) + 1e-9, `F between L and P, seed ${s}`);
    const c = g.int(1, 5) / 2, prop = items.map((i) => ({ ...i, q1: i.q0 * c }));
    if (!T.validateIndex(prop).length) { const y = T.indexNumbers(prop); ok(y.L, y.P, `proportional quantities ${s}`); }
  }
});

// ---------- Arithmetic (Unit II) ----------

test("interest: finding P, R or T from the answer gives back what went in", () => {
  for (let s = 1; s <= 2000 * K; s++) {
    const g = R(s), P0 = g.int(1, 5000) * g.pick([1, 10, 100]), R0 = g.int(1, 400) / 10, T0 = g.int(1, 40) / g.pick([1, 2, 4]), k = g.pick([1, 2, 4, 12]);
    const si = A.simpleInterest({ P: P0, R: R0, T: T0 });
    ok(si.SI, (P0 * R0 * T0) / 100, `SI ${s}`);
    ok(A.simpleInterest({ R: R0, T: T0, A: si.A }).P, P0, `SI: P from A ${s}`);
    ok(A.simpleInterest({ R: R0, T: T0, SI: si.SI }).P, P0, `SI: P from SI ${s}`);
    ok(A.simpleInterest({ P: P0, T: T0, A: si.A }).R, R0, `SI: R ${s}`);
    ok(A.simpleInterest({ P: P0, R: R0, SI: si.SI }).T, T0, `SI: T ${s}`);
    const ci = A.compoundInterest({ P: P0, R: R0, T: T0, k });
    ok(ci.A, P0 * (1 + R0 / (100 * k)) ** (k * T0), `CI amount ${s}`);
    ok(A.compoundInterest({ R: R0, T: T0, k, A: ci.A }).P, P0, `CI: P from A ${s}`, 1e-5);
    ok(A.compoundInterest({ R: R0, T: T0, k, CI: ci.CI }).P, P0, `CI: P from CI ${s}`, 1e-5);
    ok(A.compoundInterest({ P: P0, T: T0, k, A: ci.A }).R, R0, `CI: R ${s}`, 1e-5);
    ok(A.compoundInterest({ P: P0, R: R0, k, A: ci.A }).T, T0, `CI: T ${s}`, 1e-5);
    assert.ok(ci.CI >= si.SI - 1e-6 * Math.max(1, si.SI) || T0 < 1, `CI ≥ SI from a year on, seed ${s}`);
    if (ci.rows.length) ok(ci.rows.at(-1).close, ci.A, `table ends at the amount ${s}`, 1e-6);
  }
});

test("percentages, profit and loss, discounts and ratios: round trips and identities", () => {
  for (let s = 1; s <= 3000 * K; s++) {
    const g = R(s), a = g.int(-90, 200), b = g.int(-90, 200), cp = g.int(1, 9999), pct = g.int(-95, 300);
    ok(A.successive([a, b]).net, a + b + (a * b) / 100, `successive ${s}`);
    ok(A.cpFromSp(A.spFromProfit(cp, pct), pct), cp, `SP ⇄ CP ${s}`);
    const sp = A.spFromProfit(cp, pct), pl = A.profitLoss(cp, sp);
    if (pct) ok(pl.pct, Math.abs(pct), `profit % ${s}`); else assert.equal(pl.kind, "none");
    const ds = Array.from({ length: g.int(1, 4) }, () => g.int(0, 60));
    const mp = g.int(1, 9999), after = ds.reduce((p, d) => A.afterDiscount(p, d), mp);
    ok(after, A.afterDiscount(mp, A.equivalentDiscount(ds)), `equivalent discount ${s}`);
    const d = g.int(0, 90), mk = A.markedFor(cp, pct, d);
    ok(A.afterDiscount(mk, d), sp, `marked price ${s}`);
    const parts = Array.from({ length: g.int(2, 5) }, () => g.int(1, 20)), amt = g.int(1, 100000);
    const dv = A.divide(amt, parts);
    ok(sum(dv.shares), amt, `shares add up ${s}`);
    dv.shares.forEach((v, i) => ok(v / parts[i], dv.shares[0] / parts[0], `in proportion ${s}`));
    const low = A.simplify(parts);
    low.forEach((v, i) => ok(v / low[0], parts[i] / parts[0], `lowest terms keep the ratio ${s}`));
    const x = g.int(1, 50), y = g.int(1, 50), z = g.int(1, 50);
    ok(x / y, z / A.fourthProportional(x, y, z), `fourth proportional ${s}`);
    ok(A.meanProportional(x, y) ** 2, x * y, `mean proportional ${s}`);
  }
});

test("speed and work: average speed, trains, working together and men–days round trips", () => {
  for (let s = 1; s <= 3000 * K; s++) {
    const g = R(s);
    const legs = Array.from({ length: g.int(2, 5) }, () => ({ d: g.int(1, 500), v: g.int(1, 120) }));
    const av = A.averageSpeed(legs);
    ok(av.avg, sum(legs.map((l) => l.d)) / sum(legs.map((l) => l.d / l.v)), `average speed ${s}`);
    assert.ok(av.avg >= Math.min(...legs.map((l) => l.v)) - 1e-9 && av.avg <= Math.max(...legs.map((l) => l.v)) + 1e-9);
    ok(A.mpsToKmph(A.kmphToMps(legs[0].v)), legs[0].v, `km/h ⇄ m/s ${s}`);
    const L1 = g.int(50, 500), L2 = g.int(0, 500), v1 = g.int(10, 150), v2 = g.int(0, 150);
    ok(A.crossing({ L1, L2, v1, v2 }).time, (L1 + L2) / ((v1 + v2) * 5 / 18), `opposite ${s}`);
    if (v1 !== v2) ok(A.crossing({ L1, L2, v1, v2, same: true }).time, (L1 + L2) / (Math.abs(v1 - v2) * 5 / 18), `same way ${s}`);
    const days = Array.from({ length: g.int(2, 4) }, () => g.int(1, 40) * (g.r() < 0.2 ? -1 : 1));
    const tg = A.together(days), rate = sum(days.map((d) => 1 / d));
    if (rate > 0) ok(tg.time, 1 / rate, `together ${s}`); else assert.equal(tg.time, Infinity);
    const keys = ["M1", "D1", "H1", "W1", "M2", "D2", "H2", "W2"];
    const v = { M1: g.int(1, 40), D1: g.int(1, 60), H1: g.int(1, 12), W1: g.int(1, 9) };
    Object.assign(v, { M2: g.int(1, 40), H2: g.int(1, 12), W2: g.int(1, 9) });
    v.D2 = (v.M1 * v.D1 * v.H1 * v.W2) / (v.W1 * v.M2 * v.H2);
    const miss = g.pick(keys), given = { ...v, [miss]: null };
    ok(A.menDays(given).values[miss], v[miss], `men–days–hours: ${miss}, seed ${s}`);
  }
});

// ---------- Counting and probability ----------

test("counting: Pascal's rule, nPr = nCr × r!, Σ nCr = 2ⁿ, and word arrangements by brute force", () => {
  for (let n = 0; n <= 60; n++) {
    let tot = 0n;
    for (let r = 0; r <= n; r++) {
      const c = P.nCr(n, r);
      tot += c;
      assert.equal(P.nPr(n, r), c * P.factorial(r));
      assert.equal(c, P.nCr(n, n - r));
      if (n > 0 && r > 0 && r < n) assert.equal(c, P.nCr(n - 1, r - 1) + P.nCr(n - 1, r));
    }
    assert.equal(tot, 2n ** BigInt(n));
  }
  assert.equal(P.nCr(200, 100).toString(), "90548514656103281165404177077484163874504589675413336841320");
  const perms = (s) => (s.length <= 1 ? [s] : [...new Set([...s].flatMap((c, i) => perms(s.slice(0, i) + s.slice(i + 1)).map((p) => c + p)))]);
  for (let s = 1; s <= 200 * K; s++) {
    const g = R(s), w = Array.from({ length: g.int(1, 7) }, () => g.pick(["A", "B", "C", "D"])).join("");
    assert.equal(P.wordArrangements(w).total, BigInt(perms(w).length), w);
  }
});

test("probability: dice, coins, cards and bags add up to 1 over all outcomes", () => {
  const one = new F(1n);
  for (let d = 1; d <= 3; d++) {
    let tot = new F(0n);
    for (let k = d; k <= 6 * d; k++) tot = tot.add(P.diceEvent(d, (x) => x === k).p);
    assert.ok(tot.eq(one));
    const brute = (test) => { let c = 0; const go = (i, sm) => { if (i === d) { if (test(sm)) c++; return; } for (let f = 1; f <= 6; f++) go(i + 1, sm + f); }; go(0, 0); return c; };
    for (const test of [(x) => x % 2 === 0, (x) => x >= 7, (x) => x % 3 === 0]) assert.equal(P.diceEvent(d, test).fav, brute(test));
  }
  for (let n = 1; n <= 40; n++) {
    let tot = new F(0n);
    for (let k = 0; k <= n; k++) tot = tot.add(P.coins(n, k).p);
    assert.ok(tot.eq(one), `coins ${n}`);
  }
  for (const [, , size] of P.CARD_GROUPS) for (let take = 1; take <= 5; take++) {
    let tot = new F(0n);
    for (let k = 0; k <= take; k++) tot = tot.add(P.cards(size, take, k).p);
    assert.ok(tot.eq(one), `cards ${size} ${take}`);
  }
  for (let s = 1; s <= 300 * K; s++) {
    const g = R(s), counts = Array.from({ length: g.int(2, 4) }, () => g.int(0, 8)), take = g.int(1, Math.max(1, Math.min(5, sum(counts))));
    if (sum(counts) < take) continue;
    let tot = new F(0n);
    const go = (i, left, want) => {
      if (i === counts.length) { if (left === 0) tot = tot.add(P.bag(counts, want).p); return; }
      for (let w = 0; w <= Math.min(left, counts[i]); w++) go(i + 1, left - w, [...want, w]);
    };
    go(0, take, []);
    assert.ok(tot.eq(one), `bag, seed ${s}`);
  }
});
