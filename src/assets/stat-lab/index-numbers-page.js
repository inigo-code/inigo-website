// Index numbers: Laspeyres, Paasche and Fisher, with the time reversal and factor reversal tests.
import { h, messages, saveState, block, scroller, resultTable, panel, show, start, formula, where, answer, fmt, parseNum } from "./kit.js";
import { inputTable, tableValues } from "../or-lab/ui.js";
import * as T from "./lib/timeseries.js";

const EXAMPLE = {
  rows: [["A", "10", "4", "12", "6"], ["B", "8", "6", "10", "5"], ["C", "12", "8", "15", "10"], ["D", "20", "2", "25", "3"]],
};
let table, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);

function draw() {
  table = inputTable({ head: ["Item", "p₀", "q₀", "p₁", "q₁"], rows: state.rows, cellAttrs: (i, j) => (j === 0 ? { inputmode: "text" } : {}), onRemove: (i) => { read(); if (state.rows.length > 1) state.rows.splice(i, 1); draw(); } });
  ({ msgBox } = panel({
    title: "Your items",
    hint: "For each item enter the base-year price p₀ and quantity q₀, and the current-year price p₁ and quantity q₁. The item name is optional.",
    kids: [scroller(table, "Items"), h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state.rows.push(["", "", "", "", ""]); draw(); } }, "Add an item"))],
    onExample: () => { Object.assign(state, structuredClone(EXAMPLE)); draw(); results.replaceChildren(); },
    onClear: () => { read(); state.rows = state.rows.map(() => ["", "", "", "", ""]); draw(); results.replaceChildren(); },
    onRun: run, runLabel: "Find the index numbers",
  }));
}
function read() { state.rows = tableValues(table); }

const r4 = (x) => fmt(x, 4);

function run() {
  read();
  const rows = state.rows.filter((r) => r.some((v) => v.trim()));
  const items = rows.map((r, i) => ({ name: r[0].trim() || String(i + 1), p0: parseNum(r[1]), q0: parseNum(r[2]), p1: parseNum(r[3]), q1: parseNum(r[4]) }));
  const errors = T.validateIndex(items);
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  const x = T.indexNumbers(items), S = x.T;
  const t = x.rows.map((r) => [r.name, fmt(r.p0), fmt(r.q0), fmt(r.p1), fmt(r.q1), fmt(r.p0q0), fmt(r.p1q0), fmt(r.p0q1), fmt(r.p1q1)]);
  t.push(["Total", "", "", "", "", `Σ = ${fmt(S.p0q0)}`, `Σ = ${fmt(S.p1q0)}`, `Σ = ${fmt(S.p0q1)}`, `Σ = ${fmt(S.p1q1)}`].map((v) => ({ text: v, class: "is-total" })));
  const yes = (b) => (b ? "The test is satisfied." : "The test is not satisfied.");
  show(results, [
    answer("Price index numbers (base year = 100)", h("span", {}, "Fisher's ", h("mark", {}, r4(x.F))),
      h("p", {}, `Laspeyres ${r4(x.L)}, Paasche ${r4(x.P)}.`),
      h("p", {}, `By Fisher's index, prices are ${fmt(Math.abs(x.F - 100), 2)}% ${x.F >= 100 ? "higher" : "lower"} than in the base year.`)),
    block("Working table", scroller(resultTable(["Item", "p₀", "q₀", "p₁", "q₁", "p₀q₀", "p₁q₀", "p₀q₁", "p₁q₁"], t), "Working table"),
      where(["p₀, q₀", "the price and quantity of an item in the base year (the year compared against)"], ["p₁, q₁", "the price and quantity of an item in the current year"],
        ["p₁q₀", "current price × base quantity: what the base-year basket costs at today's prices"], ["Σ", "“the sum of”: add the column up"])),
    block("Index numbers",
      formula("Laspeyres, weighted by base-year quantities:", "P₀₁ = Σp₁q₀ / Σp₀q₀ × 100", `= ${fmt(S.p1q0)} / ${fmt(S.p0q0)} × 100 = ${r4(x.L)}`),
      formula("Paasche, weighted by current-year quantities:", "P₀₁ = Σp₁q₁ / Σp₀q₁ × 100", `= ${fmt(S.p1q1)} / ${fmt(S.p0q1)} × 100 = ${r4(x.P)}`),
      formula("Fisher's ideal index:", "P₀₁ = √(L × P) = √(Σp₁q₀/Σp₀q₀ × Σp₁q₁/Σp₀q₁) × 100", `= √(${r4(x.L)} × ${r4(x.P)}) = ${r4(x.F)}`),
      where(["P₀₁", "the price index for the current year (1) on the base year (0); base year = 100"], ["L, P", "the Laspeyres and Paasche indices above"], ["√", "the square root"]),
      h("p", { class: "lab-hint" }, "Fisher's index is the geometric mean of Laspeyres and Paasche. It is called ideal because it satisfies both tests below.")),
    block("Time reversal test: P₀₁ × P₁₀ = 1", formula(
      `P₀₁ = √(${fmt(S.p1q0)}/${fmt(S.p0q0)} × ${fmt(S.p1q1)}/${fmt(S.p0q1)}) = ${r4(x.trt.P01)}`,
      `P₁₀ = √(Σp₀q₁/Σp₁q₁ × Σp₀q₀/Σp₁q₀) = √(${fmt(S.p0q1)}/${fmt(S.p1q1)} × ${fmt(S.p0q0)}/${fmt(S.p1q0)}) = ${r4(x.trt.P10)}`,
      `P₀₁ × P₁₀ = ${r4(x.trt.product)}. ${yes(x.trt.holds)}`),
      where(["P₁₀", "the same index worked backwards, with the current year as the base"], ["Test", "going forward and then back should bring you to where you started, so the product should be 1"])),
    block("Factor reversal test: P₀₁ × Q₀₁ = Σp₁q₁ / Σp₀q₀", formula(
      `Q₀₁ = √(Σq₁p₀/Σq₀p₀ × Σq₁p₁/Σq₀p₁) = √(${fmt(S.p0q1)}/${fmt(S.p0q0)} × ${fmt(S.p1q1)}/${fmt(S.p1q0)}) = ${r4(x.frt.Q01)}`,
      `P₀₁ × Q₀₁ = ${r4(x.trt.P01)} × ${r4(x.frt.Q01)} = ${r4(x.frt.product)}`,
      `Σp₁q₁ / Σp₀q₀ = ${fmt(S.p1q1)} / ${fmt(S.p0q0)} = ${r4(x.frt.value)}. ${yes(x.frt.holds)}`),
      where(["Q₀₁", "the quantity index, Fisher's formula with prices and quantities swapped"], ["Test", "price change × quantity change should equal the change in total value, Σp₁q₁ / Σp₀q₀"]),
      h("p", { class: "lab-hint" }, "Laspeyres and Paasche each fail both tests in general.")),
  ]);
}

boot();
