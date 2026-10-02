/* Баланс «Своего производства» (уровень 4): node factory-balance.js [дней=30] [прогонов=20] */
import * as P from "./factory.js";
import * as L from "./model.js";

const DAYS = Number(process.argv[2] || 30), RUNS = Number(process.argv[3] || 20);
const optL = (st) => Math.round(P.factoryLabor(P.factoryMarket(st)).L);
const strategies = {
  "оптимум + своя печь": (st) => ({ ...P.factoryBuyOven(st), L: optL(st) }),
  "оптимум, печь в аренду": (st) => ({ ...st, L: optL(st) }),
  "игнорирует MRC (нанимает до MRP = w(L))": (st) => ({ ...P.factoryBuyOven(st), L: st.chapter === 1 ? optL(st) : Math.round(P.factoryCompetitiveEq().L) }),
  "всегда 20 работников": (st) => ({ ...P.factoryBuyOven(st), L: 20 }),
  "всегда 10 работников": (st) => ({ ...P.factoryBuyOven(st), L: 10 }),
};
const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  let t = 0, g = 0;
  for (let i = 0; i < RUNS; i++) {
    let st = P.factoryNewState(1e5); const rng = L.lavkaRng(500 + i);
    for (let d = 0; d < DAYS; d++) { const before = st.cash; st = fn(st); t -= before - st.cash; const out = P.factorySimulate(st, rng); t += out.report.profit; st = out.next; }
    g += Object.keys(st.goals).length;
  }
  rows.push({ стратегия: name, "прибыль пекарни (с покупкой печи)": Math.round(t / RUNS), "целей": (g / RUNS).toFixed(1) });
}
rows.sort((a, b) => b["прибыль пекарни (с покупкой печи)"] - a["прибыль пекарни (с покупкой печи)"]);
console.log(`Своё производство: ${DAYS} дней, прогонов ${RUNS}. Печь: покупка 80 000 (остаточная 20 000 через 60 дней) против аренды 2 000/день`);
console.table(rows);
