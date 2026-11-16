// Time series: trend by semi-averages and by moving averages.
import { h, messages, saveState, block, scroller, resultTable, panel, seg, field, numInput, select, show, start, formula, where, answer, chart, fmt, parseNum } from "./kit.js";
import { inputTable, tableValues } from "../or-lab/ui.js";
import * as T from "./lib/timeseries.js";

const EXAMPLE = {
  method: "semi",
  k: "3",
  rows: [["2016", "412"], ["2017", "438"], ["2018", "446"], ["2019", "454"], ["2020", "470"], ["2021", "483"], ["2022", "490"]],
  at: "",
};
let table, kSel, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);

function draw() {
  table = inputTable({ head: ["Year", "Value"], rows: state.rows, onRemove: (i) => { read(); if (state.rows.length > 4) state.rows.splice(i, 1); draw(); } });
  const kids = [seg("method", "Method", [["semi", "Semi-averages"], ["moving", "Moving averages"]], state.method, (v) => { read(); state.method = v; draw(); results.replaceChildren(); })];
  if (state.method === "moving") {
    kSel = select([2, 3, 4, 5, 6, 7].map((k) => [String(k), `${k}-yearly`]), state.k, "Period", (v) => { state.k = v; });
    kids.push(h("div", { class: "lab-controls" }, field("Period", kSel, "w-s")));
  }
  kids.push(scroller(table, "Series"), h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); const t = state.rows.map((r) => parseNum(r[0])); const last = t.at(-1), gap = t.length > 1 ? t.at(-1) - t.at(-2) : 1; state.rows.push([Number.isFinite(last) && Number.isFinite(gap) ? yr(last + gap) : "", ""]); draw(); } }, "Add a year")));
  ({ msgBox } = panel({
    title: "Your series",
    hint: state.method === "semi"
      ? "Enter the years in order with their values. The series is split into two halves; with an odd number of years the middle year is left out."
      : "Enter the years in order with their values, and choose the period of the moving average. An even period is centred by averaging each pair of moving totals.",
    kids,
    onExample: () => { const m = state.method; Object.assign(state, structuredClone(EXAMPLE), { method: m, k: m === "moving" ? "4" : EXAMPLE.k }); draw(); results.replaceChildren(); },
    onClear: () => { read(); state.rows = state.rows.map(() => ["", ""]); draw(); results.replaceChildren(); },
    onRun: run, runLabel: "Find the trend",
  }));
}
function read() { state.rows = tableValues(table); if (kSel) state.k = kSel.value; }

function run() {
  read();
  const rows = state.rows.filter((r) => r.some((v) => v.trim()));
  const t = rows.map((r) => parseNum(r[0])), y = rows.map((r) => parseNum(r[1]));
  const errors = T.validateSeries(t, y);
  const k = Number(state.k);
  if (!errors.length && state.method === "moving" && t.length < k + (k % 2 === 0 ? 1 : 0)) errors.push(`A ${k}-yearly moving average needs at least ${k + (k % 2 === 0 ? 1 : 0)} years.`);
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(results, state.method === "semi" ? semiBlocks(t, y) : movingBlocks(t, y, k));
}

// Years are written plainly (2016, not 2,016).
const yr = (v) => String(Math.round(v * 1e6) / 1e6).replace("-", "−");

const graph = (t, y, trend, label) => block("Graph", chart([
  { points: t.map((x, i) => [x, y[i]]), kind: "line", cls: "g-series", marks: true, dotCls: "g-dot-soft", r: 3.5, label: "Actual values", key: "ink" },
  { points: t.map((x, i) => [x, trend[i]]).filter((p) => Number.isFinite(p[1])), kind: "line", cls: "g-trend", label, key: "thick" },
], { xLabel: "Year", yLabel: "Value", xFmt: (v) => (Number.isInteger(v) ? String(v) : "") }));

function semiBlocks(t, y) {
  const r = T.semiAverage(t, y);
  const span = (P) => `${yr(P.t[0])} to ${yr(P.t.at(-1))}`;
  const half = (P, name) => formula(`${name}, ${span(P)}: average = (${P.y.map((q) => fmt(q)).join(" + ")}) / ${P.y.length}`, `= ${fmt(P.sumY)} / ${P.y.length} = ${fmt(P.avg)}`, `It is placed at the middle year of the half, ${yr(P.mid)}.`);
  const dir = r.slope > 0 ? "rises" : r.slope < 0 ? "falls" : "does not change";
  const eqn = fmt(r.slope) === "0" ? `Trend = ${fmt(r.A.avg)}` : `Trend = ${fmt(r.A.avg)} ${r.slope < 0 ? "−" : "+"} ${fmt(Math.abs(r.slope))} × (Year − ${yr(r.A.mid)})`;
  const blocks = [
    answer("Trend by semi-averages", eqn, h("p", {}, `The trend ${dir}${r.slope ? ` by ${fmt(Math.abs(r.slope))} a year` : ""}.`)),
    block("Semi-averages", r.odd ? h("p", { class: "lab-hint" }, `There are ${t.length} years, an odd number, so the middle year ${yr(r.left.t)} (value ${fmt(r.left.y)}) is left out.`) : null,
      half(r.A, "First half"), half(r.B, "Second half"),
      formula("Change per year = (second average − first average) / (years between their middle years)", `= (${fmt(r.B.avg)} − ${fmt(r.A.avg)}) / (${yr(r.B.mid)} − ${yr(r.A.mid)})`, `= ${fmt(r.slope)}`),
      where(["Semi-average", "the average of one half of the series"], ["Trend", "the long-run straight-line movement of the series, with the ups and downs smoothed out"], ["Year − " + yr(r.A.mid), `the number of years after ${yr(r.A.mid)}, the middle of the first half`])),
    block("Trend values", h("p", { class: "lab-hint" }, `Each trend value is ${fmt(r.A.avg)} plus ${fmt(r.slope)} for every year after ${yr(r.A.mid)}.`),
      scroller(resultTable(["Year", "Value", "Trend value"], t.map((x, i) => [yr(x), fmt(y[i]), fmt(r.trend[i])])), "Trend values")),
  ];
  // Estimate for a chosen year.
  const inp = numInput(state.at, "Year to estimate"), out = h("div", { class: "lab-formula", "aria-live": "polite" });
  const update = () => {
    state.at = inp.value; saveState(state);
    const x = parseNum(inp.value);
    out.replaceChildren(h("p", {}, Number.isFinite(x) ? `Trend for ${yr(x)} = ${fmt(r.A.avg)} ${r.slope < 0 ? "−" : "+"} ${fmt(Math.abs(r.slope))} × (${yr(x)} − ${yr(r.A.mid)}) = ${fmt(r.A.avg + r.slope * (x - r.A.mid))}` : "Enter a year to estimate its trend value."));
  };
  inp.addEventListener("input", update); update();
  blocks.push(block("Estimate", h("div", { class: "lab-controls" }, field("Year", inp, "w-s")), out,
    h("p", { class: "lab-hint" }, "A semi-average trend assumes the series keeps changing in a straight line, so estimates far beyond the data are rough.")));
  blocks.push(graph(t, y, r.trend, "Trend line"));
  return blocks;
}

function movingBlocks(t, y, k) {
  const m = T.movingAverage(t, y, k);
  const have = m.rows.filter((r) => r.trend !== undefined), e = m.even ? k / 2 : (k - 1) / 2;
  const blocks = [answer(`${k}-yearly moving averages`, `${have.length} trend values`, h("p", {}, `From ${yr(have[0].t)} to ${yr(have.at(-1).t)}. There is no trend value for ${e === 1 ? "the first and the last year" : `the first ${e} and the last ${e} years`}.`))];
  if (!m.even) {
    blocks.push(block("Working table", h("p", { class: "lab-hint" }, `Each ${k}-yearly total adds the year's value and the ${(k - 1) / 2} on either side of it. The moving average is that total ÷ ${k}.`),
      where(["Moving average", `the average of ${k} neighbouring years, moved along one year at a time`], ["Trend value", "the moving average, written against the middle year it covers"]),
      scroller(resultTable(["Year", "Value", `${k}-yearly total`, `Moving average (÷ ${k})`], m.rows.map((r) => [yr(r.t), fmt(r.y), r.total === undefined ? "" : fmt(r.total), r.trend === undefined ? "" : fmt(r.trend)])), "Working table")));
  } else {
    blocks.push(block(`${k}-yearly totals`, h("p", { class: "lab-hint" }, `With an even period each ${k}-yearly total falls between two years, so it is centred: two neighbouring totals are added, which covers ${2 * k} values, and the sum is divided by ${2 * k}.`),
      formula(...m.totals.map((v, j) => `${yr(t[j])} to ${yr(t[j + k - 1])}: ${y.slice(j, j + k).map((q) => fmt(q)).join(" + ")} = ${fmt(v)}`))));
    blocks.push(block("Working table", where(["Centred total", `two neighbouring ${k}-yearly totals added, so the result sits against a single year`], ["Trend", `the centred total ÷ ${2 * k}, written against that year`]), scroller(resultTable(["Year", "Value", "Centred total", `Trend (÷ ${2 * k})`],
      m.rows.map((r) => [yr(r.t), fmt(r.y), r.centred === undefined ? "" : `${fmt(r.totalA)} + ${fmt(r.totalB)} = ${fmt(r.centred)}`, r.trend === undefined ? "" : fmt(r.trend)])), "Working table")));
  }
  blocks.push(graph(t, y, m.rows.map((r) => r.trend ?? NaN), "Moving average"));
  return blocks;
}

boot();
