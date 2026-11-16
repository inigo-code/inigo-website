// Cramer's rule for two or three simultaneous equations.
import { h, messages, saveState, block, scroller, panel, seg, gridInput, gridValues, mx, eq, formula, where, answer, show, start, fracText, F } from "./kit.js";
import * as M from "./lib/matrix.js";

const EXAMPLE = { n: "3", rows: [["1", "1", "1", "6"], ["2", "-1", "1", "3"], ["1", "2", "-1", "2"]] };
const VARS = ["x", "y", "z"];
let grid, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);

function draw() {
  const n = Number(state.n);
  grid = gridInput(state.rows, { label: "Equation", rowName: (i) => `Eq. ${i + 1}`, colNames: [...VARS.slice(0, n).map((v) => `${v}`), "= constant"] });
  ({ msgBox } = panel({
    title: "Your equations",
    hint: `Enter the coefficients of each equation, written as ${n === 2 ? "a₁x + b₁y = c₁" : "a₁x + b₁y + c₁z = d₁"}. Use 0 for a missing unknown and a minus sign for a negative coefficient. Fractions such as 1/2 are fine.`,
    kids: [
      seg("n", "Number of unknowns", [["2", "Two (x, y)"], ["3", "Three (x, y, z)"]], state.n, (v) => {
        read(); const m = Number(v);
        state.n = v; state.rows = Array.from({ length: m }, (_, i) => [...Array.from({ length: m }, (_, j) => state.rows[i]?.[j] ?? ""), state.rows[i]?.at(-1) ?? ""]);
        draw();
      }),
      scroller(grid, "Coefficients"),
    ],
    onExample: () => { Object.assign(state, structuredClone(EXAMPLE)); draw(); results.replaceChildren(); },
    onClear: () => { read(); state.rows = state.rows.map((r) => r.map(() => "")); draw(); results.replaceChildren(); },
    onRun: run, runLabel: "Solve",
  }));
}

function read() { state.rows = gridValues(grid); }

const term = (f, v, first) => {
  if (f.isZero()) return "";
  const neg = f.sign() < 0, abs = neg ? f.neg() : f;
  const c = abs.eq(new F(1n)) ? "" : String(abs);
  return `${neg ? (first ? "−" : " − ") : first ? "" : " + "}${c}${v}`;
};
const equation = (row, n) => {
  let s = "";
  for (let j = 0; j < n; j++) { const t = term(row[j], VARS[j], s === ""); s += t; }
  return `${s || "0"} = ${row[n]}`;
};

function run() {
  read();
  const n = Number(state.n), errors = [];
  const rows = state.rows.map((r, i) => r.map((v, j) => {
    const f = F.parse(v);
    if (!f) errors.push(`Equation ${i + 1}: enter the ${j < n ? `coefficient of ${VARS[j]}` : "constant"}${v.trim() ? ` (“${v.trim()}” is not a number)` : ""}.`);
    return f;
  }));
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  if (rows.some((r) => r.slice(0, n).every((f) => f.isZero()))) { messages(msgBox, ["Each equation needs at least one non-zero coefficient."]); results.replaceChildren(); return; }
  const coef = rows.map((r) => r.slice(0, n)), rhs = rows.map((r) => r[n]);
  const res = M.cramer(coef, rhs);
  const blocks = [];
  if (res.unique) {
    blocks.push(answer("Solution", VARS.slice(0, n).map((v, k) => `${v} = ${res.solution[k]}`).join(", "),
      res.solution.some((f) => !f.isInt()) ? h("p", {}, VARS.slice(0, n).map((v, k) => `${v} = ${fracText(res.solution[k])}`).join(";  ")) : null));
  } else {
    blocks.push(answer("Cramer's rule cannot be used", "Δ = 0",
      h("p", {}, res.inconsistent
        ? `At least one of ${VARS.slice(0, n).map((v) => `Δ${v}`).join(", ")} is not zero, so the equations contradict each other: there is no solution.`
        : n === 2 ? "Every Δ is zero: the two equations describe the same line, so there are infinitely many solutions."
          : "Every Δ is zero. The equations have either no solution or infinitely many; Cramer's rule cannot tell which.")));
  }
  blocks.push(block("The equations", formula(...rows.map((r) => equation(r, n)))));
  const det2 = (A) => (A.length === 2 ? ` = ${p(A[0][0])} × ${p(A[1][1])} − ${p(A[0][1])} × ${p(A[1][0])}` : ` = ${M.expansion(A).map((t) => `${t.sign < 0 ? "−" : "+"} ${p(t.a)} × ${p(t.minorDet)}`).join(" ").replace(/^\+ /, "")}`);
  blocks.push(block("Determinants",
    h("p", { class: "lab-hint" }, `Δ uses the coefficients. ${VARS.slice(0, n).map((v, k) => `Δ${v} replaces column ${k + 1} (the ${v} column) by the constants`).join("; ")}.${n === 3 ? " Each 3 × 3 determinant is expanded along its first row." : ""}`),
    h("div", { class: "mx-list" },
      eq("Δ = ", mx(coef, { det: true }), `${det2(coef)} = ${res.D}`),
      ...res.parts.map((pt, k) => eq(`Δ${VARS[k]} = `, mx(pt.matrix, { det: true }), `${det2(pt.matrix)} = ${pt.det}`))),
    where(["Δ", "delta, the determinant of the coefficients (the numbers in front of the unknowns)"],
      ...VARS.slice(0, n).map((v, k) => [`Δ${v}`, `the same determinant with the ${v} column (column ${k + 1}) replaced by the constants on the right-hand side`]))));
  if (res.unique) {
    blocks.push(block("Cramer's rule", formula(...res.parts.map((pt, k) => `${VARS[k]} = Δ${VARS[k]} / Δ = ${pt.det} / ${p(res.D)} = ${res.solution[k]}`)),
      h("p", { class: "lab-hint" }, "Check by putting the values back into each equation:"),
      formula(...rows.map((r, i) => {
        const lhs = r.slice(0, n).reduce((s, f, j) => s.add(f.mul(res.solution[j])), new F(0n));
        return `Eq. ${i + 1}: ${r.slice(0, n).map((f, j) => `${p(f)} × ${p(res.solution[j])}`).join(" + ")} = ${lhs} ${lhs.eq(rhs[i]) ? "✓" : "✗"}`;
      }))));
  }
  messages(msgBox);
  saveState(state);
  show(results, blocks);
}

const p = (f) => (f.sign() < 0 ? `(${f})` : String(f));

boot();
