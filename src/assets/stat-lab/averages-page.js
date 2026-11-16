// Central tendency and dispersion for individual, discrete and continuous series.
import { h, messages, saveState, block, scroller, resultTable, panel, seg, field, show, start, formula, where, fmt, parseNum, numberList } from "./kit.js";
import { inputTable, tableValues, messages as msg } from "../or-lab/ui.js";
import * as S from "./lib/stats.js";

const EXAMPLE = {
  kind: "continuous",
  list: "12, 15, 11, 18, 20, 15, 14, 16, 15, 19",
  disc: [["0", "2"], ["1", "3"], ["2", "5"], ["3", "4"], ["4", "1"]],
  cont: [["0", "10", "5"], ["10", "20", "8"], ["20", "30", "12"], ["30", "40", "10"], ["40", "50", "5"]],
};
const KINDS = [["individual", "Individual values"], ["discrete", "Discrete series (x, f)"], ["continuous", "Classes with frequencies"]];
let table, listIn, msgBox;
const { state, results, boot } = start(EXAMPLE, draw, run);

function draw() {
  const k = state.kind;
  const kids = [seg("kind", "Your data are", KINDS, k, (v) => { read(); state.kind = v; draw(); results.replaceChildren(); })];
  if (k === "individual") {
    listIn = h("textarea", { rows: 4, "aria-label": "Values", spellcheck: "false" }, state.list);
    kids.push(h("div", { class: "lab-controls" }, field("Values, separated by commas or spaces", listIn, "w-l")));
  } else {
    const key = k === "discrete" ? "disc" : "cont";
    const head = k === "discrete" ? ["Value x", "Frequency f"] : ["From", "To", "Frequency"];
    table = inputTable({ head, rows: state[key], onRemove: (i) => { read(); if (state[key].length > 2) state[key].splice(i, 1); draw(); } });
    kids.push(scroller(table, "Data"),
      h("div", { class: "lab-actions" }, h("button", { type: "button", class: "button ghost lab-small", onclick: () => { read(); state[key].push(state[key][0].map(() => "")); draw(); } }, k === "discrete" ? "Add a value" : "Add a class")));
  }
  ({ msgBox } = panel({
    title: "Your data",
    hint: state.kind === "continuous" ? "Enter the classes in order, such as 0–10, 10–20 … Inclusive classes such as 10–19, 20–29 are fine: they are adjusted to 9.5–19.5, 19.5–29.5 for the formulas." : state.kind === "discrete" ? "Each value once, with how often it occurs." : "",
    kids,
    onExample: () => { Object.assign(state, structuredClone(EXAMPLE), { kind: state.kind }); draw(); results.replaceChildren(); },
    onClear: () => { read(); if (state.kind === "individual") state.list = ""; else { const key = state.kind === "discrete" ? "disc" : "cont"; state[key] = state[key].map((r) => r.map(() => "")); } draw(); results.replaceChildren(); },
    onRun: run,
  }));
}

function read() {
  if (state.kind === "individual") state.list = listIn.value;
  else state[state.kind === "discrete" ? "disc" : "cont"] = tableValues(table);
}

const f4 = (x) => (x === null || x === undefined ? "–" : fmt(x));

function run() {
  read();
  let r, errors = [], warnings = [];
  if (state.kind === "individual") {
    const { values, bad } = numberList(state.list);
    if (bad.length) errors.push(`These are not numbers: ${bad.slice(0, 5).join(", ")}.`);
    errors.push(...S.validateIndividual(values));
    if (!errors.length) r = S.individual(values);
  } else if (state.kind === "discrete") {
    const rows = state.disc.filter((x) => x.some((v) => v.trim())).map(([x, f]) => ({ x: parseNum(x), f: parseNum(f) }));
    errors.push(...S.validateDiscrete(rows));
    if (!errors.length) r = S.discrete(rows);
  } else {
    const rows = state.cont.filter((x) => x.some((v) => v.trim())).map(([lo, hi, f]) => ({ lo: parseNum(lo), hi: parseNum(hi), f: parseNum(f) }));
    const v = S.validateContinuous(rows);
    errors.push(...v.errors);
    if (!errors.length) r = S.continuous(rows);
  }
  if (errors.length) { msg(msgBox, errors); results.replaceChildren(); return; }
  if (r.kind === "continuous" && !r.equalWidths) warnings.push("The classes are not all the same width. The mode formula assumes equal widths, so treat the mode as a rough value, and the mean is found directly from the mid-points.");
  messages(msgBox, [], warnings);
  saveState(state);
  show(results, build(r));
}

function build(r) {
  const N = r.n, X = r.kind === "individual" ? "x" : r.kind === "discrete" ? "x" : "m";
  const nName = r.kind === "individual" ? "n" : "N";
  const blocks = [];
  const stat = (k, v) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
  blocks.push(block(null, h("dl", { class: "stat-grid" },
    stat("Mean", f4(r.mean)), stat("Median", f4(r.median)), stat(r.mode.value !== undefined ? "Mode" : "Mode (empirical)", f4(r.modeValue)),
    stat("Standard deviation", f4(r.sd)), stat("Coefficient of variation", r.cv === null ? "–" : `${fmt(r.cv, 2)}%`),
    stat("Quartile deviation", f4(r.qd)), stat("Mean deviation", f4(r.mdMean)), stat("Range", f4(r.range)))));

  if (r.kind === "continuous" && r.adjusted) blocks.push(block(null, h("p", { class: "lab-msg is-warn" }, `The classes are inclusive, so ${fmt(r.half)} is taken off each lower limit and added to each upper limit: ${r.rows.slice(0, 2).map((x) => `${fmt(x.origLo)}–${fmt(x.origHi)} becomes ${fmt(x.lo)}–${fmt(x.hi)}`).join(", ")}, and so on.`)));

  // Working table
  const rows = r.rows, mean = r.mean;
  let head, body;
  if (r.kind === "individual") {
    head = ["x", "x − x̄", "|x − x̄|", "(x − x̄)²"];
    body = rows.map((x) => [fmt(x.x), fmt(x.x - mean), fmt(Math.abs(x.x - mean)), fmt((x.x - mean) ** 2)]);
    body.push([{ text: `Σx = ${fmt(r.sumX)}`, class: "is-total" }, "", { text: `Σ|x − x̄| = ${fmt(r.mdMeanSum)}`, class: "is-total" }, { text: `Σ(x − x̄)² = ${fmt(r.sumSq)}`, class: "is-total" }]);
  } else if (r.kind === "discrete") {
    head = ["x", "f", "Cumulative f", "fx", "|x − x̄|", "f|x − x̄|", "f(x − x̄)²"];
    body = rows.map((x) => [fmt(x.x), fmt(x.f), fmt(x.cf), fmt(x.f * x.x), fmt(Math.abs(x.x - mean)), fmt(x.f * Math.abs(x.x - mean)), fmt(x.f * (x.x - mean) ** 2)]);
    body.push(["Total", `N = ${fmt(N)}`, "", `Σfx = ${fmt(r.sumFX)}`, "", `Σf|x − x̄| = ${fmt(r.mdMeanSum)}`, `Σf(x − x̄)² = ${fmt(r.sumSq)}`].map((t) => ({ text: t, class: "is-total" })));
  } else {
    const st = r.step;
    head = ["Class", "f", "Mid-point m", "Cumulative f", ...(st ? [`d = (m − ${fmt(st.A)}) / ${fmt(st.h)}`, "fd", "fd²"] : ["fm"]), "|m − x̄|", "f|m − x̄|"];
    body = rows.map((x, i) => [`${fmt(x.lo)}–${fmt(x.hi)}`, fmt(x.f), fmt(x.m), fmt(x.cf), ...(st ? [fmt(st.d[i]), fmt(x.f * st.d[i]), fmt(x.f * st.d[i] ** 2)] : [fmt(x.f * x.m)]), fmt(Math.abs(x.m - mean)), fmt(x.f * Math.abs(x.m - mean))]);
    body.push(["Total", `N = ${fmt(N)}`, "", "", ...(st ? ["", `Σfd = ${fmt(st.sumFd)}`, `Σfd² = ${fmt(st.sumFd2)}`] : [`Σfm = ${fmt(rows.reduce((s, x) => s + x.f * x.m, 0))}`]), "", `Σf|m − x̄| = ${fmt(r.mdMeanSum)}`].map((t) => ({ text: t, class: "is-total" })));
  }
  blocks.push(block("Working table", scroller(resultTable(head, body), "Working table"),
    r.kind === "individual" ? h("p", { class: "lab-hint" }, `In order: ${r.sorted.map((q) => fmt(q)).join(", ")} (n = ${N}).`) : null));

  // Symbols shared by several blocks
  const cont = r.kind === "continuous", ind = r.kind === "individual";
  const W = {
    mean: ["x̄", "the arithmetic mean"],
    x: [X, cont ? "the mid-point of a class, (lower limit + upper limit) / 2" : "each value in the data"],
    f: ["f", cont ? "the frequency of a class (how many items fall in it)" : "how many times a value occurs"],
    N: [nName, ind ? "the number of values" : "the total frequency, Σf"],
    sum: ["Σ", "“the sum of”: add the column up"],
    abs: ["| |", "the size of a difference, ignoring its sign"],
  };

  // Mean
  let meanKids;
  if (ind) meanKids = [formula("x̄ = Σx / n", `= ${fmt(r.sumX)} / ${N}`, `= ${fmt(mean)}`), where(W.mean, W.sum, W.x, W.N)];
  else if (r.kind === "discrete") meanKids = [formula("x̄ = Σfx / N", `= ${fmt(r.sumFX)} / ${fmt(N)}`, `= ${fmt(mean)}`), where(W.mean, W.x, W.f, W.N, W.sum)];
  else if (r.step) meanKids = [h("p", { class: "lab-hint" }, "Step-deviation method: measure each mid-point from an assumed mean, in steps of one class width, so the numbers stay small."),
    formula("x̄ = A + (Σfd / N) × h", `= ${fmt(r.step.A)} + (${fmt(r.step.sumFd)} / ${fmt(N)}) × ${fmt(r.step.h)}`, `= ${fmt(mean)}`),
    where(W.mean, ["A", `the assumed mean, ${fmt(r.step.A)} (the mid-point of a middle class)`], ["h", `the class width, ${fmt(r.step.h)}`], ["d", "the step deviation of a class, (m − A) / h"], W.x, W.f, W.N, W.sum)];
  else meanKids = [formula("x̄ = Σfm / N", `= ${fmt(rows.reduce((s, x) => s + x.f * x.m, 0))} / ${fmt(N)}`, `= ${fmt(mean)}`), where(W.mean, W.x, W.f, W.N, W.sum)];
  blocks.push(block("Arithmetic mean", ...meanKids));

  // Median and quartiles
  const Q = [["Q₁", "the first (lower) quartile: a quarter of the items lie below it"], ["Q₃", "the third (upper) quartile: three quarters of the items lie below it"]];
  if (ind) {
    blocks.push(block("Median and quartiles", h("p", { class: "lab-hint" }, "Arrange the values in order, find the position of the item, then read off that item."),
      formula(`Median = size of the (n + 1) / 2 th item = ${fmt(r.medPos)} th item`, `= ${r.med.text} = ${fmt(r.median)}`),
      formula(`Q₁ = size of the (n + 1) / 4 th item = ${fmt((N + 1) / 4)} th item`, `= ${r.q1Item.text} = ${fmt(r.q1)}`),
      formula(`Q₃ = size of the 3(n + 1) / 4 th item = ${fmt(3 * (N + 1) / 4)} th item`, `= ${r.q3Item.text} = ${fmt(r.q3)}`),
      where(["Median", "the middle value: half the items lie below it"], ...Q, W.N)));
  } else if (r.kind === "discrete") {
    blocks.push(block("Median and quartiles", h("p", { class: "lab-hint" }, "Find the item's position, then the first value whose cumulative frequency reaches it."),
      formula(`Median = size of the (N + 1) / 2 th item = ${fmt(r.medPos)} th item`, `→ ${fmt(r.median)} (cumulative f ${fmt(r.medRow.cf)})`),
      formula(`Q₁ = size of the (N + 1) / 4 th item = ${fmt(r.q1Pos)} th item`, `→ ${fmt(r.q1)}`),
      formula(`Q₃ = size of the 3(N + 1) / 4 th item = ${fmt(r.q3Pos)} th item`, `→ ${fmt(r.q3)}`),
      where(["Median", "the middle value: half the items lie below it"], ...Q, W.N, ["cf", "cumulative frequency: the running total of f"])));
  } else {
    const steps = (name, L, pos) => formula(`${name} class: the ${pos} th item lies in ${fmt(r.rows[L.i].lo)}–${fmt(r.rows[L.i].hi)}, the first class whose cumulative f reaches ${fmt(L.pos)}`,
      `${name} = L + (${pos} − cf) / f × h`, `= ${fmt(L.L)} + (${fmt(L.pos)} − ${fmt(L.cf)}) / ${fmt(L.f)} × ${fmt(L.h)}`, `= ${fmt(L.value)}`);
    blocks.push(block("Median and quartiles",
      steps("Median", r.med, "N/2"), steps("Q₁", r.q1Loc, "N/4"), steps("Q₃", r.q3Loc, "3N/4"),
      where(["Median", "the middle value: half the items lie below it"], ...Q, ["L", "the lower limit of that class"], ["cf", "the cumulative frequency of the class before it"], ["f", "the frequency of that class"], ["h", "the width of that class"], W.N)));
  }

  // Mode
  const Z = ["Mode", "the value that occurs most often"];
  const empirical = (full) => [formula("Empirical mode = 3 × Median − 2 × Mean", ...(full ? [`= 3 × ${fmt(r.median)} − 2 × ${fmt(mean)}`] : []), `= ${fmt(r.modeValue)}`), where(Z, ["Empirical", "estimated from the median and mean, for a moderately skewed series"])];
  let modeKids;
  if (r.mode.none) modeKids = [h("p", {}, "No value occurs more than once, so the series has no mode by inspection."), ...empirical(true)];
  else if (r.mode.multi) modeKids = [h("p", {}, `${cont ? "Several classes share" : `${r.mode.multi.map((q) => fmt(q)).join(", ")} all occur`} the highest frequency${cont ? "" : ` (${r.mode.count} times)`}, so the mode is ill-defined.`), ...empirical(true)];
  else if (r.mode.flat) modeKids = [h("p", {}, "The modal class's neighbours make the formula's denominator zero or negative, so it cannot be used."), ...empirical(false)];
  else if (cont) {
    const m = r.mode;
    modeKids = [formula(`Modal class: ${fmt(r.rows[m.i].lo)}–${fmt(r.rows[m.i].hi)}, the class with the highest frequency (${fmt(m.f1)})`, "Mode = L + (f₁ − f₀) / (2f₁ − f₀ − f₂) × h",
      `= ${fmt(m.L)} + (${fmt(m.f1)} − ${fmt(m.f0)}) / (2 × ${fmt(m.f1)} − ${fmt(m.f0)} − ${fmt(m.f2)}) × ${fmt(m.h)}`, `= ${fmt(m.value)}`),
    where(Z, ["L", `the lower limit of the modal class, ${fmt(m.L)}`], ["f₁", `the frequency of the modal class, ${fmt(m.f1)}`], ["f₀", `the frequency of the class before it, ${fmt(m.f0)}`], ["f₂", `the frequency of the class after it, ${fmt(m.f2)}`], ["h", `the class width, ${fmt(m.h)}`])];
  } else modeKids = [formula(`Mode = ${fmt(r.mode.value)}, the value that occurs most often (${fmt(r.mode.count)} times).`)];
  blocks.push(block("Mode", ...modeKids));

  // Dispersion
  const coef = h("p", { class: "lab-hint" }, "Each coefficient divides the measure by an average, so series in different units or of different sizes can be compared.");
  blocks.push(block("Range and quartile deviation",
    formula(`Range = L − S = ${fmt(r.hi)} − ${fmt(r.lo)} = ${fmt(r.range)}`, ...(r.rangeCoef !== null ? [`Coefficient of range = (L − S) / (L + S) = ${fmt(r.rangeCoef)}`] : [])),
    formula(`Q.D. = (Q₃ − Q₁) / 2 = (${fmt(r.q3)} − ${fmt(r.q1)}) / 2 = ${fmt(r.qd)}`, ...(r.qdCoef !== null ? [`Coefficient of Q.D. = (Q₃ − Q₁) / (Q₃ + Q₁) = ${fmt(r.qdCoef)}`] : [])),
    where(["L", cont ? "the largest value: the upper limit of the last class" : "the largest value"], ["S", cont ? "the smallest value: the lower limit of the first class" : "the smallest value"], ["Q.D.", "quartile deviation, half the spread of the middle 50% of items"], ...Q), coef));
  const fm = ind ? "" : "f", nn = ind ? "n" : "N";
  blocks.push(block("Mean deviation",
    formula(`About the mean: M.D. = Σ${fm}|${X} − x̄| / ${nn} = ${fmt(r.mdMeanSum)} / ${fmt(N)} = ${fmt(r.mdMean)}`, ...(r.mdMeanCoef !== null ? [`Coefficient = M.D. / x̄ = ${fmt(r.mdMeanCoef)}`] : [])),
    formula(`About the median: M.D. = Σ${fm}|${X} − Median| / ${nn} = ${fmt(r.mdMedianSum)} / ${fmt(N)} = ${fmt(r.mdMedian)}`, ...(r.mdMedianCoef !== null ? [`Coefficient = M.D. / Median = ${fmt(r.mdMedianCoef)}`] : [])),
    where(["M.D.", "mean deviation: the average distance of the items from the mean (or median)"], W.abs, W.x, ...(ind ? [] : [W.f]), W.N, W.sum)));
  const sdLines = r.step
    ? [`σ = h × √(Σfd² / N − (Σfd / N)²)`, `= ${fmt(r.step.h)} × √(${fmt(r.step.sumFd2)} / ${fmt(N)} − (${fmt(r.step.sumFd)} / ${fmt(N)})²)`, `= ${fmt(r.sd)}`]
    : [`σ = √(Σ${fm}(${X} − x̄)² / ${nn})`, `= √(${fmt(r.sumSq)} / ${fmt(N)}) = √${fmt(r.variance)}`, `= ${fmt(r.sd)}`];
  blocks.push(block("Standard deviation and coefficient of variation",
    formula(...sdLines), formula(`Variance = σ² = ${fmt(r.variance)}`, r.cv !== null ? `C.V. = σ / x̄ × 100 = ${fmt(r.sd)} / ${fmt(mean)} × 100 = ${fmt(r.cv, 2)}%` : "C.V. cannot be found because the mean is 0."),
    where(["σ", "sigma, the standard deviation: the typical distance of the items from the mean"], ["σ²", "the variance, the square of σ"], ["C.V.", "coefficient of variation: σ as a percentage of the mean"],
      ...(r.step ? [["d", "the step deviation, (m − A) / h, from the working table"], ["h", `the class width, ${fmt(r.step.h)}`]] : [W.x]), W.mean, W.N),
    h("p", { class: "lab-hint" }, "The series with the lower C.V. is the more consistent (more uniform).")));
  return blocks;
}

boot();
