// LPP graphical method page.
import { h, s, $, messages, saveState, loadState, shareButton, scale, ticks, block, scroller, resultTable, where, fmt, parseNum } from "./ui.js";
import { validate, solve, clipped, redundant, standardForm } from "./lib/lpp.js";

const EXAMPLE = { sense: "max", c: ["500", "300"], cons: [["4", "2", "<=", "60"], ["2", "3", "<=", "54"]] };
const OPS = [["<=", "≤"], [">=", "≥"], ["=", "="]];
const root = $("#lab");
let state = loadState() || structuredClone(EXAMPLE);
let results, msgBox, form;

const termText = (a, b, vars = ["x", "y"]) => {
  const parts = [];
  [a, b].forEach((v, i) => {
    if (Math.abs(v) < 1e-12) return;
    const sign = v < 0 ? " − " : parts.length ? " + " : "";
    const mag = Math.abs(v) === 1 ? "" : fmt(Math.abs(v));
    parts.push(`${parts.length || v >= 0 ? sign : "−"}${mag}${vars[i]}`);
  });
  return parts.join("") || "0";
};
const opText = (op) => (op === "<=" ? "≤" : op === ">=" ? "≥" : "=");

function numInput(value, label, w = "5rem") {
  return h("input", { type: "text", inputmode: "decimal", value, "aria-label": label, style: `width:${w}` });
}

function drawInputs() {
  const cIn = [numInput(state.c[0], "Coefficient of x in Z"), numInput(state.c[1], "Coefficient of y in Z")];
  const rows = state.cons.map((k, i) => h("tr", {},
    h("th", { scope: "row" }, `(${i + 1})`),
    h("td", {}, numInput(k[0], `Constraint ${i + 1}, coefficient of x`)), h("td", { class: "left" }, "x +"),
    h("td", {}, numInput(k[1], `Constraint ${i + 1}, coefficient of y`)), h("td", { class: "left" }, "y"),
    h("td", {}, h("select", { "aria-label": `Constraint ${i + 1}, sign` }, OPS.map(([v, t]) => h("option", { value: v, selected: k[2] === v }, t)))),
    h("td", {}, numInput(k[3], `Constraint ${i + 1}, right-hand side`)),
    h("td", { class: "lab-remove" }, h("button", { type: "button", class: "lab-x", "aria-label": `Remove constraint ${i + 1}`, onclick: () => { read(); state.cons.splice(i, 1); drawInputs(); } }, "×"))));
  form = { cIn, tbody: h("tbody", {}, rows) };
  msgBox = h("div", { class: "lab-msgs", "aria-live": "polite" });
  const panel = h("section", { class: "lab-panel", "aria-labelledby": "inp-h" },
    h("h2", { id: "inp-h" }, "Your problem"),
    h("p", { class: "lab-hint", html: "Two decision variables, x and y, with x ≥ 0 and y ≥ 0 assumed. A minus sign and fractions such as 1/3 are fine. The example is the furniture problem from the <a href=\"/resources/lpp-graphical-method/\">LPP note</a>." }),
    h("fieldset", { class: "lab-seg" }, h("legend", {}, "Objective"),
      [["max", "Maximise"], ["min", "Minimise"]].map(([v, t]) => h("label", {}, h("input", { type: "radio", name: "sense", value: v, checked: state.sense === v }), h("span", {}, t)))),
    h("div", { class: "lab-actions lab-z" }, h("strong", {}, "Z ="), cIn[0], h("span", {}, "x +"), cIn[1], h("span", {}, "y")),
    h("p", { class: "lab-hint" }, h("strong", {}, "Subject to")),
    scroller(h("table", { class: "lab-table lab-input lab-cons" }, form.tbody), "Constraints"),
    h("div", { class: "lab-actions" },
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state.cons.push(["", "", "<=", ""]); drawInputs(); } }, "+ Add constraint"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state = structuredClone(EXAMPLE); drawInputs(); results.replaceChildren(); } }, "Load example"),
      h("button", { type: "button", class: "button ghost lab-small", onclick: () => { state = { sense: "max", c: ["", ""], cons: [["", "", "<=", ""]] }; drawInputs(); results.replaceChildren(); } }, "Clear"),
      h("span", { class: "spacer" }),
      h("button", { type: "button", class: "button", onclick: run }, "Solve graphically")),
    msgBox);
  const old = $(".lab-panel", root);
  if (old) old.replaceWith(panel); else root.prepend(panel);
}

function read() {
  state.sense = $('input[name="sense"]:checked', root).value;
  state.c = form.cIn.map((i) => i.value);
  state.cons = [...form.tbody.rows].map((tr) => { const ins = tr.querySelectorAll("input"); return [ins[0].value, ins[1].value, tr.querySelector("select").value, ins[2].value]; });
}

function run() {
  read();
  const p = { sense: state.sense, c: state.c.map(parseNum), cons: state.cons.map((k) => ({ a: [parseNum(k[0]), parseNum(k[1])], op: k[2], b: parseNum(k[3]) })) };
  const errors = validate(p);
  if (errors.length) { messages(msgBox, errors); results.replaceChildren(); return; }
  messages(msgBox);
  saveState(state);
  show(p, solve(p));
}

function show(p, r) {
  const blocks = [];
  const zText = `Z = ${termText(p.c[0], p.c[1])}`;
  let answer;
  if (r.status === "infeasible") answer = [h("p", { class: "label" }, "No feasible solution"), h("p", { class: "big" }, "Infeasible"), h("p", {}, "No point satisfies every constraint and x, y ≥ 0 at the same time. Check the constraints for a contradiction.")];
  else if (r.status === "unbounded") answer = [h("p", { class: "label" }, "No finite optimum"), h("p", { class: "big" }, "Unbounded solution"), h("p", {}, `The feasible region is open in a direction that keeps ${p.sense === "max" ? "increasing" : "decreasing"} Z, so Z has no ${p.sense === "max" ? "maximum" : "minimum"}. A constraint is probably missing.`)];
  else {
    const o = r.optimal;
    answer = [h("p", { class: "label" }, `${p.sense === "max" ? "Maximum" : "Minimum"} of ${zText}`),
      h("p", { class: "big" }, h("mark", {}, `Z = ${fmt(r.z)}`), ` at x = ${fmt(o[0].x)}, y = ${fmt(o[0].y)}`)];
    if (r.status === "multiple") answer.push(h("p", {}, o.length > 1
      ? `Multiple optimal solutions: Z is also ${fmt(r.z)} at ${o.slice(1).map((c) => `(${fmt(c.x)}, ${fmt(c.y)})`).join(", ")}, and at every point on the edge between them, because the objective line is parallel to a constraint.`
      : `Multiple optimal solutions: Z stays ${fmt(r.z)} along the whole unbounded edge leaving this corner.`));
  }
  blocks.push(block(null, h("div", { class: "lab-answer" }, answer)));
  blocks.push(block("Graph", graph(p, r), h("div", { class: "lab-legend" },
    h("span", {}, h("i", { class: "fill" }), "Feasible region"),
    h("span", {}, h("i", { class: "dot" }), "Corner point"),
    h("span", {}, h("i", { class: "dot crit" }), "Optimal corner"),
    r.z !== null ? h("span", {}, h("i", { class: "dash" }), `Objective line Z = ${fmt(r.z)}`) : null)));

  if (r.corners.length) {
    blocks.push(block("Corner points", scroller(resultTable(["Corner point", "x", "y", zText],
      r.corners.map((c) => [`(${fmt(c.x)}, ${fmt(c.y)})`, c.x, c.y, c.z]),
      { rowClass: (i) => (r.optimal.includes(r.corners[i]) ? "is-crit" : null) })),
      r.boundedRegion ? null : h("p", { class: "lab-hint" }, "The feasible region is unbounded (open on one side), so it has fewer corners; the graph shows it cut off at the edge of the drawing.")));
  }
  if (r.usage) {
    blocks.push(block("Constraints at the optimum", scroller(resultTable(["Constraint", "Left-hand side at the optimum", "Right-hand side", "Binding?", "Slack or surplus"],
      p.cons.map((k, i) => [`(${i + 1}) ${termText(k.a[0], k.a[1])} ${opText(k.op)} ${fmt(k.b)}`, r.usage[i].lhs, k.b, r.usage[i].binding ? "Yes" : "No", r.usage[i].binding ? 0 : Math.abs(r.usage[i].slack)]))),
      where(["Binding", "the constraint is used up exactly at the optimum: it limits Z"], ["Slack", "unused capacity of a ≤ constraint"], ["Surplus", "the amount by which a ≥ constraint is exceeded"])));
  }
  const red = redundant(p);
  if (red.some(Boolean)) blocks.push(block("Redundant constraints", h("p", { class: "lab-hint" }, `Constraint${red.filter(Boolean).length > 1 ? "s" : ""} ${red.map((x, i) => (x ? `(${i + 1})` : null)).filter(Boolean).join(", ")} ${red.filter(Boolean).length > 1 ? "do" : "does"} not change the feasible region: the other constraints already cut off everything ${red.filter(Boolean).length > 1 ? "they" : "it"} would.`)));

  const sf = standardForm(p);
  const extraTerms = (row) => sf.extras.map((e) => (row.extra === e ? ` ${e.sign > 0 ? "+" : "−"} ${e.name}` : "")).join("");
  blocks.push(block("Standard form", h("div", { class: "lab-formula" },
    h("p", {}, `${p.sense === "max" ? "Maximise" : "Minimise"} Z = ${termText(p.c[0], p.c[1])}${sf.extras.map((e) => ` + 0${e.name}`).join("")}`),
    h("p", {}, "subject to"),
    sf.rows.map((row) => h("p", {}, `${termText(row.a[0], row.a[1])}${extraTerms(row)} = ${fmt(row.b)}${row.flipped ? "   (multiplied by −1 first, to make the right-hand side positive)" : ""}`)),
    h("p", {}, `x, y${sf.extras.map((e) => `, ${e.name}`).join("")} ≥ 0`)),
    h("p", { class: "lab-hint" }, [
      sf.extras.some((e) => e.kind === "slack") ? "A slack variable is added to each ≤ constraint: it is the capacity left unused." : "",
      sf.extras.some((e) => e.kind === "surplus") ? "A surplus variable is subtracted from each ≥ constraint: it is the amount above the minimum." : "",
    ].filter(Boolean).join(" ")),
    where(["Z", "the objective function, the quantity to be made as large (or small) as possible"], ["x, y", "the decision variables: the two quantities you choose"],
      ...sf.extras.map((e) => [e.name, e.kind === "slack" ? "a slack variable" : "a surplus variable"]), ["≥ 0", "non-negativity: no quantity can be negative"])));
  blocks.push(h("div", { class: "lab-actions" }, shareButton(), h("button", { type: "button", class: "button ghost lab-small", onclick: () => print() }, "Print")));
  results.replaceChildren(...blocks);
  results.focus({ preventScroll: true });
  results.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function graph(p, r) {
  // Range: far enough to show every intercept and corner, with some room.
  const xs = [1], ys = [1];
  for (const k of p.cons) {
    if (k.a[0] && k.b / k.a[0] > 0) xs.push(k.b / k.a[0]);
    if (k.a[1] && k.b / k.a[1] > 0) ys.push(k.b / k.a[1]);
  }
  for (const c of r.corners) { xs.push(c.x); ys.push(c.y); }
  let X = Math.max(...xs) * 1.15, Y = Math.max(...ys) * 1.15;
  // Keep the two axes within a sensible ratio of each other so neither collapses.
  if (X / Y > 25) Y = X / 25; if (Y / X > 25) X = Y / 25;
  const W = 640, H = 460, m = { l: 56, r: 24, t: 20, b: 48 };
  const x = scale(0, X, m.l, W - m.r), y = scale(0, Y, H - m.b, m.t);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: 760, role: "img", "aria-label": `Graph of the constraints with the feasible region shaded${r.z !== null ? ` and the optimum at (${fmt(r.optimal[0].x)}, ${fmt(r.optimal[0].y)})` : ""}.` });
  const xt = ticks(0, X, 8), yt = ticks(0, Y, 7);
  for (const t of xt) svg.append(s("line", { x1: x(t), x2: x(t), y1: y(0), y2: y(Y), class: "g-grid" }), s("text", { x: x(t), y: y(0) + 18, "text-anchor": "middle", class: "g-small" }, fmt(t)));
  for (const t of yt) svg.append(s("line", { x1: x(0), x2: x(X), y1: y(t), y2: y(t), class: "g-grid" }), s("text", { x: x(0) - 8, y: y(t) + 4, "text-anchor": "end", class: "g-small" }, fmt(t)));
  if (r.status !== "infeasible") {
    const poly = clipped(p, X, Y);
    if (poly.length >= 3) svg.append(s("polygon", { points: poly.map(([a, b]) => `${x(a)},${y(b)}`).join(" "), class: "g-region" }));
    else if (poly.length === 2) svg.append(s("line", { x1: x(poly[0][0]), y1: y(poly[0][1]), x2: x(poly[1][0]), y2: y(poly[1][1]), class: "g-crit" }));
  }
  svg.append(s("line", { x1: x(0), x2: x(X), y1: y(0), y2: y(0), class: "g-axis" }), s("line", { x1: x(0), x2: x(0), y1: y(0), y2: y(Y), class: "g-axis" }),
    s("text", { x: x(X), y: y(0) + 36, "text-anchor": "end", class: "g-text g-bold" }, "x"), s("text", { x: x(0) - 40, y: y(Y) + 4, class: "g-text g-bold" }, "y"));
  // Each constraint line, clipped to the drawing.
  p.cons.forEach((k, i) => {
    const seg = clipLine(k.a[0], k.a[1], k.b, X, Y);
    if (!seg) return;
    svg.append(s("line", { x1: x(seg[0][0]), y1: y(seg[0][1]), x2: x(seg[1][0]), y2: y(seg[1][1]), class: "g-ink" }));
    const end = seg[0][1] >= seg[1][1] ? seg[0] : seg[1];
    svg.append(s("text", { x: x(end[0]) + 6, y: Math.max(m.t + 12, y(end[1]) + 14), class: "g-text g-bold g-halo" }, `(${i + 1})`));
  });
  if (r.z !== null) {
    const seg = clipLine(p.c[0], p.c[1], r.z, X, Y);
    if (seg) svg.append(s("line", { x1: x(seg[0][0]), y1: y(seg[0][1]), x2: x(seg[1][0]), y2: y(seg[1][1]), class: "g-line g-dash" }));
  }
  for (const c of r.corners) {
    const best = r.optimal.includes(c);
    svg.append(s("circle", { cx: x(c.x), cy: y(c.y), r: best ? 7 : 5, class: best ? "g-opt" : "g-pt" }),
      s("text", { x: x(c.x) + 9, y: y(c.y) - 9, class: `g-small g-halo${best ? " g-bold" : ""}` }, `(${fmt(c.x, 2)}, ${fmt(c.y, 2)})`));
  }
  return h("figure", { class: "lab-figure" }, svg);
}

// The part of the line ax + by = c inside [0, X] × [0, Y].
function clipLine(a, b, c, X, Y) {
  const pts = [];
  const add = (px, py) => { if (px >= -1e-9 && px <= X + 1e-9 && py >= -1e-9 && py <= Y + 1e-9 && !pts.some((q) => Math.abs(q[0] - px) < 1e-9 && Math.abs(q[1] - py) < 1e-9)) pts.push([px, py]); };
  if (Math.abs(b) > 1e-12) { add(0, c / b); add(X, (c - a * X) / b); }
  if (Math.abs(a) > 1e-12) { add(c / a, 0); add((c - b * Y) / a, Y); }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}

results = h("div", { class: "lab-results", tabindex: "-1", "aria-label": "Results" });
root.replaceChildren(results);
drawInputs();
if (location.hash.startsWith("#p=")) run();
