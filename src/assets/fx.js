// The motion layer: a 3D hero portrait, letters that flip up, cards that tilt toward the pointer,
// figures that count up and a 3D Seyalyst word. Nothing here runs when the visitor asks for reduced motion,
// and the page reads the same without it.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v) => Math.max(-1, Math.min(1, v));

  // Split a heading into words and letters that can flip up one after another.
  // Screen readers get the plain text once; the pieces are hidden from them.
  const split = (el, letters = true) => {
    if (!el || el.dataset.split) return;
    el.dataset.split = letters ? "letters" : "words";
    const label = el.textContent.replace(/\s+/g, " ").trim();
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 1) { walk(n); return; }
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement("span");
          w.className = "w"; w.setAttribute("aria-hidden", "true");
          if (letters) {
            [...part].forEach((c) => {
              const s = document.createElement("span");
              s.className = "ch"; s.textContent = c; s.style.setProperty("--i", i++);
              w.append(s);
            });
          } else { w.textContent = part; w.style.setProperty("--i", i++); }
          frag.append(w);
        });
        n.replaceWith(frag);
      });
    };
    walk(el);
    const sr = document.createElement("span");
    sr.className = "sr-only"; sr.textContent = label;
    el.append(sr);
  };

  split(document.querySelector(".hero-name"));
  split(document.querySelector(".brand-giant"));
  split(document.querySelector(".closing h2"), false);

  // Things that play once when they scroll into view.
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      seen.unobserve(en.target);
      if (en.target.dataset.count) count(en.target); else en.target.classList.add("in");
    });
  }, { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll(".brand-giant, .closing h2").forEach((el) => seen.observe(el));

  // Figures count up from zero: "150+" runs 0 → 150 and keeps its "+".
  const count = (el) => {
    const end = +el.dataset.count, tail = el.dataset.tail || "", t0 = performance.now();
    const dur = 1200 + Math.min(end * 2, 900);
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(end * eased) + tail;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  document.querySelectorAll(".big-num, .cv-stat-num, .years-num").forEach((el) => {
    const m = el.textContent.trim().match(/^(\d+)(\D*)$/);
    if (!m || +m[1] < 2) return;
    el.dataset.count = m[1]; el.dataset.tail = m[2];
    el.setAttribute("aria-label", el.textContent.trim());
    el.textContent = "0" + m[2];
    seen.observe(el);
  });

  if (!fine) return; // everything below follows a mouse pointer

  // Smoothly follow the pointer over an area, writing -1…1 into two CSS variables on a target.
  const follow = (area, target, xVar, yVar) => {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      target.style.setProperty(xVar, x.toFixed(3)); target.style.setProperty(yVar, y.toFixed(3));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    area.addEventListener("pointermove", (e) => {
      const r = target.getBoundingClientRect();
      tx = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2));
      ty = clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2));
      if (!raf) raf = requestAnimationFrame(step);
    });
    area.addEventListener("pointerleave", () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  };
  const hero = document.querySelector(".hero"), portrait = document.querySelector(".hero-portrait");
  if (hero && portrait) follow(hero, portrait, "--px", "--py");
  const brand = document.querySelector(".brand"), giant = document.querySelector(".brand-giant");
  if (brand && giant) follow(brand, giant, "--bx", "--by");

  // Cards lean toward the pointer, with a soft sheen where it rests.
  const cards = ".feature-card, .article-lead, .article-card, .note-card, .clipping, .toss-card, .mosaic figure, .about-trio li, .campaign-grid > li, .talk-cards > li, .stage-talks > li, .tool-shot";
  document.querySelectorAll(cards).forEach((el) => {
    let raf = 0;
    const glare = document.createElement("span");
    glare.className = "glare"; glare.setAttribute("aria-hidden", "true");
    el.addEventListener("pointerenter", () => {
      if (!glare.isConnected) el.append(glare);
      el.classList.add("tilt", "tilting");
    });
    el.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        const max = r.width > 520 ? 4 : 7; // big cards lean less
        el.style.setProperty("--ry", ((x - 0.5) * max).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((0.5 - y) * max).toFixed(2) + "deg");
        el.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
        el.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
      });
    });
    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      el.classList.remove("tilting");
      el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
    });
  });
})();
