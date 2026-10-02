/* Тесты уровня 5 «Холдинг» (сценарий «Путь компании»): node --test holding.test.js
   NPV/PI и неделимость, кредит (PV схем при ставке альтернативы), УСН, страховка с экстренным кредитом,
   красный флаг (ценность информации), дамба, паводок, экзамен, финал с двумя покупателями. */
import test from "node:test";
import assert from "node:assert/strict";
import * as H from "./holding.js";
import * as P from "./factory.js";
import * as K from "./capital.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const PR = H.HOLDING.projects;
const withSubs = (h) => ({ ...h, subsidiaries: [{ name: "Сеть", level: 3, dividend: 1500, daysLeft: 40 }, { name: "Цех", level: 4, dividend: 1800, daysLeft: 24 }] });

test("проекты: NPV при 2% на 30 дней, PI, окупаемость; P6 окупается за 26,7 дня, но NPV < 0", () => {
  near(H.holdingNPV(PR.find((p) => p.id === "P1")), 68757, 1); near(H.holdingPI(PR.find((p) => p.id === "P1")), 1.344, 0.001);
  const p6 = PR.find((p) => p.id === "P6");
  assert.ok(H.holdingPayback(p6) < 30 && H.holdingNPV(p6) < 0);
  near(H.holdingNPV(p6), -12811, 1);
});

test("бюджет 500 000: лучший набор P1 + P3 + P4 (134 704); жадный по PI — 123 920; без Семёна — P1 + P2 (127 101)", () => {
  const best = H.holdingBestSet(PR, 500000);
  assert.deepEqual(best.ids.sort(), ["P1", "P3", "P4"]); near(best.npv, 134704, 1);
  near(H.holdingGreedyPI(PR, 500000).npv, 123920, 1);
  near(H.holdingBestSet(PR.filter((p) => p.id !== "P3"), 500000).npv, 127101, 1);
});

test("кредит: аннуитет 33 398, дифф. 36 000 → 30 600; при ставке альтернативы = ставке кредита PV обеих = 300 000", () => {
  const L = { amount: 300000, rate: 0.02, n: 10 }, a = H.holdingSchedule(L, "annuity"), d = H.holdingSchedule(L, "diff");
  near(a[0], 33398, 1); near(d[0], 36000); near(d[9], 30600);
  near(H.holdingSchedulePV(a), 300000, 1e-6); near(H.holdingSchedulePV(d), 300000, 1e-6);
  /* Кредит дороже альтернативы — дифференцированный выгоднее (меньше PV), дешевле — аннуитет. */
  const L3 = { ...L, rate: 0.025 }, L1 = { ...L, rate: 0.015 };
  assert.ok(H.holdingSchedulePV(H.holdingSchedule(L3, "diff")) < H.holdingSchedulePV(H.holdingSchedule(L3, "annuity")));
  assert.ok(H.holdingSchedulePV(H.holdingSchedule(L1, "annuity")) < H.holdingSchedulePV(H.holdingSchedule(L1, "diff")));
});

test("УСН: холдинг (E/R = 0,71) — 15% (78 750 против 108 000); граница E/R = 60%; минимум 1%", () => {
  near(H.holdingTax(H.HOLDING.tax, "usn6"), 108000); near(H.holdingTax(H.HOLDING.tax, "usn15"), 78750);
  assert.equal(H.holdingTaxBest(H.HOLDING.tax), "usn15");
  assert.equal(H.holdingTaxBest({ R: 100, E: 55 }), "usn6"); assert.equal(H.holdingTaxBest({ R: 100, E: 65 }), "usn15");
  near(H.holdingTax({ R: 100000, E: 99500 }, "usn15"), 1000);
});

test("страховка: касса 250 000 — франшиза (147 000 против ≈ 155 400 без полиса, экстренный кредит в PV ≈ 0,786·S); касса 500 000 — не страховать (120 000)", () => {
  const pol = H.holdingPolicies({ cafes: 150000, factory: 250000 });
  near(pol.full, 150000); near(pol.deductible, 135000);
  near(H.holdingInsuranceCost("none", pol, 250000), 0.3 * (400000 + 150000 * H.holdingEmergencyFactor()), 1e-6); near(H.holdingEmergencyFactor(), 1.05 ** 20 / 1.02 ** 20 - 1); near(H.holdingInsuranceCost("deductible", pol, 250000), 147000);
  assert.equal(H.holdingInsuranceBest(pol, 250000), "deductible"); assert.equal(H.holdingInsuranceBest(pol, 500000), "none");
});

test("мир: флаг с вероятностью 0,6, паводок только после флага (0,5) — итого ≈ 0,3", () => {
  let flags = 0, floods = 0, floodNoFlag = 0;
  for (let s = 1; s <= 2000; s++) { const w = H.holdingNewState(0, s).world; if (w.flag) flags++; if (w.flood) floods++; if (w.flood && !w.flag) floodNoFlag++; }
  assert.equal(floodNoFlag, 0); near(flags / 2000, 0.6, 0.04); near(floods / 2000, 0.3, 0.04);
});

test("портфель: утвердить можно до 7-го дня в бюджете; цель — лучший набор при полной доске", () => {
  let h = withSubs(H.holdingNewState(600000, 3)); h.day = 5;
  const ok = H.holdingApprove(h, ["P1", "P3", "P4"]);
  assert.equal(ok.cash, 600000 - 470000 + 10000); assert.ok(ok.goals.portfolio); assert.equal(ok.projects.length, 3);
  assert.equal(H.holdingApprove(h, ["P1", "P2", "P4"]).approved, null, "сверх бюджета не утвердить");
  assert.equal(H.holdingApprove({ ...h, day: 8 }, ["P1"]).approved, null);
  const early = H.holdingApprove({ ...h, day: 3 }, ["P1", "P5"]);
  assert.ok(!early.goals.portfolio, "на 3-й день доска неполная");
  const noSemyon = { ...h, semyonTrust: false };
  assert.ok(H.holdingApprove(noSemyon, ["P1", "P2"]).goals.portfolio);
});

test("день: дивиденды + проекты − кредит + проценты; налог на 21-й; курс на 19-й", () => {
  let h = withSubs(H.holdingNewState(600000, 3)); h.day = 5;
  h = H.holdingApprove(h, ["P1", "P3", "P4"]);
  const { next, report } = H.holdingNextDay(h);
  near(report.dividend, 3300); near(report.projectCF, 27000); near(report.interest, h.cash * 0.02);
  assert.equal(next.cash, Math.round(h.cash + 3300 + 27000 + h.cash * 0.02));
  h = H.holdingTakeLoan({ ...next, day: 8 }, "diff");
  assert.equal(h.cash, next.cash + 300000);
  near(H.holdingNextDay(h).report.loanPay, 36000);
  const t = H.holdingNextDay({ ...H.holdingChooseTax({ ...h, day: 6 }, "usn15"), day: 21 }).report;
  near(t.tax, 78750);
  const fx = H.holdingNextDay({ ...h, day: 19, hedged: true }).report; near(fx.fx, 96000);
});

test("паводок: перенос −40%, дамба ещё −60% для кофеен, страховка покрывает сверх франшизы; нехватка — экстренный кредит", () => {
  let h = withSubs(H.holdingNewState(50000, 1));
  h.world = { flag: true, flood: true, spot: 110 };
  h = H.holdingInsure({ ...h, day: 10 }, "deductible");
  h = H.holdingMove({ ...h, day: 15 }); h = H.holdingDam({ ...h, day: 16 }, true);
  const loss = H.holdingFloodLoss(h);
  near(loss.cafes, 150000 * 0.6 * 0.4); near(loss.factory, 250000 * 0.6);
  near(loss.payout, (36000 - 20000) + (150000 - 20000)); near(loss.net, 40000);
  const poor = { ...withSubs(H.holdingNewState(10000, 1)), day: 18, world: { flag: true, flood: true, spot: 80 } };
  const out = H.holdingNextDay(poor);
  assert.ok(out.report.emergency > 0); assert.equal(out.next.cash, 0); near(out.next.emergencyDebt, out.report.emergency * 1.05 ** 20, 1e-6);
  assert.equal(H.holdingMove({ ...withSubs(H.holdingNewState(1e5, 1)), day: 15, world: { flag: false, flood: false, spot: 80 } }).moved, false, "без флага переносить незачем — и нельзя");
});

test("цель «Кому нужна страховка»: по прогнозу кассы на день паводка", () => {
  const rich = { ...withSubs(H.holdingNewState(900000, 2)), day: 10 };
  const r1 = H.holdingInsure(rich, "none");
  assert.equal(r1.insurance.best, "none"); assert.ok(r1.goals.insurance);
  /* Касса покрывает премию, но не убыток (≈ 200 000 к паводку) — страховка с франшизой выгоднее. */
  const mid = { ...withSubs(H.holdingNewState(150000, 2)), day: 10 };
  const r2 = H.holdingInsure(mid, "none");
  assert.equal(r2.insurance.best, "deductible"); assert.ok(!r2.goals.insurance);
  /* Касса не покрывает даже премию — полис пришлось бы оплачивать экстренным кредитом: не страховать дешевле. */
  assert.equal(H.holdingInsure({ ...withSubs(H.holdingNewState(20000, 2)), day: 10 }, "none").insurance.best, "none");
});

/* ===== Экзамен ===== */
test("экзамен: 3 задачи, эталон = 100%; «ничего не делать» и «всегда первый вариант» — без серебра", () => {
  const h = { ...H.holdingNewState(0, 1), chapter: 3, day: 22 };
  assert.equal(H.holdingExamOpen(h), true);
  const run = (pick, seed) => { let ex = H.holdingExamNew(h, seed); for (const d of ex.days) ex = H.holdingExamPlay(ex, pick(d)).exam; return H.holdingExamResult(ex); };
  near(run((d) => H.holdingExamBest(d), 7).eff, 1);
  let silver = 0, silver2 = 0;
  for (let s = 0; s < 60; s++) {
    const r = run((d) => (d.kind === "portfolio" ? { ids: [] } : d.kind === "finance" ? { scheme: "diff", regime: "usn6" } : { choice: "none" }), 50 + s);
    if (r.medal && r.medal.id !== "bronze") silver++;
    const r2 = run((d) => (d.kind === "portfolio" ? { ids: [d.projects[0].id] } : d.kind === "finance" ? { scheme: "annuity", regime: "usn15" } : { choice: "full" }), 50 + s);
    if (r2.medal && r2.medal.id !== "bronze") silver2++;
  }
  assert.equal(silver, 0); assert.ok(silver2 <= 3, `серебро в ${silver2} из 60`);
});

test("финал: Железнова — 95% истинной стоимости; Плотников — по медали; сильному выгоднее раскрыться", () => {
  const strong = { ...withSubs(H.holdingNewState(1e5, 1)), projects: [{ id: "P1", cf: 12000, daysLeft: 20 }, { id: "P2", cf: 16000, daysLeft: 20 }], examBest: { medal: "silver", eff: 0.9 } };
  const o = H.holdingOffers(strong, "silver");
  near(o.zheleznova, 0.95 * H.holdingTrueValue(strong)); near(o.plotnikov, 0.9 * H.HOLDING.cityD * K.annuity(30));
  assert.ok(o.zheleznova > o.plotnikov);
  const sold = H.holdingSell(strong, "zheleznova");
  assert.equal(sold.sold.price, Math.round(o.zheleznova)); assert.equal(sold.finalCapital, Math.round(1e5 + o.zheleznova));
  const weak = { ...strong, subsidiaries: [], projects: [{ id: "P5", cf: 3500, daysLeft: 20 }] };
  const ow = H.holdingOffers(weak, "silver"); assert.ok(ow.plotnikov > ow.zheleznova, "слабому выгоднее промолчать");
});

test("переход с уровня 4 через capital.js: фонд развития 500 000, дочки копятся, Семён помнит обман", () => {
  const f = { ...P.factoryNewState(1e5), subsidiaries: [{ name: "Сеть", level: 3, dividend: 1400, daysLeft: 30 }] };
  assert.equal(H.levelFinish4({ level: 4, factory: f }, "sell"), null);
  f.examBest = { eff: 0.92, medal: "silver", piBot: 6000, attempts: 1 };
  const kept = H.levelFinish4({ level: 4, factory: f, fair: { flags: { semyonBroken: true } } }, "keep");
  assert.equal(kept.level, 5); assert.equal(kept.holding.subsidiaries.length, 2); assert.equal(kept.holding.subsidiaries[1].daysLeft, 21);
  assert.equal(kept.holding.cash, H.HOLDING.devFund); assert.equal(kept.holding.semyonTrust, false);
  assert.ok(!H.holdingBoard({ ...kept.holding, day: 5 }).some((p) => p.id === "P3"));
  const sold = H.levelFinish4({ level: 4, factory: f }, "sell");
  assert.equal(sold.holding.cash, H.HOLDING.devFund + Math.round(K.capitalSalePrice(4, "silver")));
});

test("итог игры выигрывается экономикой: «ленивый» холдинг (без проектов, полиса и выбора налога, Плотникову) беднее «умного»", () => {
  const subs = [{ name: "Лавка", level: 1, dividend: 1300, daysLeft: 21 }, { name: "Квас", level: 2, dividend: 1700, daysLeft: 21 }, { name: "Сеть", level: 3, dividend: 1300, daysLeft: 21 }, { name: "Цех", level: 4, dividend: 4000, daysLeft: 21 }];
  const play = (seed, smart) => {
    let h = { ...H.holdingNewState(500000, seed), subsidiaries: subs.map((x) => ({ ...x })) };
    for (let d = 1; d <= 21; d++) {
      if (smart) {
        if (d === 5) h = H.holdingApprove(h, H.holdingBestSet(H.holdingBoard(h), 500000).ids);
        if (d === 6) h = H.holdingChooseTax(h, "usn15");
        if (d === 10) h = H.holdingInsure(h, H.holdingInsuranceBest(H.holdingPolicies(H.holdingExposure(h)), H.holdingCashForecast(h)));
        if (d === 15 && h.world.flag && H.holdingActionGain(h, { moved: true }) > 10000) h = H.holdingMove(h);
        if (d === 16 && h.world.flag) h = H.holdingDam(h, H.holdingActionGain(h, { damBuilt: true }) > 20000);
      }
      h = H.holdingNextDay(h).next;
    }
    h = { ...h, examBest: { medal: "gold", eff: 1 } };
    const o = H.holdingOffers(h, "gold");
    return H.holdingSell(h, smart && o.zheleznova > o.plotnikov ? "zheleznova" : "plotnikov").finalCapital;
  };
  let lazy = 0, smart = 0;
  for (let s = 1; s <= 40; s++) { lazy += play(s, false); smart += play(s, true); }
  assert.ok(smart > lazy * 1.2, `умный ${smart / 40} против ленивого ${lazy / 40}`);
});

test("налог без выбора — УСН 6%; перенос и дамба не засчитываются, если полный полис уже покрывает убыток", () => {
  const h = { ...withSubs(H.holdingNewState(5e5, 1)), day: 21 };
  near(H.holdingNextDay(h).report.tax, 108000);
  let ins = H.holdingInsure({ ...withSubs(H.holdingNewState(5e5, 1)), day: 10 }, "full");
  ins = { ...ins, day: 15, world: { flag: true, flood: true, spot: 80 } };
  near(H.holdingActionGain(ins, { moved: true }), 0);
  assert.ok(!H.holdingMove(ins).goals.flag);
  const bare = { ...withSubs(H.holdingNewState(5e5, 1)), day: 15, world: { flag: true, flood: true, spot: 80 }, insurance: { choice: "none" } };
  near(H.holdingActionGain(bare, { moved: true }), 0.5 * 0.4 * 400000);
  assert.ok(H.holdingMove(bare).goals.flag);
});

test("касса в минусе в любой день — экстренный кредит, а не дешёвый овердрафт", () => {
  const h = { ...withSubs(H.holdingNewState(30000, 1)), day: 21, taxRegime: "usn6" };
  const out = H.holdingNextDay(h);
  assert.ok(out.report.emergency > 0); assert.equal(out.next.cash, 0);
  near(out.next.emergencyDebt, out.report.emergency * 1.05 ** 20, 1e-6);
});
