// Matrices with exact fractions: addition, subtraction, multiplication, transpose, determinant
// (by expansion along the first row), minors, cofactors, adjoint, inverse, and Cramer's rule.
// A matrix is an array of rows of F.

import { F, ZERO, ONE } from "./frac.js";

export const dims = (A) => [A.length, A[0]?.length ?? 0];
export const map = (A, f) => A.map((r, i) => r.map((v, j) => f(v, i, j)));

export function add(A, B, sign = 1) {
  const [m, n] = dims(A), [p, q] = dims(B);
  if (m !== p || n !== q) return { error: `A is ${m} × ${n} and B is ${p} × ${q}. Only matrices of the same order can be ${sign > 0 ? "added" : "subtracted"}.` };
  return { result: map(A, (v, i, j) => (sign > 0 ? v.add(B[i][j]) : v.sub(B[i][j]))) };
}

export function scalar(k, A) { return map(A, (v) => v.mul(k)); }

// Product with the working for each cell: [[{ terms: [[a, b], ...], value }]].
export function multiply(A, B) {
  const [m, n] = dims(A), [p, q] = dims(B);
  if (n !== p) return { error: `A is ${m} × ${n} and B is ${p} × ${q}. AB needs as many columns in A as rows in B (${n} ≠ ${p}).` };
  const work = Array.from({ length: m }, (_, i) => Array.from({ length: q }, (_, j) => {
    const terms = A[i].map((a, k) => [a, B[k][j]]);
    return { terms, value: terms.reduce((s, [a, b]) => s.add(a.mul(b)), ZERO) };
  }));
  return { result: map(work, (w) => w.value), work };
}

export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));

export const minorMatrix = (A, i, j) => A.filter((_, r) => r !== i).map((r) => r.filter((_, c) => c !== j));

export function det(A) {
  const n = A.length;
  if (n === 1) return A[0][0];
  if (n === 2) return A[0][0].mul(A[1][1]).sub(A[0][1].mul(A[1][0]));
  let s = ZERO;
  for (let j = 0; j < n; j++) {
    if (A[0][j].isZero()) continue;
    const t = A[0][j].mul(det(minorMatrix(A, 0, j)));
    s = j % 2 ? s.sub(t) : s.add(t);
  }
  return s;
}

// Expansion along the first row, for display: [{ a, sign, minor, minorDet }].
export function expansion(A) {
  return A[0].map((a, j) => { const M = minorMatrix(A, 0, j); return { a, j, sign: j % 2 ? -1 : 1, minor: M, minorDet: det(M) }; });
}

export function cofactors(A) {
  const n = A.length;
  if (n === 1) return [[ONE]];
  return map(A, (_, i, j) => { const d = det(minorMatrix(A, i, j)); return (i + j) % 2 ? d.neg() : d; });
}

export const adjoint = (A) => transpose(cofactors(A));

export function inverse(A) {
  const d = det(A);
  if (d.isZero()) return { det: d, singular: true };
  const adj = adjoint(A);
  return { det: d, adj, inv: map(adj, (v) => v.div(d)) };
}

export const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)));
export const equal = (A, B) => A.length === B.length && A.every((r, i) => r.length === B[i].length && r.every((v, j) => v.eq(B[i][j])));

// Cramer's rule for n equations in n unknowns: coef is n × n, rhs is length n.
export function cramer(coef, rhs) {
  const n = coef.length;
  const D = det(coef);
  const parts = coef[0].map((_, k) => { const M = coef.map((r, i) => r.map((v, j) => (j === k ? rhs[i] : v))); return { matrix: M, det: det(M) }; });
  if (!D.isZero()) return { D, parts, unique: true, solution: parts.map((p) => p.det.div(D)) };
  // Δ = 0: Cramer's rule gives no answer. When some Δi is not zero the equations contradict each other.
  return { D, parts, unique: false, inconsistent: parts.some((p) => !p.det.isZero()), n };
}
