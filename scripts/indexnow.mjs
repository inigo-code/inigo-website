// IndexNow: tells Bing, Yandex, Seznam, Naver and other IndexNow search engines which pages changed.
// No account needed: the key in site.json is published at /<key>.txt to prove the site is ours.
//
//   node scripts/indexnow.mjs payload   Prints the IndexNow request for pages whose HTML differs from the
//                                       live site (new or changed), or nothing if none did. Run after
//                                       `npm run build` and before deploying. Used by the deploy workflow.
//   node scripts/indexnow.mjs send-all  Submits every page in the sitemap now.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(await readFile(path.join(root, "src/_data/site.json"), "utf8"));
const origin = site.url.replace(/\/$/, "");
const host = new URL(origin).host;

const sitemap = await readFile(path.join(root, "_site/sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const norm = (s) => s.replace(/\r\n/g, "\n");
const localFile = (url) => path.join(root, "_site", new URL(url).pathname, "index.html");

async function changed() {
  const out = [];
  for (const url of urls) {
    const local = norm(await readFile(localFile(url), "utf8"));
    let live = null;
    try {
      const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
      if (res.ok) live = norm(await res.text());
    } catch { /* treat as changed */ }
    if (live !== local) out.push(url);
  }
  return out;
}

const payload = (list) => JSON.stringify({ host, key: site.indexNowKey, keyLocation: `${origin}/${site.indexNowKey}.txt`, urlList: list });

const mode = process.argv[2];
if (mode === "payload") {
  const list = await changed();
  console.error(`IndexNow: ${list.length} changed page(s)`, list.join(" "));
  if (list.length) process.stdout.write(payload(list));
} else if (mode === "send-all") {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: payload(urls),
  });
  console.log(`IndexNow: sent ${urls.length} page(s), HTTP ${res.status} ${await res.text()}`);
} else {
  console.error("Usage: node scripts/indexnow.mjs payload | send-all");
  process.exit(1);
}
