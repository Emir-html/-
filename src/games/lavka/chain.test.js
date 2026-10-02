/* Тесты уровня 3 «Сеть кофеен» (сценарий «Путь компании»): node --test chain.test.js
   Две кофейни с местами (λ), две кухни (MC₁ = MC₂), Зоя («сделать или купить»), скидка на все единицы, вход Семёна,
   правило закрытия по устранимым издержкам, min AC кухни 1, экзамен. */
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "./chain.js";
import * as F from "./fair.js";
import * as K from "./capital.js";
import * as L from "./model.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const st0 = () => C.chainNewState(1e5);
const plan = (st, day) => C.chainPlan(C.chainDay(st, day));

test("будни недели 1: N 140 × 130 (λ_N = 26), T 100 × 80, кухни 40 / 160, Зоя 40, маржа 20 040", () => {
  const p = plan(st0(), 4);
  assert.equal(p.qN, 140); near(p.PN, 130); assert.equal(p.qT, 100); near(p.PT, 80);
  assert.deepEqual(p.q, [40, 160]); assert.equal(p.z, 40); near(p.mc, 34); near(p.lambdaN, 26);
  near(p.varMargin, 20040);
});

test("пятница λ_N = 38,7; суббота: T пустеет (54 × 76,8), N 146,2, своя выпечка без Зои", () => {
  const fri = plan(st0(), 5); near(fri.PN, 136.36, 0.01); near(fri.lambdaN, 38.7, 0.05); near(fri.varMargin, 20931, 1);
  const sat = plan(st0(), 6); assert.equal(sat.qT, 54); near(sat.PN, 146.15, 0.01); assert.equal(sat.z, 0); near(sat.lambdaN, 58.7, 0.1);
});

test("Семён напротив (A ×0,8, B ×1,1): места больше не дефицит, маржа 13 432; с закрытой кухней 1 — 13 352", () => {
  const p = plan(st0(), 11);
  assert.equal(p.qN, 123); near(p.lambdaN, 0); near(p.varMargin, 13432, 1);
  near(plan({ ...st0(), k1Closed: true }, 11).varMargin, 13352, 1);
});

test("правило закрытия T: вклад 4 770 сверх выпечки > бариста 1 500 → оставить (с закрытой кухней 1: 3 190)", () => {
  const t = C.chainTContribution(C.chainDay(st0(), 11));
  near(t.beforeBarista, 4770, 1); near(t.contribution, 3270, 1);
  near(C.chainTContribution(C.chainDay({ ...st0(), k1Closed: true }, 11)).contribution, 3190, 1);
});

test("кухня 1: min AC = 50 ₽ при 200 порциях > цены Зои 34 — сдать; MC₁ = MC₂ = цене Зои", () => {
  const m = C.chainK1MinAC(); near(m.q, 200); near(m.ac, 50);
  const p = plan(st0(), 4);
  near(C.chainMC(C.CHAIN.kitchens[0], p.q[0]), 34); near(C.chainMC(C.CHAIN.kitchens[1], p.q[1]), 34);
});

test("Зоя 38 ₽ (с 17-го): кухня 2 печёт до MC = 38 (187), Зоя 31; N 91,8", () => {
  const p = plan({ ...st0(), k1Closed: true }, 18);
  assert.equal(p.q[1], 187); assert.equal(p.z, 31); near(p.PN, 91.8, 0.1); near(p.varMargin, 13164, 1);
});

test("скидка на все единицы: от 250 своих порций выгодно испечь и с излишком (MC следующей продажи = 0)", () => {
  const p = plan(st0(), 8);
  assert.equal(p.own, 250); assert.ok(p.own > p.Q, "часть порций пропадёт — но скидка 2 ₽ на все 250 окупает");
  assert.ok(p.varMargin > 20040);
  const t = plan({ ...st0(), terrace: true }, 8); assert.equal(t.qN, 166); assert.equal(t.own, 250);
});

test("день сети: прибыль = выручка − выпечка − Зоя − устранимые − неустранимые; T закрыта — бариста не платится", () => {
  const st = { ...st0(), day: 4, pN: 130, pT: 80, q: [40, 160] };
  const { report } = C.chainSimulate(st, () => 0.5);
  near(report.revenue, 140 * 130 + 100 * 80); near(report.z, 40); near(report.zoyaCost, 1360);
  near(report.profit, report.revenue - report.ownCost - 1360 - 5000 - 8000);
  const closed = C.chainSimulate({ ...st0(), day: 11, tOpen: false, pN: 90, q: [40, 160] }, () => 0.5).report;
  near(closed.avoid, 1500 + 2000); near(closed.sold[1], 0);
  assert.equal(C.chainSetT({ ...st0(), day: 5 }, false).tOpen, true, "до 11-го дня T не закрыть");
});

test("цели: MC₁ = MC₂ в неделю 1, «невозвратные» на 12-й, «долгий период» при сдаче кухни 1", () => {
  const r1 = C.chainSimulate({ ...st0(), day: 4, pN: 130, pT: 80, q: [40, 160] }, () => 0.5).report;
  assert.ok(r1.newGoals.includes("multiplant")); assert.ok(r1.newGoals.includes("makebuy")); assert.ok(r1.newGoals.includes("seats"));
  /* «Невозвратные издержки» — только после явного решения на 12-й день (по умолчанию T открыта — этого мало). */
  const d12 = { ...st0(), day: 12, chapter: 2, pN: 90, pT: 80, q: [40, 160] };
  assert.ok(!C.chainSimulate(d12, () => 0.5).report.newGoals.includes("sunk"));
  const kept = C.chainDecideT(d12, "keep");
  assert.ok(kept.tDecision.right); assert.ok(C.chainSimulate(kept, () => 0.5).report.newGoals.includes("sunk"));
  const closedT = C.chainDecideT(d12, "close");
  assert.ok(!closedT.tDecision.right); assert.ok(closedT.tClosed); assert.equal(C.chainSetT(closedT, true).tOpen, false);
  const closed = C.chainCloseK1({ ...st0(), day: 14, chapter: 2 });
  assert.ok(closed.k1Closed);
  assert.ok(C.chainSimulate({ ...closed, pN: 90, q: [0, 160] }, () => 0.5).report.newGoals.includes("kitchen1"));
});

test("вердикт: очередь в N при низкой цене — «продешевил»; кухня дороже Зои — подсказка", () => {
  const r = C.chainSimulate({ ...st0(), day: 4, pN: 110, pT: 80, q: [100, 160] }, () => 0.5).report;
  const v = C.chainVerdict(r, []);
  assert.match(v, /продешевил/); assert.match(v, /Зоя печёт за 34/);
});

test("вердикт не ругает оптимум: кухня 1 сдана (0 / 160 + Зоя) и порог скидки (70 / 180)", () => {
  const closed = { ...st0(), day: 15, chapter: 3, k1Closed: true, pN: 90, pT: 80, q: [0, 160] };
  assert.ok(!/Кухня могла печь дешевле/.test(C.chainVerdict(C.chainSimulate(closed, () => 0.5).report, [])));
  const tier = C.chainVerdict(C.chainSimulate({ ...st0(), day: 8, chapter: 2, pN: 130, pT: 80, q: [70, 180] }, () => 0.5).report, []);
  assert.ok(!/Зачем ты печёшь/.test(tier)); assert.match(tier, /ВСЕ единицы/);
});

test("цель «Новая граница» достижима и при открытой кухне 1 (оптимум 53 / 168 без Зои)", () => {
  const p = plan(st0(), 18);
  const r = C.chainSimulate({ ...st0(), day: 18, chapter: 3, pN: Math.round(p.PN), pT: Math.round(p.PT), q: p.q }, () => 0.5).report;
  assert.ok(r.newGoals.includes("zoya38"), JSON.stringify(p.q));
});

/* ===== Экзамен ===== */
const examChain = () => ({ ...st0(), day: 22, chapter: 3 });

test("экзамен: 3 дня, детерминирован сидом; эталон = 100%; T и Заводская — решения примерно 50/50", () => {
  const c = examChain();
  assert.equal(C.chainExamOpen(c), true);
  const e = C.chainExamNew(c, 3);
  assert.deepEqual(e.days.map((d) => d.kind), ["monday", "festival", "practice"]);
  assert.deepEqual(e.days, C.chainExamNew(c, 3).days);
  let ex = e;
  for (const d of e.days) ex = C.chainExamPlayDay(c, ex, C.chainExamBest(d)).exam;
  near(C.chainExamResult(ex).eff, 1, 1e-6);
  let closedT = 0, k1mon = 0, k1fest = 0;
  for (let s = 0; s < 40; s++) {
    const ds = C.chainExamNew(c, 100 + s).days;
    if (!C.chainExamBest(ds[2]).tOpen) closedT++; if (C.chainExamBest(ds[0]).k1Open) k1mon++; if (C.chainExamBest(ds[1]).k1Open) k1fest++;
  }
  assert.ok(closedT >= 10 && closedT <= 30, `T закрыта в ${closedT} из 40 — решение не угадывается`);
  assert.equal(k1mon, 0, "в понедельник Заводская не нужна: min AC > цены Зои");
  assert.ok(k1fest >= 10 && k1fest <= 30, `на фестивале без Зои Заводская нужна: ${k1fest} из 40`);
});

test("экзамен: «цены как в неделю 1, обе кухни, T открыта» — без серебра", () => {
  const c = examChain();
  let silver = 0;
  for (let s = 0; s < 40; s++) {
    let ex = C.chainExamNew(c, 200 + s);
    for (const d of ex.days) ex = C.chainExamPlayDay(c, ex, { pN: 130, pT: 80, q: [40, 160], tOpen: true, k1Open: true }).exam;
    const r = C.chainExamResult(ex);
    if (r && r.medal && r.medal.id !== "bronze") silver++;
  }
  assert.equal(silver, 0);
});

test("переход с уровня 2 через capital.js; дочки копятся", () => {
  const f = { ...F.fairNewState(1e5), subsidiaries: [{ name: "Лавка", dividend: 900, daysLeft: 70 }] };
  assert.equal(C.levelFinish2({ level: 2, fair: f }, "sell"), null);
  f.examBest = { eff: 0.9, medal: "silver", piBot: 5000, attempts: 1 };
  const kept = C.levelFinish2({ level: 2, fair: f }, "keep");
  assert.equal(kept.level, 3); assert.equal(kept.chain.subsidiaries.length, 2);
  assert.equal(kept.chain.subsidiaries[1].dividend, Math.round(0.3 * 0.9 * 5000)); assert.equal(kept.chain.subsidiaries[1].daysLeft, 72);
  const sold = C.levelFinish2({ level: 2, fair: f }, "sell");
  assert.equal(sold.chain.cash, K.CAPITAL.grant[3] + Math.round(K.capitalSalePrice(2, "silver")));
});
