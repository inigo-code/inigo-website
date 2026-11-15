// Assignment problem by the Hungarian method, with every intermediate table kept for display.
//   problem = { cost: number[][] (Infinity for "M", an assignment that is not allowed), sense: "min" | "max" }

import { EPS, clean } from "./num.js";

export const BIG = 1e7;

export function validate(p) {
  const errors = [];
  if (!p.cost.length || !p.cost[0].length) errors.push("Add at least one row and one column.");
  if (p.cost.some((r) => r.length !== p.cost[0].length)) errors.push("Every row needs the same number of columns.");
  p.cost.forEach((r, i) => r.forEach((c, j) => {
    if (!(Number.isFinite(c) || c === Infinity)) errors.push(`Cell (${i + 1}, ${j + 1}): enter a number, or M for an assignment that is not allowed.`);
  }));
  return errors;
}

// Largest set of independent zeros (a maximum matching), by augmenting paths.
function matching(Z, n) {
  const rowOf = new Array(n).fill(-1), colOf = new Array(n).fill(-1);
  const tryRow = (i, seen) => {
    for (let j = 0; j < n; j++) {
      if (!Z[i][j] || seen[j]) continue;
      seen[j] = true;
      if (rowOf[j] === -1 || tryRow(rowOf[j], seen)) { rowOf[j] = i; colOf[i] = j; return true; }
    }
    return false;
  };
  for (let i = 0; i < n; i++) tryRow(i, new Array(n).fill(false));
  return { colOf, rowOf, size: colOf.filter((j) => j >= 0).length };
}

// Fewest lines covering every zero (König): mark unmatched rows, then alternate through zeros
// and matched cells. Lines go through unmarked rows and marked columns.
function cover(Z, n, mt) {
  const rowMark = new Array(n).fill(false), colMark = new Array(n).fill(false);
  const queue = [];
  for (let i = 0; i < n; i++) if (mt.colOf[i] === -1) { rowMark[i] = true; queue.push(i); }
  while (queue.length) {
    const i = queue.shift();
    for (let j = 0; j < n; j++) {
      if (Z[i][j] && !colMark[j]) {
        colMark[j] = true;
        const r = mt.rowOf[j];
        if (r !== -1 && !rowMark[r]) { rowMark[r] = true; queue.push(r); }
      }
    }
  }
  return { rows: rowMark.map((m) => !m), cols: colMark };
}

export function solve(p) {
  const r0 = p.cost.length, c0 = p.cost[0].length, n = Math.max(r0, c0);
  const notes = [];
  let base = p.cost.map((r) => r.slice());
  if (p.sense === "max") {
    const top = Math.max(...base.flat().filter(Number.isFinite));
    base = base.map((r) => r.map((c) => (Number.isFinite(c) ? clean(top - c) : Infinity)));
    notes.push(`To maximise, every value is subtracted from the largest, ${top}, giving a table of losses to minimise.`);
  }
  if (r0 < n) notes.push(`There are fewer rows than columns, so ${n - r0} dummy row${n - r0 > 1 ? "s" : ""} of zeros ${n - r0 > 1 ? "are" : "is"} added.`);
  if (c0 < n) notes.push(`There are fewer columns than rows, so ${n - c0} dummy column${n - c0 > 1 ? "s" : ""} of zeros ${n - c0 > 1 ? "are" : "is"} added.`);
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i < r0 && j < c0 ? base[i][j] : 0)));
  const steps = [{ title: notes.length ? "Starting table" : "Cost table", table: A.map((r) => r.slice()) }];
  const W = A.map((r) => r.map((c) => (Number.isFinite(c) ? c : BIG)));

  for (let i = 0; i < n; i++) {
    const m = Math.min(...W[i]);
    if (m >= BIG / 10) return { ok: false, error: `Row ${i + 1} has no allowed assignment.`, notes, steps };
    for (let j = 0; j < n; j++) W[i][j] = clean(W[i][j] - m);
  }
  const show = () => W.map((r) => r.map((c) => (c >= BIG / 10 ? Infinity : c)));
  steps.push({ title: "Subtract the smallest value in each row from that row", table: show() });
  for (let j = 0; j < n; j++) {
    const m = Math.min(...W.map((r) => r[j]));
    if (m >= BIG / 10) return { ok: false, error: `Column ${j + 1} has no allowed assignment.`, notes, steps };
    for (let i = 0; i < n; i++) W[i][j] = clean(W[i][j] - m);
  }
  steps.push({ title: "Subtract the smallest value in each column from that column", table: show() });

  let mt;
  for (let round = 0; round < 4 * n * n; round++) {
    const Z = W.map((r) => r.map((c) => Math.abs(c) < EPS));
    mt = matching(Z, n);
    const lines = cover(Z, n, mt);
    const count = lines.rows.filter(Boolean).length + lines.cols.filter(Boolean).length;
    if (mt.size === n) {
      steps.push({ title: `${n} lines are needed to cover every zero, which equals the order of the table, so an optimal assignment can be made`, table: show(), lines, assign: mt.colOf.slice() });
      break;
    }
    let k = Infinity;
    for (let i = 0; i < n; i++) if (!lines.rows[i]) for (let j = 0; j < n; j++) if (!lines.cols[j]) k = Math.min(k, W[i][j]);
    if (k >= BIG / 10) return { ok: false, error: "No complete assignment avoids the cells marked M.", notes, steps };
    steps.push({ title: `Only ${count} line${count > 1 ? "s" : ""} cover every zero (fewer than ${n}). The smallest uncovered value is ${clean(k)}: subtract it from every uncovered value and add it where two lines cross`, table: show(), lines, k: clean(k) });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (!lines.rows[i] && !lines.cols[j]) W[i][j] = clean(W[i][j] - k);
      else if (lines.rows[i] && lines.cols[j]) W[i][j] = clean(W[i][j] + k);
    }
  }

  const assign = mt.colOf.slice();
  const pairs = assign.map((j, i) => ({ row: i, col: j, dummy: i >= r0 || j >= c0, value: i < r0 && j < c0 ? p.cost[i][j] : 0 }));
  const total = clean(pairs.filter((x) => !x.dummy).reduce((s, x) => s + x.value, 0));

  // Is there another optimal assignment? Try forbidding each chosen zero in turn.
  const Z = W.map((r) => r.map((c) => Math.abs(c) < EPS));
  let alternative = false;
  for (let i = 0; i < n && !alternative; i++) {
    const Z2 = Z.map((r) => r.slice());
    Z2[i][assign[i]] = false;
    if (matching(Z2, n).size === n) alternative = true;
  }
  return { ok: true, n, notes, steps, pairs, total, alternative, usesM: pairs.some((x) => !x.dummy && !Number.isFinite(x.value)) };
}
