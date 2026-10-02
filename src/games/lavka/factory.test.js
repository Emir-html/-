/* Тесты уровня 4 «Своё производство»: node --test factory.test.js
   Найм (MRP = w), монопсония (MRP = MRC > w), МРОТ повышает занятость, аренда против покупки печи через NPV. */
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "./factory.js";
import * as C from "./chain.js";
import * as L from "./model.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const { price, a, b } = P.FACTORY;

test("производство: f(L) = aL − bL², MPL = a − 2bL, MRP = P·MPL", () => {
  near(P.factoryQ(10), a * 10 - b * 100);
  near(P.factoryMPL(10), a - 2 * b * 10);
  near(P.factoryMRP(10, price), price * (a - 2 * b * 10));
});

test("конкурентный рынок труда: MRP = w → L* = (a − w/P)/(2b)", () => {
  near(P.factoryLabor({ market: "competitive", w: 2000 }).L, (a - 2000 / price) / (2 * b));
  near(P.factoryLabor({ market: "competitive", w: 2000 }).L, 20);
});

test("монопсония: MRC = c + 2dL > w, оптимум MRP = MRC; зарплата и занятость ниже конкурентных", () => {
  const m = P.factoryLabor({ market: "monopsony" });
  near(m.L, 14); near(m.w, 1550);
  const L0 = 14;
  assert.ok(P.factoryMRC(L0) > P.factorySupplyW(L0));
  const comp = P.factoryCompetitiveEq();
  near(comp.L, 20); near(comp.w, 2000);
  assert.ok(m.L < comp.L && m.w < comp.w);
});

test("МРОТ между монопсонической и конкурентной зарплатой повышает занятость (зеркало потолка цены)", () => {
  const mono = P.factoryLabor({ market: "monopsony" });
  const mw = P.factoryLabor({ market: "monopsony", wMin: 1800 });
  near(mw.w, 1800);
  near(mw.L, (1800 - P.FACTORY.supplyC) / P.FACTORY.supplyD); // упор в предложение труда
  assert.ok(mw.L > mono.L);
  const high = P.factoryLabor({ market: "monopsony", wMin: 2600 });
  assert.ok(high.L < P.factoryCompetitiveEq().L, "слишком высокий МРОТ снижает занятость (MRP = МРОТ)");
});

test("печь: аренда против покупки по NPV при ставке r", () => {
  const o = P.factoryOvenMath();
  const r = P.FACTORY.rate, N = P.FACTORY.ovenDays;
  near(o.pvRent, P.FACTORY.ovenRent * (1 - (1 + r) ** -N) / r);
  near(o.pvBuy, P.FACTORY.ovenPrice - P.FACTORY.ovenSalvage / (1 + r) ** N);
  assert.equal(o.buyBetter, o.pvBuy < o.pvRent);
  assert.ok(o.buyBetter, "при этих числах купить дешевле");
});

test("день пекарни: выручка P·f(L), зарплата по рынку или предложению, печь — аренда или куплена", () => {
  let st = P.factoryNewState(1e5); st.L = 20;
  const { next, report } = P.factorySimulate(st, L.lavkaRng(1));
  near(report.wage, 2000);
  near(report.profit, report.P * P.factoryQ(20) - 2000 * 20 - P.FACTORY.ovenRent);
  assert.equal(next.day, 2);
  st = P.factoryBuyOven({ ...P.factoryNewState(1e5) });
  assert.ok(st.ovenOwned); assert.equal(st.cash, 1e5 - P.FACTORY.ovenPrice);
  const r2 = P.factorySimulate({ ...st, L: 20 }, L.lavkaRng(1)).report;
  near(r2.oven, 0);
});

test("главы по дням: монопсония с 8-го, МРОТ с 15-го; цели — правильная занятость", () => {
  let st = P.factoryNewState(1e5); st.day = 7; st.L = 20;
  const out = P.factorySimulate(st, L.lavkaRng(2));
  assert.ok(out.report.newGoals.includes("mrp")); assert.equal(out.next.chapter, 2);
  st = { ...out.next, L: 14 };
  const r2 = P.factorySimulate(st, L.lavkaRng(3)).report;
  near(r2.wage, 1550); assert.ok(r2.newGoals.includes("monopsony"));
  st = { ...P.factoryNewState(1e5), day: 15, chapter: 3, L: 17 };
  const r3 = P.factorySimulate(st, L.lavkaRng(4)).report;
  near(r3.wage, 1800); assert.ok(r3.newGoals.includes("minwage"));
});

test("переход с уровня 3: только с медалью экзамена сети; дочки копятся", () => {
  const c = C.chainNewState(1e5);
  const st = { level: 3, chain: c };
  assert.equal(P.levelFinish3(st, "sell"), null);
  st.chain = { ...c, examBest: { eff: 0.9, medal: "silver", attempts: 1 }, subsidiaries: [{ name: "Ярмарка", dividend: 2200, daysLeft: 10 }] };
  const kept = P.levelFinish3(st, "keep");
  assert.equal(kept.level, 4); assert.equal(kept.factory.subsidiaries.length, 2);
  assert.equal(kept.factory.subsidiaries[1].dividend, P.LEVEL3_DIVIDEND.silver);
  const sold = P.levelFinish3(st, "sell");
  assert.equal(sold.factory.cash, P.FACTORY.grant + Math.round(P.factorySalePrice3("silver")));
});
