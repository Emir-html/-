/* Тесты общего капитала «Пути компании»: node --test capital.test.js */
import test from "node:test";
import assert from "node:assert/strict";
import * as K from "./capital.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("аннуитет при 2%: a(14) = 12,106; a(30) = 22,396; a(48) = 30,673; a(72) = 37,984; a(96) = 42,529", () => {
  near(K.annuity(14), 12.106, 1e-3); near(K.annuity(30), 22.396, 1e-3); near(K.annuity(48), 30.673, 1e-3);
  near(K.annuity(72), 37.984, 1e-3); near(K.annuity(96), 42.529, 1e-3);
});

test("множитель потока: N дней дивидендов + продажа в финале за a(30), дисконтированная на N дней", () => {
  for (const L of [1, 2, 3, 4]) {
    const N = K.CAPITAL.horizon[L];
    let pv = 0;
    for (let t = 1; t <= N + 30; t++) pv += 1 / 1.02 ** t; // поток длиной N + 30 дней
    near(K.capitalFactor(L), pv, 1e-9);
  }
});

test("держать или продать: одна ставка и горизонт; держать выгоднее ⇔ e·π̄_эт > ē(медаль)·π̄_город", () => {
  const city = K.CITY_PROFIT[1];
  const strong = K.capitalCompare(1, "silver", 0.9, city * 1.5), weak = K.capitalCompare(1, "silver", 0.9, city * 0.6);
  assert.ok(strong.keepBetter); assert.ok(!weak.keepBetter);
  near(K.capitalCompare(1, "silver", 0.9, city).keepPV, K.capitalSalePrice(1, "silver"), 1e-6);
});

test("рынок лимонов: π̄_город — средняя продающих, ниже средней по всем", () => {
  const samples = [3000, 4000, 5000, 7000, 9000, 12000, 20000].map((pi) => ({ medal: "silver", eff: 0.9, piBot: pi }));
  const mean = samples.reduce((s, x) => s + x.piBot, 0) / samples.length;
  const city = K.capitalCityFixedPoint(samples);
  assert.ok(city < mean, `${city} < ${mean}`);
  const sellers = samples.filter((x) => x.eff * x.piBot <= 0.9 * city + 1e-9);
  assert.ok(sellers.length > 0);
  /* Неподвижная точка: средняя продающих (в единицах ē) совпадает с ценой — или рынок сжался до самых слабых. */
  const avg = sellers.reduce((s, x) => s + (x.eff * x.piBot) / 0.9, 0) / sellers.length;
  assert.ok(Math.abs(avg - city) < 1 || city === Math.min(...samples.map((x) => x.piBot)));
});

test("переход: без медали — null; продажа кладёт цену в кассу, дочка получает D = s·e·π̄_эт на N дней", () => {
  assert.equal(K.capitalTransition(1, { eff: 0.5, medal: null, piBot: 5000 }, "sell", "Лавка"), null);
  const ex = { eff: 0.9, medal: "silver", piBot: 6000 };
  const sold = K.capitalTransition(1, ex, "sell", "Лавка");
  assert.equal(sold.cash, K.CAPITAL.grant[2] + Math.round(K.capitalSalePrice(1, "silver")));
  assert.equal(sold.subsidiary, null);
  const kept = K.capitalTransition(1, ex, "keep", "Лавка");
  assert.equal(kept.cash, K.CAPITAL.grant[2]);
  assert.equal(kept.subsidiary.dividend, Math.round(0.3 * 0.9 * 6000)); assert.equal(kept.subsidiary.daysLeft, 96);
  const pay = K.capitalPayDividends([kept.subsidiary, { dividend: 100, daysLeft: 0 }]);
  assert.equal(pay.dividend, kept.subsidiary.dividend); assert.equal(pay.subsidiaries[0].daysLeft, 95);
});

test("калибровка: π̄_город уровней 2 и 4 — неподвижная точка лимонов на π̄_эт экзамена (≈ 0,908·π̄_эт)", async () => {
  const F = await import("./fair.js"), P = await import("./factory.js");
  const samples = (pi) => {
    const out = [];
    for (const [m, lo, hi] of [["gold", 0.95, 1], ["silver", 0.85, 0.95], ["bronze", 0.7, 0.85]])
      for (let i = 0; i < 20; i++) out.push({ medal: m, eff: lo + ((hi - lo) * (i + 0.5)) / 20, piBot: pi });
    return out;
  };
  const pi2 = F.fairExamExpectedProfit({ ...F.fairNewState(), day: 22, chapter: 3 }), pi4 = P.factoryExamExpectedProfit();
  near(K.capitalCityFixedPoint(samples(pi2)), K.CITY_PROFIT[2], 1); near(K.capitalCityFixedPoint(samples(pi4)), K.CITY_PROFIT[4], 1);
  /* Серебро с e = 0,9 держит выгоднее, слабая бронза (e = 0,70) — продаёт. */
  assert.ok(K.capitalCompare(2, "silver", 0.9, pi2).keepBetter); assert.ok(!K.capitalCompare(2, "bronze", 0.7, pi2).keepBetter);
});
