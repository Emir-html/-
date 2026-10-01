/* «Ярмарка» — уровень 2 «Пути компании» (чистая логика, без React).
   Новый рычаг — КОЛИЧЕСТВО. Рынок пирожков: обратный спрос P = A − B·Q, Q — сумма объёмов всех продавцов,
   цена расчищает рынок (всё выпеченное продаётся). MC = c постоянны, аренда места — постоянные издержки.

   Главы:
     1. Курно — дуополия с Семёном: остаточный спрос P = (A − B·Q₋) − B·q, наилучший ответ q = (A − c − B·Q₋)/(2B),
        равновесие Нэша q* = (A − c)/(3B).
     2. Вход конкурентов — пока новичок ждёт прибыль выше аренды, на ярмарку приходят продавцы: P → c,
        в длинном периоде экономическая прибыль стремится к нулю (здесь — граница 4 фирмы).
     3. Картель и лидерство — рынок на двоих: Семён предлагает делить монопольный объём (по q_m/2); обман даёт
        выигрыш на один день и наказание (Курно) на FAIR.punishDays дней — повторяющаяся дилемма заключённого.
        «Утренний прилавок» делает игрока лидером по Штакельбергу: Семён видит сегодняшний объём.
   Капитал между уровнями: лавку уровня 1 можно продать за аннуитет D̄(медаль)·(1 − (1 + r)^−N)/r
   или оставить дочкой с дивидендом D̄ в день N дней — при ставке r это одно и то же по PV. */
import { lavkaRng } from "./model.js";

const FAIR = {
  A: 200, B: 1, c: 40, rent: 800, noise: 0.05,
  punishDays: 5, maxFirms: 6, entryDays: 3,
  rate: 0.005, dividendDays: 60, grant: 5000,
  leaderCost: 15000, oracleDays: 7,
};
const FAIR_RIVAL_NAMES = ["Семён", "Тётя Валя", "Братья Орловы", "Пекарня «Колос»", "Дядя Миша"];
/* Дивиденд лавки уровня 1 по медали экзамена (₽/день): покупатель видит только медаль. */
const LEVEL1_DIVIDEND = { gold: 1500, silver: 1100, bronze: 700 };

/* Симметричное равновесие Курно с n фирмами. */
function fairCournot(n) {
  const { A, B, c } = FAIR;
  const q = (A - c) / (B * (n + 1)), P = (A + n * c) / (n + 1);
  return { n, q, P, Q: n * q, profit: (P - c) * q };
}
/* Наилучший ответ на суммарный объём остальных (mc — свои предельные издержки). */
const fairBR = (Qothers, mc = FAIR.c) => Math.max(0, (FAIR.A - mc - FAIR.B * Qothers) / (2 * FAIR.B));
/* Асимметричный Курно на двоих: qᵢ = (A − 2cᵢ + cⱼ)/(3B). */
function fairCournotAsym(cp, cr) {
  const { A, B } = FAIR;
  const qp = (A - 2 * cp + cr) / (3 * B), qr = (A - 2 * cr + cp) / (3 * B), P = A - B * (qp + qr);
  return { qp, qr, P, profitP: (P - cp) * qp, profitR: (P - cr) * qr };
}
const FAIR_UPGRADES = [
  { id: "flour", emoji: "🌾", title: "Своя мука", cost: 12000, chapter: 1,
    desc: "Твои предельные издержки −10 ₽ (у конкурентов прежние).",
    lesson: "Ниже MC — правее твоя функция наилучшего ответа: в равновесии Курно ты выпускаешь больше, конкурент — меньше. Окупаемость ≈ 16 дней: доходность выше ставки r — значит, деньги сейчас ценнее." },
  { id: "leader", emoji: "🌅", title: "Утренний прилавок", cost: 15000, chapter: 3,
    desc: "Ты выкладываешь пирожки первым: конкуренты видят твой сегодняшний объём.",
    lesson: "Штакельберг: лидер выбирает объём, зная ответ последователя, — q_L = (A − c)/(2B). Ранний ход — это обязательство, и оно выгодно." },
];
const fairMC = (st) => FAIR.c - (st.upgrades && st.upgrades.flour ? 10 : 0);
function fairBuy(st, id) {
  const u = FAIR_UPGRADES.find((x) => x.id === id);
  if (!u || (st.upgrades && st.upgrades[id]) || st.cash < u.cost || (st.chapter || 1) < u.chapter) return st;
  const next = { ...st, cash: st.cash - u.cost, upgrades: { ...(st.upgrades || {}), [id]: true } };
  if (id === "leader") { next.leader = true; next.cartel = null; } // ты задаёшь тон — картель Семёну больше не нужен
  return next;
}
/* Ответ k симметричных конкурентов на объём игрока qp: каждый q = (A − c − B·qp)/(B(k + 1)). */
const fairRivalsReply = (qp, k) => Math.max(0, (FAIR.A - FAIR.c - FAIR.B * qp) / (FAIR.B * (k + 1)));

/* Штакельберг: лидер (игрок) и k последователей. */
function fairStackelberg(k = 1) {
  const { A, B, c } = FAIR;
  const qL = (A - c) / (2 * B), qF = fairRivalsReply(qL, k);
  const P = A - B * (qL + k * qF);
  return { qL, qF, P, profitL: (P - c) * qL, profitF: (P - c) * qF };
}

/* Картель на двоих: по половине монопольного объёма. Выгода обмана — один день, потери — дни наказания по Курно. */
function fairCartelMath() {
  const { A, B, c } = FAIR;
  const qCartel = (A - c) / (4 * B);
  const cartelProfit = (A - 2 * B * qCartel - c) * qCartel;
  const qCheat = fairBR(qCartel);
  const cheatProfit = (A - B * (qCheat + qCartel) - c) * qCheat;
  const cournot = fairCournot(2).profit;
  return { qCartel, cartelProfit, qCheat, cheatProfit, cheatGain: cheatProfit - cartelProfit,
    cournotProfit: cournot, punishLoss: (cartelProfit - cournot) * FAIR.punishDays };
}

/* Цена продажи бизнеса по медали: аннуитет на dividendDays дней при ставке rate. */
const fairSalePrice = (medal) => {
  const D = LEVEL1_DIVIDEND[medal] || 0, r = FAIR.rate, N = FAIR.dividendDays;
  return (D * (1 - (1 + r) ** -N)) / r;
};

const FAIR_GOALS = [
  { id: "nash", emoji: "⚖️", title: "Равновесие Нэша", desc: "Твой объём — наилучший ответ Семёну, а Семён стоит в равновесии Курно (±3).", reward: 1500 },
  { id: "longrun", emoji: "🏁", title: "Длинный период", desc: "На ярмарке 4 продавца, а ты 3 дня подряд в плюсе.", reward: 2000 },
  { id: "cartel5", emoji: "🤝", title: "Верность картелю", desc: "5 дней подряд держи договорённость.", reward: 2500 },
  { id: "leader", emoji: "🌅", title: "Лидер Штакельберга", desc: "С утренним прилавком выбери объём лидера (±3).", reward: 2500 },
];

const FAIR_CHAPTERS = [
  { n: 1, title: "Курно", fromDay: 1, goal: "nash" },
  { n: 2, title: "Вход конкурентов", fromDay: 8, goal: "longrun" },
  { n: 3, title: "Картель и лидерство", fromDay: 15, goal: null },
];

function fairNewState(cash = FAIR.grant) {
  return {
    v: 1, level: 2, day: 1, chapter: 1, cash: Math.round(cash), q: 50, lastQ: 50, upgrades: {},
    rivals: [{ name: FAIR_RIVAL_NAMES[0], q: 50 }], leader: false, cartel: null,
    goals: {}, obs: [], history: [], subsidiaries: [], profitStreak: 0, entryStreak: 0, last: null,
  };
}

/* Оценка спроса игроком (МНК по наблюдениям «суммарный объём → цена»): P = Â − B̂·Q. */
function fairFit(obs) {
  const pts = (obs || []).slice(-20);
  if (pts.length < 3) return null;
  const n = pts.length, mq = pts.reduce((s, o) => s + o.Q, 0) / n, mp = pts.reduce((s, o) => s + o.P, 0) / n;
  let sxy = 0, sxx = 0;
  for (const o of pts) { sxy += (o.Q - mq) * (o.P - mp); sxx += (o.Q - mq) ** 2; }
  if (sxx < 1e-6 || sxy >= 0) return null;
  const Bh = -sxy / sxx;
  return { A: mp + Bh * mq, B: Bh, n };
}

/* Один день ярмарки. Чистая функция при заданном rng. */
function fairSimulate(st, rng = Math.random) {
  const { A, B, rent, noise } = FAIR;
  const c = fairMC(st), k = st.rivals.length;
  const cm = fairCartelMath();
  const q = Math.max(0, Math.round(st.q));
  /* Конкуренты: в картеле — договорной объём; при лидерстве игрока — наилучший ответ на его СЕГОДНЯШНИЙ объём
     (Штакельберг); иначе — равновесие Курно для k + 1 фирм с учётом MC игрока: q = (A − 2c + c_игрока)/((k + 2)B). */
  const inCartel = st.cartel && st.cartel.active && st.cartel.punish === 0;
  const nashRival = Math.max(0, (A - 2 * FAIR.c + c) / ((k + 2) * B));
  const rivals = st.rivals.map((r) => ({ ...r, q: inCartel ? cm.qCartel : st.leader ? fairRivalsReply(q, k) : nashRival }));
  const Qr = rivals.reduce((s, r) => s + r.q, 0), Q = q + Qr;
  const Areal = A * (1 + noise * (2 * rng() - 1));
  const P = Math.max(0, Areal - B * Q);
  const profit = (P - c) * q - rent;

  /* Депозит: остаток на счёте приносит r в день — поэтому «деньги сейчас» и «поток дивидендов» сравнимы по PV. */
  const interest = Math.max(0, st.cash) * FAIR.rate;

  /* Дивиденды дочек. */
  let dividend = 0;
  const subsidiaries = (st.subsidiaries || []).map((s) => {
    if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; }
    return s;
  });

  /* Картель: обман — объём выше договорного; наказание — наилучший ответ на вчерашний объём. */
  let cartel = st.cartel ? { ...st.cartel } : null, cheated = false;
  if (cartel && cartel.active) {
    if (cartel.punish > 0) { cartel.punish -= 1; cartel.faithful = 0; }
    else if (q > cm.qCartel + 2) { cheated = true; cartel.punish = FAIR.punishDays; cartel.faithful = 0; }
    else cartel.faithful = (cartel.faithful || 0) + 1;
  }

  /* Вход: пока продавцы в плюсе FAIR.entryDays дней подряд и новичок ждёт прибыль выше аренды (Курно с n + 1). */
  let newRivals = rivals, entryStreak = st.entryStreak || 0, entered = null;
  if (st.chapter === 2) {
    const rivalProfit = rivals.length ? (P - c) * rivals[0].q - rent : 0;
    entryStreak = rivalProfit > 0 ? entryStreak + 1 : 0;
    const firms = rivals.length + 1;
    if (entryStreak >= FAIR.entryDays && firms < FAIR.maxFirms && fairCournot(firms + 1).profit > rent) {
      entered = FAIR_RIVAL_NAMES[rivals.length] || `Продавец ${rivals.length + 1}`;
      newRivals = [...rivals, { name: entered, q: rivals[0] ? rivals[0].q : 30 }];
      entryStreak = 0;
    }
  }

  /* Цели. */
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  const profitStreak = profit > 0 ? (st.profitStreak || 0) + 1 : 0;
  /* Нэш: объёмы — взаимные наилучшие ответы (подходит и для асимметричных издержек). */
  if (st.chapter === 1 && Math.abs(q - fairBR(Qr, c)) <= 3 && Math.abs(Qr - fairRivalsReply(q, k) * k) <= 3) hit("nash");
  if (st.chapter === 2 && rivals.length + 1 >= 4 && profitStreak >= 3) hit("longrun");
  if (cartel && cartel.faithful >= 5) hit("cartel5");
  if (st.leader && Math.abs(q - (A - c) / (2 * B)) <= 3) hit("leader");
  let reward = 0;
  for (const id of newGoals) reward += FAIR_GOALS.find((g) => g.id === id)?.reward || 0;

  /* Главы. */
  let chapter = st.chapter, newChapter = null;
  const up = FAIR_CHAPTERS[chapter], cur = FAIR_CHAPTERS[chapter - 1];
  if (up && st.day + 1 >= up.fromDay && cur.goal && goals[cur.goal]) { chapter += 1; newChapter = chapter; }
  if (newChapter === 3) {
    /* Мэрия оставила две лицензии: рынок на двоих, Семён предлагает картель. */
    newRivals = [{ name: FAIR_RIVAL_NAMES[0], q: cm.qCartel }];
    cartel = { active: true, punish: 0, faithful: 0 };
  }

  const report = {
    day: st.day, q, rivals, Qr, Q, A: Areal, P, profit, dividend, interest, reward, newGoals, newChapter, cheated, entered,
    br: fairBR(Qr, c), mrTrue: Areal - B * Qr - 2 * B * q, mc: c, leader: !!st.leader,
    mode: st.day <= FAIR.oracleDays ? "oracle" : "estimate",
  };
  const fit = fairFit(st.obs);
  if (report.mode === "estimate" && fit) { report.fit = fit; report.mrEst = fit.A - fit.B * Qr - 2 * fit.B * q; report.brEst = Math.max(0, (fit.A - c - fit.B * Qr) / (2 * fit.B)); }
  const next = {
    ...st, day: st.day + 1, chapter, cash: Math.round(st.cash + profit + dividend + reward + interest), lastQ: q,
    rivals: newRivals, cartel, goals, subsidiaries, profitStreak, entryStreak,
    obs: [...(st.obs || []), { day: st.day, Q, P }].slice(-30),
    history: [...(st.history || []), { day: st.day, profit: Math.round(profit) }].slice(-60),
    last: report, at: Date.now(),
  };
  return { next, report };
}

/* Вердикт дня ярмарки: остаточный спрос и наилучший ответ (первая неделя — по истине, дальше — по оценке игрока). */
function fairVerdict(r) {
  const oracle = r.mode === "oracle";
  const mr = oracle ? r.mrTrue : r.mrEst, br = oracle ? r.br : r.brEst;
  if (mr == null) return `Цена ${r.P.toFixed(0)} ₽ при суммарном объёме ${r.Q.toFixed(0)}. Чтобы оценить свой наилучший ответ, нужно хотя бы 3 дня с разным суммарным объёмом.`;
  const pre = oracle ? "" : "по твоей оценке спроса ";
  const head = `Конкуренты выпекли ${r.Qr.toFixed(0)}, тебе остаётся остаточный спрос P = ${(oracle ? r.A - r.Qr : r.fit.A - r.fit.B * r.Qr).toFixed(0)} − ${oracle ? "" : r.fit.B.toFixed(2) + "·"}q. `;
  const d = mr - r.mc;
  if (Math.abs(d) <= 3) return head + `${pre}MR ≈ MC — объём ${r.q} близок к наилучшему ответу ${br.toFixed(0)}.`;
  return head + (d > 0
    ? `${pre}MR = ${mr.toFixed(0)} > MC = ${r.mc}: выгодно печь больше — наилучший ответ ≈ ${br.toFixed(0)}.`
    : `${pre}MR = ${mr.toFixed(0)} < MC = ${r.mc}: лишние пирожки сбивают цену на все остальные — печь меньше, наилучший ответ ≈ ${br.toFixed(0)}.`);
}

/* Завершить уровень 1 (нужна медаль экзамена): «sell» — цена лавки сразу, «keep» — дочка с дивидендом. */
function levelFinish(st, choice) {
  const medal = st.examBest && st.examBest.medal;
  if (!medal) return null;
  const sale = Math.round(fairSalePrice(medal));
  const fair = fairNewState(FAIR.grant + (choice === "sell" ? sale : 0));
  if (choice === "keep") fair.subsidiaries = [{ name: "Лавка у парка", level: 1, medal, dividend: LEVEL1_DIVIDEND[medal], daysLeft: FAIR.dividendDays }];
  return { ...st, level: 2, fair, level1: { medal, choice, sale, closedDay: st.day } };
}

export {
  FAIR, FAIR_RIVAL_NAMES, FAIR_UPGRADES, fairCournotAsym, fairBuy, fairMC, LEVEL1_DIVIDEND, FAIR_GOALS, FAIR_CHAPTERS,
  fairCournot, fairBR, fairRivalsReply, fairStackelberg, fairCartelMath, fairSalePrice,
  fairNewState, fairFit, fairSimulate, fairVerdict, levelFinish, lavkaRng,
};
