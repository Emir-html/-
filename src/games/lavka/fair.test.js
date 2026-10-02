/* Тесты уровня 2 «Ярмарка» и каркаса уровней: node --test fair.test.js
   Курно, вход фирм, картель как повторяющаяся дилемма, Штакельберг, капитал между уровнями. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fair.js";
import * as L from "./model.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const { A, B, c } = F.FAIR;

test("Курно с n фирмами: q* = (A − c)/(B(n + 1)), P* = (A + n·c)/(n + 1) → c при n → ∞", () => {
  for (const n of [1, 2, 3, 4, 10]) {
    const eq = F.fairCournot(n);
    near(eq.q, (A - c) / (B * (n + 1)));
    near(eq.P, (A + n * c) / (n + 1));
  }
  assert.ok(F.fairCournot(200).P - c < 1);
  near(F.fairCournot(1).P, 120); // монополия
});

test("наилучший ответ: q = (A − c − B·Q_других)/(2B); итерации ответов сходятся к Нэшу", () => {
  near(F.fairBR(60), (A - c - B * 60) / (2 * B));
  assert.equal(F.fairBR(500), 0);
  let qp = 80, qs = 20;
  for (let i = 0; i < 60; i++) { const np = F.fairBR(qs), ns = F.fairBR(qp); qp = np; qs = ns; }
  near(qp, F.fairCournot(2).q, 1e-3); near(qs, F.fairCournot(2).q, 1e-3);
});

test("день ярмарки: цена расчищает рынок, прибыль = (P − c)·q − аренда; шум только в A", () => {
  const st = F.fairNewState(5000);
  st.q = 50;
  const { next, report } = F.fairSimulate(st, L.lavkaRng(1));
  const Q = report.q + report.rivals.reduce((s, r) => s + r.q, 0);
  near(report.P, Math.max(0, report.A - B * Q));
  near(report.profit, (report.P - c) * report.q - F.FAIR.rent);
  near(report.interest, st.cash * F.FAIR.rate); // остаток на счёте приносит r в день
  assert.ok(Math.abs(report.A / A - 1) <= 0.05 + 1e-9);
  assert.equal(next.cash, Math.round(st.cash + report.profit + report.dividend + report.reward + report.interest));
  assert.equal(next.day, 2);
});

test("Семён играет равновесие Курно; при лидерстве отвечает на сегодняшний объём (Штакельберг)", () => {
  const st = F.fairNewState(5000); st.lastQ = 60; st.q = 100;
  const { report } = F.fairSimulate(st, L.lavkaRng(2));
  near(report.rivals[0].q, F.fairCournot(2).q);
  st.leader = true;
  const r2 = F.fairSimulate(st, L.lavkaRng(2)).report;
  near(r2.rivals[0].q, F.fairBR(100));
  const lead = F.fairStackelberg(1);
  near(lead.qL, (A - c) / (2 * B)); near(lead.qF, (A - c) / (4 * B));
  assert.ok(lead.profitL > (F.fairCournot(2).P - c) * F.fairCournot(2).q, "лидер зарабатывает больше, чем в Курно");
});

test("вход фирм: пока прибыль конкурентов выше аренды — входят; останавливается на 4 фирмах", () => {
  let st = F.fairNewState(1e6); st.chapter = 2; st.day = 8;
  let maxFirms = 0;
  for (let d = 0; d < 80 && st.chapter === 2; d++) {
    const Qr = st.rivals.reduce((s, r) => s + r.q, 0);
    st.q = Math.round(F.fairBR(Qr));
    st = F.fairSimulate(st, L.lavkaRng(100 + d)).next;
    if (st.chapter === 2) maxFirms = Math.max(maxFirms, st.rivals.length + 1);
  }
  assert.equal(maxFirms, 4, `фирм: ${maxFirms}`);
  const pi = (n) => (F.fairCournot(n).P - c) * F.fairCournot(n).q;
  assert.ok(pi(4) >= F.FAIR.rent && pi(5) < F.FAIR.rent, "граница входа — там, где прибыль < аренды");
});

test("картель: верность выгоднее обмана на горизонте наказания (дилемма заключённого)", () => {
  const k = F.fairCartelMath();
  near(k.qCartel, (A - c) / (4 * B));
  assert.ok(k.cheatGain > 0, "обмануть один день выгодно");
  assert.ok(k.cheatGain < k.punishLoss, `выигрыш ${k.cheatGain} < потери ${k.punishLoss}`);
  let st = F.fairNewState(1e5); st.chapter = 3; st.day = 15; st.cartel = { active: true, punish: 0, faithful: 0 };
  st.lastQ = k.qCartel; st.q = 60;
  const r = F.fairSimulate(st, L.lavkaRng(5));
  near(r.report.rivals[0].q, k.qCartel); // сегодня Семён ещё верен
  assert.ok(r.report.cheated && r.next.cartel.punish === F.FAIR.punishDays);
  const r2 = F.fairSimulate({ ...r.next, q: k.qCartel }, L.lavkaRng(6));
  near(r2.report.rivals[0].q, F.fairCournot(2).q); // наказание: возврат к Курно
});

test("главы ярмарки открываются по дням (рынок не ждёт): 2 — с 8-го, 3 — с 15-го; в главе 3 рынок на двоих", () => {
  let st = F.fairNewState(1e5); st.day = 7;
  assert.equal(F.fairSimulate(st, L.lavkaRng(1)).next.chapter, 2, "без цели «Нэш» — тоже");
  st = F.fairNewState(1e5); st.day = 14; st.chapter = 2;
  st.rivals = [1, 2, 3].map((i) => ({ name: "К" + i, q: 30 }));
  const n = F.fairSimulate(st, L.lavkaRng(1)).next;
  assert.equal(n.chapter, 3); assert.equal(n.rivals.length, 1); assert.ok(n.cartel && n.cartel.active);
});

test("капитал: цена продажи = аннуитет D̄(медаль), PV дивидендов на тех же условиях равна цене", () => {
  const r = F.FAIR.rate, N = F.FAIR.dividendDays;
  for (const m of ["gold", "silver", "bronze"]) {
    const D = F.LEVEL1_DIVIDEND[m];
    const price = F.fairSalePrice(m);
    near(price, D * (1 - (1 + r) ** -N) / r, 1e-6);
    let pv = 0; for (let t = 1; t <= N; t++) pv += D / (1 + r) ** t;
    near(pv, price, 1e-6);
  }
  assert.ok(F.fairSalePrice("gold") > F.fairSalePrice("silver"));
});

test("переход на уровень 2: только с медалью; продать → деньги сразу, оставить → дивиденд каждый день", () => {
  const st = L.lavkaNewState(); st.day = 25; st.chapter = 3; st.cash = 90000;
  assert.equal(F.levelFinish(st, "sell"), null, "без медали нельзя");
  st.examBest = { eff: 0.9, medal: "silver", attempts: 2 };
  const sold = F.levelFinish(st, "sell");
  assert.equal(sold.level, 2);
  assert.equal(sold.fair.cash, F.FAIR.grant + Math.round(F.fairSalePrice("silver")));
  assert.equal(sold.cash, st.cash, "касса лавки остаётся в архиве уровня 1");
  const kept = F.levelFinish(st, "keep");
  assert.equal(kept.fair.cash, F.FAIR.grant);
  assert.equal(kept.fair.subsidiaries[0].dividend, F.LEVEL1_DIVIDEND.silver);
  const day = F.fairSimulate({ ...kept.fair, q: 50 }, L.lavkaRng(3));
  assert.equal(day.report.dividend, F.LEVEL1_DIVIDEND.silver);
  assert.equal(day.next.subsidiaries[0].daysLeft, F.FAIR.dividendDays - 1);
});

test("своя мука: асимметричный Курно — у кого MC ниже, тот выпускает больше; Нэш = взаимные наилучшие ответы", () => {
  const eq = F.fairCournotAsym(30, 40);
  near(eq.qp, (F.FAIR.A - 2 * 30 + 40) / 3); near(eq.qr, (F.FAIR.A - 2 * 40 + 30) / 3);
  assert.ok(eq.qp > eq.qr && eq.profitP > F.fairCournot(2).profit);
  let st = F.fairNewState(20000);
  st = F.fairBuy(st, "flour");
  assert.equal(st.cash, 20000 - 12000); assert.ok(st.upgrades.flour);
  assert.equal(F.fairBuy(F.fairNewState(1000), "flour").upgrades?.flour, undefined, "не хватает денег");
  assert.equal(F.fairBuy(F.fairNewState(1e5), "leader").upgrades?.leader, undefined, "лидерство — только в главе 3");
  const day = F.fairSimulate({ ...st, q: Math.round(eq.qp), lastQ: Math.round(eq.qp) }, L.lavkaRng(4)).report;
  assert.equal(day.mc, 30);
  assert.ok(day.newGoals.includes("nash"), "взаимные наилучшие ответы при асимметрии — тоже Нэш");
  const payback = F.FAIR_UPGRADES.find((u) => u.id === "flour").cost / (eq.profitP - F.fairCournot(2).profit);
  assert.ok(payback >= 10 && payback <= 20, `окупаемость ${payback.toFixed(1)} дн.`);
});

test("постоянный «монопольный» объём против Семёна-Курно проигрывает наилучшему ответу", () => {
  const Qr = F.fairCournot(2).q, pi = (q) => (F.FAIR.A - F.FAIR.B * (q + Qr) - F.FAIR.c) * q;
  assert.ok(pi(80) < pi(F.fairBR(Qr)) - 300);
});

test("продать или оставить дочку: без вложений стоимость одинакова (деньги на счёте приносят r)", () => {
  const worth = (choice) => {
    const l1 = L.lavkaNewState(); l1.examBest = { eff: 0.9, medal: "silver", attempts: 1 };
    let st = F.levelFinish(l1, choice).fair;
    for (let d = 0; d < 30; d++) st = F.fairSimulate({ ...st, q: 0 }, L.lavkaRng(d)).next; // торговли нет — только капитал
    const r = F.FAIR.rate;
    return st.cash + (st.subsidiaries || []).reduce((s, x) => s + x.dividend * (1 - (1 + r) ** -x.daysLeft) / r, 0);
  };
  const a = worth("sell"), b = worth("keep");
  assert.ok(Math.abs(a - b) / a < 0.02, `продать ${Math.round(a)} vs дочка ${Math.round(b)}`);
});

/* ===== Ревью экономиста (72%) ===== */

test("MR и наилучший ответ считаются от одного (среднего) A: при q = BR вердикт говорит «≈»", () => {
  const st = F.fairNewState(1e4); st.q = Math.round(F.fairBR(F.fairCournot(2).q));
  for (let s = 0; s < 10; s++) {
    const r = F.fairSimulate(st, L.lavkaRng(s)).report;
    near(r.mrTrue, F.FAIR.A - F.FAIR.B * r.Qr - 2 * F.FAIR.B * r.q);
    assert.match(F.fairVerdict(r), /≈/);
  }
});

test("вердикт лидера учитывает реакцию последователя: при q = q_L — «≈», а не «печь меньше»", () => {
  const st = F.fairNewState(1e4); st.chapter = 3; st.leader = true; st.q = 80;
  const r = F.fairSimulate(st, L.lavkaRng(1)).report;
  near(r.br, 80); near(r.mrTrue, F.FAIR.c);
  const v = F.fairVerdict(r);
  assert.match(v, /≈/); assert.ok(!/меньше/.test(v), v); assert.match(v, /реак|последоват|Штакельберг/i);
});

test("вердикт в картеле говорит о наказании и условии устойчивости δ", () => {
  const st = F.fairNewState(1e4); st.chapter = 3; st.cartel = { active: true, punish: 0, faithful: 0 }; st.q = 40;
  const v = F.fairVerdict(F.fairSimulate(st, L.lavkaRng(1)).report);
  assert.match(v, /наказан/i); assert.match(v, /δ/);
});

test("картель при разных MC: квоты пропорциональны Курно, оба выигрывают, обман невыгоден", () => {
  const k = F.fairCartelMath(30), cn = F.fairCournotAsym(30, 40);
  assert.ok(k.qPlayer > k.qRival);
  assert.ok(k.cartelProfit > cn.profitP && k.rivalProfit > cn.profitR, "картель лучше Курно для обоих");
  assert.ok(k.cheatGain > 0 && k.cheatGain < k.punishLoss, `обман ${k.cheatGain} < потери ${k.punishLoss}`);
  const eq = F.fairCartelMath(40); near(eq.qPlayer, 40); near(eq.qRival, 40);
});

test("вход при своей муке: прибыль конкурентов — с их MC, граница по асимметричному Курно", () => {
  const nash = (n, cp) => F.fairNashAsym(n, cp);
  near(nash(2, 40).qr, F.fairCournot(2).q);
  near(nash(2, 30).qp, F.fairCournotAsym(30, 40).qp); near(nash(2, 30).qr, F.fairCournotAsym(30, 40).qr);
  let st = F.fairNewState(1e6); st.chapter = 2; st.day = 8; st.upgrades = { flour: true };
  let maxFirms = 0;
  for (let d = 0; d < 7; d++) {
    st.q = Math.round(F.fairBR(F.fairRivalsToday(st), 30));
    st = F.fairSimulate(st, L.lavkaRng(300 + d)).next; maxFirms = Math.max(maxFirms, st.rivals.length + 1);
  }
  let n = 2; while (nash(n + 1, 30).profitR > F.FAIR.rent) n++;
  assert.ok(maxFirms <= n, `фирм ${maxFirms}, граница ${n}`);
});

test("утренний прилавок окупается за 10–20 дней против Курно", () => {
  const u = F.FAIR_UPGRADES.find((x) => x.id === "leader");
  const gain = F.fairStackelberg(1).profitL - F.fairCournot(2).profit;
  const payback = u.cost / gain;
  assert.ok(payback >= 10 && payback <= 20, `окупаемость ${payback.toFixed(1)}`);
});
