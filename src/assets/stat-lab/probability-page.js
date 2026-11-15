// Permutations, combinations and simple probability, as exact whole numbers and fractions.
import { h, block, scroller, resultTable, formula, answer, fmt, parseNum, calcPage, need, F, fracText } from "./kit.js";
import * as C from "./lib/counting.js";

const big = (n) => BigInt(n).toLocaleString("en-IN");
const P = (fav, total, words) => {
  const p = new F(BigInt(fav), BigInt(total));
  return { p, line: `P(${words}) = favourable / total = ${big(fav)} / ${big(total)}${p.n !== BigInt(fav) ? ` = ${p}` : ""}` };
};
// 3.4694 × 10⁻¹⁸ for a probability too small to show in four decimals.
const sci = (x) => { const e = Math.floor(Math.log10(x)); return `${Number((x / 10 ** e).toFixed(4))} × 10${String(e).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`; };
const probAnswer = (words, p) => {
  const x = p.toNumber(), tiny = x > 0 && x < 0.00005;
  return answer(`P(${words})`, tiny ? `${p} ≈ ${sci(x)}` : fracText(p),
    h("p", {}, p.isZero() ? "It cannot happen." : p.eq(new F(1n)) ? "It is certain." : tiny ? "Less than 0.01% of the time: practically never." : `About ${fmt(x * 100, 2)}% of the time.`));
};

const EVENTS = [["eq", "Exactly"], ["ge", "At least"], ["le", "At most"]];
const evWord = { eq: "exactly", ge: "at least", le: "at most" };
const DICE_EVENTS = [["eq", "The total is"], ["ge", "The total is at least"], ["le", "The total is at most"], ["mult", "The total is a multiple of"], ["even", "The total is even"], ["odd", "The total is odd"]];
const tests = { eq: (k) => (s) => s === k, ge: (k) => (s) => s >= k, le: (k) => (s) => s <= k, mult: (k) => (s) => s % k === 0, even: () => (s) => s % 2 === 0, odd: () => (s) => s % 2 === 1 };

const MODES = {
  npr: {
    label: "Permutations and combinations (nPr, nCr)",
    hint: "nPr counts arrangements, where order matters; nCr counts selections, where it does not. n can be up to 200.",
    fields: [{ k: "n", label: "n", size: "w-s" }, { k: "r", label: "r", size: "w-s" }],
    example: { n: "8", r: "3" },
    solve(v) {
      const { x, errors } = need(v, [["n", "n", "nonneg whole"], ["r", "r", "nonneg whole"]]);
      if (!errors.length && x.r > x.n) errors.push("r cannot be more than n.");
      if (!errors.length && x.n > C.MAX_N) errors.push(`n can be at most ${C.MAX_N}.`);
      if (errors.length) return { errors };
      const { n, r } = x, p = C.nPr(n, r), c = C.nCr(n, r);
      return [answer("Arrangements and selections", `${n}P${r} = ${big(p)}`, h("p", { class: "big" }, `${n}C${r} = ${big(c)}`)),
        block("Permutations", formula(`${n}P${r} = n! / (n − r)! = ${n}! / ${n - r}!`, `= ${C.fallingText(n, r)} (${r} factor${r === 1 ? "" : "s"}) = ${big(p)}`)),
        block("Combinations", formula(`${n}C${r} = n! / (r! (n − r)!) = ${n}P${r} / ${r}!`, `= ${big(p)} / (${C.factText(r)}) = ${big(p)} / ${big(C.factorial(r))} = ${big(c)}`),
          h("p", { class: "lab-hint" }, `nCr = nC(n − r): choosing ${r} to take is the same as choosing ${n - r} to leave.`))];
    },
  },
  word: {
    label: "Arrangements of the letters of a word",
    hint: "Letters that repeat are divided out: n! / (p! q! …).",
    fields: [{ k: "w", label: "Word", type: "text", size: "w-l" }],
    example: { w: "ACCOUNTANT" },
    solve(v) {
      const r = C.wordArrangements(v.w);
      if (!r.n) return { errors: ["Enter a word."] };
      if (r.n > C.MAX_N) return { errors: [`Use a word of at most ${C.MAX_N} letters.`] };
      const rep = r.repeats.map(([c, m]) => `${c} ${m} times`).join(", ");
      return [answer(`Arrangements of ${r.letters.join("")}`, big(r.total)),
        block("Working", formula(`${r.n} letters${r.repeats.length ? `; repeated: ${rep}` : ", all different"}`,
          r.repeats.length ? `Arrangements = ${r.n}! / (${r.repeats.map(([, m]) => `${m}!`).join(" × ")}) = ${big(C.factorial(r.n))} / ${big(r.den)} = ${big(r.total)}` : `Arrangements = ${r.n}! = ${big(r.total)}`))];
    },
  },
  coins: {
    label: "Tossing coins",
    hint: "The chance of a given number of heads when several fair coins are tossed (or one coin is tossed several times).",
    fields: [{ k: "n", label: "Number of coins", size: "w-s" }, { k: "ev", label: "Heads", type: "select", options: EVENTS, size: "w-s" }, { k: "k", label: "How many", size: "w-s" }],
    example: { n: "4", ev: "ge", k: "3" },
    solve(v) {
      const { x, errors } = need(v, [["n", "the number of coins", "positive whole"], ["k", "the number of heads", "nonneg whole"]]);
      if (!errors.length && x.n > 60) errors.push("Use at most 60 coins.");
      if (!errors.length && x.k > x.n) errors.push("There cannot be more heads than coins.");
      if (errors.length) return { errors };
      const { n, k } = x, ks = Array.from({ length: n + 1 }, (_, j) => j).filter((j) => (v.ev === "eq" ? j === k : v.ev === "ge" ? j >= k : j <= k));
      const fav = ks.reduce((s, j) => s + C.nCr(n, j), 0n), total = 2n ** BigInt(n);
      const words = `${evWord[v.ev]} ${k} head${k === 1 ? "" : "s"}`, pr = P(fav, total, words);
      return [probAnswer(words, pr.p),
        block("Working", formula(`Total outcomes = 2^${n} = ${big(total)}`, `Ways to get j heads = ${n}Cj`, `Favourable = ${ks.map((j) => `${n}C${j}`).join(" + ")} = ${ks.map((j) => big(C.nCr(n, j))).join(" + ")} = ${big(fav)}`, pr.line))];
    },
  },
  dice: {
    label: "Throwing dice",
    hint: "Every face of each die is equally likely, so two dice have 36 outcomes and three have 216.",
    fields: (v) => [[{ k: "d", label: "Dice", type: "select", options: [["1", "One"], ["2", "Two"], ["3", "Three"]], size: "w-s" }, { k: "ev", label: "Event", type: "select", options: DICE_EVENTS, size: "w-l", redraw: true }, ...(v.ev === "even" || v.ev === "odd" ? [] : [{ k: "k", label: "Number", size: "w-s" }])]],
    example: { d: "2", ev: "eq", k: "7" },
    solve(v) {
      const d = Number(v.d) || 2, needK = !(v.ev === "even" || v.ev === "odd");
      const { x, errors } = needK ? need(v, [["k", "the number", "positive whole"]]) : { x: {}, errors: [] };
      if (errors.length) return { errors };
      const k = x.k, test = tests[v.ev](k), t = C.diceTotals(d), r = C.diceEvent(d, test);
      const words = `the total is ${{ eq: k, ge: `at least ${k}`, le: `at most ${k}`, mult: `a multiple of ${k}`, even: "even", odd: "odd" }[v.ev]}`;
      const totals = [...t.counts.entries()].sort((a, b) => a[0] - b[0]);
      const favT = totals.filter(([s]) => test(s));
      const pr = P(r.fav, r.total, words);
      return [probAnswer(words, pr.p),
        block("Working", formula(`Total outcomes = 6^${d} = ${r.total}`, favT.length ? `Favourable totals: ${favT.map(([s, c]) => `${s} (${c} way${c === 1 ? "" : "s"})`).join(", ")}, ${r.fav} in all` : "No total meets the condition, so there are 0 favourable outcomes.", pr.line)),
        block("Ways to get each total", scroller(resultTable(["Total", ...totals.map(([s]) => String(s))], [["Ways", ...totals.map(([, c]) => String(c))]]), "Ways to get each total"))];
    },
  },
  cards: {
    label: "Drawing cards from a pack of 52",
    hint: "Cards are drawn at once (without replacement) from a well-shuffled pack of 52.",
    fields: [[{ k: "g", label: "Kind of card", type: "select", options: C.CARD_GROUPS.map(([key, word, size]) => [key, `${word[0].toUpperCase()}${word.slice(1)} (${size} in the pack)`]), size: "w-l" }],
      [{ k: "take", label: "Cards drawn", size: "w-s" }, { k: "k", label: "How many of that kind", size: "w-m" }]],
    example: { g: "king", take: "2", k: "1" },
    solve(v) {
      const g = C.CARD_GROUPS.find((q) => q[0] === v.g) || C.CARD_GROUPS[0], size = g[2];
      const { x, errors } = need(v, [["take", "the number of cards drawn", "positive whole"], ["k", "how many of that kind", "nonneg whole"]]);
      if (!errors.length && x.take > 52) errors.push("At most 52 cards can be drawn.");
      if (!errors.length && x.k > x.take) errors.push("The number of that kind cannot be more than the cards drawn.");
      if (!errors.length && x.k > size) errors.push(`There are only ${size} of that kind in the pack.`);
      if (!errors.length && x.take - x.k > 52 - size) errors.push(`Only ${52 - size} cards are not of that kind, so at least ${x.take - (52 - size)} of the cards drawn must be.`);
      if (errors.length) return { errors };
      const { take, k } = x, r = C.cards(size, take, k);
      const kind = g[1].replace(/^an? /, "").replace(/ \(.*\)$/, "");
      const words = take === 1 ? g[1].replace(/ \(.*\)$/, "") : `exactly ${k} ${kind}${k === 1 ? "" : "s"} in ${take} cards`;
      const pr = P(r.fav, r.total, words);
      return [probAnswer(words, pr.p),
        block("Working", formula(`Total ways to draw ${take} card${take === 1 ? "" : "s"} = 52C${take} = ${big(r.total)}`,
          `Favourable = ${size}C${k} × ${52 - size}C${take - k} = ${big(C.nCr(size, k))} × ${big(C.nCr(52 - size, take - k))} = ${big(r.fav)}`, pr.line),
          h("p", { class: "lab-hint" }, `${size}C${k} chooses the ${kind}s; ${52 - size}C${take - k} chooses the other cards from the ${52 - size} that are not.`))];
    },
  },
  bag: {
    label: "Drawing balls from a bag",
    hint: "Enter each colour, how many balls of it are in the bag, and how many of it you want among the balls drawn at once. The number drawn is the total wanted.",
    table: { k: "rows", head: ["Colour", "In the bag", "Wanted"], cellAttrs: (i, j) => (j === 0 ? { inputmode: "text" } : {}), min: 2, add: "Add a colour", label: "Colours" },
    example: { rows: [["Red", "5", "2"], ["Blue", "4", "1"], ["White", "3", "0"]] },
    solve(v) {
      const rows = v.rows.filter((r) => r.some((c) => c.trim())), errors = [];
      const cols = rows.map((r, i) => {
        const name = r[0].trim() || `Colour ${i + 1}`, c = parseNum(r[1]), w = parseNum(r[2] || "0");
        if (!(Number.isInteger(c) && c >= 0)) errors.push(`${name}: the number in the bag must be a whole number.`);
        if (!(Number.isInteger(w) && w >= 0)) errors.push(`${name}: the number wanted must be a whole number.`);
        else if (w > c) errors.push(`${name}: you cannot want more than there are in the bag.`);
        return { name, c, w };
      });
      if (rows.length < 2) errors.push("Enter at least two colours.");
      if (!errors.length && cols.reduce((s, q) => s + q.c, 0) > C.MAX_N) errors.push(`Use at most ${C.MAX_N} balls in all.`);
      if (!errors.length && !cols.some((q) => q.w > 0)) errors.push("Want at least one ball.");
      if (errors.length) return { errors };
      const r = C.bag(cols.map((q) => q.c), cols.map((q) => q.w));
      const words = cols.filter((q) => q.w > 0).map((q) => `${q.w} ${q.name.toLowerCase()}`).join(", ");
      const pr = P(r.fav, r.total, words);
      return [probAnswer(words, pr.p),
        block("Working", formula(`${r.N} balls in all; ${r.take} drawn: total ways = ${r.N}C${r.take} = ${big(r.total)}`,
          `Favourable = ${r.parts.map((q) => `${q.c}C${q.w}`).join(" × ")} = ${r.parts.map((q) => big(q.ways)).join(" × ")} = ${big(r.fav)}`, pr.line))];
    },
  },
};

calcPage(MODES).boot();
