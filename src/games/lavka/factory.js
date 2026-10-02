/* «Своё производство» — уровень 4 «Пути компании»: цех варенья на заводе «Заря» (чистая логика, без React).
   Сценарий: docs/scenario/07_УРОВЕНЬ_4_ПРОИЗВОДСТВО.md, ПАРАМЕТРЫ.md; ревью: docs/reviews/2026-10-02-scenario.md.

   Новый рычаг — НАЙМ (целое L) и ОБОРУДОВАНИЕ (котёл: аренда или покупка).
   Продукт продаётся областной сети по рыночной цене (цех — ценополучатель): чистая цена p = 520 − 220 = 300 ₽ за набор,
   на Д19–21 — 380 (предновогодний пик). Выпуск Q(L) = 14L − 0,25L², MP_L = 14 − 0,5L.
   Цех — единственный работодатель в Заречье: предложение труда w(L) = 600 + 50L (чтобы нанять L-го, платишь w(L) всем),
   MRC = 600 + 100L. Монопсония: L = 14, w = 1 300 (MRP 2 100 > w). Конкурентный ориентир: L = 18, w = 1 500.
   Нижняя граница зарплаты: коллективный договор Нины (с Д10, если принят) или региональный МРОТ 1 400 (с Д16) —
   до L_s = 16 MRC плоская (= 1 400): занятость растёт с 14 до 16.
   Все решения о найме — по дискретным приростам: что даёт L-й работник (p·ΔQ) против роста расходов на всех.
   Котёл: аренда 8 000 ₽/день или покупка 280 000 (обслуживание 500 ₽/день, срок службы 48 дней, потом продаётся
   за 140 000). Б/у котёл на рынке стоит столько, сколько он сбережёт следующему владельцу: V = (8 000 − 500)·a(r, n) +
   140 000/(1 + r)ⁿ, n — оставшийся срок. Поэтому решение о покупке — по PV на весь срок службы (48 дней), а в конце
   уровня котёл продаётся по V. При r = 2% купить дешевле на 4 164 ₽, при 3% — аренда дешевле на 56 620. */
import { lavkaRng, lavkaExamMedal } from "./model.js";
import { CAPITAL, annuity, capitalPayDividends, capitalInterest, capitalTransition } from "./capital.js";

const FACTORY = {
  p: 300, pPeak: 380, peakFrom: 19, a: 14, b: 0.25,
  supplyC: 600, supplyD: 50, floor: 1400, contractDay: 10, letterDay: 13, letterCost: 15000, minWageDay: 16,
  shopRent: 3000,
  boiler: { rent: 8000, price: 280000, maint: 500, life: 48, salvage: 140000 },
  startL: 12, oracleDays: 7, examFromDay: 22, levelDays: 21,
};

const factoryQ = (L, a = FACTORY.a, b = FACTORY.b) => Math.max(0, a * L - b * L * L);
const factoryMP = (L) => FACTORY.a - 2 * FACTORY.b * L;
const factoryPrice = (day) => (day >= FACTORY.peakFrom ? FACTORY.pPeak : FACTORY.p);
const factorySupplyW = (L, c = FACTORY.supplyC, d = FACTORY.supplyD) => c + d * L;
/* Нижняя граница зарплаты в день day: договор Нины (если принят) с Д10, МРОТ с Д16. */
const factoryFloor = (st, day = st.day) => ((st.contract && day >= FACTORY.contractDay) || day >= FACTORY.minWageDay ? FACTORY.floor : 0);
/* Зарплата при найме L: по предложению труда, но не ниже границы. */
const factoryWage = (L, floor = 0, c = FACTORY.supplyC, d = FACTORY.supplyD) => Math.max(floor, factorySupplyW(L, c, d));
const factoryWageBill = (L, floor, c, d) => (L > 0 ? factoryWage(L, floor, c, d) * L : 0);
/* Маржа найма (без постоянных): p·Q(L) − w·L. */
const factoryLaborMargin = (L, { p, floor = 0, c = FACTORY.supplyC, d = FACTORY.supplyD }) => p * factoryQ(L) - factoryWageBill(L, floor, c, d);
/* Целочисленный оптимум найма. */
function factoryBestL(opts) {
  let best = 0, bestM = -Infinity;
  for (let L = 0; L <= 60; L++) { const m = factoryLaborMargin(L, opts); if (m > bestM + 1e-9) { bestM = m; best = L; } }
  return best;
}
/* Конкурентный ориентир: если бы зарплата не зависела от найма цеха — MRP = w(L). */
function factoryCompetitive(p = FACTORY.p, c = FACTORY.supplyC, d = FACTORY.supplyD) {
  const L = (p * FACTORY.a - c) / (2 * FACTORY.b * p + d);
  return { L, w: c + d * L };
}
/* Дискретные приросты при найме L-го: продукт в деньгах и рост расходов на труд (с прибавкой всем). */
function factoryStep(L, opts) {
  const c = opts.c ?? FACTORY.supplyC, d = opts.d ?? FACTORY.supplyD;
  return { mrp: opts.p * (factoryQ(L) - factoryQ(L - 1)), mrc: factoryWageBill(L, opts.floor || 0, c, d) - factoryWageBill(L - 1, opts.floor || 0, c, d) };
}

/* ===== Котёл ===== */
/* PV издержек котла на n оставшихся дней срока службы при ставке r: аренда против покупки (цена + обслуживание − продажа в конце). */
function factoryBoilerMath(r = CAPITAL.rate, n = FACTORY.boiler.life, price = FACTORY.boiler.price, rent = FACTORY.boiler.rent) {
  const B = FACTORY.boiler, a = annuity(n, r);
  const pvRent = rent * a, pvBuy = price + B.maint * a - B.salvage / (1 + r) ** n;
  return { n, r, pvRent, pvBuy, buyBetter: pvBuy < pvRent, saving: pvRent - pvBuy };
}
/* Рыночная цена б/у котла с n днями службы: сколько он сбережёт новому владельцу по сравнению с арендой. */
const factoryBoilerValue = (n, r = CAPITAL.rate) => {
  const B = FACTORY.boiler;
  return (B.rent - B.maint) * annuity(n, r) + B.salvage / (1 + r) ** n;
};

const FACTORY_GOALS = [
  { id: "monopsony", emoji: "🏭", title: "Монопсония", desc: "До договора и МРОТ найми столько, где следующий работник уже не окупает прибавку всем (MRP < MRC).", reward: 5000 },
  { id: "boiler", emoji: "🔥", title: "Котёл по PV", desc: "Купи котёл, если по PV на срок службы это дешевле аренды.", reward: 5000 },
  { id: "minwage", emoji: "📈", title: "Шестнадцать", desc: "При МРОТ найми выгодное число людей — занятость выросла.", reward: 5000 },
  { id: "peak", emoji: "🎄", title: "Перед Новым годом", desc: "При цене 380 найми выгодное число людей: теперь мешает уже не МРОТ, а кривая предложения.", reward: 4000 },
];
const FACTORY_CHAPTERS = [
  { n: 1, title: "Наниматель", fromDay: 1, goal: "monopsony" },
  { n: 2, title: "Договор", fromDay: 8, goal: "boiler" },
  { n: 3, title: "Шестнадцать", fromDay: 15, goal: "minwage" },
];

function factoryNewState(cash = CAPITAL.grant[4]) {
  return { v: 2, level: 4, day: 1, chapter: 1, cash: Math.round(cash), L: FACTORY.startL, boiler: null, contract: null, letter: null,
    offer: null, goals: {}, history: [], subsidiaries: [], flags: {}, last: null };
}
/* Купить котёл (можно уйти в минус: проценты на отрицательный остаток — по той же ставке, это и есть кредит Марка Ильича). */
function factoryBuyBoiler(st) {
  if (st.boiler || st.day > FACTORY.levelDays) return st;
  const m = factoryBoilerMath();
  return { ...st, boiler: { day: st.day, good: m.buyBetter }, cash: st.cash - FACTORY.boiler.price };
}
/* Договор Нины (Д10): принять — граница 1 400 сразу; Письмо против МРОТ (Д13): подписать — юрист 15 000, МРОТ всё равно вводят. */
function factoryAnswer(st, kind, yes) {
  if (!st.offer || st.offer !== kind) return st;
  if (kind === "contract") return { ...st, offer: null, contract: !!yes, flags: { ...st.flags, wagePolicy: yes ? "договор" : "рынок" } };
  if (kind === "letter") return { ...st, offer: null, letter: !!yes, cash: st.cash - (yes ? FACTORY.letterCost : 0), flags: { ...st.flags, foughtMinWage: !!yes } };
  return st;
}

function factorySimulate(st, rng = Math.random) {
  const day = st.day, p = factoryPrice(day), floor = factoryFloor(st);
  const L = Math.max(0, Math.round(st.L));
  const Q = factoryQ(L), wage = L > 0 ? factoryWage(L, floor) : 0;
  const boilerCost = st.boiler ? FACTORY.boiler.maint : FACTORY.boiler.rent;
  const margin = p * Q - wage * L;
  const profit = margin - FACTORY.shopRent - boilerCost;
  const pay = capitalPayDividends(st.subsidiaries), interest = capitalInterest(st.cash);
  /* В последний день уровня котёл продаётся по рыночной цене б/у (оставшийся срок службы). */
  let resale = 0;
  if (st.boiler && day === FACTORY.levelDays) resale = Math.round(factoryBoilerValue(FACTORY.boiler.life - (day - st.boiler.day + 1)));

  const opts = { p, floor }, Lbest = factoryBestL(opts);
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = day; newGoals.push(id); } };
  if (!floor && L === Lbest) hit("monopsony");
  if (st.boiler && st.boiler.good) hit("boiler");
  if (day >= FACTORY.minWageDay && day < FACTORY.peakFrom && L === Lbest) hit("minwage");
  if (day >= FACTORY.peakFrom && L === Lbest) hit("peak");
  let reward = 0;
  for (const id of newGoals) reward += FACTORY_GOALS.find((g) => g.id === id)?.reward || 0;

  const nd = day + 1;
  let chapter = st.chapter, newChapter = null;
  const up = FACTORY_CHAPTERS[chapter];
  if (up && nd >= up.fromDay) { chapter += 1; newChapter = chapter; }
  const offer = nd === FACTORY.contractDay && st.contract == null ? "contract" : nd === FACTORY.letterDay && st.letter == null ? "letter" : st.offer;

  const report = {
    day, L, Q, p, wage, floor, margin, shop: FACTORY.shopRent, boilerCost, profit, resale, dividend: pay.dividend, interest, reward, newGoals, newChapter,
    chapter: st.chapter, Lbest, step: L > 0 ? factoryStep(L, opts) : null, next: factoryStep(L + 1, opts), mode: day <= FACTORY.oracleDays ? "oracle" : "facts",
  };
  const next = {
    ...st, day: nd, chapter, offer, cash: Math.round(st.cash + profit + pay.dividend + interest + reward + resale), goals, subsidiaries: pay.subsidiaries,
    boiler: resale ? { ...st.boiler, sold: day, resale } : st.boiler,
    history: [...(st.history || []), { day, profit: Math.round(profit) }].slice(-60), last: report, at: Date.now(),
  };
  return { next, report };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");
/* Вердикт на дискретных приростах: L-й работник и следующий — против роста расходов на труд (на монопсонии это не
   зарплата, а прибавка всем; на углу МРОТ — ровно МРОТ, пока хватает желающих). При L = 0 — только про первого. */
function factoryVerdict(r) {
  const parts = [], s = r.step, n = r.next;
  if (s) parts.push(`${r.L}-й работник добавил ${fmt(s.mrp / r.p, 2)} набора (${fmt(s.mrp)} ₽), а расходы на труд выросли на ${fmt(s.mrc)} ₽${r.floor && r.wage === r.floor ? " — ровно граница, прибавки всем нет" : " — с прибавкой всем"}.`);
  parts.push(`Следующий принёс бы ${fmt(n.mrp)} ₽, а стоил бы ${fmt(n.mrc)} ₽.`);
  if (n.mrp > n.mrc) parts.push(r.mode === "oracle" ? "Мало людей: последний, кого ты взял(а), приносит больше, чем стоит." : "Нанимать ещё выгодно.");
  else if (s && s.mrp < s.mrc) parts.push(r.mode === "oracle" ? "Много: последний стоит тебе дороже, чем приносит — ты же всем поднял(а)." : "Последний работник убыточен — нанимай меньше.");
  else parts.push("Сходится: последний окупается, следующий — нет.");
  const comp = factoryCompetitive(r.p);
  if (!r.floor) parts.push(`Ты единственный работодатель: MRC > w. Если бы зарплата не зависела от твоего найма, было бы ${fmt(comp.L, 1)} человек по ${fmt(comp.w)} ₽.`);
  else parts.push(`Граница ${r.floor} ₽: по ней готовы работать ${fmt((r.floor - FACTORY.supplyC) / FACTORY.supplyD)} человек — до них каждый новый стоит ровно ${r.floor} ₽.`);
  return parts.join(" ");
}

/* ===== Экзамен уровня 4 =====
   3 сценария (не зависят от прошлых решений игрока), числа случайны по сиду:
     1. Монопсония без границы; 2. МРОТ (иногда выше MRP при монопсоническом найме — тогда занятость падает);
     3. Ставка изменилась: котёл (аренда или покупка на срок службы 48 дней) + найм при МРОТ.
   Оценка дня — 1 − 2·√(1 − маржа/маржа*) ≈ 1 − 2·|ΔL|/L*: маржа найма p·Q − w·L, в дне 3 — минус переплата неверного варианта котла
   в дневном эквиваленте (ΔPV/a(r, 48)): ошибка стоит пропорционально деньгам, а не «всё или ничего». */
const FACTORY_EXAM_KINDS = [
  { kind: "monopsony", title: "До 15-го: МРОТ ещё нет" },
  { kind: "minwage", title: "МРОТ" },
  { kind: "boiler", title: "Ставка изменилась" },
];
const factoryExamOpen = (f) => (f.chapter || 1) >= 3 && f.day >= FACTORY.examFromDay;
function factoryExamNew(f, seed) {
  const rng = lavkaRng(seed), pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const days = FACTORY_EXAM_KINDS.map((k) => {
    const p = pick(20, 40) * 10, c = pick(6, 18) * 50, d = pick(5, 10) * 10;
    const base = { kind: k.kind, title: k.title, p, c, d, seed: Math.floor(rng() * 2 ** 31) };
    if (k.kind === "monopsony") return { ...base, floor: 0, text: `Цена набора без сырья ${p} ₽. Чтобы пришли L человек, платишь каждому ${c} + ${d}·L. Сколько людей?` };
    const Lm = factoryBestL({ p, c, d }), wm = factorySupplyW(Lm, c, d), mrpLm = p * (factoryQ(Lm) - factoryQ(Lm - 1));
    /* МРОТ: обычно между w_m и MRP(L_m) — занятость растёт; иногда выше MRP(L_m) — занятость ниже монопсонической. */
    const high = rng() < 0.3;
    const floor = high ? Math.round((mrpLm + pick(1, 6) * 50) / 50) * 50 : Math.round((wm + rng() * (mrpLm - wm)) / 50) * 50;
    if (k.kind === "minwage") return { ...base, floor, text: `Цена ${p} ₽, предложение труда ${c} + ${d}·L, МРОТ ${floor} ₽. Сколько людей?` };
    const r = [0.015, 0.02, 0.025, 0.03, 0.035][pick(0, 4)];
    return { ...base, floor, r, text: `Ставка теперь ${String(r * 100).replace(".", ",")}% в день. Котёл на 48 дней службы: аренда ${FACTORY.boiler.rent} ₽/день или покупка ${FACTORY.boiler.price} ₽ (обслуживание ${FACTORY.boiler.maint} ₽/день, через 48 дней продашь за ${FACTORY.boiler.salvage}). И сколько людей — цена ${p} ₽, предложение ${c} + ${d}·L, МРОТ ${floor} ₽?` };
  });
  return { seed, results: [], days };
}
/* Маржа дня экзамена: найм; в дне «котёл» — минус дневной эквивалент PV выбранного варианта. */
function factoryExamMargin(d, ans) {
  const L = Math.max(0, Math.round(ans.L || 0));
  let m = factoryLaborMargin(L, d);
  /* Котёл: вычитаем только переплату неверного варианта (в дневном эквиваленте PV) — маржа эталона остаётся маржой найма. */
  if (d.kind === "boiler") { const bm = factoryBoilerMath(d.r); m -= Math.max(0, (ans.buy ? bm.pvBuy : bm.pvRent) - Math.min(bm.pvBuy, bm.pvRent)) / annuity(FACTORY.boiler.life, d.r); }
  return m;
}
function factoryExamBest(d) {
  const out = { L: factoryBestL(d) };
  if (d.kind === "boiler") out.buy = factoryBoilerMath(d.r).buyBetter;
  return out;
}
function factoryExamPlayDay(f, exam, ans) {
  const i = exam.results.length, d = exam.days[i], best = factoryExamBest(d);
  const res = { ans, best, playerMargin: factoryExamMargin(d, ans), botMargin: factoryExamMargin(d, best) };
  return { exam: { ...exam, results: [...exam.results, res] }, result: res, done: i + 1 === exam.days.length };
}
function factoryExamResult(exam) {
  if (!exam.results.length || exam.results.some((r) => !(r.botMargin > 0))) return null;
  /* √(1 − маржа/маржа*) = |ΔL|/L* — относительная ошибка найма (прибыль по L квадратична). Кривая прибыли по найму
     плоская, поэтому шкала вдвое строже, чем на уровнях 1–3: ошибка 25% в найме стоит 50% дня. */
  const days = exam.results.map((r) => Math.max(0, 1 - 2 * Math.sqrt(Math.max(0, 1 - Math.min(1, r.playerMargin / r.botMargin)))));
  const eff = days.reduce((x, y) => x + y, 0) / days.length, minDay = Math.min(...days);
  return { eff, minDay, days, medal: lavkaExamMedal(eff, minDay) };
}
/* π̄_эт — матожидание дневной прибыли эталона (маржа найма − аренда цеха − аренда котла), без удачи сида. */
function factoryExamExpectedProfit() {
  let sum = 0, n = 0;
  for (let s = 1; s <= 200; s++) for (const d of factoryExamNew(null, 7919 * s).days) {
    sum += factoryLaborMargin(factoryBestL(d), d) - FACTORY.shopRent - FACTORY.boiler.rent; n++;
  }
  return sum / n;
}
function factoryExamFinish(f, exam) {
  const res = factoryExamResult(exam), prev = f.examBest || { eff: -Infinity, medal: null, attempts: 0 };
  const better = !!res && res.eff > prev.eff;
  return { ...f, examActive: null, examBest: { eff: better ? res.eff : prev.eff, medal: better ? (res.medal ? res.medal.id : null) : prev.medal,
    piBot: factoryExamExpectedProfit(), day: better ? f.day : prev.day, attempts: (prev.attempts || 0) + 1 } };
}

/* Завершить уровень 3 (нужна медаль экзамена сети): продать сеть или оставить дочкой; дочки копятся. */
function levelFinish3(st, choice) {
  const t = capitalTransition(3, st.chain && st.chain.examBest, choice, "Сеть кофеен");
  if (!t) return null;
  const factory = factoryNewState(t.cash);
  factory.subsidiaries = [...(st.chain.subsidiaries || []).filter((s) => s.daysLeft > 0), ...(t.subsidiary ? [t.subsidiary] : [])];
  return { ...st, level: 4, factory, level3: { medal: t.medal, choice, sale: t.sale, D: t.D, closedDay: st.chain.day } };
}

export {
  FACTORY, FACTORY_GOALS, FACTORY_CHAPTERS, FACTORY_EXAM_KINDS,
  factoryQ, factoryMP, factoryPrice, factorySupplyW, factoryFloor, factoryWage, factoryWageBill, factoryLaborMargin, factoryBestL,
  factoryCompetitive, factoryStep, factoryBoilerMath, factoryBoilerValue, factoryNewState, factoryBuyBoiler, factoryAnswer,
  factorySimulate, factoryVerdict, factoryExamOpen, factoryExamNew, factoryExamMargin, factoryExamBest, factoryExamPlayDay,
  factoryExamResult, factoryExamExpectedProfit, factoryExamFinish, levelFinish3, lavkaRng, lavkaExamMedal,
};
