/* «Холдинг» — уровень 5 «Пути компании», финансовый финал (чистая логика, без React).
   Сценарий: docs/scenario/08_УРОВЕНЬ_5_ХОЛДИНГ.md, ПАРАМЕТРЫ.md; ревью: docs/reviews/2026-10-02-scenario.md.

   Новый рычаг — РАСПРЕДЕЛЕНИЕ КАПИТАЛА. Дочки прошлых уровней платят дивиденды сами; игрок решает, куда идут деньги:
     Неделя 1 «Совет»: портфель проектов в бюджете 500 000 (NPV, PI, неделимость), налоговый режим УСН.
     Неделя 2 «Риск»: кредит (аннуитет / дифференцированный), валютный форвард, страховка от паводка.
     Неделя 3 «Вода»: красный флаг (перенос запасов), складчина на дамбу (общественное благо), половодье.
   Ставка r = 2% в день (игровая). Правки экономиста:
     - кредит: при ставке кредита = ставке депозита PV схем одинаков — решает ликвидность, а не «переплата»;
     - премия страховки платится в день начала половодья (18-й) — та же дата, что и убыток: дисконт не искажает сравнение;
       экстренный кредит после убытка — 5% в день (по обычной ставке после убытка не дают), простые проценты на 20 дней;
     - красный флаг — сигнал: с вероятностью 0,6 он появляется, и тогда паводок с вероятностью 0,5; без флага паводка нет
       (итого 0,3). Перенести запасы можно только после флага — ценность информации = выгода «переносить только когда нужно»;
     - дамба: после флага p = 0,5, взнос героя решающий — выгоден и эгоисту (это не «чистый» безбилетник);
     - курс через 10 дней 80 или 110 поровну (по сиду), форвард 96 — цену назначает Марк Ильич (депозита в у. е. нет).
   Финал: продажа холдинга Плотникову (по медали, «лимоны») или Железновой (95% истинной стоимости после аудита). */
import { lavkaRng, lavkaExamMedal } from "./model.js";
import { CAPITAL, annuity, capitalPayDividends, capitalTransition } from "./capital.js";

const HOLDING = {
  rate: 0.02, devFund: 500000, budget: 500000, projectDays: 30, approveBy: 7, oracleDays: 7, levelDays: 21, examFromDay: 22,
  projects: [
    { id: "P1", name: "Кофейня на вокзале", cost: 200000, cf: 12000, fromDay: 2 },
    { id: "P5", name: "Терраса", cost: 60000, cf: 3500, fromDay: 2 },
    { id: "P6", name: "Сайт и доставка", cost: 80000, cf: 3000, fromDay: 2 },
    { id: "P3", name: "Лавка Семёна", cost: 120000, cf: 7000, fromDay: 4, semyon: true },
    { id: "P2", name: "Линия джема №2", cost: 300000, cf: 16000, fromDay: 5 },
    { id: "P4", name: "Холодильный склад", cost: 150000, cf: 8000, fromDay: 5 },
  ],
  tax: { R: 1800000, E: 1275000, fromDay: 6, payDay: 21 },
  loan: { amount: 300000, n: 10, rate: 0.02, day: 8 },
  fx: { usd: 1000, spot0: 90, lo: 80, hi: 110, forward: 96, day: 9, payDay: 19 },
  insurance: { p: 0.3, load: 1.25, deductible: 20000, fromDay: 10, untilDay: 14 },
  losses: { cafes: 150000, factory: 250000 },
  flagDay: 15, pFlag: 0.6, pFloodIfFlag: 0.5, floodDay: 18,
  move: { cost: 10000, cut: 0.4 }, dam: { fee: 20000, cut: 0.6, day: 16 },
  emergency: { rate: 0.05, days: 20 },
  /* Средний «эффективный» дневной поток продающих холдингов: истинная стоимость/a(30). Типичный холдинг к продаже —
     дочки ≈ 5 000 ₽/день и проекты с ≈ 12 днями потока: ≈ 17 700; лимоны — × 0,908 (как в capital.js). До калибровки. */
  cityD: 16000,
};

/* ===== Финансовая математика ===== */
const holdingPV = (p, r = HOLDING.rate, T = HOLDING.projectDays) => p.cf * annuity(T, r);
const holdingNPV = (p, r, T) => holdingPV(p, r, T) - p.cost;
const holdingPI = (p, r, T) => holdingPV(p, r, T) / p.cost;
const holdingPayback = (p) => p.cost / p.cf;
/* Лучший набор неделимых проектов в бюджете — полным перебором (проекты с NPV < 0 не берут). */
function holdingBestSet(projects, budget, r, T) {
  let best = { ids: [], npv: 0, cost: 0 };
  for (let m = 1; m < 1 << projects.length; m++) {
    const set = projects.filter((_, i) => m & (1 << i)), cost = set.reduce((s, p) => s + p.cost, 0);
    if (cost > budget) continue;
    const npv = set.reduce((s, p) => s + holdingNPV(p, r, T), 0);
    if (npv > best.npv + 1e-9) best = { ids: set.map((p) => p.id), npv, cost };
  }
  return best;
}
/* Жадный выбор по PI — ловушка неделимости. */
function holdingGreedyPI(projects, budget, r, T) {
  let left = budget; const ids = [];
  for (const p of [...projects].sort((a, b) => holdingPI(b, r, T) - holdingPI(a, r, T))) if (holdingNPV(p, r, T) > 0 && p.cost <= left) { ids.push(p.id); left -= p.cost; }
  return { ids, npv: projects.filter((p) => ids.includes(p.id)).reduce((s, p) => s + holdingNPV(p, r, T), 0) };
}
/* График платежей: аннуитет (равные) или дифференцированный (равные доли долга + проценты на остаток). */
function holdingSchedule({ amount, rate, n }, kind) {
  if (kind === "annuity") { const a = (amount * rate) / (1 - (1 + rate) ** -n); return Array(n).fill(a); }
  return Array.from({ length: n }, (_, t) => amount / n + (amount - (amount * t) / n) * rate);
}
/* PV платежей по ставке альтернативы r: при r = ставке кредита обе схемы стоят ровно сумму кредита. */
const holdingSchedulePV = (pays, r = HOLDING.rate) => pays.reduce((s, x, t) => s + x / (1 + r) ** (t + 1), 0);
/* УСН: 6% с доходов или 15% с (доходы − расходы), но не меньше 1% доходов. Упрощено: без страховых взносов и НДС. */
const holdingTax = ({ R, E }, regime) => (regime === "usn6" ? 0.06 * R : Math.max(0.15 * (R - E), 0.01 * R));
const holdingTaxBest = (t) => (holdingTax(t, "usn6") <= holdingTax(t, "usn15") ? "usn6" : "usn15");

/* ===== Страховка и паводок ===== */
/* Под водой — то, что холдинг держит у реки: кофейни (дочка уровня 3) и цех (дочка уровня 4). */
function holdingExposure(h) {
  const subs = h.subsidiaries || [];
  return { cafes: subs.some((s) => s.level === 3) ? HOLDING.losses.cafes : 0, factory: subs.some((s) => s.level === 4) ? HOLDING.losses.factory : 0 };
}
/* Премии: полная = нагрузка × p × убыток; с франшизой — нагрузка × p × (убыток − франшиза) по каждому объекту. */
function holdingPolicies(ex, p = HOLDING.insurance.p, load = HOLDING.insurance.load, ded = HOLDING.insurance.deductible) {
  const objs = Object.values(ex).filter((x) => x > 0), loss = objs.reduce((s, x) => s + x, 0);
  return { loss, full: load * p * loss, deductible: load * p * objs.reduce((s, x) => s + Math.max(0, x - ded), 0), dedTotal: objs.length * ded, objects: objs.length };
}
/* Издержки экстренного кредита на нехватку S: простые 5% в день на 20 дней = S (сверх возврата самого долга). */
const holdingEmergencyCost = (S, e = HOLDING.emergency) => Math.max(0, S) * e.rate * e.days;
/* Ожидаемые издержки варианта страховки, если в день паводка в кассе cash (премия платится в тот же день). */
function holdingInsuranceCost(choice, { loss, full, deductible, dedTotal }, cash, p = HOLDING.insurance.p) {
  const paid = choice === "full" ? full : choice === "deductible" ? deductible : 0;
  const uncovered = choice === "full" ? 0 : choice === "deductible" ? dedTotal : loss;
  const afterNo = cash - paid, afterFlood = afterNo - uncovered;
  return paid + p * (uncovered + holdingEmergencyCost(-afterFlood)) + (1 - p) * holdingEmergencyCost(-afterNo);
}
function holdingInsuranceBest(pol, cash, p) {
  return ["none", "deductible", "full"].map((c) => ({ c, v: holdingInsuranceCost(c, pol, cash, p) })).sort((a, b) => a.v - b.v)[0].c;
}

/* ===== Состояние, решения, день ===== */
const HOLDING_GOALS = [
  { id: "portfolio", emoji: "📊", title: "Портфель", desc: "Утверди набор проектов с максимальным NPV в бюджете 500 000 (все шесть уже на доске).", reward: 10000 },
  { id: "tax", emoji: "🧾", title: "Доля расходов", desc: "Выбери режим УСН с меньшим налогом: граница E/R = 60%.", reward: 5000 },
  { id: "insurance", emoji: "☂️", title: "Кому нужна страховка", desc: "Выбери вариант с наименьшими ожидаемыми издержками с учётом своей кассы в день паводка.", reward: 10000 },
  { id: "flag", emoji: "🚩", title: "Ценность информации", desc: "После красного флага перенеси запасы.", reward: 5000 },
  { id: "dam", emoji: "🧱", title: "Мешки с песком", desc: "Скинься на дамбу — твой взнос решающий.", reward: 5000 },
];
const HOLDING_CHAPTERS = [
  { n: 1, title: "Совет", fromDay: 1, goal: "portfolio" },
  { n: 2, title: "Риск", fromDay: 8, goal: "insurance" },
  { n: 3, title: "Вода", fromDay: 15, goal: null },
];

function holdingNewState(cash = HOLDING.devFund, seed = 1, opts = {}) {
  const rng = lavkaRng(seed * 7919 + 17);
  const flag = rng() < HOLDING.pFlag, flood = flag && rng() < HOLDING.pFloodIfFlag, spot = rng() < 0.5 ? HOLDING.fx.lo : HOLDING.fx.hi;
  return { v: 2, level: 5, day: 1, chapter: 1, seed, cash: Math.round(cash), subsidiaries: [], projects: [], approved: null,
    taxRegime: null, loan: null, hedged: null, insurance: null, moved: false, damPaid: null, semyonTrust: opts.semyonTrust !== false,
    world: { flag, flood, spot }, emergencyDebt: 0, goals: {}, history: [], flags: {}, last: null };
}
/* Проекты на доске сегодня (P3 — только если Семён тебе доверяет). */
const holdingBoard = (h) => HOLDING.projects.filter((p) => h.day >= p.fromDay && (!p.semyon || h.semyonTrust));

/* Утвердить портфель (один раз, до 7-го дня): оплата сразу, поток — со следующего дня 30 дней. */
function holdingApprove(h, ids) {
  if (h.approved || h.day > HOLDING.approveBy) return h;
  const board = holdingBoard(h), set = board.filter((p) => ids.includes(p.id)), cost = set.reduce((s, p) => s + p.cost, 0);
  if (cost > HOLDING.budget || cost > h.cash) return h;
  const best = holdingBestSet(board, HOLDING.budget), npv = set.reduce((s, p) => s + holdingNPV(p), 0);
  const allOnBoard = board.length === HOLDING.projects.filter((p) => !p.semyon || h.semyonTrust).length;
  const right = allOnBoard && npv >= best.npv - 1;
  const goals = { ...h.goals }; let cash = h.cash - cost;
  if (right && !goals.portfolio) { goals.portfolio = h.day; cash += HOLDING_GOALS[0].reward; }
  return { ...h, cash, goals, approved: { day: h.day, ids: set.map((p) => p.id), npv, best: best.npv, right },
    projects: set.map((p) => ({ id: p.id, name: p.name, cf: p.cf, daysLeft: HOLDING.projectDays })) };
}
function holdingChooseTax(h, regime) {
  if (h.taxRegime || h.day < HOLDING.tax.fromDay) return h;
  const goals = { ...h.goals }; let cash = h.cash;
  if (regime === holdingTaxBest(HOLDING.tax) && !goals.tax) { goals.tax = h.day; cash += HOLDING_GOALS[1].reward; }
  return { ...h, cash, goals, taxRegime: regime };
}
/* Кредит 300 000 на 10 дней под 2%: «none» — не брать. Платежи — со следующего дня. */
function holdingTakeLoan(h, kind) {
  if (h.loan || h.day < HOLDING.loan.day) return h;
  if (kind === "none") return { ...h, loan: { kind: "none" } };
  const L = HOLDING.loan, pays = holdingSchedule({ amount: L.amount, rate: L.rate, n: L.n }, kind);
  return { ...h, cash: h.cash + L.amount, loan: { kind, pays, paid: 0 } };
}
function holdingHedge(h, yes) { return h.hedged != null || h.day < HOLDING.fx.day ? h : { ...h, hedged: !!yes }; }
/* Прогноз кассы на день паводка — для решения о страховке (дивиденды, проекты, кредит, проценты). */
function holdingCashForecast(h, toDay = HOLDING.floodDay) {
  let cash = h.cash, subs = h.subsidiaries, projects = h.projects, loan = h.loan;
  for (let d = h.day; d < toDay; d++) {
    let flow = 0;
    subs = subs.map((s) => { if (s.daysLeft > 0) { flow += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; } return s; });
    projects = projects.map((p) => { if (p.daysLeft > 0) { flow += p.cf; return { ...p, daysLeft: p.daysLeft - 1 }; } return p; });
    if (loan && loan.pays && loan.paid < loan.pays.length) { flow -= loan.pays[loan.paid]; loan = { ...loan, paid: loan.paid + 1 }; }
    if (d === HOLDING.fx.payDay) flow -= HOLDING.fx.usd * (h.hedged ? HOLDING.fx.forward : (HOLDING.fx.lo + HOLDING.fx.hi) / 2);
    cash = cash + flow + cash * HOLDING.rate;
  }
  return cash;
}
function holdingInsure(h, choice) {
  const I = HOLDING.insurance;
  if (h.insurance || h.day < I.fromDay || h.day > I.untilDay) return h;
  const pol = holdingPolicies(holdingExposure(h));
  if (pol.loss === 0) return { ...h, insurance: { choice: "none", nothing: true } };
  const forecast = holdingCashForecast(h), best = holdingInsuranceBest(pol, forecast);
  const costs = Object.fromEntries(["none", "deductible", "full"].map((c) => [c, holdingInsuranceCost(c, pol, forecast)]));
  const goals = { ...h.goals }; let cash = h.cash;
  const right = costs[choice] <= costs[best] + 1;
  if (right && !goals.insurance) { goals.insurance = h.day; cash += HOLDING_GOALS[2].reward; }
  return { ...h, cash, goals, insurance: { choice, best, forecast, costs, right, premium: choice === "full" ? pol.full : choice === "deductible" ? pol.deductible : 0 } };
}
/* После красного флага: перенести запасы (только когда флаг есть). */
function holdingMove(h) {
  if (h.moved || !h.world.flag || h.day < HOLDING.flagDay || h.day >= HOLDING.floodDay) return h;
  const goals = { ...h.goals }; let cash = h.cash - HOLDING.move.cost;
  if (!goals.flag) { goals.flag = h.day; cash += HOLDING_GOALS[3].reward; }
  return { ...h, cash, goals, moved: true };
}
/* Складчина на дамбу (после флага): двое платят всегда, Семён и ещё двое — если платит герой; строится при ≥ 4 взносах. */
function holdingDam(h, pay) {
  if (h.damPaid != null || !h.world.flag || h.day < HOLDING.dam.day || h.day >= HOLDING.floodDay) return h;
  const goals = { ...h.goals }; let cash = h.cash - (pay ? HOLDING.dam.fee : 0);
  if (pay && !goals.dam) { goals.dam = h.day; cash += HOLDING_GOALS[4].reward; }
  return { ...h, cash, goals, damPaid: !!pay, damBuilt: !!pay };
}
/* Убыток паводка по объектам с учётом переноса запасов, дамбы и страховки. */
function holdingFloodLoss(h) {
  const ex = holdingExposure(h), m = h.moved ? 1 - HOLDING.move.cut : 1;
  const cafes = ex.cafes * m * (h.damBuilt ? 1 - HOLDING.dam.cut : 1), factory = ex.factory * m;
  const ins = h.insurance && h.insurance.choice;
  const cover = (x) => (ins === "full" ? x : ins === "deductible" ? Math.max(0, x - HOLDING.insurance.deductible) : 0);
  const gross = cafes + factory, payout = cover(cafes) + cover(factory);
  return { cafes, factory, gross, payout, net: gross - payout };
}

function holdingNextDay(h) {
  const day = h.day, pay = capitalPayDividends(h.subsidiaries);
  let projectCF = 0;
  const projects = (h.projects || []).map((p) => { if (p.daysLeft > 0) { projectCF += p.cf; return { ...p, daysLeft: p.daysLeft - 1 }; } return p; });
  let loanPay = 0, loan = h.loan;
  if (loan && loan.pays && loan.paid < loan.pays.length) { loanPay = loan.pays[loan.paid]; loan = { ...loan, paid: loan.paid + 1 }; }
  const interest = h.cash * HOLDING.rate;
  let events = [], fx = 0, tax = 0, premium = 0, flood = null, emergency = 0;
  if (day === HOLDING.fx.payDay) { const rate = h.hedged ? HOLDING.fx.forward : h.world.spot; fx = HOLDING.fx.usd * rate; events.push("fx"); }
  if (day === HOLDING.tax.payDay && h.taxRegime) { tax = holdingTax(HOLDING.tax, h.taxRegime); events.push("tax"); }
  if (day === HOLDING.floodDay && h.insurance && h.insurance.premium) premium = h.insurance.premium;
  if (day === HOLDING.floodDay && h.world.flood) { flood = holdingFloodLoss(h); events.push("flood"); }
  let cash = h.cash + pay.dividend + projectCF - loanPay + interest - fx - tax - premium - (flood ? flood.net : 0);
  let emergencyDebt = h.emergencyDebt || 0;
  if (day === HOLDING.floodDay && cash < 0) { emergency = -cash; emergencyDebt += emergency * (1 + HOLDING.emergency.rate * HOLDING.emergency.days); cash = 0; events.push("emergency"); }
  const nd = day + 1;
  let chapter = h.chapter, newChapter = null;
  const up = HOLDING_CHAPTERS[chapter];
  if (up && nd >= up.fromDay) { chapter += 1; newChapter = chapter; }
  const report = { day, dividend: pay.dividend, projectCF, loanPay, interest, fx, tax, premium, flood, emergency, events, newChapter,
    net: cash - h.cash, spot: day === HOLDING.fx.payDay ? h.world.spot : null };
  const next = { ...h, day: nd, chapter, cash: Math.round(cash), subsidiaries: pay.subsidiaries, projects, loan, emergencyDebt,
    history: [...(h.history || []), { day, net: Math.round(report.net) }].slice(-60), last: report, at: Date.now() };
  return { next, report };
}

/* Дневной поток холдинга (дивиденды дочек + проекты) — то, что покупатель получает. */
const holdingDailyFlow = (h) => (h.subsidiaries || []).filter((s) => s.daysLeft > 0).reduce((s, x) => s + x.dividend, 0)
  + (h.projects || []).filter((p) => p.daysLeft > 0).reduce((s, p) => s + p.cf, 0);
/* Истинная стоимость холдинга для покупателя: дочки — a(30) дневных дивидендов (как в capital.js), проекты — PV
   оставшихся дней; минус невозвращённый экстренный кредит (к сроку). */
function holdingTrueValue(h) {
  const r = HOLDING.rate;
  const subs = (h.subsidiaries || []).reduce((s, x) => s + x.dividend * annuity(CAPITAL.terminalDays, r), 0);
  const proj = (h.projects || []).reduce((s, p) => s + p.cf * annuity(p.daysLeft, r), 0);
  return subs + proj;
}
/* Финал: Плотников по медали (ē·D̄_город·a(30)), Железнова — 95% истинной стоимости после аудита. */
function holdingOffers(h, medal) {
  const a30 = annuity(CAPITAL.terminalDays, HOLDING.rate), trueValue = holdingTrueValue(h);
  return { trueValue, plotnikov: (CAPITAL.medalE[medal] || 0) * HOLDING.cityD * a30, zheleznova: 0.95 * trueValue };
}
function holdingSell(h, buyer) {
  const medal = h.examBest && h.examBest.medal;
  if (!medal || h.sold) return h;
  const o = holdingOffers(h, medal), price = buyer === "zheleznova" ? o.zheleznova : o.plotnikov;
  const debt = h.emergencyDebt || 0;
  return { ...h, sold: { buyer, price: Math.round(price), offers: o, day: h.day }, cash: Math.round(h.cash + price - debt), emergencyDebt: 0,
    finalCapital: Math.round(h.cash + price - debt) };
}

/* ===== Экзамен уровня 5 =====
   3 задачи (числа по сиду), сценарии не зависят от прошлых решений:
     1. Портфель — оценка = NPV(набор)/NPV(лучший) (NPV линеен по выбору); сверх бюджета — 0.
     2. Кредит + налог — издержки = налог + PV платежей по ставке альтернативы 2% + экстренный кредит, если первые
        платежи больше свободных денег; оценка = издержки эталона / издержки игрока.
     3. Страховка — ожидаемые издержки с учётом кассы и экстренного кредита; оценка = min / выбранного. */
const HOLDING_EXAM_KINDS = [
  { kind: "portfolio", title: "Новый бюджет" },
  { kind: "finance", title: "Кредит и налог" },
  { kind: "insurance", title: "Паводок" },
];
const holdingExamOpen = (h) => (h.chapter || 1) >= 3 && h.day >= HOLDING.examFromDay;
function holdingExamNew(h, seed) {
  const rng = lavkaRng(seed), pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const ids = ["A", "B", "C", "D", "E", "F"];
  const projects = ids.map((id) => { const cost = pick(4, 30) * 10000, pi = 0.8 + rng() * 0.6; return { id, cost, cf: Math.round((cost * pi) / annuity(30, 0.02) / 100) * 100 }; });
  const budget = pick(40, 60) * 10000;
  const portfolio = { kind: "portfolio", title: "Новый бюджет", projects, budget,
    text: `Бюджет ${budget.toLocaleString("ru-RU")} ₽. Проекты на 30 дней, ставка 2% в день. Какие взять?` };
  const loanRate = [0.015, 0.02, 0.025][pick(0, 2)], free = pick(30, 40) * 1000, R = pick(12, 24) * 100000;
  let er = 0.45 + rng() * 0.35; if (Math.abs(er - 0.6) < 0.04) er = er < 0.6 ? 0.55 : 0.65;
  const finance = { kind: "finance", title: "Кредит и налог", loanRate, free, tax: { R, E: Math.round((R * er) / 1000) * 1000 } };
  finance.text = `Кредит 300 000 на 10 дней под ${String(loanRate * 100).replace(".", ",")}% в день; деньги на счёте приносят 2%. В первые три дня свободных денег ${free.toLocaleString("ru-RU")} ₽ в день — на нехватку дают только экстренный кредит под 5% на 20 дней. Какая схема? И режим налога: доходы ${R.toLocaleString("ru-RU")} ₽, расходы ${finance.tax.E.toLocaleString("ru-RU")} ₽.`;
  const p = [0.2, 0.25, 0.3, 0.35][pick(0, 3)], l1 = pick(10, 20) * 10000, l2 = pick(15, 30) * 10000, cash = pick(10, 60) * 10000;
  const insurance = { kind: "insurance", title: "Паводок", p, ex: { cafes: l1, factory: l2 }, cash,
    text: `Паводок с вероятностью ${String(p).replace(".", ",")}: убыток кофеен ${l1.toLocaleString("ru-RU")}, цеха ${l2.toLocaleString("ru-RU")}. В кассе в день паводка будет ${cash.toLocaleString("ru-RU")} ₽. Полис полный или с франшизой 20 000 на объект (нагрузка 25%), экстренный кредит — 5% в день на 20 дней. Страховать?` };
  return { seed, results: [], days: [portfolio, finance, insurance] };
}
/* Издержки решения «кредит + налог». */
function holdingFinanceCost(d, ans) {
  const pays = holdingSchedule({ amount: 300000, rate: d.loanRate, n: 10 }, ans.scheme);
  const short = pays.slice(0, 3).reduce((s, x) => s + Math.max(0, x - d.free), 0);
  return holdingTax(d.tax, ans.regime) + holdingSchedulePV(pays, 0.02) + holdingEmergencyCost(short);
}
function holdingExamBest(d) {
  if (d.kind === "portfolio") return { ids: holdingBestSet(d.projects, d.budget).ids };
  if (d.kind === "finance") {
    const opts = [];
    for (const scheme of ["annuity", "diff"]) for (const regime of ["usn6", "usn15"]) opts.push({ scheme, regime, cost: holdingFinanceCost(d, { scheme, regime }) });
    const b = opts.sort((a, c) => a.cost - c.cost)[0];
    return { scheme: b.scheme, regime: b.regime };
  }
  return { choice: holdingInsuranceBest(holdingPolicies(d.ex), d.cash, d.p) };
}
function holdingExamScore(d, ans) {
  if (d.kind === "portfolio") {
    const set = d.projects.filter((p) => (ans.ids || []).includes(p.id));
    if (set.reduce((s, p) => s + p.cost, 0) > d.budget) return 0;
    const best = holdingBestSet(d.projects, d.budget).npv, npv = set.reduce((s, p) => s + holdingNPV(p), 0);
    return best <= 0 ? (set.length ? 0 : 1) : Math.max(0, Math.min(1, npv / best));
  }
  if (d.kind === "finance") { const b = holdingExamBest(d); return holdingFinanceCost(d, b) / holdingFinanceCost(d, ans); }
  const pol = holdingPolicies(d.ex), b = holdingExamBest(d);
  return holdingInsuranceCost(b.choice, pol, d.cash, d.p) / holdingInsuranceCost(ans.choice, pol, d.cash, d.p);
}
function holdingExamPlay(ex, ans) {
  const d = ex.days[ex.results.length], best = holdingExamBest(d);
  const res = { ans, best, score: holdingExamScore(d, ans) };
  return { exam: { ...ex, results: [...ex.results, res] }, result: res, done: ex.results.length + 1 === ex.days.length };
}
function holdingExamResult(ex) {
  if (!ex.results.length) return null;
  const days = ex.results.map((r) => r.score);
  const eff = days.reduce((a, b) => a + b, 0) / days.length, minDay = Math.min(...days);
  return { eff, minDay, days, medal: lavkaExamMedal(eff, minDay) };
}
function holdingExamFinish(h, ex) {
  const res = holdingExamResult(ex), prev = h.examBest || { eff: -Infinity, medal: null, attempts: 0 };
  const better = !!res && res.eff > prev.eff;
  return { ...h, examActive: null, examBest: { eff: better ? res.eff : prev.eff, medal: better ? (res.medal ? res.medal.id : null) : prev.medal,
    day: better ? h.day : prev.day, attempts: (prev.attempts || 0) + 1 } };
}

/* Завершить уровень 4 (нужна медаль экзамена цеха): продать цех или оставить дочкой; дочки копятся.
   Совет холдинга получает фонд развития 500 000 — бюджет проектов. Семён помнит обман на ярмарке. */
function levelFinish4(st, choice) {
  const t = capitalTransition(4, st.factory && st.factory.examBest, choice, "Цех «Заря»");
  if (!t) return null;
  const semyonTrust = !(st.fair && st.fair.flags && st.fair.flags.semyonBroken);
  const holding = holdingNewState(t.cash + HOLDING.devFund, (st.factory.day || 1) + 7, { semyonTrust });
  holding.subsidiaries = [...(st.factory.subsidiaries || []).filter((s) => s.daysLeft > 0), ...(t.subsidiary ? [t.subsidiary] : [])];
  return { ...st, level: 5, holding, level4: { medal: t.medal, choice, sale: t.sale, D: t.D, closedDay: st.factory.day } };
}

export {
  HOLDING, HOLDING_GOALS, HOLDING_CHAPTERS, HOLDING_EXAM_KINDS,
  holdingPV, holdingNPV, holdingPI, holdingPayback, holdingBestSet, holdingGreedyPI, holdingSchedule, holdingSchedulePV, holdingTax, holdingTaxBest,
  holdingExposure, holdingPolicies, holdingEmergencyCost, holdingInsuranceCost, holdingInsuranceBest,
  holdingNewState, holdingBoard, holdingApprove, holdingChooseTax, holdingTakeLoan, holdingHedge, holdingCashForecast, holdingInsure,
  holdingMove, holdingDam, holdingFloodLoss, holdingNextDay, holdingDailyFlow, holdingTrueValue, holdingOffers, holdingSell,
  holdingExamOpen, holdingExamNew, holdingFinanceCost, holdingExamBest, holdingExamScore, holdingExamPlay, holdingExamResult, holdingExamFinish,
  levelFinish4,
};
