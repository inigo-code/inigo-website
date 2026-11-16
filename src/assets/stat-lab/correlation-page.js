// Karl Pearson's and Spearman's rank correlation.
import { h, messages, saveState, block, scroller, resultTable, panel, seg, show, start, formula, where, answer, chart, fmt, parseNum } from "./kit.js";
import { inputTable, tableValues } from "../or-lab/ui.js";
import * as C from "./lib/correlation.js";

const EXAMPLE = {
  method: "pearson",
  rows: [["10", "40"], ["12", "48"], ["15", "50"], ["18", "58"], ["20", "62"], ["25", "70"]],
  rankRows: [["48", "13"], ["33", "13"], ["40", "24"], ["9", "6"], ["16", "15"], ["16", "4"], ["65", "20"], ["24", "9"], ["16", "6"], ["57", "19"]],
};
const METHODS = [["pearson", "Karl Pearson"], ["spearman", "Spearman: from values"], ["ranks", "Spearman: ranks given"]];
let table, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);
const key = () => (state.method === "pearson" ? "rows" : "rankRows");

function draw() {
  const k = key();
  table = inputTable({ head: state.method === "ranks" ? ["Rank by X", "Rank by Y"] : ["X", "Y"], rows: state[k], rowLabel: { title: "Pair", name: (i) => String(i + 1) }, onRemove: (i) => { read(); if (state[k].length > 3) state[k].splice(i, 1); draw(); } });
  ({ msgBox } = panel({
    title: "Your data",
    hint: state.method === "ranks" ? "Enter the two ranks for each item, for example the ranks given by two judges. Tied items share the average rank (two items tied for 2nd both get 2.5)." : state.method === "spearman" ? "Enter the values; they are ranked for you, 1 for the largest. Tied values get the average of the ranks they cover." : "Enter each pair of values, X and Y.",
    kids: [seg("method", "Method", METHODS, state.method, (v) => { read(); state.method = v; draw(); results.replaceChildren(); }), scroller(table, "Pairs"),
      h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state[k].push(["", ""]); draw(); } }, "Add a pair"))],
    onExample: () => { const m = state.method; Object.assign(state, structuredClone(EXAMPLE), { method: m }); draw(); results.replaceChildren(); },
    onClear: () => { read(); state[k] = state[k].map(() => ["", ""]); draw(); results.replaceChildren(); },
    onRun: run, runLabel: "Find the correlation",
  }));
}
function read() { state[key()] = tableValues(table); }

function run() {
  read();
  const rows = state[key()].filter((r) => r.some((v) => v.trim()));
  const X = rows.map((r) => parseNum(r[0])), Y = rows.map((r) => parseNum(r[1]));
  const errors = C.validatePairs(X, Y);
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(results, state.method === "pearson" ? pearsonBlocks(X, Y) : spearmanBlocks(X, Y, state.method === "ranks"));
}

const meaning = (r) => `There is ${r.strength} correlation between X and Y${Math.abs(r.r ?? r.R) > 0 && Math.abs(r.r ?? r.R) < 1 ? `: as X ${(r.r ?? r.R) > 0 ? "rises, Y tends to rise" : "rises, Y tends to fall"}` : ""}.`;

function pearsonBlocks(X, Y) {
  const p = C.pearson(X, Y);
  const t = p.rows.map((r) => [fmt(r.x), fmt(r.y), fmt(r.dx), fmt(r.dy), fmt(r.dx2), fmt(r.dy2), fmt(r.dxdy)]);
  t.push([`ΣX = ${fmt(p.sumX)}`, `ΣY = ${fmt(p.sumY)}`, "", "", `Σx² = ${fmt(p.Sxx)}`, `Σy² = ${fmt(p.Syy)}`, `Σxy = ${fmt(p.Sxy)}`].map((v) => ({ text: v, class: "is-total" })));
  return [
    answer("Karl Pearson's coefficient of correlation", h("span", {}, "r = ", h("mark", {}, fmt(p.r))), h("p", {}, meaning(p))),
    block("Working table", h("p", { class: "lab-hint" }, `x and y are deviations from the means: x = X − X̄ and y = Y − Ȳ, with X̄ = ${fmt(p.sumX)} / ${p.n} = ${fmt(p.mx)} and Ȳ = ${fmt(p.sumY)} / ${p.n} = ${fmt(p.my)}.`),
      scroller(resultTable(["X", "Y", "x = X − X̄", "y = Y − Ȳ", "x²", "y²", "xy"], t), "Working table")),
    block("Coefficient", formula("r = Σxy / √(Σx² × Σy²)", `= ${fmt(p.Sxy)} / √(${fmt(p.Sxx)} × ${fmt(p.Syy)})`, `= ${fmt(p.Sxy)} / ${fmt(Math.sqrt(p.Sxx * p.Syy))}`, `= ${fmt(p.r)}`),
      where(["r", "Karl Pearson's coefficient of correlation"], ["X̄, Ȳ", `the means of X and Y, ${fmt(p.mx)} and ${fmt(p.my)}`], ["x", "X − X̄, how far each X is from its mean"], ["y", "Y − Ȳ, how far each Y is from its mean"],
        ["Σxy", "the sum of the products x × y, from the last column"], ["Σx², Σy²", "the sums of the squared deviations"], ["Σ", "“the sum of”: add the column up"]),
      h("p", { class: "lab-hint" }, "r lies between −1 and +1. Close to +1 or −1 means a strong straight-line relationship; close to 0 means little or none. Correlation alone does not show that one causes the other.")),
    block("Scatter diagram", chart([{ points: X.map((x, i) => [x, Y[i]]), kind: "dots" }], { xLabel: "X", yLabel: "Y" })),
  ];
}

function spearmanBlocks(X, Y, given) {
  const s = C.spearman(X, Y, given);
  const t = s.rows.map((r) => [...(given ? [] : [fmt(r.x), fmt(r.y)]), fmt(r.rx), fmt(r.ry), fmt(r.D), fmt(r.D2)]);
  t.push([...(given ? [] : ["", ""]), "", "", "", `ΣD² = ${fmt(s.sumD2)}`].map((v) => ({ text: v, class: "is-total" })));
  const n = s.n;
  const tieText = s.cfs.map((c) => `${c.m} items tied${given ? ` at rank ${fmt(c.rank)}` : ` at ${fmt(c.value)} (rank ${fmt(c.rank)})`}: (${c.m}³ − ${c.m}) / 12 = ${fmt(c.cf)}`);
  return [
    answer("Spearman's rank correlation", h("span", {}, "R = ", h("mark", {}, fmt(s.R))), h("p", {}, meaning(s))),
    block("Ranks", !given ? h("p", { class: "lab-hint" }, "The largest value gets rank 1. Tied values share the average of the ranks they cover.") : null,
      scroller(resultTable([...(given ? [] : ["X", "Y"]), "Rank R₁", "Rank R₂", "D = R₁ − R₂", "D²"], t), "Ranks")),
    block("Coefficient", s.CF > 0
      ? formula("With tied ranks: R = 1 − 6 [ΣD² + Σ(m³ − m) / 12] / (n³ − n)", ...tieText, `Correction = ${fmt(s.CF)}`, `R = 1 − 6 × (${fmt(s.sumD2)} + ${fmt(s.CF)}) / (${n}³ − ${n})`, `= 1 − ${fmt(6 * (s.sumD2 + s.CF))} / ${n ** 3 - n}`, `= ${fmt(s.R)}`)
      : formula("R = 1 − 6ΣD² / (n³ − n)", `= 1 − 6 × ${fmt(s.sumD2)} / (${n}³ − ${n})`, `= 1 − ${fmt(6 * s.sumD2)} / ${n ** 3 - n}`, `= ${fmt(s.R)}`),
      where(["R", "Spearman's rank correlation coefficient"], ["R₁, R₂", "the ranks of an item by X and by Y"], ["D", "R₁ − R₂, the difference between the two ranks"], ["n", `the number of items, ${n}`], ["Σ", "“the sum of”: add the column up"],
        s.CF > 0 ? ["m", "how many items share a tied rank; each tie adds (m³ − m) / 12"] : null),
      h("p", { class: "lab-hint" }, "Rank correlation suits qualities that can be ranked but not measured, such as beauty or honesty, and the ranks given by two judges.")),
  ];
}

boot();
