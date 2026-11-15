// Network analysis checked against examples worked out by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpm, pert, validate, probabilityBy, timeFor } from "../../src/assets/or-lab/lib/network.js";
import { normCdf, normInv } from "../../src/assets/or-lab/lib/num.js";

const A = (rows) => rows.map(([id, start, end, t]) => ({ id, start, end, t }));
const P = (rows) => rows.map(([id, start, end, a, m, b]) => ({ id, start, end, a, m, b }));
const row = (res, id) => res.rows.find((r) => r.id === id);
const ids = (res, path) => path.map((k) => res.rows[k].id);

test("office example from the CPM note on inigo.co.in", () => {
  // E: 1=0, 2=3, 3=max(4, 5)=5, 4=max(8, 9)=9, 5=12.  L: 5=12, 4=9, 3=5, 2=min(3, 4)=3, 1=0.
  const res = cpm(A([["A", "1", "2", 3], ["B", "1", "3", 4], ["C", "2", "3", 2], ["D", "2", "4", 5], ["E", "3", "4", 4], ["F", "4", "5", 3]]));
  assert.equal(res.total, 12);
  assert.deepEqual(Object.fromEntries(res.early), { 1: 0, 2: 3, 3: 5, 4: 9, 5: 12 });
  assert.deepEqual(Object.fromEntries(res.late), { 1: 0, 2: 3, 3: 5, 4: 9, 5: 12 });
  const want = { A: [0, 3, 0, 3, 0, 0, 0], B: [0, 4, 1, 5, 1, 1, 1], C: [3, 5, 3, 5, 0, 0, 0], D: [3, 8, 4, 9, 1, 1, 1], E: [5, 9, 5, 9, 0, 0, 0], F: [9, 12, 9, 12, 0, 0, 0] };
  for (const [id, v] of Object.entries(want)) {
    const r = row(res, id);
    assert.deepEqual([r.es, r.ef, r.ls, r.lf, r.tf, r.ff, r.ifl], v, id);
  }
  assert.deepEqual(res.paths.map((p) => ids(res, p)), [["A", "C", "E", "F"]]);
  assert.equal(res.warnings.length, 0);
});

test("practice question with two critical paths (13 days)", () => {
  const res = cpm(A([["P", "1", "2", 4], ["Q", "1", "3", 6], ["R", "2", "3", 3], ["S", "2", "4", 5], ["T", "3", "4", 2], ["U", "4", "5", 4]]));
  assert.equal(res.total, 13);
  assert.deepEqual(res.paths.map((p) => ids(res, p)).sort(), [["P", "R", "T", "U"], ["P", "S", "U"]]);
  assert.deepEqual([row(res, "Q").tf, row(res, "Q").ff], [1, 1]);
});

test("dummy activity with zero duration", () => {
  // E: 1=0, 2=3, 3=max(4, 3)=4, 4=max(8, 6)=8.  L: 4=8, 3=6, 2=min(3, 6)=3, 1=0.
  const res = cpm(A([["A", "1", "2", 3], ["B", "1", "3", 4], ["D1", "2", "3", 0], ["C", "2", "4", 5], ["D", "3", "4", 2]]));
  assert.equal(res.total, 8);
  const d = row(res, "D1");
  assert.equal(d.dummy, true);
  assert.deepEqual([d.tf, d.ff, d.ifl], [3, 1, 1]);
  assert.deepEqual([row(res, "B").tf, row(res, "B").ff, row(res, "B").ifl], [2, 0, 0]);
  assert.deepEqual([row(res, "D").tf, row(res, "D").ff, row(res, "D").ifl], [2, 2, 0]);
  assert.deepEqual(res.paths.map((p) => ids(res, p)), [["A", "C"]]);
});

test("independent float is shown as zero when negative", () => {
  // E: 1=0, 2=1, 4=2, 3=max(3, 4)=4, 5=10.  L: 5=10, 3=9, 4=7, 2=7.  B: 4 - 7 - 2 = -5 -> 0, free float 1.
  const res = cpm(A([["A", "1", "2", 1], ["B", "2", "3", 2], ["C", "3", "5", 1], ["X", "1", "4", 2], ["D", "4", "3", 2], ["F", "1", "5", 10]]));
  assert.equal(res.late.get("2"), 7);
  assert.deepEqual([row(res, "B").ff, row(res, "B").ifl], [1, 0]);
});

test("loops, duplicates and bad input are reported", () => {
  const loop = cpm(A([["A", "1", "2", 2], ["B", "2", "3", 2], ["C", "3", "1", 2]]));
  assert.equal(loop.ok, false);
  assert.match(loop.errors[0], /1 → 2 → 3 → 1/);
  const e = validate(A([["A", "1", "2", 3], ["A", "2", "3", 1], ["B", "1", "2", 4], ["C", "4", "4", 1], ["D", "5", "6", -1], ["", "6", "7", 1]]));
  assert.ok(e.some((m) => m.includes("used twice")));
  assert.ok(e.some((m) => m.includes("dummy activity") && m.includes("both run")));
  assert.ok(e.some((m) => m.includes("must be different")));
  assert.ok(e.some((m) => m.includes("cannot be negative")));
  assert.ok(e.some((m) => m.includes("give the activity an ID")));
  assert.deepEqual(validate([]), ["Add at least one activity."]);
  assert.ok(validate(P([["A", "1", "2", 5, 3, 8]]), "pert")[0].includes("a ≤ m ≤ b"));
});

test("disconnected networks warn, decimals have no rounding noise", () => {
  const res = cpm(A([["A", "1", "2", 2], ["B", "3", "4", 5]]));
  assert.equal(res.warnings.length, 2);
  const dec = cpm(A([["A", "1", "2", 0.1], ["B", "2", "3", 0.2], ["C", "1", "3", 0.3], ["D", "3", "4", 1]]));
  assert.equal(dec.total, 1.3);
  assert.equal(dec.paths.length, 2);
  assert.ok(dec.rows.every((r) => r.tf === 0));
});

test("many critical paths are capped at 50", () => {
  const rows = [];
  for (let k = 0; k < 7; k++) rows.push([`P${k}`, `${k}`, `${k + 1}`, 1], [`Q${k}`, `${k}`, `m${k}`, 1], [`D${k}`, `m${k}`, `${k + 1}`, 0]);
  const res = cpm(A(rows));
  assert.equal(res.paths.length, 50);
  assert.equal(res.truncated, true);
});

test("PERT expected times, variances and probability (worked by hand)", () => {
  // te: A=(2+16+6)/6=4, B=(3+20+13)/6=6, C=(1+8+3)/6=2, D=(2+12+10)/6=4, E=(4+24+8)/6=6.
  // E: 2=4, 3=6, 4=max(6, 10)=10, 5=16. Critical path B-D-E.
  // Variance = (10/6)^2 + (8/6)^2 + (4/6)^2 = (100 + 64 + 16)/36 = 5.
  const res = pert(P([["A", "1", "2", 2, 4, 6], ["B", "1", "3", 3, 5, 13], ["C", "2", "4", 1, 2, 3], ["D", "3", "4", 2, 3, 10], ["E", "4", "5", 4, 6, 8]]));
  assert.equal(res.total, 16);
  assert.deepEqual(res.rows.map((r) => r.t), [4, 6, 2, 4, 6]);
  assert.deepEqual(res.paths.map((p) => ids(res, p)), [["B", "D", "E"]]);
  assert.equal(res.variance, 5);
  const { z, p } = probabilityBy(res.total, res.sd, 18);
  assert.equal(z.toFixed(4), "0.8944");
  assert.equal(p.toFixed(4), "0.8145");
  const back = timeFor(res.total, res.sd, p);
  assert.ok(Math.abs(back.T - 18) < 1e-9);
});

test("with two critical paths, PERT uses the larger variance", () => {
  // Paths 1-2-4 (A, C) and 1-3-4 (B, D) both take te = 10.
  // Variances: A+C = 1 + 0 = 1; B+D = 0 + 4 = 4.
  const res = pert(P([["A", "1", "2", 2, 5, 8], ["B", "1", "3", 4, 4, 4], ["C", "2", "4", 5, 5, 5], ["D", "3", "4", 0, 6, 12]]));
  assert.equal(res.total, 10);
  assert.equal(res.paths.length, 2);
  assert.equal(res.variance, 4);
});

test("probability edge cases", () => {
  assert.deepEqual(probabilityBy(10, 0, 10), { z: Infinity, p: 1 });
  assert.deepEqual(probabilityBy(10, 0, 9), { z: -Infinity, p: 0 });
  assert.equal(normCdf(0), 0.5);
  assert.equal(normCdf(1.96).toFixed(4), "0.9750");
  assert.equal(normCdf(-1).toFixed(4), "0.1587");
  assert.equal(normInv(0.95).toFixed(3), "1.645");
});
