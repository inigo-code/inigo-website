// Eleventy turns the files in src/ into the finished website in _site/.
import { existsSync } from "node:fs";

// A heading's text as a web address fragment: "Step 2: The P/V ratio" → "step-2-the-pv-ratio".
const slugify = (s) => String(s).replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/['’‘"“”`*_~/()[\]]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

// The share card for a page (made by scripts/og-images.mjs): an entry's own, else the default one.
const ogCardFor = (page, isEntry) => {
  const own = `/assets/og/${page.fileSlug}.jpg`;
  if (isEntry && existsSync("src" + own)) return { url: own, width: 1200, height: 630, entry: true };
  if (existsSync("src/assets/og/default.jpg")) return { url: "/assets/og/default.jpg", width: 1200, height: 630 };
  return null;
};

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/CNAME"); // tells GitHub Pages the site's domain: inigo.co.in
  let mdLib;
  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ typographer: true }); // curly quotes and dashes in Markdown
    // Every h2 and h3 gets a stable id, so a section of a note can be linked to (and cited) directly.
    // Ids the entry layout already uses are kept free.
    md.core.ruler.push("heading_ids", (state) => {
      const used = new Set(["main", "nav", "takeaways-title", "faq-title", "related-title", "toc-title"]);
      state.tokens.forEach((t, i) => {
        if (t.type !== "heading_open" || !/^h[23]$/.test(t.tag) || t.attrGet("id")) return;
        const base = slugify(state.tokens[i + 1].content);
        let id = base, n = 2;
        while (used.has(id)) id = `${base}-${n++}`;
        used.add(id);
        t.attrSet("id", id);
      });
    });
    mdLib = md;
  });
  // Text for <title> and meta tags: escapes what HTML needs, but leaves apostrophes readable.
  eleventyConfig.addFilter("text", (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
  eleventyConfig.addFilter("ogCard", (page, layout, fallback) => ogCardFor(page, layout === "layouts/entry.njk") || { url: fallback });
  // "On this page": the h2s of a rendered entry, as { id, text }.
  eleventyConfig.addFilter("toc", (html) => [...String(html || "").matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)].map((m) => ({ id: m[1], text: m[2].replace(/<[^>]+>/g, "") })));
  // Entries named in an entry's `related:` front matter (by URL), looked up in collections.all.
  eleventyConfig.addFilter("byUrls", (all, urls) => (urls || []).map((u) => (all || []).find((i) => i.url === u)).filter(Boolean));
  eleventyConfig.addFilter("without", (items, others) => (items || []).filter((i) => !(others || []).some((o) => o.url === i.url)));
  // Short Markdown in front matter (key points), rendered inline.
  eleventyConfig.addFilter("mdInline", (s) => (mdLib ? mdLib.renderInline(String(s || "")) : s));

  const newestFirst = (items) => [...items].sort((a, b) => b.date - a.date);
  eleventyConfig.addCollection("articles", (api) => newestFirst(api.getFilteredByGlob("src/articles/*.md")));
  eleventyConfig.addCollection("posts", (api) => newestFirst(api.getFilteredByGlob("src/blog/*.md")));
  eleventyConfig.addCollection("resources", (api) => newestFirst(api.getFilteredByGlob("src/resources/*.md")));

  const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  eleventyConfig.addFilter("readableDate", (d) => longDate.format(new Date(d)));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("filled", (links) => (links || []).filter((l) => l.url));
  // Minutes to read, at about 220 words a minute.
  eleventyConfig.addFilter("readingTime", (html) => {
    const words = String(html || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  });

  // Resources name their course by its slug (`course: "operations-research"`), matching a course in cv.json's teaching areas.
  const allCourses = (teaching) => (teaching || []).flatMap((a) => a.courses.map((c) => ({ ...c, area: a.area, areaId: a.id })));
  eleventyConfig.addFilter("byCourse", (items, slug) => (items || []).filter((i) => i.data.course === slug));
  eleventyConfig.addFilter("byArea", (items, area) => {
    const slugs = new Set(area.courses.map((c) => c.slug));
    return (items || []).filter((i) => slugs.has(i.data.course));
  });
  eleventyConfig.addFilter("otherCourses", (items, teaching) => {
    const slugs = new Set(allCourses(teaching).map((c) => c.slug));
    return (items || []).filter((i) => !slugs.has(i.data.course));
  });
  eleventyConfig.addFilter("course", (slug, teaching) => allCourses(teaching).find((c) => c.slug === slug) || { title: slug, slug });
  eleventyConfig.addFilter("courseCount", (teaching) => allCourses(teaching).length);
  // Whole years from a start date to the build date (2016-10-01 → 10 in November 2026).
  eleventyConfig.addFilter("yearsSince", (start) => {
    const s = new Date(start), n = new Date();
    return n.getFullYear() - s.getFullYear() - (n < new Date(n.getFullYear(), s.getMonth(), s.getDate()) ? 1 : 0);
  });
  eleventyConfig.addFilter("byTopic", (items, topic) => (items || []).filter((x) => x.data.topic === topic));
  eleventyConfig.addFilter("where", (list, key, value) => (list || []).filter((x) => (value === undefined ? x[key] : x[key] === value)));
  eleventyConfig.addFilter("whereNot", (list, key, value) => (list || []).filter((x) => x[key] !== value));
  // "2023–2026" → { from: "2023", to: "2026" }; "2025–26" → to "2026"; "2020–present" → to "present"; "2025" → no to.
  eleventyConfig.addFilter("yearSpan", (value) => {
    const [from, to] = String(value ?? "").split(/\s*[–-]\s*/);
    if (!to) return { from };
    const t = /^\d{2}$/.test(to) && /^\d{4}$/.test(from) ? from.slice(0, 2) + to : /present/i.test(to) ? "present" : to;
    return { from, to: t };
  });

  // Structured data (schema.org JSON-LD) for search engines and AI answer engines.
  // One Person node for Inigo, the WebSite, and per page: a profile, an article, a study note,
  // its questions and answers, and a breadcrumb trail.
  eleventyConfig.addShortcode("schema", function () {
    const d = this.ctx || {};
    const site = d.site || {}, cv = d.cv || {};
    const url = site.url || "";
    const page = this.page || d.page || {};
    const pageUrl = url + (page.url || "/");
    const abs = (p) => (p && p.startsWith("/") ? url + p : p);
    const person = {
      "@type": "Person",
      "@id": url + "/#person",
      name: site.formalName,
      alternateName: [...new Set([site.fullName, "Inigo Papu Vinodhan", "J. Inigo", "Inigo"])],
      url: url + "/",
      image: abs(site.photo),
      email: "mailto:" + site.personalEmail,
      jobTitle: `${site.role}, ${site.department}`,
      description: site.description,
      worksFor: { "@type": "CollegeOrUniversity", name: site.institution, address: { "@type": "PostalAddress", addressLocality: "Tiruchirappalli", addressRegion: "Tamil Nadu", addressCountry: "IN" } },
      alumniOf: (cv.education || []).filter((e) => /University|College/.test(e.place || "")).map((e) => ({ "@type": "CollegeOrUniversity", name: e.place.split(",")[0] })),
      hasCredential: (site.credentials || "").split(",").map((c) => c.trim()).filter(Boolean),
      knowsAbout: [...(site.researchAreas || []), ...(cv.teaching || []).map((a) => a.area)],
      founder: { "@type": "NGO", name: "TOSS Charitable Trust", url: "https://tosstheworld.org", foundingDate: "2009-03-19", address: { "@type": "PostalAddress", addressLocality: "Tiruchirappalli", addressCountry: "IN" } },
      sameAs: [...(site.academicLinks || []), ...((site.seyalyst && site.seyalyst.socials) || [])].map((l) => l.url).filter((u) => u && !u.includes("tosstheworld")),
    };
    person.hasCredential = person.hasCredential.map((c) => ({ "@type": "EducationalOccupationalCredential", name: c }));
    const website = { "@type": "WebSite", "@id": url + "/#website", url: url + "/", name: site.fullName, inLanguage: "en-IN", publisher: { "@id": url + "/#person" }, author: { "@id": url + "/#person" } };
    const graph = [person, website];
    const crumbs = [{ name: "Home", item: url + "/" }];
    if (d.section) crumbs.push({ name: d.section.label, item: url + d.section.url });
    if (page.url && page.url !== "/" && d.title) crumbs.push({ name: d.title, item: pageUrl });
    if (crumbs.length > 1) graph.push({ "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })) });

    if (page.url === "/about/" || page.url === "/cv/") {
      graph.push({ "@type": "ProfilePage", "@id": pageUrl, url: pageUrl, name: d.title, mainEntity: { "@id": url + "/#person" }, isPartOf: { "@id": url + "/#website" } });
    }
    // Publications, from cv.json. Authors are read from the APA citation ("Surname, I. I., & Surname, I.");
    // when it does not parse, only Inigo is named.
    if (page.url === "/cv/" || page.url === "/articles/") {
      for (const p of cv.publications || []) {
        const names = [...((p.citation || "").split(/\s\(\d{4}\)/)[0].matchAll(/(?:^|,\s*(?:&\s*)?|&\s*)([^,&]+?),\s*((?:[A-Z]\.\s*)+)(?=,|$)/g))]
          .map((m) => ({ surname: m[1].trim(), initials: m[2].trim() }));
        const author = names.length && names.some((n) => n.surname === "Inigo Papu Vinodhan")
          ? names.map((n) => (n.surname === "Inigo Papu Vinodhan" ? { "@id": url + "/#person" } : { "@type": "Person", name: `${n.initials} ${n.surname}` }))
          : [{ "@id": url + "/#person" }];
        const venue = (p.venue || "").split(",")[0].trim();
        const node = {
          "@type": /chapter/i.test(p.type) ? "Chapter" : "ScholarlyArticle",
          "@id": url + "/cv/#pub-" + slugify(p.title).slice(0, 48).replace(/-+$/, ""),
          name: p.title,
          headline: p.title,
          author,
          datePublished: String(p.year),
          inLanguage: "en",
        };
        if (venue) node.isPartOf = { "@type": /journal/i.test(p.type) ? "Periodical" : "Book", name: venue };
        if (p.url) node.url = p.url;
        graph.push(node);
      }
    }
    if (page.url !== "/about/" && page.url !== "/cv/" && d.section && page.date) {
      const isNote = d.section.label === "Resources";
      const card = ogCardFor(page, true);
      const img = card ? (d.image ? [abs(card.url), abs(d.image)] : abs(card.url)) : abs(d.image || site.photo);
      const art = {
        "@type": isNote ? ["Article", "LearningResource"] : "BlogPosting",
        "@id": pageUrl + "#article",
        headline: d.title,
        description: d.description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        image: img,
        datePublished: new Date(page.date).toISOString().slice(0, 10),
        dateModified: new Date(d.updated || page.date).toISOString().slice(0, 10),
        author: { "@id": url + "/#person" },
        publisher: { "@id": url + "/#person" },
        inLanguage: "en-IN",
        isPartOf: { "@id": url + "/#website" },
      };
      if (d.keywords) art.keywords = d.keywords.join(", ");
      if (isNote) {
        const c = (cv.teaching || []).flatMap((a) => a.courses).find((x) => x.slug === d.course);
        Object.assign(art, { learningResourceType: d.kind || "Study notes", educationalLevel: "Undergraduate (B.B.A.)", audience: { "@type": "EducationalAudience", educationalRole: "student" }, isAccessibleForFree: true });
        if (c) art.about = { "@type": "Thing", name: c.title };
        if (d.teaches) art.teaches = d.teaches;
      }
      graph.push(art);
      if (d.faq && d.faq.length) {
        graph.push({ "@type": "FAQPage", "@id": pageUrl + "#faq", mainEntity: d.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
      }
    }
    const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
    return `<script type="application/ld+json">${json}</script>`;
  });

  // Plain text for llms.txt and the feed: strip tags and collapse spaces.
  eleventyConfig.addFilter("plain", (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  eleventyConfig.addFilter("rfc822", (d) => new Date(d).toUTCString());
  eleventyConfig.addFilter("absUrl", (p, base) => (p && p.startsWith("/") ? base + p : p));
  // Entries from the same section, same course first, without the current page.
  eleventyConfig.addFilter("related", (items, current, course, n = 3) => {
    const pool = (items || []).filter((i) => i.url !== current);
    const same = pool.filter((i) => course && i.data.course === course);
    return [...same, ...pool.filter((i) => !same.includes(i))].slice(0, n);
  });

  // Plain-text outputs (llms.txt, robots.txt) are not HTML: undo Nunjucks' HTML escaping there.
  eleventyConfig.addTransform("plain-text", function (content) {
    if (!(this.page.outputPath || "").endsWith(".txt")) return content;
    return content.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  });

  return {
    dir: { input: "src", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    // GitHub Pages sets this when the site lives in a sub-folder (see .github/workflows/deploy.yml).
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
}
