// Transportation problem: initial basic feasible solution by the North-West Corner rule,
// the Least Cost method or Vogel's Approximation Method, then the MODI (u-v) method to optimality.
//
// problem = { cost: number[][] (Infinity for a prohibited route "M"), supply: number[], demand: number[],
//             sense: "min" | "max" }

import { EPS, clean } from "./num.js";

// "M" (a prohibited route) is a number far larger than any cost in the problem: at least 10,000,000,
// and always a thousand times more than any sum of costs the method can build up.
export const BIG = 1e7;
export const bigFor = (cost) => {
  const top = Math.max(0, ...cost.flat().filter(Number.isFinite).map(Math.abs));
  const need = 1000 * (cost.length + (cost[0]?.length ?? 0)) * (top + 1);
  return need <= BIG ? BIG : 10 ** Math.ceil(Math.log10(need));
};

export function validate(p) {
  const errors = [];
  const m = p.supply.length, n = p.demand.length;
  if (m < 1 || n < 1) errors.push("Add at least one source and one destination.");
  if (p.cost.length !== m || p.cost.some((r) => r.length !== n)) errors.push("The cost table must have one row per source and one column per destination.");
  p.cost.forEach((r, i) => r.forEach((c, j) => {
    if (!(Number.isFinite(c) || c === Infinity)) errors.push(`Cell (${i + 1}, ${j + 1}): enter a number, or M for a route that cannot be used.`);
    else if (c < 0 && p.sense !== "max") errors.push(`Cell (${i + 1}, ${j + 1}): a cost cannot be negative.`);
  }));
  if (p.cost.length && p.cost.flat().length && p.cost.flat().every((c) => c === Infinity)) errors.push("Every route is marked M, so nothing can be sent. At least one route must be allowed.");
  p.supply.forEach((s, i) => { if (!Number.isFinite(s) || s <= 0) errors.push(`Supply of source ${i + 1} must be a positive number.`); });
  p.demand.forEach((d, j) => { if (!Number.isFinite(d) || d <= 0) errors.push(`Demand of destination ${j + 1} must be a positive number.`); });
  return errors;
}

// Make the problem balanced and, for profits, turn it into a cost (regret) problem.
export function prepare(p) {
  const S = clean(p.supply.reduce((a, b) => a + b, 0)), D = clean(p.demand.reduce((a, b) => a + b, 0));
  let cost = p.cost.map((r) => r.slice()), supply = p.supply.slice(), demand = p.demand.slice();
  let dummy = null;
  const notes = [];
  if (p.sense === "max") {
    const top = Math.max(...cost.flat().filter(Number.isFinite));
    cost = cost.map((r) => r.map((c) => (Number.isFinite(c) ? clean(top - c) : Infinity)));
    notes.push(`Profits are turned into regrets by subtracting every profit from the largest, ${top}. Minimising regret maximises profit.`);
  }
  if (S > D + EPS) {
    cost = cost.map((r) => [...r, 0]); demand = [...demand, clean(S - D)]; dummy = "col";
    notes.push(`Supply (${S}) is more than demand (${D}), so a dummy destination takes the extra ${clean(S - D)} at zero cost.`);
  } else if (D > S + EPS) {
    cost = [...cost, new Array(demand.length).fill(0)]; supply = [...supply, clean(D - S)]; dummy = "row";
    notes.push(`Demand (${D}) is more than supply (${S}), so a dummy source supplies the missing ${clean(D - S)} at zero cost.`);
  } else notes.push(`Total supply equals total demand (${S}), so the problem is balanced.`);
  return { cost, supply, demand, dummy, notes, m: supply.length, n: demand.length, big: bigFor(cost) };
}

const val = (q, c) => (Number.isFinite(c) ? c : q.big ?? BIG);
const blank = (m, n) => Array.from({ length: m }, () => new Array(n).fill(null)); // null = no allocation

// ----- Initial basic feasible solutions -----

export function northWest(q) {
  const x = blank(q.m, q.n), s = q.supply.slice(), d = q.demand.slice(), steps = [];
  let i = 0, j = 0;
  while (i < q.m && j < q.n) {
    const a = clean(Math.min(s[i], d[j]));
    x[i][j] = a; s[i] = clean(s[i] - a); d[j] = clean(d[j] - a);
    steps.push({ cell: [i, j], amount: a, text: `Allocate ${a} to cell (${i + 1}, ${j + 1}).` });
    if (s[i] === 0 && d[j] === 0) { i++; j++; } else if (s[i] === 0) i++; else j++;
  }
  return { x, steps };
}

export function leastCost(q) {
  const x = blank(q.m, q.n), s = q.supply.slice(), d = q.demand.slice(), steps = [];
  const rowDone = new Array(q.m).fill(false), colDone = new Array(q.n).fill(false);
  for (;;) {
    let best = null;
    for (let i = 0; i < q.m; i++) if (!rowDone[i]) for (let j = 0; j < q.n; j++) if (!colDone[j]) {
      const c = val(q, q.cost[i][j]), a = Math.min(s[i], d[j]);
      if (!best || c < best.c - EPS || (Math.abs(c - best.c) <= EPS && a > best.a + EPS)) best = { i, j, c, a };
    }
    if (!best) break;
    const { i, j } = best, a = clean(best.a);
    x[i][j] = a; s[i] = clean(s[i] - a); d[j] = clean(d[j] - a);
    steps.push({ cell: [i, j], amount: a, text: `Lowest cost among the remaining cells is ${fmtCost(q.cost[i][j])} at (${i + 1}, ${j + 1}). Allocate ${a}.` });
    if (s[i] === 0) rowDone[i] = true;
    if (d[j] === 0) colDone[j] = true;
  }
  return { x, steps };
}

export function vogel(q) {
  const x = blank(q.m, q.n), s = q.supply.slice(), d = q.demand.slice(), steps = [];
  const rowDone = new Array(q.m).fill(false), colDone = new Array(q.n).fill(false);
  const two = (arr) => { const v = arr.slice().sort((a, b) => a - b); return v.length > 1 ? clean(v[1] - v[0]) : v.length ? v[0] : 0; };
  for (;;) {
    const rows = [...Array(q.m).keys()].filter((i) => !rowDone[i]), cols = [...Array(q.n).keys()].filter((j) => !colDone[j]);
    if (!rows.length || !cols.length) break;
    const rp = rows.map((i) => ({ kind: "row", k: i, pen: two(cols.map((j) => val(q, q.cost[i][j]))) }));
    const cp = cols.map((j) => ({ kind: "col", k: j, pen: two(rows.map((i) => val(q, q.cost[i][j]))) }));
    // The cheapest cell in a row or column, preferring the larger allocation on a tie.
    const cheapest = (line) => {
      const cells = line.kind === "row" ? cols.map((j) => [line.k, j]) : rows.map((i) => [i, line.k]);
      let best = null;
      for (const [i, j] of cells) {
        const c = val(q, q.cost[i][j]), a = Math.min(s[i], d[j]);
        if (!best || c < best.c - EPS || (Math.abs(c - best.c) <= EPS && a > best.a + EPS)) best = { i, j, c, a };
      }
      return best;
    };
    let pick, why;
    if (rows.length === 1 || cols.length === 1) {
      pick = cheapest(rows.length === 1 ? { kind: "row", k: rows[0] } : { kind: "col", k: cols[0] });
      why = `Only one ${rows.length === 1 ? "row" : "column"} is left, so it takes the rest.`;
    } else {
      // Largest penalty; on a tie, the line whose cheapest cell costs least, then the larger allocation.
      let line = null, cell = null;
      for (const L of [...rp, ...cp]) {
        const c = cheapest(L);
        if (!line || L.pen > line.pen + EPS || (Math.abs(L.pen - line.pen) <= EPS && (c.c < cell.c - EPS || (Math.abs(c.c - cell.c) <= EPS && c.a > cell.a + EPS)))) { line = L; cell = c; }
      }
      pick = cell;
      why = `Largest penalty is ${penText(q, line.pen)} in ${line.kind === "row" ? "row" : "column"} ${line.k + 1}; its lowest cost is ${fmtCost(q.cost[cell.i][cell.j])} at (${cell.i + 1}, ${cell.j + 1}).`;
    }
    const { i, j } = pick, a = clean(pick.a);
    x[i][j] = a; s[i] = clean(s[i] - a); d[j] = clean(d[j] - a);
    steps.push({ cell: [i, j], amount: a, rowPen: rp, colPen: cp, text: `${why} Allocate ${a}.` });
    if (s[i] === 0) rowDone[i] = true;
    if (d[j] === 0) colDone[j] = true;
  }
  return { x, steps };
}

const fmtCost = (c) => (Number.isFinite(c) ? String(clean(c)) : "M");

// A penalty may be a difference involving M, such as M − 5.
const penText = (q, v) => {
  const big = q.big ?? BIG;
  if (Math.abs(v) < big / 10) return String(clean(v));
  const k = Math.round(v / big), rest = clean(v - k * big);
  return `${k === 1 ? "M" : `${k}M`}${rest ? ` ${rest > 0 ? "+" : "−"} ${Math.abs(rest)}` : ""}`;
};

export const totalCost = (cost, x) => {
  let t = 0, usesM = false;
  x.forEach((r, i) => r.forEach((a, j) => { if (a) { if (!Number.isFinite(cost[i][j])) usesM = true; else t += cost[i][j] * a; } }));
  return { cost: clean(t), usesM };
};

// ----- Degeneracy and the MODI method -----

// Rows are nodes 0..m-1 and columns are nodes m..m+n-1; basic cells are the edges of a spanning tree.
function connected(m, n, basic) {
  const parent = [...Array(m + n).keys()];
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  for (const [i, j] of basic) parent[find(i)] = find(m + j);
  return { find, union: (a, b) => (parent[find(a)] = find(b)) };
}

// Add zero allocations (ε) in the cheapest cells that do not form a loop, until there are m + n - 1.
export function fixDegeneracy(q, x) {
  const basic = [];
  x.forEach((r, i) => r.forEach((a, j) => { if (a !== null) basic.push([i, j]); }));
  const need = q.m + q.n - 1 - basic.length, eps = [];
  if (need <= 0) return { basic, eps };
  const uf = connected(q.m, q.n, basic);
  const cells = [];
  for (let i = 0; i < q.m; i++) for (let j = 0; j < q.n; j++) if (x[i][j] === null) cells.push([i, j]);
  cells.sort((a, b) => val(q, q.cost[a[0]][a[1]]) - val(q, q.cost[b[0]][b[1]]) || a[0] - b[0] || a[1] - b[1]);
  for (const [i, j] of cells) {
    if (eps.length === need) break;
    if (uf.find(i) !== uf.find(q.m + j)) { uf.union(i, q.m + j); x[i][j] = 0; basic.push([i, j]); eps.push([i, j]); }
  }
  return { basic, eps };
}

function potentials(q, basic) {
  const count = new Array(q.m).fill(0);
  basic.forEach(([i]) => count[i]++);
  const r0 = count.indexOf(Math.max(...count)); // u = 0 for the row with the most allocations
  const u = new Array(q.m).fill(null), v = new Array(q.n).fill(null);
  u[r0] = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const [i, j] of basic) {
      const c = val(q, q.cost[i][j]);
      if (u[i] !== null && v[j] === null) { v[j] = clean(c - u[i]); changed = true; }
      else if (v[j] !== null && u[i] === null) { u[i] = clean(c - v[j]); changed = true; }
    }
  }
  return { u, v, r0 };
}

// The closed loop made by adding cell (ei, ej) to the tree of basic cells.
function loopFor(q, basic, ei, ej) {
  const adj = Array.from({ length: q.m + q.n }, () => []);
  for (const [i, j] of basic) { adj[i].push(q.m + j); adj[q.m + j].push(i); }
  const start = q.m + ej, goal = ei, prev = new Array(q.m + q.n).fill(-1), seen = new Array(q.m + q.n).fill(false);
  const queue = [start]; seen[start] = true;
  while (queue.length) {
    const a = queue.shift();
    if (a === goal) break;
    for (const b of adj[a]) if (!seen[b]) { seen[b] = true; prev[b] = a; queue.push(b); }
  }
  const nodes = [];
  for (let a = goal; a !== -1; a = prev[a]) nodes.push(a);
  nodes.reverse(); // column ej ... row ei
  const cells = [[ei, ej]];
  for (let k = 0; k + 1 < nodes.length; k++) {
    const a = nodes[k], b = nodes[k + 1];
    cells.push(a >= q.m ? [b, a - q.m] : [a, b - q.m]);
  }
  return cells; // signs alternate +, -, +, - starting with the entering cell
}

export function modi(q, x0, maxIter = 100) {
  const x = x0.map((r) => r.slice());
  const { basic, eps } = fixDegeneracy(q, x);
  let basicSet = basic.map((c) => c.slice());
  const iterations = [];
  // When M is in play the u and v values are huge, and their last digits are rounding noise.
  const dtol = Math.max(EPS, 1e-13 * (q.big ?? BIG));
  for (let it = 0; it < maxIter; it++) {
    const { u, v, r0 } = potentials(q, basicSet);
    const delta = Array.from({ length: q.m }, (_, i) => Array.from({ length: q.n }, (_, j) => (x[i][j] === null ? clean(val(q, q.cost[i][j]) - u[i] - v[j]) : null)));
    let enter = null;
    for (let i = 0; i < q.m; i++) for (let j = 0; j < q.n; j++) {
      const dl = delta[i][j];
      if (dl !== null && dl < -dtol && (!enter || dl < enter.d - dtol)) enter = { i, j, d: dl };
    }
    const snap = { x: x.map((r) => r.slice()), u, v, r0, delta, eps: eps.filter(([i, j]) => x[i][j] === 0).map((c) => c.slice()) };
    if (!enter) {
      iterations.push({ ...snap, optimal: true, alternative: delta.flat().some((dl) => dl !== null && Math.abs(dl) <= dtol) });
      return { x, iterations, optimal: true };
    }
    const loop = loopFor(q, basicSet, enter.i, enter.j);
    const minus = loop.filter((_, k) => k % 2 === 1);
    let theta = Infinity, leave = null;
    for (const [i, j] of minus) if (x[i][j] < theta - EPS) { theta = x[i][j]; leave = [i, j]; }
    theta = clean(theta);
    iterations.push({ ...snap, optimal: false, enter: [enter.i, enter.j], enterDelta: enter.d, loop, theta, leave });
    loop.forEach(([i, j], k) => {
      const cur = x[i][j] ?? 0;
      x[i][j] = clean(k % 2 === 0 ? cur + theta : cur - theta);
    });
    x[leave[0]][leave[1]] = null;
    basicSet = basicSet.filter(([i, j]) => !(i === leave[0] && j === leave[1]));
    basicSet.push([enter.i, enter.j]);
  }
  return { x, iterations, optimal: false };
}

// Everything at once: prepare, one starting method, MODI, and the final cost in the original terms.
export function solve(p, method = "vam") {
  const q = prepare(p);
  const start = method === "nwc" ? northWest(q) : method === "lcm" ? leastCost(q) : vogel(q);
  const origCost = (i, j) => (i < p.supply.length && j < p.demand.length ? p.cost[i][j] : 0);
  const original = Array.from({ length: q.m }, (_, i) => Array.from({ length: q.n }, (_, j) => origCost(i, j)));
  const startTotal = totalCost(original, start.x);
  const opt = modi(q, start.x);
  const finalTotal = totalCost(original, opt.x);
  return { q, start, startTotal, opt, finalTotal, feasible: !finalTotal.usesM };
}
