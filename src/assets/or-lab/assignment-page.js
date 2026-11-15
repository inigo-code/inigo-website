// Assignment problem page: the Hungarian method, table by table.
import { h, $, messages, saveState, loadState, shareButton, block, scroller, fmt, parseNum } from "./ui.js";
import { validate, solve } from "./lib/assignment.js";

const EXAMPLE = {
  sense: "min", rowWord: "Worker", colWord: "Job",
  cost: [["10", "9", "11", "8"], ["10", "7", "12", "9"], ["12", "8", "9", "6"], ["9", "11", "14", "10"]],
};
const MAX = 8;
const root = $("#lab");
let state = loadState() || structuredClone(EXAMPLE);
let results, msgBox, grid, words;

const cellText = (c) => (Number.isFinite(c) ? fmt(c) : "M");

function drawInputs() {
  const m = state.cost.length, n = state.cost[0].length;
  const rw = state.rowWord || "Row", cw = state.colWord || "Column";
  const cell = (value, label) => h("td", {}, h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", value, "aria-label": label }));
  grid = h("table", { class: "lab-table lab-input lab-grid" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, h("span", { class: "sr-only" }, rw)), [...Array(n).keys()].map((j) => h("th", { scope: "col" }, `${cw} ${j + 1}`)))),
    h("tbody", {}, state.cost.map((r, i) => h("tr", {}, h("th", { scope: "row" }, `${rw} ${i + 1}`), r.map((v, j) => cell(v, `${rw} ${i + 1}, ${cw} ${j + 1}`))))));
  const sizeSelect = (label, value, onchange) => h("label", { class: "lab-field w-s" }, h("span", {}, label),
    h("select", { onchange }, [...Array(MAX).keys()].map((k) => h("option", { value: k + 1, selected: k + 1 === value }, String(k + 1)))));
  words = [
    h("input", { type: "text", value: state.rowWord, maxlength: 20, "aria-label": "Name for the rows", onchange: () => { read(); drawInputs(); } }),
    h("input", { type: "text", value: state.colWord, maxlength: 20, "aria-label": "Name for the columns", onchange: () => { read(); drawInputs(); } }),
  ];
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your problem"),
    h("p", { class: "lab-hint" }, "Enter the cost (or profit) of each pairing. Type M where a pairing is not allowed. If the rows and columns are unequal, dummy rows or columns of zeros are added."),
    h("div", { class: "lab-controls" },
      h("label", { class: "lab-field w-m" }, h("span", {}, "Rows are"), words[0]),
      sizeSelect("How many", m, (e) => { read(); resize(Number(e.target.value), n); }),
      h("label", { class: "lab-field w-m" }, h("span", {}, "Columns are"), words[1]),
      sizeSelect("How many", n, (e) => { read(); resize(m, Number(e.target.value)); }),
      h("fieldset", { class: "lab-seg" }, h("legend", {}, "The table shows"),
        [["min", "Costs or times (minimise)"], ["max", "Profits (maximise)"]].map(([v, t]) => h("label", {}, h("input", { type: "radio", name: "sense", value: v, checked: state.sense === v }), h("span", {}, t))))),
    scroller(grid, "Assignment table"),
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state = structuredClone(EXAMPLE); drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state.cost = state.cost.map((r) => r.map(() => "")); drawInputs(); results.replaceChildren(); } }, "Clear"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Solve")),
    msgBox);
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function resize(m, n) {
  state.cost = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => state.cost[i]?.[j] ?? ""));
  drawInputs();
}

function read() {
  state.sense = $('input[name="sense"]:checked', root).value;
  state.rowWord = words[0].value.trim() || "Row";
  state.colWord = words[1].value.trim() || "Column";
  state.cost = [...grid.tBodies[0].rows].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value));
}

function run() {
  read();
  const cellNum = (t) => (/^\s*m\s*$/i.test(t) ? Infinity : parseNum(t));
  const p = { sense: state.sense, cost: state.cost.map((r) => r.map(cellNum)) };
  const errors = validate(p);
  if (errors.length) { messages(msgBox, errors.map((e) => e.replace(/Cell \((\d+), (\d+)\)/, (_, i, j) => `${state.rowWord} ${i}, ${state.colWord} ${j}`))); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(p, solve(p));
}

function names(n, r0, c0) {
  const rw = state.rowWord, cw = state.colWord;
  return {
    rows: [...Array(n).keys()].map((i) => (i < r0 ? `${rw} ${i + 1}` : `Dummy ${rw.toLowerCase()}`)),
    cols: [...Array(n).keys()].map((j) => (j < c0 ? `${cw} ${j + 1}` : `Dummy ${cw.toLowerCase()}`)),
  };
}

// One Hungarian table: zeros in bold, covering lines shaded (darker where two lines cross),
// and the chosen cells boxed in the final table.
function stepTable(step, nm) {
  const L = step.assign ? null : step.lines;
  return scroller(h("table", { class: "lab-table lab-grid" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }), nm.cols.map((t) => h("th", { scope: "col" }, t)))),
    h("tbody", {}, step.table.map((r, i) => h("tr", {}, h("th", { scope: "row" }, nm.rows[i], L && L.rows[i] ? h("span", { class: "sr-only" }, " (covered)") : null),
      r.map((c, j) => {
        const cls = [];
        if (Number.isFinite(c) && Math.abs(c) < 1e-9) cls.push("is-zero");
        if (L) { const k = (L.rows[i] ? 1 : 0) + (L.cols[j] ? 1 : 0); if (k === 1) cls.push("is-line"); if (k === 2) cls.push("is-line2"); }
        if (step.assign && step.assign[i] === j) cls.push("is-pick");
        return h("td", { class: cls.join(" ") || null }, cellText(c));
      }))))), "Hungarian method table");
}

function show(p, r) {
  const blocks = [];
  const isMax = p.sense === "max";
  if (!r.ok) {
    blocks.push(block(null, h("div", { class: "lab-answer" }, h("p", { class: "label" }, "No complete assignment"), h("p", { class: "big" }, "Not possible"), h("p", {}, r.error))));
    results.replaceChildren(...blocks);
    return;
  }
  const r0 = p.cost.length, c0 = p.cost[0].length;
  const nm = names(r.n, r0, c0);
  const rw = state.rowWord, cw = state.colWord;
  const lines = r.pairs.map((x) => {
    if (x.row >= r0) return `${nm.cols[x.col]} is left without a ${rw.toLowerCase()} (dummy)`;
    if (x.col >= c0) return `${nm.rows[x.row]} gets no ${cw.toLowerCase()} (dummy)`;
    return `${nm.rows[x.row]} → ${nm.cols[x.col]} (${cellText(x.value)})`;
  });
  const answer = [
    h("p", { class: "label" }, isMax ? "Maximum total" : "Minimum total"),
    h("p", { class: "big" }, h("mark", {}, r.usesM ? "Not possible" : fmt(r.total))),
    h("ul", { class: "lab-routes" }, lines.map((t) => h("li", {}, t))),
  ];
  if (r.usesM) answer.push(h("p", {}, "Every complete assignment uses a pairing marked M, so the problem has no feasible solution."));
  else if (r.alternative) answer.push(h("p", {}, "Another assignment gives the same total: the final table has more than one way of picking one zero in each row and column."));
  blocks.push(block(null, h("div", { class: "lab-answer" }, answer)));

  const real = r.pairs.filter((x) => !x.dummy);
  if (real.length) blocks.push(block("Total", h("p", { class: "lab-formula" }, `${real.map((x) => cellText(x.value)).join(" + ")} = ${r.usesM ? "M" : fmt(r.total)}`)));

  const steps = r.steps.map((st, k) => h("div", { class: "lab-step" },
    h("h3", {}, `Step ${k + 1}. ${st.title}${st.title.endsWith(".") ? "" : "."}`),
    k === 0 && r.notes.length ? h("ul", { class: "lab-list" }, r.notes.map((t) => h("li", {}, t))) : null,
    stepTable(st, nm),
    st.lines && !st.assign ? h("p", { class: "lab-hint" }, `Lines through ${describeLines(st.lines, nm)}.`) : null,
    st.assign ? h("p", { class: "lab-hint" }, "The dark cells are the assignment: one zero in every row and every column.") : null));
  blocks.push(block("Hungarian method, step by step", ...steps,
    h("p", { class: "lab-hint" }, "Shaded cells are covered by a line; darker shading marks a cell where two lines cross.")));

  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function describeLines(L, nm) {
  const parts = [...nm.rows.filter((_, i) => L.rows[i]), ...nm.cols.filter((_, j) => L.cols[j])];
  return parts.length ? parts.join(", ") : "none";
}

results = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
root.replaceChildren(results);
drawInputs();
if (location.hash.startsWith("#p=")) run();
