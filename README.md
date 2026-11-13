# inigo.co.in

Personal website: CV, articles, student resources, blog, contact, and the Seyalyst brand.
Built with [Eleventy](https://www.11ty.dev/), a small static-site tool. Every page is plain HTML when published.

## Change your details

| What | File |
|---|---|
| Name, subject, university, intro, office hours, email, photo, Seyalyst text and social links | `src/_data/site.json` |
| CV: positions, education, publications, teaching, awards, service | `src/_data/cv.json` |
| CV as a PDF to download | put it in `src/assets/files/` and set `"cvPdf": "/assets/files/cv.pdf"` in `site.json` |
| Photo | put it in `src/assets/` and set `"photo": "/assets/photo.jpg"` (a portrait about 4:5 works best; the current one is 720 × 900), then remake the share cards (below) |

Anything in `[square brackets]` is a placeholder to replace. A social or academic link with an empty `"url"` is hidden.

## Add an article, post or resource

Copy an existing file in the folder and change it. The file name becomes the address
(`src/blog/exam-tips.md` → `inigo.co.in/blog/exam-tips/`).

- **Articles** (`src/articles/`): longer or published writing. Optional `published:` and `link:`.
- **Blog** (`src/blog/`): short notes and announcements.
- **Resources** (`src/resources/`): material for students, grouped by `course:` on the Resources page.
  `kind:` is the label (Notes, Slides, Reading list…). `file:` offers a download from `src/assets/files/`;
  `link:` points elsewhere (a video, a Drive folder).

A new resource, for example `src/resources/or-unit-1-notes.md`:

```markdown
---
title: "Unit 1: Linear programming notes"
description: "Formulating an LP problem, with three worked examples."
date: 2026-11-20
course: "operations-research"
figure: "lpp"
kind: "Notes"
file: "/assets/files/or-unit-1.pdf"
---

Anything you write here appears on the page.
```

`course` is a course `slug` from the `teaching` areas in `src/_data/cv.json`; it puts the note under that paper on the Resources and CV pages. `figure` names a drawn diagram in `src/_includes/figures/` (an `.svg` file); an article can use a photograph instead with `image`, `imageAlt`, `imageW` and `imageH`.

### Optional front matter for any article, post or note

| Field | What it does |
|---|---|
| `seoTitle` | A shorter title, used only in the browser tab and search results (`<title>`), which show about 60 characters. Put the words people search for first. The page heading and the share title keep `title`. The name is added after it as " · Inigo Papu Vinodhan" or " · Inigo" when it fits in 60 characters, and left off when it does not. |
| `takeaways` | A list of key points shown in a box above the text ("Key points" on notes, "In short" on articles). `**bold**` works. |
| `faq` | Questions and answers shown at the end (`- q: "…"` with `a: "…"` under it). They also go to search engines as an FAQ. |
| `keywords` | A list of search phrases, for the page's keywords tag and structured data. |
| `related` | A list of addresses to show first under "Read next", from any section, e.g. `related: ["/articles/quality-of-work-life-audit/"]`. The rest is filled from the same section. |
| `updated` | The date of a real revision; it goes into the sitemap and structured data. |

Every `##` and `###` heading in the text gets its own link address (`/resources/break-even-analysis/#worked-example`), made from the heading's words, so changing a heading changes its address. Study notes with four or more `##` sections show an "On this page" list above the text.

## Files that build themselves

These are made from the pages and data on every build; there is nothing to edit by hand:

- `/sitemap.xml`: every public page with its date, for search engines.
- `/robots.txt`: lets every search engine and AI assistant read the site, and points them to the sitemap.
- `/llms.txt`: a plain-text summary of the site for AI assistants, with every article, note and publication.
- `/feed.xml`: an Atom feed of the articles and study notes, for feed readers (linked in the footer).

## Share cards

When a link to the site is shared on WhatsApp, LinkedIn, X or Facebook, it shows a 1200 × 630 card from `src/assets/og/`: one per article, note and blog post (its title, section and diagram or photo), and `default.jpg` (name, role and photo) for every other page. A page without its own card uses the default one. After adding or retitling an entry, remake them:

```
node scripts/og-images.mjs <path to sharp>
```

The script draws each card as a small web page and photographs it with Chrome or Edge, so it needs an internet connection for the fonts. It also needs [sharp](https://sharp.pixelplumbing.com/), which the site itself does not use: pass the folder of any copy (for example `../some-project/node_modules/sharp`), or run `npm i --no-save sharp` once and leave the path out.

## Diagrams

The drawn figures live in `src/_includes/figures/` as SVG files that use the site's figure classes (`f-bg`, `f-box`, `f-acc`, `f-line`, `f-text`, …), so they always print on paper colours. Eight of them (ai-loop, break-even, cpm, herzberg, hypothesis-errors, incoterms, scalar-chain, walton) are drawn to scale by `scripts/figures.cjs`:

```
node scripts/figures.cjs src/_includes/figures
```

It overwrites those eight files, so make any change to them in the script. The other figures were drawn by hand.

## Preview on this computer

```bash
npm start
```

Then open http://localhost:8080. Pages reload as you save.

## Publish

Pushing to `main` on GitHub builds and publishes the site (`.github/workflows/deploy.yml`).
In the repository's **Settings → Pages**, set **Source** to **GitHub Actions** and **Custom domain** to `inigo.co.in`, then tick **Enforce HTTPS** once it is offered.

### Point inigo.co.in at GitHub (GoDaddy → My Products → inigo.co.in → DNS)

Remove GoDaddy's default "Parked" `A` record for `@`, then add:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<github-username>.github.io` |

DNS can take up to a day to take effect. GitHub then issues the HTTPS certificate on its own.

## Adding a news report

Newspaper coverage lives in `src/_data/coverage.json`. Add the newest report at the top of `items`, with the outlet, the date (`2026-03` or `2026-03-25`), how the date should read (`when`), the headline as printed, a one-line summary and the link. Set `"featured": true` to show it on the home page (three at most), and `"namesInigo": true` when the article names you. Only add articles that really exist.

## The downloadable CV (PDF)

The PDF at `src/assets/files/inigo-papu-vinodhan-cv.pdf` is printed from `src/cv-print.njk`, which reads `cv.json` and `site.json`. After changing either, run:

```
npm run cv-pdf
```

It builds the site and prints `/cv/print/` with Chrome or Edge. Keep it to two pages: if it spills over, shorten an entry.
