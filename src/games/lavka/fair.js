/* «Ярмарка» — уровень 2 «Пути компании» (чистая логика, без React).
   Новый рычаг — КОЛИЧЕСТВО. Рынок пирожков: обратный спрос P = A − B·Q, Q — сумма объёмов всех продавцов,
   цена расчищает рынок (всё выпеченное продаётся). MC постоянны, аренда места — постоянные издержки.

   Конкуренты — опытные торговцы: каждый день они играют равновесие Курно для текущего числа фирм и издержек
   («ожидают от тебя рационального ответа»). Почему не «наилучший ответ на вчерашний объём»: при трёх и более фирмах
   такие наивные ответы не сходятся к равновесию (колеблются или расходятся — пример Теокариса).

   Главы открываются по дням — рынок не ждёт игрока; цели дают награды.
     1. Курно — дуополия с Семёном: остаточный спрос P = (A − B·Q₋) − B·q, наилучший ответ q = (A − c − B·Q₋)/(2B).
     2. Вход конкурентов — новичок входит, если ожидает в равновесии Курно с n + 1 фирмами прибыль выше аренды
        (сигнал — несколько дней прибыли у продавцов). При целом числе фирм прибыль не обнуляется ровно: остаётся
        меньше той, что покрыла бы аренду ещё одного входящего (здесь граница — 4 фирмы).
     3. Картель и лидерство — рынок на двоих: Семён предлагает квоты (пропорционально Курно, в сумме — монопольный
        выпуск при средней MC); обман даёт выигрыш на день и наказание Курно на FAIR.punishDays дней —
        повторяющаяся дилемма заключённого. «Утренний прилавок» делает игрока лидером по Штакельбергу.
   Капитал между уровнями: лавку уровня 1 можно продать за аннуитет D̄(медаль)·(1 − (1 + r)^−N)/r
   или оставить дочкой с дивидендом D̄ в день N дней; остаток на счёте приносит r в день (депозит). */
import { lavkaRng } from "./model.js";

const FAIR = {
  A: 200, B: 1, c: 40, rent: 800, noise: 0.05,
  punishDays: 5, maxFirms: 6, entryDays: 3,
  rate: 0.005, dividendDays: 60, grant: 5000, oracleDays: 7,
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
/* Курно с n фирмами, у игрока MC = cp, у остальных — FAIR.c: qᵢ = (A − n·cᵢ + Σⱼ≠ᵢ cⱼ)/((n + 1)B). */
function fairNashAsym(n, cp = FAIR.c) {
  const { A, B, c } = FAIR;
  const qp = Math.max(0, (A - n * cp + (n - 1) * c) / ((n + 1) * B));
  const qr = Math.max(0, (A - 2 * c + cp) / ((n + 1) * B));
  const P = Math.max(0, A - B * (qp + (n - 1) * qr));
  return { n, qp, qr, P, profitP: (P - cp) * qp, profitR: (P - c) * qr };
}
/* Асимметричный Курно на двоих: qᵢ = (A − 2cᵢ + cⱼ)/(3B). */
function fairCournotAsym(cp, cr = FAIR.c) {
  const { A, B } = FAIR;
  const qp = (A - 2 * cp + cr) / (3 * B), qr = (A - 2 * cr + cp) / (3 * B), P = A - B * (qp + qr);
  return { qp, qr, P, profitP: (P - cp) * qp, profitR: (P - cr) * qr };
}
/* Наилучший ответ на суммарный объём остальных (mc — свои предельные издержки). */
const fairBR = (Qothers, mc = FAIR.c) => Math.max(0, (FAIR.A - mc - FAIR.B * Qothers) / (2 * FAIR.B));
/* Ответ k симметричных последователей (MC = FAIR.c) на объём лидера qp: каждый q = (A − c − B·qp)/(B(k + 1)). */
const fairRivalsReply = (qp, k) => Math.max(0, (FAIR.A - FAIR.c - FAIR.B * qp) / (FAIR.B * (k + 1)));

/* Штакельберг: лидер (игрок, MC = cp) и k последователей. Остаточный спрос лидера с учётом их реакции:
   P = (A + k·c)/(k + 1) − B·q/(k + 1); оптимум q_L = (A + k·c − (k + 1)·cp)/(2B). */
function fairStackelberg(k = 1, cp = FAIR.c) {
  const { A, B, c } = FAIR;
  const qL = Math.max(0, (A + k * c - (k + 1) * cp) / (2 * B)), qF = fairRivalsReply(qL, k);
  const P = A - B * (qL + k * qF);
  return { qL, qF, P, profitL: (P - cp) * qL, profitF: (P - c) * qF };
}

/* Картель на двоих (игрок с MC = cp и Семён с FAIR.c): общий выпуск — монопольный при средней MC,
   квоты — пропорционально объёмам Курно, чтобы оба выигрывали против Курно. При равных MC — по половине. */
function fairCartelMath(cp = FAIR.c) {
  const { A, B, c } = FAIR;
  const cn = fairCournotAsym(cp, c);
  const Qm = (A - (cp + c) / 2) / (2 * B);
  const qPlayer = (Qm * cn.qp) / (cn.qp + cn.qr), qRival = Qm - qPlayer;
  const P = A - B * Qm;
  const cartelProfit = (P - cp) * qPlayer, rivalProfit = (P - c) * qRival;
  const qCheat = fairBR(qRival, cp);
  const cheatProfit = (A - B * (qCheat + qRival) - cp) * qCheat;
  const cournotProfit = cn.profitP;
  /* Для вечного наказания картель устойчив при δ ≥ (π_обман − π_картель)/(π_обман − π_Курно). */
  const deltaMin = (cheatProfit - cartelProfit) / (cheatProfit - cournotProfit);
  return { qPlayer, qRival, qCartel: qPlayer, Qm, P, cartelProfit, rivalProfit, qCheat, cheatProfit,
    cheatGain: cheatProfit - cartelProfit, cournotProfit, punishLoss: (cartelProfit - cournotProfit) * FAIR.punishDays, deltaMin };
}

/* Цена продажи бизнеса по медали: аннуитет на dividendDays дней при ставке rate. */
const fairSalePrice = (medal) => {
  const D = LEVEL1_DIVIDEND[medal] || 0, r = FAIR.rate, N = FAIR.dividendDays;
  return (D * (1 - (1 + r) ** -N)) / r;
};

const FAIR_UPGRADES = [
  { id: "flour", emoji: "🌾", title: "Своя мука", cost: 12000, chapter: 1,
    desc: "Твои предельные издержки −10 ₽ (у конкурентов прежние).",
    lesson: "Ниже MC — дальше вправо твой наилучший ответ: в равновесии Курно ты выпускаешь больше, конкуренты — меньше. В дуополии прибыль растёт ≈ на 750 ₽/день — доходность ≈ 6% в день при ставке r = 0,5%: NPV > 0, вкладывать выгоднее, чем держать на депозите." },
  { id: "leader", emoji: "🌅", title: "Утренний прилавок", cost: 6000, chapter: 3,
    desc: "Ты выкладываешь пирожки первым: конкуренты видят твой сегодняшний объём и отвечают на него.",
    lesson: "Штакельберг: лидер выбирает объём, зная ответ последователя, — q_L = (A − c)/(2B). Ранний ход — это обязательство: против Курно оно даёт ≈ +356 ₽/день (как картель, но без договора и соблазна обмана)." },
];
const fairMC = (st) => FAIR.c - (st.upgrades && st.upgrades.flour ? 10 : 0);
function fairBuy(st, id) {
  const u = FAIR_UPGRADES.find((x) => x.id === id);
  if (!u || (st.upgrades && st.upgrades[id]) || st.cash < u.cost || (st.chapter || 1) < u.chapter) return st;
  const next = { ...st, cash: st.cash - u.cost, upgrades: { ...(st.upgrades || {}), [id]: true } };
  if (id === "leader") { next.leader = true; next.cartel = null; } // ты задаёшь тон — картель Семёну больше не нужен
  return next;
}

const FAIR_GOALS = [
  { id: "nash", emoji: "⚖️", title: "Равновесие Нэша", desc: "Твой объём — наилучший ответ на объём конкурентов (±3), а они отвечают наилучшим образом тебе.", reward: 1500 },
  { id: "longrun", emoji: "🏁", title: "Длинный период", desc: "Вход прекратился (новичку уже не покрыть аренду), а ты 3 дня подряд в плюсе.", reward: 2000 },
  { id: "cartel5", emoji: "🤝", title: "Верность картелю", desc: "5 дней подряд держи договорённость.", reward: 2500 },
  { id: "leader", emoji: "🌅", title: "Лидер Штакельберга", desc: "С утренним прилавком выбери объём лидера (±3).", reward: 2500 },
];

const FAIR_CHAPTERS = [
  { n: 1, title: "Курно", fromDay: 1, goal: "nash" },
  { n: 2, title: "Вход конкурентов", fromDay: 8, goal: "longrun" },
  { n: 3, title: "Картель и лидерство", fromDay: 15, goal: "cartel5" },
];

function fairNewState(cash = FAIR.grant) {
  return {
    v: 1, level: 2, day: 1, chapter: 1, cash: Math.round(cash), q: 50, lastQ: 50, upgrades: {},
    rivals: [{ name: FAIR_RIVAL_NAMES[0], q: fairCournot(2).q }], leader: false, cartel: null,
    goals: {}, obs: [], history: [], subsidiaries: [], profitStreak: 0, entryStreak: 0, last: null,
  };
}

/* Сколько испекут конкуренты сегодня (если игрок не лидер — от его объёма это не зависит). */
function fairRivalsToday(st) {
  const k = st.rivals.length, cp = fairMC(st);
  if (st.cartel && st.cartel.active && st.cartel.punish === 0 && !st.leader) return fairCartelMath(cp).qRival * k;
  return fairNashAsym(k + 1, cp).qr * k;
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

/* MR и наилучший ответ игрока при спросе (A, B): обычный остаточный спрос или спрос лидера с реакцией k последователей. */
function fairMargins({ A, B }, { q, Qr, k, leader, cp }) {
  const c = FAIR.c;
  if (leader) {
    const intercept = (A + k * c) / (k + 1), slope = B / (k + 1);
    return { intercept, slope, mr: intercept - 2 * slope * q, br: Math.max(0, (intercept - cp) / (2 * slope)) };
  }
  return { intercept: A - B * Qr, slope: B, mr: A - B * Qr - 2 * B * q, br: Math.max(0, (A - cp - B * Qr) / (2 * B)) };
}

/* Один день ярмарки. Чистая функция при заданном rng. */
function fairSimulate(st, rng = Math.random) {
  const { A, B, rent, noise } = FAIR;
  const cp = fairMC(st), k = st.rivals.length;
  const cm = fairCartelMath(cp);
  const q = Math.max(0, Math.round(st.q));
  /* Конкуренты: в картеле — квота; при лидерстве игрока — наилучший ответ на его СЕГОДНЯШНИЙ объём (Штакельберг);
     иначе — равновесие Курно для k + 1 фирм с учётом MC игрока. */
  const inCartel = !!(st.cartel && st.cartel.active && st.cartel.punish === 0) && !st.leader;
  const rivalQ = inCartel ? cm.qRival : st.leader ? fairRivalsReply(q, k) : fairNashAsym(k + 1, cp).qr;
  const rivals = st.rivals.map((r) => ({ ...r, q: rivalQ }));
  const Qr = rivalQ * k, Q = q + Qr;
  const Areal = A * (1 + noise * (2 * rng() - 1)); // шок спроса — после того, как все испекли
  const P = Math.max(0, Areal - B * Q);
  const profit = (P - cp) * q - rent;

  /* Депозит: остаток на счёте приносит r в день — поэтому «деньги сейчас» и «поток дивидендов» сравнимы по PV. */
  const interest = Math.max(0, st.cash) * FAIR.rate;
  let dividend = 0;
  const subsidiaries = (st.subsidiaries || []).map((s) => {
    if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; }
    return s;
  });

  /* Картель: обман — объём выше квоты; наказание — FAIR.punishDays дней Курно. */
  let cartel = st.cartel ? { ...st.cartel } : null, cheated = false;
  if (cartel && cartel.active && !st.leader) {
    if (cartel.punish > 0) { cartel.punish -= 1; cartel.faithful = 0; }
    else if (q > cm.qPlayer + 2) { cheated = true; cartel.punish = FAIR.punishDays; cartel.faithful = 0; }
    else cartel.faithful = (cartel.faithful || 0) + 1;
  }

  /* Вход: сигнал — продавцы в плюсе FAIR.entryDays дней подряд; решение — новичок ждёт в Курно с n + 1 фирмами
     прибыль выше аренды (с учётом MC игрока). Прибыль конкурентов — с их собственными MC. */
  let newRivals = rivals, entryStreak = st.entryStreak || 0, entered = null;
  const firms = rivals.length + 1;
  const entryClosed = fairNashAsym(firms + 1, cp).profitR <= rent || firms >= FAIR.maxFirms;
  if (st.chapter === 2) {
    const rivalProfit = rivals.length ? (P - FAIR.c) * rivals[0].q - rent : 0;
    entryStreak = rivalProfit > 0 ? entryStreak + 1 : 0;
    if (entryStreak >= FAIR.entryDays && !entryClosed) {
      entered = FAIR_RIVAL_NAMES[rivals.length] || `Продавец ${rivals.length + 1}`;
      newRivals = [...rivals, { name: entered, q: fairNashAsym(firms + 1, cp).qr }];
      entryStreak = 0;
    }
  }

  /* Цели. */
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  const profitStreak = profit > 0 ? (st.profitStreak || 0) + 1 : 0;
  if (st.chapter === 1 && Math.abs(q - fairBR(Qr, cp)) <= 3) hit("nash"); // конкуренты и так отвечают наилучшим образом
  if (st.chapter === 2 && entryClosed && !entered && profitStreak >= 3) hit("longrun");
  if (cartel && cartel.faithful >= 5) hit("cartel5");
  if (st.leader && Math.abs(q - fairStackelberg(k, cp).qL) <= 3) hit("leader");
  let reward = 0;
  for (const id of newGoals) reward += FAIR_GOALS.find((g) => g.id === id)?.reward || 0;

  /* Главы — по дням. */
  let chapter = st.chapter, newChapter = null;
  const up = FAIR_CHAPTERS[chapter];
  if (up && st.day + 1 >= up.fromDay) { chapter += 1; newChapter = chapter; }
  if (newChapter === 3) {
    /* Мэрия оставила две лицензии: рынок на двоих, Семён предлагает картель. */
    newRivals = [{ name: FAIR_RIVAL_NAMES[0], q: cm.qRival }];
    if (!st.leader) cartel = { active: true, punish: 0, faithful: 0 };
  }

  /* Решение принималось до шока спроса — MR и наилучший ответ считаем по среднему A. */
  const ctx = { q, Qr, k, leader: !!st.leader, cp };
  const tr = fairMargins({ A, B }, ctx);
  const report = {
    day: st.day, q, rivals, Qr, Q, A: Areal, P, profit, dividend, interest, reward, newGoals, newChapter, cheated, entered,
    br: tr.br, mrTrue: tr.mr, intercept: tr.intercept, slope: tr.slope, mc: cp, leader: !!st.leader, k,
    inCartel, cartelMath: inCartel || cheated ? cm : null,
    mode: st.day <= FAIR.oracleDays ? "oracle" : "estimate",
  };
  const fit = fairFit(st.obs);
  if (report.mode === "estimate" && fit) {
    const es = fairMargins(fit, ctx);
    Object.assign(report, { fit, mrEst: es.mr, brEst: es.br, interceptEst: es.intercept, slopeEst: es.slope });
  }
  const next = {
    ...st, day: st.day + 1, chapter, cash: Math.round(st.cash + profit + dividend + reward + interest), lastQ: q,
    rivals: newRivals, cartel, goals, subsidiaries, profitStreak, entryStreak,
    obs: [...(st.obs || []), { day: st.day, Q, P }].slice(-30),
    history: [...(st.history || []), { day: st.day, profit: Math.round(profit) }].slice(-60),
    last: report, at: Date.now(),
  };
  return { next, report };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");

/* Вердикт дня: остаточный спрос (у лидера — с реакцией последователей), MR vs MC; в картеле — цена обмана.
   Первая неделя — по истинному спросу, дальше — по оценке игрока. */
function fairVerdict(r) {
  const oracle = r.mode === "oracle";
  const mr = oracle ? r.mrTrue : r.mrEst, br = oracle ? r.br : r.brEst;
  const parts = [];
  if (r.inCartel && r.cartelMath) {
    const m = r.cartelMath;
    parts.push(`Картель: твоя квота ${fmt(m.qPlayer)}. Обман сегодня дал бы ≈ +${fmt(m.cheatGain)} ₽, но наказание — ${FAIR.punishDays} дн. Курно, ≈ −${fmt(m.punishLoss)} ₽. ` +
      `Картель устойчив, если δ ≥ ${fmt(m.deltaMin, 2)}; при r = 0,5% в день δ = 1/(1 + r) ≈ 0,995 — с запасом.`);
  }
  if (r.cheated && r.cartelMath) parts.push(`Ты испёк больше квоты — ${FAIR.punishDays} дней Семён печёт по Курно.`);
  if (mr == null) {
    parts.push(`Цена ${fmt(r.P)} ₽ при суммарном объёме ${fmt(r.Q)}. Чтобы оценить наилучший ответ, нужно хотя бы 3 дня с разным суммарным объёмом — меняй свой объём.`);
    return parts.join(" ");
  }
  const pre = oracle ? "" : "по твоей оценке спроса ";
  const ic = oracle ? r.intercept : r.interceptEst, sl = oracle ? r.slope : r.slopeEst;
  parts.push(r.leader
    ? `Ты лидер по Штакельбергу: последователи отвечают на твой объём, поэтому твой остаточный спрос P ≈ ${fmt(ic)} − ${fmt(sl, 2)}·q (с учётом их реакции).`
    : `Конкуренты выпекли ${fmt(r.Qr)}; твой остаточный спрос P ≈ (A − B·${fmt(r.Qr)}) − B·q = ${fmt(ic)} − ${fmt(sl, 2)}·q.`);
  const d = mr - r.mc;
  if (r.inCartel) parts.push(`${pre}MR = ${fmt(mr)} ${d > 3 ? ">" : d < -3 ? "<" : "≈"} MC = ${r.mc}: в одиночку выгодно было бы ${fmt(br)}, но это и есть обман.`);
  else if (Math.abs(d) <= 3) parts.push(`${pre}MR ≈ MC — объём ${r.q} близок к наилучшему ответу ${fmt(br)}.`);
  else if (d > 0) parts.push(`${pre}MR = ${fmt(mr)} > MC = ${r.mc}: выгодно печь больше — наилучший ответ ≈ ${fmt(br)}.`);
  else parts.push(`${pre}MR = ${fmt(mr)} < MC = ${r.mc}: лишние пирожки сбивают цену на все остальные — печь меньше, наилучший ответ ≈ ${fmt(br)}.`);
  return parts.join(" ");
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
  FAIR, FAIR_RIVAL_NAMES, FAIR_UPGRADES, LEVEL1_DIVIDEND, FAIR_GOALS, FAIR_CHAPTERS,
  fairCournot, fairNashAsym, fairCournotAsym, fairBR, fairRivalsReply, fairStackelberg, fairCartelMath, fairSalePrice,
  fairMC, fairBuy, fairNewState, fairRivalsToday, fairFit, fairMargins, fairSimulate, fairVerdict, levelFinish, lavkaRng,
};
