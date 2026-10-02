/* Тесты уровня 3 «Сеть кофеен»: node --test chain.test.js
   Две кухни (MR = MC₁ = MC₂), спад и закрытие (короткий и длинный период), оптовая скидка и мощность, переход с уровня 2. */
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "./chain.js";
import * as F from "./fair.js";
import * as L from "./model.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("издержки кухни: MC = w + base + 2b·q, AVC = w + base + b·q, VC = (w + base)·q + b·q²", () => {
  const k = C.CHAIN.kitchens[0];
  near(C.chainMC(k, 10, 20), 20 + k.base + 2 * k.b * 10);
  near(C.chainVC(k, 10, 20), (20 + k.base) * 10 + k.b * 100);
  near(C.chainVC(k, 10, 20) / 10, 20 + k.base + k.b * 10);
});

test("две кухни: оптимум MR = MC₁ = MC₂ (без скидки и упора в мощность)", () => {
  const plan = C.chainPlan({ A: 300, w: 20, open: [true, true], caps: [999, 999], discount: false });
  const [k1, k2] = C.CHAIN.kitchens;
  const mr = 300 - 2 * plan.Q;
  near(mr, C.chainMC(k1, plan.q[0], 20), 0.05); near(mr, C.chainMC(k2, plan.q[1], 20), 0.05);
  near(plan.Q, 3 * (620 / 7) - 160, 0.2); // аналитически: MC = 620/7
});

test("кухня без выпуска, если её MC при нуле выше MR (угловое решение)", () => {
  const plan = C.chainPlan({ A: 95, w: 20, open: [true, true], caps: [999, 999], discount: false });
  assert.equal(plan.q[1], 0);
  assert.ok(95 - 2 * plan.Q < C.chainMC(C.CHAIN.kitchens[1], 0, 20));
});

test("спад: короткий период — заводская кухня покрывает AVC (работать), длинный — не покрывает аренду (закрыть)", () => {
  const a = C.chainShutdownMath(200);
  assert.ok(a.contribution2 > 0, "вклад кухни 2 сверх переменных издержек > 0 → в коротком периоде работать");
  assert.ok(a.contribution2 < C.CHAIN.kitchens[1].F, "но меньше её аренды");
  assert.ok(a.profitOnlyK1 > a.profitBoth, "в длинном периоде без кухни 2 прибыль выше");
  const b = C.chainShutdownMath(300);
  assert.ok(b.profitBoth > b.profitOnlyK1, "при обычном спросе вторая кухня нужна");
});

test("оптовая скидка на все зёрна от 120 чашек: выгоднее добрать до порога, хотя MR = MC без скидки даёт меньше", () => {
  const no = C.chainPlan({ A: 300, w: 20, open: [true, true], caps: [999, 999], discount: false });
  const yes = C.chainPlan({ A: 300, w: 20, open: [true, true], caps: [999, 999], discount: true });
  assert.ok(no.Q < C.CHAIN.discountQ);
  near(yes.Q, C.CHAIN.discountQ, 0.3);
  assert.ok(yes.profitVar > no.profitVar + 300, `${yes.profitVar} vs ${no.profitVar}`);
});

test("мощность Садовой: при упоре MR = MC₂ < MC₁ + λ", () => {
  const plan = C.chainPlan({ A: 300, w: 20, open: [true, true], caps: [30, 999], discount: false });
  near(plan.q[0], 30);
  const mr = 300 - 2 * plan.Q;
  near(mr, C.chainMC(C.CHAIN.kitchens[1], plan.q[1], 20), 0.05);
  assert.ok(mr > C.chainMC(C.CHAIN.kitchens[0], 30, 20), "место на Садовой ценно: λ > 0");
});

test("день сети: цена расчищает рынок, прибыль = TR − VC − аренда открытых кухонь; скидка — по факту объёма", () => {
  let st = C.chainNewState(20000); st.day = 15; st.chapter = 3; st.q = [50, 70];
  const { next, report } = C.chainSimulate(st, L.lavkaRng(1));
  assert.equal(report.w, 14, "Q = 120 → скидка");
  near(report.P, Math.max(0, report.A - 120));
  const vc = C.chainVC(C.CHAIN.kitchens[0], 50, 14) + C.chainVC(C.CHAIN.kitchens[1], 70, 14);
  near(report.profit, report.P * 120 - vc - C.CHAIN.kitchens[0].F - C.CHAIN.kitchens[1].F);
  assert.equal(next.day, 16);
  st = { ...st, q: [50, 69] };
  assert.equal(C.chainSimulate(st, L.lavkaRng(1)).report.w, 20, "Q = 119 → без скидки");
});

test("закрытие по договору: после уведомления аренда платится ещё 3 дня (кухня может работать), потом выпуск 0", () => {
  let st = C.chainNewState(20000); st.day = 8; st.chapter = 2;
  st = C.chainSetOpen(st, 1, false);
  assert.equal(st.open[1], true); assert.equal(st.closeIn[1], C.CHAIN.noticeDays);
  for (let d = 0; d < C.CHAIN.noticeDays; d++) {
    const out = C.chainSimulate({ ...st, q: [40, 30] }, L.lavkaRng(2 + d));
    assert.equal(out.report.q[1], 30, "в дни уведомления кухня работает — аренда всё равно уплачена");
    near(out.report.fixed, C.CHAIN.kitchens[0].F + C.CHAIN.kitchens[1].F);
    st = out.next;
  }
  assert.equal(st.open[1], false);
  const r = C.chainSimulate({ ...st, q: [40, 30] }, L.lavkaRng(9)).report;
  assert.equal(r.q[1], 0); near(r.fixed, C.CHAIN.kitchens[0].F);
  const re = C.chainSetOpen(st, 1, true);
  assert.equal(re.open[1], true); assert.equal(re.cash, st.cash - C.CHAIN.reopenCost);
  const cancel = C.chainSetOpen(C.chainSetOpen(C.chainNewState(1000), 1, false), 1, true);
  assert.equal(cancel.closeIn[1], 0); assert.equal(cancel.cash, 1000, "отмена уведомления бесплатна");
});

test("главы по дням: спад с 8-го, опт с 15-го; цель «две кухни» — MR ≈ MC₁ ≈ MC₂", () => {
  let st = C.chainNewState(20000); st.day = 7;
  const plan = C.chainPlan({ A: 300, w: 20, open: [true, true], caps: C.CHAIN.kitchens.map((k) => k.cap), discount: false });
  st.q = plan.q.map(Math.round);
  const out = C.chainSimulate(st, L.lavkaRng(3));
  assert.equal(out.next.chapter, 2);
  assert.ok(out.report.newGoals.includes("twokitchens"));
  assert.equal(C.chainA({ ...st, chapter: 2 }), 200);
  assert.equal(C.chainA({ ...st, chapter: 3 }), 300);
});

test("переход с уровня 2: только с медалью экзамена ярмарки; дочки копятся в холдинге", () => {
  const l1 = L.lavkaNewState(); l1.examBest = { eff: 0.9, medal: "silver", attempts: 1 };
  const s2 = F.levelFinish(l1, "keep");
  assert.equal(C.levelFinish2(s2, "sell"), null, "без медали ярмарки нельзя");
  s2.fair.examBest = { eff: 0.96, medal: "gold", attempts: 1 };
  const kept = C.levelFinish2(s2, "keep");
  assert.equal(kept.level, 3);
  assert.equal(kept.chain.subsidiaries.length, 2, "лавка + ярмарка");
  assert.equal(kept.chain.subsidiaries[1].dividend, C.LEVEL2_DIVIDEND.gold);
  const sold = C.levelFinish2(s2, "sell");
  assert.equal(sold.chain.cash, C.CHAIN.grant + Math.round(C.chainSalePrice2("gold")), "касса ярмарки уходит в архив, как и касса лавки");
});

/* ===== Ревью экономиста (70%) ===== */

test("вердикт в оптимуме главы 3 (порог скидки, Садовая в упоре) не советует переносить и варить меньше", () => {
  const st = C.chainNewState(1e5); st.day = 15; st.chapter = 3;
  st.obs = [[100, 200], [110, 190], [120, 180]].map(([Q, P], i) => ({ day: 15 + i, Q, P, chapter: 3 })); // своя оценка спроса
  st.q = C.chainPlan({ A: 300, w: 20, open: [true, true], caps: C.CHAIN.kitchens.map((k) => k.cap), discount: true }).q.map(Math.round);
  const r = C.chainSimulate(st, L.lavkaRng(1)).report;
  const v = C.chainVerdict(r);
  assert.ok(!/перенеси/.test(v) && !/вари меньше/.test(v), v);
  assert.match(v, /пороге скидки/); assert.match(v, /λ/);
});

test("спад: вывод про закрытие условный; цель «Длинный период» — закрытие + правильный выпуск", () => {
  let st = C.chainNewState(1e5); st.day = 8; st.chapter = 2;
  const v = C.chainVerdict(C.chainSimulate({ ...st, q: [30, 30] }, L.lavkaRng(1)).report);
  assert.match(v, /коротком периоде/); assert.match(v, /не равно закрыть фирму|≠ закрыть фирму/);
  st = C.chainSetOpen(st, 1, false);
  assert.ok(!C.chainSimulate({ ...st, q: [5, 5] }, L.lavkaRng(1)).report.newGoals.includes("exit"), "закрыл, но выпуск далёк от плана");
  const plan = C.chainPlan({ A: 200, w: 20, open: st.open, caps: C.CHAIN.kitchens.map((k) => k.cap), discount: false });
  assert.ok(C.chainSimulate({ ...st, q: plan.q.map(Math.round) }, L.lavkaRng(1)).report.newGoals.includes("exit"));
});

test("оценка спроса — только по наблюдениям текущей главы", () => {
  const st = C.chainNewState(1e5); st.day = 10; st.chapter = 2;
  st.obs = [[1, 100, 200], [2, 110, 190], [3, 90, 210], [8, 60, 140], [9, 70, 130], [10, 50, 150]].map(([day, Q, P]) => ({ day, Q, P, chapter: day < 8 ? 1 : 2 }));
  const r = C.chainSimulate({ ...st, q: [30, 30] }, L.lavkaRng(1)).report;
  near(r.fit.A, 200, 1e-6); near(r.fit.B, 1, 1e-6);
});

/* ===== Экзамен уровня 3 ===== */

const examChain = () => { const c = C.chainNewState(1e5); c.day = 22; c.chapter = 3; return c; };

test("экзамен уровня 3: открыт в главе 3 с 22-го дня; 4 сценария со случайными параметрами", () => {
  const c = examChain();
  assert.equal(C.chainExamOpen(c), true); assert.equal(C.chainExamOpen({ ...c, day: 21 }), false);
  const e = C.chainExamNew(c, 3);
  assert.deepEqual(e.days.map((d) => d.kind), ["two", "loss", "bulk", "cap"]);
  assert.deepEqual(e.days, C.chainExamNew(c, 3).days);
  const As = new Set(); for (let s = 0; s < 30; s++) As.add(C.chainExamNew(c, s).days[0].A);
  assert.ok(As.size > 5, "спрос меняется от попытки к попытке");
});

test("экзамен уровня 3: оценка по решениям — оптимум 100%, «пополам» и «не закрывать» теряют, без расчётов нет серебра", () => {
  const c = examChain();
  const run = (pick, seed = 5) => { let ex = C.chainExamNew(c, seed); for (let i = 0; i < 4; i++) ex = C.chainExamPlayDay(c, ex, pick(ex.days[i])).exam; return C.chainExamResult(ex); };
  const best = run((d) => C.chainExamBest(d));
  near(best.eff, 1, 1e-9); assert.equal(best.medal.id, "gold");
  const noClose = run((d) => ({ ...C.chainExamBest(d), close: false }));
  assert.ok(noClose.days[1] <= 0.5 + 1e-9, "в убыточной точке неверное решение о закрытии — половина дня");
  let silver = 0;
  for (let s = 0; s < 40; s++) {
    const r = run(() => ({ q: [40, 50], close: false }), 100 + s);
    if (r.medal && r.medal.id !== "bronze") silver++;
  }
  assert.ok(silver === 0, `«всегда 40 + 50» — серебро в ${silver} из 40`);
  const after = C.chainExamFinish(c, { ...C.chainExamNew(c, 5), results: [] });
  assert.equal(after.cash, c.cash);
});
