// Draws the line-art illustrations behind page titles: one per page or section.
// Every shape gets pathLength="1" and an order index (--i), so CSS can draw the lines in one by one.
// Shapes marked "a" are the yellow accent. Run: node scripts/motifs.cjs
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "src", "_includes", "motifs");
fs.mkdirSync(out, { recursive: true });

const P = (d, a) => ({ tag: "path", attrs: { d }, a });
const C = (cx, cy, r, a) => ({ tag: "circle", attrs: { cx, cy, r }, a });
const R = (x, y, width, height, rx, a) => ({ tag: "rect", attrs: { x, y, width, height, rx }, a });
const heart = (cx, top, s, a) => P(
  `M${cx} ${top + 10 * s} C${cx - 8 * s} ${top - 2 * s} ${cx - 24 * s} ${top + 2 * s} ${cx - 22 * s} ${top + 14 * s} ` +
  `C${cx - 20 * s} ${top + 24 * s} ${cx - 8 * s} ${top + 28 * s} ${cx} ${top + 38 * s} ` +
  `C${cx + 8 * s} ${top + 28 * s} ${cx + 20 * s} ${top + 24 * s} ${cx + 22 * s} ${top + 14 * s} ` +
  `C${cx + 24 * s} ${top + 2 * s} ${cx + 8 * s} ${top - 2 * s} ${cx} ${top + 10 * s} Z`, a);
const leaf = (x, y, deg, s = 1) => {
  const r = (deg * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  const pt = (px, py) => `${(x + (px * cos - py * sin) * s).toFixed(1)} ${(y + (px * sin + py * cos) * s).toFixed(1)}`;
  return P(`M${pt(0, 0)} C${pt(7, -9)} ${pt(7, -20)} ${pt(0, -28)} C${pt(-7, -20)} ${pt(-7, -9)} ${pt(0, 0)} Z M${pt(0, -3)} L${pt(0, -22)}`);
};
const lines = (x1, x2s, y0, step) => x2s.map((x2, i) => P(`M${x1} ${y0 + i * step} H${x2}`));

const motifs = {
  // Articles: an open book with a ribbon bookmark
  book: [
    P("M120 70 C95 58 62 56 34 62 V184 C62 178 95 180 120 192 Z"),
    P("M120 70 C145 58 178 56 206 62 V184 C178 178 145 180 120 192 Z"),
    P("M120 70 V192"),
    ...[0, 1, 2, 3, 4].map((i) => P(`M50 ${90 + i * 18} C70 ${86 + i * 18} 90 ${87 + i * 18} 106 ${93 + i * 18}`)),
    ...[0, 1, 2, 3, 4].map((i) => P(`M134 ${93 + i * 18} C150 ${87 + i * 18} 170 ${86 + i * 18} 190 ${90 + i * 18}`)),
    P("M160 60 V104 L168 96 L176 104 V60", true),
  ],
  // Resources: a spiral notepad with a rising chart
  notes: [
    R(56, 44, 132, 162, 8),
    ...[78, 100, 122, 144, 166].map((x) => C(x, 44, 6)),
    P("M78 178 V96 M78 178 H170"),
    R(92, 148, 14, 30, 2), R(116, 132, 14, 46, 2), R(140, 118, 14, 60, 2),
    P("M86 140 C108 132 132 112 166 92", true),
    P("M154 90 L166 92 L162 104", true),
  ],
  // Blog: a speech bubble
  bubble: [
    P("M52 58 H170 A20 20 0 0 1 190 78 V138 A20 20 0 0 1 170 158 H102 L74 184 V158 H52 A20 20 0 0 1 32 138 V78 A20 20 0 0 1 52 58 Z"),
    ...lines(56, [168, 152], 92, 22),
    P("M56 136 H110"),
    C(130, 136, 4, true), C(146, 136, 4, true), C(162, 136, 4, true),
  ],
  // Community: a planted tree with a heart at its crown
  tree: [
    P("M58 214 H182"),
    P("M120 212 V122"),
    P("M120 212 C110 213 100 214 90 216 M120 212 C130 213 140 214 150 216"),
    P("M120 176 C104 166 92 152 84 132"),
    P("M120 158 C136 148 150 134 158 114"),
    P("M120 196 C134 190 146 182 154 170"),
    P("M120 142 C110 134 104 122 100 110"),
    P("M120 186 C108 182 98 176 90 166"),
    leaf(84, 132, -20, 1.2), leaf(84, 132, -70, 1.2), leaf(158, 114, 20, 1.2), leaf(158, 114, 70, 1.2),
    leaf(100, 110, -10, 1.05), leaf(100, 110, -55, 1),
    leaf(154, 170, 55, 1), leaf(154, 170, 105, .9), leaf(90, 166, -60, 1), leaf(90, 166, -105, .9),
    leaf(104, 160, -40, .85), leaf(140, 140, 35, .9), leaf(138, 192, 80, .75),
    heart(120, 80, 1, true),
  ],
  // Contact: an envelope sealed with a heart, on its way
  envelope: [
    R(46, 70, 160, 110, 6),
    P("M46 76 L126 134 L206 76"),
    P("M46 174 L104 122 M206 174 L148 122"),
    P("M10 104 H30 M2 124 H28 M14 144 H32"),
    C(126, 134, 17, true),
    heart(126, 124, .5, true),
  ],
  // Thank-you page: the envelope again, with a tick
  sent: [
    R(46, 70, 160, 110, 6),
    P("M46 76 L126 134 L206 76"),
    P("M46 174 L104 122 M206 174 L148 122"),
    P("M10 104 H30 M2 124 H28 M14 144 H32"),
    C(126, 134, 17, true),
    P("M118 134 L124 140 L136 127", true),
  ],
  // In the news: a folded newspaper
  paper: [
    P("M58 44 V34 H208 V190 H196"),
    R(44, 44, 152, 160, 4),
    P("M60 62 H180 M60 74 H180"),
    R(60, 88, 58, 42, 2, true),
    P("M64 124 L80 108 L92 118 L102 106 L114 124", true),
    C(104, 98, 5, true),
    ...lines(130, [180, 180, 172, 180], 92, 12),
    ...lines(60, [112, 112, 106, 112], 146, 13),
    ...lines(126, [180, 180, 174, 180], 146, 13),
  ],
  // CV: a document with a ribbon seal
  cv: [
    P("M60 34 H160 L188 62 V206 H60 Z"),
    P("M160 34 V62 H188"),
    P("M80 70 H140"),
    ...lines(80, [168, 168, 148], 92, 16),
    ...lines(80, [168, 136], 150, 16),
    C(156, 184, 18, true),
    C(156, 184, 10, true),
    P("M146 199 L140 224 L149 219 L153 228 L157 203 M166 199 L172 224 L163 219 L159 228", true),
  ],
  // 404: a compass
  compass: [
    C(120, 120, 82),
    C(120, 120, 70),
    P("M120 38 V52 M202 120 H188 M120 202 V188 M38 120 H52"),
    P("M120 70 L133 120 L120 170 L107 120 Z"),
    P("M120 70 L133 120 H107 Z", true),
    C(120, 120, 4),
  ],
};

for (const [name, shapes] of Object.entries(motifs)) {
  const body = shapes.map((s, i) => {
    const attrs = Object.entries(s.attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
    return `<${s.tag} ${attrs}${s.a ? ' class="a"' : ""} pathLength="1" style="--i:${i}"/>`;
  }).join("");
  const svg = `<svg class="motif" viewBox="0 0 240 240" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>\n`;
  fs.writeFileSync(path.join(out, `${name}.svg`), svg);
}
console.log("wrote", Object.keys(motifs).join(", "));
