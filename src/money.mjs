// KWD has three minor-unit digits. Decimal strings are parsed before arithmetic.
export function minor(value) {
  const text = String(value);
  if (!/^-?\d+(?:\.\d{1,3})?$/.test(text))
    throw Error("Money must have at most three decimal places");
  const negative = text.startsWith("-"),
    [whole, fraction = ""] = text.replace("-", "").split(".");
  const n = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(n)) throw Error("Money outside safe range");
  return negative ? -n : n;
}
export function roundedMinor(value) {
  if (!Number.isFinite(Number(value))) throw Error("Invalid money");
  return minor(Number(value).toFixed(3));
}
export const major = (n) => n / 1000;
export function installmentMinors(total, schedule) {
  if (!Array.isArray(schedule) || schedule.length !== 3 ||
      schedule.some(n => !Number.isFinite(n) || n < 0) ||
      schedule.reduce((sum,n) => sum+n,0) !== 100) throw Error("Invalid payment schedule");
  const amount = roundedMinor(total);
  const first = Math.round(amount * schedule[0] / 100);
  const second = Math.round(amount * schedule[1] / 100);
  return [first, second, amount - first - second];
}
export function totals(lines, discount = 0, fees = 0, taxRate = 0) {
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
    throw Error("Invalid tax rate");
  let subtotalMinor = 0,
    costMinor = 0,
    known = true;
  for (const l of lines) {
    if (!Number.isSafeInteger(l.qty) || l.qty < 1)
      throw Error("Invalid quantity");
    subtotalMinor += roundedMinor(l.price) * l.qty;
    if (l.cost == null) known = false;
    else costMinor += roundedMinor(l.cost) * l.qty;
  }
  const discountMinor = roundedMinor(discount),
    feeMinor = roundedMinor(fees);
  const netMinor = Math.max(0, subtotalMinor - discountMinor + feeMinor),
    taxMinor = Math.round((netMinor * Math.round(taxRate * 100)) / 10000),
    totalMinor = netMinor + taxMinor;
  if (![subtotalMinor, costMinor, totalMinor].every(Number.isSafeInteger))
    throw Error("Money outside safe range");
  return {
    subtotal: major(subtotalMinor),
    total: major(totalMinor),
    cost: known ? major(costMinor) : null,
    profit: known ? major(netMinor - costMinor) : null,
    margin:
      known && netMinor ? ((netMinor - costMinor) / netMinor) * 100 : null,
    tax: major(taxMinor),
    taxRate,
    totalMinor,
    subtotalMinor,
    discountMinor,
    taxMinor,
    netMinor,
  };
}
export function couponDiscount(lines, coupon) {
  return major(
    Math.round(
      (totals(lines).subtotalMinor * Number(coupon?.percent || coupon || 0)) /
        100,
    ),
  );
}
