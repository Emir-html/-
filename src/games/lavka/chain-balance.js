/* Баланс «Сети кофеен» (уровень 3): node chain-balance.js [дней=30] [прогонов=20]
   Стратегии по главам: две кухни, спад (закрывать или нет), опт (добирать до порога или нет). Метрика — прибыль сети. */
import * as C from "./chain.js";
import * as L from "./model.js";

const DAYS = Number(process.argv[2] || 30), RUNS = Number(process.argv[3] || 20);
const caps = C.CHAIN.kitchens.map((k) => k.cap);
const opts = (st, over = {}) => ({ A: C.chainA(st), w: C.CHAIN.w, open: st.open, caps, discount: st.chapter >= 3, ...over });

const strategies = {
  "оптимум: план, закрыть в спад, открыть после": (st) => {
    if (st.chapter === 2 && st.open[1]) st = C.chainSetOpen(st, 1, false);
    if (st.chapter === 3 && !st.open[1]) st = C.chainSetOpen(st, 1, true);
    return { ...st, q: C.chainPlan(opts(st)).q.map(Math.round) };
  },
  "оптимум, но никогда не закрывает": (st) => ({ ...st, q: C.chainPlan(opts(st)).q.map(Math.round) }),
  "MR = MC без учёта скидки": (st) => {
    if (st.chapter === 2 && st.open[1]) st = C.chainSetOpen(st, 1, false);
    if (st.chapter === 3 && !st.open[1]) st = C.chainSetOpen(st, 1, true);
    return { ...st, q: C.chainPlan(opts(st, { discount: false })).q.map(Math.round) };
  },
  "оптимальный Q, но пополам между кухнями": (st) => {
    const Q = C.chainPlan(opts(st)).Q;
    return { ...st, q: [Math.min(50, Math.round(Q / 2)), Math.round(Q - Math.min(50, Math.round(Q / 2)))] };
  },
  "всегда 40 + 50": (st) => ({ ...st, q: [40, 50] }),
};

const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  let t = 0, g = 0;
  for (let i = 0; i < RUNS; i++) {
    let st = C.chainNewState(1e5); const rng = L.lavkaRng(900 + i);
    for (let d = 0; d < DAYS; d++) { st = fn(st); const out = C.chainSimulate(st, rng); t += out.report.profit; st = out.next; }
    g += Object.keys(st.goals).length;
  }
  rows.push({ стратегия: name, "прибыль сети": Math.round(t / RUNS), "целей": (g / RUNS).toFixed(1) });
}
rows.sort((a, b) => b["прибыль сети"] - a["прибыль сети"]);
console.log(`Сеть кофеен: ${DAYS} дней, прогонов ${RUNS}`);
console.table(rows);
