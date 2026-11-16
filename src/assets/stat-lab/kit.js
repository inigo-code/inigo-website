// Shared building blocks for Stats Lab pages, on top of the OR Lab helpers.
import { h, s, $, messages, saveState, loadState, shareButton, scroller, block, resultTable, kv, where, scale, ticks, fmt, parseNum, pct } from "../or-lab/ui.js";
import { F } from "./lib/frac.js";
import { inputTable, tableValues } from "../or-lab/ui.js";

export { h, s, $, messages, saveState, loadState, shareButton, scroller, block, resultTable, kv, where, scale, ticks, fmt, parseNum, pct, F };

export const root = () => $("#lab");

// The input panel: heading, hint, any controls, then Load example / Clear / main button, then messages.
export function panel({ title = "Your problem", hint, kids = [], onExample, onClear, onRun, runLabel = "Work it out" }) {
  const msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const el = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, title),
    hint ? (typeof hint === "string" ? h("p", { class: "lab-hint", html: hint }) : hint) : null,
    ...kids,
    h("div", { class: "lab-actions" },
      onExample ? h("button", { type: "button", class: "button ghost lab-small", onclick: onExample }, "Load example") : null,
      onClear ? h("button", { type: "button", class: "button ghost lab-small", onclick: onClear }, "Clear") : null,
      h("span", { class: "spacer" }),
      onRun ? h("button", { type: "button", class: "button", onclick: onRun }, runLabel) : null),
    msgBox);
  overlines(el);
  const r = root(), old = $(".lab-panel", r);
  if (old) old.replaceWith(el); else r.prepend(el);
  return { el, msgBox };
}

// A choice of options shown as a row of pills.
export function seg(name, legend, options, value, onchange) {
  return h("fieldset", { class: "lab-seg" }, h("legend", {}, legend),
    options.map(([v, t]) => h("label", {}, h("input", { type: "radio", name, value: v, checked: value === v, onchange: () => onchange(v) }), h("span", {}, t))));
}

export function field(label, input, size = "w-m") {
  return h("label", { class: `lab-field ${size}` }, h("span", {}, label), input);
}
export const numInput = (value, label, attrs = {}) => h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", value: value ?? "", "aria-label": label, ...attrs });
export function select(options, value, label, onchange) {
  return h("select", { "aria-label": label, onchange: onchange ? (e) => onchange(e.target.value) : null }, options.map(([v, t]) => h("option", { value: v, selected: String(v) === String(value) }, t)));
}
export function sizeSelect(label, value, max, onchange, min = 1) {
  return field(label, select(Array.from({ length: max - min + 1 }, (_, k) => [k + min, String(k + min)]), value, label, (v) => onchange(Number(v))), "w-s");
}

// An editable grid of inputs with optional row and column headings.
export function gridInput(values, { rowName, colNames, label, extraClass = "" }) {
  return h("table", { class: `lab-table lab-input lab-grid ${extraClass}` },
    colNames ? h("thead", {}, h("tr", {}, rowName ? h("th", { scope: "col" }, h("span", { class: "sr-only" }, "Row")) : null, colNames.map((c) => h("th", { scope: "col", html: c })))) : null,
    h("tbody", {}, values.map((r, i) => h("tr", {}, rowName ? h("th", { scope: "row" }, rowName(i)) : null,
      r.map((v, j) => h("td", {}, numInput(v, `${label} ${rowName ? rowName(i) : "row " + (i + 1)}, ${colNames ? colNames[j].replace(/<[^>]+>/g, "") : "column " + (j + 1)}`)))))));
}
export const gridValues = (table) => [...table.tBodies[0].rows].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value));

// A list of numbers typed as "12, 15 18; 20".
export function numberList(text) {
  const parts = String(text || "").split(/[\s,;]+/).filter(Boolean);
  const bad = parts.filter((p) => !Number.isFinite(parseNum(p)));
  return { values: parts.map(parseNum).filter(Number.isFinite), bad };
}

// A matrix drawn with brackets (or bars for a determinant). Entries may be F, numbers or strings.
export function mx(A, { det = false, label } = {}) {
  const n = A[0]?.length || 1;
  return h("span", { class: `mx${det ? " is-det" : ""}`, style: `--n:${n}`, role: "img", "aria-label": label || `${det ? "Determinant of the matrix" : "Matrix"} with rows ${A.map((r) => r.map(String).join(", ")).join("; ")}` },
    ...A.flat().map((v) => h("span", {}, v instanceof F ? String(v) : typeof v === "number" ? fmt(v) : String(v))));
}
// A line of working that mixes text and matrices: eq("A + B = ", mx(A), " + ", mx(B)).
export const eq = (...kids) => h("div", { class: "mx-line" }, ...kids.map((k) => (typeof k === "string" ? h("span", {}, k) : k)));

// "3/7 ≈ 0.4286" or "5".
export function fracText(f) {
  const a = f.approx();
  return a ? `${f} ${a.exact ? "=" : "≈"} ${a.text}` : String(f);
}

// X̄ written with a combining macron lands beside the letter in the site's fonts, so every
// letter followed by U+0304 is drawn as that letter with an overline instead.
export function overlines(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const hits = [];
  // NFD also splits precomposed letters such as Ȳ into Y + U+0304.
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.normalize("NFD").includes("̄") && !n.parentElement.closest("svg, textarea")) hits.push(n);
  for (const n of hits) {
    const parts = n.nodeValue.normalize("NFD").split(/(\S̄)/);
    n.replaceWith(...parts.filter(Boolean).map((p) => (p.length === 2 && p[1] === "̄" ? h("span", { class: "ov" }, p[0]) : p.normalize("NFC"))));
  }
}

// Results area: always ends with Copy link and Print, then scrolls into view.
export function show(results, blocks) {
  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks.filter(Boolean));
  overlines(results);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}
export const makeResults = () => {
  const r = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
  root().replaceChildren(r);
  return r;
};
export const answer = (label, big, ...more) => block(null, h("div", { class: "lab-answer" }, h("p", { class: "label" }, label), h("p", { class: "big" }, big), ...more));
export const formula = (...lines) => h("div", { class: "lab-formula" }, ...lines.map((l) => (typeof l === "string" ? h("p", {}, l) : l)));

// A simple x–y chart: series of { points: [[x, y]], kind: "line" | "dots", cls, label }.
export function chart(series, { xLabel = "", yLabel = "", width = 680, height = 320, xFmt = (v) => fmt(v), caption } = {}) {
  const pts = series.flatMap((sr) => sr.points).filter((p) => p.every(Number.isFinite));
  let [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  let [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const py = (y1 - y0) * 0.08, px = (x1 - x0) * 0.04;
  y0 -= py; y1 += py; x0 -= px; x1 += px;
  const m = { l: 58, r: 16, t: 14, b: 46 };
  const X = scale(x0, x1, m.l, width - m.r), Y = scale(y0, y1, height - m.b, m.t);
  const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": caption || `${yLabel} against ${xLabel}` });
  for (const t of ticks(y0, y1, 5)) svg.append(s("line", { x1: m.l, x2: width - m.r, y1: Y(t), y2: Y(t), class: "g-grid" }), s("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end", class: "g-small" }, fmt(t)));
  for (const t of ticks(x0, x1, 7)) svg.append(s("line", { x1: X(t), x2: X(t), y1: height - m.b, y2: height - m.b + 5, class: "g-axis" }), s("text", { x: X(t), y: height - m.b + 19, "text-anchor": "middle", class: "g-small" }, xFmt(t)));
  svg.append(s("line", { x1: m.l, x2: width - m.r, y1: height - m.b, y2: height - m.b, class: "g-axis" }), s("line", { x1: m.l, x2: m.l, y1: m.t, y2: height - m.b, class: "g-axis" }));
  svg.append(s("text", { x: (m.l + width - m.r) / 2, y: height - 6, "text-anchor": "middle", class: "g-small" }, xLabel));
  svg.append(s("text", { x: 14, y: (m.t + height - m.b) / 2, "text-anchor": "middle", class: "g-small", transform: `rotate(-90 14 ${(m.t + height - m.b) / 2})` }, yLabel));
  // Lines that run beyond the chart (regression lines) are clipped to it.
  const clipId = "clip" + Math.random().toString(36).slice(2, 8);
  svg.append(s("defs", {}, s("clipPath", { id: clipId }, s("rect", { x: m.l, y: m.t, width: width - m.l - m.r, height: height - m.t - m.b }))));
  for (const sr of series) {
    const P = sr.points.filter((p) => p.every(Number.isFinite));
    if (sr.kind === "line" && P.length > 1) svg.append(s("polyline", { points: P.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "), class: sr.cls || "g-ink", "clip-path": `url(#${clipId})` }));
    if (sr.kind !== "line" || sr.marks) for (const p of P) svg.append(s("circle", { cx: X(p[0]), cy: Y(p[1]), r: sr.r || 4.5, class: sr.dotCls || "g-pt" }));
  }
  const legend = series.filter((sr) => sr.label);
  return h("figure", { class: "lab-figure" }, svg,
    legend.length ? h("figcaption", { class: "lab-legend" }, legend.map((sr) => h("span", {}, h("i", { class: sr.key || "" }), sr.label))) : null,
    caption ? h("figcaption", {}, caption) : null);
}

// Start a page: state from the link or the example, an empty results area, the inputs, and a
// first run when the page was opened from a shared link.
export function start(example, draw, run) {
  const state = loadState() || structuredClone(example);
  const results = makeResults();
  return { state, results, boot: () => { draw(); if (location.hash.startsWith("#p=")) run(); } };
}

// A page of small calculators chosen from a list. MODES = { key: { label, hint, fields, table?, example, solve } }.
// fields: [{ k, label, size, type: "num" | "text" | "select", options }] (an array of arrays starts a new row).
// table: { k, head, min, add, blank } for a list of rows. solve(v) returns { errors } or an array of blocks.
export function calcPage(MODES, { legend = "Kind of problem", runLabel = "Work it out" } = {}) {
  const keys = Object.keys(MODES);
  const fresh = (k) => structuredClone(MODES[k].example);
  const EXAMPLE = { mode: keys[0], v: { [keys[0]]: fresh(keys[0]) } };
  let inputs = {}, table = null, msgBox;
  const { state, results, boot } = start(EXAMPLE, draw, run);
  if (!MODES[state.mode]) state.mode = keys[0];
  state.v ??= {};

  function draw() {
    const m = MODES[state.mode];
    const v = (state.v[state.mode] ??= fresh(state.mode));
    inputs = {}; table = null;
    const kids = [h("div", { class: "lab-controls" }, field(legend, select(keys.map((k) => [k, MODES[k].label]), state.mode, legend, (k) => { read(); state.mode = k; draw(); results.replaceChildren(); }), "w-l"))];
    const fl = typeof m.fields === "function" ? m.fields(v) : m.fields;
    const rowsOf = Array.isArray(fl?.[0]) ? fl : fl?.length ? [fl] : [];
    for (const row of rowsOf) {
      kids.push(h("div", { class: "lab-controls" }, row.map((f) => {
        const el = f.type === "select" ? select(f.options, v[f.k], f.label, (val) => { v[f.k] = val; if (f.redraw) { read(); draw(); results.replaceChildren(); } })
          : numInput(v[f.k], f.label, f.type === "text" ? { inputmode: "text" } : {});
        inputs[f.k] = el;
        return field(f.label, el, f.size || "w-m");
      })));
    }
    if (m.table) {
      const T = m.table;
      table = inputTable({ head: T.head, rows: v[T.k], cellAttrs: T.cellAttrs, onRemove: (i) => { read(); if (v[T.k].length > (T.min || 1)) v[T.k].splice(i, 1); draw(); } });
      kids.push(scroller(table, T.label || "Rows"), h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); v[T.k].push(T.head.map(() => "")); draw(); } }, T.add || "Add a row")));
    }
    ({ msgBox } = panel({
      title: m.title || "Your problem",
      hint: typeof m.hint === "function" ? m.hint(v) : m.hint,
      kids,
      onExample: () => { state.v[state.mode] = fresh(state.mode); draw(); results.replaceChildren(); },
      onClear: () => {
        read();
        for (const k of Object.keys(inputs)) if (inputs[k].tagName !== "SELECT") v[k] = "";
        if (m.table) v[m.table.k] = v[m.table.k].map((r) => r.map(() => ""));
        draw(); results.replaceChildren();
      },
      onRun: run, runLabel: m.runLabel || runLabel,
    }));
  }
  function read() {
    const v = state.v[state.mode];
    for (const [k, el] of Object.entries(inputs)) v[k] = el.value;
    if (table) v[MODES[state.mode].table.k] = tableValues(table);
  }
  function run() {
    read();
    const out = MODES[state.mode].solve(state.v[state.mode]);
    if (out.errors) { messages(msgBox, out.errors); results.replaceChildren(); return; }
    messages(msgBox);
    // Only the mode on screen goes into a shared link.
    saveState({ mode: state.mode, v: { [state.mode]: state.v[state.mode] } });
    show(results, out);
  }
  return { state, boot };
}

// Checks shared by the calculators: read named values and complain about the missing or bad ones.
export function need(v, spec) {
  const out = {}, errors = [];
  for (const [k, label, rule] of spec) {
    const raw = String(v[k] ?? "").trim(), x = parseNum(raw);
    if (raw === "" && rule?.includes("optional")) { out[k] = null; continue; }
    if (raw === "") { errors.push(`Enter ${label}.`); continue; }
    if (!Number.isFinite(x)) { errors.push(`${label[0].toUpperCase()}${label.slice(1)}: “${raw}” is not a number.`); continue; }
    if (rule?.includes("positive") && !(x > 0)) errors.push(`${label[0].toUpperCase()}${label.slice(1)} must be more than zero.`);
    else if (rule?.includes("nonneg") && x < 0) errors.push(`${label[0].toUpperCase()}${label.slice(1)} cannot be negative.`);
    else if (rule?.includes("whole") && !Number.isInteger(x)) errors.push(`${label[0].toUpperCase()}${label.slice(1)} must be a whole number.`);
    out[k] = x;
  }
  return { x: out, errors };
}
