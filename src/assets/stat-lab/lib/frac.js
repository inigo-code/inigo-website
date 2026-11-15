// Exact fractions (BigInt numerator and denominator), so a matrix inverse shows 3/7, not 0.428571.

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };

export class F {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new RangeError("division by zero");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  static of(x) { return x instanceof F ? x : F.parse(String(x)); }
  // "3", "-2.5", "−1/3", "1,200", "1e3". Returns null when the text is not a number.
  static parse(text) {
    const t = String(text ?? "").trim().replace(/,/g, "").replace(/−/g, "-");
    let m = t.match(/^(-?)(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const a = F.parse(m[2]), b = F.parse(m[3]);
      if (!a || !b || b.isZero()) return null;
      const r = a.div(b);
      return m[1] ? r.neg() : r;
    }
    m = t.match(/^(-?)(\d*)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
    if (!m || (m[2] === "" && !m[3])) return null;
    const digits = (m[2] || "0") + (m[3] || ""), scale = (m[3] || "").length - Number(m[4] || 0);
    let n = BigInt(digits), d = 1n;
    if (scale > 0) d = 10n ** BigInt(scale); else n *= 10n ** BigInt(-scale);
    return new F(m[1] ? -n : n, d);
  }
  add(o) { o = F.of(o); return new F(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = F.of(o); return new F(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = F.of(o); return new F(this.n * o.n, this.d * o.d); }
  div(o) { o = F.of(o); return new F(this.n * o.d, this.d * o.n); }
  neg() { return new F(-this.n, this.d); }
  isZero() { return this.n === 0n; }
  isInt() { return this.d === 1n; }
  eq(o) { o = F.of(o); return this.n === o.n && this.d === o.d; }
  sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
  toNumber() { return Number(this.n) / Number(this.d); }
  // "−3/7" with a true minus sign.
  toString() {
    const s = this.d === 1n ? (this.n < 0n ? -this.n : this.n).toString() : `${this.n < 0n ? -this.n : this.n}/${this.d}`;
    return this.n < 0n ? `−${s}` : s;
  }
  // The decimal value, when the fraction does not end: "3/7 ≈ 0.4286".
  approx(dp = 4) {
    if (this.isInt()) return null;
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    const x = this.toNumber();
    const exact = d === 1n && Number(x.toFixed(dp)) === x;
    return { text: (Math.round(x * 10 ** dp) / 10 ** dp).toLocaleString("en-IN", { maximumFractionDigits: dp }).replace("-", "−"), exact };
  }
}

export const ZERO = new F(0n), ONE = new F(1n);
