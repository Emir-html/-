/* «Своё производство» — уровень 4 «Пути компании» (чистая логика, без React).
   Новый рычаг — НАЙМ. Пекарня продаёт пирожки на конкурентном оптовом рынке по цене P (шок ±5%),
   выпуск f(L) = a·L − b·L², предельный продукт MPL = a − 2bL, предельный продукт в деньгах MRP = P·MPL.
   Главы (по дням):
     1. Рынок труда — зарплата w задана рынком: нанимай, пока MRP ≥ w (MRP = w).
     2. Монопсония — пекарня единственный работодатель: предложение труда w(L) = c + d·L, чтобы нанять ещё одного,
        приходится поднять зарплату всем — MRC = c + 2dL > w. Оптимум MRP = MRC: занятость и зарплата ниже конкурентных.
     3. МРОТ — минимальная зарплата между монопсонической и конкурентной делает MRC плоской до L_s(МРОТ):
        занятость РАСТЁТ (зеркало потолка цены у монополиста); слишком высокий МРОТ (выше конкурентной) её снижает.
   Печь: аренда ovenRent в день или покупка за ovenPrice с остаточной стоимостью через ovenDays дней — сравнение по NPV. */
import { lavkaRng, lavkaExamMedal } from "./model.js";

const FACTORY = {
  price: 100, noise: 0.05, a: 40, b: 0.5,
  wMarket: 2000, supplyC: 500, supplyD: 75, wMin: 1800,
  ovenRent: 2000, ovenPrice: 80000, ovenSalvage: 20000, ovenDays: 60,
  rate: 0.005, dividendDays: 60, grant: 20000,
};
/* Дивиденд сети кофеен по медали экзамена уровня 3 (₽/день). */
const LEVEL3_DIVIDEND = { gold: 5000, silver: 3600, bronze: 2300 };
const factorySalePrice3 = (medal) => {
  const D = LEVEL3_DIVIDEND[medal] || 0, r = FACTORY.rate, N = FACTORY.dividendDays;
  return (D * (1 - (1 + r) ** -N)) / r;
};

const factoryQ = (L) => Math.max(0, FACTORY.a * L - FACTORY.b * L * L);
const factoryMPL = (L) => FACTORY.a - 2 * FACTORY.b * L;
const factoryMRP = (L, P = FACTORY.price) => P * factoryMPL(L);
const factorySupplyW = (L) => FACTORY.supplyC + FACTORY.supplyD * L;
const factoryMRC = (L) => FACTORY.supplyC + 2 * FACTORY.supplyD * L;

/* Конкурентное равновесие на местном рынке труда (если бы пекарня брала зарплату как данность): MRP = w(L). */
function factoryCompetitiveEq() {
  const { price: P, a, b, supplyC: c, supplyD: d } = FACTORY;
  const L = (P * a - c) / (2 * b * P + d);
  return { L, w: c + d * L };
}

/* Оптимальный найм. market: "competitive" (зарплата w), "monopsony" (предложение c + dL, возможен МРОТ wMin). */
function factoryLabor({ market, w = FACTORY.wMarket, wMin = null, P = FACTORY.price }) {
  const { a, b, supplyC: c, supplyD: d } = FACTORY;
  if (market === "competitive") { const L = Math.max(0, (a - w / P) / (2 * b)); return { L, w }; }
  const Lm = Math.max(0, (P * a - c) / (2 * b * P + 2 * d)), wm = c + d * Lm;
  if (wMin == null || wMin <= wm) return { L: Lm, w: wm };
  /* МРОТ: до L_s = (МРОТ − c)/d каждый работник стоит ровно МРОТ (MRC плоская), дальше — по предложению. */
  const Ls = (wMin - c) / d, Ld = Math.max(0, (a - wMin / P) / (2 * b));
  return { L: Math.min(Ls, Ld), w: wMin, Ls, Ld };
}

/* Аренда печи против покупки: PV аренды на ovenDays дней против цены минус PV остаточной стоимости. */
function factoryOvenMath() {
  const { ovenRent, ovenPrice, ovenSalvage, ovenDays: N, rate: r } = FACTORY;
  const pvRent = (ovenRent * (1 - (1 + r) ** -N)) / r, pvBuy = ovenPrice - ovenSalvage / (1 + r) ** N;
  return { pvRent, pvBuy, buyBetter: pvBuy < pvRent, saving: pvRent - pvBuy };
}

const FACTORY_GOALS = [
  { id: "mrp", emoji: "👷", title: "MRP = w", desc: "На конкурентном рынке труда найми столько, сколько выгодно (±1).", reward: 4000 },
  { id: "monopsony", emoji: "🏭", title: "Монопсония", desc: "Единственный работодатель: найм по MRP = MRC (±1).", reward: 4000 },
  { id: "minwage", emoji: "📈", title: "МРОТ", desc: "При МРОТ найми столько, сколько готовы работать по МРОТ (±1) — занятость выросла.", reward: 4000 },
  { id: "oven", emoji: "🔥", title: "Своя печь", desc: "Купи печь, если по NPV это дешевле аренды.", reward: 3000 },
];
const FACTORY_CHAPTERS = [
  { n: 1, title: "Рынок труда", fromDay: 1 },
  { n: 2, title: "Монопсония", fromDay: 8 },
  { n: 3, title: "МРОТ", fromDay: 15 },
];

function factoryNewState(cash = FACTORY.grant) {
  return { v: 1, level: 4, day: 1, chapter: 1, cash: Math.round(cash), L: 15, ovenOwned: false, goals: {}, history: [], subsidiaries: [], last: null };
}
function factoryBuyOven(st) {
  if (st.ovenOwned || st.cash < FACTORY.ovenPrice) return st;
  return { ...st, ovenOwned: true, cash: st.cash - FACTORY.ovenPrice };
}

/* Оптимум и зарплата в текущей главе. */
const factoryMarket = (st) => (st.chapter === 1 ? { market: "competitive" } : st.chapter === 2 ? { market: "monopsony" } : { market: "monopsony", wMin: FACTORY.wMin });
/* Зарплата при найме L: на рынке — рыночная; при монопсонии — по предложению, но не ниже МРОТ. */
function factoryWage(st, L) {
  if (st.chapter === 1) return FACTORY.wMarket;
  const ws = factorySupplyW(L);
  return st.chapter === 3 ? Math.max(FACTORY.wMin, ws) : ws;
}
/* Предельные расходы на труд при найме L (что стоит нанять L-го). */
function factoryMarginalLaborCost(st, L) {
  if (st.chapter === 1) return FACTORY.wMarket;
  if (st.chapter === 3 && factorySupplyW(L) <= FACTORY.wMin) return FACTORY.wMin;
  return factoryMRC(L);
}

function factorySimulate(st, rng = Math.random) {
  const L = Math.max(0, Math.round(st.L));
  const P = FACTORY.price * (1 + FACTORY.noise * (2 * rng() - 1));
  const wage = factoryWage(st, L), oven = st.ovenOwned ? 0 : FACTORY.ovenRent;
  const profit = P * factoryQ(L) - wage * L - oven;
  const interest = Math.max(0, st.cash) * FACTORY.rate;
  let dividend = 0;
  const subsidiaries = (st.subsidiaries || []).map((s) => { if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; } return s; });
  const opt = factoryLabor(factoryMarket(st));
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  if (Math.abs(L - opt.L) <= 1) hit(st.chapter === 1 ? "mrp" : st.chapter === 2 ? "monopsony" : "minwage");
  if (st.ovenOwned && factoryOvenMath().buyBetter) hit("oven");
  let reward = 0;
  for (const id of newGoals) reward += FACTORY_GOALS.find((g) => g.id === id)?.reward || 0;
  let chapter = st.chapter, newChapter = null;
  const up = FACTORY_CHAPTERS[chapter];
  if (up && st.day + 1 >= up.fromDay) { chapter += 1; newChapter = chapter; }
  const report = { day: st.day, L, P, Q: factoryQ(L), wage, oven, profit, interest, dividend, reward, newGoals, newChapter, chapter: st.chapter,
    mrp: factoryMRP(L), mlc: factoryMarginalLaborCost(st, L), opt };
  const next = { ...st, day: st.day + 1, chapter, cash: Math.round(st.cash + profit + interest + dividend + reward), goals, subsidiaries,
    history: [...(st.history || []), { day: st.day, profit: Math.round(profit) }].slice(-60), last: report, at: Date.now() };
  return { next, report };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");
/* Вердикт: MRP последнего работника против того, во что он обходится (w или MRC). */
function factoryVerdict(r) {
  const parts = [`${r.L}-й работник добавил ${fmt(factoryMPL(r.L))} пирожков, MRP ≈ ${fmt(r.mrp)} ₽.`];
  const what = r.chapter === 1 ? `зарплата ${fmt(r.mlc)} ₽` : r.chapter === 3 && r.mlc === FACTORY.wMin ? `МРОТ ${fmt(r.mlc)} ₽ (MRC плоская до тех, кто готов работать по МРОТ)` : `MRC ≈ ${fmt(r.mlc)} ₽ — нанимая ещё одного, ты поднимаешь зарплату всем (сейчас ${fmt(r.wage)} ₽)`;
  const d = r.mrp - r.mlc;
  parts.push(Math.abs(d) <= 150 ? `Он обходится в ${what} — почти столько же: найм близок к оптимуму.`
    : d > 0 ? `Он обходится в ${what} — меньше MRP: нанимать ещё выгодно.` : `Он обходится в ${what} — больше MRP: последний работник убыточен.`);
  if (r.chapter === 2) parts.push(`Монопсония: оптимум MRP = MRC при ${fmt(r.opt.L)} работниках и зарплате ${fmt(r.opt.w)} ₽ — ниже конкурентных ${fmt(factoryCompetitiveEq().L)} и ${fmt(factoryCompetitiveEq().w)} ₽.`);
  if (r.chapter === 3) parts.push(`С МРОТ ${FACTORY.wMin} ₽ готовы работать ${fmt(r.opt.Ls || 0, 1)} человек — найм вырос с монопсонических ${fmt(factoryLabor({ market: "monopsony" }).L)} (как потолок цены у монополиста).`);
  return parts.join(" ");
}

/* Завершить уровень 3 (нужна медаль экзамена сети): продать сеть или оставить дочкой; дочки копятся. */
function levelFinish3(st, choice) {
  const medal = st.chain && st.chain.examBest && st.chain.examBest.medal;
  if (!medal) return null;
  const sale = Math.round(factorySalePrice3(medal));
  const factory = factoryNewState(FACTORY.grant + (choice === "sell" ? sale : 0));
  factory.subsidiaries = [...(st.chain.subsidiaries || []).filter((s) => s.daysLeft > 0)];
  if (choice === "keep") factory.subsidiaries.push({ name: "Сеть кофеен", level: 3, medal, dividend: LEVEL3_DIVIDEND[medal], daysLeft: FACTORY.dividendDays });
  return { ...st, level: 4, factory, level3: { medal, choice, sale, closedDay: st.chain.day } };
}

export {
  FACTORY, LEVEL3_DIVIDEND, FACTORY_GOALS, FACTORY_CHAPTERS,
  factoryQ, factoryMPL, factoryMRP, factorySupplyW, factoryMRC, factoryCompetitiveEq, factoryLabor, factoryOvenMath,
  factorySalePrice3, factoryNewState, factoryBuyOven, factoryMarket, factoryWage, factoryMarginalLaborCost,
  factorySimulate, factoryVerdict, levelFinish3, lavkaRng, lavkaExamMedal,
};
