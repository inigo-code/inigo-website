// Two-person zero-sum games. The matrix holds player A's gains (rows are A's strategies,
// columns are B's). A maximises, B minimises.

import { EPS, clean } from "./num.js";

export function validate(A) {
  const errors = [];
  if (!A.length || !A[0].length) errors.push("Add at least one row and one column.");
  if (A.some((r) => r.length !== A[0].length)) errors.push("Every row needs the same number of columns.");
  A.forEach((r, i) => r.forEach((v, j) => { if (!Number.isFinite(v)) errors.push(`Cell (${i + 1}, ${j + 1}): enter a number.`); }));
  return errors;
}

// Maximin and minimax, and every saddle point.
export function saddle(A) {
  const rowMin = A.map((r) => Math.min(...r));
  const colMax = A[0].map((_, j) => Math.max(...A.map((r) => r[j])));
  const maximin = Math.max(...rowMin), minimax = Math.min(...colMax);
  const points = [];
  A.forEach((r, i) => r.forEach((v, j) => { if (v === rowMin[i] && v === colMax[j]) points.push([i, j]); }));
  return { rowMin, colMax, maximin, minimax, points, value: points.length ? A[points[0][0]][points[0][1]] : null };
}

// Remove dominated strategies, one at a time, recording why (plain dominance first, then dominance
// by the average of two strategies).
// Row r is dominated by row s if every value in r is <= the value in s (A would never choose r).
// Column c is dominated by column d if every value in c is >= the value in d (B would never choose c).
export function reduce(A) {
  const tol = EPS * Math.max(1, ...A.flat().map(Math.abs));
  let rows = A.map((_, i) => i), cols = A[0].map((_, j) => j);
  const steps = [];
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (const r of rows) for (const s of rows) {
      if (r === s || rows.length < 2) continue;
      if (cols.every((j) => A[r][j] <= A[s][j])) {
        const equal = cols.every((j) => A[r][j] === A[s][j]);
        steps.push({ kind: "row", removed: r, by: s, equal, rows: rows.slice(), cols: cols.slice() });
        rows = rows.filter((x) => x !== r); changed = true; break outer;
      }
    }
    if (changed) continue;
    outer2: for (const c of cols) for (const d of cols) {
      if (c === d || cols.length < 2) continue;
      if (rows.every((i) => A[i][c] >= A[i][d])) {
        const equal = rows.every((i) => A[i][c] === A[i][d]);
        steps.push({ kind: "col", removed: c, by: d, equal, rows: rows.slice(), cols: cols.slice() });
        cols = cols.filter((x) => x !== c); changed = true; break outer2;
      }
    }
    if (changed) continue;
    // Dominance by the average of two other strategies, as textbooks use once plain dominance runs out.
    outer3: for (const r of rows) for (const s of rows) for (const t of rows) {
      if (rows.length < 3 || r === s || r === t || s >= t) continue;
      if (cols.every((j) => A[r][j] <= (A[s][j] + A[t][j]) / 2 + tol)) {
        steps.push({ kind: "row", removed: r, by: [s, t], average: true, rows: rows.slice(), cols: cols.slice() });
        rows = rows.filter((x) => x !== r); changed = true; break outer3;
      }
    }
    if (changed) continue;
    outer4: for (const c of cols) for (const d of cols) for (const e of cols) {
      if (cols.length < 3 || c === d || c === e || d >= e) continue;
      if (rows.every((i) => A[i][c] >= (A[i][d] + A[i][e]) / 2 - tol)) {
        steps.push({ kind: "col", removed: c, by: [d, e], average: true, rows: rows.slice(), cols: cols.slice() });
        cols = cols.filter((x) => x !== c); changed = true; break outer4;
      }
    }
  }
  return { rows, cols, steps };
}

// 2 × 2 game with no saddle point.
export function mixed2x2(a, b, c, d) {
  const den = a + d - b - c;
  return { p: (d - c) / den, q: (d - b) / den, value: (a * d - b * c) / den, den };
}

// Graphical method. For a 2 × n game the lines are A's expected gain against each of B's columns,
// as a function of p = probability of A's first row; A picks the highest point of the lowest lines.
// For an m × 2 game the lines are B's expected loss against each of A's rows, as a function of
// q = probability of B's first column; B picks the lowest point of the highest lines.
export function graphical(M) {
  const twoRows = M.length === 2;
  const tol = EPS * Math.max(1, ...M.flat().map(Math.abs)); // comparisons in proportion to the payoffs
  const lines = twoRows
    ? M[0].map((_, j) => ({ k: j, at0: M[1][j], at1: M[0][j] }))   // E_j(p) = M[0][j] p + M[1][j] (1 - p)
    : M.map((r, i) => ({ k: i, at0: r[1], at1: r[0] }));            // E_i(q) = r[0] q + r[1] (1 - q)
  const f = (L, x) => L.at1 * x + L.at0 * (1 - x);
  const env = (x) => (twoRows ? Math.min : Math.max)(...lines.map((L) => f(L, x)));
  const better = twoRows ? (u, v) => u > v + tol : (u, v) => u < v - tol;
  const cand = [0, 1];
  for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
    const sa = lines[a].at1 - lines[a].at0, sb = lines[b].at1 - lines[b].at0;
    if (Math.abs(sa - sb) <= tol) continue;
    const x = (lines[b].at0 - lines[a].at0) / (sa - sb);
    if (x > EPS && x < 1 - EPS) cand.push(x);
  }
  let best = cand[0];
  for (const x of cand) if (better(env(x), env(best))) best = x;
  const value = env(best);
  // The two lines through the optimal point, one rising and one falling, decide the other player's mix.
  const active = lines.filter((L) => Math.abs(f(L, best) - value) <= 100 * tol);
  const up = active.filter((L) => L.at1 - L.at0 > tol), down = active.filter((L) => L.at1 - L.at0 < -tol), flat = active.filter((L) => Math.abs(L.at1 - L.at0) <= tol);
  let pair = null;
  if (flat.length) pair = [flat[0]];
  else if (up.length && down.length) pair = [up[0], down[0]].sort((a, b) => a.k - b.k); // in matrix order, as written by hand
  else pair = [active[0]];
  return { twoRows, lines, x: best, value, pair };
}

// Linear programming solution of any game (used for games larger than the syllabus covers, and as a check).
// B's problem after adding a constant so every value is positive: maximise Σy subject to My <= 1, y >= 0.
export function lpSolve(M) {
  const m = M.length, n = M[0].length;
  // Work on the payoffs divided by the largest, so the tolerances below fit any size of number.
  const size = Math.max(...M.flat().map(Math.abs)) || 1;
  const shift = 1 - Math.min(...M.flat()) / size;
  const B = M.map((r) => r.map((v) => v / size + shift));
  // Tableau: rows 0..m-1 constraints, columns 0..n-1 y, n..n+m-1 slacks, last = right-hand side.
  const T = B.map((r, i) => [...r, ...Array.from({ length: m }, (_, k) => (k === i ? 1 : 0)), 1]);
  const obj = [...new Array(n).fill(-1), ...new Array(m).fill(0), 0];
  const basis = Array.from({ length: m }, (_, i) => n + i);
  for (let it = 0; it < 1000; it++) {
    let e = -1;
    for (let j = 0; j < n + m; j++) if (obj[j] < -1e-12) { e = j; break; } // Bland's rule
    if (e === -1) break;
    let l = -1, ratio = Infinity;
    for (let i = 0; i < m; i++) if (T[i][e] > 1e-12) {
      const r = T[i][n + m] / T[i][e];
      if (r < ratio - 1e-12 || (Math.abs(r - ratio) <= 1e-12 && basis[i] < basis[l])) { ratio = r; l = i; }
    }
    const pv = T[l][e];
    T[l] = T[l].map((v) => v / pv);
    for (let i = 0; i < m; i++) if (i !== l && Math.abs(T[i][e]) > 0) { const f = T[i][e]; T[i] = T[i].map((v, j) => v - f * T[l][j]); }
    const f = obj[e];
    for (let j = 0; j <= n + m; j++) obj[j] -= f * T[l][j];
    basis[l] = e;
  }
  const sumY = obj[n + m], v = 1 / sumY;
  const q = new Array(n).fill(0);
  basis.forEach((b, i) => { if (b < n) q[b] = T[i][n + m] * v; });
  const p = Array.from({ length: m }, (_, i) => obj[n + i] * v);
  return { p: p.map(clean), q: q.map(clean), value: clean((v - shift) * size) };
}

// The whole method, in textbook order: saddle point, dominance, then 2 × 2, graphical or LP.
export function solve(A) {
  const m = A.length, n = A[0].length;
  const sp = saddle(A);
  const p = new Array(m).fill(0), q = new Array(n).fill(0);
  if (sp.points.length) {
    const [i, j] = sp.points[0];
    p[i] = 1; q[j] = 1;
    return { method: "saddle", saddle: sp, value: sp.value, p, q };
  }
  const red = reduce(A);
  const R = red.rows.map((i) => red.cols.map((j) => A[i][j]));
  const out = { saddle: sp, reduction: red, reduced: R, p, q };
  const sp2 = saddle(R);
  if (sp2.points.length) { // can happen after dominance removes strategies
    const [i, j] = sp2.points[0];
    p[red.rows[i]] = 1; q[red.cols[j]] = 1;
    return { ...out, method: "saddle-after-dominance", value: sp2.value };
  }
  if (R.length === 2 && R[0].length === 2) {
    const s = mixed2x2(R[0][0], R[0][1], R[1][0], R[1][1]);
    p[red.rows[0]] = clean(s.p); p[red.rows[1]] = clean(1 - s.p);
    q[red.cols[0]] = clean(s.q); q[red.cols[1]] = clean(1 - s.q);
    return { ...out, method: "2x2", formula: s, value: clean(s.value) };
  }
  if (R.length === 2 || R[0].length === 2) {
    const g = graphical(R);
    if (g.pair.length === 2) {
      const sub = g.twoRows ? R.map((r) => [r[g.pair[0].k], r[g.pair[1].k]]) : [R[g.pair[0].k], R[g.pair[1].k]];
      const s = mixed2x2(sub[0][0], sub[0][1], sub[1][0], sub[1][1]);
      if (g.twoRows) {
        p[red.rows[0]] = clean(s.p); p[red.rows[1]] = clean(1 - s.p);
        q[red.cols[g.pair[0].k]] = clean(s.q); q[red.cols[g.pair[1].k]] = clean(1 - s.q);
      } else {
        p[red.rows[g.pair[0].k]] = clean(s.p); p[red.rows[g.pair[1].k]] = clean(1 - s.p);
        q[red.cols[0]] = clean(s.q); q[red.cols[1]] = clean(1 - s.q);
      }
      return { ...out, method: "graphical", graph: g, sub, formula: s, value: clean(s.value) };
    }
  }
  const lp = lpSolve(R);
  red.rows.forEach((i, k) => (p[i] = lp.p[k]));
  red.cols.forEach((j, k) => (q[j] = lp.q[k]));
  return { ...out, method: "lp", value: lp.value };
}
