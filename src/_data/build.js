const now = new Date();
export default {
  year: now.getFullYear(),
  // "November 2026": the month the site, and so the PDF CV, was last built.
  month: now.toLocaleString("en-GB", { month: "long", year: "numeric" }),
};
