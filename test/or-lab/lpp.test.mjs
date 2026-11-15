import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, redundant, standardForm, validate, clipped } from "../../src/assets/or-lab/lib/lpp.js";

const C = (a1, a2, op, b) => ({ a: [a1, a2], op, b });
const pt = (r) => r.optimal.map((o) => [o.x, o.y]);

test("worked example from the LPP note: 9 tables, 12 chairs, ₹8,100", () => {
  const r = solve({ sense: "max", c: [500, 300], cons: [C(4, 2, "<=", 60), C(2, 3, "<=", 54)] });
  assert.equal(r.status, "unique");
  assert.deepEqual(pt(r), [[9, 12]]);
  assert.equal(r.z, 8100);
  const corners = r.corners.map((c) => `${c.x},${c.y}=${c.z}`).sort();
  assert.deepEqual(corners, ["0,0=0", "0,18=5400", "15,0=7500", "9,12=8100"]);
  assert.ok(r.usage.every((u) => u.binding));
});

test("practice problems from the LPP note", () => {
  const p1 = solve({ sense: "max", c: [40, 30], cons: [C(1, 1, "<=", 12), C(2, 1, "<=", 16)] });
  assert.deepEqual([pt(p1), p1.z], [[[4, 8]], 400]);
  const p2 = solve({ sense: "min", c: [3, 5], cons: [C(1, 3, ">=", 3), C(1, 1, ">=", 2)] });
  assert.deepEqual([pt(p2), p2.z], [[[1.5, 0.5]], 7]);
  assert.equal(p2.boundedRegion, false); // an open region, but the minimum still exists
  const p3 = solve({ sense: "max", c: [60, 40], cons: [C(2, 1, "<=", 40), C(1, 1, "<=", 30)] });
  assert.deepEqual([pt(p3), p3.z], [[[10, 20]], 1400]);
});

test("unbounded, infeasible and multiple optima", () => {
  const u = solve({ sense: "max", c: [3, 5], cons: [C(1, 3, ">=", 3), C(1, 1, ">=", 2)] });
  assert.equal(u.status, "unbounded");
  const inf = solve({ sense: "max", c: [1, 1], cons: [C(1, 1, "<=", 2), C(1, 1, ">=", 5)] });
  assert.equal(inf.status, "infeasible");
  // Z = 2x + 2y is parallel to x + y <= 4: every point from (4, 0) to (2, 2) is optimal (Z = 8).
  const m = solve({ sense: "max", c: [2, 2], cons: [C(1, 1, "<=", 4), C(0, 1, "<=", 2)] });
  assert.equal(m.status, "multiple");
  assert.deepEqual(pt(m).sort(), [[2, 2], [4, 0]]);
  assert.equal(m.z, 8);
  // Minimise y with y >= 1 and x free to grow: optimal all along an unbounded edge.
  const ray = solve({ sense: "min", c: [0, 1], cons: [C(0, 1, ">=", 1)] });
  assert.equal(ray.status, "multiple");
  assert.deepEqual(ray.optimalRay, [1, 0]);
});

test("equality constraints and a minimisation with surplus", () => {
  const r = solve({ sense: "min", c: [2, 3], cons: [C(1, 1, "=", 10), C(1, 0, "<=", 6)] });
  assert.deepEqual([pt(r), r.z], [[[6, 4]], 24]);
  assert.deepEqual(r.usage.map((u) => u.binding), [true, true]);
});

test("redundant constraint is found", () => {
  // x <= 20 adds nothing once x + y <= 10.
  assert.deepEqual(redundant({ sense: "max", c: [1, 1], cons: [C(1, 1, "<=", 10), C(1, 0, "<=", 20), C(0, 1, "<=", 4)] }), [false, true, false]);
});

test("standard form uses slack and surplus and keeps the right-hand side non-negative", () => {
  const sf = standardForm({ sense: "max", c: [5, 4], cons: [C(1, 2, "<=", 8), C(3, 1, ">=", 3), C(1, -1, "<=", -2), C(1, 1, "=", 5)] });
  assert.deepEqual(sf.rows.map((r) => [r.op, r.b, r.extra && r.extra.name, r.extra && r.extra.kind]),
    [["<=", 8, "s1", "slack"], [">=", 3, "s2", "surplus"], [">=", 2, "s3", "surplus"], ["=", 5, null, null]]);
  assert.deepEqual(sf.rows[2].a, [-1, 1]);
  assert.equal(sf.rows[2].flipped, true);
});

test("validation and clipping", () => {
  assert.ok(validate({ c: [1, NaN], cons: [] }).length === 2);
  assert.ok(validate({ c: [1, 1], cons: [C(0, 0, "<=", 3)] })[0].includes("non-zero"));
  const poly = clipped({ sense: "min", c: [3, 5], cons: [C(1, 3, ">=", 3), C(1, 1, ">=", 2)] }, 5, 5);
  // (0, 2), (0, 5), (5, 5), (5, 0), (3, 0) and the corner (1.5, 0.5).
  assert.deepEqual(poly.map((q) => q.join(",")).sort(), ["0,2", "0,5", "1.5,0.5", "3,0", "5,0", "5,5"]);
});
