import { test } from "node:test";
import assert from "node:assert/strict";
import { mm1, validate, rateFromGap } from "../../src/assets/or-lab/lib/queue.js";

test("M/M/1 worked by hand: λ = 8, μ = 10 per hour", () => {
  const q = mm1(8, 10);
  // ρ = 0.8, P0 = 0.2, Ls = 8/2 = 4, Lq = 64/20 = 3.2, Ws = 1/2 h, Wq = 8/20 = 0.4 h, non-empty queue = 10/2 = 5.
  assert.equal(q.rho, 0.8);
  assert.ok(Math.abs(q.p0 - 0.2) < 1e-12);
  assert.equal(q.ls, 4);
  assert.ok(Math.abs(q.lq - 3.2) < 1e-12);
  assert.equal(q.ws, 0.5);
  assert.ok(Math.abs(q.wq - 0.4) < 1e-12);
  assert.equal(q.lNonEmpty, 5);
  // Little's law: L = λW.
  assert.ok(Math.abs(q.ls - 8 * q.ws) < 1e-12 && Math.abs(q.lq - 8 * q.wq) < 1e-12);
  // P(n = 2) = 0.2 × 0.64 = 0.128; P(n > 3) = 0.8^4 = 0.4096.
  assert.ok(Math.abs(q.pn(2) - 0.128) < 1e-12);
  assert.ok(Math.abs(q.pMoreThan(3) - 0.4096) < 1e-12);
  // Probabilities add up to one.
  let s = 0; for (let n = 0; n < 400; n++) s += q.pn(n);
  assert.ok(Math.abs(s - 1) < 1e-9);
  assert.ok(Math.abs(q.pSystemOver(0.5) - Math.exp(-1)) < 1e-12);
  assert.ok(Math.abs(q.pQueueOver(0) - 0.8) < 1e-12);
});

test("arrival every 6 minutes = 10 per hour", () => {
  assert.equal(rateFromGap(6, 60), 10);
});

test("an unstable queue is refused", () => {
  assert.ok(validate(10, 10)[0].includes("less than"));
  assert.ok(validate(0, 5)[0].includes("λ"));
  assert.deepEqual(validate(3, 5), []);
});
