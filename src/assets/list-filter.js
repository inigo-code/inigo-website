// Filter a list of cards by a set of chips and a search box, and keep the choice in the address.
// Markup: <div class="list-tools" data-list-filter data-items="…" data-param="area" data-noun="note,notes">
//   with .chip[data-value] buttons and an input[type=search]; a [data-filter-count] line and a
//   [data-filter-empty] block with a button that clears everything. Each card has data-value and data-search.
const fold = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

for (const box of document.querySelectorAll("[data-list-filter]")) {
  const items = [...document.querySelectorAll(box.dataset.items)];
  const chips = [...box.querySelectorAll(".chip[data-value]")];
  const input = box.querySelector('input[type="search"]');
  const count = document.querySelector(box.dataset.count);
  const empty = document.querySelector(box.dataset.empty);
  const param = box.dataset.param;
  const [one, many] = box.dataset.noun.split(",");
  const resting = count ? count.textContent : "";
  const text = items.map((li) => fold(li.dataset.search || li.textContent));
  let value = "all";

  const update = (save) => {
    const words = fold(input.value).trim().split(/\s+/).filter(Boolean);
    const found = text.map((t) => words.every((w) => t.includes(w)));
    let n = 0;
    items.forEach((li, i) => {
      li.hidden = !(found[i] && (value === "all" || li.dataset.value === value));
      if (!li.hidden) n++;
    });
    // Each chip shows how many cards it would leave with the current search.
    chips.forEach((c) => {
      const k = items.filter((li, i) => found[i] && (c.dataset.value === "all" || li.dataset.value === c.dataset.value)).length;
      const span = c.querySelector("span");
      if (span) span.textContent = k;
      c.setAttribute("aria-pressed", String(c.dataset.value === value));
    });
    const filtered = value !== "all" || words.length;
    if (count) count.textContent = filtered ? `${n} of ${items.length} ${items.length === 1 ? one : many}` : resting;
    if (empty) empty.hidden = n > 0;
    if (save) {
      const url = new URL(location.href);
      value === "all" ? url.searchParams.delete(param) : url.searchParams.set(param, value);
      input.value.trim() ? url.searchParams.set("q", input.value.trim()) : url.searchParams.delete("q");
      history.replaceState(history.state, "", url);
    }
  };

  const pick = (v) => {
    const chip = chips.find((c) => c.dataset.value === v && !c.disabled);
    value = chip ? v : "all";
  };

  chips.forEach((c) => c.addEventListener("click", () => { pick(c.dataset.value); update(true); }));
  input.addEventListener("input", () => update(true));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape" && input.value) { input.value = ""; update(true); } });
  empty?.querySelector("button")?.addEventListener("click", () => { input.value = ""; value = "all"; update(true); input.focus(); });

  const params = new URL(location.href).searchParams;
  input.value = params.get("q") || "";
  pick(params.get(param) || "all");
  update(false);
}
