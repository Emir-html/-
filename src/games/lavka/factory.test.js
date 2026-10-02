/* Тесты уровня 4 «Своё производство» (цех «Заря», сценарий «Путь компании»): node --test factory.test.js
   Убывающая отдача, монопсония (MRC > w), договор и МРОТ как нижняя граница зарплаты, пик цены, котёл по PV на срок службы. */
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "./factory.js";
import * as C from "./chain.js";
import * as K from "./capital.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const pi = (L, o) => P.factoryLaborMargin(L, o) - P.FACTORY.shopRent - P.FACTORY.boiler.rent;

test("производство: Q(L) = 14L − 0,25L², MP = 14 − 0,5L; таблица найма сценария (p = 300, аренда котла)", () => {
  near(P.factoryQ(14), 147); near(P.factoryQ(16), 160); near(P.factoryMP(14), 7);
  near(pi(12, { p: 300 }), 14200); near(pi(14, { p: 300 }), 14900); near(pi(15, { p: 300 }), 14875); near(pi(18, { p: 300 }), 13300);
});

test("монопсония: целочисленный оптимум 14 по 1 300; дискретно MRP(15) = 2 025 < MRC(15) = 2 050; конкурентный ориентир 18 по 1 500", () => {
  assert.equal(P.factoryBestL({ p: 300 }), 14); near(P.factoryWage(14), 1300);
  const s15 = P.factoryStep(15, { p: 300 }), s14 = P.factoryStep(14, { p: 300 });
  near(s15.mrp, 2025); near(s15.mrc, 2050); near(s14.mrp, 2175); near(s14.mrc, 1950);
  const comp = P.factoryCompetitive(); near(comp.L, 18); near(comp.w, 1500);
});

test("граница 1 400 (договор или МРОТ): MRC плоская до 16 — занятость растёт 14 → 16, прибыль 14 600 (с 14 — 13 500)", () => {
  assert.equal(P.factoryBestL({ p: 300, floor: 1400 }), 16);
  near(pi(16, { p: 300, floor: 1400 }), 14600); near(pi(14, { p: 300, floor: 1400 }), 13500);
  /* МРОТ выше MRP при монопсоническом найме — занятость ниже 14 (1 600 → 17; 2 300 → 13 по дискретному MRP, в сценарии 12 — по непрерывному). */
  assert.equal(P.factoryBestL({ p: 300, floor: 1600 }), 17); assert.equal(P.factoryBestL({ p: 300, floor: 2300 }), 13); // дискретно: p·ΔQ(13) = 2 325 ≥ 2 300 > p·ΔQ(14) = 2 175
});

test("пик p = 380: оптимум 16 (27 400), 17-й требует 1 450 всем (27 335)", () => {
  assert.equal(P.factoryBestL({ p: 380, floor: 1400 }), 16);
  near(pi(16, { p: 380, floor: 1400 }), 27400); near(pi(17, { p: 380, floor: 1400 }), 27335);
});

test("котёл: PV на 48 дней службы — при 2% купить дешевле на 4 164, при 3% аренда дешевле на 56 620; б/у стоит PV сбережений", () => {
  const b2 = P.factoryBoilerMath(0.02), b3 = P.factoryBoilerMath(0.03);
  near(b2.pvRent, 245385, 1); near(b2.pvBuy, 241221, 1); assert.ok(b2.buyBetter);
  near(b3.pvRent, 202134, 1); near(b3.pvBuy, 258754, 1); assert.ok(!b3.buyBetter);
  /* Цена нового котла на рынке б/у (V(48)) − цена покупки = выигрыш от покупки: решение не зависит от дня покупки. */
  near(P.factoryBoilerValue(48) - P.FACTORY.boiler.price, b2.saving, 1e-6);
});

test("день цеха: прибыль = p·Q − w·L − цех − котёл; граница с Д10 при договоре и с Д16 всегда; пик с Д19", () => {
  const st = { ...P.factoryNewState(1e5), L: 14 };
  const { next, report } = P.factorySimulate(st);
  near(report.profit, 14900); assert.equal(next.day, 2);
  assert.equal(P.factoryFloor({ ...st, day: 10, contract: true }), 1400); assert.equal(P.factoryFloor({ ...st, day: 12 }), 0);
  assert.equal(P.factoryFloor({ ...st, day: 16 }), 1400); assert.equal(P.factoryPrice(19), 380);
  const owned = P.factoryBuyBoiler({ ...st, day: 8 });
  assert.equal(owned.cash, 1e5 - 280000); near(P.factorySimulate(owned).report.boilerCost, 500);
});

test("котёл продаётся в последний день уровня по рыночной цене б/у", () => {
  const st = { ...P.factoryNewState(1e5), day: 21, chapter: 3, L: 16, boiler: { day: 8, good: true } };
  const out = P.factorySimulate(st);
  near(out.report.resale, Math.round(P.factoryBoilerValue(48 - 14)));
  assert.ok(out.next.boiler.sold);
});

test("цели: монопсония до границы, МРОТ (16), пик (16), котёл при 2%", () => {
  assert.ok(P.factorySimulate({ ...P.factoryNewState(), L: 14 }).report.newGoals.includes("monopsony"));
  assert.ok(!P.factorySimulate({ ...P.factoryNewState(), L: 15 }).report.newGoals.includes("monopsony"));
  assert.ok(P.factorySimulate({ ...P.factoryNewState(), day: 16, chapter: 3, L: 16 }).report.newGoals.includes("minwage"));
  assert.ok(P.factorySimulate({ ...P.factoryNewState(), day: 19, chapter: 3, L: 16 }).report.newGoals.includes("peak"));
  assert.ok(P.factorySimulate(P.factoryBuyBoiler({ ...P.factoryNewState(), day: 8 })).report.newGoals.includes("boiler"));
});

test("договор Нины на 10-й и письмо на 13-й: предложения и ответы", () => {
  let st = { ...P.factoryNewState(1e5), day: 9, L: 14 };
  st = P.factorySimulate(st).next; assert.equal(st.offer, "contract");
  st = P.factoryAnswer(st, "contract", true); assert.equal(st.contract, true); assert.equal(P.factoryFloor(st), 1400);
  st = { ...st, day: 12 }; st = P.factorySimulate(st).next; assert.equal(st.offer, "letter");
  const signed = P.factoryAnswer(st, "letter", true); assert.equal(signed.cash, st.cash - 15000); assert.ok(signed.flags.foughtMinWage);
});

test("вердикт: при L = 0 — без фразы про 0-го работника; при 14 — «сходится»", () => {
  const v0 = P.factoryVerdict(P.factorySimulate({ ...P.factoryNewState(), L: 0 }).report);
  assert.ok(!/0-й работник/.test(v0));
  assert.match(P.factoryVerdict(P.factorySimulate({ ...P.factoryNewState(), L: 14 }).report), /Сходится/);
});

/* ===== Экзамен ===== */
test("экзамен: 3 сценария, детерминирован; эталон 100%; МРОТ иногда выше MRP(L_m); котёл зависит от ставки", () => {
  const f = { ...P.factoryNewState(), day: 22, chapter: 3 };
  assert.equal(P.factoryExamOpen(f), true);
  const e = P.factoryExamNew(f, 11);
  assert.deepEqual(e.days.map((d) => d.kind), ["monopsony", "minwage", "boiler"]);
  assert.deepEqual(e.days, P.factoryExamNew(f, 11).days);
  let ex = e;
  for (const d of e.days) ex = P.factoryExamPlayDay(f, ex, P.factoryExamBest(d)).exam;
  near(P.factoryExamResult(ex).eff, 1);
  let below = 0, buy = 0, rent = 0;
  for (let s = 0; s < 60; s++) {
    const ds = P.factoryExamNew(f, 100 + s).days;
    if (P.factoryExamBest(ds[1]).L < P.factoryExamBest({ ...ds[1], kind: "monopsony", floor: 0 }).L) below++;
    if (P.factoryExamBest(ds[2]).buy) buy++; else rent++;
  }
  assert.ok(below > 0, "иногда МРОТ выше MRP при монопсоническом найме"); assert.ok(buy > 0 && rent > 0);
});

test("экзамен: «всегда 14, аренда» и «всегда 18 (MRP = w), аренда» — серебро не чаще 5%", () => {
  const f = { ...P.factoryNewState(), day: 22, chapter: 3 };
  for (const L of [14, 18]) {
    let silver = 0;
    for (let s = 0; s < 60; s++) {
      let ex = P.factoryExamNew(f, 300 + s);
      for (const d of ex.days) ex = P.factoryExamPlayDay(f, ex, { L, buy: false }).exam;
      const r = P.factoryExamResult(ex);
      if (r.medal && r.medal.id !== "bronze") silver++;
    }
    assert.ok(silver <= 3, `«всегда ${L}»: серебро в ${silver} из 60`);
  }
});

test("переход с уровня 3 через capital.js; дочки копятся", () => {
  const c = C.chainNewState(1e5);
  assert.equal(P.levelFinish3({ level: 3, chain: c }, "sell"), null);
  const chain = { ...c, examBest: { eff: 0.9, medal: "silver", piBot: 3000, attempts: 1 }, subsidiaries: [{ name: "Ярмарка", dividend: 1500, daysLeft: 40 }] };
  const kept = P.levelFinish3({ level: 3, chain }, "keep");
  assert.equal(kept.level, 4); assert.equal(kept.factory.subsidiaries.length, 2); assert.equal(kept.factory.subsidiaries[1].daysLeft, 48);
  const sold = P.levelFinish3({ level: 3, chain }, "sell");
  assert.equal(sold.factory.cash, K.CAPITAL.grant[4] + Math.round(K.capitalSalePrice(3, "silver")));
});
