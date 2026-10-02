/* «Своё производство» — уровень 4 «Пути компании» (чистая логика, без React).
   Новый рычаг — НАЙМ. Пекарня продаёт пирожки на конкурентном оптовом рынке по цене P (шок ±5%),
   выпуск f(L) = a·L − b·L², предельный продукт MPL = a − 2bL, предельный продукт в деньгах MRP = P·MPL.
   Главы (по дням):
     1. Рынок труда — зарплата w задана рынком: нанимай, пока MRP ≥ w (MRP = w).
     2. Монопсония — пекарня единственный работодатель: предложение труда w(L) = c + d·L, чтобы нанять ещё одного,
        приходится поднять зарплату всем — MRC = c + 2dL > w. Оптимум MRP = MRC: занятость и зарплата ниже конкурентных.
     3. МРОТ — делает MRC плоской до L_s(МРОТ): занятость растёт, если МРОТ между монопсонической зарплатой w_m и
        MRP(L_m); максимум — при МРОТ, равном конкурентной зарплате w_c (той, что была бы, если бы зарплата не зависела
        от найма пекарни); при МРОТ выше MRP(L_m) занятость ниже монопсонической (зеркало потолка цены у монополиста).
   Печь: аренда ovenRent в день или покупка за ovenPrice; горизонт уровня — ovenDays дней, в последний день печь
   продаётся за ovenSalvage. Сравнение по NPV на ОСТАВШИЙСЯ горизонт. Ставка r = 0,5%/день — игровая (≈ 500% годовых). */
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

/* Аренда печи против покупки в день day: PV аренды на оставшийся горизонт против цены минус PV остаточной стоимости. */
function factoryOvenMath(day = 1) {
  const { ovenRent, ovenPrice, ovenSalvage, rate: r } = FACTORY;
  const N = FACTORY.ovenDays - (day - 1);
  if (N <= 0) return { N: 0, pvRent: 0, pvBuy: ovenPrice, buyBetter: false, saving: -ovenPrice };
  const pvRent = (ovenRent * (1 - (1 + r) ** -N)) / r, pvBuy = ovenPrice - ovenSalvage / (1 + r) ** N;
  return { N, pvRent, pvBuy, buyBetter: pvBuy < pvRent, saving: pvRent - pvBuy };
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
  if (st.ovenOwned || st.cash < FACTORY.ovenPrice || st.day >= FACTORY.ovenDays) return st;
  return { ...st, ovenOwned: true, ovenGood: factoryOvenMath(st.day).buyBetter, ovenBoughtDay: st.day, cash: st.cash - FACTORY.ovenPrice };
}

/* Оптимум и зарплата в текущей главе. */
const factoryMarket = (st) => (st.chapter === 1 ? { market: "competitive" } : st.chapter === 2 ? { market: "monopsony" } : { market: "monopsony", wMin: FACTORY.wMin });
/* Зарплата при найме L: на рынке — рыночная; при монопсонии — по предложению, но не ниже МРОТ. */
function factoryWage(st, L) {
  if (st.chapter === 1) return FACTORY.wMarket;
  const ws = factorySupplyW(L);
  return st.chapter === 3 ? Math.max(FACTORY.wMin, ws) : ws;
}
/* Расходы на труд и целочисленный оптимум найма по ожидаемой прибыли. */
const factoryCost = (st, L) => factoryWage(st, L) * L;
function factoryBestL(st) {
  let best = 0, bestP = -Infinity;
  for (let L = 0; L <= 40; L++) { const p = FACTORY.price * factoryQ(L) - factoryCost(st, L); if (p > bestP + 1e-9) { bestP = p; best = L; } }
  return best;
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
  const interest = st.cash * FACTORY.rate; // игровая ставка; отрицательный остаток — кредит под ту же ставку
  /* Конец горизонта печи: продать за остаточную стоимость. */
  const salvage = st.ovenOwned && st.day >= FACTORY.ovenDays ? FACTORY.ovenSalvage : 0;
  let dividend = 0;
  const subsidiaries = (st.subsidiaries || []).map((s) => { if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; } return s; });
  const opt = { ...factoryLabor(factoryMarket(st)), Lint: factoryBestL(st) };
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  if (L === opt.Lint) hit(st.chapter === 1 ? "mrp" : st.chapter === 2 ? "monopsony" : "minwage");
  if (st.ovenOwned && st.ovenGood) hit("oven");
  let reward = 0;
  for (const id of newGoals) reward += FACTORY_GOALS.find((g) => g.id === id)?.reward || 0;
  let chapter = st.chapter, newChapter = null;
  const up = FACTORY_CHAPTERS[chapter];
  if (up && st.day + 1 >= up.fromDay) { chapter += 1; newChapter = chapter; }
  /* Дискретные приросты: L-й работник и следующий (L + 1)-й — пирожки и рост расходов на труд с учётом прибавки всем. */
  const dQl = factoryQ(L) - factoryQ(L - 1), dCl = factoryCost(st, L) - factoryCost(st, Math.max(0, L - 1));
  const dQn = factoryQ(L + 1) - factoryQ(L), dCn = factoryCost(st, L + 1) - factoryCost(st, L);
  const report = { day: st.day, L, P, Q: factoryQ(L), wage, oven, profit, interest, dividend, reward, salvage, newGoals, newChapter, chapter: st.chapter,
    mrp: factoryMRP(L), mlc: factoryMarginalLaborCost(st, L), opt, dQl, dCl, dQn, dCn };
  const next = { ...st, day: st.day + 1, chapter, cash: Math.round(st.cash + profit + interest + dividend + reward + salvage), goals, subsidiaries,
    ovenOwned: salvage ? false : st.ovenOwned,
    history: [...(st.history || []), { day: st.day, profit: Math.round(profit) }].slice(-60), last: report, at: Date.now() };
  return { next, report };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");
/* Вердикт на дискретных приростах: что дал L-й работник и что дал бы следующий — против того, во что они обходятся
   (на монопсонии и на углу МРОТ это не зарплата, а рост расходов на всех). */
function factoryVerdict(r) {
  const P = FACTORY.price, parts = [];
  parts.push(`${r.L}-й работник добавил ≈ ${fmt(r.dQl, 1)} пирожка (≈ ${fmt(P * r.dQl)} ₽) и увеличил расходы на труд на ≈ ${fmt(r.dCl)} ₽${r.chapter > 1 ? " (с учётом прибавки всем)" : ""}.`);
  parts.push(`Следующий добавил бы ≈ ${fmt(P * r.dQn)} ₽, а стоил бы ≈ ${fmt(r.dCn)} ₽.`);
  if (P * r.dQn > r.dCn) parts.push("Нанимать ещё выгодно.");
  else if (P * r.dQl < r.dCl) parts.push("Последний работник убыточен — нанимай меньше.");
  else parts.push("Найм оптимален: последний окупается, следующий — нет.");
  if (r.chapter === 2) parts.push(`Монопсония: оптимум MRP = MRC — ${r.opt.Lint} работников по ${fmt(factorySupplyW(r.opt.Lint))} ₽. Если бы зарплата не зависела от найма пекарни, было бы ${fmt(factoryCompetitiveEq().L)} по ${fmt(factoryCompetitiveEq().w)} ₽.`);
  if (r.chapter === 3) parts.push(`С МРОТ ${FACTORY.wMin} ₽ по нему готовы работать ${fmt(r.opt.Ls || 0, 1)} человек: оптимум вырос с монопсонических ${factoryBestL({ chapter: 2 })} до ${r.opt.Lint} (как потолок цены у монополиста); дальше MRC прыгает — каждый новый поднимает зарплату всем.`);
  return parts.join(" ");
}

/* ===== Экзамен уровня 4 =====
   4 задачи на копии пекарни (касса не меняется), параметры случайны. Оценка — по решениям:
   найм — 1 − (|L − L*| − 0,5)/L*; печь — верное решение по NPV (1 или 0). Медали — как на уровнях 1–3. */
const factoryExamOpen = (f) => (f.chapter || 1) >= 3 && f.day >= 22;
/* Конкурентная зарплата задачи (MRP = w(L) на кривой предложения). */
function factoryExamCompW(d) {
  const L = (d.P * FACTORY.a - d.c) / (2 * FACTORY.b * d.P + d.d);
  return d.c + d.d * L;
}
function factoryExamNew(f, seed) {
  const rng = lavkaRng(seed), pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const P1 = pick(90, 120), w1 = pick(16, 26) * 100;
  const comp = { kind: "competitive", title: "Рынок труда", P: P1, w: w1,
    text: `Пирожок стоит ${P1} ₽, зарплата на рынке ${w1} ₽. MPL = 40 − L. Сколько нанять?` };
  const P2 = pick(90, 110), c2 = pick(3, 7) * 100, d2 = pick(6, 9) * 10;
  const mono = { kind: "monopsony", title: "Монопсония", P: P2, c: c2, d: d2,
    text: `Ты единственный работодатель: чтобы нанять L человек, платишь каждому w = ${c2} + ${d2}·L. Пирожок ${P2} ₽, MPL = 40 − L. Сколько нанять?` };
  const P3 = pick(95, 105), c3 = 500, d3 = 75;
  const base = { P: P3, c: c3, d: d3 }, wComp = factoryExamCompW(base);
  const wMin = pick(0, 3) === 0 ? Math.round(wComp / 100 + 3) * 100 : pick(16, 19) * 100;
  const minw = { kind: "minwage", title: "МРОТ", ...base, wMin,
    text: `Ты единственный работодатель: w = ${c3} + ${d3}·L, но введён МРОТ ${wMin} ₽. Пирожок ${P3} ₽, MPL = 40 − L. Сколько нанять?` };
  const rent = pick(15, 25) * 100, price = pick(6, 12) * 10000, salvage = pick(0, 4) * 5000;
  const oven = { kind: "oven", title: "Печь", rent, price, salvage,
    text: `Аренда печи ${rent} ₽/день или покупка за ${price} ₽ с продажей через 60 дней за ${salvage} ₽. Ставка r = 0,5% в день. Купить?` };
  return { seed, results: [], days: [comp, mono, minw, oven] };
}
function factoryExamBest(d) {
  const { a, b } = FACTORY;
  if (d.kind === "competitive") return { L: Math.max(0, (a - d.w / d.P) / (2 * b)) };
  if (d.kind === "monopsony") return { L: Math.max(0, (d.P * a - d.c) / (2 * b * d.P + 2 * d.d)) };
  if (d.kind === "minwage") {
    const Lm = (d.P * a - d.c) / (2 * b * d.P + 2 * d.d), wm = d.c + d.d * Lm;
    if (d.wMin <= wm) return { L: Lm };
    return { L: Math.min((d.wMin - d.c) / d.d, Math.max(0, (a - d.wMin / d.P) / (2 * b))) };
  }
  const r = FACTORY.rate, N = FACTORY.ovenDays;
  return { buy: d.price - d.salvage / (1 + r) ** N < (d.rent * (1 - (1 + r) ** -N)) / r };
}
function factoryExamPlayDay(f, exam, ans) {
  const i = exam.results.length, d = exam.days[i], best = factoryExamBest(d);
  let score;
  if (d.kind === "oven") score = ans.buy === best.buy ? 1 : 0;
  else { const L = Math.max(0, Math.round(ans.L || 0)); score = Math.max(0, 1 - Math.max(0, Math.abs(L - best.L) - 0.5) / Math.max(1, best.L)); }
  const res = { ans, best, score };
  return { exam: { ...exam, results: [...exam.results, res] }, result: res, done: i + 1 === exam.days.length };
}
function factoryExamResult(exam) {
  if (!exam.results.length) return null;
  const days = exam.results.map((r) => r.score);
  const eff = days.reduce((x, y) => x + y, 0) / days.length, minDay = Math.min(...days);
  return { eff, minDay, days, medal: lavkaExamMedal(eff, minDay) };
}
function factoryExamFinish(f, exam) {
  const res = factoryExamResult(exam), prev = f.examBest || { eff: -Infinity, medal: null, attempts: 0 };
  const better = !!res && res.eff > prev.eff;
  return { ...f, examActive: null, examBest: { eff: better ? res.eff : prev.eff, medal: better ? (res.medal ? res.medal.id : null) : prev.medal,
    day: better ? f.day : prev.day, attempts: (prev.attempts || 0) + 1 } };
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
  factoryExamOpen, factoryExamCompW, factoryExamNew, factoryExamBest, factoryExamPlayDay, factoryExamResult, factoryExamFinish,
  FACTORY, LEVEL3_DIVIDEND, FACTORY_GOALS, FACTORY_CHAPTERS,
  factoryQ, factoryMPL, factoryMRP, factorySupplyW, factoryMRC, factoryCompetitiveEq, factoryLabor, factoryOvenMath,
  factorySalePrice3, factoryNewState, factoryBuyOven, factoryCost, factoryBestL, factoryMarket, factoryWage, factoryMarginalLaborCost,
  factorySimulate, factoryVerdict, levelFinish3, lavkaRng, lavkaExamMedal,
};
