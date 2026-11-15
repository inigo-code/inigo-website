import { test } from "node:test";
import assert from "node:assert/strict";
import { solve, saddle, reduce, lpSolve, validate } from "../../src/assets/or-lab/lib/games.js";

// A solution is optimal when A's mix guarantees at least v against every column
// and B's mix concedes at most v against every row.
function assertOptimal(A, r) {
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(sum(r.p) - 1) < 1e-7 && Math.abs(sum(r.q) - 1) < 1e-7, "mixes add to 1");
  assert.ok(r.p.every((x) => x > -1e-9) && r.q.every((x) => x > -1e-9), "no negative probabilities");
  for (let j = 0; j < A[0].length; j++) assert.ok(A.reduce((s, row, i) => s + r.p[i] * row[j], 0) >= r.value - 1e-7, `column ${j}`);
  for (let i = 0; i < A.length; i++) assert.ok(A[i].reduce((s, v, j) => s + v * r.q[j], 0) <= r.value + 1e-7, `row ${i}`);
}

test("saddle point worked by hand", () => {
  // Row minimums 2, 4, 3 -> maximin 4. Column maximums 8, 9, 4, 8 -> minimax 4. Saddle point at (2, 3).
  const A = [[8, 6, 2, 8], [8, 9, 4, 5], [7, 5, 3, 5]];
  const s = saddle(A);
  assert.deepEqual([s.maximin, s.minimax, s.points], [4, 4, [[1, 2]]]);
  const r = solve(A);
  assert.equal(r.method, "saddle");
  assert.equal(r.value, 4);
  assertOptimal(A, r);
});

test("2 × 2 mixed strategies worked by hand", () => {
  // [[5, 1], [3, 4]]: denominator (5 + 4) - (1 + 3) = 5. p = (4 - 3)/5 = 1/5, q = (4 - 1)/5 = 3/5, v = (20 - 3)/5 = 3.4.
  const A = [[5, 1], [3, 4]];
  const r = solve(A);
  assert.equal(r.method, "2x2");
  assert.deepEqual([r.p, r.q, r.value], [[0.2, 0.8], [0.6, 0.4], 3.4]);
  assertOptimal(A, r);
});

test("2 × n graphical method worked by hand", () => {
  // Lines 8 - 7p, 5 - 2p, 2 + 9p. The lowest lines peak where 5 - 2p = 2 + 9p: p = 3/11, v = 49/11.
  // B mixes columns 2 and 3: q = (2 - 11)/(-11) = 9/11 on column 2.
  const A = [[1, 3, 11], [8, 5, 2]];
  const r = solve(A);
  assert.equal(r.method, "graphical");
  assert.ok(Math.abs(r.value - 49 / 11) < 1e-9);
  assert.ok(Math.abs(r.p[0] - 3 / 11) < 1e-9);
  assert.ok(Math.abs(r.q[1] - 9 / 11) < 1e-9 && r.q[0] === 0);
  assertOptimal(A, r);
});

test("m × 2 graphical method", () => {
  const A = [[2, 4], [2, 3], [3, 2], [-2, 6]];
  const r = solve(A);
  assertOptimal(A, r);
  assert.ok(Math.abs(r.value - lpSolve(A).value) < 1e-9);
});

test("dominance reduces a game step by step", () => {
  // Row 3 (4 2 4 0) beats row 1 (3 2 4 0) everywhere, so row 1 goes; and so on.
  const A = [[3, 2, 4, 0], [3, 4, 2, 4], [4, 2, 4, 0], [0, 4, 0, 8]];
  const red = reduce(A);
  assert.ok(red.steps.length >= 2);
  assert.equal(red.steps[0].kind, "row");
  assert.equal(red.steps[0].removed, 0);
  const r = solve(A);
  assertOptimal(A, r);
  assert.ok(Math.abs(r.value - lpSolve(A).value) < 1e-9);
});

test("dominance by the average of two columns, as in textbooks", () => {
  // After plain dominance the game is A2-A4 against B2-B4. Column B2 (4 2 4) is at least the average
  // of B3 (2 4 0) and B4 (4 0 8), which is (3 2 4), so B2 goes and the value 8/3 follows by hand.
  const A = [[3, 2, 4, 0], [3, 4, 2, 4], [4, 2, 4, 0], [0, 4, 0, 8]];
  const red = reduce(A);
  const avg = red.steps.find((s) => s.average);
  assert.ok(avg);
  assert.equal(avg.kind, "col");
  assert.equal(avg.removed, 1);
  assert.deepEqual(avg.by, [2, 3]);
  const r = solve(A);
  assert.notEqual(r.method, "lp");
  assert.ok(Math.abs(r.value - 8 / 3) < 1e-9);
  assertOptimal(A, r);
});

test("random games: every answer is certified optimal", () => {
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 400; t++) {
    const m = 1 + Math.floor(rnd() * 4), n = 1 + Math.floor(rnd() * 4);
    const A = Array.from({ length: m }, () => Array.from({ length: n }, () => Math.floor(rnd() * 21) - 10));
    const r = solve(A);
    assertOptimal(A, r);
  }
});

test("validation", () => {
  assert.ok(validate([[1, NaN]])[0].includes("Cell (1, 2)"));
});
