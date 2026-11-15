import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, prepare, northWest, leastCost, vogel, totalCost, validate, modi } from "../../src/assets/or-lab/lib/transport.js";

// A classic textbook problem (costs in rupees).
const classic = { sense: "min", cost: [[19, 30, 50, 10], [70, 30, 40, 60], [40, 8, 70, 20]], supply: [7, 9, 18], demand: [5, 8, 7, 14] };

// Optimality certificate: by LP duality, a feasible allocation whose cost equals Σ s·u + Σ d·v with
// every c - u - v >= 0 is optimal, whatever route the algorithm took to get there.
function assertOptimal(q, res) {
  const last = res.opt.iterations.at(-1);
  assert.equal(last.optimal, true);
  q.supply.forEach((s, i) => assert.equal(res.opt.x[i].reduce((a, b) => a + (b ?? 0), 0), s));
  q.demand.forEach((d, j) => assert.equal(res.opt.x.reduce((a, r) => a + (r[j] ?? 0), 0), d));
  let dual = 0;
  q.supply.forEach((s, i) => (dual += s * last.u[i]));
  q.demand.forEach((d, j) => (dual += d * last.v[j]));
  let primal = 0;
  res.opt.x.forEach((r, i) => r.forEach((a, j) => { if (a) primal += a * q.cost[i][j]; }));
  assert.ok(Math.abs(primal - dual) < 1e-6, `primal ${primal} dual ${dual}`);
  for (let i = 0; i < q.m; i++) for (let j = 0; j < q.n; j++) assert.ok(q.cost[i][j] - last.u[i] - last.v[j] > -1e-9);
}

test("starting solutions worked by hand: NWC 1015, least cost 814, VAM 779", () => {
  const q = prepare(classic);
  // NWC: (1,1)=5 (1,2)=2 (2,2)=6 (2,3)=3 (3,3)=4 (3,4)=14.
  const n = northWest(q);
  assert.deepEqual(n.x, [[5, 2, null, null], [null, 6, 3, null], [null, null, 4, 14]]);
  assert.equal(totalCost(classic.cost, n.x).cost, 1015);
  // Least cost: 8 at (3,2)=8, 10 at (1,4)=7, 20 at (3,4)=7, then a tie at 40 won by (2,3)=7 (larger), (2,1)=2, (3,1)=3.
  const l = leastCost(q);
  assert.deepEqual(l.x, [[null, null, null, 7], [2, null, 7, null], [3, 8, null, 7]]);
  assert.equal(totalCost(classic.cost, l.x).cost, 814);
  // VAM: column 2 (penalty 22) -> (3,2)=8; column 1 (21) -> (1,1)=5; row 3 (50) -> (3,4)=10;
  // column 4 (50) -> (1,4)=2; row 2 is left: (2,3)=7, (2,4)=2.
  const v = vogel(q);
  assert.deepEqual(v.x, [[5, null, null, 2], [null, null, 7, 2], [null, 8, null, 10]]);
  assert.equal(totalCost(classic.cost, v.x).cost, 779);
  assert.equal(v.steps[0].colPen[1].pen, 22);
});

test("MODI reaches the same optimum, 743, from every starting method", () => {
  for (const m of ["nwc", "lcm", "vam"]) {
    const res = solve(classic, m);
    assert.equal(res.finalTotal.cost, 743, m);
    assertOptimal(res.q, res);
  }
});

test("unbalanced problems get a dummy row or column", () => {
  const extraSupply = { sense: "min", cost: [[4, 8, 8], [16, 24, 16], [8, 16, 24]], supply: [76, 82, 77], demand: [72, 102, 41] };
  const r = solve(extraSupply, "vam");
  assert.equal(r.q.dummy, "col");
  assert.equal(r.q.demand.at(-1), 20);
  assertOptimal(r.q, r);
  const extraDemand = { sense: "min", cost: [[2, 3], [4, 1]], supply: [10, 10], demand: [12, 15] };
  const r2 = solve(extraDemand, "nwc");
  assert.equal(r2.q.dummy, "row");
  assertOptimal(r2.q, r2);
});

test("degenerate problems are handled with an ε allocation", () => {
  // Supply 1 meets demand 1 exactly at the first NWC step, so NWC gives only 2 of the 3 needed allocations.
  const p = { sense: "min", cost: [[3, 5], [6, 2]], supply: [10, 15], demand: [10, 15] };
  const q = prepare(p);
  const n = northWest(q);
  assert.equal(n.x.flat().filter((a) => a !== null).length, 2);
  const res = solve(p, "nwc");
  assert.equal(res.opt.iterations[0].eps.length, 1);
  assert.equal(res.finalTotal.cost, 10 * 3 + 15 * 2);
  assertOptimal(res.q, res);
});

test("maximisation works through regrets", () => {
  // Profits; the best plan sends 10 from A to Y (profit 9) and 10 from B to X (profit 8) = 170.
  const p = { sense: "max", cost: [[5, 9], [8, 4]], supply: [10, 10], demand: [10, 10] };
  const res = solve(p, "vam");
  assert.equal(res.finalTotal.cost, 170);
  assertOptimal(res.q, res);
});

test("prohibited routes (M) are avoided", () => {
  const p = { sense: "min", cost: [[Infinity, 2], [1, 3]], supply: [5, 5], demand: [5, 5] };
  for (const m of ["nwc", "lcm", "vam"]) {
    const res = solve(p, m);
    assert.equal(res.feasible, true, m);
    assert.ok(!res.opt.x[0][0], m); // no goods on the prohibited route (a zero basic cell is allowed)
    assert.equal(res.finalTotal.cost, 5 * 2 + 5 * 1, m);
  }
});

test("random problems: MODI's answer is always certified optimal", () => {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 200; t++) {
    const m = 2 + Math.floor(r() * 3), n = 2 + Math.floor(r() * 3);
    const cost = Array.from({ length: m }, () => Array.from({ length: n }, () => 1 + Math.floor(r() * 20)));
    const supply = Array.from({ length: m }, () => 1 + Math.floor(r() * 30));
    const demand = Array.from({ length: n }, () => 1 + Math.floor(r() * 30));
    for (const meth of ["nwc", "lcm", "vam"]) {
      const res = solve({ sense: "min", cost, supply, demand }, meth);
      assertOptimal(res.q, res);
    }
  }
});

test("validation", () => {
  assert.ok(validate({ cost: [[1, NaN]], supply: [1], demand: [1, 2] }).some((e) => e.includes("Cell (1, 2)")));
  assert.ok(validate({ cost: [[1]], supply: [0], demand: [1] }).some((e) => e.includes("Supply")));
  assert.ok(modi);
});
