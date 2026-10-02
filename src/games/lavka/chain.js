/* «Сеть кофеен» — уровень 3 «Пути компании» (чистая логика, без React).
   Сценарий: docs/scenario/06_УРОВЕНЬ_3_КОФЕЙНИ.md, ПАРАМЕТРЫ.md; ревью: docs/reviews/2026-10-02-scenario.md.

   Две кофейни — два рынка с местами (мощность → теневая цена места λ), две кухни с растущими MC, Зоя продаёт выпечку
   по фиксированной цене в любом количестве («сделать или купить»), Гена даёт скидку на ВСЕ свои порции от порога.
   Новый рычаг — РАСПРЕДЕЛЕНИЕ и решения «открыть / закрыть»: цены в кофейнях, выпуск каждой кухни; Зоя довозит
   недостающее. Оптимум сети: MR_N − λ_N = MR_T − λ_T = MC₁ = MC₂ ≤ цена Зои.
   Оптимум считается перебором по целым порциям (без допущений о непрерывности: скидка на весь объём даёт разрыв).

   Неделя 1 «Места»: λ_N = 26 в будни; Д4 — Зоя; Д6 — терраса (K_N 140 → 180).
   Неделя 2 «Сосед»: Д8 — скидки Гены; Д9 — кофейня Семёна напротив (спрос N: A ×0,8, B ×1,1) — прибыль тает;
     Д10 — Эдуард занимает столик (−10 мест); с Д11 — кофейню T можно закрывать на день (бариста — устранимые
     издержки, аренда — нет), кухню 1 — сдать (помесячная аренда 2 000 устранима, а min AC = 50 > 34 — закрыть верно);
     Д13–14 — пост Киры (N: A ×1,1).
   Неделя 3 «Ноль»: Д17 — Зоя поднимает цену до 38 ₽; Д20 — снова Эдуард. */
import { lavkaRng, lavkaExamMedal } from "./model.js";
import { capitalPayDividends, capitalInterest, capitalTransition } from "./capital.js";

const CHAIN = {
  cafes: [
    { id: "N", name: "На Набережной", A: 400, B: 2, cap: 140, rent: 3000, barista: 1500, k: [1, 1, 1, 1, 1.1, 1.3, 1.25] },
    { id: "T", name: "У Техникума", A: 300, B: 2.5, cap: 100, rent: 2000, barista: 1500, k: [1, 1, 1, 1, 1, 0.5, 0.3] },
  ],
  /* MC = c + d·q, VC = c·q + d·q²/2; F — постоянные: у Заводской помесячная аренда (устранима), у «Ковчега» договор на год. */
  kitchens: [
    { name: "Заводская", c: 30, d: 0.1, cap: 200, F: 2000, avoidable: true },
    { name: "«Ковчег»", c: 10, d: 0.15, cap: 220, F: 3000, avoidable: false },
  ],
  zoya: 34, zoyaFromDay: 4, zoyaRiseDay: 17, zoyaRise: 38,
  tiers: [[350, 3], [250, 2]], tiersFromDay: 8,
  terrace: { cost: 20000, plus: 40, fromDay: 6 },
  semyonDay: 9, semyonA: 0.8, semyonB: 1.1,
  eduardDays: [10, 20], eduardSeats: 10, kiraDays: [13, 14], kiraA: 1.1,
  togglesFromDay: 11, noise: 0.04, oracleDays: 7, examFromDay: 22, levelDays: 21,
};

const chainWeekday = (day) => (day - 1) % 7;
const chainVC = (kit, q) => kit.c * q + (kit.d * q * q) / 2;
const chainMC = (kit, q) => kit.c + kit.d * q;
const chainZoya = (day) => (day < CHAIN.zoyaFromDay ? null : day >= CHAIN.zoyaRiseDay ? CHAIN.zoyaRise : CHAIN.zoya);
const chainTier = (own, day) => (day < CHAIN.tiersFromDay ? 0 : (CHAIN.tiers.find(([q]) => own >= q) || [0, 0])[1]);

/* Условия дня: спрос и места каждой кофейни, цена Зои, скидки. ov — переопределения для экзамена. */
function chainDay(st, day = st.day, ov = {}) {
  const wd = chainWeekday(day);
  const cafes = CHAIN.cafes.map((c, i) => {
    let A = c.A, B = c.B, cap = c.cap;
    if (i === 0) {
      if (st.terrace) cap += CHAIN.terrace.plus;
      if (day >= CHAIN.semyonDay) { A *= CHAIN.semyonA; B *= CHAIN.semyonB; }
      if (CHAIN.kiraDays.includes(day)) A *= CHAIN.kiraA;
      if (CHAIN.eduardDays.includes(day) && !(st.eduardAsked && st.eduardAsked === day)) cap -= CHAIN.eduardSeats;
    }
    const k = c.k[wd];
    return { ...c, A, B, cap, k, ...(ov.cafes ? ov.cafes[i] : {}) };
  });
  return { day, cafes, zoya: ov.zoya !== undefined ? ov.zoya : chainZoya(day), tiersOn: day >= CHAIN.tiersFromDay,
    k1Open: ov.k1Open !== undefined ? ov.k1Open : !st.k1Closed, tOpen: ov.tOpen !== undefined ? ov.tOpen : st.tOpen !== false };
}

/* Цена, при которой кофейня продаёт Q порций: Q = k·(A − B·P) ⇒ P = (A − Q/k)/B. */
const chainPriceFor = (cafe, Q) => Math.max(0, (cafe.A - Q / cafe.k) / cafe.B);
const chainDemand = (cafe, P) => Math.max(0, cafe.k * (cafe.A - cafe.B * P));

/* Таблица издержек своей выпечки: own[o] = min VC₁ + VC₂ − скидка·o при q₁ + q₂ = o (кухня 1 — если работает). */
function chainOwnCost(dd) {
  const [k1, k2] = CHAIN.kitchens, cap1 = dd.k1Open ? k1.cap : 0, max = cap1 + k2.cap;
  const cost = new Array(max + 1).fill(Infinity), split = new Array(max + 1).fill(null);
  for (let q1 = 0; q1 <= cap1; q1++) for (let q2 = 0; q2 <= k2.cap; q2++) {
    const o = q1 + q2, c = chainVC(k1, q1) + chainVC(k2, q2);
    if (c < cost[o]) { cost[o] = c; split[o] = [q1, q2]; }
  }
  for (let o = 0; o <= max; o++) cost[o] -= (dd.tiersOn ? chainTier(o, CHAIN.tiersFromDay) : 0) * o;
  return { cost, split, max };
}
/* Издержки Q порций для продажи: своя выпечка o (может быть и больше Q — ради порога скидки, излишек пропадает) + Зоя. */
function chainCostTable(dd, Qmax) {
  const own = chainOwnCost(dd), C = new Array(Qmax + 1).fill(Infinity), how = new Array(Qmax + 1).fill(null);
  for (let Q = 0; Q <= Qmax; Q++) for (let o = 0; o <= own.max; o++) {
    if (o < Q && dd.zoya == null) continue;
    const c = own.cost[o] + (o < Q ? dd.zoya * (Q - o) : 0);
    if (c < C[Q]) { C[Q] = c; how[Q] = { q: own.split[o], z: Math.max(0, Q - o), own: o }; }
  }
  return { C, how };
}
/* Оптимум дня: перебор целых продаж (Q_N, Q_T); маржа = выручка − переменные издержки − бариста открытых кофеен
   − аренда кухни 1, если она работает (устранимые издержки решения). Неустранимые (аренды кофеен, «Ковчег») — вне маржи. */
function chainPlan(dd) {
  const [cN, cT] = dd.cafes;
  const maxN = Math.min(cN.cap, Math.floor(cN.k * cN.A)), maxT = dd.tOpen ? Math.min(cT.cap, Math.floor(cT.k * cT.A)) : 0;
  const { C, how } = chainCostTable(dd, maxN + maxT + 1);
  let best = null;
  for (let qN = 0; qN <= maxN; qN++) for (let qT = 0; qT <= maxT; qT++) {
    if (!Number.isFinite(C[qN + qT])) continue;
    const rev = chainPriceFor(cN, qN) * qN + chainPriceFor(cT, qT) * qT;
    const m = rev - C[qN + qT];
    if (!best || m > best.varMargin) best = { qN, qT, varMargin: m };
  }
  const h = how[best.qN + best.qT];
  const avoid = (dd.tOpen ? cT.barista : 0) + cN.barista + (dd.k1Open ? CHAIN.kitchens[0].F : 0);
  const Q = best.qN + best.qT;
  const mcNext = Number.isFinite(C[Q + 1]) ? C[Q + 1] - C[Q] : null;
  return { ...best, Q, q: h.q, z: h.z, own: h.own, PN: chainPriceFor(cN, best.qN), PT: dd.tOpen ? chainPriceFor(cT, best.qT) : null,
    margin: best.varMargin - avoid, mc: mcNext, lambdaN: chainLambda(cN, best.qN, mcNext), lambdaT: dd.tOpen ? chainLambda(cT, best.qT, mcNext) : 0 };
}
/* Теневая цена места: MR при Q = cap выше предельных издержек выпечки → λ = MR − MC (иначе 0). */
function chainLambda(cafe, Q, mc) {
  if (mc == null || Q < cafe.cap) return 0;
  const mr = (cafe.A - (2 * Q) / cafe.k) / cafe.B;
  return Math.max(0, mr - mc);
}
/* Лучший план с решением «открывать ли T сегодня» и «работает ли кухня 1» (если разрешено решать). */
function chainBestDecision(dd, { decideT = false, decideK1 = false } = {}) {
  let best = null;
  for (const tOpen of decideT ? [true, false] : [dd.tOpen]) for (const k1Open of decideK1 ? [true, false] : [dd.k1Open]) {
    const p = chainPlan({ ...dd, tOpen, k1Open });
    if (!best || p.margin > best.margin + 1e-9) best = { ...p, tOpen, k1Open };
  }
  return best;
}

/* Минимум AC кухни 1: AC = F/q + c + d·q/2, минимум при q = √(2F/d). */
function chainK1MinAC() {
  const k = CHAIN.kitchens[0], q = Math.min(k.cap, Math.sqrt((2 * k.F) / k.d));
  return { q, ac: k.F / q + k.c + (k.d * q) / 2 };
}
/* Вклад кофейни T сегодня: маржа сети с T минус без T (бариста T уже вычтена). */
function chainTContribution(dd) {
  const withT = chainPlan({ ...dd, tOpen: true }), noT = chainPlan({ ...dd, tOpen: false });
  return { withT, noT, contribution: withT.margin - noT.margin, beforeBarista: withT.margin - noT.margin + CHAIN.cafes[1].barista };
}

/* ===== Исход дня при решениях игрока ===== */
/* Цены pN, pT; выпуск кухонь q = [q1, q2]; Зоя довозит недостающее (если есть). aMul — шок спроса. */
function chainOutcome(dd, { pN, pT, q }, aMul = [1, 1]) {
  const [k1, k2] = CHAIN.kitchens;
  const q1 = dd.k1Open ? Math.max(0, Math.min(k1.cap, Math.round(q[0] || 0))) : 0, q2 = Math.max(0, Math.min(k2.cap, Math.round(q[1] || 0)));
  const cafes = dd.cafes.map((c, i) => ({ ...c, A: c.A * aMul[i] }));
  const prices = [pN, dd.tOpen ? pT : null];
  const want = cafes.map((c, i) => (prices[i] == null ? 0 : chainDemand(c, prices[i])));
  const seat = cafes.map((c, i) => Math.min(want[i], prices[i] == null ? 0 : c.cap));
  const need = seat[0] + seat[1], own = q1 + q2;
  const z = dd.zoya == null ? 0 : Math.max(0, Math.ceil(need - own));
  const supply = own + z, ratio = need > 0 ? Math.min(1, supply / need) : 0;
  const sold = seat.map((s) => s * ratio);
  const revenue = sold[0] * pN + (dd.tOpen ? sold[1] * pT : 0);
  const tier = dd.tiersOn ? chainTier(own, dd.day) : 0;
  const ownCost = chainVC(k1, q1) + chainVC(k2, q2) - tier * own;
  const zoyaCost = z * (dd.zoya || 0);
  const avoid = CHAIN.cafes[0].barista + (dd.tOpen ? CHAIN.cafes[1].barista : 0) + (dd.k1Open ? k1.F : 0);
  const sunk = CHAIN.cafes[0].rent + CHAIN.cafes[1].rent + k2.F;
  const margin = revenue - ownCost - zoyaCost - avoid;
  return { q: [q1, q2], own, z, want, seat, sold, revenue, tier, ownCost, zoyaCost, avoid, sunk, margin, profit: margin - sunk,
    waste: Math.max(0, own - need), queue: want.map((w, i) => Math.max(0, w - seat[i])), mc: [chainMC(k1, q1), chainMC(k2, q2)] };
}

/* ===== Улучшения, цели, главы ===== */
const CHAIN_UPGRADES = [
  { id: "terrace", emoji: "☂️", title: "Терраса на Набережной (Корабельников)", cost: CHAIN.terrace.cost, fromDay: CHAIN.terrace.fromDay,
    desc: "+40 мест в кофейне N (140 → 180).",
    lesson: "Ценность мощности = λ × прирост мест: пока N забита (λ_N = 26 в будни), терраса даёт ≈ +1 110 ₽ в день. Но λ — не навсегда: после кофейни Семёна места перестают быть дефицитом (λ_N = 0 в будни), и терраса приносит лишь ≈ +135 ₽. Инвестицию оценивают по будущим λ, а не по сегодняшней очереди." },
];
const CHAIN_GOALS = [
  { id: "seats", emoji: "🪑", title: "Цена места", desc: "Когда N забита, цена в N в пределах 3 ₽ от оптимума с учётом мест (MR_N = MC + λ_N).", reward: 4000 },
  { id: "multiplant", emoji: "⚖️", title: "MC₁ = MC₂", desc: "Обе кухни пекут, их MC различаются не больше чем на 2 ₽, и ни одна не печёт дороже Зои.", reward: 5000 },
  { id: "makebuy", emoji: "🥐", title: "Сделать или купить", desc: "Своя выпечка — пока MC ≤ цены Зои, остальное — у Зои (±2 ₽).", reward: 4000 },
  { id: "sunk", emoji: "🧾", title: "Невозвратные издержки", desc: "На 12-й день оставь кофейню T открытой: её вклад больше устранимых издержек (бариста), а аренда и ремонт не исчезнут при закрытии.", reward: 5000 },
  { id: "kitchen1", emoji: "🏭", title: "Долгий период", desc: "Сдай Заводскую кухню: её min AC = 50 ₽ выше цены Зои, а аренду можно прекратить.", reward: 5000 },
  { id: "zoya38", emoji: "📈", title: "Новая граница", desc: "После подорожания у Зои (38 ₽) своя выпечка до MC = 38 (±2 ₽).", reward: 5000 },
];
const CHAIN_CHAPTERS = [
  { n: 1, title: "Места", fromDay: 1, goal: "multiplant" },
  { n: 2, title: "Сосед", fromDay: 8, goal: "sunk" },
  { n: 3, title: "Ноль", fromDay: 15, goal: "zoya38" },
];

function chainNewState(cash = 30000) {
  return { v: 2, level: 3, day: 1, chapter: 1, cash: Math.round(cash), pN: 125, pT: 80, q: [60, 140], tOpen: true, k1Closed: false,
    terrace: false, goals: {}, obs: [], history: [], subsidiaries: [], flags: {}, last: null };
}
function chainBuy(st, id) {
  const u = CHAIN_UPGRADES.find((x) => x.id === id);
  if (!u || st[id] || st.cash < u.cost || st.day < u.fromDay) return st;
  return { ...st, cash: st.cash - u.cost, [id]: true };
}
/* Кофейня T на сегодня: открыть / закрыть (с 11-го дня). */
function chainSetT(st, open) { return st.day < CHAIN.togglesFromDay ? st : { ...st, tOpen: !!open }; }
/* Сдать Заводскую кухню (с 11-го дня, навсегда: помесячная аренда прекращается). */
function chainCloseK1(st) { return st.day < CHAIN.togglesFromDay || st.k1Closed ? st : { ...st, k1Closed: true, q: [0, st.q[1]] }; }

/* Оценка спроса кофейни игроком: МНК по дням без упора в места, нормировано на k: Q/k = Â − B̂·P. */
function chainFit(obs, i) {
  const pts = (obs || []).filter((o) => o.open[i] && !o.full[i] && o.P[i] != null).slice(-20);
  if (pts.length < 3) return null;
  const xs = pts.map((o) => o.P[i]), ys = pts.map((o) => o.Q[i] / o.k[i]);
  const n = pts.length, mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0;
  for (let j = 0; j < n; j++) { sxy += (xs[j] - mx) * (ys[j] - my); sxx += (xs[j] - mx) ** 2; }
  if (sxx < 1e-6 || sxy >= 0) return null;
  const B = -sxy / sxx;
  return { A: my + B * mx, B, n };
}

function chainSimulate(st, rng = Math.random) {
  const dd = chainDay(st);
  const aMul = [1 + CHAIN.noise * (2 * rng() - 1), 1 + CHAIN.noise * (2 * rng() - 1)];
  const out = chainOutcome(dd, { pN: st.pN, pT: st.pT, q: st.q }, aMul);
  const plan = chainPlan(dd); // оптимум при тех же открытых точках — для вердикта и целей
  const pay = capitalPayDividends(st.subsidiaries), interest = capitalInterest(st.cash);

  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  const zp = dd.zoya, [m1, m2] = out.mc, works = [out.q[0] > 0, out.q[1] > 0];
  if (plan.lambdaN > 0.5 && Math.abs(st.pN - plan.PN) <= 3) hit("seats");
  const notAboveZoya = zp == null || ((!works[0] || m1 <= zp + 2) && (!works[1] || m2 <= zp + 2));
  if (works[0] && works[1] && Math.abs(m1 - m2) <= 2 && notAboveZoya) hit("multiplant");
  /* Каждая работающая кухня печёт до MC ≈ цене Зои (кухня в упоре мощности может остановиться ниже), остальное — у Зои. */
  const atZoya = (i) => !works[i] || Math.abs(out.mc[i] - zp) <= 2 || (out.q[i] >= CHAIN.kitchens[i].cap && out.mc[i] < zp);
  if (zp != null && out.z > 0 && atZoya(0) && atZoya(1)) hit("makebuy");
  if (st.day === 12 && dd.tOpen && chainTContribution(dd).contribution > 0) hit("sunk");
  if (st.k1Closed) hit("kitchen1");
  if (st.day >= CHAIN.zoyaRiseDay && out.z > 0 && Math.abs(m2 - CHAIN.zoyaRise) <= 2 && (!works[0] || Math.abs(m1 - CHAIN.zoyaRise) <= 2)) hit("zoya38");
  let reward = 0;
  for (const id of newGoals) reward += CHAIN_GOALS.find((g) => g.id === id)?.reward || 0;

  let chapter = st.chapter, newChapter = null;
  const up = CHAIN_CHAPTERS[chapter];
  if (up && st.day + 1 >= up.fromDay) { chapter += 1; newChapter = chapter; }

  const report = {
    day: st.day, dd, pN: st.pN, pT: dd.tOpen ? st.pT : null, ...out, plan, aMul, dividend: pay.dividend, interest, reward, newGoals, newChapter,
    chapter: st.chapter, zoya: zp, mode: st.day <= CHAIN.oracleDays ? "oracle" : "estimate",
  };
  const obs = { day: st.day, P: [st.pN, dd.tOpen ? st.pT : null], Q: out.sold, k: dd.cafes.map((c) => c.k),
    open: [true, dd.tOpen], full: out.seat.map((s, i) => s >= dd.cafes[i].cap - 1e-9), semyon: st.day >= CHAIN.semyonDay };
  const next = {
    ...st, day: st.day + 1, chapter, tOpen: st.day + 1 < CHAIN.togglesFromDay ? true : st.tOpen,
    cash: Math.round(st.cash + out.profit + pay.dividend + interest + reward), goals, subsidiaries: pay.subsidiaries,
    obs: [...(st.obs || []), obs].slice(-30), history: [...(st.history || []), { day: st.day, profit: Math.round(out.profit) }].slice(-60),
    last: report, at: Date.now(),
  };
  return { next, report };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");
/* Вердикт дня. Первая неделя — по истинному спросу (Вера с калькулятором); потом цены оцениваются по МНК игрока,
   а кухни и Зоя — по известным издержкам. */
function chainVerdict(r, obs) {
  const parts = [], dd = r.dd, [cN, cT] = dd.cafes, oracle = r.mode === "oracle";
  const [k1, k2] = CHAIN.kitchens, zp = r.zoya;
  /* Цены. */
  if (oracle) {
    if (r.queue[0] > 1 && r.pN < r.plan.PN - 3) parts.push(`Мест ${cN.cap}, а хотели сесть ${Math.round(r.want[0])}: очередь — значит, продешевил(а). Оптимум N ≈ ${fmt(r.plan.PN)} ₽ (λ_N ≈ ${fmt(r.plan.lambdaN)} ₽ за место).`);
    else if (r.pN > r.plan.PN + 3) parts.push(`В N пустые столики: цена ${r.pN} ₽ выше оптимума ≈ ${fmt(r.plan.PN)}. Пустой столик ничего не зарабатывает.`);
    else parts.push(`Цена N близка к оптимуму ${fmt(r.plan.PN)} ₽${r.plan.lambdaN > 0.5 ? ` — места заняты, λ_N ≈ ${fmt(r.plan.lambdaN)} ₽` : ""}.`);
    if (dd.tOpen && r.plan.PT != null && Math.abs(r.pT - r.plan.PT) > 3) parts.push(`Цена T ${r.pT} ₽, оптимум ≈ ${fmt(r.plan.PT)}.`);
  } else {
    const fN = chainFit(obs, 0);
    if (r.queue[0] > 1) parts.push(`В N не хватило мест (${cN.cap}): часть гостей ушла — если это повторяется, цена ниже той, что расчищает места.`);
    else if (fN) {
      const mrN = (fN.A - (2 * r.sold[0]) / cN.k) / fN.B;
      parts.push(`По твоей оценке спроса N (${fN.n} дн. без упора в места): MR_N ≈ ${fmt(mrN)} ₽ при MC ≈ ${fmt(r.plan.mc || 0)}.`);
    } else parts.push("Оценки спроса пока мало: нужны дни без упора в места и с разными ценами.");
  }
  /* Кухни и Зоя (издержки известны всегда). */
  const works = [r.q[0] > 0, r.q[1] > 0];
  if (works[0] && works[1] && Math.abs(r.mc[0] - r.mc[1]) > 2) {
    const hi = r.mc[0] > r.mc[1] ? 0 : 1;
    parts.push(`Одна кухня печёт дорого (MC ${CHAIN.kitchens[hi].name} = ${fmt(r.mc[hi])}), другая дёшево (${fmt(r.mc[1 - hi])}). Переложи — тот же выпуск обойдётся дешевле.`);
  }
  if (zp != null) {
    const over = works.map((w, i) => w && r.mc[i] > zp + 2);
    if (over.some(Boolean)) parts.push(`Зоя печёт за ${zp}. Зачем ты печёшь за ${fmt(Math.max(...r.mc.filter((_, i) => over[i])))}? (если только не ради порога скидки Гены)`);
    else if (r.z > 0 && works.some((w, i) => !w || r.mc[i] < zp - 2) && !(r.q[1] >= k2.cap)) parts.push(`Кухня могла печь дешевле ${zp} ₽, а ты купил(а) у Зои ${Math.round(r.z)}. Своя выпечка выгодна до MC = ${zp}.`);
  }
  if (r.tier > 0) parts.push(`Скидка Гены ${r.tier} ₽ на все ${r.own} своих порций: −${fmt(r.tier * r.own)} ₽.`);
  if (r.waste > 0.5) parts.push(`${Math.round(r.waste)} порций пропали непроданными.`);
  /* Решения долгого периода. */
  if (r.day >= CHAIN.togglesFromDay && !dd.k1Open) parts.push("Заводская сдана: её аренда больше не платится.");
  else if (r.day >= CHAIN.togglesFromDay) {
    const m = chainK1MinAC();
    parts.push(`Заводская: min AC = ${fmt(m.ac)} ₽ при ${fmt(m.q)} порциях${zp != null ? ` — ${m.ac > zp ? "дороже" : "дешевле"} Зои (${zp})` : ""}; аренда 2 000 устранима.`);
  }
  if (r.day >= CHAIN.togglesFromDay) {
    const t = chainTContribution({ ...dd, tOpen: true });
    parts.push(`Вклад T сегодня ≈ ${fmt(t.beforeBarista)} ₽ сверх выпечки против бариста ${CHAIN.cafes[1].barista}: ${t.contribution > 0 ? "открывать выгодно" : "сегодня не открывать"}. Аренда T и ремонт не исчезнут при закрытии.`);
  }
  return parts.join(" ");
}

/* ===== Экзамен уровня 3 =====
   3 дня на копии сети (касса не меняется), числа случайны по сиду. Кухня 1 в экзамене — решение дня («арендовать
   сегодня или нет»): так экзамен проверяет и min AC против Зои. Оценка дня — 1 − √(1 − маржа/маржа*), маржа — после
   устранимых издержек (бариста открытых кофеен, аренда кухни 1, если работает), неустранимые не входят. */
const CHAIN_EXAM_KINDS = [
  { kind: "monday", title: "Обычный понедельник, Семён напротив" },
  { kind: "festival", title: "Фестиваль на Набережной" },
  { kind: "practice", title: "Студенты на практике" },
];
const chainExamOpen = (c) => (c.chapter || 1) >= 3 && c.day >= CHAIN.examFromDay;
function chainExamNew(c, seed) {
  const rng = lavkaRng(seed), pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)), u = (lo, hi) => lo + rng() * (hi - lo);
  const base = { terrace: !!c.terrace };
  const days = CHAIN_EXAM_KINDS.map((k) => {
    const zoya = pick(32, 38);
    let nA = CHAIN.cafes[0].A * CHAIN.semyonA * u(0.92, 1.08), nk = 1, tA = CHAIN.cafes[1].A, text;
    if (k.kind === "monday") text = `Семён напротив. Зоя продаёт по ${zoya} ₽. Цены, выпуск кухонь — и арендовать ли Заводскую сегодня?`;
    if (k.kind === "festival") { nk = Math.round(u(1.2, 1.45) * 100) / 100; text = `Фестиваль: на Набережной гостей ×${String(nk).replace(".", ",")}. Зоя — ${zoya} ₽. Цены и выпуск?`; }
    if (k.kind === "practice") { tA = Math.round(CHAIN.cafes[1].A * u(0.3, 0.75)); text = `Студенты на практике: спрос T — Q = ${tA} − 2,5·P. Зоя — ${zoya} ₽. Открывать ли T сегодня?`; }
    return { kind: k.kind, title: k.title, text, zoya, nA: Math.round(nA), nk, tA, seed: Math.floor(rng() * 2 ** 31), ...base };
  });
  return { seed, results: [], days };
}
function chainExamDD(d, { tOpen = true, k1Open = true } = {}) {
  const cN = { ...CHAIN.cafes[0], A: d.nA, B: CHAIN.cafes[0].B * CHAIN.semyonB, cap: CHAIN.cafes[0].cap + (d.terrace ? CHAIN.terrace.plus : 0), k: d.nk };
  const cT = { ...CHAIN.cafes[1], A: d.tA, k: 1 };
  return { day: 22, cafes: [cN, cT], zoya: d.zoya, tiersOn: true, k1Open, tOpen };
}
function chainExamBest(d) {
  const b = chainBestDecision(chainExamDD(d), { decideT: true, decideK1: true });
  return { pN: Math.round(b.PN * 10) / 10, pT: b.tOpen ? Math.round(b.PT * 10) / 10 : null, q: b.q, tOpen: b.tOpen, k1Open: b.k1Open, margin: b.margin };
}
function chainExamPlayDay(c, exam, ans) {
  const i = exam.results.length, d = exam.days[i];
  const rng = lavkaRng(d.seed), aMul = [1 + CHAIN.noise * (2 * rng() - 1), 1 + CHAIN.noise * (2 * rng() - 1)];
  const a = { tOpen: ans.tOpen !== false, k1Open: ans.k1Open !== false };
  const me = chainOutcome(chainExamDD(d, a), { pN: ans.pN, pT: ans.pT, q: ans.q }, aMul);
  const best = chainExamBest(d), bot = chainOutcome(chainExamDD(d, best), best, aMul);
  const res = { ans: { ...ans, ...a }, best, playerMargin: me.margin, botMargin: bot.margin, botProfit: bot.profit };
  return { exam: { ...exam, results: [...exam.results, res] }, result: res, done: i + 1 === exam.days.length };
}
function chainExamResult(exam) {
  if (!exam.results.length || exam.results.some((r) => !(r.botMargin > 0))) return null;
  const days = exam.results.map((r) => Math.max(0, 1 - Math.sqrt(Math.max(0, 1 - Math.min(1, r.playerMargin / r.botMargin)))));
  const eff = days.reduce((s, x) => s + x, 0) / days.length, minDay = Math.min(...days);
  const piBot = exam.results.reduce((s, r) => s + r.botProfit, 0) / exam.results.length;
  return { eff, minDay, days, piBot, medal: lavkaExamMedal(eff, minDay) };
}
function chainExamFinish(c, exam) {
  const res = chainExamResult(exam), prev = c.examBest || { eff: -Infinity, medal: null, attempts: 0 };
  const better = !!res && res.eff > prev.eff;
  return { ...c, examActive: null, examBest: { eff: better ? res.eff : prev.eff, medal: better ? (res.medal ? res.medal.id : null) : prev.medal,
    piBot: better ? res.piBot : prev.piBot, day: better ? c.day : prev.day, attempts: (prev.attempts || 0) + 1 } };
}

/* Завершить уровень 2 (нужна медаль экзамена ярмарки): продать квасную точку или оставить дочкой; дочки копятся. */
function levelFinish2(st, choice) {
  const t = capitalTransition(2, st.fair && st.fair.examBest, choice, "Квас у вокзала");
  if (!t) return null;
  const chain = chainNewState(t.cash);
  chain.subsidiaries = [...(st.fair.subsidiaries || []).filter((s) => s.daysLeft > 0), ...(t.subsidiary ? [t.subsidiary] : [])];
  return { ...st, level: 3, chain, level2: { medal: t.medal, choice, sale: t.sale, D: t.D, closedDay: st.fair.day } };
}

export {
  CHAIN, CHAIN_UPGRADES, CHAIN_GOALS, CHAIN_CHAPTERS, CHAIN_EXAM_KINDS,
  chainVC, chainMC, chainZoya, chainTier, chainDay, chainPriceFor, chainDemand, chainOwnCost, chainCostTable, chainPlan, chainLambda,
  chainBestDecision, chainK1MinAC, chainTContribution, chainOutcome, chainNewState, chainBuy, chainSetT, chainCloseK1, chainFit,
  chainSimulate, chainVerdict, chainExamOpen, chainExamNew, chainExamDD, chainExamBest, chainExamPlayDay, chainExamResult, chainExamFinish,
  levelFinish2, lavkaRng, lavkaExamMedal,
};
