/* Тесты уровня 5 «Холдинг»: node --test holding.test.js
   NPV/PI при ограниченном капитале, аннуитет и дифференцированный платёж, УСН, диверсификация, франшиза, валютный форвард. */
import test from "node:test";
import assert from "node:assert/strict";
import * as H from "./holding.js";
import * as P from "./factory.js";
import * as L from "./model.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const r = H.HOLDING.rate;

test("NPV и PI проекта: PV = c·(1 − (1 + r)^−T)/r, NPV = PV − I, PI = PV/I", () => {
  const p = { cost: 50000, cf: 1500, days: 50 };
  const pv = 1500 * (1 - (1 + r) ** -50) / r;
  near(H.holdingPV(p), pv); near(H.holdingNPV(p), pv - 50000); near(H.holdingPI(p), pv / 50000);
});

test("бюджет капитала: лучший набор — максимум NPV перебором; жадный выбор по PI может проиграть", () => {
  const projects = [
    { id: "A", cost: 60000, cf: 1600, days: 60 }, { id: "B", cost: 50000, cf: 1250, days: 60 },
    { id: "C", cost: 50000, cf: 1250, days: 60 }, { id: "D", cost: 30000, cf: 300, days: 60 },
  ];
  const best = H.holdingBestSet(projects, 100000);
  assert.deepEqual(best.ids.sort(), ["B", "C"]);
  const greedy = H.holdingGreedyPI(projects, 100000);
  assert.ok(greedy.npv < best.npv, "по PI берём A, и на B + C бюджета уже не хватает");
  assert.ok(!best.ids.includes("D") || H.holdingNPV(projects[3]) > 0, "проект с NPV < 0 не берём");
});

test("кредит: аннуитет и дифференцированный — PV платежей по ставке кредита равен сумме; переплата у дифференцированного меньше", () => {
  const loan = { amount: 100000, rate: 0.01, n: 20 };
  const ann = H.holdingSchedule(loan, "annuity"), dif = H.holdingSchedule(loan, "diff");
  const pv = (pays) => pays.reduce((s, x, t) => s + x / (1 + loan.rate) ** (t + 1), 0);
  near(pv(ann), 100000, 1e-6); near(pv(dif), 100000, 1e-6);
  const a = loan.amount * loan.rate / (1 - (1 + loan.rate) ** -loan.n);
  for (const x of ann) near(x, a, 1e-9);
  assert.ok(dif.reduce((s, x) => s + x, 0) < ann.reduce((s, x) => s + x, 0));
  assert.equal(H.holdingLoanBest({ loanRate: 0.01, depositRate: 0.005 }), "diff", "ставка кредита выше депозита — гаси быстрее");
  assert.equal(H.holdingLoanBest({ loanRate: 0.003, depositRate: 0.005 }), "annuity");
});

test("УСН: 6% с доходов против 15% с (доходы − расходы), но не меньше 1% доходов", () => {
  near(H.holdingTax({ revenue: 100000, costs: 70000 }, "usn6"), 6000);
  near(H.holdingTax({ revenue: 100000, costs: 70000 }, "usn15"), 4500);
  near(H.holdingTax({ revenue: 100000, costs: 99000 }, "usn15"), 1000, 1e-9);
  assert.equal(H.holdingTaxBest({ revenue: 100000, costs: 50000 }), "usn6");
  assert.equal(H.holdingTaxBest({ revenue: 100000, costs: 70000 }), "usn15");
});

test("диверсификация: σ портфеля 50/50 = √(σ₁²/4 + σ₂²/4 + ρσ₁σ₂/2); меньше ρ — меньше риск", () => {
  near(H.holdingPortfolioSigma(0.5, 20, 20, 1), 20); near(H.holdingPortfolioSigma(0.5, 20, 20, 0), Math.sqrt(200));
  near(H.holdingPortfolioSigma(0.5, 20, 20, -1), 0);
  assert.ok(H.holdingPortfolioSigma(0.5, 20, 30, 0.2) < H.holdingPortfolioSigma(0.5, 20, 30, 0.8));
});

test("франшиза: фикс против роялти по ожиданию; валютный форвард: фиксирует курс, сравнение с ожидаемым спотом", () => {
  assert.equal(H.holdingFranchiseBest({ fixed: 3000, share: 0.05, expRevenue: 50000 }), "fixed");
  assert.equal(H.holdingFranchiseBest({ fixed: 2000, share: 0.05, expRevenue: 50000 }), "royalty");
  assert.equal(H.holdingFxBest({ forward: 92, expSpot: 95, payUSD: 1000 }), "hedge", "платим в долларах — форвард дешевле ожидаемого спота");
  assert.equal(H.holdingFxBest({ forward: 97, expSpot: 95, payUSD: 1000 }), "spot");
});

test("день холдинга: задача дня → решение → последствия; дивиденды, проекты, проценты", () => {
  let st = H.holdingNewState(200000);
  const task = H.holdingTask(st);
  assert.equal(task.kind, "budget");
  const best = H.holdingTaskBest(task);
  const out = H.holdingAnswer(st, task, best);
  assert.equal(out.score, 1);
  st = out.next;
  assert.ok(st.projects.length > 0 && st.cash < 200000, "купленные проекты оплачены");
  const day = H.holdingNextDay(st, L.lavkaRng(1));
  assert.equal(day.next.day, 2);
  near(day.report.projectCF, st.projects.reduce((s, p) => s + p.cf, 0));
});

test("главы по дням: инвестиции → кредит и налоги (с 8-го) → риск (с 15-го); финал — экзамен с 22-го", () => {
  const kinds = (ch) => new Set(Array.from({ length: 12 }, (_, i) => H.holdingTask({ ...H.holdingNewState(1e5), chapter: ch, day: 1 + i, seed: 3 }).kind));
  assert.deepEqual([...kinds(1)], ["budget"]);
  assert.deepEqual([...kinds(2)].sort(), ["loan", "tax"]);
  assert.deepEqual([...kinds(3)].sort(), ["diversify", "franchise", "fx"]);
  assert.equal(H.holdingExamOpen({ chapter: 3, day: 22 }), true);
});

test("экзамен уровня 5: 4 задачи разных глав, лучшие ответы = 100%, «всегда первый вариант» — без серебра", () => {
  const st = { ...H.holdingNewState(1e5), chapter: 3, day: 22 };
  const run = (pick, seed) => { let ex = H.holdingExamNew(st, seed); for (let i = 0; i < ex.tasks.length; i++) ex = H.holdingExamPlay(ex, pick(ex.tasks[i])).exam; return H.holdingExamResult(ex); };
  near(run((t) => H.holdingTaskBest(t), 7).eff, 1);
  let silver = 0;
  for (let s = 0; s < 30; s++) { const res = run((t) => H.holdingTaskFirst(t), 50 + s); if (res.medal && res.medal.id !== "bronze") silver++; }
  assert.ok(silver <= 3, `серебро в ${silver} из 30`);
});

test("переход с уровня 4: только с медалью экзамена пекарни; дочки копятся; итог — стоимость холдинга", () => {
  const st = { level: 4, factory: { ...P.factoryNewState(1e5), subsidiaries: [{ name: "Сеть", dividend: 3600, daysLeft: 5 }] } };
  assert.equal(H.levelFinish4(st, "sell"), null);
  st.factory.examBest = { eff: 0.97, medal: "gold", attempts: 1 };
  const kept = H.levelFinish4(st, "keep");
  assert.equal(kept.level, 5); assert.equal(kept.holding.subsidiaries.length, 2);
  const v = H.holdingValue(kept.holding);
  assert.ok(v > kept.holding.cash, "стоимость = касса + PV будущих дивидендов и проектов");
});
