// Transportation problem page: NWC, Least Cost or Vogel to start, then MODI to the optimum.
import { h, $, messages, saveState, loadState, shareButton, block, stepsBox, scroller, kv, fmt, parseNum } from "./ui.js";
import { BIG, validate, solve, prepare, northWest, leastCost, vogel, totalCost } from "./lib/transport.js";

const EXAMPLE = {
  sense: "min", method: "vam",
  cost: [["19", "30", "50", "10"], ["70", "30", "40", "60"], ["40", "8", "70", "20"]],
  supply: ["7", "9", "18"], demand: ["5", "8", "7", "14"],
};
const METHODS = [["nwc", "North-West Corner"], ["lcm", "Least Cost"], ["vam", "Vogel's method"]];
const methodName = (m) => METHODS.find(([k]) => k === m)[1];
const MAX = 8;
const root = $("#lab");
let state = loadState() || structuredClone(EXAMPLE);
let results, msgBox, grid;

// Numbers that may contain M (a prohibited route) in the arithmetic.
const mfmt = (v) => {
  if (v === null || v === undefined) return "";
  if (Math.abs(v) < BIG / 10) return fmt(v);
  const k = Math.round(v / BIG), rest = v - k * BIG;
  const head = k === 1 ? "M" : k === -1 ? "−M" : `${fmt(k)}M`;
  return Math.abs(rest) < 1e-6 ? head : `${head} ${rest > 0 ? "+" : "−"} ${fmt(Math.abs(rest))}`;
};
const costText = (c) => (Number.isFinite(c) ? fmt(c) : "M");

function drawInputs() {
  const m = state.supply.length, n = state.demand.length;
  const cell = (value, label) => h("td", {}, h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", value, "aria-label": label }));
  grid = h("table", { class: "lab-table lab-input lab-grid" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, h("span", { class: "sr-only" }, "Source")),
      [...Array(n).keys()].map((j) => h("th", { scope: "col" }, `D${j + 1}`)), h("th", { scope: "col" }, "Supply"))),
    h("tbody", {},
      state.cost.map((r, i) => h("tr", {}, h("th", { scope: "row" }, `S${i + 1}`),
        r.map((v, j) => cell(v, `Cost from S${i + 1} to D${j + 1}`)), cell(state.supply[i], `Supply of S${i + 1}`))),
      h("tr", { class: "lab-total-row" }, h("th", { scope: "row" }, "Demand"),
        state.demand.map((v, j) => cell(v, `Demand of D${j + 1}`)), h("td", {}))));
  const sizeSelect = (label, value, onchange) => h("label", { class: "lab-field w-s" }, h("span", {}, label),
    h("select", { onchange }, [...Array(MAX).keys()].map((k) => h("option", { value: k + 1, selected: k + 1 === value }, String(k + 1)))));
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your problem"),
    h("p", { class: "lab-hint" }, "Enter the cost (or profit) of sending one unit along each route, with the supply of each source and the demand of each destination. Type M for a route that cannot be used. Unequal totals are fine: a dummy row or column is added."),
    h("div", { class: "lab-controls" },
      sizeSelect("Sources", m, (e) => { read(); resize(Number(e.target.value), n); }),
      sizeSelect("Destinations", n, (e) => { read(); resize(m, Number(e.target.value)); }),
      h("fieldset", { class: "lab-seg" }, h("legend", {}, "The table shows"),
        [["min", "Costs (minimise)"], ["max", "Profits (maximise)"]].map(([v, t]) => h("label", {}, h("input", { type: "radio", name: "sense", value: v, checked: state.sense === v }), h("span", {}, t))))),
    scroller(grid, "Costs, supply and demand"),
    h("fieldset", { class: "lab-seg" }, h("legend", {}, "Starting solution"),
      METHODS.map(([v, t]) => h("label", {}, h("input", { type: "radio", name: "method", value: v, checked: state.method === v }), h("span", {}, t)))),
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state = structuredClone(EXAMPLE); drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state.cost = state.cost.map((r) => r.map(() => "")); state.supply = state.supply.map(() => ""); state.demand = state.demand.map(() => ""); drawInputs(); results.replaceChildren(); } }, "Clear"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Solve")),
    msgBox);
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function resize(m, n) {
  const fit = (arr, k) => Array.from({ length: k }, (_, i) => arr[i] ?? "");
  state.cost = Array.from({ length: m }, (_, i) => fit(state.cost[i] || [], n));
  state.supply = fit(state.supply, m);
  state.demand = fit(state.demand, n);
  drawInputs();
}

function read() {
  state.sense = $('input[name="sense"]:checked', root).value;
  state.method = $('input[name="method"]:checked', root).value;
  const rows = [...grid.tBodies[0].rows].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value));
  const m = rows.length - 1;
  state.cost = rows.slice(0, m).map((r) => r.slice(0, -1));
  state.supply = rows.slice(0, m).map((r) => r.at(-1));
  state.demand = rows[m];
}

function run() {
  read();
  const cellNum = (t) => (/^\s*m\s*$/i.test(t) ? Infinity : parseNum(t));
  const p = { sense: state.sense, cost: state.cost.map((r) => r.map(cellNum)), supply: state.supply.map(parseNum), demand: state.demand.map(parseNum) };
  const errors = validate(p);
  if (!errors.length && p.cost.flat().every((c) => !Number.isFinite(c))) errors.push("Every route is marked M. At least one route must be usable.");
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(p, solve(p, state.method));
}

// A transportation table: allocations in dark boxes with the unit cost under them, and optionally
// the MODI figures (u, v, the Δ of each empty cell and the closed loop).
function allocTable(q, x, { costs = q.cost, it = null, eps = [] } = {}) {
  const names = rowColNames(q);
  const loopSign = new Map();
  if (it && it.loop) it.loop.forEach(([i, j], k) => loopSign.set(`${i},${j}`, k % 2 === 0 ? "+" : "−"));
  const isEps = (i, j) => eps.some(([a, b]) => a === i && b === j);
  const head = ["", ...names.cols, "Supply", it ? "u" : null].filter((t) => t !== null);
  const body = x.map((r, i) => h("tr", {},
    h("th", { scope: "row" }, names.rows[i]),
    r.map((a, j) => {
      const cls = [], sign = loopSign.get(`${i},${j}`);
      const kids = [];
      if (a !== null) {
        cls.push("is-alloc");
        kids.push(h("span", { class: "amt" }, a === 0 && isEps(i, j) ? "ε" : fmt(a)));
        kids.push(h("span", { class: "cost" }, `@ ${costText(costs[i][j])}`));
      } else if (it) {
        const d = it.delta[i][j];
        kids.push(h("span", { class: d < -1e-9 ? "is-neg" : "is-muted", title: "Δ = cost − u − v" }, `Δ ${mfmt(d)}`));
        kids.push(h("span", { class: "cost" }, `@ ${costText(costs[i][j])}`));
      } else kids.push(h("span", { class: "cost" }, costText(costs[i][j])));
      if (sign) { cls.push(sign === "+" ? "is-plus" : "is-minus"); kids.push(h("span", { class: "sign", "aria-label": sign === "+" ? "plus" : "minus" }, sign)); }
      if (it && it.enter && it.enter[0] === i && it.enter[1] === j) cls.push("is-enter");
      return h("td", { class: cls.join(" ") || null }, kids);
    }),
    h("td", { class: "is-total" }, fmt(q.supply[i])),
    it ? h("td", { class: "is-total" }, mfmt(it.u[i])) : null));
  const demandRow = h("tr", { class: "lab-total-row" }, h("th", { scope: "row" }, "Demand"), q.demand.map((d) => h("td", {}, fmt(d))), h("td", {}), it ? h("td", {}) : null);
  const vRow = it ? h("tr", { class: "lab-total-row" }, h("th", { scope: "row" }, "v"), it.v.map((v) => h("td", {}, mfmt(v))), h("td", {}), h("td", {})) : null;
  return scroller(h("table", { class: "lab-table lab-grid" },
    h("thead", {}, h("tr", {}, head.map((t) => h("th", { scope: "col" }, t)))),
    h("tbody", {}, body, demandRow, vRow)), "Transportation table");
}

function rowColNames(q) {
  const rows = [...Array(q.m).keys()].map((i) => (q.dummy === "row" && i === q.m - 1 ? "Dummy" : `S${i + 1}`));
  const cols = [...Array(q.n).keys()].map((j) => (q.dummy === "col" && j === q.n - 1 ? "Dummy" : `D${j + 1}`));
  return { rows, cols };
}

// "5 × 19 + 2 × 10 + … = 743", using the original costs or profits.
// Dummy cells cost nothing, so they are left out.
function sumText(orig, x, q) {
  const parts = [];
  const dummy = (i, j) => (q.dummy === "row" && i === q.m - 1) || (q.dummy === "col" && j === q.n - 1);
  x.forEach((r, i) => r.forEach((a, j) => { if (a && !dummy(i, j)) parts.push(`${fmt(a)} × ${costText(orig[i][j])}`); }));
  return parts.join(" + ");
}

function show(p, r) {
  const { q, start, startTotal, opt, finalTotal } = r;
  const names = rowColNames(q);
  const isMax = p.sense === "max";
  const word = isMax ? "profit" : "cost";
  const orig = Array.from({ length: q.m }, (_, i) => Array.from({ length: q.n }, (_, j) => (i < p.supply.length && j < p.demand.length ? p.cost[i][j] : 0)));
  const last = opt.iterations.at(-1);
  const blocks = [];

  // The answer.
  const routes = [];
  opt.x.forEach((row, i) => row.forEach((a, j) => {
    if (!a) return;
    if (q.dummy === "row" && i === q.m - 1) routes.push(`D${j + 1} is short by ${fmt(a)} (supplied by the dummy source)`);
    else if (q.dummy === "col" && j === q.n - 1) routes.push(`S${i + 1} keeps ${fmt(a)} unused (sent to the dummy destination)`);
    else routes.push(`S${i + 1} → D${j + 1}: ${fmt(a)} units`);
  }));
  const answer = [
    h("p", { class: "label" }, `${isMax ? "Maximum total profit" : "Minimum total cost"}`),
    h("p", { class: "big" }, h("mark", {}, fmt(finalTotal.cost))),
    h("ul", { class: "lab-routes" }, routes.map((t) => h("li", {}, t))),
  ];
  if (!r.feasible) answer.push(h("p", {}, "The best plan still uses a route marked M, so the problem has no feasible solution that avoids the prohibited routes."));
  else if (last.alternative) answer.push(h("p", {}, `Another allocation gives the same ${word}: an empty cell has Δ = 0 in the final table, so there are multiple optimal solutions.`));
  if (!opt.optimal) answer.push(h("p", {}, "The MODI method stopped after 100 iterations without reaching the optimum. Please check the problem."));
  blocks.push(block(null, h("div", { class: "lab-answer" }, answer)));

  // How the three starting methods compare on this problem.
  const startOf = { nwc: northWest, lcm: leastCost, vam: vogel };
  const balanced = prepare(p);
  const compare = METHODS.map(([k, t]) => {
    const tot = totalCost(orig, startOf[k](balanced).x);
    return [t + (k === state.method ? " (used below)" : ""), h("span", {}, tot.usesM ? "uses M" : fmt(tot.cost))];
  });
  compare.push([`Optimum (MODI)`, h("span", {}, fmt(finalTotal.cost))]);
  blocks.push(block(`Starting solutions compared`, kv(compare),
    h("p", { class: "lab-hint" }, `Total ${word} of the first allocation by each method, before MODI improves it. Vogel's method usually starts closest to the optimum.`)));

  // Setting up.
  const setup = [h("ul", { class: "lab-list" }, q.notes.map((t) => h("li", {}, t)))];
  if (q.dummy || isMax) setup.push(h("p", { class: "lab-hint" }, isMax ? "The tables below work with the regrets. The final answer is in the original profits." : "The tables below include the dummy."), allocTable(q, q.cost.map((r) => r.map(() => null))));
  blocks.push(block("Setting up", ...setup));

  // Initial solution.
  const startCount = start.x.flat().filter((a) => a !== null).length;
  blocks.push(block(`Initial solution: ${methodName(state.method)}`,
    allocTable(q, start.x),
    h("p", { class: "lab-formula" }, `Total ${word} = ${sumText(orig, start.x, q)} = ${startTotal.usesM ? "uses M" : fmt(startTotal.cost)}`),
    stepsBox(`How the ${start.steps.length} allocations were made`, h("ol", { class: "lab-list" }, start.steps.map((st) => h("li", {}, st.text,
      st.rowPen ? h("span", { class: "lab-pen" }, ` Penalties: rows ${st.rowPen.map((x) => `${names.rows[x.k]} ${mfmt(x.pen)}`).join(", ")}; columns ${st.colPen.map((x) => `${names.cols[x.k]} ${mfmt(x.pen)}`).join(", ")}.`) : null))))));

  // Degeneracy.
  const need = q.m + q.n - 1;
  const eps0 = opt.iterations[0].eps;
  blocks.push(block("Checking for degeneracy", h("p", { class: "lab-prose" }, startCount >= need
    ? `There are ${startCount} allocations and m + n − 1 = ${q.m} + ${q.n} − 1 = ${need}, so the solution is not degenerate and MODI can start.`
    : `There are only ${startCount} allocations but m + n − 1 = ${need}, so the solution is degenerate. A tiny amount ε (treated as 0) is placed in ${eps0.length === 1 ? "the cheapest empty cell that does not form a closed loop" : `${eps0.length} of the cheapest empty cells that do not form a closed loop`}: ${eps0.map(([i, j]) => `(${names.rows[i]}, ${names.cols[j]})`).join(", ")}.`)));

  // MODI iterations.
  const its = opt.iterations.map((it, k) => {
    const lines = [h("p", {}, `Start with u = 0 for ${names.rows[it.r0]} (the row with the most allocations). For every allocated cell, u + v = cost; for every empty cell, Δ = cost − u − v.`)];
    if (it.optimal) lines.push(h("p", {}, h("strong", {}, `Every Δ is zero or positive, so this allocation is optimal.`)));
    else {
      const loopText = it.loop.map(([i, j], t) => `(${names.rows[i]}, ${names.cols[j]}) ${t % 2 === 0 ? "+" : "−"}`).join(" → ");
      lines.push(h("p", {}, `The most negative Δ is ${mfmt(it.enterDelta)} at (${names.rows[it.enter[0]]}, ${names.cols[it.enter[1]]}), so that cell enters. Closed loop: ${loopText}.`));
      lines.push(h("p", {}, `θ = the smallest allocation in a − cell = ${fmt(it.theta)}. Add θ to the + cells and take it from the − cells; (${names.rows[it.leave[0]]}, ${names.cols[it.leave[1]]}) leaves.`));
    }
    return h("div", { class: "lab-step" }, h("h3", {}, `Table ${k + 1}${it.optimal ? ": optimal" : ""}`), allocTable(q, it.x, { it, eps: it.eps }), lines);
  });
  const modiBox = stepsBox(`MODI method: ${opt.iterations.length} table${opt.iterations.length > 1 ? "s" : ""}`, its);
  modiBox.open = true;
  blocks.push(block("Improving to the optimum", modiBox,
    h("p", { class: "lab-hint" }, "Δ in an empty cell is how much the total would change per unit sent along that route. Highlighted: the entering cell; + and − mark the closed loop.")));

  // Final allocation in the original figures.
  blocks.push(block("Optimal allocation",
    allocTable(q, opt.x, { costs: orig, eps: last.eps }),
    h("p", { class: "lab-formula" }, `Total ${word} = ${sumText(orig, opt.x, q)} = ${fmt(finalTotal.cost)}`)));

  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

results = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
root.replaceChildren(results);
drawInputs();
if (location.hash.startsWith("#p=")) run();
