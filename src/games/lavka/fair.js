/* «Ярмарка» — уровень 2 «Пути компании» (чистая логика, без React).
   Сценарий: docs/scenario/05_УРОВЕНЬ_2_ЯРМАРКА.md, ПАРАМЕТРЫ.md; ревью: docs/reviews/2026-10-02-scenario.md.

   Рынок кваса в розлив. Новый рычаг — КОЛИЧЕСТВО: утром решаешь, сколько стаканов привезти; цену ставит рынок.
   Обратный спрос P = a − (b/k)·Q, k — «больше людей» по дню недели (пн–чт 1; пт 1,1; сб 1,4; вс 1,3).
   В нормированных единицах x = q/k (стаканы «обычного будня») P = a − b·Σx: все формулы как в будни,
   объёмы в выходные умножаются на k, а цена равновесия та же.

   Соперники — опытные торговцы: каждый день играют равновесие Курно для текущего числа продавцов и издержек.
   Почему не «наилучший ответ на вчерашний объём»: при четырёх и более продавцах такие ответы раскачиваются
   (эффект Теокариса: от 266,7 с отклонением 5 за 10 дней — 158 ↔ 429).

   Неделя 1 «Количество» (n = 2): сбор 10 ₽ со стакана (MC = 30); Д5 — Семён предлагает договор (картель).
   Неделя 2 «Третий»: с Д8 сбор — фиксированные 3 000 ₽ в день (налог с единицы меняет выпуск, фиксированный — нет);
     Рубцов проверяет сговор: p = 8% в день, штраф 25 000 ₽; бочка Гены (MC 20 → 16); утренний прилавок (лидерство);
     Д10 входит Илья — Семён сам распускает договор (картель двоих против Ильи: 7 111 < 8 000 в Курно на троих).
   Неделя 3 «Пятеро»: с Д15 мест пять; входят, пока новичок ждёт прибыль выше платы (при n = 6 уже нет). */
import { lavkaRng, lavkaExamMedal } from "./model.js";
import { CAPITAL, capitalPayDividends, capitalInterest, capitalTransition, annuity } from "./capital.js";

const FAIR = {
  a: 100, b: 0.05, c: 20, noise: 0.04,
  unitTax: 10, taxUntilDay: 7, fee: 3000,
  kWeek: [1, 1, 1, 1, 1.1, 1.4, 1.3], // день 1 — понедельник
  places: [[1, 2], [10, 3], [15, 5]], // сколько мест на ярмарке с какого дня (решает Смычков)
  cartelDay: 5, punishDays: 5, inspectP: 0.08, fine: 25000,
  oracleDays: 7, examFromDay: 22, levelDays: 21,
};
const FAIR_RIVAL_NAMES = ["Семён", "Илья", "Студенты техникума", "Зоин квас", "Пятый продавец"];

const fairK = (day) => FAIR.kWeek[(day - 1) % 7];
const fairKbar = FAIR.kWeek.reduce((s, x) => s + x, 0) / 7;
const fairPlaces = (day) => FAIR.places.reduce((n, [d, p]) => (day >= d ? p : n), 0);
const fairTax = (day) => (day <= FAIR.taxUntilDay ? FAIR.unitTax : 0);
const fairFixed = (day) => (day <= FAIR.taxUntilDay ? 0 : FAIR.fee);

/* ===== Равновесия (в нормированных единицах x) ===== */
/* Курно, все с MC = c: x = (a − c)/(b(n + 1)), P = (a + n·c)/(n + 1). */
function fairCournot(n, c = FAIR.c) {
  const { a, b } = FAIR;
  const x = (a - c) / (b * (n + 1)), P = (a + n * c) / (n + 1);
  return { n, x, P, X: n * x, profit: (P - c) * x };
}
/* Нэш Курно для фирм с издержками costs: xᵢ = (a − (n + 1)·cᵢ + Σⱼ cⱼ)/((n + 1)·b). */
function fairNashCosts(costs) {
  const { a, b } = FAIR, n = costs.length, sum = costs.reduce((s, x) => s + x, 0);
  return costs.map((ci) => Math.max(0, (a - (n + 1) * ci + sum) / ((n + 1) * b)));
}
/* Курно: игрок с MC = cp и n − 1 соперников с MC = cr. */
function fairNashAsym(n, cp, cr) {
  const xs = fairNashCosts([cp, ...Array(n - 1).fill(cr)]);
  const xp = xs[0], xr = n > 1 ? xs[1] : 0, P = Math.max(0, FAIR.a - FAIR.b * (xp + (n - 1) * xr));
  return { n, xp, xr, P, profitP: (P - cp) * xp, profitR: (P - cr) * xr };
}
/* Наилучший ответ на суммарный объём остальных: x = (a − c − b·X₋)/(2b). */
const fairBR = (Xothers, mc = FAIR.c) => Math.max(0, (FAIR.a - mc - FAIR.b * Xothers) / (2 * FAIR.b));
/* Ответ m симметричных последователей (MC = cr) на объём лидера xL: каждый (a − cr − b·xL)/(b(m + 1)). */
const fairFollowers = (xL, m, cr) => Math.max(0, (FAIR.a - cr - FAIR.b * xL) / (FAIR.b * (m + 1)));
/* Штакельберг: лидер (MC = cp) и m последователей: x_L = (a + m·cr − (m + 1)·cp)/(2b). */
function fairStackelberg(m, cp, cr) {
  const { a, b } = FAIR;
  const xL = Math.max(0, (a + m * cr - (m + 1) * cp) / (2 * b)), xF = fairFollowers(xL, m, cr);
  const P = Math.max(0, a - b * (xL + m * xF));
  return { xL, xF, P, profitL: (P - cp) * xL, profitF: (P - cr) * xF };
}

/* Картель двоих (игрок cp, Семён cr): общий выпуск — монопольный при средней MC, квоты пропорциональны Курно.
   Обман — наилучший ответ на квоту Семёна; наказание — Курно на punishDays дней. */
function fairCartelMath(cp, cr, punishDays = FAIR.punishDays) {
  const { a, b } = FAIR;
  const [xpC, xrC] = fairNashCosts([cp, cr]);
  const Xm = (a - (cp + cr) / 2) / (2 * b);
  const qPlayer = (Xm * xpC) / (xpC + xrC), qRival = Xm - qPlayer;
  const P = a - b * Xm;
  const cartelProfit = (P - cp) * qPlayer, rivalProfit = (P - cr) * qRival;
  const qCheat = fairBR(qRival, cp), cheatProfit = (a - b * (qCheat + qRival) - cp) * qCheat;
  const cournotProfit = (a - b * (xpC + xrC) - cp) * xpC;
  const deltaMin = (cheatProfit - cartelProfit) / (cheatProfit - cournotProfit);
  return { qPlayer, qRival, Xm, P, cartelProfit, rivalProfit, qCheat, cheatProfit, cheatGain: cheatProfit - cartelProfit,
    cournotProfit, cartelGain: cartelProfit - cournotProfit, punishLoss: (cartelProfit - cournotProfit) * punishDays, punishDays, deltaMin,
    expFine: FAIR.inspectP * FAIR.fine };
}
/* Картель двоих против третьего (Ильи) в Курно: «одна фирма» против одной — каждый из двоих получает половину. */
function fairCartelVsThird(c = FAIR.c) {
  const duo = fairCournot(2, c), trio = fairCournot(3, c);
  return { eachInCartel: duo.profit / 2, eachCournot3: trio.profit, third: duo.profit };
}

/* ===== Улучшения ===== */
const FAIR_UPGRADES = [
  { id: "barrel", emoji: "🛢️", title: "Бочка-охладитель (Гена)", cost: 40000, salvage: 20000, chapter: 2, mc: 16,
    desc: "Твои MC 20 → 16 ₽ (у соперников прежние). В конце ярмарки Гена выкупит бочку за 20 000 ₽.",
    lesson: "Асимметричный Курно: ниже MC — больше твой выпуск, меньше чужой. Ценность снижения издержек зависит от структуры рынка: при двоих +2 987 ₽ в будни, при троих +2 580, при пятерых +2 000. Покупка — проект: NPV = PV(прирост прибыли до конца ярмарки) + PV(выкуп) − 40 000. Купить на 8-й день выгодно, на 15-й — уже нет: дней осталось мало." },
  { id: "leader", emoji: "🌅", title: "Утренний прилавок", cost: 10000, chapter: 2, fromDay: 11, untilDay: 14,
    desc: "Дни 11–14: ты выставляешь бочку первым, соперники видят твой сегодняшний объём и отвечают на него. С 15-го Смычков перестраивает ряд — все открываются одновременно.",
    lesson: "Штакельберг: лидер выбирает объём, зная ответ последователей: x_L = (a + m·c − (m + 1)·c_твоя)/(2b); при равных MC это (a − c)/(2b) = 800 при любом числе последователей. При троих лидер получает 10 667 ₽ в будни против 8 000 в Курно: за 4 дня (чт–вс, людей ×1; 1,1; 1,4; 1,3) это ≈ +12 800 ₽ — прилавок за 10 000 окупается. Обязательство работает, только пока соперники видят твой объём раньше своего решения." },
];
const fairOwns = (st, id) => !!(st.upgrades && st.upgrades[id]);
const fairMCbase = (st) => (fairOwns(st, "barrel") ? 16 : FAIR.c);
/* MC игрока и соперников в день day — с налогом на единицу в первую неделю. */
const fairMC = (st, day = st.day) => fairMCbase(st) + fairTax(day);
const fairRivalMC = (day) => FAIR.c + fairTax(day);

/* NPV бочки, если купить сегодня: прирост прибыли в Курно до конца ярмарки + выкуп, при r = 2%. */
function fairBarrelNPV(st) {
  const u = FAIR_UPGRADES[0], r = CAPITAL.rate;
  let pv = 0;
  for (let d = st.day; d <= FAIR.levelDays; d++) {
    const n = fairPlaces(d) <= (st.rivals.length + 1) ? st.rivals.length + 1 : fairPlaces(d);
    const cr = fairRivalMC(d);
    const gain = fairNashAsym(n, u.mc + fairTax(d), cr).profitP - fairNashAsym(n, FAIR.c + fairTax(d), cr).profitP;
    pv += (gain * fairK(d)) / (1 + r) ** (d - st.day + 1);
  }
  pv += u.salvage / (1 + r) ** (FAIR.levelDays - st.day + 1);
  return pv - u.cost;
}

function fairBuy(st, id) {
  const u = FAIR_UPGRADES.find((x) => x.id === id);
  if (!u || fairOwns(st, id) || st.cash < u.cost || (st.chapter || 1) < u.chapter) return st;
  if ((u.fromDay && st.day < u.fromDay) || (u.untilDay && st.day > u.untilDay)) return st;
  const next = { ...st, cash: st.cash - u.cost, upgrades: { ...(st.upgrades || {}), [id]: { day: st.day } } };
  if (id === "barrel") next.flags = { ...(st.flags || {}), barrelNPV: Math.round(fairBarrelNPV(st)) };
  if (id === "leader") { next.leader = true; if (next.cartel && next.cartel.active) next.cartel = { ...next.cartel, active: false, ended: "leader" }; }
  return next;
}

const FAIR_GOALS = [
  { id: "nash", emoji: "⚖️", title: "Наилучший ответ", desc: "Привези наилучший ответ на объём соперников (±15 стаканов будня).", reward: 3000 },
  { id: "fee", emoji: "🧾", title: "Продналог", desc: "В первый день фиксированной платы привези наилучший ответ: фиксированная плата не меняет выгодный объём, налог с единицы — меняет.", reward: 3000 },
  { id: "honest", emoji: "⚖️", title: "Посчитал риск", desc: "Откажись от сговора или выйди из него: ожидаемый штраф p·F = 2 000 ₽ в день больше выигрыша картеля.", reward: 3000 },
  { id: "barrel", emoji: "🛢️", title: "Проект с NPV > 0", desc: "Купи бочку, когда её NPV на оставшиеся дни положителен.", reward: 4000 },
  { id: "leader", emoji: "🌅", title: "Лидер Штакельберга", desc: "С утренним прилавком привези объём лидера (±15 стаканов будня).", reward: 4000 },
  { id: "longrun", emoji: "🏁", title: "Длинный период", desc: "Вход прекратился (новичку не покрыть плату), а ты 3 дня подряд в плюсе по ожидаемой прибыли.", reward: 4000 },
];
const FAIR_CHAPTERS = [
  { n: 1, title: "Количество", fromDay: 1, goal: "nash" },
  { n: 2, title: "Третий", fromDay: 8, goal: "fee" },
  { n: 3, title: "Пятеро", fromDay: 15, goal: "longrun" },
];

function fairNewState(cash = CAPITAL.grant[2]) {
  const eq = fairNashAsym(2, FAIR.c + FAIR.unitTax, FAIR.c + FAIR.unitTax);
  return {
    v: 2, level: 2, day: 1, chapter: 1, cash: Math.round(cash), q: 400, lastQ: 400, upgrades: {},
    rivals: [{ name: FAIR_RIVAL_NAMES[0], x: eq.xr }], leader: false, cartel: null, offer: null, flags: {},
    goals: {}, obs: [], history: [], subsidiaries: [], expStreak: 0, last: null,
  };
}

/* Объём каждого соперника (норм.) при объёме игрока x: картель — квота; лидерство — ответ на x; иначе — Курно. */
function fairRivalX(st, x, day = st.day) {
  const m = st.rivals.length, cp = fairMC(st, day), cr = fairRivalMC(day);
  if (st.leader) return fairFollowers(x, m, cr);
  if (fairInCartel(st)) return fairCartelMath(cp, cr).qRival;
  return fairNashAsym(m + 1, cp, cr).xr;
}
const fairInCartel = (st) => !!(st.cartel && st.cartel.active && !(st.cartel.punish > 0) && !st.leader);
/* Сколько привезут соперники сегодня (реальные стаканы), если игрок не лидер. */
const fairRivalsToday = (st) => (st.leader ? null : fairRivalX(st, 0) * st.rivals.length * fairK(st.day));

/* Оценка спроса игроком (МНК по наблюдениям «нормированный объём → цена»): P = â − b̂·X. */
function fairFit(obs) {
  const pts = (obs || []).slice(-20);
  if (pts.length < 3) return null;
  const n = pts.length, mq = pts.reduce((s, o) => s + o.X, 0) / n, mp = pts.reduce((s, o) => s + o.P, 0) / n;
  let sxy = 0, sxx = 0;
  for (const o of pts) { sxy += (o.X - mq) * (o.P - mp); sxx += (o.X - mq) ** 2; }
  if (sxx < 1e-6 || sxy >= 0) return null;
  const bh = -sxy / sxx;
  return { a: mp + bh * mq, b: bh, n };
}

/* Остаточный спрос, MR и наилучший ответ (норм.): обычный или лидерский (с реакцией m последователей). */
function fairMargins({ a, b }, { x, Xr, m, leader, cp, cr }) {
  if (leader) {
    const intercept = (a + m * cr) / (m + 1), slope = b / (m + 1);
    return { intercept, slope, mr: intercept - 2 * slope * x, br: Math.max(0, (intercept - cp) / (2 * slope)) };
  }
  return { intercept: a - b * Xr, slope: b, mr: a - b * Xr - 2 * b * x, br: Math.max(0, (a - cp - b * Xr) / (2 * b)) };
}

/* Ожидаемая прибыль новичка (норм. будний день) при входе n-м продавцом: Курно или последователь лидера. */
function fairEntrantProfit(st, n, day) {
  const cp = fairMC(st, day), cr = fairRivalMC(day);
  if (st.leader) return fairStackelberg(n - 1, cp, cr).profitF;
  return fairNashAsym(n, cp, cr).profitR;
}
/* Входит ли ещё продавец: есть место и ожидаемая прибыль за средний день недели выше платы. */
const fairEntryOpen = (st, n, day) => n < fairPlaces(day) && fairEntrantProfit(st, n + 1, day) * fairKbar > FAIR.fee;

/* Один день ярмарки. Чистая функция при заданном rng. */
function fairSimulate(st, rng = Math.random) {
  const { a, b, noise } = FAIR;
  const day = st.day, k = fairK(day), cp = fairMC(st), cr = fairRivalMC(day), m = st.rivals.length;
  const q = Math.max(0, Math.round(st.q)), x = q / k;
  const inCartel = fairInCartel(st);
  const cm = fairCartelMath(cp, cr);
  const xr = fairRivalX(st, x);
  const rivals = st.rivals.map((r) => ({ ...r, x: xr, q: xr * k }));
  const Xr = xr * m, X = x + Xr;
  const aReal = a * (1 + noise * (2 * rng() - 1)); // шок спроса — после того, как все привезли
  const P = Math.max(0, aReal - b * X);
  const fixed = fairFixed(day), tax = fairTax(day) * q;
  const margin = (P - cp) * q; // cp уже включает налог с единицы
  let profit = margin - fixed;

  /* Капитал: дивиденды дочек и проценты на остаток (r = 2%). */
  const pay = capitalPayDividends(st.subsidiaries);
  const interest = capitalInterest(st.cash);

  /* Картель: обман — объём выше квоты (+2% допуска); наказание — Курно на punishDays дней; проверка Рубцова. */
  let cartel = st.cartel ? { ...st.cartel } : null, cheated = false, fined = 0, inspected = false;
  if (cartel && cartel.active) {
    if (cartel.punish > 0) { cartel.punish -= 1; cartel.faithful = 0; }
    else if (x > cm.qPlayer * 1.02 + 1) { cheated = true; cartel.punish = FAIR.punishDays; cartel.faithful = 0; }
    else cartel.faithful = (cartel.faithful || 0) + 1;
    if (rng() < FAIR.inspectP) { inspected = true; fined = FAIR.fine; cartel = { ...cartel, active: false, ended: "fined" }; }
  }
  profit -= fined;

  /* Цели. */
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = day; newGoals.push(id); } };
  const ctx = { x, Xr, m, leader: !!st.leader, cp, cr };
  const tr = fairMargins({ a, b }, ctx);
  const expProfit = (a - b * X - cp) * q - fixed;
  const expStreak = expProfit > 0 ? (st.expStreak || 0) + 1 : 0;
  const nearBR = Math.abs(x - tr.br) <= 15;
  if (!inCartel && !st.leader && nearBR) hit("nash");
  if (day === FAIR.taxUntilDay + 1 && !inCartel && nearBR) hit("fee");
  if (st.leader && nearBR) hit("leader");
  const entryClosed = !fairEntryOpen(st, m + 1, day);
  if (st.chapter === 3 && entryClosed && expStreak >= 3) hit("longrun");
  if (fairOwns(st, "barrel") && st.flags && st.flags.barrelNPV > 0) hit("barrel");

  /* Следующий день: предложение договора, вход, распад картеля, главы, выкуп бочки. */
  const nd = day + 1;
  let offer = st.offer, newRivals = rivals, entered = [], dissolved = null, flags = { ...(st.flags || {}) };
  if (nd === FAIR.cartelDay && !st.leader && !cartel) offer = { day: nd, ...cm };
  if (fined) flags.fined = true;
  /* Утренний прилавок действует до 14-го дня: с 15-го ряд перестроен, все открываются одновременно. */
  const leaderEnds = st.leader && nd > FAIR_UPGRADES[1].untilDay;
  if (leaderEnds) flags.stackelberg = true;
  const stNext = { ...st, leader: st.leader && !leaderEnds };
  while (newRivals.length + 1 < FAIR_RIVAL_NAMES.length + 1 && fairEntryOpen({ ...stNext, rivals: newRivals }, newRivals.length + 1, nd)) {
    const name = FAIR_RIVAL_NAMES[newRivals.length];
    newRivals = [...newRivals, { name, x: 0, q: 0 }];
    entered.push(name);
  }
  if (entered.length && cartel && cartel.active) {
    /* Семён считает: картель двоих против нового продавца хуже честного Курно на троих — распускает договор. */
    cartel = { ...cartel, active: false, ended: "entry" }; dissolved = fairCartelVsThird(FAIR.c);
  }
  let chapter = st.chapter, newChapter = null;
  const up = FAIR_CHAPTERS[chapter];
  if (up && nd >= up.fromDay) { chapter += 1; newChapter = chapter; }
  let salvage = 0, upgrades = st.upgrades;
  if (day === FAIR.levelDays && fairOwns(st, "barrel") && !st.upgrades.barrel.sold) {
    salvage = FAIR_UPGRADES[0].salvage; upgrades = { ...upgrades, barrel: { ...upgrades.barrel, sold: day } };
  }
  let reward = 0;
  for (const id of newGoals) reward += FAIR_GOALS.find((g) => g.id === id)?.reward || 0;

  const report = {
    day, k, q, x, rivals, Xr, X, Q: X * k, a: aReal, P, margin, tax, fixed, profit, fined, inspected, dividend: pay.dividend, interest,
    reward, salvage, newGoals, newChapter, cheated, entered, dissolved, br: tr.br, mrTrue: tr.mr, intercept: tr.intercept, slope: tr.slope,
    mc: cp, leader: !!st.leader, m, inCartel, cartelMath: inCartel || cheated ? cm : null,
    mode: day <= FAIR.oracleDays ? "oracle" : "estimate",
  };
  const fit = fairFit(st.obs);
  if (report.mode === "estimate" && fit) {
    const es = fairMargins(fit, ctx);
    Object.assign(report, { fit, mrEst: es.mr, brEst: es.br, interceptEst: es.intercept, slopeEst: es.slope });
  }
  const next = {
    ...st, day: nd, chapter, leader: stNext.leader, cash: Math.round(st.cash + profit + pay.dividend + reward + interest + salvage), lastQ: q,
    rivals: newRivals, cartel, offer, flags, goals, upgrades, subsidiaries: pay.subsidiaries, expStreak,
    obs: [...(st.obs || []), { day, X, P }].slice(-30),
    history: [...(st.history || []), { day, profit: Math.round(profit) }].slice(-60),
    last: report, at: Date.now(),
  };
  return { next, report };
}

/* Ответ на предложение Семёна: accept — картель с квотами; decline — отказ (цель «Посчитал риск»). */
function fairAnswerOffer(st, accept) {
  if (!st.offer) return st;
  const goals = { ...st.goals };
  let cash = st.cash;
  if (!accept && !goals.honest) { goals.honest = st.day; cash += FAIR_GOALS.find((g) => g.id === "honest").reward; }
  return { ...st, offer: null, cash, goals, cartel: accept ? { active: true, punish: 0, faithful: 0, since: st.day } : null,
    flags: { ...(st.flags || {}), cartel: accept ? "yes" : "no" } };
}
/* Выйти из сговора самому. */
function fairLeaveCartel(st) {
  if (!st.cartel || !st.cartel.active) return st;
  const goals = { ...st.goals };
  let cash = st.cash;
  if (!goals.honest) { goals.honest = st.day; cash += FAIR_GOALS.find((g) => g.id === "honest").reward; }
  return { ...st, cash, goals, cartel: { ...st.cartel, active: false, ended: "left" } };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");

/* Вердикт дня (в стаканах будня): остаточный спрос, MR vs MC; в картеле — выгода, наказание и риск проверки.
   Первая неделя — по истинному спросу (Вера Павловна), дальше — по оценке игрока. */
function fairVerdict(r) {
  const oracle = r.mode === "oracle";
  const mr = oracle ? r.mrTrue : r.mrEst, br = oracle ? r.br : r.brEst;
  const parts = [];
  if (r.inCartel && r.cartelMath) {
    const m = r.cartelMath;
    parts.push(`Договор: твоя квота ${fmt(m.qPlayer)} стаканов будня. Обман дал бы +${fmt(m.cheatGain)} ₽ сегодня, но ${m.punishDays} дн. Курно отнимут ${fmt(m.punishLoss)} ₽. ` +
      `А сам договор приносит лишь ${fmt(m.cartelGain)} ₽ в будни против Курно — меньше ожидаемого штрафа p·F = ${fmt(m.expFine)} ₽ в день.`);
  }
  if (r.cheated) parts.push(`Ты привёз(ла) больше квоты — ${FAIR.punishDays} дней Семён возит по Курно.`);
  if (r.fined) parts.push(`Рубцов раскрыл сговор: штраф ${fmt(r.fined)} ₽, договор расторгнут.`);
  if (mr == null) {
    parts.push(`Цена ${fmt(r.P)} ₽ при ${fmt(r.X)} стаканах будня на всех. Чтобы оценить спрос, нужно хотя бы 3 дня с разным общим объёмом — меняй свой.`);
    return parts.join(" ");
  }
  const pre = oracle ? "" : "по твоей оценке спроса ";
  const ic = oracle ? r.intercept : r.interceptEst, sl = oracle ? r.slope : r.slopeEst;
  const kNote = r.k !== 1 ? ` (сегодня людей ×${fmt(r.k, 1)}: объёмы ×${fmt(r.k, 1)}, а цена — как в будни)` : "";
  parts.push(r.leader
    ? `Ты лидер: соперники отвечают на твой объём, поэтому твой остаточный спрос P ≈ ${fmt(ic)} − ${fmt(sl, 3)}·x${kNote}.`
    : `Соперники привезли ${fmt(r.Xr)} стаканов будня; твой остаточный спрос P ≈ ${fmt(ic)} − ${fmt(sl, 3)}·x${kNote}.`);
  const d = mr - r.mc, xs = fmt(r.x);
  if (r.inCartel) parts.push(`${pre}MR = ${fmt(mr)} ${d > 1 ? ">" : d < -1 ? "<" : "≈"} MC = ${r.mc}: в одиночку выгодно было бы ${fmt(br)}, но это и есть обман.`);
  else if (Math.abs(r.x - br) <= 15) parts.push(`${pre}сходится: ${xs} ≈ наилучший ответ ${fmt(br)} (MR ≈ MC = ${r.mc}).`);
  else if (d > 0) parts.push(`${pre}мало: MR = ${fmt(mr)} > MC = ${r.mc} — цена выдержала бы больше, наилучший ответ ≈ ${fmt(br)}.`);
  else parts.push(`${pre}много: MR = ${fmt(mr)} < MC = ${r.mc} — каждый лишний стакан сбил цену всем твоим, наилучший ответ ≈ ${fmt(br)}.`);
  if (r.tax > 0) parts.push(`Сбор 10 ₽ со стакана входит в MC: он сдвигает наилучший ответ влево.`);
  return parts.join(" ");
}

/* Завершить уровень 1 (нужна медаль экзамена): «sell» — Плотникову по медали, «keep» — дочка D = s·e·π̄_эт. */
function levelFinish(st, choice) {
  const t = capitalTransition(1, st.examBest, choice, "Лавка у парка");
  if (!t) return null;
  const fair = fairNewState(t.cash);
  if (t.subsidiary) fair.subsidiaries = [t.subsidiary];
  return { ...st, level: 2, fair, level1: { medal: t.medal, choice, sale: t.sale, D: t.D, closedDay: st.day } };
}

/* ===== Экзамен уровня 2 «Закрытие сезона» =====
   3 дня (пн–ср, k = 1), соперники объявляют объёмы заранее («Соня спросила у всех») — экзамен проверяет наилучший ответ,
   а не угадывание поведения ботов. Числа случайны по сиду. Оценка дня — по марже до фиксированной платы:
   1 − √(1 − маржа/маржа*) ≈ 1 − |Δx|/x* (ошибка 30% стоит 30%). Ожидаемый штраф за сговор — издержки решения. */
const FAIR_EXAM_KINDS = [
  { kind: "cournot", title: "Остались трое" },
  { kind: "entry", title: "Новый продавец" },
  { kind: "cartel", title: "Искушение картеля" },
];
const fairExamOpen = (f) => (f.chapter || 1) >= 3 && f.day >= FAIR.examFromDay;
function fairExamNew(f, seed) {
  const rng = lavkaRng(seed), pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const days = FAIR_EXAM_KINDS.map((k) => {
    let rivals, text, quota = null;
    if (k.kind === "cournot") {
      rivals = [pick(20, 60) * 10, pick(20, 60) * 10];
      text = `Студенты и «Зоин квас» уехали. Семён везёт ${rivals[0]}, Илья — ${rivals[1]}. Сколько везёшь ты?`;
    } else if (k.kind === "entry") {
      rivals = [pick(30, 50) * 10, pick(30, 50) * 10, pick(20, 40) * 10];
      text = `Приехал фургон «Квас с горы» — ${rivals[2]} стаканов. Семён и Илья не перестроились: ${rivals[0]} и ${rivals[1]}. Сколько везёшь ты?`;
    } else {
      quota = pick(15, 25) * 10;
      rivals = [pick(20, 50) * 10, quota, quota];
      text = `Последний день. Илья и новичок договорились возить по ${quota} и зовут тебя в долю с той же квотой. Семён везёт ${rivals[0]}. ` +
        `Рубцов на ярмарке: раскроет сговор с вероятностью 8%, штраф 25 000 ₽ (ожидаемо 2 000 ₽). Вступишь — и сколько везёшь?`;
    }
    return { kind: k.kind, title: k.title, text, rivals, quota, seed: Math.floor(rng() * 2 ** 31) };
  });
  return { seed, results: [], days };
}
/* Маржа дня экзамена (до платы 3 000): (P − c)·x − ожидаемый штраф, если вступил в сговор. */
function fairExamMargin(f, d, ans, aReal = FAIR.a) {
  const x = Math.max(0, Math.round(ans.q)), c = fairMCbase(f);
  const P = Math.max(0, aReal - FAIR.b * (x + d.rivals.reduce((s, v) => s + v, 0)));
  return { margin: (P - c) * x - (d.kind === "cartel" && ans.join ? FAIR.inspectP * FAIR.fine : 0), P, x };
}
/* Эталон: наилучший ответ на объявленные объёмы; в сговоре — лучшее из «вступить и держать квоту» и «не вступать». */
function fairExamBest(f, d) {
  const c = fairMCbase(f), br = Math.round(fairBR(d.rivals.reduce((s, v) => s + v, 0), c));
  if (d.kind !== "cartel") return { q: br, join: false };
  const out = fairExamMargin(f, d, { q: br, join: false }).margin, inn = fairExamMargin(f, d, { q: d.quota, join: true }).margin;
  return inn > out ? { q: d.quota, join: true } : { q: br, join: false };
}
function fairExamPlayDay(f, exam, ans) {
  const i = exam.results.length, d = exam.days[i];
  const aReal = FAIR.a * (1 + FAIR.noise * (2 * lavkaRng(d.seed)() - 1));
  const a = typeof ans === "number" ? { q: ans, join: false } : ans;
  const best = fairExamBest(f, d), me = fairExamMargin(f, d, a, aReal), bot = fairExamMargin(f, d, best, aReal);
  const res = { q: me.x, join: !!a.join, botQ: best.q, botJoin: best.join, P: me.P, Qr: d.rivals.reduce((s, v) => s + v, 0),
    playerMargin: me.margin, botMargin: bot.margin, botProfit: bot.margin - FAIR.fee };
  return { exam: { ...exam, results: [...exam.results, res] }, result: res, done: exam.results.length + 1 === exam.days.length };
}
function fairExamResult(exam) {
  if (!exam.results.length || exam.results.some((r) => !(r.botMargin > 0))) return null;
  const days = exam.results.map((r) => Math.max(0, 1 - Math.sqrt(Math.max(0, 1 - Math.min(1, r.playerMargin / r.botMargin)))));
  const eff = days.reduce((s, x) => s + x, 0) / days.length, minDay = Math.min(...days);
  const piBot = exam.results.reduce((s, r) => s + r.botProfit, 0) / exam.results.length;
  return { eff, minDay, days, piBot, medal: lavkaExamMedal(eff, minDay) };
}
function fairExamFinish(f, exam) {
  const res = fairExamResult(exam), prev = f.examBest || { eff: -Infinity, medal: null, attempts: 0 };
  const better = !!res && res.eff > prev.eff;
  return { ...f, examActive: null, examBest: { eff: better ? res.eff : prev.eff, medal: better ? (res.medal ? res.medal.id : null) : prev.medal,
    piBot: better ? res.piBot : prev.piBot, day: better ? f.day : prev.day, attempts: (prev.attempts || 0) + 1 } };
}

export {
  FAIR, FAIR_RIVAL_NAMES, FAIR_UPGRADES, FAIR_GOALS, FAIR_CHAPTERS, FAIR_EXAM_KINDS,
  fairK, fairKbar, fairPlaces, fairTax, fairFixed, fairCournot, fairNashCosts, fairNashAsym, fairBR, fairFollowers, fairStackelberg,
  fairCartelMath, fairCartelVsThird, fairBarrelNPV, fairOwns, fairMCbase, fairMC, fairRivalMC, fairBuy, fairNewState, fairRivalX,
  fairInCartel, fairRivalsToday, fairFit, fairMargins, fairEntrantProfit, fairEntryOpen, fairSimulate, fairAnswerOffer, fairLeaveCartel,
  fairVerdict, levelFinish, fairExamOpen, fairExamNew, fairExamMargin, fairExamBest, fairExamPlayDay, fairExamResult, fairExamFinish,
  annuity, lavkaRng,
};
