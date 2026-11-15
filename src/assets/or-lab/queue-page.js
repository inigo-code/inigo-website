// Single-server queue (M/M/1) page: every measure with its formula and working.
import { h, $, messages, saveState, loadState, shareButton, block, scroller, resultTable, pct, fmt, parseNum } from "./ui.js";
import { validate, mm1 } from "./lib/queue.js";

const EXAMPLE = { given: "rate", unit: "hour", a: "8", s: "10", n: "3", k: "2", t: "" };
const UNITS = { minute: { one: "minute", many: "minutes" }, hour: { one: "hour", many: "hours" }, day: { one: "day", many: "days" } };
const root = $("#lab");
let state = { ...EXAMPLE, ...(loadState() || {}) };
let results, msgBox, f;

function drawInputs() {
  const num = (value, label) => h("input", { type: "text", inputmode: "decimal", value, "aria-label": label });
  f = { a: num(state.a, "Arrivals"), s: num(state.s, "Services"), unit: h("select", { "aria-label": "Time unit" }, Object.entries(UNITS).map(([k, u]) => h("option", { value: k, selected: state.unit === k }, u.one))) };
  const rateMode = state.given === "rate";
  const u = UNITS[state.unit];
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your problem"),
    h("p", { class: "lab-hint" }, "One server, customers served first come first served, arrivals at random (Poisson) and service times at random (exponential), with no limit on the queue."),
    h("fieldset", { class: "lab-seg" }, h("legend", {}, "The problem gives"),
      [["rate", "Rates"], ["time", "Average times"]].map(([v, t]) => h("label", {}, h("input", { type: "radio", name: "given", value: v, checked: state.given === v, onchange: () => { read(); drawInputs(); } }), h("span", {}, t)))),
    h("div", { class: "lab-controls" },
      h("label", { class: "lab-field w-s" }, h("span", {}, "Time unit"), f.unit),
      h("label", { class: "lab-field w-m" }, h("span", {}, rateMode ? `Arrivals per ${u.one} (λ)` : `Time between arrivals (${u.many})`), f.a),
      h("label", { class: "lab-field w-m" }, h("span", {}, rateMode ? `Served per ${u.one} (μ)` : `Service time (${u.many})`), f.s)),
    h("p", { class: "lab-hint" }, rateMode
      ? "If the problem gives one customer every 6 minutes, choose “Average times” instead, or convert: 60 ÷ 6 = 10 per hour."
      : "The rates are worked out for you: λ = 1 ÷ time between arrivals, μ = 1 ÷ service time."),
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state = { ...EXAMPLE }; drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Work it out")),
    msgBox);
  f.unit.addEventListener("change", () => { read(); drawInputs(); });
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function read() {
  state.given = $('input[name="given"]:checked', root).value;
  state.unit = f.unit.value;
  state.a = f.a.value; state.s = f.s.value;
}

function run() {
  read();
  const a = parseNum(state.a), s = parseNum(state.s);
  const errors = [];
  if (!(a > 0)) errors.push(state.given === "rate" ? "Enter the number of arrivals as a positive number." : "Enter the time between arrivals as a positive number.");
  if (!(s > 0)) errors.push(state.given === "rate" ? "Enter the number served as a positive number." : "Enter the service time as a positive number.");
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  const lambda = state.given === "rate" ? a : 1 / a, mu = state.given === "rate" ? s : 1 / s;
  const e2 = validate(lambda, mu);
  if (e2.length) { messages(msgBox, e2.map((e) => e.replace(/\((\d[^)]*)\)/g, (_, x) => `(${fmt(Number(x))} per ${UNITS[state.unit].one})`))); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(mm1(lambda, mu));
}

// "0.4 hours (24 minutes)" for times, so students see both.
function timeText(x) {
  const u = UNITS[state.unit];
  const main = `${fmt(x)} ${fmt(x) === "1" ? u.one : u.many}`;
  if (state.unit === "hour") return `${main} (${fmt(x * 60, 2)} minutes)`;
  if (state.unit === "day") return `${main} (${fmt(x * 24, 2)} hours)`;
  return main;
}

function show(q) {
  const u = UNITS[state.unit];
  const L = fmt(q.lambda), M = fmt(q.mu);
  const blocks = [];
  blocks.push(block(null, h("div", { class: "lab-answer" },
    h("p", { class: "label" }, `λ = ${L} and μ = ${M} per ${u.one}`),
    h("p", { class: "big" }, "Server busy ", h("mark", {}, pct(q.rho)), " of the time"),
    h("p", {}, `On average ${fmt(q.ls)} customers are in the system and ${fmt(q.lq)} are waiting in the queue. A customer waits ${timeText(q.wq)} before being served and spends ${timeText(q.ws)} in all.`))));

  if (state.given === "time") blocks.push(block("Rates", h("div", { class: "lab-formula" },
    h("p", {}, `λ = 1 ÷ ${fmt(parseNum(state.a))} = ${L} arrivals per ${u.one}`),
    h("p", {}, `μ = 1 ÷ ${fmt(parseNum(state.s))} = ${M} served per ${u.one}`))));

  const rows = [
    ["Utilisation (traffic intensity)", "ρ = λ / μ", `${L} / ${M}`, pct(q.rho)],
    ["Probability the server is idle", "P₀ = 1 − ρ", `1 − ${fmt(q.rho)}`, pct(q.p0)],
    ["Expected number in the system", "Ls = λ / (μ − λ)", `${L} / (${M} − ${L})`, fmt(q.ls)],
    ["Expected number in the queue", "Lq = λ² / (μ(μ − λ))", `${L}² / (${M} × ${fmt(q.mu - q.lambda)})`, fmt(q.lq)],
    ["Expected time in the system", "Ws = 1 / (μ − λ)", `1 / (${M} − ${L})`, timeText(q.ws)],
    ["Expected time in the queue", "Wq = λ / (μ(μ − λ))", `${L} / (${M} × ${fmt(q.mu - q.lambda)})`, timeText(q.wq)],
    ["Expected length of a non-empty queue", "μ / (μ − λ)", `${M} / ${fmt(q.mu - q.lambda)}`, fmt(q.lNonEmpty)],
  ];
  blocks.push(block("Measures, with the working", scroller(resultTable(["Measure", "Formula", "Working", "Value"], rows)),
    h("p", { class: "lab-hint" }, `Check: Ls = Lq + ρ = ${fmt(q.lq)} + ${fmt(q.rho)} = ${fmt(q.lq + q.rho)}, and Ls = λ × Ws = ${L} × ${fmt(q.ws)} = ${fmt(q.lambda * q.ws)} (Little's law).`)));

  // Probability of n customers, until the tail is small.
  const pr = [];
  let cum = 0;
  for (let n = 0; n <= 30 && (cum < 0.99 || n < 5); n++) { const p = q.pn(n); cum += p; pr.push([String(n), pct(p), h("span", { class: "lab-meter", "aria-hidden": "true" }, h("b", { style: `width:${Math.min(100, (p / q.p0) * 100)}%` })), pct(cum)]); }
  blocks.push(block("How many customers are there?", scroller(resultTable(["n customers in the system", "Pₙ = (1 − ρ) ρⁿ", "", "P(n or fewer)"], pr.map((r) => [r[0], r[1], { node: r[2] }, r[3]]))),
    h("p", { class: "lab-hint" }, cum >= 0.99 - 1e-12
      ? "The table stops once the chance of more customers is under 1%."
      : `The table stops at ${pr.length - 1} customers. The chance of more than ${pr.length - 1} is ${pct(1 - cum)}; use “Other probabilities” below for any n.`)));

  // Questions a problem may ask.
  const ask = h("div", { class: "lab-ask" });
  const nIn = h("input", { type: "text", inputmode: "numeric", value: state.n, "aria-label": "n" });
  const kIn = h("input", { type: "text", inputmode: "numeric", value: state.k, "aria-label": "k" });
  const tIn = h("input", { type: "text", inputmode: "decimal", value: state.t || fmt(q.ws), "aria-label": "t" });
  const out = h("div", { class: "lab-formula", "aria-live": "polite" });
  const update = () => {
    const n = parseNum(nIn.value), k = parseNum(kIn.value), t = parseNum(tIn.value);
    state.n = nIn.value; state.k = kIn.value; state.t = tIn.value; saveState(state);
    const lines = [];
    if (Number.isInteger(n) && n >= 0) lines.push(`P(exactly ${n} in the system) = (1 − ρ) ρ^${n} = ${fmt(q.p0)} × ${fmt(q.rho)}^${n} = ${fmt(q.pn(n))} (${pct(q.pn(n))})`);
    else lines.push("Enter a whole number for n.");
    if (Number.isInteger(k) && k >= 0) lines.push(`P(more than ${k} in the system) = ρ^${k + 1} = ${fmt(q.rho)}^${k + 1} = ${fmt(q.pMoreThan(k))} (${pct(q.pMoreThan(k))})`);
    else lines.push("Enter a whole number for k.");
    if (t >= 0) {
      lines.push(`P(time in the system > ${fmt(t)} ${u.many}) = e^(−(μ − λ)t) = e^(−${fmt(q.mu - q.lambda)} × ${fmt(t)}) = ${fmt(q.pSystemOver(t))} (${pct(q.pSystemOver(t))})`);
      lines.push(`P(wait in the queue > ${fmt(t)} ${u.many}) = ρ e^(−(μ − λ)t) = ${fmt(q.rho)} × ${fmt(q.pSystemOver(t))} = ${fmt(q.pQueueOver(t))} (${pct(q.pQueueOver(t))})`);
    } else lines.push(`Enter a time t of zero or more, in ${u.many}.`);
    out.replaceChildren(...lines.map((l) => h("p", {}, l)));
  };
  for (const i of [nIn, kIn, tIn]) i.addEventListener("input", update);
  ask.append(h("div", { class: "lab-controls" },
    h("label", { class: "lab-field w-s" }, h("span", {}, "n"), nIn),
    h("label", { class: "lab-field w-s" }, h("span", {}, "k"), kIn),
    h("label", { class: "lab-field w-s" }, h("span", {}, `t (${u.many})`), tIn)), out);
  update();
  blocks.push(block("Other probabilities", ask));

  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

results = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
root.replaceChildren(results);
drawInputs();
if (location.hash.startsWith("#p=")) run();
