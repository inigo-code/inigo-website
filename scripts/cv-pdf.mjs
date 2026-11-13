// Makes the downloadable CV: serves the built site, prints /cv/print/ to PDF with headless Chrome or Edge,
// and saves it as src/assets/files/inigo-papu-vinodhan-cv.pdf. Run `npm run cv-pdf` after editing cv.json.
import { createServer } from "node:http";
import { readFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname, resolve } from "node:path";

const root = resolve("_site");
const out = resolve("src/assets/files/inigo-papu-vinodhan-cv.pdf");
const browsers = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error("No Chrome or Edge found; set CHROME_PATH.");

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  let path = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try { if ((await stat(path)).isDirectory()) path = join(path, "index.html"); res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/cv/print/`;

await mkdir(resolve("src/assets/files"), { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "cv-pdf-"));
const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer", `--user-data-dir=${profile}`, "--virtual-time-budget=8000", "--run-all-compositor-stages-before-draw", `--print-to-pdf=${out}`, url];
const code = await new Promise((r) => spawn(browser, args, { stdio: "inherit" }).on("exit", r));
server.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
if (code !== 0) throw new Error(`Browser exited with ${code}`);
console.log(`Saved ${out} (${Math.round((await stat(out)).size / 1024)} KB)`);
