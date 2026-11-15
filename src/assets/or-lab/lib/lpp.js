// Linear programming with two variables: the graphical (corner-point) method.
//   problem = { sense: "max" | "min", c: [c1, c2], cons: [{ a: [a1, a2], op: "<=" | ">=" | "=", b }] }
// x1, x2 >= 0 is always assumed.

import { clean } from "./num.js";

const TOL = 1e-7;

const scaleOf = (p) => Math.max(1, ...p.cons.flatMap((k) => [Math.abs(k.b), ...k.a.map(Math.abs)]));

// Does point (x, y) satisfy constraint k? `extra` is a tolerance scaled to the problem.
const holds = (k, x, y, tol) => {
  const lhs = k.a[0] * x + k.a[1] * y;
  if (k.op === "<=") return lhs <= k.b + tol;
  if (k.op === ">=") return lhs >= k.b - tol;
  return Math.abs(lhs - k.b) <= tol;
};

// Every vertex of { x, y >= 0 and all constraints }.
function vertices(cons, tol) {
  const lines = [...cons.map((k) => ({ a: k.a, b: k.b })), { a: [1, 0], b: 0 }, { a: [0, 1], b: 0 }];
  const pts = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [p, q] = lines[i].a, [r, s] = lines[j].a, det = p * s - q * r;
      if (Math.abs(det) < 1e-12) continue;
      const x = clean((lines[i].b * s - q * lines[j].b) / det), y = clean((p * lines[j].b - lines[i].b * r) / det);
      if (x < -tol || y < -tol) continue;
      if (!cons.every((k) => holds(k, x, y, tol))) continue;
      const pt = [Math.max(0, x), Math.max(0, y)];
      if (!pts.some((o) => Math.abs(o[0] - pt[0]) <= tol && Math.abs(o[1] - pt[1]) <= tol)) pts.push(pt);
    }
  }
  return pts;
}

// Extreme rays of the recession cone: directions d >= 0 along which the region goes on for ever.
function rays(cons) {
  const cand = [[1, 0], [0, 1]];
  for (const k of cons) {
    const [p, q] = k.a;
    const n = Math.hypot(p, q);
    if (n < 1e-12) continue;
    cand.push([-q / n, p / n], [q / n, -p / n]);
  }
  const out = [];
  for (const d of cand) {
    if (d[0] < -1e-12 || d[1] < -1e-12) continue;
    const ok = cons.every((k) => {
      const v = k.a[0] * d[0] + k.a[1] * d[1];
      return k.op === "<=" ? v <= 1e-9 : k.op === ">=" ? v >= -1e-9 : Math.abs(v) <= 1e-9;
    });
    const dd = [Math.max(0, d[0]), Math.max(0, d[1])];
    if (ok && !out.some((o) => Math.abs(o[0] - dd[0]) < 1e-9 && Math.abs(o[1] - dd[1]) < 1e-9)) out.push(dd);
  }
  return out;
}

// Order a convex polygon's vertices around its centre, for drawing.
export function ordered(pts) {
  if (pts.length < 3) return pts.slice();
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.slice().sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}

// The feasible region cut off at x <= X and y <= Y, as polygon vertices (for drawing an unbounded region).
export function clipped(p, X, Y) {
  const tol = TOL * scaleOf(p);
  return ordered(vertices([...p.cons, { a: [1, 0], op: "<=", b: X }, { a: [0, 1], op: "<=", b: Y }], tol));
}

export function validate(p) {
  const errors = [];
  if (!p.c.every(Number.isFinite)) errors.push("Enter both objective coefficients.");
  if (!p.cons.length) errors.push("Add at least one constraint.");
  p.cons.forEach((k, i) => {
    if (![...k.a, k.b].every(Number.isFinite)) errors.push(`Constraint ${i + 1}: fill in both coefficients and the right-hand side.`);
    else if (k.a[0] === 0 && k.a[1] === 0) errors.push(`Constraint ${i + 1}: at least one coefficient must be non-zero.`);
  });
  return errors;
}

export function solve(p) {
  const tol = TOL * scaleOf(p);
  const z = (x, y) => clean(p.c[0] * x + p.c[1] * y);
  const better = p.sense === "max" ? (u, v) => u > v + tol : (u, v) => u < v - tol;
  const corners = vertices(p.cons, tol).map(([x, y]) => ({ x, y, z: z(x, y) }));
  const res = { corners, rays: [], status: "", optimal: [], z: null };
  if (!corners.length) { res.status = "infeasible"; return res; }

  res.rays = rays(p.cons);
  res.boundedRegion = res.rays.length === 0;
  const improving = res.rays.find((d) => better(p.c[0] * d[0] + p.c[1] * d[1], 0));
  if (improving) { res.status = "unbounded"; res.direction = improving; return res; }

  let best = corners[0].z;
  for (const c of corners) if (better(c.z, best)) best = c.z;
  res.z = best;
  res.optimal = corners.filter((c) => Math.abs(c.z - best) <= tol * Math.max(1, Math.abs(best)));
  const flatRay = res.rays.find((d) => Math.abs(p.c[0] * d[0] + p.c[1] * d[1]) <= 1e-9);
  res.status = res.optimal.length > 1 || flatRay ? "multiple" : "unique";
  if (flatRay && res.optimal.length === 1) res.optimalRay = flatRay;

  // At the (first) optimal point: how much of each constraint is used, and is it binding?
  const o = res.optimal[0];
  res.usage = p.cons.map((k) => {
    const lhs = clean(k.a[0] * o.x + k.a[1] * o.y);
    return { lhs, b: k.b, binding: Math.abs(lhs - k.b) <= tol, slack: clean(k.op === ">=" ? lhs - k.b : k.b - lhs) };
  });
  return res;
}

// A constraint is redundant when the region without it already satisfies it
// (every corner and every unbounded direction of the smaller region).
export function redundant(p) {
  const tol = TOL * scaleOf(p);
  return p.cons.map((k, i) => {
    const others = p.cons.filter((_, j) => j !== i);
    const pts = vertices(others, tol);
    if (!pts.length) return false;
    if (!pts.every(([x, y]) => holds(k, x, y, tol))) return false;
    return rays(others).every((d) => {
      const v = k.a[0] * d[0] + k.a[1] * d[1];
      return k.op === "<=" ? v <= 1e-9 : k.op === ">=" ? v >= -1e-9 : Math.abs(v) <= 1e-9;
    });
  });
}

// Standard form: every constraint an equation with a non-negative right-hand side,
// using a slack variable for "<=" and a surplus variable for ">=".
export function standardForm(p) {
  let s = 0;
  const rows = p.cons.map((k) => {
    let a = k.a.slice(), b = k.b, op = k.op, flipped = false;
    if (b < 0) { a = a.map((v) => -v); b = -b; op = op === "<=" ? ">=" : op === ">=" ? "<=" : "="; flipped = true; }
    const extra = op === "<=" ? { name: `s${++s}`, sign: 1, kind: "slack" } : op === ">=" ? { name: `s${++s}`, sign: -1, kind: "surplus" } : null;
    return { a: a.map(clean), b: clean(b), op, flipped, extra };
  });
  return { sense: p.sense, c: p.c, rows, extras: rows.filter((r) => r.extra).map((r) => r.extra) };
}
