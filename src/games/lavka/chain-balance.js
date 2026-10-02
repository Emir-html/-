/* Баланс «Сети кофеен» (уровень 3): node chain-balance.js [прогонов=20]
   Стратегии за 21 день: решения по оптимуму дня с разными долгосрочными решениями (кухня 1, кофейня T, терраса),
   и типичные ошибки. Итог — прибыль сети за уровень (без капитала и процентов) с учётом вложений. */
import * as C from "./chain.js";
import * as L from "./model.js";

const RUNS = Number(process.argv[2] || 20);
const opt = (st, { decideT = true } = {}) => {
  const dd = C.chainDay(st);
  const b = decideT && st.day >= C.CHAIN.togglesFromDay ? C.chainBestDecision(dd, { decideT: true }) : { ...C.chainPlan(dd), tOpen: dd.tOpen };
  return { ...C.chainSetT(st, b.tOpen), pN: Math.round(b.PN), pT: b.PT != null ? Math.round(b.PT) : st.pT, q: b.q };
};
const strategies = {
  "оптимум + сдать кухню 1 на 11-й": (st) => opt(st.day === 11 ? C.chainCloseK1(st) : st),
  "то же + терраса на 6-й": (st) => opt(st.day === 11 ? C.chainCloseK1(st) : st.day === 6 ? C.chainBuy(st, "terrace") : st),
  "оптимум, кухня 1 остаётся": (st) => opt(st),
  "оптимум, но T закрыта навсегда с 11-го": (st) => { const s = st.day === 11 ? C.chainCloseK1(st) : st; const o = opt(s, { decideT: false }); return st.day >= 11 ? C.chainSetT(o, false) : o; },
  "цены недели 1 навсегда (130 / 80), кухни 40 / 160": (st) => ({ ...st, pN: 130, pT: 80, q: [st.k1Closed ? 0 : 40, 160] }),
  "кухни поровну (100 / 100)": (st) => { const o = opt(st); return { ...o, q: [100, 100] }; },
  "без Зои: всё своё (120 / 220)": (st) => { const o = opt(st); return { ...o, q: [120, 220] }; },
};
function play(fn, seed) {
  let st = C.chainNewState(30000), total = 0;
  const rng = L.lavkaRng(seed);
  for (let d = 1; d <= C.CHAIN.levelDays; d++) { st = fn(st); const out = C.chainSimulate(st, rng); total += out.report.profit; st = out.next; }
  if (st.terrace) total -= C.CHAIN.terrace.cost;
  return { total, goals: Object.keys(st.goals).length };
}
const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  let t = 0, g = 0;
  for (let i = 0; i < RUNS; i++) { const o = play(fn, 900 + i); t += o.total; g += o.goals; }
  rows.push({ стратегия: name, "прибыль сети за 21 день": Math.round(t / RUNS), "целей": (g / RUNS).toFixed(1) });
}
rows.sort((a, b) => b["прибыль сети за 21 день"] - a["прибыль сети за 21 день"]);
console.log(`Сеть кофеен: 21 день, прогонов ${RUNS}.`);
console.table(rows);
