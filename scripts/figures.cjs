// Draws the figures for the new study notes and articles, to scale, in the site's figure classes.
// Makes 8 of the files in src/_includes/figures (ai-loop, break-even, cpm, herzberg, hypothesis-errors, incoterms,
// scalar-chain, walton); the others were drawn by hand. Run with the output folder:
//   node scripts/figures.cjs src/_includes/figures
// It overwrites those 8 files, so a hand edit to one of them must be made here as well.
const fs = require('fs');
const OUT = process.argv[2];
if (!OUT) { console.error('Usage: node scripts/figures.cjs <output folder>'); process.exit(1); }
const f = (n) => +n.toFixed(1);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (name, label, body, h = 500) =>
  fs.writeFileSync(`${OUT}/${name}.svg`, `<svg class="fig" viewBox="0 0 800 ${h}" role="img" aria-label="${esc(label).replace(/"/g, '&quot;')}">\n  <rect class="f-bg" width="800" height="${h}"/>\n${body}\n</svg>\n`);
const marker = (id, fill = '#0d2a1c') => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${fill}"/></marker></defs>`;
const T = (x, y, s, cls = '', anchor = 'start', extra = '') => `<text x="${f(x)}" y="${f(y)}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${cls ? ` class="${cls}"` : ''}${extra}>${esc(s)}</text>`;

/* 1. Critical path: an activity-on-arrow network, events with earliest | latest times */
{
  const R = 42;
  const N = { 1: [95, 250, 0, 0], 2: [285, 115, 3, 3], 3: [440, 335, 5, 5], 4: [595, 150, 9, 9], 5: [725, 330, 12, 12] };
  const acts = [['A', 1, 2, 3, true, -1], ['B', 1, 3, 4, false, 1], ['C', 2, 3, 2, true, 1], ['D', 2, 4, 5, false, -1], ['E', 3, 4, 4, true, 1], ['F', 4, 5, 3, true, 1]];
  let under = '', lines = '', labels = '';
  for (const [a, s, e, d, crit, side] of acts) {
    const [x1, y1] = N[s], [x2, y2] = N[e];
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const sx = x1 + ux * R, sy = y1 + uy * R, ex = x2 - ux * (R + 4), ey = y2 - uy * (R + 4);
    if (crit) under += `<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(ex)}" y2="${f(ey)}" stroke="#f6e016" stroke-width="16" stroke-linecap="round"/>`;
    lines += `<line class="f-line" x1="${f(sx)}" y1="${f(sy)}" x2="${f(ex)}" y2="${f(ey)}" marker-end="url(#cpm-arrow)"/>`;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, px = -uy * side, py = ux * side;
    labels += T(mx + px * 30, my + py * 30 + 8, `${a} (${d})`, 'f-strong', 'middle');
  }
  let nodes = '';
  for (const [k, [x, y, E, Lt]] of Object.entries(N)) {
    nodes += `<circle class="f-box" cx="${x}" cy="${y}" r="${R}"/><line class="f-rule" x1="${x - R + 6}" y1="${y + 4}" x2="${x + R - 6}" y2="${y + 4}" stroke="#e3dac2" stroke-width="2"/>`;
    nodes += T(x, y - 8, k, 'f-big', 'middle') + T(x, y + 28, `${E} | ${Lt}`, 'f-small', 'middle');
  }
  svg('cpm', 'Project network for the worked example. Six activities run between five events: A (3 days) from event 1 to 2, B (4) from 1 to 3, C (2) from 2 to 3, D (5) from 2 to 4, E (4) from 3 to 4 and F (3) from 4 to 5. Earliest and latest event times are 0, 3, 5, 9 and 12. The critical path A, C, E, F is highlighted and takes 12 days.',
    `  ${marker('cpm-arrow')}\n  ${under}\n  ${lines}\n  <g class="f-text">${labels}</g>\n  ${nodes}\n  <g class="f-small">${T(40, 448, 'Inside each event: earliest | latest time (days)')}</g>\n  <rect class="f-acc" x="40" y="466" width="34" height="14" rx="7"/>${T(86, 479, 'Critical path A → C → E → F: 12 days', 'f-text f-strong')}`);
}

/* 2. Herzberg: two separate scales */
{
  const block = (y, title, sub, left, right, chips, cls) => {
    let s = T(40, y, title, 'f-text f-strong') + T(40 + title.length * 12.5 + 14, y, sub, 'f-small');
    s += `<line class="f-line" x1="44" y1="${y + 36}" x2="756" y2="${y + 36}" marker-start="url(#hz-arrow)" marker-end="url(#hz-arrow)"/>`;
    s += T(40, y + 68, left, 'f-small') + T(760, y + 68, right, 'f-small', 'end');
    chips.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3), x = 40 + col * 245, yy = y + 90 + row * 48;
      s += `<rect class="${cls}" x="${x}" y="${yy}" width="230" height="38" rx="19"/>` + T(x + 115, yy + 26, c, 'f-small f-strong', 'middle');
    });
    return s;
  };
  svg('herzberg', "Herzberg's two-factor theory as two separate scales. Hygiene factors (pay, supervision, company policy, working conditions, job security, relations with co-workers) run from dissatisfaction to no dissatisfaction. Motivators (achievement, recognition, the work itself, responsibility, advancement, growth) run from no satisfaction to satisfaction.",
    `  ${marker('hz-arrow')}\n  ` +
    block(50, 'Hygiene factors', 'surround the job', 'Dissatisfaction', 'No dissatisfaction', ['Pay', 'Supervision', 'Company policy', 'Working conditions', 'Job security', 'Co-worker relations'], 'f-box') +
    `\n  <line x1="40" y1="250" x2="760" y2="250" stroke="#e3dac2" stroke-width="2"/>\n  ` +
    block(292, 'Motivators', 'are in the job itself', 'No satisfaction', 'Satisfaction', ['Achievement', 'Recognition', 'The work itself', 'Responsibility', 'Advancement', 'Growth'], 'f-acc'));
}

/* 3. Break-even chart, to scale: P = 500, V = 300, F = 2,00,000; BEP 1,000 bags; actual 1,500 */
{
  const X = (u) => 110 + u * 0.32, Y = (r) => 430 - r * 0.00037;
  const rev = (u) => 500 * u, cost = (u) => 200000 + 300 * u;
  const p = (u, v) => `${f(X(u))},${f(Y(v))}`;
  let s = `  <polygon class="f-l1" points="${p(0, 0)} ${p(1000, 500000)} ${p(0, 200000)}"/>\n`;
  s += `  <polygon class="f-acc" points="${p(1000, 500000)} ${p(2000, rev(2000))} ${p(2000, cost(2000))}"/>\n  <g class="f-grid">`;
  for (const v of [250000, 500000, 750000, 1000000]) s += `<line x1="110" y1="${f(Y(v))}" x2="760" y2="${f(Y(v))}"/>`;
  s += `</g>\n  <line class="f-axis" x1="110" y1="430" x2="765" y2="430"/><line class="f-axis" x1="110" y1="430" x2="110" y2="50"/>\n`;
  s += `  <line class="f-dash" x1="110" y1="${f(Y(200000))}" x2="750" y2="${f(Y(200000))}"/>\n`;
  s += `  <line class="f-line" x1="${f(X(0))}" y1="${f(Y(0))}" x2="${f(X(2000))}" y2="${f(Y(rev(2000)))}"/>\n`;
  s += `  <line class="f-line" x1="${f(X(0))}" y1="${f(Y(cost(0)))}" x2="${f(X(2000))}" y2="${f(Y(cost(2000)))}"/>\n`;
  s += `  <line class="f-dash" x1="${f(X(1000))}" y1="${f(Y(500000))}" x2="${f(X(1000))}" y2="430"/><line class="f-dash" x1="${f(X(1500))}" y1="${f(Y(rev(1500)))}" x2="${f(X(1500))}" y2="430"/>\n`;
  s += `  <circle class="f-dot" cx="${f(X(1000))}" cy="${f(Y(500000))}" r="9"/>\n`;
  s += `  <path class="f-line" d="M${f(X(1000))} 405 v12 M${f(X(1000))} 411 H${f(X(1500))} M${f(X(1500))} 405 v12" fill="none" stroke-width="2.5"/>\n`;
  s += '  <g class="f-small">';
  for (const [u, l] of [[0, '0'], [500, '500'], [1000, '1,000'], [1500, '1,500'], [2000, '2,000']]) s += T(X(u), 456, l, '', 'middle');
  for (const [v, l] of [[250000, '2.5'], [500000, '5'], [750000, '7.5'], [1000000, '10']]) s += T(98, Y(v) + 6, l, '', 'end');
  s += T(122, 44, '₹ lakh') + T(760, 490, 'Bags sold a month', '', 'end') + T(X(1250), 380, 'Margin of safety', 'f-strong', 'middle') + T(X(1250), 401, '500 bags', '', 'middle');
  s += T(612, Y(200000) - 10, 'Fixed cost') + '</g>\n  <g class="f-text">';
  s += T(650, 80, 'Sales revenue', '', 'end') + T(750, 200, 'Total cost', '', 'end') + T(740, 118, 'Profit', 'f-strong', 'end') + T(X(200), 378, 'Loss', '', 'middle');
  s += T(X(1000) - 18, 205, 'Break-even point', 'f-strong', 'end') + T(X(1000) - 18, 231, '1,000 bags, ₹5 lakh', '', 'end') + '</g>';
  svg('break-even', 'Break-even chart for the worked example, drawn to scale. Fixed cost is 2 lakh rupees. The total cost line starts at 2 lakh and rises 300 rupees a bag; the sales revenue line starts at zero and rises 500 rupees a bag. They cross at the break-even point, 1,000 bags and 5 lakh rupees. Below it is a loss, above it a profit. At actual sales of 1,500 bags the margin of safety is 500 bags.', s);
}

/* 4. Type I and Type II errors: the decision table */
{
  const cell = (x, y, w, h, cls, title, l1, l2) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>` +
    T(x + w / 2, y + 66, title, 'f-big', 'middle') + T(x + w / 2, y + 106, l1, 'f-text', 'middle') + (l2 ? T(x + w / 2, y + 134, l2, 'f-small', 'middle') : '');
  let s = '';
  s += T(395, 46, 'The truth about H₀', 'f-small f-strong', 'middle');
  s += T(382, 92, 'H₀ is true', 'f-text f-strong', 'middle') + T(657, 92, 'H₀ is false', 'f-text f-strong', 'middle');
  s += T(30, 92, 'Your decision', 'f-small f-strong');
  s += T(30, 205, 'Reject H₀', 'f-text f-strong') + T(30, 233, 'the result is', 'f-small') + T(30, 257, '“significant”', 'f-small');
  s += T(30, 385, 'Do not', 'f-text f-strong') + T(30, 413, 'reject H₀', 'f-text f-strong');
  s += cell(250, 120, 265, 170, 'f-acc', 'Type I error', 'a false alarm', 'probability α');
  s += cell(525, 120, 265, 170, 'f-box', 'Correct', 'a real effect found', 'probability 1 − β (power)');
  s += cell(250, 300, 265, 170, 'f-box', 'Correct', 'no effect, none claimed', 'probability 1 − α');
  s += cell(525, 300, 265, 170, 'f-acc', 'Type II error', 'a missed effect', 'probability β');
  svg('hypothesis-errors', 'The four outcomes of a hypothesis test. If H0 is true and you reject it, that is a Type I error, a false alarm, with probability alpha. If H0 is true and you do not reject it, that is correct, with probability 1 minus alpha. If H0 is false and you reject it, that is correct, with probability 1 minus beta, the power of the test. If H0 is false and you do not reject it, that is a Type II error, a missed effect, with probability beta.', s);
}

/* 5. Fayol's scalar chain and gang plank */
{
  const left = [['A', 400, 78], ['B', 334, 146], ['C', 274, 214], ['D', 214, 282], ['E', 154, 350], ['F', 94, 418]];
  const right = [['A', 400, 78], ['L', 466, 146], ['M', 526, 214], ['N', 586, 282], ['O', 646, 350], ['P', 706, 418]];
  let s = '';
  for (const chain of [left, right]) s += `<polyline class="f-line" fill="none" points="${chain.map(([, x, y]) => `${x},${y}`).join(' ')}"/>`;
  s += `<line x1="94" y1="418" x2="706" y2="418" stroke="#f6e016" stroke-width="16" stroke-linecap="round"/><line class="f-dash" x1="94" y1="418" x2="706" y2="418"/>`;
  for (const [k, x, y] of [...left, ...right.slice(1)]) s += `<circle class="${k === 'F' || k === 'P' ? 'f-acc' : 'f-box'}" cx="${x}" cy="${y}" r="27" stroke="#0d2a1c" stroke-width="2"/>` + T(x, y + 9, k, 'f-text f-strong', 'middle');
  s += T(400, 372, 'Gang plank', 'f-text f-strong', 'middle') + T(400, 398, 'F and P deal directly', 'f-small', 'middle');
  s += T(400, 470, 'with E and O informed and in agreement', 'f-small', 'middle');
  s += T(40, 50, 'The scalar chain: the formal route', 'f-small f-strong') + T(40, 76, 'from F to P climbs to A and back', 'f-small') + T(40, 100, 'down: ten steps', 'f-small');
  svg('scalar-chain', "Fayol's scalar chain. Two lines of authority run down from A: A, B, C, D, E, F on the left and A, L, M, N, O, P on the right. The formal route from F to P climbs to A and back down, ten steps. A dashed gang plank links F and P directly, used with the knowledge and agreement of their superiors E and O.", s);
}

/* 6. Incoterms 2020: where risk passes, and how far the seller pays */
{
  const cols = [190, 285, 380, 472, 570, 660, 750];
  const heads = [['Seller’s', 'premises'], ['Handed to', 'carrier'], ['Alongside', 'ship'], ['On board', 'ship'], ['Arrival at', 'destination'], ['Unloaded', 'there'], ['Import', 'duty paid']];
  let s = '<g class="f-grid">' + cols.map((x) => `<line x1="${x}" y1="74" x2="${x}" y2="568"/>`).join('') + '</g><g class="f-small" style="font-size:16px">';
  heads.forEach(([a, b], i) => { s += T(cols[i], 30, a, 'f-strong', 'middle') + T(cols[i], 52, b, '', 'middle'); });
  s += '</g>';
  const rows1 = [['EXW', 0, 0], ['FCA', 1, 1], ['CPT', 1, 4], ['CIP', 1, 4, 'ins'], ['DAP', 4, 4], ['DPU', 5, 5], ['DDP', 4, 4, 'duty']];
  const rows2 = [['FAS', 2, 2], ['FOB', 3, 3], ['CFR', 3, 4], ['CIF', 3, 4, 'ins']];
  const row = ([t, risk, cost, extra], y) => {
    let r = T(30, y + 8, t, 'f-text f-strong');
    r += `<rect class="f-acc" x="168" y="${y - 8}" width="${cols[cost] - 168 + 10}" height="16" rx="8"/>`;
    if (extra === 'duty') r += `<rect class="f-acc" x="${cols[6] - 24}" y="${y - 8}" width="48" height="16" rx="8"/>`;
    if (extra === 'ins') r += T(cols[cost] + 20, y + 6, '+ insurance', 'f-small', 'start', ' style="font-size:16px"');
    r += `<circle class="f-dot" cx="${cols[risk]}" cy="${y}" r="9"/>`;
    return r;
  };
  s += T(30, 92, 'Any mode of transport', 'f-small f-strong');
  rows1.forEach((r, i) => { s += row(r, 120 + i * 38); });
  s += `<line x1="24" y1="${120 + 7 * 38 - 10}" x2="776" y2="${120 + 7 * 38 - 10}" stroke="#e3dac2" stroke-width="2"/>`;
  s += T(30, 410, 'Sea and inland waterway only', 'f-small f-strong');
  rows2.forEach((r, i) => { s += row(r, 438 + i * 38); });
  s += `<rect class="f-acc" x="30" y="594" width="40" height="16" rx="8"/>` + T(82, 608, 'Costs the seller pays', 'f-small');
  s += `<circle class="f-dot" cx="372" cy="602" r="9"/>` + T(390, 608, 'Risk passes to the buyer', 'f-small');
  svg('incoterms', 'The eleven Incoterms 2020 rules on one chart. For each rule a bar shows how far the seller pays costs and a dot shows where risk passes to the buyer. EXW: both at the seller’s premises. FCA: both when handed to the carrier. CPT and CIP: risk passes when handed to the carrier, but the seller pays carriage to the destination, and under CIP insurance too. DAP: both on arrival at the destination. DPU: both once unloaded there. DDP: risk on arrival, and the seller also pays import duty. FAS: both alongside the ship. FOB: both on board. CFR and CIF: risk passes on board at the port of shipment, but the seller pays freight to the destination port, and under CIF insurance too.', s, 630);
}

/* 7. Walton's eight criteria of quality of work life */
{
  const items = [['Fair pay', 'Adequate and fair compensation'], ['Safe, healthy conditions', 'Fair hours, physical safety'], ['Using and growing skills', 'Autonomy, variety, whole tasks'], ['Growth and security', 'Careers, learning, job security'],
    ['Social integration', 'Belonging, without prejudice'], ['Rights at work', 'Privacy, voice, fair treatment'], ['Work and the rest of life', 'Time and energy left for family'], ['Socially relevant work', 'Pride in what the employer does']];
  let s = '';
  items.forEach(([a, b], i) => {
    const col = i < 4 ? 0 : 1, row = i % 4, x = 20 + col * 390, y = 22 + row * 118;
    s += `<rect class="f-box" x="${x}" y="${y}" width="370" height="104" rx="16"/><circle class="f-acc" cx="${x + 38}" cy="${y + 52}" r="24" stroke="#0d2a1c" stroke-width="2"/>`;
    s += T(x + 38, y + 61, String(i + 1), 'f-text f-strong', 'middle') + T(x + 78, y + 46, a, 'f-text f-strong') + T(x + 78, y + 76, b, 'f-small');
  });
  svg('walton', "Walton's eight criteria for quality of work life: 1, fair pay; 2, safe and healthy conditions; 3, using and growing skills; 4, growth and security; 5, social integration; 6, rights at work; 7, work and the rest of life; 8, socially relevant work.", s);
}

/* 8. Using AI to learn: a four-step loop */
{
  const boxes = [[260, 46, '1  Attempt it first', 'your outline, your answer'], [500, 206, '2  Ask a sharp question', 'context in, reasons out'], [260, 366, '3  Check every claim', 'against a trusted source'], [20, 206, '4  Rewrite in your words', 'and note where AI helped']];
  let s = marker('ai-arrow');
  boxes.forEach(([x, y, a, b], i) => {
    s += `<rect class="${i === 0 ? 'f-acc' : 'f-box'}" x="${x}" y="${y}" width="280" height="88" rx="16"${i === 0 ? ' stroke="#0d2a1c" stroke-width="2"' : ''}/>`;
    s += T(x + 140, y + 38, a, 'f-text f-strong', 'middle') + T(x + 140, y + 66, b, 'f-small', 'middle');
  });
  const arcs = ['M548 90 Q640 90 640 196', 'M640 302 Q640 410 548 410', 'M252 410 Q160 410 160 302', 'M160 196 Q160 90 252 90'];
  s += arcs.map((d) => `<path class="f-line" d="${d}" fill="none" marker-end="url(#ai-arrow)"/>`).join('');
  s += T(400, 242, 'You stay', 'f-big', 'middle') + T(400, 280, 'the author', 'f-big', 'middle');
  svg('ai-loop', 'A four-step loop for learning with an AI assistant: 1, attempt it first, with your own outline and answer; 2, ask a sharp question, giving context and asking for reasons; 3, check every claim against a trusted source; 4, rewrite in your own words and note where AI helped. In the middle: you stay the author.', s);
}
console.log('ok');
