/* «Холдинг» — уровень 5 «Пути компании», финансовый финал (чистая логика, без React).
   Новый рычаг — КАПИТАЛ. Каждый день — одно финансовое решение со случайными параметрами и последствиями для кассы:
     1. Инвестиции — отбор проектов при ограниченном бюджете: NPV = PV − I, PI = PV/I; лучший набор — максимум NPV
        (жадный выбор по PI может проиграть из-за неделимости проектов; проекты с NPV < 0 не берут).
     2. Кредит и налоги — аннуитет или дифференцированный платёж (PV по ставке кредита одинаков; если ставка кредита
        выше депозитной, гасить быстрее выгоднее); УСН 6% с доходов или 15% с (доходы − расходы), но не меньше 1% доходов.
     3. Риск — диверсификация (σ портфеля 50/50 = √(σ₁²/4 + σ₂²/4 + ρσ₁σ₂/2)), франшиза (фикс или роялти по ожиданию),
        валютный форвард (сравнение с ожидаемым спотом при нейтральности к риску).
   Финал — экзамен из 4 задач и стоимость холдинга = касса + PV дивидендов и проектов − PV долгов.
   Ставка r = 0,5%/день — игровая (≈ 500% годовых). */
import { lavkaRng, lavkaExamMedal } from "./model.js";

const HOLDING = { rate: 0.005, dividendDays: 60, grant: 50000 };
/* Дивиденд пекарни по медали экзамена уровня 4 (₽/день). */
const LEVEL4_DIVIDEND = { gold: 8000, silver: 6000, bronze: 4000 };
const annuityFactor = (T, r = HOLDING.rate) => (1 - (1 + r) ** -T) / r;
const holdingSalePrice4 = (medal) => (LEVEL4_DIVIDEND[medal] || 0) * annuityFactor(HOLDING.dividendDays);

/* ===== Финансовая математика ===== */
const holdingPV = (p) => p.cf * annuityFactor(p.days);
const holdingNPV = (p) => holdingPV(p) - p.cost;
const holdingPI = (p) => holdingPV(p) / p.cost;
function holdingBestSet(projects, budget) {
  let best = { ids: [], npv: 0, cost: 0 };
  const n = projects.length;
  for (let m = 1; m < 1 << n; m++) {
    const set = projects.filter((_, i) => m & (1 << i));
    const cost = set.reduce((s, p) => s + p.cost, 0);
    if (cost > budget) continue;
    const npv = set.reduce((s, p) => s + holdingNPV(p), 0);
    if (npv > best.npv + 1e-9) best = { ids: set.map((p) => p.id), npv, cost };
  }
  return best;
}
function holdingGreedyPI(projects, budget) {
  let left = budget; const ids = [];
  for (const p of [...projects].sort((a, b) => holdingPI(b) - holdingPI(a))) if (holdingNPV(p) > 0 && p.cost <= left) { ids.push(p.id); left -= p.cost; }
  return { ids, npv: projects.filter((p) => ids.includes(p.id)).reduce((s, p) => s + holdingNPV(p), 0) };
}
/* График платежей: аннуитет (равные платежи) или дифференцированный (равные доли долга + проценты на остаток). */
function holdingSchedule({ amount, rate, n }, kind) {
  if (kind === "annuity") { const a = (amount * rate) / (1 - (1 + rate) ** -n); return Array(n).fill(a); }
  const pays = [];
  for (let t = 0; t < n; t++) pays.push(amount / n + (amount - (amount * t) / n) * rate);
  return pays;
}
/* Деньги на счёте приносят depositRate: если кредит дороже депозита — гасить быстрее (дифференцированный), иначе — медленнее. */
const holdingLoanBest = ({ loanRate, depositRate }) => (loanRate > depositRate ? "diff" : "annuity");
function holdingTax({ revenue, costs }, regime) {
  return regime === "usn6" ? 0.06 * revenue : Math.max(0.15 * (revenue - costs), 0.01 * revenue);
}
const holdingTaxBest = (t) => (holdingTax(t, "usn6") <= holdingTax(t, "usn15") ? "usn6" : "usn15");
const holdingPortfolioSigma = (w, s1, s2, rho) => Math.sqrt(Math.max(0, w * w * s1 * s1 + (1 - w) * (1 - w) * s2 * s2 + 2 * w * (1 - w) * rho * s1 * s2));
const holdingFranchiseBest = ({ fixed, share, expRevenue }) => (fixed >= share * expRevenue ? "fixed" : "royalty");
/* Платим payUSD через месяц: форвард фиксирует курс; при нейтральности к риску сравниваем с ожидаемым спотом. */
const holdingFxBest = ({ forward, expSpot }) => (forward <= expSpot ? "hedge" : "spot");

/* ===== Задачи дня ===== */
const HOLDING_CHAPTERS = [
  { n: 1, title: "Инвестиции", fromDay: 1, kinds: ["budget"] },
  { n: 2, title: "Кредит и налоги", fromDay: 8, kinds: ["loan", "tax"] },
  { n: 3, title: "Риск", fromDay: 15, kinds: ["diversify", "franchise", "fx"] },
];
const HOLDING_GOALS = [
  { id: "invest", emoji: "📊", title: "Инвестор", desc: "Набор проектов с максимальным NPV в пределах бюджета.", reward: 10000 },
  { id: "finance", emoji: "🏦", title: "Финансист", desc: "Верно выбрать график кредита и режим УСН.", reward: 10000 },
  { id: "risk", emoji: "🛡", title: "Риск-менеджер", desc: "Верно решить диверсификацию, франшизу и валютный риск.", reward: 10000 },
];

function holdingMakeTask(kind, rng, day) {
  const pick = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  if (kind === "budget") {
    const budget = pick(10, 20) * 10000;
    const projects = ["A", "B", "C", "D"].map((id) => {
      const cost = pick(6, 18) * 5000, days = pick(4, 8) * 10, pi = 0.8 + rng() * 0.7;
      return { id, cost, days, cf: Math.round((cost * pi) / annuityFactor(days) / 10) * 10 };
    });
    return { kind, day, budget, projects, text: `Бюджет ${budget.toLocaleString("ru-RU")} ₽. Проекты окупаются потоком денег каждый день. Какие взять?` };
  }
  if (kind === "loan") {
    const amount = pick(5, 15) * 10000, n = pick(2, 6) * 5, lr = pick(2, 9), loanRate = (lr >= 5 ? lr + 1 : lr) / 1000; // без ничьей с депозитом 0,5%
    return { kind, day, amount, n, loanRate, depositRate: HOLDING.rate,
      text: `Кредит ${amount.toLocaleString("ru-RU")} ₽ на ${n} дней под ${(loanRate * 100).toFixed(1).replace(".", ",")}% в день; деньги на счёте приносят 0,5% в день. Аннуитет или дифференцированный платёж?` };
  }
  if (kind === "tax") {
    const revenue = pick(8, 20) * 10000, costs = Math.round(revenue * (0.4 + rng() * 0.5) / 1000) * 1000;
    return { kind, day, revenue, costs, text: `Дочка за неделю: доходы ${revenue.toLocaleString("ru-RU")} ₽, расходы ${costs.toLocaleString("ru-RU")} ₽. УСН 6% или 15%?` };
  }
  if (kind === "diversify") {
    const pairs = [0, 1, 2].map(() => ({ s1: pick(10, 30), s2: pick(10, 30), rho: pick(-5, 9) / 10 }));
    return { kind, day, pairs, text: "Покупаешь две дочки поровну. Доходность у всех вариантов одинаковая. Какая пара даёт наименьший риск (σ)?" };
  }
  if (kind === "franchise") {
    const expRevenue = pick(4, 10) * 10000, share = pick(3, 8) / 100, k = rng() < 0.5 ? 0.7 + rng() * 0.25 : 1.05 + rng() * 0.25;
    const fixed = Math.round((share * expRevenue * k) / 100) * 100; // без ничьей: фикс на 5–30% ниже или выше роялти
    return { kind, day, expRevenue, share, fixed, text: `Франчайзи ждёт выручку ≈ ${expRevenue.toLocaleString("ru-RU")} ₽ в неделю. Взять фиксированный платёж ${fixed.toLocaleString("ru-RU")} ₽ или роялти ${Math.round(share * 100)}%? Холдинг нейтрален к риску — сравни ожидаемый доход.` };
  }
  const expSpot = pick(88, 100), d = pick(1, 4) * (rng() < 0.5 ? -1 : 1), forward = expSpot + d, payUSD = pick(5, 20) * 100;
  return { kind: "fx", day, expSpot, forward, payUSD, text: `Через месяц платить поставщику ${payUSD} $. Ожидаемый курс ${expSpot} ₽, форвард ${forward} ₽. Холдинг нейтрален к риску. Зафиксировать форвардом или платить по споту?` };
}
/* Задача дня — детерминирована по сиду холдинга, дню и главе. */
function holdingTask(st) {
  const ch = HOLDING_CHAPTERS[(st.chapter || 1) - 1], rng = lavkaRng((st.seed || 1) * 7919 + st.day * 31 + ch.n);
  const n = ch.kinds.length, i = (((st.day - ch.fromDay) % n) + n) % n;
  const t = holdingMakeTask(ch.kinds[i], rng, st.day);
  /* Бюджет не больше кассы: потратить можно только то, что есть. */
  if (t.kind === "budget" && st.cash != null && st.cash < t.budget) {
    const budget = Math.max(0, Math.floor(st.cash / 10000) * 10000);
    return { ...t, budget, text: t.text.replace(/Бюджет [^₽]+₽/, `Бюджет ${budget.toLocaleString("ru-RU")} ₽`) };
  }
  return t;
}
function holdingTaskBest(t) {
  if (t.kind === "budget") return { ids: holdingBestSet(t.projects, t.budget).ids };
  if (t.kind === "loan") return { choice: holdingLoanBest(t) };
  if (t.kind === "tax") return { choice: holdingTaxBest(t) };
  if (t.kind === "diversify") { const s = t.pairs.map((p) => holdingPortfolioSigma(0.5, p.s1, p.s2, p.rho)); return { choice: s.indexOf(Math.min(...s)) }; }
  if (t.kind === "franchise") return { choice: holdingFranchiseBest(t) };
  return { choice: holdingFxBest(t) };
}
/* «Всегда первый вариант» — для проверки, что экзамен не сдаётся без расчётов. */
function holdingTaskFirst(t) {
  if (t.kind === "budget") return { ids: [t.projects[0].id] };
  return { choice: { loan: "annuity", tax: "usn6", diversify: 0, franchise: "fixed", fx: "hedge" }[t.kind] };
}
function holdingScore(t, ans) {
  if (t.kind === "budget") {
    const chosen = t.projects.filter((p) => (ans.ids || []).includes(p.id));
    if (chosen.reduce((s, p) => s + p.cost, 0) > t.budget) return 0;
    const best = holdingBestSet(t.projects, t.budget).npv, npv = chosen.reduce((s, p) => s + holdingNPV(p), 0);
    return best <= 0 ? (chosen.length === 0 ? 1 : 0) : Math.max(0, Math.min(1, npv / best));
  }
  if (t.kind === "diversify") {
    const s = t.pairs.map((p) => holdingPortfolioSigma(0.5, p.s1, p.s2, p.rho));
    return s[ans.choice] !== undefined && s[ans.choice] <= Math.min(...s) + 1e-9 ? 1 : 0;
  }
  return ans.choice === holdingTaskBest(t).choice ? 1 : 0;
}

function holdingNewState(cash = HOLDING.grant, seed = 1) {
  return { v: 1, level: 5, day: 1, chapter: 1, seed, cash: Math.round(cash), subsidiaries: [], projects: [], loans: [],
    answered: null, scores: [], goals: {}, history: [], last: null };
}

/* Ответ на задачу дня: последствия для кассы и оценка решения. */
function holdingAnswer(st, t, ans) {
  const score = holdingScore(t, ans);
  let next = { ...st, answered: { day: st.day, kind: t.kind, score, ans } };
  let effect = 0;
  if (t.kind === "budget") {
    const chosen = t.projects.filter((p) => (ans.ids || []).includes(p.id));
    const cost = chosen.reduce((s, p) => s + p.cost, 0);
    if (cost <= t.budget && cost <= st.cash) {
      next.projects = [...st.projects, ...chosen.map((p) => ({ id: `${t.day}-${p.id}`, cf: p.cf, daysLeft: p.days }))];
      effect = -cost;
    }
  } else if (t.kind === "loan") {
    const pays = holdingSchedule({ amount: t.amount, rate: t.loanRate, n: t.n }, ans.choice);
    next.loans = [...st.loans, { pays, paid: 0 }];
    effect = t.amount;
  } else if (t.kind === "tax") effect = -holdingTax(t, ans.choice);
  else if (t.kind === "franchise") effect = ans.choice === "fixed" ? t.fixed : t.share * t.expRevenue;
  else if (t.kind === "fx") {
    const spot = t.expSpot * (1 + 0.06 * (2 * lavkaRng(t.day * 101 + t.payUSD)() - 1));
    effect = -t.payUSD * (ans.choice === "hedge" ? t.forward : spot);
  }
  next.cash = Math.round(st.cash + effect);
  next.scores = [...(st.scores || []), { day: st.day, kind: t.kind, score }];
  /* Цели глав. */
  const goals = { ...st.goals }, newGoals = [];
  const ok = (k) => next.scores.some((x) => x.kind === k && x.score >= 0.95);
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  if (ok("budget")) hit("invest");
  if (ok("loan") && ok("tax")) hit("finance");
  if (ok("diversify") && ok("franchise") && ok("fx")) hit("risk");
  const reward = newGoals.reduce((s, id) => s + (HOLDING_GOALS.find((g) => g.id === id)?.reward || 0), 0);
  next = { ...next, goals, cash: next.cash + reward };
  return { next, score, effect, newGoals, reward };
}

/* Следующий день: дивиденды, потоки проектов, платежи по кредитам, проценты; главы по дням. */
function holdingNextDay(st, rng = Math.random) {
  let dividend = 0, projectCF = 0, loanPay = 0;
  const subsidiaries = (st.subsidiaries || []).map((s) => { if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; } return s; });
  const projects = (st.projects || []).map((p) => { if (p.daysLeft > 0) { projectCF += p.cf; return { ...p, daysLeft: p.daysLeft - 1 }; } return p; });
  const loans = (st.loans || []).map((l) => { if (l.paid < l.pays.length) { loanPay += l.pays[l.paid]; return { ...l, paid: l.paid + 1 }; } return l; });
  const interest = st.cash * HOLDING.rate;
  const net = dividend + projectCF - loanPay + interest;
  let chapter = st.chapter, newChapter = null;
  const up = HOLDING_CHAPTERS[chapter];
  if (up && st.day + 1 >= up.fromDay) { chapter += 1; newChapter = chapter; }
  const report = { day: st.day, dividend, projectCF, loanPay, interest, net, newChapter };
  const next = { ...st, day: st.day + 1, chapter, cash: Math.round(st.cash + net), subsidiaries, projects, loans, answered: null,
    history: [...(st.history || []), { day: st.day, net: Math.round(net) }].slice(-60), last: report, at: Date.now() };
  return { next, report };
}

/* Стоимость холдинга: касса + PV оставшихся дивидендов и потоков проектов − PV оставшихся платежей по кредитам. */
function holdingValue(h) {
  const r = HOLDING.rate;
  const pvDiv = (h.subsidiaries || []).reduce((s, x) => s + x.dividend * annuityFactor(x.daysLeft, r), 0);
  const pvProj = (h.projects || []).reduce((s, p) => s + p.cf * annuityFactor(p.daysLeft, r), 0);
  const pvDebt = (h.loans || []).reduce((s, l) => s + l.pays.slice(l.paid).reduce((a, x, t) => a + x / (1 + r) ** (t + 1), 0), 0);
  return h.cash + pvDiv + pvProj - pvDebt;
}

/* ===== Экзамен уровня 5 ===== */
const holdingExamOpen = (h) => (h.chapter || 1) >= 3 && h.day >= 22;
function holdingExamNew(h, seed) {
  const rng = lavkaRng(seed), pickOf = (arr) => arr[Math.floor(rng() * arr.length)];
  const kinds = ["budget", pickOf(["loan", "tax"]), pickOf(["diversify", "franchise", "fx"])];
  const rest = ["loan", "tax", "diversify", "franchise", "fx"].filter((k) => !kinds.includes(k));
  kinds.push(pickOf(rest));
  return { seed, tasks: kinds.map((k, i) => holdingMakeTask(k, rng, 100 + i)), results: [] };
}
function holdingExamPlay(ex, ans) {
  const t = ex.tasks[ex.results.length];
  const res = { ans, best: holdingTaskBest(t), score: holdingScore(t, ans) };
  return { exam: { ...ex, results: [...ex.results, res] }, result: res, done: ex.results.length + 1 === ex.tasks.length };
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
    day: better ? h.day : prev.day, attempts: (prev.attempts || 0) + 1, value: better ? holdingValue(h) : prev.value } };
}

/* Завершить уровень 4 (нужна медаль экзамена пекарни): продать пекарню или оставить дочкой; дочки копятся. */
function levelFinish4(st, choice) {
  const medal = st.factory && st.factory.examBest && st.factory.examBest.medal;
  if (!medal) return null;
  const sale = Math.round(holdingSalePrice4(medal));
  const holding = holdingNewState(HOLDING.grant + (choice === "sell" ? sale : 0), (st.factory.day || 1) + 7);
  holding.subsidiaries = [...(st.factory.subsidiaries || []).filter((s) => s.daysLeft > 0)];
  if (choice === "keep") holding.subsidiaries.push({ name: "Пекарня", level: 4, medal, dividend: LEVEL4_DIVIDEND[medal], daysLeft: HOLDING.dividendDays });
  return { ...st, level: 5, holding, level4: { medal, choice, sale, closedDay: st.factory.day } };
}

export {
  HOLDING, LEVEL4_DIVIDEND, HOLDING_CHAPTERS, HOLDING_GOALS, annuityFactor, holdingSalePrice4,
  holdingPV, holdingNPV, holdingPI, holdingBestSet, holdingGreedyPI, holdingSchedule, holdingLoanBest, holdingTax, holdingTaxBest,
  holdingPortfolioSigma, holdingFranchiseBest, holdingFxBest,
  holdingMakeTask, holdingTask, holdingTaskBest, holdingTaskFirst, holdingScore, holdingNewState, holdingAnswer, holdingNextDay, holdingValue,
  holdingExamOpen, holdingExamNew, holdingExamPlay, holdingExamResult, holdingExamFinish, levelFinish4,
};
