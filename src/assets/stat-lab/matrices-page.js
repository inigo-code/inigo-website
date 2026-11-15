// Matrix calculator: every operation in Unit I, in exact fractions, with the working.
import { h, $, messages, saveState, block, scroller, panel, seg, field, select, sizeSelect, gridInput, gridValues, numInput, mx, eq, formula, answer, show, start, F } from "./kit.js";
import * as M from "./lib/matrix.js";

const EXAMPLE = { op: "inv", A: [["2", "1", "1"], ["1", "2", "1"], ["1", "1", "2"]], B: [["1", "0", "2"], ["0", "1", "1"], ["3", "1", "0"]], k: "3" };
const OPS = [["add", "A + B"], ["sub", "A − B"], ["mul", "A × B"], ["scalar", "k × A"], ["trans", "Transpose Aᵀ"], ["det", "Determinant |A|"], ["adj", "Adjoint adj A"], ["inv", "Inverse A⁻¹"]];
const needsB = (op) => ["add", "sub", "mul"].includes(op);
const square = (op) => ["det", "adj", "inv"].includes(op);
const MAX = 4;

let gridA, gridB, kIn, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);

function draw() {
  const sizes = (name, A, onSize) => h("div", { class: "lab-controls" },
    sizeSelect(`Rows of ${name}`, A.length, MAX, (v) => { read(); onSize(v, A[0].length); }),
    sizeSelect(`Columns of ${name}`, A[0].length, MAX, (v) => { read(); onSize(A.length, v); }));
  const resize = (A, m, n) => Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => A[i]?.[j] ?? ""));
  gridA = gridInput(state.A, { label: "A", rowName: (i) => `R${i + 1}`, colNames: state.A[0].map((_, j) => `C${j + 1}`) });
  gridB = gridInput(state.B, { label: "B", rowName: (i) => `R${i + 1}`, colNames: state.B[0].map((_, j) => `C${j + 1}`) });
  kIn = numInput(state.k, "k");
  const op = state.op;
  ({ msgBox } = panel({
    title: "Your matrices",
    hint: "Type whole numbers, decimals or fractions such as 3/4. Answers are kept as exact fractions.",
    kids: [
      seg("op", "Work out", OPS, op, (v) => { read(); state.op = v; if (square(v) && state.A.length !== state.A[0].length) { const n = Math.max(state.A.length, state.A[0].length); state.A = resize(state.A, n, n); } draw(); }),
      h("h3", { class: "lab-sub" }, "Matrix A"),
      square(op) ? h("div", { class: "lab-controls" }, sizeSelect("Order of A", state.A.length, MAX, (v) => { read(); state.A = resize(state.A, v, v); draw(); }, 1))
        : sizes("A", state.A, (m, n) => { state.A = resize(state.A, m, n); draw(); }),
      scroller(gridA, "Matrix A"),
      needsB(op) ? h("h3", { class: "lab-sub" }, "Matrix B") : null,
      needsB(op) ? sizes("B", state.B, (m, n) => { state.B = resize(state.B, m, n); draw(); }) : null,
      needsB(op) ? scroller(gridB, "Matrix B") : null,
      op === "scalar" ? h("div", { class: "lab-controls" }, field("k", kIn, "w-s")) : null,
    ],
    onExample: () => { Object.assign(state, structuredClone(EXAMPLE)); draw(); results.replaceChildren(); },
    onClear: () => { read(); state.A = state.A.map((r) => r.map(() => "")); state.B = state.B.map((r) => r.map(() => "")); draw(); results.replaceChildren(); },
    onRun: run,
  }));
}

function read() {
  state.A = gridValues(gridA);
  if (needsB(state.op)) state.B = gridValues(gridB);
  if (kIn) state.k = kIn.value;
}

function parse(A, name, errors) {
  return A.map((r, i) => r.map((v, j) => {
    const f = F.parse(v);
    if (!f) errors.push(`${name}, row ${i + 1}, column ${j + 1}: enter a number${v.trim() ? ` (“${v.trim()}” is not one)` : ""}.`);
    return f;
  }));
}

function run() {
  read();
  const errors = [];
  const A = parse(state.A, "A", errors);
  const B = needsB(state.op) ? parse(state.B, "B", errors) : null;
  const k = state.op === "scalar" ? F.parse(state.k) : null;
  if (state.op === "scalar" && !k) errors.push("Enter the number k.");
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  const blocks = [];
  const op = state.op;
  if (op === "add" || op === "sub") {
    const r = M.add(A, B, op === "add" ? 1 : -1);
    if (r.error) { messages(msgBox, [r.error]); results.replaceChildren(); return; }
    const sign = op === "add" ? "+" : "−";
    blocks.push(answer(`A ${sign} B`, mx(r.result)));
    blocks.push(block("Working", h("p", { class: "lab-hint" }, `Matrices of the same order are ${op === "add" ? "added" : "subtracted"} entry by entry.`),
      eq(`A ${sign} B = `, mx(A.map((row, i) => row.map((a, j) => `${a} ${sign} ${paren(B[i][j])}`))), " = ", mx(r.result))));
  } else if (op === "mul") {
    const r = M.multiply(A, B);
    if (r.error) { messages(msgBox, [r.error]); results.replaceChildren(); return; }
    blocks.push(answer(`A × B, of order ${A.length} × ${B[0].length}`, mx(r.result)));
    blocks.push(block("Working", h("p", { class: "lab-hint" }, "Each entry is a row of A times a column of B: multiply matching entries and add."),
      eq("A × B = ", mx(A), " × ", mx(B)),
      formula(...r.work.flatMap((row, i) => row.map((w, j) => `c${i + 1}${j + 1} = ${w.terms.map(([a, b]) => `${paren(a)} × ${paren(b)}`).join(" + ")} = ${w.value}`)))));
    if (A.length === A[0].length && B.length === B[0].length && A.length === B.length) {
      const ba = M.multiply(B, A).result;
      blocks.push(block("Is AB = BA?", h("p", {}, M.equal(r.result, ba) ? "Here AB = BA, which is unusual: matrix multiplication is not commutative in general." : "No. BA is different, as is usual: the order of multiplication matters."), eq("B × A = ", mx(ba))));
    }
  } else if (op === "scalar") {
    const R = M.scalar(k, A);
    blocks.push(answer(`${k} × A`, mx(R)));
    blocks.push(block("Working", h("p", { class: "lab-hint" }, "Every entry is multiplied by k."), eq(`${k} × `, mx(A), " = ", mx(A.map((r) => r.map((a) => `${k} × ${paren(a)}`))), " = ", mx(R))));
  } else if (op === "trans") {
    const T = M.transpose(A);
    blocks.push(answer(`Aᵀ, of order ${T.length} × ${T[0].length}`, mx(T)));
    blocks.push(block("Working", h("p", {}, "Rows become columns: row 1 of A is column 1 of Aᵀ, and so on."), eq("A = ", mx(A), "  Aᵀ = ", mx(T))));
  } else {
    if (A.length !== A[0].length) { messages(msgBox, ["The determinant, adjoint and inverse need a square matrix."]); results.replaceChildren(); return; }
    const d = M.det(A);
    if (op === "det") {
      blocks.push(answer("|A|", String(d)));
      blocks.push(block("Expanding along the first row", ...detWorking(A)));
    } else {
      const C = M.cofactors(A), adj = M.transpose(C);
      if (op === "adj") blocks.push(answer("adj A", mx(adj)));
      if (op === "inv") {
        if (d.isZero()) blocks.push(answer("A⁻¹", "Does not exist", h("p", {}, "|A| = 0, so A is a singular matrix and has no inverse.")));
        else blocks.push(answer("A⁻¹", mx(M.map(adj, (v) => v.div(d)))));
        blocks.push(block("Step 1: the determinant", ...detWorking(A)));
      }
      blocks.push(block(op === "inv" ? "Step 2: cofactors and the adjoint" : "Cofactors and the adjoint", ...cofactorWorking(A, C, adj)));
      if (op === "inv" && !d.isZero()) {
        const inv = M.map(adj, (v) => v.div(d));
        blocks.push(block("Step 3: the inverse", formula("A⁻¹ = adj A ÷ |A|"),
          eq(`A⁻¹ = 1/${paren(d)} × `, mx(adj), " = ", mx(inv)),
          h("p", { class: "lab-hint" }, "Check: A × A⁻¹ should be the identity matrix I."),
          eq("A × A⁻¹ = ", mx(M.multiply(A, inv).result), M.equal(M.multiply(A, inv).result, M.identity(A.length)) ? " = I ✓" : "")));
      }
    }
  }
  messages(msgBox);
  saveState(state);
  show(results, blocks);
}

const paren = (f) => (f.sign() < 0 ? `(${f})` : String(f));

function detWorking(A) {
  const n = A.length, d = M.det(A);
  if (n === 1) return [h("p", {}, `For a 1 × 1 matrix the determinant is the entry itself: ${d}.`)];
  if (n === 2) return [eq("|A| = ", mx(A, { det: true }), ` = ${paren(A[0][0])} × ${paren(A[1][1])} − ${paren(A[0][1])} × ${paren(A[1][0])} = ${d}`)];
  const ex = M.expansion(A);
  const terms = ex.map((t) => `${t.sign < 0 ? "−" : "+"} ${paren(t.a)} × ${paren(t.minorDet)}`).join(" ").replace(/^\+ /, "");
  return [
    h("p", { class: "lab-hint" }, "Each entry of the first row times its minor (the determinant left when its row and column are struck out), with signs + − + …"),
    h("div", { class: "mx-list" }, ex.map((t) => eq(`a1${t.j + 1} = ${t.a}, minor M1${t.j + 1} = `, mx(t.minor, { det: true }), ` = ${t.minorDet}`))),
    formula(`|A| = ${terms} = ${d}`),
  ];
}

function cofactorWorking(A, C, adj) {
  const n = A.length;
  const minors = M.map(A, (_, i, j) => (n === 1 ? new F(1n) : M.det(M.minorMatrix(A, i, j))));
  return [
    h("p", { class: "lab-hint" }, "The cofactor of each entry is its minor with the sign (−1)^(i + j): + − + / − + − / + − +. The adjoint is the transpose of the matrix of cofactors."),
    n > 1 ? eq("Minors: ", mx(minors)) : null,
    eq("Cofactors: ", mx(C)),
    eq("adj A = (cofactors)ᵀ = ", mx(adj)),
  ];
}

boot();
