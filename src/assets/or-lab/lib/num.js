// Small number helpers shared by every OR Lab model.

export const EPS = 1e-9;

// Remove floating-point noise such as 0.30000000000000004.
export const clean = (x) => {
  const r = Math.round(x * 1e9) / 1e9;
  return Object.is(r, -0) || r === 0 ? 0 : r;
};

// Show a number with at most `dp` decimals and no trailing zeros: 3, 2.5, 0.3333.
export const fmt = (x, dp = 4) => {
  if (x === Infinity) return "∞";
  if (x === -Infinity) return "−∞";
  if (Number.isNaN(x)) return "–";
  const c = clean(x), r = Number(c.toFixed(dp));
  // A small number that is not zero, such as a rate of 0.00002 per day, keeps 4 significant digits.
  if (r === 0 && c !== 0) return c.toLocaleString("en-IN", { maximumSignificantDigits: 4, maximumFractionDigits: 20 }).replace("-", "−");
  return (Object.is(r, -0) ? 0 : r).toLocaleString("en-IN", { maximumFractionDigits: dp }).replace("-", "−");
};

// Read a number typed by a student: allows spaces, commas as thousands, a leading minus or the
// Unicode minus, and simple fractions such as 1/3. Returns NaN when it is not a number.
export const parseNum = (s) => {
  if (typeof s === "number") return s;
  const t = String(s ?? "").trim().replace(/,/g, "").replace(/−/g, "-");
  if (t === "") return NaN;
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t) ? Number(t) : NaN;
};

// Seeded random numbers (mulberry32), so a class can repeat the same simulation.
export const rng = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Standard normal distribution.
// Φ(z): West's double-precision version of the Hart algorithm (error below 1e-14).
export const normCdf = (z) => {
  const x = Math.abs(z);
  let c;
  if (x > 37) c = 0;
  else {
    const e = Math.exp(-x * x / 2);
    if (x < 7.07106781186547) {
      let n = 3.52624965998911e-2 * x + 0.700383064443688;
      n = n * x + 6.37396220353165; n = n * x + 33.912866078383; n = n * x + 112.079291497871;
      n = n * x + 221.213596169931; n = n * x + 220.206867912376;
      let d = 8.83883476483184e-2 * x + 1.75566716318264;
      d = d * x + 16.064177579207; d = d * x + 86.7807322029461; d = d * x + 296.564248779674;
      d = d * x + 637.333633378831; d = d * x + 793.826512519948; d = d * x + 440.413735824752;
      c = e * n / d;
    } else {
      let b = x + 0.65; b = x + 4 / b; b = x + 3 / b; b = x + 2 / b; b = x + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return z > 0 ? 1 - c : c;
};

// Φ⁻¹(p): Acklam's algorithm with one Newton step (error below 1e-12).
export const normInv = (p) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let x;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - lo) {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
};
