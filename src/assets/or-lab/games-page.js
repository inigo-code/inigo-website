// Game theory page: two-person zero-sum games, worked in textbook order.
import { h, s, $, messages, saveState, loadState, shareButton, block, scroller, where, scale, ticks, fmt, parseNum } from "./ui.js";
import { validate, solve } from "./lib/games.js";

const EXAMPLE = { cost: [["3", "2", "4", "0"], ["3", "4", "2", "4"], ["4", "2", "4", "0"], ["0", "4", "0", "8"]] };
const MAX = 8;
const root = $("#lab");
let state = loadState() || structuredClone(EXAMPLE);
let results, msgBox, grid;
const R = (i) => `A${i + 1}`, C = (j) => `B${j + 1}`;

// 0.4 → "0.4 (2/5)", for probabilities students usually write as fractions.
function prob(x) {
  if (Math.abs(x) < 1e-9) return "0";
  if (Math.abs(x - 1) < 1e-9) return "1";
  for (let d = 2; d <= 200; d++) {
    const n = Math.round(x * d);
    if (Math.abs(x - n / d) < 1e-9) return `${fmt(x)} (${n}/${d})`;
  }
  return fmt(x);
}
const val = (x) => {
  for (let d = 1; d <= 200; d++) { const n = Math.round(x * d); if (Math.abs(x - n / d) < 1e-9) return d === 1 ? fmt(x) : `${fmt(x)} (${n < 0 ? "−" : ""}${Math.abs(n)}/${d})`; }
  return fmt(x);
};

function drawInputs() {
  const m = state.cost.length, n = state.cost[0].length;
  const cell = (value, label) => h("td", {}, h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", value, "aria-label": label }));
  grid = h("table", { class: "lab-table lab-input lab-grid" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }, h("span", { class: "sr-only" }, "Player A's strategy")), [...Array(n).keys()].map((j) => h("th", { scope: "col" }, C(j))))),
    h("tbody", {}, state.cost.map((r, i) => h("tr", {}, h("th", { scope: "row" }, R(i)), r.map((v, j) => cell(v, `${R(i)} against ${C(j)}`))))));
  const sizeSelect = (label, value, onchange) => h("label", { class: "lab-field w-s" }, h("span", {}, label),
    h("select", { onchange }, [...Array(MAX).keys()].map((k) => h("option", { value: k + 1, selected: k + 1 === value }, String(k + 1)))));
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your game"),
    h("p", { class: "lab-hint" }, "Enter the pay-off matrix from player A's side: what A gains (B loses) for each pair of strategies. A negative number is a loss for A. A chooses a row and B a column."),
    h("div", { class: "lab-controls" },
      sizeSelect("A's strategies (rows)", m, (e) => { read(); resize(Number(e.target.value), n); }),
      sizeSelect("B's strategies (columns)", n, (e) => { read(); resize(m, Number(e.target.value)); })),
    scroller(grid, "Pay-off matrix"),
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state = structuredClone(EXAMPLE); drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state.cost = state.cost.map((r) => r.map(() => "")); drawInputs(); results.replaceChildren(); } }, "Clear"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Solve the game")),
    msgBox);
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function resize(m, n) {
  state.cost = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => state.cost[i]?.[j] ?? ""));
  drawInputs();
}
function read() { state.cost = [...grid.tBodies[0].rows].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value)); }

function run() {
  read();
  const A = state.cost.map((r) => r.map(parseNum));
  const errors = validate(A).map((e) => e.replace(/Cell \((\d+), (\d+)\)/, (_, i, j) => `${R(i - 1)} against ${C(j - 1)}`));
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(A, solve(A));
}

// The pay-off matrix with row minimums and column maximums.
function saddleTable(A, sp) {
  return scroller(h("table", { class: "lab-table lab-grid" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }), A[0].map((_, j) => h("th", { scope: "col" }, C(j))), h("th", { scope: "col" }, "Row minimum"))),
    h("tbody", {},
      A.map((r, i) => h("tr", {}, h("th", { scope: "row" }, R(i)),
        r.map((v, j) => h("td", { class: sp.points.some(([a, b]) => a === i && b === j) ? "is-pick" : null }, fmt(v))),
        h("td", { class: `is-total${sp.rowMin[i] === sp.maximin ? " is-crit" : ""}` }, fmt(sp.rowMin[i])))),
      h("tr", { class: "lab-total-row" }, h("th", { scope: "row" }, "Column maximum"),
        sp.colMax.map((v) => h("td", { class: v === sp.minimax ? "is-crit" : null }, fmt(v))), h("td", {})))), "Pay-off matrix with row minimums and column maximums");
}

// A matrix showing only the rows and columns still in play.
function subTable(A, rows, cols, removed) {
  return scroller(h("table", { class: "lab-table lab-grid" },
    h("thead", {}, h("tr", {}, h("th", { scope: "col" }), cols.map((j) => h("th", { scope: "col", class: removed && removed.kind === "col" && removed.removed === j ? "is-gone" : null }, C(j))))),
    h("tbody", {}, rows.map((i) => h("tr", {}, h("th", { scope: "row", class: removed && removed.kind === "row" && removed.removed === i ? "is-gone" : null }, R(i)),
      cols.map((j) => h("td", { class: removed && ((removed.kind === "row" && removed.removed === i) || (removed.kind === "col" && removed.removed === j)) ? "is-gone" : null }, fmt(A[i][j]))))))), "Matrix");
}

function show(A, r) {
  const blocks = [];
  const m = A.length, n = A[0].length;
  const sp = r.saddle;
  const pure = r.method === "saddle" || r.method === "saddle-after-dominance";
  const answer = [h("p", { class: "label" }, pure ? "Pure strategies: the game has a saddle point" : "Mixed strategies: no saddle point"),
    h("p", { class: "big" }, "Value of the game ", h("mark", {}, val(r.value)))];
  if (pure) {
    const i = r.p.findIndex((x) => x === 1), j = r.q.findIndex((x) => x === 1);
    answer.push(h("p", {}, `A always plays ${R(i)} and B always plays ${C(j)}.`));
  } else {
    answer.push(h("p", {}, `A plays ${r.p.map((x, i) => (x > 1e-9 ? `${R(i)} with probability ${prob(x)}` : null)).filter(Boolean).join(", ")}.`));
    answer.push(h("p", {}, `B plays ${r.q.map((x, j) => (x > 1e-9 ? `${C(j)} with probability ${prob(x)}` : null)).filter(Boolean).join(", ")}.`));
  }
  answer.push(h("p", {}, r.value > 1e-9 ? "The game favours A." : r.value < -1e-9 ? "The game favours B." : "The game is fair (value 0)."));
  blocks.push(block(null, h("div", { class: "lab-answer" }, answer)));

  // Step 1: saddle point.
  blocks.push(block("Step 1. Look for a saddle point", saddleTable(A, sp),
    h("p", { class: "lab-prose" }, `Maximin (the largest row minimum) = ${fmt(sp.maximin)}. Minimax (the smallest column maximum) = ${fmt(sp.minimax)}. ` +
      (sp.points.length
        ? `They are equal, so the game has a saddle point at ${sp.points.map(([i, j]) => `(${R(i)}, ${C(j)})`).join(" and ")} and the value is ${fmt(sp.value)}. Both players use pure strategies.`
        : `They are not equal, so there is no saddle point. The value lies between ${fmt(sp.maximin)} and ${fmt(sp.minimax)}, and the players must mix their strategies.`)),
    where(["Saddle point", "a pay-off that is the smallest in its row and the largest in its column"], ["Value", "what A gains on average when both players play their best"],
      ["Pure strategy", "always playing the same row (or column)"], ["Mixed strategy", "choosing among rows (or columns) at random, with set probabilities"])));
  if (r.method === "saddle") return finish(blocks);

  // Step 2: dominance.
  const red = r.reduction;
  const domSteps = red.steps.map((st) => h("div", { class: "lab-step" },
    h("p", {}, st.average
      ? (st.kind === "row"
        ? `Every value in ${R(st.removed)} is less than or equal to the average of ${R(st.by[0])} and ${R(st.by[1])} (${st.cols.map((j) => fmt((A[st.by[0]][j] + A[st.by[1]][j]) / 2)).join(", ")}), so A does at least as well by mixing those two. Delete row ${R(st.removed)}.`
        : `Every value in ${C(st.removed)} is greater than or equal to the average of ${C(st.by[0])} and ${C(st.by[1])} (${st.rows.map((i) => fmt((A[i][st.by[0]] + A[i][st.by[1]]) / 2)).join(", ")}), so B does at least as well by mixing those two. Delete column ${C(st.removed)}.`)
      : st.kind === "row"
      ? `Every value in ${R(st.removed)} is ${st.equal ? "equal to" : "less than or equal to"} the matching value in ${R(st.by)}, so A would never play ${R(st.removed)}. Delete row ${R(st.removed)}.`
      : `Every value in ${C(st.removed)} is ${st.equal ? "equal to" : "greater than or equal to"} the matching value in ${C(st.by)}, so B (who wants to pay less) would never play ${C(st.removed)}. Delete column ${C(st.removed)}.`),
    subTable(A, st.rows, st.cols, st)));
  blocks.push(block("Step 2. Remove dominated strategies", red.steps.length
    ? [...domSteps, h("p", { class: "lab-hint" }, `The reduced game is ${red.rows.length} × ${red.cols.length}:`), subTable(A, red.rows, red.cols)]
    : h("p", { class: "lab-prose" }, "No row or column is dominated, so the game cannot be reduced.")));
  if (r.method === "saddle-after-dominance") {
    blocks.push(block("Step 3. Saddle point of the reduced game", h("p", { class: "lab-prose" }, `The reduced game has a saddle point, so the value is ${fmt(r.value)} with pure strategies.`)));
    return finish(blocks);
  }

  // Step 3: solve the reduced game.
  const RM = r.reduced;
  if (r.method === "2x2") {
    const [[a, b], [c, d]] = RM, F = r.formula;
    blocks.push(block("Step 3. The 2 × 2 formula", formula2(a, b, c, d, F, [R(red.rows[0]), R(red.rows[1])], [C(red.cols[0]), C(red.cols[1])]),
      where(["a, b, c, d", "the four pay-offs of the 2 × 2 game, read across the first row and then the second"], ["p", "the probability that A plays the first row"], ["q", "the probability that B plays the first column"], ["v", "the value of the game: A's average gain when both play their best"])));
  } else if (r.method === "graphical") {
    const g = r.graph;
    const names = g.twoRows ? red.cols.map(C) : red.rows.map(R);
    const pairNames = r.graph.pair.map((L) => names[L.k]);
    blocks.push(block(`Step 3. The graphical method (${RM.length} × ${RM[0].length})`,
      h("p", { class: "lab-prose" }, g.twoRows
        ? `A plays ${R(red.rows[0])} with probability p and ${R(red.rows[1])} with 1 − p. Each line is A's expected gain against one of B's strategies. B will pick whichever is lowest, so A takes the highest point of the lower boundary.`
        : `B plays ${C(red.cols[0])} with probability q and ${C(red.cols[1])} with 1 − q. Each line is B's expected loss against one of A's strategies. A will pick whichever is highest, so B takes the lowest point of the upper boundary.`),
      graph(g, names, g.twoRows ? `p = probability that A plays ${R(red.rows[0])}` : `q = probability that B plays ${C(red.cols[0])}`),
      h("p", { class: "lab-prose" }, `The best point is where ${pairNames.join(" and ")} cross, at ${g.twoRows ? "p" : "q"} = ${prob(g.x)}. Solve the 2 × 2 game made of ${g.twoRows ? "those two columns" : "those two rows"}:`),
      formula2(...r.sub.flat(), r.formula,
        g.twoRows ? [R(red.rows[0]), R(red.rows[1])] : pairNames,
        g.twoRows ? pairNames : [C(red.cols[0]), C(red.cols[1])])));
  } else {
    blocks.push(block("Step 3. Linear programming", h("p", { class: "lab-prose" }, `The reduced game is ${RM.length} × ${RM[0].length} with no saddle point, which is larger than the 2 × 2 formula and the graphical method can handle. It is solved here as a linear programming problem; the answer above shows the optimal mixes.`)));
  }

  // Final strategies.
  blocks.push(block("Optimal strategies", h("div", { class: "lab-two" },
    scroller(h("table", { class: "lab-table" }, h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Player A"), h("th", { scope: "col" }, "Probability"))), h("tbody", {}, r.p.map((x, i) => h("tr", { class: x > 1e-9 ? "is-crit" : null }, h("th", { scope: "row" }, R(i)), h("td", {}, prob(x))))))),
    scroller(h("table", { class: "lab-table" }, h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Player B"), h("th", { scope: "col" }, "Probability"))), h("tbody", {}, r.q.map((x, j) => h("tr", { class: x > 1e-9 ? "is-crit" : null }, h("th", { scope: "row" }, C(j)), h("td", {}, prob(x))))))))));
  finish(blocks);
}

function formula2(a, b, c, d, F, rows, cols) {
  const den = `(${fmt(a)} + ${fmt(d)}) − (${fmt(b)} + ${fmt(c)}) = ${fmt(F.den)}`;
  return h("div", { class: "lab-formula" },
    h("p", {}, `With a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}, d = ${fmt(d)}:   (a + d) − (b + c) = ${den}`),
    h("p", {}, `p (${rows[0]}) = (d − c) / ${fmt(F.den)} = ${fmt(d - c)} / ${fmt(F.den)} = ${prob(F.p)}, so ${rows[1]} = ${prob(1 - F.p)}`),
    h("p", {}, `q (${cols[0]}) = (d − b) / ${fmt(F.den)} = ${fmt(d - b)} / ${fmt(F.den)} = ${prob(F.q)}, so ${cols[1]} = ${prob(1 - F.q)}`),
    h("p", {}, `v = (ad − bc) / ${fmt(F.den)} = (${fmt(a * d)} − ${fmt(b * c)}) / ${fmt(F.den)} = ${val(F.value)}`));
}

function graph(g, names, axisLabel) {
  const W = 640, H = 380, m = { l: 56, r: 64, t: 20, b: 48 };
  const vals = g.lines.flatMap((L) => [L.at0, L.at1]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.08; lo -= pad; hi += pad;
  const x = scale(0, 1, m.l, W - m.r), y = scale(lo, hi, H - m.b, m.t);
  const f = (L, t) => L.at1 * t + L.at0 * (1 - t);
  const xs = [0, 1];
  for (let a = 0; a < g.lines.length; a++) for (let b = a + 1; b < g.lines.length; b++) {
    const A = g.lines[a], B = g.lines[b], sa = A.at1 - A.at0, sb = B.at1 - B.at0;
    if (Math.abs(sa - sb) > 1e-12) { const t = (B.at0 - A.at0) / (sa - sb); if (t > 0 && t < 1) xs.push(t); }
  }
  xs.sort((p, q) => p - q);
  const env = (t) => (g.twoRows ? Math.min : Math.max)(...g.lines.map((L) => f(L, t)));
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: 720, role: "img", "aria-label": `Graphical method: the best point is at ${g.twoRows ? "p" : "q"} = ${fmt(g.x)} with value ${fmt(g.value)}.` });
  for (const t of ticks(lo, hi, 6)) svg.append(s("line", { x1: x(0), x2: x(1), y1: y(t), y2: y(t), class: "g-grid" }), s("text", { x: x(0) - 8, y: y(t) + 4, "text-anchor": "end", class: "g-small" }, fmt(t)));
  if (lo < 0 && hi > 0) svg.append(s("line", { x1: x(0), x2: x(1), y1: y(0), y2: y(0), class: "g-axis" }));
  svg.append(s("line", { x1: x(0), x2: x(0), y1: y(lo), y2: y(hi), class: "g-axis" }), s("line", { x1: x(1), x2: x(1), y1: y(lo), y2: y(hi), class: "g-axis" }));
  const v = g.twoRows ? "p" : "q";
  for (const t of [0, 0.25, 0.5, 0.75, 1]) svg.append(s("text", { x: x(t), y: H - m.b + 20, "text-anchor": "middle", class: "g-small" }, `${v} = ${fmt(t)}`));
  g.lines.forEach((L) => {
    svg.append(s("line", { x1: x(0), y1: y(L.at0), x2: x(1), y2: y(L.at1), class: "g-line" }));
    svg.append(s("text", { x: x(1) + 8, y: y(L.at1) + 4, class: "g-text g-bold g-halo" }, names[L.k]));
  });
  svg.append(s("polyline", { points: xs.map((t) => `${x(t)},${y(env(t))}`).join(" "), class: "g-crit" }));
  svg.append(s("line", { x1: x(g.x), x2: x(g.x), y1: y(lo), y2: y(g.value), class: "g-line g-dash" }));
  svg.append(s("circle", { cx: x(g.x), cy: y(g.value), r: 7, class: "g-opt" }),
    s("text", { x: x(g.x), y: y(g.value) + (g.twoRows ? -14 : 24), "text-anchor": "middle", class: "g-text g-bold g-halo" }, `v = ${fmt(g.value)}`));
  return h("figure", { class: "lab-figure" }, svg, h("figcaption", {}, `Across: ${axisLabel}. Up: expected pay-off to A.`), h("div", { class: "lab-legend" },
    h("span", {}, h("i", { class: "crit" }), g.twoRows ? "Lower boundary (what B allows A)" : "Upper boundary (what A forces on B)"),
    h("span", {}, h("i", { class: "dot crit" }), "Best point")));
}

function finish(blocks) {
  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

results = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
root.replaceChildren(results);
drawInputs();
if (location.hash.startsWith("#p=")) run();
