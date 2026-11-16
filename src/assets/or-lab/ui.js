// Shared page helpers for OR Lab: building elements, editable tables, messages, saving a problem
// in the page address so it can be shared, and small SVG helpers.

import { fmt, parseNum } from "./lib/num.js";

export { fmt, parseNum };

export function h(tag, attrs = {}, ...kids) {
  const el = tag === "svg" || attrs.svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false || k === "svg") continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

export const s = (tag, attrs = {}, ...kids) => h(tag, { ...attrs, svg: true }, ...kids);

export const $ = (sel, root = document) => root.querySelector(sel);

// A number typed in a cell; "M" (any case) means a prohibited cell when `allowM` is set.
export function readCell(input, allowM = false) {
  const t = input.value.trim();
  if (allowM && /^m$/i.test(t)) return Infinity;
  return parseNum(t);
}

export const showNum = (x) => (x === Infinity ? "M" : fmt(x));

export function messages(box, errors = [], warnings = []) {
  box.replaceChildren();
  if (errors.length) box.append(h("div", { class: "lab-msg is-error", role: "alert" }, h("strong", { text: errors.length > 1 ? "Please fix these first:" : "Please fix this first:" }), h("ul", {}, errors.map((e) => h("li", { text: e })))));
  for (const w of warnings) box.append(h("div", { class: "lab-msg is-warn", role: "status" }, w));
}

// A table whose cells are inputs. `rows` are arrays of cell values; `head` the column headings.
export function inputTable({ head, rows, rowLabel, onRemove, cellAttrs = () => ({}) }) {
  const table = h("table", { class: "lab-table lab-input" },
    h("thead", {}, h("tr", {}, rowLabel ? h("th", { scope: "col" }, rowLabel.title || "") : null, head.map((t) => h("th", { scope: "col", html: t })), onRemove ? h("th", {}, h("span", { class: "sr-only", text: "Remove" })) : null)),
    h("tbody", {}, rows.map((r, i) => h("tr", {},
      rowLabel ? h("th", { scope: "row", text: rowLabel.name(i) }) : null,
      r.map((v, j) => h("td", {}, h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", value: v ?? "", "aria-label": `${rowLabel ? rowLabel.name(i) : "Row " + (i + 1)}, ${head[j].replace(/<[^>]+>/g, "")}`, ...cellAttrs(i, j) }))),
      onRemove ? h("td", { class: "lab-remove" }, h("button", { type: "button", class: "lab-x", "aria-label": `Remove ${rowLabel ? rowLabel.name(i) : "row " + (i + 1)}`, onclick: () => onRemove(i) }, "×")) : null))));
  return table;
}

// Read every input of a table built by inputTable, row by row, as raw strings.
export const tableValues = (table) => [...table.tBodies[0].rows].map((tr) => [...tr.querySelectorAll("input")].map((i) => i.value));

// Save and restore a problem in the address (after #), so a teacher can share a link to it.
export function saveState(obj) {
  try {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    history.replaceState(history.state, "", "#p=" + b64);
  } catch { /* the address is a convenience only */ }
}
export function loadState() {
  try {
    const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)$/);
    if (!m) return null;
    const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch { return null; }
}

// "Copy link to this problem" button.
export function shareButton() {
  const b = h("button", { type: "button", class: "button ghost lab-small" }, "Copy link to this problem");
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); b.textContent = "Link copied"; }
    catch { b.textContent = "Copy the address bar instead"; }
    setTimeout(() => (b.textContent = "Copy link to this problem"), 2500);
  });
  return b;
}

// Simple linear scale.
export const scale = (d0, d1, r0, r1) => (x) => r0 + ((x - d0) / (d1 - d0 || 1)) * (r1 - r0);

// "Nice" tick values between lo and hi.
export function ticks(lo, hi, count = 6) {
  const span = hi - lo || 1, step0 = span / count, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => span / k <= count) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export const pct = (p) => `${fmt(p * 100, 2)}%`;

// A titled block of results.
export const block = (title, ...kids) => h("section", { class: "lab-block" }, title ? h("h2", { class: "lab-h", text: title }) : null, ...kids);

// A collapsible list of worked steps.
export const stepsBox = (summary, ...kids) => h("details", { class: "lab-steps" }, h("summary", {}, summary), h("div", { class: "lab-steps-body" }, ...kids));

// Wraps a wide table so it scrolls sideways on a phone instead of stretching the page.
export const scroller = (el, label) => h("div", { class: "lab-scroll", tabindex: "0", role: "region", "aria-label": label || "Table" }, el);

// A read-only results table. cells may be strings, numbers or { text, class }.
export function resultTable(head, rows, { rowClass } = {}) {
  return h("table", { class: "lab-table" },
    h("thead", {}, h("tr", {}, head.map((t) => h("th", { scope: "col", html: t })))),
    h("tbody", {}, rows.map((r, i) => h("tr", { class: rowClass ? rowClass(i) : null }, r.map((c, j) => {
      const cell = c && typeof c === "object" && !c.nodeType ? c : { text: c };
      return h(j === 0 ? "th" : "td", { scope: j === 0 ? "row" : null, class: cell.class || null }, cell.node || (typeof cell.text === "number" ? fmt(cell.text) : String(cell.text ?? "")));
    })))));
}

export const kv = (pairs) => h("dl", { class: "lab-kv" }, pairs.map(([k, v]) => h("div", {}, h("dt", { html: k }), h("dd", {}, v))));

// "Where …": what each symbol in the formula above it stands for, as [symbol, meaning] pairs.
// Falsy entries are skipped, so a page can include a symbol only when it was used.
export const where = (...pairs) => h("div", { class: "lab-where" },
  h("p", { class: "lab-where-h" }, "Where"),
  h("dl", {}, pairs.filter(Boolean).map(([sym, meaning]) => h("div", {}, h("dt", {}, sym), h("dd", {}, meaning)))));
