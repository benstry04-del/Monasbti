import test from "node:test";
import assert from "node:assert/strict";
import { minor, totals, couponDiscount, installmentMinors } from "../src/money.mjs";
test("KWD uses integer fils and preserves a configurable fractional discount and tax", () => {
  assert.equal(minor("0.001"), 1);
  assert.equal(totals([{ price: 0.1, cost: 0.05, qty: 3 }]).total, 0.3);
  assert.equal(
    couponDiscount([{ price: 100, cost: 60, qty: 1 }], { percent: 12.5 }),
    12.5,
  );
  const n = totals([{ price: 100, cost: 60, qty: 1 }], 12.5, 0, 5);
  assert.equal(n.taxMinor, 4375);
  assert.equal(n.totalMinor, 91875);
});
test("money parser rejects excess precision, invalid quantities and unsafe amounts", () => {
  for (const x of ["0.0001", "1e3", "NaN", "Infinity"])
    assert.throws(() => minor(x));
  assert.throws(() => totals([{ price: 1, qty: 1.1 }]));
});
test("installments allocate every fils once and the final balance absorbs rounding",()=>{
  const parts=installmentMinors('100.001',[30,40,30]);
  assert.deepEqual(parts,[30000,40000,30001]);
  assert.equal(parts.reduce((sum,n)=>sum+n,0),100001);
  assert.throws(()=>installmentMinors(100,[30,40,40]));
});
