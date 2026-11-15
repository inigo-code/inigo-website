// Stress tests: thousands of random problems, each checked against a method that shares no code
// with the tool (Fourier–Motzkin elimination for LPP, path enumeration for networks, min-cost flow
// for transportation, trying every assignment, and optimality certificates for games).
// Set STRESS=20 (or any multiplier) for a longer run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng } from "../../src/assets/or-lab/lib/num.js";
import * as lpp from "../../src/assets/or-lab/lib/lpp.js";
import * as net from "../../src/assets/or-lab/lib/network.js";
import * as tp from "../../src/assets/or-lab/lib/transport.js";
import * as asg from "../../src/assets/or-lab/lib/assignment.js";
import * as games from "../../src/assets/or-lab/lib/games.js";
import * as mc from "../../src/assets/or-lab/lib/montecarlo.js";

const K = Number(process.env.STRESS || 1);
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const R = (seed) => {
  const r = rng(seed);
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  return { r, int, pick: (arr) => arr[int(0, arr.length - 1)] };
};

// ---------- LPP against Fourier–Motzkin elimination (exact for integer data) ----------

// Maximise o·(x, y) subject to rows a·(x, y) <= b. Returns { status, value }.
function fmMax(rows, o) {
  // Each row is [cx, cy, cz, rhs]: cx x + cy y + cz z <= rhs, and z <= o·(x, y).
  let R0 = [...rows.map(([a1, a2, b]) => [a1, a2, 0, b]), [-o[0], -o[1], 1, 0]];
  const elim = (rs, v) => {
    const P = rs.filter((r) => r[v] > 0), N = rs.filter((r) => r[v] < 0), out = rs.filter((r) => r[v] === 0);
    for (const p of P) for (const n of N) out.push(p.map((x, k) => x * -n[v] + n[k] * p[v]));
    return out;
  };
  R0 = elim(elim(R0, 1), 0);
  if (R0.some((r) => r[2] === 0 && r[3] < -1e-9)) return { status: "infeasible" };
  const ups = R0.filter((r) => r[2] > 0);
  if (!ups.length) return { status: "unbounded" };
  let best = ups[0];
  for (const r of ups) if (r[3] / r[2] < best[3] / best[2]) best = r;
  return { status: "optimal", value: best[3] / best[2], frac: [best[3], best[2]] };
}

const asRows = (p) => {
  const rows = [[-1, 0, 0], [0, -1, 0]];
  for (const k of p.cons) {
    if (k.op !== ">=") rows.push([k.a[0], k.a[1], k.b]);
    if (k.op !== "<=") rows.push([-k.a[0], -k.a[1], -k.b]);
  }
  return rows;
};

function randomLpp(g) {
  const coef = () => (g.r() < 0.15 ? g.int(-4, 0) : g.int(0, 9));
  const n = g.int(1, 5);
  const cons = Array.from({ length: n }, () => {
    let a = [coef(), coef()];
    if (!a[0] && !a[1]) a = [1, g.int(0, 3)];
    return { a, op: g.pick(["<=", "<=", "<=", ">=", ">=", "="]), b: g.r() < 0.1 ? g.int(-10, 0) : g.int(0, 60) };
  });
  return { sense: g.pick(["max", "min"]), c: [g.int(-3, 9), g.int(-3, 9)], cons };
}

test("LPP: random problems agree with Fourier–Motzkin elimination", () => {
  const g = R(11);
  const seen = { infeasible: 0, unbounded: 0, unique: 0, multiple: 0 };
  for (let t = 0; t < 3000 * K; t++) {
    const p = randomLpp(g);
    const rows = asRows(p), sign = p.sense === "max" ? 1 : -1, o = [sign * p.c[0], sign * p.c[1]];
    const want = fmMax(rows, o);
    const got = lpp.solve(p);
    const tag = JSON.stringify(p);
    seen[got.status]++;
    if (want.status !== "optimal") { assert.equal(got.status, want.status, tag); continue; }
    assert.ok(["unique", "multiple"].includes(got.status), `${tag} gave ${got.status}`);
    assert.ok(close(got.z, sign * want.value), `${tag}: z ${got.z}, expected ${sign * want.value}`);
    for (const c of got.optimal) {
      assert.ok(close(c.z, got.z), tag);
      for (const [a1, a2, b] of rows) assert.ok(a1 * c.x + a2 * c.y <= b + 1e-6, `${tag}: corner ${c.x},${c.y} breaks a constraint`);
    }
    // Is the optimum a single point? Look at the range of x and y over the optimal face.
    const [num, den] = want.frac;
    const face = [...rows, [-den * o[0], -den * o[1], -num]];
    let spread = false;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const hi = fmMax(face, d), lo = fmMax(face, [-d[0], -d[1]]);
      if (hi.status === "unbounded" || lo.status === "unbounded" || hi.value + lo.value > 1e-9) spread = true;
    }
    assert.equal(got.status, spread ? "multiple" : "unique", tag);
  }
  for (const [k, v] of Object.entries(seen)) assert.ok(v > 20 * K, `too few ${k} cases (${v})`);
});

test("LPP: large and decimal data, scaled versions give scaled answers", () => {
  const g = R(12);
  for (let t = 0; t < 800 * K; t++) {
    const p = randomLpp(g);
    const base = lpp.solve(p);
    for (const s of [1e-3, 0.25, 1e4, 1e6]) {
      // Scaling every constraint row leaves the region alone; scaling the objective scales z.
      const q = { ...p, c: p.c.map((v) => v * s), cons: p.cons.map((k) => ({ ...k, a: k.a.map((v) => v * s), b: k.b * s })) };
      const got = lpp.solve(q);
      const tag = `${JSON.stringify(p)} × ${s}`;
      assert.equal(got.status, base.status, tag);
      if (base.z !== null) assert.ok(close(got.z, base.z * s, 1e-6), `${tag}: ${got.z} vs ${base.z * s}`);
    }
  }
});

// ---------- Network analysis against path enumeration ----------

function randomNetwork(g, decimals) {
  const n = g.int(3, 9);
  const names = Array.from({ length: n }, (_, k) => String(k + 1));
  // Shuffle the event names so the code cannot rely on numbering.
  for (let k = n - 1; k > 0; k--) { const j = g.int(0, k); [names[k], names[j]] = [names[j], names[k]]; }
  const acts = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || g.r() < 0.3) {
      const t = g.r() < 0.12 ? 0 : decimals ? Math.round(g.r() * 2000) / 100 : g.int(1, 12);
      acts.push({ id: `A${acts.length + 1}`, start: names[i], end: names[j], t });
    }
  }
  for (let k = acts.length - 1; k > 0; k--) { const j = g.int(0, k); [acts[k], acts[j]] = [acts[j], acts[k]]; }
  return acts;
}

function enumerate(acts) {
  const out = new Map(), into = new Map();
  for (const [k, x] of acts.entries()) {
    (out.get(x.start) ?? out.set(x.start, []).get(x.start)).push(k);
    (into.get(x.end) ?? into.set(x.end, []).get(x.end)).push(k);
  }
  const nodes = [...new Set(acts.flatMap((x) => [x.start, x.end]))];
  const starts = nodes.filter((v) => !into.has(v));
  const paths = [];
  const walk = (v, chain, len) => {
    if (!out.has(v)) { paths.push({ chain: chain.slice(), len }); return; }
    for (const k of out.get(v)) { chain.push(k); walk(acts[k].end, chain, len + acts[k].t); chain.pop(); }
  };
  for (const s of starts) walk(s, [], 0);
  // Longest time to reach each event, and from each event to the end.
  const to = new Map(), from = new Map();
  for (const p of paths) {
    let acc = 0;
    for (const k of p.chain) {
      const x = acts[k];
      to.set(x.start, Math.max(to.get(x.start) ?? 0, acc));
      acc += x.t;
      to.set(x.end, Math.max(to.get(x.end) ?? 0, acc));
      from.set(x.start, Math.max(from.get(x.start) ?? 0, p.len - acc + x.t));
      from.set(x.end, Math.max(from.get(x.end) ?? 0, p.len - acc));
    }
  }
  return { paths, total: Math.max(...paths.map((p) => p.len)), to, from };
}

test("CPM: random networks agree with listing every path", () => {
  const g = R(21);
  for (let t = 0; t < 2000 * K; t++) {
    const acts = randomNetwork(g, t % 2 === 1);
    const tag = JSON.stringify(acts.map((x) => [x.id, x.start, x.end, x.t]));
    assert.deepEqual(net.validate(acts), [], tag);
    const res = net.cpm(acts);
    const e = enumerate(acts);
    assert.ok(res.ok, tag);
    assert.ok(close(res.total, e.total, 1e-9), `${tag}: total ${res.total} vs ${e.total}`);
    acts.forEach((x, k) => {
      const r = res.rows[k];
      const Ei = e.to.get(x.start), Ej = e.to.get(x.end), Li = e.total - e.from.get(x.start), Lj = e.total - e.from.get(x.end);
      assert.ok(close(r.es, Ei, 1e-9) && close(r.lf, Lj, 1e-9), `${tag} ${x.id}`);
      assert.ok(close(r.tf, Lj - Ei - x.t, 1e-9), `${tag} ${x.id} total float`);
      assert.ok(close(r.ff, Ej - Ei - x.t, 1e-9), `${tag} ${x.id} free float`);
      assert.ok(close(r.ifl, Math.max(0, Ej - Li - x.t), 1e-9), `${tag} ${x.id} independent float`);
      assert.ok(r.tf >= 0 && r.ff >= 0 && r.ff <= r.tf + 1e-9, `${tag} ${x.id} float order`);
      assert.equal(r.critical, Math.abs(Lj - Ei - x.t) < 1e-9, `${tag} ${x.id} critical`);
    });
    const want = e.paths.filter((p) => Math.abs(p.len - e.total) < 1e-9).map((p) => p.chain.join(",")).sort();
    if (want.length <= net.MAX_PATHS) assert.deepEqual(res.paths.map((p) => p.join(",")).sort(), want, tag);
  }
});

test("PERT: random networks agree with listing every path; with a = m = b PERT equals CPM", () => {
  const g = R(22);
  for (let t = 0; t < 600 * K; t++) {
    const base = randomNetwork(g, false);
    const acts = base.map((x) => {
      if (x.t === 0) return { ...x, a: 0, m: 0, b: 0 };
      const a = g.int(1, 8), m = a + g.int(0, 6), b = m + g.int(0, 10);
      return { ...x, a, m, b };
    });
    const tag = JSON.stringify(acts.map((x) => [x.start, x.end, x.a, x.m, x.b]));
    assert.deepEqual(net.validate(acts, "pert"), [], tag);
    const res = net.pert(acts);
    const e = enumerate(acts.map((x) => ({ ...x, t: (x.a + 4 * x.m + x.b) / 6 })));
    assert.ok(close(res.total, e.total, 1e-9), tag);
    const crit = e.paths.filter((p) => Math.abs(p.len - e.total) < 1e-7);
    const vmax = Math.max(...crit.map((p) => p.chain.reduce((s, k) => s + ((acts[k].b - acts[k].a) / 6) ** 2, 0)));
    if (crit.length <= net.MAX_PATHS) assert.ok(close(res.variance, vmax, 1e-9), `${tag}: variance ${res.variance} vs ${vmax}`);
    assert.ok(close(res.sd, Math.sqrt(res.variance), 1e-12), tag);
    const fixed = acts.map((x) => ({ ...x, a: x.m, b: x.m }));
    const p2 = net.pert(fixed), cpmT = net.cpm(fixed.map((x) => ({ ...x, t: x.m }))).total;
    assert.ok(close(p2.total, cpmT, 1e-9) && p2.variance === 0, tag);
  }
});

// ---------- Transportation against a min-cost flow ----------

// Successive shortest paths (Bellman–Ford), shipping min(S, D) units; prohibited routes are left out.
function minCostFlow(cost, supply, demand, sign) {
  const m = supply.length, n = demand.length, N = m + n + 2, S = m + n, T = m + n + 1;
  const edges = [], adj = Array.from({ length: N }, () => []);
  const add = (u, v, cap, c) => { adj[u].push(edges.length); edges.push({ u, v, cap, c }); adj[v].push(edges.length); edges.push({ u: v, v: u, cap: 0, c: -c }); };
  supply.forEach((s, i) => add(S, i, s, 0));
  demand.forEach((d, j) => add(m + j, T, d, 0));
  cost.forEach((r, i) => r.forEach((c, j) => { if (Number.isFinite(c)) add(i, m + j, Infinity, sign * c); }));
  const need = Math.min(supply.reduce((a, b) => a + b, 0), demand.reduce((a, b) => a + b, 0));
  let flow = 0, total = 0;
  while (need - flow > 1e-9) {
    const dist = new Array(N).fill(Infinity), via = new Array(N).fill(-1);
    dist[S] = 0;
    for (let it = 0; it < N; it++) {
      let changed = false;
      for (const [k, e] of edges.entries()) if (e.cap > 1e-12 && dist[e.u] + e.c < dist[e.v] - 1e-12) { dist[e.v] = dist[e.u] + e.c; via[e.v] = k; changed = true; }
      if (!changed) break;
    }
    if (dist[T] === Infinity) return { feasible: false };
    let push = need - flow;
    for (let v = T; v !== S; v = edges[via[v]].u) push = Math.min(push, edges[via[v]].cap);
    for (let v = T; v !== S; v = edges[via[v]].u) { edges[via[v]].cap -= push; edges[via[v] ^ 1].cap += push; }
    flow += push; total += push * dist[T];
  }
  return { feasible: true, cost: sign * total };
}

function randomTransport(g, mode) {
  const m = g.int(1, 5), n = g.int(1, 5);
  const scale = mode === "large" ? g.pick([1e5, 1e6, 3e7, 1e9]) : 1;
  const cell = () => {
    if (g.r() < 0.12) return Infinity;
    if (mode === "decimal") return Math.round(g.r() * 4000) / 100;
    return g.int(0, 40) * scale;
  };
  const amount = () => (mode === "decimal" && g.r() < 0.5 ? Math.round(g.r() * 1000) / 10 + 0.5 : g.int(1, 60));
  return { sense: g.r() < 0.3 ? "max" : "min", cost: Array.from({ length: m }, () => Array.from({ length: n }, cell)), supply: Array.from({ length: m }, amount), demand: Array.from({ length: n }, amount) };
}

for (const mode of ["normal", "decimal", "large"]) {
  test(`transportation: random ${mode} problems agree with a min-cost flow (all three starting methods)`, () => {
    const g = R({ normal: 31, decimal: 32, large: 33 }[mode]);
    for (let t = 0; t < 700 * K; t++) {
      const p = randomTransport(g, mode);
      if (p.cost.flat().every((c) => c === Infinity)) continue;
      const tag = JSON.stringify(p, (k, v) => (v === Infinity ? "M" : v));
      assert.deepEqual(tp.validate(p), [], tag);
      const want = minCostFlow(p.cost, p.supply, p.demand, p.sense === "max" ? -1 : 1);
      for (const method of ["nwc", "lcm", "vam"]) {
        const res = tp.solve(p, method);
        assert.ok(res.opt.optimal, `${tag} ${method}: MODI did not finish`);
        // The allocation must meet every supply and demand of the balanced table.
        res.q.supply.forEach((s, i) => assert.ok(close(res.opt.x[i].reduce((a, b) => a + (b ?? 0), 0), s, 1e-9), `${tag} ${method} row ${i}`));
        res.q.demand.forEach((d, j) => assert.ok(close(res.opt.x.reduce((a, r) => a + (r[j] ?? 0), 0), d, 1e-9), `${tag} ${method} col ${j}`));
        assert.equal(res.feasible, want.feasible, `${tag} ${method}: feasible`);
        if (want.feasible) assert.ok(close(res.finalTotal.cost, want.cost, 1e-9), `${tag} ${method}: ${res.finalTotal.cost} vs ${want.cost}`);
      }
    }
  });
}

// ---------- Assignment against trying every assignment ----------

function bestAssignment(cost, sense) {
  const r0 = cost.length, c0 = cost[0].length, n = Math.max(r0, c0);
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i < r0 && j < c0 ? cost[i][j] : 0)));
  let best = null;
  const perm = [], used = new Array(n).fill(false);
  const go = (i, acc) => {
    if (i === n) { if (best === null || (sense === "max" ? acc > best : acc < best)) best = acc; return; }
    for (let j = 0; j < n; j++) if (!used[j] && Number.isFinite(A[i][j])) { used[j] = true; perm.push(j); go(i + 1, acc + A[i][j]); perm.pop(); used[j] = false; }
  };
  go(0, 0);
  return best;
}

for (const mode of ["normal", "decimal", "large", "negative"]) {
  test(`assignment: random ${mode} problems agree with trying every assignment`, () => {
    const g = R({ normal: 41, decimal: 42, large: 43, negative: 44 }[mode]);
    for (let t = 0; t < 800 * K; t++) {
      const rows = g.int(1, 6), cols = g.int(1, 6);
      const scale = mode === "large" ? g.pick([1e5, 1e6, 2.5e7, 1e9]) : 1;
      const cell = () => {
        if (g.r() < 0.15) return Infinity;
        if (mode === "decimal") return Math.round(g.r() * 5000) / 100;
        if (mode === "negative") return g.int(-30, 30);
        return g.int(0, 50) * scale;
      };
      const p = { sense: g.r() < 0.3 ? "max" : "min", cost: Array.from({ length: rows }, () => Array.from({ length: cols }, cell)) };
      const tag = JSON.stringify(p, (k, v) => (v === Infinity ? "M" : v));
      if (p.cost.flat().every((c) => c === Infinity)) continue;
      assert.deepEqual(asg.validate(p), [], tag);
      const want = bestAssignment(p.cost, p.sense);
      const res = asg.solve(p);
      if (want === null) { assert.ok(!res.ok || res.usesM, `${tag}: should be impossible`); continue; }
      assert.ok(res.ok, `${tag}: ${res.error}`);
      assert.equal(res.usesM, false, tag);
      assert.ok(close(res.total, want, 1e-9), `${tag}: ${res.total} vs ${want}`);
      const cs = res.pairs.map((x) => x.col);
      assert.equal(new Set(cs).size, cs.length, tag);
      // The tables shown to students must never turn a real value into M.
      for (const s of res.steps) s.table.forEach((r, i) => r.forEach((v, j) => {
        if (i < rows && j < cols && Number.isFinite(p.cost[i][j])) assert.ok(Number.isFinite(v), `${tag}: step "${s.title}" shows M at (${i + 1}, ${j + 1})`);
      }));
    }
  });
}

// ---------- Games: the answer must come with an optimality certificate ----------

for (const mode of ["normal", "decimal", "large"]) {
  test(`games: random ${mode} matrices give strategies that prove the value`, () => {
    const g = R({ normal: 51, decimal: 52, large: 53 }[mode]);
    for (let t = 0; t < 1500 * K; t++) {
      const m = g.int(1, 5), n = g.int(1, 5);
      const scale = mode === "large" ? g.pick([1e4, 1e6, 1e9]) : 1;
      const cell = () => (mode === "decimal" ? Math.round((g.r() * 20 - 10) * 100) / 100 : g.int(-9, 9) * scale);
      const A = Array.from({ length: m }, () => Array.from({ length: n }, cell));
      const tag = JSON.stringify(A);
      const res = games.solve(A);
      const tol = 1e-6 * Math.max(1, ...A.flat().map(Math.abs));
      assert.ok(Number.isFinite(res.value), `${tag}: value ${res.value}`);
      for (const [v, name] of [[res.p, "p"], [res.q, "q"]]) {
        assert.ok(v.every((x) => x >= -1e-9 && x <= 1 + 1e-9), `${tag}: ${name} ${v}`);
        assert.ok(close(v.reduce((a, b) => a + b, 0), 1, 1e-7), `${tag}: ${name} sums to ${v.reduce((a, b) => a + b, 0)}`);
      }
      // A's mix earns at least the value against every column; B's mix concedes at most the value to every row.
      for (let j = 0; j < n; j++) assert.ok(A.reduce((s, r, i) => s + res.p[i] * r[j], 0) >= res.value - tol, `${tag}: A's mix fails column ${j + 1} (${res.method})`);
      for (let i = 0; i < m; i++) assert.ok(A[i].reduce((s, v, j) => s + res.q[j] * v, 0) <= res.value + tol, `${tag}: B's mix fails row ${i + 1} (${res.method})`);
    }
  });
}

// ---------- Monte Carlo random-number ranges ----------

test("Monte Carlo: random distributions give ranges that tile 0 … 10^d − 1 exactly", () => {
  const g = R(61);
  for (let t = 0; t < 3000 * K; t++) {
    const d = g.int(2, 4), scale = 10 ** d, k = g.int(1, 8);
    // Random whole-number counts out of `scale`, written as probabilities with d decimals.
    const cuts = Array.from({ length: k - 1 }, () => g.int(0, scale)).sort((a, b) => a - b);
    const counts = [...cuts, scale].map((c, i, arr) => c - (i ? arr[i - 1] : 0));
    const freq = g.r() < 0.3;
    const dist = counts.map((c, i) => ({ value: i * 5 + g.int(0, 4), p: freq ? c : Number((c / scale).toFixed(d)) }));
    const tag = JSON.stringify(dist);
    const res = mc.ranges(dist);
    if (freq) {
      // Frequencies need as many digits as their probabilities; some cannot be written in 4.
      if (res.errors.length) continue;
    } else assert.deepEqual(res.errors, [], tag);
    let next = 0;
    res.rows.forEach((row, i) => {
      if (row.empty) { assert.equal(counts[i], 0, tag); return; }
      assert.equal(row.lo, next, tag);
      assert.equal(row.hi - row.lo + 1, Math.round(counts[i] * res.scale / scale), tag);
      next = row.hi + 1;
    });
    assert.equal(next, res.scale, tag);
    for (let rn = 0; rn < res.scale; rn += Math.max(1, Math.floor(res.scale / 50))) assert.ok(mc.lookup(res, rn), `${tag}: ${rn} has no value`);
  }
});

// ---------- Each bug the stress tests found, kept as a named case ----------

test("found: an LPP corner was lost to rounding (min x + 5y, answer 241/57)", () => {
  const res = lpp.solve({ sense: "min", c: [1, 5], cons: [{ a: [4, 4], op: "<=", b: 51 }, { a: [3, 0], op: "<=", b: 16 }, { a: [9, 1], op: "<=", b: 1 }, { a: [6, 7], op: "=", b: 6 }] });
  assert.equal(res.status, "unique");
  assert.ok(close(res.z, 241 / 57));
});

test("found: an LPP written in lakhs lost its multiple optima, and an infeasible one became feasible", () => {
  const multi = lpp.solve({ sense: "max", c: [9e6, 2e6], cons: [{ a: [9e6, 2e6], op: "=", b: 3e6 }, { a: [0, 6e6], op: "<=", b: 1e7 }] });
  assert.equal(multi.status, "multiple");
  const none = lpp.solve({ sense: "max", c: [-1e6, 2e6], cons: [{ a: [1e6, 4e6], op: "=", b: -2e6 }] });
  assert.equal(none.status, "infeasible");
});

test("found: PERT missed a tied critical path because of rounding (te with sixths)", () => {
  // Two paths of equal expected length 25/6 + 25/6 + … made of sixths; both must count.
  const res = net.pert([
    { id: "A", start: "1", end: "2", a: 1, m: 4, b: 8 }, { id: "B", start: "2", end: "4", a: 1, m: 4, b: 8 },
    { id: "C", start: "1", end: "3", a: 2, m: 4, b: 7 }, { id: "D", start: "3", end: "4", a: 2, m: 4, b: 7 },
  ]);
  assert.equal(res.paths.length, 2);
  assert.ok(close(res.variance, 2 * (7 / 6) ** 2));
});

test("found: costs of 1,000,000 or more were read as M", () => {
  const a = asg.solve({ sense: "min", cost: [[2e6, 3e6], [4e6, 1e6]] });
  assert.ok(a.ok);
  assert.equal(a.total, 3e6);
  assert.ok(a.steps.every((s) => s.table.flat().every(Number.isFinite)));
  const t = tp.solve({ sense: "max", cost: [[3e7, 1e7], [2e7, Infinity]], supply: [5, 5], demand: [5, 5] });
  assert.equal(t.feasible, true);
  assert.equal(t.finalTotal.cost, 5 * 1e7 + 5 * 2e7);
});

test("found: MODI went round in circles with costs in the hundreds of crores", () => {
  const I = Infinity;
  const p = { sense: "min", cost: [[0, 7.5e8, 7.8e8, I, I], [7.2e8, 2.7e8, 8.1e8, 1.5e8, I], [1.17e9, 1.14e9, 4.2e8, 8.7e8, I]], supply: [51, 55, 44], demand: [4, 23, 10, 4, 60] };
  for (const m of ["nwc", "lcm", "vam"]) {
    const r = tp.solve(p, m);
    assert.ok(r.opt.optimal, m);
    assert.equal(r.feasible, false, m); // destination 5 can only be reached by M routes
  }
  p.cost.forEach((r) => (r[4] = 9e8));
  const want = minCostFlow(p.cost, p.supply, p.demand, 1).cost;
  for (const m of ["nwc", "lcm", "vam"]) {
    const r = tp.solve(p, m);
    assert.ok(r.opt.optimal && close(r.finalTotal.cost, want), m);
  }
});

test("found: game values in the crores broke the LP and graphical tolerances", () => {
  const A = [[-4e9, 8e9, 5e9, -2e9, 6e9], [-9e9, -9e9, -3e9, -8e9, 6e9], [9e9, -8e9, 9e9, 7e9, -5e9], [-6e9, 2e9, -1e9, 4e9, 2e9], [-3e9, 7e9, -9e9, -5e9, -4e9]];
  const res = games.solve(A);
  for (let j = 0; j < 5; j++) assert.ok(A.reduce((s, r, i) => s + res.p[i] * r[j], 0) >= res.value - 1e-6 * 9e9);
  for (let i = 0; i < 5; i++) assert.ok(A[i].reduce((s, v, j) => s + res.q[j] * v, 0) <= res.value + 1e-6 * 9e9);
});

test("found: a table where everything is M gave “−Infinity”; it is now refused with a message", () => {
  assert.equal(tp.validate({ sense: "max", cost: [[Infinity, Infinity]], supply: [5], demand: [2, 3] }).length, 1);
  assert.equal(asg.validate({ sense: "max", cost: [[Infinity, Infinity], [Infinity, Infinity]] }).length, 1);
});

test("found: frequencies 1, 1, 1, 1 were taken for probabilities that do not add up", () => {
  const res = mc.ranges([1, 2, 3, 4].map((value) => ({ value, p: 1 })));
  assert.deepEqual(res.errors, []);
  assert.equal(res.fromFrequencies, true);
  assert.deepEqual(res.rows.map((r) => [r.lo, r.hi]), [[0, 24], [25, 49], [50, 74], [75, 99]]);
  assert.ok(mc.ranges([{ value: 1, p: 0.5 }, { value: 2, p: 0.4 }]).errors.length);
});

test("found: the tie allowance must stay tiny, so 1,000,000,000 and 999,999,999.5 days are not both critical", () => {
  const res = net.cpm([{ id: "A", start: "1", end: "2", t: 1e9 }, { id: "B", start: "1", end: "3", t: 999999999.5 }, { id: "C", start: "3", end: "2", t: 0 }]);
  assert.deepEqual(res.critical, ["A"]);
  assert.equal(res.paths.length, 1);
});
