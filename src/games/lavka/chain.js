/* «Сеть кофеен» — уровень 3 «Пути компании» (чистая логика, без React).
   Новый рычаг — РАСПРЕДЕЛЕНИЕ выпуска между двумя кухнями. Сеть — монополист на районном рынке кофе:
   P = A − B·Q, Q = q₁ + q₂. Издержки кухни i: VC = (w + baseᵢ)·q + bᵢ·q², MC = w + baseᵢ + 2bᵢ·q, AVC = w + baseᵢ + bᵢ·q;
   w — цена зёрен на чашку, аренда кухни Fᵢ — постоянные издержки, мощность capᵢ.
   Оптимум многозаводской монополии: MR(Q) = MC₁(q₁) = MC₂(q₂) (кухня без выпуска, если её MC при нуле выше MR;
   кухня в упоре — MR = MCᵢ + λᵢ).
   Главы (по дням):
     1. Две кухни — равенство предельных издержек.
     2. Спад (A = 200) — аренда по договору: после уведомления о закрытии она платится ещё noticeDays дней (невозвратна) —
        в эти дни работай, пока вклад кухни (прирост TR − VC) > 0 (короткий период); закрой, если вклад меньше аренды
        (длинный период). Закрыть кухню ≠ закрыть фирму: правило «P < min AVC» из совершенной конкуренции здесь
        заменяет сравнение вклада кухни с нулём (короткий) и с её арендой (длинный).
     3. Опт и мощность (A = 300) — скидка на ВСЕ зёрна (w 20 → 14) при Q ≥ 120: прибыль сравнивают целиком,
        а не только MR и MC на краю; мощность Садовой 50 чашек. */
import { lavkaRng, lavkaExamMedal } from "./model.js";
import { fairFit } from "./fair.js";

const CHAIN = {
  B: 1, noise: 0.05, w: 20, wDiscount: 14, discountQ: 120,
  kitchens: [
    { name: "Кухня на Садовой", base: 20, b: 0.5, F: 3500, cap: 50 },
    { name: "Кухня на Заводской", base: 40, b: 0.25, F: 3000, cap: 120 },
  ],
  reopenCost: 3000, noticeDays: 3, rate: 0.005, dividendDays: 60, grant: 10000, oracleDays: 7,
};
/* Дивиденд ярмарки по медали экзамена уровня 2 (₽/день). */
const LEVEL2_DIVIDEND = { gold: 3000, silver: 2200, bronze: 1400 };
const chainSalePrice2 = (medal) => {
  const D = LEVEL2_DIVIDEND[medal] || 0, r = CHAIN.rate, N = CHAIN.dividendDays;
  return (D * (1 - (1 + r) ** -N)) / r;
};

const chainMC = (k, q, w) => w + k.base + 2 * k.b * q;
const chainVC = (k, q, w) => (w + k.base) * q + k.b * q * q;
const chainA = (st) => ((st.chapter || 1) === 2 ? 200 : 300);

/* Распределить общий выпуск Q между кухнями по равенству MC (с учётом мощностей и закрытых кухонь). */
function chainAllocate(Q, w, open, caps) {
  const ks = CHAIN.kitchens;
  const qAt = (m) => ks.map((k, i) => (open[i] ? Math.min(caps[i], Math.max(0, (m - w - k.base) / (2 * k.b))) : 0));
  const total = (m) => qAt(m).reduce((a, b) => a + b, 0);
  const capTotal = ks.reduce((s, k, i) => s + (open[i] ? caps[i] : 0), 0);
  if (Q >= capTotal) return ks.map((k, i) => (open[i] ? caps[i] : 0));
  let lo = 0, hi = 2000;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (total(mid) < Q) lo = mid; else hi = mid; }
  return qAt(hi);
}

/* Переменная прибыль при выпуске Q (TR − VC), цена зёрен — по факту объёма. */
function chainProfitVar(Q, { A, w, open, caps, discount }) {
  const wQ = discount && Q >= CHAIN.discountQ - 1e-9 ? CHAIN.wDiscount : w;
  const q = chainAllocate(Q, wQ, open, caps);
  const vc = CHAIN.kitchens.reduce((s, k, i) => s + chainVC(k, q[i], wQ), 0);
  return { profitVar: (A - CHAIN.B * Q) * Q - vc, q, w: wQ };
}

/* Оптимум при фиксированной цене зёрен w и выпуске в [Qmin, Qmax]: MR(Q) = общий MC m (бисекция по m),
   затем ограничение по Q. Кухни с MC(0) > m не работают, в упоре мощности — свой λ. */
function chainSolve({ A, open, caps }, w, Qmin, Qmax) {
  const ks = CHAIN.kitchens;
  const Qat = (m) => ks.reduce((s, k, i) => s + (open[i] ? Math.min(caps[i], Math.max(0, (m - w - k.base) / (2 * k.b))) : 0), 0);
  let lo = 0, hi = A;
  for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2; if (A - 2 * CHAIN.B * Qat(m) > m) lo = m; else hi = m; }
  return Math.max(Qmin, Math.min(Qmax, Qat(hi)));
}
/* Оптимальный план. Со скидкой сравниваются два режима: «до порога» (w = 20, Q < порога) и «от порога»
   (w = 14, Q ≥ порога) — прибыль на изломе сравнивают целиком. */
function chainPlan(opts) {
  const capTotal = CHAIN.kitchens.reduce((s, k, i) => s + (opts.open[i] ? opts.caps[i] : 0), 0);
  const cands = [];
  if (!opts.discount || capTotal < CHAIN.discountQ) cands.push(chainSolve(opts, opts.w, 0, capTotal));
  else {
    cands.push(chainSolve(opts, opts.w, 0, CHAIN.discountQ - 1e-6));
    cands.push(chainSolve(opts, CHAIN.wDiscount, CHAIN.discountQ, capTotal));
  }
  let best = null;
  for (const Q of cands) { const r = { Q, ...chainProfitVar(Q, opts) }; if (!best || r.profitVar > best.profitVar) best = r; }
  return { ...best, P: opts.A - CHAIN.B * best.Q };
}

/* Короткий и длинный период при спросе A: вклад кухни 2 сверх переменных издержек против её аренды. */
function chainShutdownMath(A) {
  const caps = CHAIN.kitchens.map((k) => k.cap), base = { A, w: CHAIN.w, caps, discount: false };
  const both = chainPlan({ ...base, open: [true, true] }), only = chainPlan({ ...base, open: [true, false] });
  const [k1, k2] = CHAIN.kitchens;
  return { both, only, contribution2: both.profitVar - only.profitVar,
    profitBoth: both.profitVar - k1.F - k2.F, profitOnlyK1: only.profitVar - k1.F };
}

const CHAIN_GOALS = [
  { id: "twokitchens", emoji: "⚖️", title: "Две кухни", desc: "MR ≈ MC₁ ≈ MC₂ (±3) — выпуск поделён правильно.", reward: 3000 },
  { id: "exit", emoji: "🚪", title: "Длинный период", desc: "В спад закрой кухню, чей вклад не покрывает аренду.", reward: 3000 },
  { id: "discount", emoji: "📦", title: "Опт", desc: "Добери выпуск до порога скидки, когда это выгоднее, чем MR = MC без скидки.", reward: 3000 },
];
const CHAIN_CHAPTERS = [
  { n: 1, title: "Две кухни", fromDay: 1, goal: "twokitchens" },
  { n: 2, title: "Спад", fromDay: 8, goal: "exit" },
  { n: 3, title: "Опт и мощность", fromDay: 15, goal: "discount" },
];

function chainNewState(cash = CHAIN.grant) {
  return { v: 1, level: 3, day: 1, chapter: 1, cash: Math.round(cash), q: [40, 50], open: [true, true], closeIn: [0, 0],
    goals: {}, obs: [], history: [], subsidiaries: [], last: null };
}

/* Закрыть кухню — уведомить арендодателя: аренда платится ещё noticeDays дней (кухня в эти дни может работать).
   Отменить уведомление — бесплатно; открыть закрытую кухню снова — за reopenCost. */
function chainSetOpen(st, i, open) {
  const closeIn = [...(st.closeIn || [0, 0])], o = [...st.open];
  if (!open) {
    if (!o[i] || closeIn[i] > 0) return st;
    closeIn[i] = CHAIN.noticeDays;
    return { ...st, closeIn };
  }
  if (closeIn[i] > 0) { closeIn[i] = 0; return { ...st, closeIn }; }
  if (o[i] || st.cash < CHAIN.reopenCost) return st;
  o[i] = true;
  return { ...st, open: o, closeIn, cash: st.cash - CHAIN.reopenCost };
}

const chainOpts = (st, A) => ({ A, w: CHAIN.w, open: st.open, caps: CHAIN.kitchens.map((k) => k.cap), discount: (st.chapter || 1) >= 3 });

function chainSimulate(st, rng = Math.random) {
  const ks = CHAIN.kitchens, Amean = chainA(st);
  const q = ks.map((k, i) => (st.open[i] ? Math.max(0, Math.min(k.cap, Math.round(st.q[i] || 0))) : 0));
  const Q = q[0] + q[1];
  const w = (st.chapter || 1) >= 3 && Q >= CHAIN.discountQ ? CHAIN.wDiscount : CHAIN.w;
  const Areal = Amean * (1 + CHAIN.noise * (2 * rng() - 1));
  const P = Math.max(0, Areal - CHAIN.B * Q);
  const vc = ks.reduce((s, k, i) => s + chainVC(k, q[i], w), 0);
  const fixed = ks.reduce((s, k, i) => s + (st.open[i] ? k.F : 0), 0);
  const profit = P * Q - vc - fixed;
  const interest = Math.max(0, st.cash) * CHAIN.rate;
  let dividend = 0;
  const subsidiaries = (st.subsidiaries || []).map((s) => { if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; } return s; });

  const mr = Amean - 2 * CHAIN.B * Q, mc = ks.map((k, i) => chainMC(k, q[i], w));
  const plan = chainPlan(chainOpts(st, Amean));
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  if (st.chapter === 1 && st.open.every(Boolean) && q.every((x, i) => x > 0 && Math.abs(mr - mc[i]) <= 3)) hit("twokitchens");
  /* Решение длинного периода (уведомил или закрыл) + правильный выпуск сегодня. */
  if (st.chapter === 2 && (!st.open[1] || (st.closeIn || [])[1] > 0) && Math.abs(Q - plan.Q) <= 3) hit("exit");
  if (st.chapter === 3 && Q >= CHAIN.discountQ && Math.abs(Q - plan.Q) <= 3) hit("discount");
  let reward = 0;
  for (const id of newGoals) reward += CHAIN_GOALS.find((g) => g.id === id)?.reward || 0;

  let chapter = st.chapter, newChapter = null;
  const up = CHAIN_CHAPTERS[chapter];
  if (up && st.day + 1 >= up.fromDay) { chapter += 1; newChapter = chapter; }

  /* Уведомления о закрытии: день прошёл — срок аренды короче; дошёл до нуля — кухня закрыта. */
  const closeIn = [...(st.closeIn || [0, 0])], openNext = [...st.open];
  closeIn.forEach((d, i) => { if (d > 0) { closeIn[i] = d - 1; if (closeIn[i] === 0) openNext[i] = false; } });

  const report = { day: st.day, q, Q, A: Areal, Amean, P, w, vc, fixed, profit, interest, dividend, reward, newGoals, newChapter,
    mr, mc, plan, open: [...st.open], closeIn: [...(st.closeIn || [0, 0])], chapter: st.chapter, mode: st.day <= CHAIN.oracleDays ? "oracle" : "estimate" };
  /* Спрос меняется от главы к главе — оцениваем только по наблюдениям текущей главы. */
  const fit = fairFit((st.obs || []).filter((o) => (o.chapter || 1) === (st.chapter || 1)));
  if (report.mode === "estimate" && fit) { report.fit = fit; report.mrEst = fit.A - 2 * fit.B * Q; }
  const next = { ...st, day: st.day + 1, chapter, open: openNext, closeIn, cash: Math.round(st.cash + profit + interest + dividend + reward), goals, subsidiaries,
    obs: [...(st.obs || []), { day: st.day, Q, P, chapter: st.chapter }].slice(-30), history: [...(st.history || []), { day: st.day, profit: Math.round(profit) }].slice(-60),
    last: report, at: Date.now() };
  return { next, report };
}

const fmt = (x, d = 0) => x.toFixed(d).replace(".", ",");
/* Вердикт: MR против MC каждой кухни (кухня в упоре — λ), порог скидки, короткий и длинный период в спад. */
function chainVerdict(r) {
  const ks = CHAIN.kitchens, oracle = r.mode === "oracle";
  const mr = oracle ? r.mr : r.mrEst, parts = [];
  const short = (k) => k.name.replace("Кухня на ", "");
  const works = r.open.map((o, i) => o && r.q[i] > 0), capped = ks.map((k, i) => works[i] && r.q[i] >= k.cap);
  const onThreshold = r.chapter >= 3 && r.Q >= CHAIN.discountQ && Math.abs(r.Q - r.plan.Q) <= 3;
  if (mr == null) parts.push(`Цена ${fmt(r.P)} ₽ при ${r.Q} чашках. Чтобы оценить MR, нужно хотя бы 3 дня этой главы с разным выпуском.`);
  else {
    const pre = oracle ? "" : "по твоей оценке спроса ";
    parts.push(`${pre}MR = ${fmt(mr)} ₽; ` + ks.map((k, i) => (!r.open[i] ? `${short(k)} закрыта` : `MC ${short(k)} = ${fmt(r.mc[i])}`)).join(", ") + ".");
    /* λ места на кухне в упоре: если другая кухня не загружена — экономия от переноса туда чашки (MC другой − MC этой),
       иначе — MR − MC (на изломе скидки MR не равен MC, поэтому общая мерка — MC свободной кухни). */
    ks.forEach((k, i) => {
      if (!capped[i]) return;
      const j = 1 - i, freeOther = works[j] && !capped[j];
      const lam = freeOther ? r.mc[j] - r.mc[i] : mr - r.mc[i];
      if (lam > 0.5) parts.push(`${short(k)} в упоре мощности: λ ≈ ${fmt(lam)} ₽ — ${freeOther ? `столько сэкономило бы ещё одно место (чашка вместо ${short(ks[j])})` : "столько дало бы ещё одно место"}.`);
    });
    if (works[0] && works[1]) {
      const hi = r.mc[0] > r.mc[1] ? 0 : 1, lo = 1 - hi;
      if (r.mc[hi] - r.mc[lo] > 3 && !capped[lo]) parts.push(`MC кухонь не равны: перенеси чашки с ${short(ks[hi])} на ${short(ks[lo])} — тот же выпуск обойдётся дешевле.`);
    }
    if (onThreshold) parts.push(`Ты на пороге скидки (${CHAIN.discountQ} чашек): на изломе издержек MR < MC — это правильно, добавочные чашки окупаются скидкой ${CHAIN.w - CHAIN.wDiscount} ₽ на ВСЕ зёрна.`);
    else {
      const free = r.mc.filter((_, i) => works[i] && !capped[i]);
      const mcFree = free.length ? Math.min(...free) : null;
      if (mcFree != null) parts.push(mr > mcFree + 3 ? "MR выше MC — выгодно варить больше." : mr < mcFree - 3 ? "MR ниже MC — последние чашки убыточны, вари меньше." : "MR ≈ MC — общий выпуск близок к оптимуму.");
    }
  }
  if (r.chapter === 2 && r.open[1]) {
    const s = chainShutdownMath(r.Amean), F2 = ks[1].F, notice = (r.closeIn || [])[1] || 0;
    parts.push(`Спад. В коротком периоде (аренда Заводской по договору уплачена${notice ? ` ещё ${notice} дн.` : ""}) варить там стоит, пока её вклад > 0: сейчас ≈ ${fmt(s.contribution2)} ₽ сверх переменных издержек.`);
    parts.push(s.contribution2 < F2
      ? `В длинном периоде вклад меньше аренды ${F2} ₽ — закрыть выгоднее (прибыль ≈ ${fmt(s.profitOnlyK1)} против ${fmt(s.profitBoth)}).`
      : `В длинном периоде вклад покрывает аренду ${F2} ₽ — закрывать не стоит.`);
    parts.push(`Закрыть кухню ≠ закрыть фирму: с одной Садовой прибыль ≈ ${fmt(s.profitOnlyK1)} ₽.`);
  }
  if (r.chapter === 3 && r.Q < CHAIN.discountQ && r.plan.Q >= CHAIN.discountQ - 0.5) parts.push(`Скидка на все зёрна (${CHAIN.wDiscount} ₽ вместо ${CHAIN.w}) начинается с ${CHAIN.discountQ} чашек: на пороге издержки падают на ${CHAIN.w - CHAIN.wDiscount} ₽ × все чашки — сравни прибыль целиком, а не только MR и MC на краю.`);
  return parts.join(" ");
}

/* Завершить уровень 2 (нужна медаль экзамена ярмарки): продать ярмарку или оставить дочкой; дочки копятся. */
function levelFinish2(st, choice) {
  const medal = st.fair && st.fair.examBest && st.fair.examBest.medal;
  if (!medal) return null;
  const sale = Math.round(chainSalePrice2(medal));
  const chain = chainNewState(CHAIN.grant + (choice === "sell" ? sale : 0));
  chain.subsidiaries = [...(st.fair.subsidiaries || []).filter((s) => s.daysLeft > 0)];
  if (choice === "keep") chain.subsidiaries.push({ name: "Ярмарка", level: 2, medal, dividend: LEVEL2_DIVIDEND[medal], daysLeft: CHAIN.dividendDays });
  return { ...st, level: 3, chain, level2: { medal, choice, sale, closedDay: st.fair.day } };
}

export {
  CHAIN, LEVEL2_DIVIDEND, CHAIN_GOALS, CHAIN_CHAPTERS,
  chainMC, chainVC, chainA, chainAllocate, chainProfitVar, chainPlan, chainShutdownMath, chainSalePrice2,
  chainNewState, chainSetOpen, chainSimulate, chainVerdict, levelFinish2, lavkaRng, lavkaExamMedal,
};
