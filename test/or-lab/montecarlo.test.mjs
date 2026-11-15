import { test } from "node:test";
import assert from "node:assert/strict";
import { ranges, rangeText, lookup, parseRandoms, randomNumbers, simulateOne, simulateQueue } from "../../src/assets/or-lab/lib/montecarlo.js";

test("random-number ranges from probabilities (00–99)", () => {
  // Demand 10, 20, 30, 40 with probabilities 0.10, 0.25, 0.40, 0.25.
  // Cumulative 0.10, 0.35, 0.75, 1.00 -> ranges 00–09, 10–34, 35–74, 75–99.
  const t = ranges([{ value: 10, p: 0.1 }, { value: 20, p: 0.25 }, { value: 30, p: 0.4 }, { value: 40, p: 0.25 }]);
  assert.equal(t.digits, 2);
  assert.deepEqual(t.rows.map((r) => rangeText(r, 2)), ["00–09", "10–34", "35–74", "75–99"]);
  assert.deepEqual(t.rows.map((r) => r.cum), [0.1, 0.35, 0.75, 1]);
  assert.equal(t.mean, 10 * 0.1 + 20 * 0.25 + 30 * 0.4 + 40 * 0.25); // 28
  assert.equal(lookup(t, 34).value, 20);
  assert.equal(lookup(t, 35).value, 30);
  // Random numbers 48, 78, 09, 51, 56 -> 30, 40, 10, 30, 30; average 28.
  const s = simulateOne(t, [48, 78, 9, 51, 56]);
  assert.deepEqual(s.trials.map((x) => x.value), [30, 40, 10, 30, 30]);
  assert.equal(s.average, 28);
});

test("frequencies are turned into probabilities; three digits when needed", () => {
  const f = ranges([{ value: 0, p: 15 }, { value: 1, p: 30 }, { value: 2, p: 45 }, { value: 3, p: 10 }]);
  assert.equal(f.fromFrequencies, true);
  assert.deepEqual(f.rows.map((r) => r.p), [0.15, 0.3, 0.45, 0.1]);
  const three = ranges([{ value: 1, p: 0.125 }, { value: 2, p: 0.875 }]);
  assert.equal(three.digits, 3);
  assert.deepEqual(three.rows.map((r) => rangeText(r, 3)), ["000–124", "125–999"]);
});

test("bad tables are explained", () => {
  assert.match(ranges([{ value: 1, p: 0.5 }, { value: 2, p: 0.4 }]).errors[0], /add up to 0\.9/);
  assert.match(ranges([{ value: 1, p: 1 }, { value: 2, p: 2 }]).errors[0] || "", /cannot be written/);
  assert.match(ranges([{ value: NaN, p: 1 }]).errors[0], /enter a value/);
});

test("typed random numbers are checked", () => {
  assert.deepEqual(parseRandoms("48, 78 09;51", 2), { nums: [48, 78, 9, 51], errors: [] });
  assert.equal(parseRandoms("123", 2).errors.length, 1);
  assert.equal(parseRandoms("4.5", 2).errors.length, 1);
  const g = randomNumbers(100, 2, 42);
  assert.ok(g.every((x) => x >= 0 && x <= 99));
  assert.deepEqual(g, randomNumbers(100, 2, 42));
});

test("single-server queue simulation worked by hand", () => {
  const arr = ranges([{ value: 2, p: 0.5 }, { value: 4, p: 0.5 }]);   // 00–49 -> 2 min, 50–99 -> 4 min
  const srv = ranges([{ value: 3, p: 0.5 }, { value: 5, p: 0.5 }]);   // 00–49 -> 3 min, 50–99 -> 5 min
  // Customer 1: gap 2 -> arrives 2, starts 2, service 5, ends 7, wait 0, idle 2.
  // Customer 2: gap 4 -> arrives 6, starts 7, service 3, ends 10, wait 1, idle 0.
  // Customer 3: gap 2 -> arrives 8, starts 10, service 5, ends 15, wait 2, idle 0.
  const s = simulateQueue(arr, srv, [10, 70, 20], [80, 30, 60]);
  assert.deepEqual(s.rows.map((r) => [r.arrival, r.start, r.end, r.wait, r.idle]), [[2, 2, 7, 0, 2], [6, 7, 10, 1, 0], [8, 10, 15, 2, 0]]);
  assert.equal(s.totalWait, 3);
  assert.equal(s.avgWait, 1);
  assert.equal(s.waited, 2);
  assert.equal(s.totalIdle, 2);
  assert.ok(Math.abs(s.avgInSystem - (5 + 4 + 7) / 3) < 1e-8);
});
