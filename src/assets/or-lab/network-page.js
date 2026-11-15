// Network Simulator page: CPM, PERT and a Monte Carlo simulation of the project time.
import { h, s, $, messages, inputTable, tableValues, saveState, loadState, shareButton, scale, ticks, pct, block, scroller, resultTable, kv, fmt, parseNum } from "./ui.js";
import { validate, cpm, pert, probabilityBy, timeFor, simulate, histogram } from "./lib/network.js";

const EXAMPLES = {
  cpm: [["A", "1", "2", "3"], ["B", "1", "3", "4"], ["C", "2", "3", "2"], ["D", "2", "4", "5"], ["E", "3", "4", "4"], ["F", "4", "5", "3"]],
  pert: [["A", "1", "2", "2", "4", "6"], ["B", "1", "3", "3", "5", "13"], ["C", "2", "4", "1", "2", "3"], ["D", "3", "4", "2", "3", "10"], ["E", "4", "5", "4", "6", "8"]],
};
const HEAD = {
  cpm: ["Activity", "From event (i)", "To event (j)", "Duration (t)"],
  pert: ["Activity", "From event (i)", "To event (j)", "Optimistic (a)", "Most likely (m)", "Pessimistic (b)"],
};

const root = $("#lab");
let state = loadState() || { mode: "cpm", rows: EXAMPLES.cpm, target: "", prob: "0.95", runs: "10000", dist: "beta", seed: "1" };
let table, results, msgBox;

function convertRows(rows, to) {
  return rows.map((r) => (to === "pert" ? [r[0], r[1], r[2], r[3] ?? "", r[3] ?? "", r[3] ?? ""] : [r[0], r[1], r[2], r[4] ?? r[3] ?? ""]));
}

function readRows() { return tableValues(table).filter((r) => r.some((v) => v.trim() !== "")); }

function drawInputs() {
  const seg = h("fieldset", { class: "lab-seg" }, h("legend", {}, "Activity times"),
    [["cpm", "CPM: one fixed time"], ["pert", "PERT: three time estimates"]].map(([v, t]) => h("label", {},
      h("input", { type: "radio", name: "mode", value: v, checked: state.mode === v, onchange: () => { state.rows = convertRows(readRows(), v); state.mode = v; drawInputs(); results.replaceChildren(); } }),
      h("span", {}, t))));
  table = inputTable({
    head: HEAD[state.mode], rows: state.rows,
    onRemove: (i) => { state.rows = readRows(); state.rows.splice(i, 1); drawInputs(); },
    cellAttrs: (i, j) => (j < 3 ? { inputmode: "text", class: "txt" } : {}),
  });
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your project"),
    h("p", { class: "lab-hint", html: state.mode === "cpm"
      ? "Enter each activity as an arrow from one event to another (activity-on-arrow). Use <strong>0</strong> as the duration of a dummy activity. The example is the office project from the <a href=\"/resources/critical-path-method/\">Critical Path Method note</a>."
      : "Give each activity its optimistic (a), most likely (m) and pessimistic (b) time, with a ≤ m ≤ b. Use <strong>0, 0, 0</strong> for a dummy activity." }),
    seg,
    scroller(table, "Activities"),
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state.rows = [...readRows(), state.mode === "cpm" ? ["", "", "", ""] : ["", "", "", "", "", ""]]; drawInputs(); table.tBodies[0].lastElementChild.querySelector("input").focus(); } }, "+ Add activity"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state.rows = EXAMPLES[state.mode].map((r) => r.slice()); drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state.rows = [state.mode === "cpm" ? ["", "", "", ""] : ["", "", "", "", "", ""]]; drawInputs(); results.replaceChildren(); } }, "Clear"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Analyse the network")),
    msgBox);
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function readActs() {
  state.rows = readRows();
  return state.rows.map((r) => {
    const base = { id: r[0].trim().toUpperCase(), start: r[1].trim(), end: r[2].trim() };
    return state.mode === "cpm" ? { ...base, t: parseNum(r[3]) } : { ...base, a: parseNum(r[3]), m: parseNum(r[4]), b: parseNum(r[5]) };
  });
}

function run() {
  const acts = readActs();
  const errors = validate(acts, state.mode);
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  const res = state.mode === "cpm" ? cpm(acts) : pert(acts);
  if (!res.ok) { messages(msgBox, res.errors); results.replaceChildren(); return; }
  messages(msgBox, [], res.warnings);
  saveState(state);
  showResults(acts, res);
}

// ----- results -----

const pathText = (res, p) => p.map((k) => res.rows[k].id).join(" → ");

function showResults(acts, res) {
  const unit = "days";
  const paths = h("ul", { class: "lab-paths" }, res.paths.map((p) => h("li", {}, pathText(res, p))));
  const answer = h("div", { class: "lab-answer" },
    h("p", { class: "label" }, state.mode === "cpm" ? "Project duration" : "Expected project duration (Te)"),
    h("p", { class: "big" }, h("mark", {}, `${fmt(res.total)} ${unit}`)),
    h("p", { class: "label" }, res.paths.length === 1 ? "Critical path" : `${res.paths.length} critical paths${res.truncated ? " (first 50 shown)" : ""}`),
    paths);

  const blocks = [block(null, answer)];
  blocks.push(block("Network diagram", diagram(res), h("div", { class: "lab-legend" },
    h("span", {}, h("i", { class: "dot crit" }), "Event on a critical path"),
    h("span", {}, h("i", { class: "crit" }), "Critical activity"),
    h("span", {}, h("i", {}), "Other activity"),
    h("span", {}, h("i", { class: "dash" }), "Dummy activity"),
    h("span", {}, "Inside each event: its number, then E | L"))));

  blocks.push(block("Event times", scroller(resultTable(["Event", "Earliest time E", "Latest time L", "Slack L − E"],
    res.order.map((n) => [n, res.early.get(n), res.late.get(n), fmt(res.late.get(n) - res.early.get(n))]),
    { rowClass: (i) => (Math.abs(res.late.get(res.order[i]) - res.early.get(res.order[i])) < 1e-9 ? "is-crit" : null) }), "Event times")));

  if (state.mode === "pert") {
    blocks.push(block("PERT estimates", scroller(resultTable(["Activity", "a", "m", "b", "t<sub>e</sub> = (a + 4m + b) / 6", "Variance ((b − a) / 6)²"],
      res.rows.map((r) => [r.id + (r.dummy ? " (dummy)" : ""), r.a, r.m, r.b, r.t, fmt(r.variance)]),
      { rowClass: (i) => (res.rows[i].critical ? "is-crit" : null) }), "PERT estimates")));
  }

  blocks.push(block("Activity times and floats", scroller(resultTable(
    ["Activity", "i → j", state.mode === "cpm" ? "t" : "t<sub>e</sub>", "ES", "EF", "LS", "LF", "Total float", "Free float", "Independent float"],
    res.rows.map((r) => [r.id + (r.dummy ? " (dummy)" : ""), `${r.start} → ${r.end}`, r.t, r.es, r.ef, r.ls, r.lf, r.tf, r.ff, r.ifl]),
    { rowClass: (i) => (res.rows[i].critical ? "is-crit" : null) }), "Activity times and floats"),
    h("div", { class: "lab-formula" },
      h("p", {}, "ES = E(i), EF = ES + t, LF = L(j), LS = LF − t"),
      h("p", {}, "Total float = L(j) − E(i) − t;  Free float = E(j) − E(i) − t;  Independent float = E(j) − L(i) − t (0 if negative)"),
      h("p", {}, "Highlighted rows are critical (total float 0)."))));

  if (state.mode === "pert") blocks.push(probabilityBlock(res), simulationBlock(acts, res));
  else blocks.push(block("Uncertain times?", h("p", { class: "lab-hint", html: "Switch to <strong>PERT: three time estimates</strong> above to work out the probability of finishing by a date, and to <strong>simulate</strong> the project thousands of times." })));

  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function probabilityBlock(res) {
  const Te = res.total, sd = res.sd;
  const tIn = h("input", { type: "text", inputmode: "decimal", id: "pert-t", value: state.target || fmt(Math.ceil(Te + sd)) });
  const pIn = h("input", { type: "text", inputmode: "decimal", id: "pert-p", value: state.prob || "0.95" });
  const out1 = h("div", { class: "lab-formula", "aria-live": "polite" }), out2 = h("div", { class: "lab-formula", "aria-live": "polite" });
  const update = () => {
    state.target = tIn.value; state.prob = pIn.value;
    const T = parseNum(tIn.value), p = parseNum(pIn.value);
    if (Number.isFinite(T)) {
      const r = probabilityBy(Te, sd, T);
      out1.replaceChildren(sd > 0
        ? h("p", {}, `Z = (T − Te) / σ = (${fmt(T)} − ${fmt(Te)}) / ${fmt(sd)} = ${fmt(r.z, 4)}`)
        : h("p", {}, "σ = 0: every time on the critical path is certain."),
      h("p", {}, h("strong", {}, `P(project finishes within ${fmt(T)}) = ${pct(r.p)}`)));
    } else out1.replaceChildren(h("p", {}, "Enter a target time."));
    if (Number.isFinite(p) && p > 0 && p < 1) {
      const r = timeFor(Te, sd, p);
      out2.replaceChildren(h("p", {}, `Z for ${pct(p)} = ${fmt(r.z, 4)}`), h("p", {}, h("strong", {}, `T = Te + Z × σ = ${fmt(Te)} + ${fmt(r.z, 4)} × ${fmt(sd)} = ${fmt(r.T, 2)}`)));
    } else out2.replaceChildren(h("p", {}, "Enter a probability between 0 and 1, such as 0.95."));
    saveState(state);
  };
  tIn.addEventListener("input", update); pIn.addEventListener("input", update);
  const pathVars = res.pathStats.length > 1
    ? h("p", { class: "lab-hint" }, `More than one path is critical. Their variances are ${res.pathStats.map((p) => `${pathText(res, p.path)}: ${fmt(p.variance)}`).join("; ")}. The largest is used, as the textbooks advise.`)
    : null;
  const box = block("Probability of finishing on time",
    kv([["Expected time T<sub>e</sub>", fmt(Te)], ["Variance of the critical path σ²", fmt(res.variance)], ["Standard deviation σ", fmt(sd)]]),
    pathVars,
    h("p", { class: "lab-hint" }, "PERT treats the project time as normally distributed with mean Te and standard deviation σ, using the critical path only."),
    h("div", { class: "lab-controls" }, h("div", { class: "lab-field w-m" }, h("label", { for: "pert-t" }, "Target time T"), tIn)), out1,
    h("div", { class: "lab-controls" }, h("div", { class: "lab-field w-m" }, h("label", { for: "pert-p" }, "Wanted probability"), pIn)), out2);
  update();
  return box;
}

function simulationBlock(acts, res) {
  const runs = h("select", { id: "sim-runs" }, ["1000", "10000", "50000"].map((v) => h("option", { value: v, selected: state.runs === v }, Number(v).toLocaleString("en-IN"))));
  const dist = h("select", { id: "sim-dist" }, [["beta", "Beta (PERT)"], ["triangular", "Triangular"], ["uniform", "Uniform a to b"]].map(([v, t]) => h("option", { value: v, selected: state.dist === v }, t)));
  const seed = h("input", { type: "text", inputmode: "numeric", id: "sim-seed", value: state.seed || "1" });
  const out = h("div", { class: "lab-results", tabindex: "-1" });
  const go = () => {
    state.runs = runs.value; state.dist = dist.value; state.seed = seed.value;
    const sd = Math.max(1, Math.floor(parseNum(seed.value)) || 1);
    const sim = simulate(acts, { runs: Number(runs.value), seed: sd, dist: dist.value });
    saveState(state);
    out.replaceChildren(...simResults(sim, res));
  };
  return block("Monte Carlo simulation",
    h("div", { class: "lab-prose" },
      h("p", {}, "PERT gives one answer from one path. A simulation instead plays the project out thousands of times: in each run every activity gets a random time between a and b, the critical path is found again, and the finishing time is recorded. The spread of those finishing times shows the real risk, including runs where a different path becomes critical."),
      h("p", { class: "lab-hint" }, "The seed makes a run repeatable: the same seed always gives the same random times, so a class can compare answers.")),
    h("div", { class: "lab-controls" },
      h("div", { class: "lab-field w-m" }, h("label", { for: "sim-runs" }, "Number of runs"), runs),
      h("div", { class: "lab-field w-m" }, h("label", { for: "sim-dist" }, "Random times drawn from"), dist),
      h("div", { class: "lab-field w-s" }, h("label", { for: "sim-seed" }, "Seed"), seed),
      h("button", { type: "button", class: "button", onclick: go }, "Run the simulation")),
    out);
}

function simResults(sim, res) {
  const T = parseNum(state.target);
  const hasT = Number.isFinite(T);
  const pertP = hasT ? probabilityBy(res.total, res.sd, T).p : null;
  const figs = [
    ["Average finishing time", fmt(sim.mean, 2), `PERT expected time: ${fmt(res.total)}`],
    ["Standard deviation", fmt(sim.sd, 2), `PERT σ: ${fmt(res.sd, 2)}`],
    ["Shortest and longest run", `${fmt(sim.min, 1)} – ${fmt(sim.max, 1)}`, null],
    ["Finished by (90% of runs)", fmt(sim.quantile(0.9), 2), null],
  ];
  if (hasT) figs.push([`Chance of finishing within ${fmt(T)}`, pct(sim.probBy(T)), `PERT formula: ${pct(pertP)}`]);
  const kids = [kv(figs.map(([k, v, small]) => [k, small ? h("span", {}, v, h("small", {}, small)) : v]))];
  kids.push(h("figure", { class: "lab-figure" }, histogramSvg(sim, res, hasT ? T : null),
    h("figcaption", {}, `How often each finishing time came up in ${sim.runs.toLocaleString("en-IN")} runs. The curve is the normal distribution PERT assumes (mean Te, standard deviation σ).${hasT ? " The red line is the target time." : ""}`)));
  const diff = sim.mean - res.total;
  if (diff > 0.05 * (res.sd || 1)) kids.push(h("p", { class: "lab-hint" }, `The simulated average (${fmt(sim.mean, 2)}) is later than PERT's Te (${fmt(res.total)}). PERT follows only the critical path; when another path is nearly as long, it sometimes takes over and pushes the finish later.`));
  kids.push(h("h3", { class: "lab-h" }, "How often each activity was critical"));
  kids.push(scroller(resultTable(["Activity", "Critical in", "PERT says"],
    sim.criticality.map((c, k) => [c.id, { node: h("span", {}, pct(c.share), h("span", { class: "lab-meter", "aria-hidden": "true" }, h("b", { style: `width:${(c.share * 100).toFixed(1)}%` }))) }, res.rows[k].critical ? "critical" : "not critical"]))));
  return kids;
}

// ----- drawings -----

function layout(res) {
  const level = new Map();
  for (const n of res.order) {
    let lv = 0;
    for (const r of res.rows) if (r.end === n) lv = Math.max(lv, level.get(r.start) + 1);
    level.set(n, lv);
  }
  const cols = [];
  for (const n of res.order) (cols[level.get(n)] ||= []).push(n);
  // Order each column by the average position of the events that lead into it, to cut crossings.
  const yIndex = new Map();
  cols.forEach((col, c) => {
    if (c > 0) {
      const bary = (n) => {
        const ins = res.rows.filter((r) => r.end === n).map((r) => yIndex.get(r.start) ?? 0);
        return ins.length ? ins.reduce((a, b) => a + b, 0) / ins.length : 0;
      };
      col.sort((a, b) => bary(a) - bary(b));
    }
    col.forEach((n, i) => yIndex.set(n, i - (col.length - 1) / 2));
  });
  return { level, cols, yIndex };
}

function diagram(res) {
  const { level, cols, yIndex } = layout(res);
  const colW = 160, rowH = 120, R = 27, padX = 60, padY = 70;
  const rows = Math.max(...cols.map((c) => c.length));
  const W = padX * 2 + (cols.length - 1) * colW, H = padY * 2 + (rows - 1) * rowH;
  const pos = new Map(res.order.map((n) => [n, [padX + level.get(n) * colW, H / 2 + yIndex.get(n) * rowH]]));
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Project network with ${res.order.length} events and ${res.rows.length} activities. Critical path: ${res.paths.map((p) => pathText(res, p)).join("; ")}.` });
  svg.append(s("defs", {},
    s("marker", { id: "ah", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, s("path", { d: "M0 0L10 5L0 10z", class: "g-head" })),
    s("marker", { id: "ahc", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" }, s("path", { d: "M0 0L10 5L0 10z", class: "g-head-crit" }))));
  const critEvents = new Set();
  res.paths.forEach((p) => p.forEach((k) => { critEvents.add(res.rows[k].start); critEvents.add(res.rows[k].end); }));
  const critArc = new Set(res.paths.flat());
  const labels = [];
  let skips = 0;
  res.rows.forEach((r, k) => {
    const [x1, y1] = pos.get(r.start), [x2, y2] = pos.get(r.end);
    const span = level.get(r.end) - level.get(r.start);
    const dx = x2 - x1, dy = y2 - y1;
    // An arrow that skips a column bends round the events in between (alternately up and down).
    const bend = span > 1 ? (Math.abs(dy) < 1 ? 0.28 : 0.12) * (skips++ % 2 ? 1 : -1) : 0;
    const cx = (x1 + x2) / 2 - bend * dy, cy = (y1 + y2) / 2 + bend * dx;
    // Trim the curve to the circles' edges.
    const a0 = Math.atan2(cy - y1, cx - x1), a1 = Math.atan2(y2 - cy, x2 - cx);
    const sx = x1 + R * Math.cos(a0), sy = y1 + R * Math.sin(a0), ex = x2 - (R + 2) * Math.cos(a1), ey = y2 - (R + 2) * Math.sin(a1);
    const crit = critArc.has(k);
    svg.append(s("path", { d: bend ? `M${sx} ${sy}Q${cx} ${cy} ${ex} ${ey}` : `M${sx} ${sy}L${ex} ${ey}`, class: `${crit ? "g-crit" : "g-line"}${r.dummy ? " g-dash" : ""}`, "marker-end": `url(#${crit ? "ahc" : "ah"})` }));
    const mx = bend ? 0.25 * x1 + 0.5 * cx + 0.25 * x2 : (x1 + x2) / 2, my = bend ? 0.25 * y1 + 0.5 * cy + 0.25 * y2 : (y1 + y2) / 2;
    const id = r.id.length > 10 ? r.id.slice(0, 9) + "…" : r.id;
    labels.push({ x: mx, y: my, text: `${id} (${fmt(r.t)})`, crit });
  });
  for (const L of labels) {
    const w = L.text.length * 7 + 10;
    svg.append(s("rect", { x: L.x - w / 2, y: L.y - 10, width: w, height: 20, rx: 5, class: "g-label-bg" }),
      s("text", { x: L.x, y: L.y + 4.5, class: `g-text${L.crit ? " g-bold" : ""}`, "text-anchor": "middle", "font-size": 12 }, L.text));
  }
  for (const n of res.order) {
    const [x, y] = pos.get(n), crit = critEvents.has(n);
    const name = n.length > 6 ? n.slice(0, 5) + "…" : n;
    svg.append(s("g", {},
      s("circle", { cx: x, cy: y, r: R, class: crit ? "g-node-crit" : "g-node" }),
      s("text", { x, y: y - 4, class: `g-node-text g-bold${crit ? " g-on-accent" : ""}`, "font-size": 13 }, name),
      s("text", { x, y: y + 12, class: `g-node-text${crit ? " g-on-accent" : ""}`, "font-size": 11 }, `${fmt(res.early.get(n), 2)} | ${fmt(res.late.get(n), 2)}`)));
  }
  return h("figure", { class: "lab-figure wide" }, svg);
}

function histogramSvg(sim, res, T) {
  const W = 680, H = 280, m = { l: 48, r: 16, t: 16, b: 40 };
  const bins = histogram(sim.times, 32);
  const lo = Math.min(bins[0].from, res.total - 3 * res.sd), hi = Math.max(bins.at(-1).to, res.total + 3 * res.sd, T ?? -Infinity);
  const x = scale(lo, hi, m.l, W - m.r);
  const w = bins[0].to - bins[0].from || 1;
  const pdf = (v) => (res.sd > 0 ? Math.exp(-(((v - res.total) / res.sd) ** 2) / 2) / (res.sd * Math.sqrt(2 * Math.PI)) : 0);
  const curveMax = res.sd > 0 ? sim.runs * w * pdf(res.total) : 0;
  const top = Math.max(...bins.map((b) => b.count), curveMax) * 1.08;
  const y = scale(0, top, H - m.b, m.t);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Histogram of simulated finishing times from ${fmt(sim.min, 1)} to ${fmt(sim.max, 1)}, average ${fmt(sim.mean, 2)}.` });
  for (const t of ticks(0, top, 4)) svg.append(s("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: "g-grid" }), s("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end", class: "g-small" }, t.toLocaleString("en-IN")));
  for (const b of bins) {
    const on = T !== null && b.to <= T + 1e-9;
    svg.append(s("rect", { x: x(b.from) + 0.5, y: y(b.count), width: Math.max(0.5, x(b.to) - x(b.from) - 1), height: y(0) - y(b.count), class: on ? "g-bar-on" : "g-bar" }));
  }
  if (res.sd > 0) {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const v = lo + (hi - lo) * i / 120; pts.push(`${x(v).toFixed(1)},${y(sim.runs * w * pdf(v)).toFixed(1)}`); }
    svg.append(s("polyline", { points: pts.join(" "), class: "g-curve" }));
  }
  svg.append(s("line", { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: "g-axis" }));
  for (const t of ticks(lo, hi, 8)) svg.append(s("line", { x1: x(t), x2: x(t), y1: y(0), y2: y(0) + 5, class: "g-axis" }), s("text", { x: x(t), y: H - m.b + 20, "text-anchor": "middle", class: "g-small" }, fmt(t)));
  svg.append(s("text", { x: (m.l + W - m.r) / 2, y: H - 4, "text-anchor": "middle", class: "g-small" }, "Project finishing time"));
  if (T !== null) svg.append(s("line", { x1: x(T), x2: x(T), y1: m.t, y2: y(0), class: "g-mark" }), s("text", { x: x(T) + 5, y: m.t + 12, class: "g-mark-text" }, `T = ${fmt(T)}`));
  return svg;
}

// ----- start -----
results = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
root.replaceChildren(results);
drawInputs();
if (location.hash.startsWith("#p=")) run();
