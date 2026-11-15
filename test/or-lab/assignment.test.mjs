import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, validate } from "../../src/assets/or-lab/lib/assignment.js";

// Best total by trying every possible assignment (rows <= columns).
function brute(cost, sense) {
  const n = cost.length, m = cost[0].length;
  let best = sense === "max" ? -Infinity : Infinity;
  const used = new Array(m).fill(false);
  const go = (i, s) => {
    if (i === n) { best = sense === "max" ? Math.max(best, s) : Math.min(best, s); return; }
    for (let j = 0; j < m; j++) if (!used[j] && Number.isFinite(cost[i][j])) { used[j] = true; go(i + 1, s + cost[i][j]); used[j] = false; }
  };
  go(0, 0);
  return best;
}

test("a 4 × 4 problem worked by hand", () => {
  // Row minimums are 8, 7, 6 and 9; after that the column minimums are 0, 0, 3 and 0.
  // The total is checked against every possible assignment.
  const cost = [[10, 9, 11, 8], [10, 7, 12, 9], [12, 8, 9, 6], [9, 11, 14, 10]];
  const r = solve({ sense: "min", cost });
  assert.equal(r.ok, true);
  assert.equal(r.total, brute(cost, "min"));
  assert.equal(new Set(r.pairs.map((x) => x.col)).size, 4);
  assert.deepEqual(r.steps[1].table[0], [2, 1, 3, 0]);
});

test("rectangular and maximisation problems", () => {
  const rect = [[9, 12, 7], [7, 3, 5], [9, 8, 6], [6, 9, 10]]; // 4 workers, 3 jobs: one worker idles
  const r = solve({ sense: "min", cost: rect });
  assert.equal(r.n, 4);
  assert.equal(r.pairs.filter((x) => x.dummy).length, 1);
  assert.equal(r.total, brute(rect[0].map((_, j) => rect.map((row) => row[j])), "min")); // columns into rows
  const sales = [[42, 35, 28, 21], [30, 25, 20, 15], [30, 25, 20, 15], [24, 20, 16, 12]];
  const mx = solve({ sense: "max", cost: sales });
  assert.equal(mx.total, brute(sales, "max"));
  assert.ok(mx.notes[0].includes("42"));
});

test("cells marked M are never used", () => {
  const cost = [[Infinity, 4, 6], [3, Infinity, 2], [5, 1, Infinity]];
  const r = solve({ sense: "min", cost });
  assert.equal(r.total, brute(cost, "min"));
  assert.ok(r.pairs.every((x) => Number.isFinite(x.value)));
  const bad = solve({ sense: "min", cost: [[Infinity, Infinity], [1, 2]] });
  assert.equal(bad.ok, false);
});

test("alternative optimal assignments are detected", () => {
  const tie = solve({ sense: "min", cost: [[1, 1], [1, 1]] });
  assert.equal(tie.alternative, true);
  const one = solve({ sense: "min", cost: [[1, 5], [5, 1]] });
  assert.equal(one.alternative, false);
});

test("random problems match brute force", () => {
  let seed = 5;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(r() * 5);
    const cost = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(r() * 30)));
    const sense = r() < 0.5 ? "min" : "max";
    assert.equal(solve({ sense, cost }).total, brute(cost, sense));
  }
});

test("validation", () => {
  assert.ok(validate({ cost: [[1, 2], [3]] }).length);
  assert.ok(validate({ cost: [[1, NaN]] })[0].includes("Cell (1, 2)"));
});
