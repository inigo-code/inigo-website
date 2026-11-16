// Regression: Y on X and X on Y, from data or from summary figures.
import { h, messages, saveState, block, scroller, resultTable, panel, seg, field, numInput, show, start, formula, where, answer, chart, fmt, parseNum } from "./kit.js";
import { inputTable, tableValues } from "../or-lab/ui.js";
import * as C from "./lib/correlation.js";

const EXAMPLE = {
  mode: "data",
  rows: [["1", "2"], ["2", "4"], ["3", "5"], ["4", "4"], ["5", "5"]],
  sum: { mx: "20", my: "30", sx: "4", sy: "6", r: "0.5" },
  atX: "", atY: "",
};
let table, inputs = {}, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);

function draw() {
  const kids = [seg("mode", "You have", [["data", "Pairs of values"], ["summary", "Means, σ and r"]], state.mode, (v) => { read(); state.mode = v; draw(); results.replaceChildren(); })];
  if (state.mode === "data") {
    table = inputTable({ head: ["X", "Y"], rows: state.rows, rowLabel: { title: "Pair", name: (i) => String(i + 1) }, onRemove: (i) => { read(); if (state.rows.length > 3) state.rows.splice(i, 1); draw(); } });
    kids.push(scroller(table, "Pairs"), h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state.rows.push(["", ""]); draw(); } }, "Add a pair")));
  } else {
    inputs = Object.fromEntries(Object.keys(EXAMPLE.sum).map((k) => [k, numInput(state.sum[k], k)]));
    kids.push(h("div", { class: "lab-controls" },
      field("Mean of X (X̄)", inputs.mx), field("Mean of Y (Ȳ)", inputs.my), field("σ of X", inputs.sx, "w-s"), field("σ of Y", inputs.sy, "w-s"), field("r", inputs.r, "w-s")));
  }
  ({ msgBox } = panel({
    title: "Your data",
    hint: state.mode === "data" ? "Enter each pair of values." : "Enter the two means, the two standard deviations and the coefficient of correlation r, as a problem usually gives them.",
    kids,
    onExample: () => { const m = state.mode; Object.assign(state, structuredClone(EXAMPLE), { mode: m }); draw(); results.replaceChildren(); },
    onClear: () => { read(); if (state.mode === "data") state.rows = state.rows.map(() => ["", ""]); else state.sum = { mx: "", my: "", sx: "", sy: "", r: "" }; draw(); results.replaceChildren(); },
    onRun: run, runLabel: "Find the regression lines",
  }));
}
function read() {
  if (state.mode === "data") state.rows = tableValues(table);
  else for (const k of Object.keys(inputs)) state.sum[k] = inputs[k].value;
}

// "Y = 0.6X + 2.2", "X = Y − 1", as written in textbooks.
const line = (L, a, b, R) => {
  if (fmt(b) === "0") return `${L} = ${fmt(a)}`; // r = 0: the line is flat at the mean
  const c = fmt(b) === "1" ? "" : fmt(b) === "−1" ? "−" : fmt(b);
  return `${L} = ${c}${R}${fmt(a) === "0" ? "" : ` ${a < 0 ? "−" : "+"} ${fmt(Math.abs(a))}`}`;
};

function run() {
  read();
  let g, X, Y;
  if (state.mode === "data") {
    const rows = state.rows.filter((r) => r.some((v) => v.trim()));
    X = rows.map((r) => parseNum(r[0])); Y = rows.map((r) => parseNum(r[1]));
    const errors = C.validatePairs(X, Y);
    if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
    g = C.regression(X, Y);
  } else {
    const v = Object.fromEntries(Object.entries(state.sum).map(([k, x]) => [k, parseNum(x)]));
    const errors = C.validateSummary(v);
    if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
    g = C.fromSummary(v);
  }
  messages(msgBox);
  saveState(state);
  const blocks = [answer("Regression equations", h("span", {}, line("Y", g.a, g.byx, "X")), h("p", { class: "big" }, line("X", g.c, g.bxy, "Y")),
    h("p", {}, "Use Y on X to estimate Y for a given X, and X on Y to estimate X for a given Y."))];

  const B = {
    byx: ["byx", "the regression coefficient of Y on X: how much Y changes, on average, when X rises by 1"],
    bxy: ["bxy", "the regression coefficient of X on Y: how much X changes, on average, when Y rises by 1"],
    r: ["r", "Karl Pearson's coefficient of correlation"],
  };
  if (state.mode === "data") {
    const t = g.rows.map((r) => [fmt(r.x), fmt(r.y), fmt(r.dx), fmt(r.dy), fmt(r.dx2), fmt(r.dy2), fmt(r.dxdy)]);
    t.push([`ΣX = ${fmt(g.sumX)}`, `ΣY = ${fmt(g.sumY)}`, "", "", `Σx² = ${fmt(g.Sxx)}`, `Σy² = ${fmt(g.Syy)}`, `Σxy = ${fmt(g.Sxy)}`].map((v) => ({ text: v, class: "is-total" })));
    blocks.push(block("Working table", h("p", { class: "lab-hint" }, `X̄ = ${fmt(g.sumX)} / ${g.n} = ${fmt(g.mx)},  Ȳ = ${fmt(g.sumY)} / ${g.n} = ${fmt(g.my)};  x = X − X̄, y = Y − Ȳ.`),
      scroller(resultTable(["X", "Y", "x", "y", "x²", "y²", "xy"], t), "Working table")));
    blocks.push(block("Regression coefficients", formula(`byx = Σxy / Σx² = ${fmt(g.Sxy)} / ${fmt(g.Sxx)} = ${fmt(g.byx)}`, `bxy = Σxy / Σy² = ${fmt(g.Sxy)} / ${fmt(g.Syy)} = ${fmt(g.bxy)}`),
      formula(`Check: r = ±√(byx × bxy) = ${g.Sxy < 0 ? "−" : ""}√(${fmt(g.byx)} × ${fmt(g.bxy)}) = ${fmt(g.check)}`, `This is Karl Pearson's r = ${fmt(g.r)}.`),
      where(B.byx, B.bxy, ["x", "X − X̄, how far each X is from its mean"], ["y", "Y − Ȳ, how far each Y is from its mean"], ["Σxy, Σx², Σy²", "the column totals in the working table"], B.r)));
  } else {
    blocks.push(block("Regression coefficients", formula(`byx = r × σy / σx = ${fmt(g.r)} × ${fmt(g.sy)} / ${fmt(g.sx)} = ${fmt(g.byx)}`, `bxy = r × σx / σy = ${fmt(g.r)} × ${fmt(g.sx)} / ${fmt(g.sy)} = ${fmt(g.bxy)}`),
      where(B.byx, B.bxy, B.r, ["σx, σy", `the standard deviations of X and Y, ${fmt(g.sx)} and ${fmt(g.sy)}`])));
  }
  blocks.push(block("The equations",
    formula("Y on X: Y − Ȳ = byx (X − X̄)", `Y − ${fmt(g.my)} = ${fmt(g.byx)} (X − ${fmt(g.mx)})`, line("Y", g.a, g.byx, "X")),
    formula("X on Y: X − X̄ = bxy (Y − Ȳ)", `X − ${fmt(g.mx)} = ${fmt(g.bxy)} (Y − ${fmt(g.my)})`, line("X", g.c, g.bxy, "Y")),
    where(["X̄, Ȳ", `the means of X and Y, ${fmt(g.mx)} and ${fmt(g.my)}`], B.byx, B.bxy),
    h("p", { class: "lab-hint" }, "Both lines pass through the point of means (X̄, Ȳ). Both coefficients have the same sign as r, and r is their geometric mean.")));

  // Estimates
  const xIn = numInput(state.atX, "Given X"), yIn = numInput(state.atY, "Given Y"), out = h("div", { class: "lab-formula", "aria-live": "polite" });
  const update = () => {
    state.atX = xIn.value; state.atY = yIn.value; saveState(state);
    const x = parseNum(xIn.value), y = parseNum(yIn.value), lines = [];
    if (Number.isFinite(x)) lines.push(`Y when X = ${fmt(x)}: Y = ${fmt(g.a)} ${g.byx < 0 ? "−" : "+"} ${fmt(Math.abs(g.byx))} × ${fmt(x)} = ${fmt(g.yAt(x))}`);
    if (Number.isFinite(y)) lines.push(`X when Y = ${fmt(y)}: X = ${fmt(g.c)} ${g.bxy < 0 ? "−" : "+"} ${fmt(Math.abs(g.bxy))} × ${fmt(y)} = ${fmt(g.xAt(y))}`);
    if (!lines.length) lines.push("Enter a value of X or Y to estimate the other.");
    out.replaceChildren(...lines.map((l) => h("p", {}, l)));
  };
  xIn.addEventListener("input", update); yIn.addEventListener("input", update); update();
  blocks.push(block("Estimates", h("div", { class: "lab-controls" }, field("Given X", xIn, "w-s"), field("Given Y", yIn, "w-s")), out));

  // Graph: Y on X is drawn over the X range; X on Y is drawn as the points (X, Y) it gives.
  const xs = X || [g.mx - 2 * g.sx, g.mx + 2 * g.sx], ys = Y || [g.my - 2 * g.sy, g.my + 2 * g.sy];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const series = [
    { points: [[x0, g.yAt(x0)], [x1, g.yAt(x1)]], kind: "line", cls: "g-trend", label: "Y on X", key: "thick" },
    { points: [[g.xAt(y0), y0], [g.xAt(y1), y1]], kind: "line", cls: "g-ink2", label: "X on Y", key: "ink-dash" },
  ];
  if (X) series.push({ points: X.map((x, i) => [x, Y[i]]), kind: "dots", label: "Data", key: "dot" });
  blocks.push(block("Graph", chart(series, { xLabel: "X", yLabel: "Y" })));
  show(results, blocks);
}

boot();
