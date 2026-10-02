/* Тесты уровня 2 «Ярмарка» (квас, сценарий «Путь компании»): node --test fair.test.js
   Курно, налог с единицы и фиксированная плата, картель с риском проверки, вход до пяти, Штакельберг, бочка, экзамен. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fair.js";
import * as L from "./model.js";
import * as K from "./capital.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const { a, b, c } = F.FAIR;

test("Курно: x = (a − c)/(b(n + 1)), P = (a + n·c)/(n + 1); таблица сценария", () => {
  const rows = { 2: [533.33, 46.67, 14222], 3: [400, 40, 8000], 4: [320, 36, 5120], 5: [266.67, 33.33, 3556], 6: [228.57, 31.43, 2612] };
  for (const [n, [x, P, pi]] of Object.entries(rows)) {
    const eq = F.fairCournot(Number(n));
    near(eq.x, x, 0.01); near(eq.P, P, 0.01); near(eq.profit, pi, 1);
  }
  const tax = F.fairCournot(2, 30); near(tax.x, 466.67, 0.01); near(tax.P, 53.33, 0.01); near(tax.profit, 10889, 1);
  assert.ok(F.fairCournot(200).P - c < 0.5, "n → ∞: P → MC");
});

test("наилучший ответ и асимметричный Курно: бочка (MC 16) — 586,7 против 506,7, прирост 2 987 / 2 580 / 2 000", () => {
  near(F.fairBR(533.33), (a - c - b * 533.33) / (2 * b));
  const two = F.fairNashAsym(2, 16, 20), base2 = F.fairNashAsym(2, 20, 20);
  near(two.xp, 586.67, 0.01); near(two.xr, 506.67, 0.01);
  near(two.profitP - base2.profitP, 2987, 1);
  near(F.fairNashAsym(3, 16, 20).profitP - F.fairNashAsym(3, 20, 20).profitP, 2580, 1);
  near(F.fairNashAsym(5, 16, 20).profitP - F.fairNashAsym(5, 20, 20).profitP, 2000, 1);
  const n3 = F.fairNashAsym(3, 16, 20); near(n3.xp, 460, 0.01); near(n3.xr, 380, 0.01); near(n3.P, 39, 0.01);
});

test("день ярмарки: P = a − (b/k)·Q; в выходные объёмы ×k, цена та же; сбор 10 ₽ входит в MC первую неделю", () => {
  const st = F.fairNewState(20000);
  const eq = F.fairCournot(2, 30);
  st.q = Math.round(eq.x);
  const { next, report } = F.fairSimulate(st, L.lavkaRng(1));
  near(report.rivals[0].x, eq.x, 1e-9);
  near(report.P, Math.max(0, report.a - b * report.X));
  near(report.margin, (report.P - 30) * report.q); near(report.fixed, 0);
  near(report.interest, st.cash * K.CAPITAL.rate);
  assert.equal(next.cash, Math.round(st.cash + report.profit + report.dividend + report.reward + report.interest + report.salvage));
  /* Суббота недели 1 (k = 1,4): соперник везёт 1,4 × Курно, цена как в будни. */
  const sat = { ...F.fairNewState(20000), day: 6, q: Math.round(eq.x * 1.4) };
  const r6 = F.fairSimulate(sat, () => 0.5).report;
  near(r6.rivals[0].q, eq.x * 1.4, 1e-9); near(r6.k, 1.4);
  near(r6.P, eq.P, 0.5);
  /* С 8-го дня — фиксированная плата 3 000, MC = 20. */
  const mon = { ...F.fairNewState(20000), day: 8, chapter: 2, q: 533 };
  const r8 = F.fairSimulate(mon, L.lavkaRng(3)).report;
  near(r8.fixed, 3000); near(r8.mc, 20); near(r8.br, 533.33, 0.01);
});

test("вход: Илья на 10-й день, ещё двое на 15-й, шестой не входит (2 612 × k̄ < 3 000)", () => {
  let st = F.fairNewState(1e6);
  const firms = [];
  for (let d = 1; d <= 21; d++) {
    const Xr = F.fairRivalX(st, 0) * st.rivals.length;
    st.q = Math.round(F.fairBR(Xr, F.fairMC(st)) * F.fairK(st.day));
    st = F.fairSimulate(st, L.lavkaRng(100 + d)).next;
    firms.push(st.rivals.length + 1);
  }
  assert.equal(firms[8], 3, "на 10-й день — трое"); assert.equal(firms[7], 2);
  assert.equal(firms[13], 5, "с 15-го — пятеро"); assert.equal(firms[20], 5);
  assert.ok(F.fairEntrantProfit(st, 6, 16) * F.fairKbar < F.FAIR.fee);
  assert.ok(F.fairEntrantProfit(st, 5, 16) * F.fairKbar > F.FAIR.fee);
});

test("картель двоих: квоты 350 / 400; обман 525 / 600; наказание 5 дней дороже выигрыша; выигрыш картеля < p·F", () => {
  const w1 = F.fairCartelMath(30, 30), w2 = F.fairCartelMath(20, 20);
  near(w1.qPlayer, 350); near(w1.P, 65); near(w1.cartelProfit, 12250); near(w1.qCheat, 525); near(w1.cheatProfit, 13781.25);
  near(w2.qPlayer, 400); near(w2.cheatProfit, 18000); near(w2.cartelGain, 1777.78, 0.01);
  assert.ok(w1.punishLoss > w1.cheatGain && w2.punishLoss > w2.cheatGain, "наказание Курно на 5 дней перевешивает обман");
  assert.ok(w1.cartelGain < w1.expFine && w2.cartelGain < w2.expFine, "сговор не окупается даже без обмана: ожидаемый штраф 2 000 ₽");
  near(w1.expFine, 2000);
  const v3 = F.fairCartelVsThird(20); near(v3.eachInCartel, 7111.1, 0.1); near(v3.eachCournot3, 8000);
});

test("договор Семёна: предложение на 5-й день; квота — Семён везёт квоту; обман — 5 дней Курно; проверка — штраф и конец сговора", () => {
  let st = F.fairNewState(1e5);
  for (let d = 1; d < 5; d++) { st.q = 467; st = F.fairSimulate(st, L.lavkaRng(d)).next; }
  assert.ok(st.offer, "Семён предлагает договор");
  st = F.fairAnswerOffer(st, true);
  assert.ok(F.fairInCartel(st));
  st.q = Math.round(350 * F.fairK(st.day));
  let out = F.fairSimulate(st, () => 0.5);
  near(out.report.rivals[0].x, 350, 1e-9); assert.ok(!out.report.cheated);
  st = { ...out.next, q: Math.round(525 * F.fairK(out.next.day)) };
  out = F.fairSimulate(st, () => 0.5);
  assert.ok(out.report.cheated); assert.equal(out.next.cartel.punish, F.FAIR.punishDays);
  /* Проверка Рубцова: rng < 8% — штраф 25 000, договор расторгнут. */
  let st2 = F.fairAnswerOffer({ ...F.fairNewState(1e5), day: 5, offer: { day: 5 } }, true);
  st2.q = 350;
  const caught = F.fairSimulate(st2, () => 0.01);
  near(caught.report.fined, 25000); assert.equal(caught.next.cartel.active, false); assert.ok(caught.next.flags.fined);
  /* Отказ — цель «Посчитал риск». */
  const no = F.fairAnswerOffer({ ...F.fairNewState(1e5), offer: { day: 5 } }, false);
  assert.ok(no.goals.honest); assert.equal(no.cartel, null);
});

test("вход Ильи распускает картель (Семён посчитал: 7 111 < 8 000)", () => {
  let st = F.fairAnswerOffer({ ...F.fairNewState(1e6), day: 9, chapter: 2, offer: { day: 5 } }, true);
  st.q = 400;
  const out = F.fairSimulate(st, () => 0.5);
  assert.deepEqual(out.report.entered, ["Илья"]);
  assert.ok(out.report.dissolved); assert.equal(out.next.cartel.active, false);
});

test("Штакельберг с обязательством: лидер 800 при любом числе последователей; прилавок — только дни 11–14", () => {
  for (const m of [1, 2, 4]) near(F.fairStackelberg(m, 20, 20).xL, 800);
  const s2 = F.fairStackelberg(2, 20, 20); near(s2.xF, 266.67, 0.01); near(s2.profitL, 10666.7, 0.1);
  const three = [{ name: "Семён", x: 0 }, { name: "Илья", x: 0 }];
  assert.equal(F.fairBuy({ ...F.fairNewState(1e6), day: 9, chapter: 2, rivals: three }, "leader").leader, false, "до 11-го дня прилавка нет");
  let st = F.fairBuy({ ...F.fairNewState(1e6), day: 12, chapter: 2, rivals: three }, "leader");
  assert.ok(st.leader); assert.equal(st.cash, 1e6 - 10000);
  st.q = Math.round(800 * F.fairK(12));
  const out = F.fairSimulate(st, () => 0.5);
  near(out.report.rivals[0].x, F.fairFollowers(800, 2, 20), 1e-9);
  assert.ok(out.report.newGoals.includes("leader"));
  /* С 15-го ряд перестроен: лидерства нет, входят ещё двое. */
  const last = F.fairSimulate({ ...out.next, day: 14, q: Math.round(800 * F.fairK(14)) }, () => 0.5);
  assert.equal(last.next.leader, false); assert.equal(last.report.entered.length, 2); assert.ok(last.next.flags.stackelberg);
});

test("бочка: NPV на 8-й день > 0, на 15-й < 0 (дней осталось мало); выкуп 20 000 в конце", () => {
  const st8 = { ...F.fairNewState(1e6), day: 8, chapter: 2 };
  const st15 = { ...F.fairNewState(1e6), day: 15, chapter: 3, rivals: [1, 2, 3, 4].map((i) => ({ name: "r" + i, x: 0 })) };
  assert.ok(F.fairBarrelNPV(st8) > 0, `${F.fairBarrelNPV(st8)}`); assert.ok(F.fairBarrelNPV(st15) < 0, `${F.fairBarrelNPV(st15)}`);
  const bought = F.fairBuy(st8, "barrel");
  assert.equal(bought.cash, 1e6 - 40000); assert.equal(F.fairMC(bought), 16);
  const end = F.fairSimulate({ ...bought, day: 21, chapter: 3, q: 300 }, () => 0.5);
  near(end.report.salvage, 20000);
});

test("цели: «Продналог» — наилучший ответ в первый день фиксированной платы", () => {
  const st = { ...F.fairNewState(1e5), day: 8, chapter: 2, q: 533 };
  assert.ok(F.fairSimulate(st, () => 0.5).report.newGoals.includes("fee"));
  assert.ok(!F.fairSimulate({ ...st, q: 300 }, () => 0.5).report.newGoals.includes("fee"));
});

test("главы по дням: 2 — с 8-го, 3 — с 15-го", () => {
  let st = F.fairNewState(1e5);
  for (let d = 1; d <= 15; d++) { st.q = 400; st = F.fairSimulate(st, L.lavkaRng(d)).next; if (d === 7) assert.equal(st.chapter, 2); }
  assert.equal(st.chapter, 3);
});

test("вердикт: в первую неделю говорит про сбор; при наилучшем ответе — «сходится»", () => {
  const st = F.fairNewState(1e5); st.q = 467;
  const v = F.fairVerdict(F.fairSimulate(st, () => 0.5).report);
  assert.match(v, /сходится/); assert.match(v, /Сбор 10 ₽/);
});

test("переход с уровня 1: через capital.js; без медали — null; дочка D = s·e·π̄_эт на 96 дней", () => {
  const l1 = L.lavkaNewState();
  assert.equal(F.levelFinish(l1, "sell"), null);
  l1.examBest = { eff: 0.9, medal: "silver", attempts: 1, piBot: 6000 };
  const sold = F.levelFinish(l1, "sell");
  assert.equal(sold.level, 2); assert.equal(sold.fair.cash, K.CAPITAL.grant[2] + Math.round(K.capitalSalePrice(1, "silver")));
  const kept = F.levelFinish(l1, "keep");
  assert.equal(kept.fair.subsidiaries[0].dividend, Math.round(0.3 * 0.9 * 6000)); assert.equal(kept.fair.subsidiaries[0].daysLeft, 96);
  const day = F.fairSimulate({ ...kept.fair, q: 467 }, () => 0.5);
  near(day.report.dividend, kept.fair.subsidiaries[0].dividend);
});

/* ===== Экзамен ===== */
const examFair = () => ({ ...F.fairNewState(1e5), day: 22, chapter: 3 });

test("экзамен: открыт с 22-го дня в главе 3; 3 дня, детерминирован сидом; эталон = 100%", () => {
  const f = examFair();
  assert.equal(F.fairExamOpen(f), true); assert.equal(F.fairExamOpen({ ...f, day: 21 }), false);
  const e = F.fairExamNew(f, 5);
  assert.deepEqual(e.days.map((d) => d.kind), ["cournot", "entry", "cartel"]);
  assert.deepEqual(e.days, F.fairExamNew(f, 5).days);
  let ex = e;
  for (const d of e.days) ex = F.fairExamPlayDay(f, ex, F.fairExamBest(f, d)).exam;
  const res = F.fairExamResult(ex);
  near(res.eff, 1, 1e-9); assert.equal(res.medal.id, "gold");
  assert.ok(res.piBot > 0 && res.piBot < 10000);
});

test("экзамен: сценарий 400 / 250 / 440 при объявленных объёмах; вступить в сговор хуже, чем остаться вне", () => {
  const f = examFair();
  near(F.fairExamBest(f, { kind: "cournot", rivals: [400, 400] }).q, 400);
  near(F.fairExamBest(f, { kind: "entry", rivals: [400, 400, 300] }).q, 250);
  const d = { kind: "cartel", rivals: [320, 200, 200], quota: 200 };
  const best = F.fairExamBest(f, d);
  assert.equal(best.join, false); near(best.q, 440);
  near(F.fairExamMargin(f, d, { q: 440, join: false }).margin, 9680);
  near(F.fairExamMargin(f, d, { q: 200, join: true }).margin, 6800 - 2000);
});

test("экзамен: «всегда 400» — серебро не чаще 10% попыток (случайное попадание); «вступил и держит квоту» — без медали", () => {
  const f = examFair();
  const run = (pick, seed) => { let ex = F.fairExamNew(f, seed); for (const d of ex.days) ex = F.fairExamPlayDay(f, ex, pick(d)).exam; return F.fairExamResult(ex); };
  let silver400 = 0, silverJoin = 0;
  for (let s = 0; s < 200; s++) {
    const r1 = run(() => ({ q: 400, join: false }), 300 + s);
    if (r1.medal && r1.medal.id !== "bronze") silver400++;
    const r2 = run((d) => (d.kind === "cartel" ? { q: d.quota, join: true } : F.fairExamBest(f, d)), 300 + s);
    if (r2.medal) silverJoin++;
  }
  assert.ok(silver400 <= 20, `«всегда 400»: серебро в ${silver400} из 200`);
  assert.equal(silverJoin, 0, `сговор: медаль в ${silverJoin} из 200`);
});
