/* Калибровка медалей экзамена: node exam-calibrate.js [прогонов=40]
   Каждая стратегия играет 21 день основной игры, затем сдаёт экзамен уровня 1 на разных сидах.
   Бот-ученик не знает истинного спроса: оценивает его МНК по своим наблюдениям (как тетрадь игрока)
   и читает множители событий из текстов. Решение из чата: бот-ученик должен получать ≈ серебро. */
import * as L from "./model.js";

const RUNS = Number(process.argv[2] || 40);
const BUY = [[5, "analyst"], [9, "coffee"], [12, "helper"], [16, "fridge"], [18, "office"]];
const EXPLORE = { lemonade: [40, 50, 60], croissant: [45, 55, 65], coffee: [100, 120, 140], icecream: [50, 60, 70] };

/* Оценка спроса учеником: α, β из МНК × сегодняшнее число покупателей k × множители события (из текста). */
function studentEstimate(st, point) {
  return (pid, m) => {
    const fit = L.lavkaFit(st.obs[point]?.[pid]);
    if (!fit) return null;
    const eff = st.event ? L.LAVKA_EVENTS[st.event.id].effect(pid, point, st.event) || {} : {};
    let A = fit.alpha * m.k * (eff.aMult || 1), B = fit.beta * m.k * (eff.bMult || 1);
    if (eff.comp) A = 0.55 * A + 0.5 * B * st.event.compPrice;
    return { A, B };
  };
}

const strategies = {
  "бот-оптимизатор": (st) => L.lavkaExamBotSettings(st),
  "бот-ученик (МНК)": (st) => {
    const s = JSON.parse(JSON.stringify(st.settings));
    for (const p of L.lavkaOpenPoints(st)) {
      const plan = L.lavkaPlan(st, p, studentEstimate(st, p));
      for (const pid of L.lavkaUnlocked(st)) {
        const fit = L.lavkaFit(st.obs[p]?.[pid]), n = (st.obs[p]?.[pid] || []).filter((o) => o.base).length;
        const r = plan.rows[pid];
        s[p][pid] = fit ? { price: Math.round(r.pOpt), order: Math.round(r.qOpt * 1.05) }
          : { price: EXPLORE[pid][n % 3], order: Math.round(L.lavkaParams(st, p, pid).A * 0.5) };
      }
    }
    return s;
  },
  "MR = MC без мощности": (st) => {
    const s = JSON.parse(JSON.stringify(st.settings));
    for (const p of L.lavkaOpenPoints(st)) for (const pid of L.lavkaUnlocked(st)) { const m = L.lavkaParams(st, p, pid); s[p][pid] = { price: Math.round(m.pOpt), order: Math.round(m.qOpt * 1.05) }; }
    return s;
  },
  "цена не меняется (50 ₽)": (st) => {
    const s = JSON.parse(JSON.stringify(st.settings));
    for (const p of L.lavkaOpenPoints(st)) for (const pid of L.lavkaUnlocked(st)) { const m = L.lavkaParams(st, p, pid); s[p][pid] = { price: 50, order: Math.max(0, Math.round(m.A - m.B * 50)) }; }
    return s;
  },
};

function run(fn, seed) {
  let st = L.lavkaNewState();
  const rng = L.lavkaRng(seed);
  for (let d = 0; d < 21; d++) {
    for (const [day, id] of BUY) {
      const u = L.LAVKA_UPGRADES.find((x) => x.id === id);
      if (d >= day && !st.upgrades[id] && L.lavkaUpgradeOpen(st, u) && st.cash >= u.cost) { st.cash -= u.cost; st.upgrades[id] = true; }
    }
    /* Основную игру за всех ведёт ученик: на экзамен приходит одна и та же лавка, отличается только поведение на экзамене. */
    st.settings = strategies["бот-ученик (МНК)"](st);
    st = L.lavkaSimulate(st, rng).next;
  }
  st = { ...st, chapter: 3, day: Math.max(st.day, L.LAVKA_EXAM_FROM_DAY) };
  let ex = L.lavkaExamNew(st, seed * 7 + 1);
  for (let i = 0; i < ex.days.length; i++) ex = L.lavkaExamPlayDay(st, ex, fn(L.lavkaExamDayState(st, ex, i))).exam;
  return L.lavkaExamResult(ex);
}

const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  const res = [];
  for (let i = 0; i < RUNS; i++) res.push(run(fn, 1000 + i));
  const effs = res.map((r) => (r ? r.eff : 0)).sort((a, b) => a - b);
  const share = (id) => Math.round((100 * res.filter((r) => (r?.medal?.id || null) === id).length) / RUNS) + "%";
  rows.push({ стратегия: name, "эффективность, средн.": (effs.reduce((s, e) => s + e, 0) / RUNS).toFixed(3),
    медиана: effs[Math.floor(RUNS / 2)].toFixed(3), "худший день, медиана": res.map((r) => (r ? r.minDay : 0)).sort((a, b) => a - b)[Math.floor(RUNS / 2)].toFixed(3),
    "🥇": share("gold"), "🥈": share("silver"), "🥉": share("bronze"), "без медали": share(null) });
}
console.log(`Экзамен уровня 1, прогонов: ${RUNS}`);
console.table(rows);
