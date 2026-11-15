// Monte Carlo simulation page: random-number ranges from a probability table, then a simulation of
// one variable (such as daily demand) or of a single-server queue.
import { h, $, messages, inputTable, tableValues, saveState, loadState, shareButton, block, scroller, resultTable, kv, pct, fmt, parseNum } from "./ui.js";
import { ranges, rangeText, pad, parseRandoms, randomNumbers, simulateOne, simulateQueue } from "./lib/montecarlo.js";

const EXAMPLE = {
  mode: "one", name: "Daily demand", unit: "minutes",
  dist: [["10", "0.10"], ["20", "0.25"], ["30", "0.40"], ["40", "0.25"]],
  arr: [["1", "0.20"], ["2", "0.30"], ["3", "0.35"], ["4", "0.15"]],
  srv: [["1", "0.10"], ["2", "0.40"], ["3", "0.35"], ["4", "0.15"]],
  source: "own", rns: "48 78 09 51 56 77 15 14 68 09", arrRns: "93 14 72 10 21 81 87 90 38 10", srvRns: "71 63 14 53 64 45 37 85 76 35",
  count: "10", seed: "1",
};
const MAX_ROWS = 100;
const root = $("#lab");
let state = { ...structuredClone(EXAMPLE), ...(loadState() || {}) };
let results, msgBox, f;

function distEditor(key, title) {
  const table = inputTable({ head: ["Value", "Probability or frequency"], rows: state[key], onRemove: (i) => { read(); state[key].splice(i, 1); drawInputs(); } });
  return { table, el: h("div", { class: "lab-dist" }, h("h3", { class: "lab-sub" }, title), table,
    h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state[key].push(["", ""]); drawInputs(); } }, "+ Add row"))) };
}

function drawInputs() {
  const one = state.mode === "one", own = state.source === "own";
  const area = (value, label) => h("textarea", { rows: 2, spellcheck: "false", "aria-label": label, class: "lab-area" }, value);
  f = {};
  const tables = [];
  if (one) {
    f.name = h("input", { type: "text", value: state.name, maxlength: 40, "aria-label": "What is being simulated" });
    f.dist = distEditor("dist", "Probability table");
    tables.push(h("label", { class: "lab-field w-m" }, h("span", {}, "What is simulated"), f.name), f.dist.el);
  } else {
    f.unit = h("input", { type: "text", value: state.unit, maxlength: 20, "aria-label": "Time unit" });
    f.arr = distEditor("arr", "Time between arrivals");
    f.srv = distEditor("srv", "Service time");
    tables.push(h("label", { class: "lab-field w-s" }, h("span", {}, "Time unit"), f.unit), h("div", { class: "lab-two" }, f.arr.el, f.srv.el));
  }
  const rnInputs = [];
  if (own) {
    if (one) { f.rns = area(state.rns, "Random numbers"); rnInputs.push(h("label", { class: "lab-field" }, h("span", {}, "Random numbers, one per trial"), f.rns)); }
    else {
      f.arrRns = area(state.arrRns, "Random numbers for arrivals"); f.srvRns = area(state.srvRns, "Random numbers for service");
      rnInputs.push(h("label", { class: "lab-field" }, h("span", {}, "Random numbers for arrivals"), f.arrRns), h("label", { class: "lab-field" }, h("span", {}, "Random numbers for service times"), f.srvRns));
    }
  } else {
    f.count = h("input", { type: "text", inputmode: "numeric", value: state.count, "aria-label": one ? "Trials" : "Customers" });
    f.seed = h("input", { type: "text", inputmode: "numeric", value: state.seed, "aria-label": "Seed" });
    rnInputs.push(h("div", { class: "lab-controls" },
      h("label", { class: "lab-field w-s" }, h("span", {}, one ? "Trials" : "Customers"), f.count),
      h("label", { class: "lab-field w-s" }, h("span", {}, "Seed"), f.seed)),
      h("p", { class: "lab-hint" }, "The same seed always gives the same random numbers, so a class can follow one simulation together."));
  }
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const radio = (name, value, text) => h("label", {}, h("input", { type: "radio", name, value, checked: state[name === "mcmode" ? "mode" : "source"] === value, onchange: () => { read(); drawInputs(); } }), h("span", {}, text));
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your problem"),
    h("fieldset", { class: "lab-seg" }, h("legend", {}, "Simulate"), radio("mcmode", "one", "One variable"), radio("mcmode", "queue", "A single-server queue")),
    h("p", { class: "lab-hint" }, "Enter probabilities that add up to 1, or frequencies (such as the number of days each demand was seen), which are turned into probabilities."),
    ...tables,
    h("fieldset", { class: "lab-seg" }, h("legend", {}, "Random numbers"), radio("source", "own", "Type them (from a table)"), radio("source", "gen", "Generate them")),
    ...rnInputs,
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { const mode = state.mode; state = { ...structuredClone(EXAMPLE), mode }; drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Simulate")),
    msgBox);
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function read() {
  state.mode = $('input[name="mcmode"]:checked', root).value;
  state.source = $('input[name="source"]:checked', root).value;
  if (f.name) { state.name = f.name.value.trim() || "Value"; state.dist = tableValues(f.dist.table); }
  if (f.unit) { state.unit = f.unit.value.trim() || "minutes"; state.arr = tableValues(f.arr.table); state.srv = tableValues(f.srv.table); }
  if (f.rns) state.rns = f.rns.value;
  if (f.arrRns) { state.arrRns = f.arrRns.value; state.srvRns = f.srvRns.value; }
  if (f.count) { state.count = f.count.value; state.seed = f.seed.value; }
}

const toDist = (rows) => rows.filter((r) => r.some((c) => c.trim() !== "")).map((r) => ({ value: parseNum(r[0]), p: parseNum(r[1]) }));

function run() {
  read();
  const errors = [];
  const tab = (rows, label) => { const t = ranges(toDist(rows)); t.errors.forEach((e) => errors.push(label ? `${label}: ${e}` : e)); return t; };
  const one = state.mode === "one";
  const tA = one ? tab(state.dist) : tab(state.arr, "Time between arrivals");
  const tS = one ? null : tab(state.srv, "Service time");
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  let rnA, rnS;
  if (state.source === "own") {
    const a = parseRandoms(one ? state.rns : state.arrRns, tA.digits);
    a.errors.forEach((e) => errors.push(one ? e : `Arrivals: ${e}`));
    rnA = a.nums;
    if (!one) { const s = parseRandoms(state.srvRns, tS.digits); s.errors.forEach((e) => errors.push(`Service: ${e}`)); rnS = s.nums; }
    if (!errors.length && !rnA.length) errors.push("Type at least one random number.");
    if (!errors.length && !one && !rnS.length) errors.push("Type at least one random number for the service times.");
  } else {
    const n = parseNum(state.count), seed = parseNum(state.seed);
    if (!Number.isInteger(n) || n < 1 || n > 1000) errors.push(`Enter a whole number of ${one ? "trials" : "customers"} from 1 to 1,000.`);
    if (!Number.isInteger(seed) || seed < 0) errors.push("Enter a whole number of zero or more for the seed.");
    if (!errors.length) { rnA = randomNumbers(n, tA.digits, seed); if (!one) rnS = randomNumbers(n, tS.digits, seed + 7919); }
  }
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  const warn = [];
  if (!one && rnA.length !== rnS.length) warn.push(`There are ${rnA.length} random numbers for arrivals and ${rnS.length} for service, so only ${Math.min(rnA.length, rnS.length)} customers are simulated.`);
  messages(msgBox, [], warn);
  saveState(state);
  if (one) showOne(tA, rnA); else showQueue(tA, tS, rnA, rnS);
}

function rangeBlock(t, title, valueHead) {
  return block(title, scroller(resultTable(
    [valueHead, ...(t.fromFrequencies ? ["Frequency"] : []), "Probability", "Cumulative probability", "Random numbers"],
    t.rows.map((r) => [fmt(r.value), ...(t.fromFrequencies ? [fmt(r.freq)] : []), fmt(r.p), fmt(r.cum), rangeText(r, t.digits)]))),
    h("p", { class: "lab-hint" }, `Each value gets as many of the ${pad(0, t.digits)}–${"9".repeat(t.digits)} random numbers as its probability: the range ends at the cumulative probability × ${fmt(t.scale)}, minus 1.${t.rows.some((r) => r.empty) ? " A value with probability 0 gets no numbers." : ""}`));
}

const capNote = (n) => (n > MAX_ROWS ? h("p", { class: "lab-hint" }, `The table shows the first ${MAX_ROWS} of ${fmt(n)} rows; the figures above use all of them.`) : null);

function showOne(t, rns) {
  const s = simulateOne(t, rns);
  const name = state.name, blocks = [];
  blocks.push(block(null, h("div", { class: "lab-answer" },
    h("p", { class: "label" }, `${name}: average of ${fmt(s.trials.length)} simulated trial${s.trials.length > 1 ? "s" : ""}`),
    h("p", { class: "big" }, h("mark", {}, fmt(s.average))),
    h("p", {}, `The expected value from the probabilities is ${fmt(t.mean)}. A short simulation can differ from it; the longer the run, the closer it gets.`))));
  blocks.push(rangeBlock(t, "Random-number ranges", name));
  blocks.push(block("Simulation", scroller(resultTable(["Trial", "Random number", name], s.trials.slice(0, MAX_ROWS).map((x) => [String(x.trial), pad(x.rn, t.digits), fmt(x.value)]))), capNote(s.trials.length),
    kv([["Total", fmt(s.total)], ["Average", fmt(s.average)], ["Expected value", h("span", {}, fmt(t.mean), h("small", {}, `Σ value × probability`))]])));
  // How often each value came up, against its probability.
  const counts = t.rows.map((r) => s.trials.filter((x) => x.value === r.value).length);
  blocks.push(block("How often each value came up", scroller(resultTable([name, "Probability", "Times in the simulation", "Share"],
    t.rows.map((r, k) => [fmt(r.value), pct(r.p), String(counts[k]), pct(counts[k] / s.trials.length)])))));
  // A long run, to show the average settling down.
  const long = simulateOne(t, randomNumbers(10000, t.digits, 2024));
  blocks.push(block("A longer run", h("p", { class: "lab-prose" }, `With 10,000 generated random numbers the average ${name.toLowerCase()} is ${fmt(long.average)}, against the expected ${fmt(t.mean)}.`)));
  finish(blocks);
}

function showQueue(tA, tS, rnA, rnS) {
  const s = simulateQueue(tA, tS, rnA, rnS);
  const u = state.unit, blocks = [];
  const n = s.rows.length;
  blocks.push(block(null, h("div", { class: "lab-answer" },
    h("p", { class: "label" }, `${fmt(n)} customer${n > 1 ? "s" : ""} simulated`),
    h("p", { class: "big" }, "Average wait ", h("mark", {}, `${fmt(s.avgWait)} ${u}`)),
    h("p", {}, `${s.waited} of ${n} customers had to wait. The server was idle for ${fmt(s.totalIdle)} of ${fmt(s.span)} ${u} (${pct(s.idleShare)}).`))));
  blocks.push(rangeBlock(tA, "Random-number ranges: time between arrivals", `Time (${u})`));
  blocks.push(rangeBlock(tS, "Random-number ranges: service time", `Time (${u})`));
  blocks.push(block("Simulation", scroller(resultTable(["Customer", "Random number", "Time since last arrival", "Arrives at", "Random number", "Service time", "Service starts", "Service ends", "Waiting time", "Server idle", "Time in system"],
    s.rows.slice(0, MAX_ROWS).map((r) => [String(r.customer), pad(r.arrRn, tA.digits), fmt(r.gap), fmt(r.arrival), pad(r.srvRn, tS.digits), fmt(r.service), fmt(r.start), fmt(r.end), fmt(r.wait), fmt(r.idle), fmt(r.inSystem)]))), capNote(n),
    h("p", { class: "lab-hint" }, `The clock starts at 0 and the first customer arrives after the first time between arrivals. Service starts at the arrival time or when the server is free, whichever is later.`),
    kv([
      ["Average waiting time", h("span", {}, fmt(s.avgWait), h("small", {}, `${fmt(s.totalWait)} ${u} ÷ ${n} customers`))],
      ["Average time in system", h("span", {}, fmt(s.avgInSystem), h("small", {}, u))],
      ["Customers who waited", h("span", {}, `${s.waited} of ${n}`, h("small", {}, pct(s.waited / n)))],
      ["Server idle", h("span", {}, pct(s.idleShare), h("small", {}, `${fmt(s.totalIdle)} of ${fmt(s.span)} ${u}`))],
    ])));
  finish(blocks);
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
