// Makes the share cards (the picture a link shows on WhatsApp, LinkedIn, X and Facebook): 1200 x 630 JPEGs in
// src/assets/og/, one per article, study note and blog post, and default.jpg for every other page.
// Each card is drawn as a small web page in the site's fonts and colours, photographed with headless Chrome or Edge,
// then saved as a JPEG with sharp. Run it after adding or retitling an entry:
//
//   node scripts/og-images.mjs [path to sharp]
//
// sharp is not a dependency of the site (the published build never needs it). Pass the folder of any copy of it,
// for example a `node_modules/sharp` elsewhere on this computer, or install it once with `npm i --no-save sharp`.
// Needs an internet connection for the Google fonts, as the site does.
import { createServer } from "node:http";
import { readFile, readdir, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, extname, resolve, basename } from "node:path";

const require = createRequire(import.meta.url);
const sharp = process.argv[2] ? require(resolve(process.argv[2])) : (await import("sharp")).default;

const src = resolve("src"), outDir = resolve("src/assets/og");
const site = JSON.parse(readFileSync("src/_data/site.json", "utf8"));
const cv = JSON.parse(readFileSync("src/_data/cv.json", "utf8"));
const courses = cv.teaching.flatMap((a) => a.courses);
const browser = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((b) => existsSync(b));
if (!browser) throw new Error("No Chrome or Edge found; set CHROME_PATH.");

// --- what to draw: every entry, read from its front matter
const field = (fm, k) => { const m = fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m")); return m ? m[1].trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"') : ""; };
const cards = [];
for (const folder of ["articles", "resources", "blog"]) {
  const label = JSON.parse(readFileSync(`src/${folder}/${folder}.json`, "utf8")).section.label;
  for (const f of (await readdir(`src/${folder}`)).filter((f) => f.endsWith(".md"))) {
    const fm = readFileSync(`src/${folder}/${f}`, "utf8").split(/\r?\n---/)[0];
    const course = courses.find((c) => c.slug === field(fm, "course"));
    cards.push({ slug: basename(f, ".md"), title: field(fm, "title"), label: course ? `${label} · ${course.title}` : label, figure: field(fm, "figure"), image: field(fm, "image") });
  }
}

// --- the card, as a page
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = readFileSync("src/assets/style.css", "utf8");
const figCss = (css.match(/^\.fig[ .{][^\n]*$/gm) || []).join("\n");
const mark = readFileSync("src/assets/brand/logo-on-dark.svg", "utf8");
const page = (body) => `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@500..900&family=Red+Hat+Text:wght@400..600&display=block" rel="stylesheet">
<style>
:root { --font-display: "Red Hat Display", sans-serif; --font-text: "Red Hat Text", sans-serif; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { background: #0d2a1c; color: #f4f6f2; font-family: var(--font-text); position: relative; }
.wreath { position: absolute; width: 520px; height: 520px; right: -150px; bottom: -190px; opacity: .1; }
.card { position: absolute; inset: 0; padding: 56px 64px; display: flex; gap: 52px; align-items: stretch; }
.text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 18px; font: 800 28px/1 var(--font-display); letter-spacing: -.02em; }
.brand svg { width: 76px; height: 76px; }
.brand small { display: block; margin-top: 6px; font: 500 20px/1 var(--font-text); letter-spacing: 0; color: #a9b8ae; }
.mid { margin-block: auto; padding-block: 24px 8px; }
.label { font: 600 24px/1.3 var(--font-text); color: #f6e016; margin-bottom: 18px; }
h1 { font: 800 64px/1.06 var(--font-display); letter-spacing: -.03em; text-wrap: balance; }
.bar { width: 120px; height: 10px; border-radius: 5px; background: #f6e016; }
.side { flex: 0 0 auto; align-self: center; border-radius: 18px; overflow: hidden; background: #fbf7ea; }
.side.fig-side { width: 500px; padding: 14px; }
.side.photo { width: 420px; height: 518px; }
.side.photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.portrait { position: absolute; right: 0; top: 0; width: 430px; height: 630px; object-fit: cover; object-position: 50% 20%; }
${figCss}
</style>
<img class="wreath" src="/assets/brand/wreath.svg" alt="">
${body}
<script>
  // Shrink the title until it fits its column.
  document.fonts.ready.then(() => {
    const h = document.querySelector("h1"), mid = document.querySelector(".mid");
    if (!h) return;
    let size = 64;
    while (size > 34 && (h.scrollHeight > size * 1.06 * 4 + 2 || mid.getBoundingClientRect().bottom > 630 - 56 - 40)) { size -= 2; h.style.fontSize = size + "px"; }
  });
</script>`;
const brand = `<div class="brand">${mark}<div>${esc(site.fullName)}<small>inigo.co.in</small></div></div>`;
const entryCard = (c) => {
  let side = "";
  if (c.figure) side = `<div class="side fig-side">${readFileSync(`src/_includes/figures/${c.figure}.svg`, "utf8")}</div>`;
  else if (c.image) side = `<div class="side photo"><img src="${c.image}" alt=""></div>`;
  return page(`<div class="card"><div class="text">${brand}<div class="mid"><p class="label">${esc(c.label)}</p><h1>${esc(c.title)}</h1></div><div class="bar"></div></div>${side}</div>`);
};
const defaultCard = page(`<img class="portrait" src="${site.photo}" alt="">
<div class="card" style="padding-right: 494px"><div class="text">${brand}<div class="mid"><p class="label">${esc(site.role)} of ${esc(site.subject)}</p><h1>${esc(site.formalName)}</h1>
<p style="margin-top: 22px; font: 500 26px/1.35 var(--font-text); color: #a9b8ae">${esc(site.institution)}</p></div><div class="bar"></div></div></div>`);

// --- serve src/ plus the cards, and photograph each one
const tmp = await mkdtemp(join(tmpdir(), "og-"));
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = p.startsWith("/_card/") ? join(tmp, p.slice(7)) : join(src, p);
  try { const body = await readFile(file); res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(outDir, { recursive: true });

const shoot = async (name, html) => {
  await writeFile(join(tmp, name + ".html"), html);
  const png = join(tmp, name + ".png"), profile = join(tmp, "profile-" + name);
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1", `--user-data-dir=${profile}`,
    "--window-size=1200,630", "--virtual-time-budget=6000", `--screenshot=${png}`, `${base}/_card/${name}.html`];
  const code = await new Promise((r) => spawn(browser, args, { stdio: "ignore" }).on("exit", r));
  if (code !== 0 || !existsSync(png)) throw new Error(`${name}: browser exited with ${code}`);
  const out = join(outDir, name + ".jpg");
  await sharp(png).resize(1200, 630, { fit: "cover", position: "top" }).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
  console.log(`${name}.jpg ${Math.round((await stat(out)).size / 1024)} KB`);
};
try {
  const jobs = [["default", defaultCard], ...cards.map((c) => [c.slug, entryCard(c)])];
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(([n, h]) => shoot(n, h)));
} finally {
  server.close();
  await rm(tmp, { recursive: true, force: true }).catch(() => {});
}
