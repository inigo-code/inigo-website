// Percentages, profit and loss, discounts, ratios and proportion.
import { h, block, formula, answer, fmt, calcPage, need, numberList } from "./kit.js";
import * as A from "./lib/arith.js";

const m2 = (x) => fmt(x, 2);            // money
const sgn = (x) => (x < 0 ? `− ${fmt(-x)}` : `+ ${fmt(x)}`);

const list = (text, label) => {
  const { values, bad } = numberList(text);
  return { values, errors: bad.length ? [`${label}: ${bad.map((b) => `“${b}”`).join(", ")} ${bad.length > 1 ? "are not numbers" : "is not a number"}.`] : [] };
};

const MODES = {
  of: {
    label: "x% of a number",
    hint: "For example, 15% of 2,400.",
    fields: [{ k: "p", label: "Percentage (%)", size: "w-s" }, { k: "y", label: "Of the number" }],
    example: { p: "15", y: "2400" },
    solve(v) {
      const { x, errors } = need(v, [["p", "the percentage"], ["y", "the number"]]);
      if (errors.length) return { errors };
      const r = A.percentOf(x.p, x.y);
      return [answer(`${fmt(x.p)}% of ${fmt(x.y)}`, fmt(r)), block("Working", formula(`${fmt(x.p)}% of ${fmt(x.y)} = ${fmt(x.p)} / 100 × ${fmt(x.y)} = ${fmt(r)}`))];
    },
  },
  what: {
    label: "What percentage one number is of another",
    hint: "For example, 45 marks out of 60 is what percentage?",
    fields: [{ k: "a", label: "The part" }, { k: "b", label: "Of the whole" }],
    example: { a: "45", b: "60" },
    solve(v) {
      const { x, errors } = need(v, [["a", "the part"], ["b", "the whole"]]);
      if (!errors.length && x.b === 0) errors.push("The whole cannot be zero.");
      if (errors.length) return { errors };
      const r = A.whatPercent(x.a, x.b);
      return [answer(`${fmt(x.a)} as a percentage of ${fmt(x.b)}`, `${fmt(r)}%`), block("Working", formula(`${fmt(x.a)} / ${fmt(x.b)} × 100 = ${fmt(r)}%`))];
    },
  },
  change: {
    label: "Percentage increase or decrease",
    hint: "The change is worked out on the old value.",
    fields: [{ k: "a", label: "Old value", type: "text" }, { k: "b", label: "New value", type: "text" }],
    example: { a: "1250", b: "1400" },
    solve(v) {
      const { x, errors } = need(v, [["a", "the old value"], ["b", "the new value"]]);
      if (!errors.length && x.a === 0) errors.push("The old value cannot be zero: a change from zero has no percentage.");
      if (errors.length) return { errors };
      const r = A.change(x.a, x.b), up = r.diff > 0, word = r.diff === 0 ? "No change" : up ? "Increase" : "Decrease";
      return [answer(word, r.diff === 0 ? "0%" : `${fmt(Math.abs(r.pct))}%`, h("p", {}, r.diff === 0 ? "The two values are equal." : `${up ? "Up" : "Down"} by ${fmt(Math.abs(r.diff))}, from ${fmt(x.a)} to ${fmt(x.b)}.`)),
        block("Working", formula(`Change = ${fmt(x.b)} − ${fmt(x.a)} = ${fmt(r.diff)}`, `Percentage change = change / old value × 100 = ${fmt(r.diff)} / ${fmt(x.a)} × 100 = ${fmt(r.pct)}%`))];
    },
  },
  succ: {
    label: "Successive percentage changes",
    hint: "Enter each change in turn, separated by commas. Use a minus sign for a decrease: “10, −5” means a rise of 10% and then a fall of 5%.",
    fields: [{ k: "list", label: "Changes (%)", type: "text", size: "w-l" }],
    example: { list: "20, -10" },
    solve(v) {
      const { values: p, errors } = list(v.list, "Changes");
      if (!errors.length && p.length < 2) errors.push("Enter at least two changes, separated by commas.");
      if (!errors.length && p.some((q) => q <= -100)) errors.push("A decrease must be less than 100%.");
      if (errors.length) return { errors };
      const r = A.successive(p);
      const lines = [];
      if (p.length === 2) lines.push(`Net change = a + b + ab / 100 = ${fmt(p[0])} ${sgn(p[1])} + (${fmt(p[0])} × ${fmt(p[1])}) / 100 = ${fmt(r.net)}%`);
      let val = 100;
      const steps = p.map((q) => { const nv = (val * (100 + q)) / 100, t = `${fmt(val)} → ${fmt(val)} × ${fmt(100 + q)} / 100 = ${fmt(nv)}`; val = nv; return t; });
      return [answer("Net change", `${r.net > 0 ? "+" : r.net < 0 ? "−" : ""}${fmt(Math.abs(r.net))}%`, h("p", {}, r.net === 0 ? "The changes cancel out." : `The same as one ${r.net > 0 ? "increase" : "decrease"} of ${fmt(Math.abs(r.net))}%.`)),
        block("Working", formula(...lines, "Starting from 100:", ...steps, `Net change = ${fmt(val)} − 100 = ${fmt(r.net)}%`))];
    },
  },
  pl: {
    label: "Profit or loss from cost and selling price",
    hint: "Profit and loss percentages are on the cost price.",
    fields: [{ k: "cp", label: "Cost price" }, { k: "sp", label: "Selling price" }],
    example: { cp: "800", sp: "920" },
    solve(v) {
      const { x, errors } = need(v, [["cp", "the cost price", "positive"], ["sp", "the selling price", "nonneg"]]);
      if (errors.length) return { errors };
      const r = A.profitLoss(x.cp, x.sp);
      if (r.kind === "none") return [answer("No profit, no loss", "0%", h("p", {}, "The selling price equals the cost price."))];
      const P = r.kind === "profit" ? "Profit" : "Loss";
      return [answer(P, `${m2(r.amount)}, or ${fmt(r.pct)}%`),
        block("Working", formula(`${P} = ${r.kind === "profit" ? `SP − CP = ${m2(x.sp)} − ${m2(x.cp)}` : `CP − SP = ${m2(x.cp)} − ${m2(x.sp)}`} = ${m2(r.amount)}`, `${P} % = ${P.toLowerCase()} / CP × 100 = ${m2(r.amount)} / ${m2(x.cp)} × 100 = ${fmt(r.pct)}%`))];
    },
  },
  sp: {
    label: "Selling price for a profit or loss %",
    hint: "Enter the profit %; use a minus sign for a loss (−10 for a 10% loss).",
    fields: [{ k: "cp", label: "Cost price" }, { k: "p", label: "Profit % (− for loss)", size: "w-m", type: "text" }],
    example: { cp: "640", p: "25" },
    solve(v) {
      const { x, errors } = need(v, [["cp", "the cost price", "positive"], ["p", "the profit or loss %"]]);
      if (!errors.length && x.p <= -100) errors.push("A loss must be less than 100%.");
      if (errors.length) return { errors };
      const r = A.spFromProfit(x.cp, x.p);
      return [answer("Selling price", m2(r)), block("Working", formula(`SP = CP × (100 ${sgn(x.p)}) / 100 = ${m2(x.cp)} × ${fmt(100 + x.p)} / 100 = ${m2(r)}`))];
    },
  },
  cp: {
    label: "Cost price from selling price and profit %",
    hint: "Enter the profit %; use a minus sign for a loss (−10 for a 10% loss).",
    fields: [{ k: "sp", label: "Selling price" }, { k: "p", label: "Profit % (− for loss)", size: "w-m", type: "text" }],
    example: { sp: "1150", p: "15" },
    solve(v) {
      const { x, errors } = need(v, [["sp", "the selling price", "positive"], ["p", "the profit or loss %"]]);
      if (!errors.length && x.p <= -100) errors.push("A loss must be less than 100%.");
      if (errors.length) return { errors };
      const r = A.cpFromSp(x.sp, x.p);
      return [answer("Cost price", m2(r)), block("Working", formula(`CP = SP × 100 / (100 ${sgn(x.p)}) = ${m2(x.sp)} × 100 / ${fmt(100 + x.p)} = ${m2(r)}`))];
    },
  },
  disc: {
    label: "Discounts on the marked price",
    hint: "Enter one discount, or several successive discounts separated by commas (“20, 10”).",
    fields: [{ k: "mp", label: "Marked price" }, { k: "list", label: "Discounts (%)", type: "text" }],
    example: { mp: "2500", list: "20, 10" },
    solve(v) {
      const { x, errors } = need(v, [["mp", "the marked price", "positive"]]);
      const { values: d, errors: e2 } = list(v.list, "Discounts");
      errors.push(...e2);
      if (!errors.length && !d.length) errors.push("Enter at least one discount.");
      if (!errors.length && d.some((q) => q < 0 || q >= 100)) errors.push("Each discount must be from 0 up to (not including) 100%.");
      if (errors.length) return { errors };
      let price = x.mp;
      const steps = d.map((q) => { const np = A.afterDiscount(price, q), t = `${fmt(q)}% off ${m2(price)}: ${m2(price)} × ${fmt(100 - q)} / 100 = ${m2(np)}`; price = np; return t; });
      const eqv = A.equivalentDiscount(d);
      return [answer("Selling price", m2(price), h("p", {}, `Total discount ${m2(x.mp - price)}${d.length > 1 ? `, the same as one discount of ${fmt(eqv)}%, not ${fmt(d.reduce((s, q) => s + q, 0))}%` : ""}.`)),
        block("Working", formula(...steps, ...(d.length > 1 ? [`Single equivalent discount = 100 − 100 × ${d.map((q) => `(1 − ${fmt(q)}/100)`).join(" × ")} = ${fmt(eqv)}%`] : [])))];
    },
  },
  marked: {
    label: "Marked price for a profit after discount",
    hint: "How high to mark an article so that, after the discount, the shop still makes the profit it wants on cost.",
    fields: [{ k: "cp", label: "Cost price" }, { k: "p", label: "Profit wanted (%)", size: "w-s", type: "text" }, { k: "d", label: "Discount (%)", size: "w-s" }],
    example: { cp: "720", p: "25", d: "10" },
    solve(v) {
      const { x, errors } = need(v, [["cp", "the cost price", "positive"], ["p", "the profit %"], ["d", "the discount %", "nonneg"]]);
      if (!errors.length && x.d >= 100) errors.push("The discount must be less than 100%.");
      if (!errors.length && x.p <= -100) errors.push("A loss must be less than 100%.");
      if (errors.length) return { errors };
      const mp = A.markedFor(x.cp, x.p, x.d), sp = A.spFromProfit(x.cp, x.p);
      return [answer("Marked price", m2(mp), h("p", {}, `${m2(mp - x.cp)} (${fmt(((mp - x.cp) / x.cp) * 100)}%) above the cost price.`)),
        block("Working", formula(`Selling price wanted = ${m2(x.cp)} × ${fmt(100 + x.p)} / 100 = ${m2(sp)}`,
          `After a ${fmt(x.d)}% discount the customer pays ${fmt(100 - x.d)}% of the marked price, so`,
          `Marked price = ${m2(sp)} × 100 / ${fmt(100 - x.d)} = ${m2(mp)}`,
          `Check: ${m2(mp)} × ${fmt(100 - x.d)} / 100 = ${m2(A.afterDiscount(mp, x.d))} ✓`))];
    },
  },
  ratio: {
    label: "Divide an amount in a ratio",
    hint: "Write the ratio with colons, such as 2 : 3 : 5. It is also shown in its lowest terms.",
    fields: [{ k: "amt", label: "Amount" }, { k: "r", label: "Ratio", type: "text" }],
    example: { amt: "15000", r: "2 : 3 : 5" },
    solve(v) {
      const { x, errors } = need(v, [["amt", "the amount"]]);
      const parts = String(v.r || "").split(/\s*[:,]\s*|\s+/).filter(Boolean), p = parts.map(Number);
      if (parts.length < 2) errors.push("Enter a ratio of at least two parts, such as 2 : 3.");
      else if (p.some((q) => !Number.isFinite(q) || q <= 0)) errors.push("Each part of the ratio must be a number more than zero.");
      if (errors.length) return { errors };
      const r = A.divide(x.amt, p), low = A.simplify(p);
      return [answer("Shares", r.shares.map((q) => m2(q)).join(" : ")),
        block("Working", formula(`Sum of the parts = ${p.map((q) => fmt(q)).join(" + ")} = ${fmt(r.total)}`, ...p.map((q, i) => `Share ${i + 1} = ${fmt(q)} / ${fmt(r.total)} × ${m2(x.amt)} = ${m2(r.shares[i])}`),
          `Check: ${r.shares.map((q) => m2(q)).join(" + ")} = ${m2(r.shares.reduce((s, q) => s + q, 0))}`),
          low.join(" : ") !== p.map(String).join(" : ") ? h("p", { class: "lab-hint" }, `In its lowest terms the ratio is ${low.join(" : ")}.`) : null)];
    },
  },
  prop: {
    label: "Fourth, third and mean proportional",
    hint: "Enter a and b, and c for the fourth proportional. The fourth proportional x makes a : b = c : x; the third proportional makes a : b = b : x; the mean proportional makes a : x = x : b.",
    fields: [{ k: "a", label: "a", size: "w-s" }, { k: "b", label: "b", size: "w-s" }, { k: "c", label: "c (optional)", size: "w-s" }],
    example: { a: "4", b: "9", c: "12" },
    solve(v) {
      const { x, errors } = need(v, [["a", "a", "positive"], ["b", "b", "positive"], ["c", "c", "optional positive"]]);
      if (errors.length) return { errors };
      const lines = [];
      if (x.c !== null) lines.push(`Fourth proportional: ${fmt(x.a)} : ${fmt(x.b)} = ${fmt(x.c)} : x, so x = ${fmt(x.b)} × ${fmt(x.c)} / ${fmt(x.a)} = ${fmt(A.fourthProportional(x.a, x.b, x.c))}`);
      lines.push(`Third proportional: ${fmt(x.a)} : ${fmt(x.b)} = ${fmt(x.b)} : x, so x = ${fmt(x.b)}² / ${fmt(x.a)} = ${fmt(A.thirdProportional(x.a, x.b))}`);
      lines.push(`Mean proportional: ${fmt(x.a)} : x = x : ${fmt(x.b)}, so x = √(${fmt(x.a)} × ${fmt(x.b)}) = ${fmt(A.meanProportional(x.a, x.b))}`);
      return [answer(x.c !== null ? "Fourth proportional" : "Mean proportional", fmt(x.c !== null ? A.fourthProportional(x.a, x.b, x.c) : A.meanProportional(x.a, x.b))), block("Working", formula(...lines))];
    },
  },
};

calcPage(MODES).boot();
