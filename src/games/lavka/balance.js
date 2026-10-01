/* Баланс «Лавки»: node balance.js [дней=40] [прогонов=20]
   Сравнивает стратегии и печатает среднюю прибыль. Ворота этапа 2:
   оптимальная стратегия должна обгонять все «тупые», а их разрыв — быть заметным. */
import * as L from "./model.js";

const DAYS = Number(process.argv[2] || 40), RUNS = Number(process.argv[3] || 20);
const BUY = [[5, "analyst"], [12, "coffee"], [14, "helper"], [20, "fridge"], [25, "office"]];

const strategies = {
  "оптимум (P*, закупка 105%)": (m) => ({ price: Math.round(m.pOpt), order: m.qOpt * 1.05 }),
  "оптимум, закупка 85%":       (m) => ({ price: Math.round(m.pOpt), order: m.qOpt * 0.85 }),
  "оптимум, закупка 125%":      (m) => ({ price: Math.round(m.pOpt), order: m.qOpt * 1.25 }),
  "дёшево (P = MC + 5)":        (m) => ({ price: Math.round(m.mc + 5), order: m.A - m.B * (m.mc + 5) }),
  "дорого (P = 0,9·резерв.)":    (m) => ({ price: Math.round(0.9 * m.choke), order: m.A - m.B * 0.9 * m.choke }),
  "цена не меняется (50 ₽)":    (m) => ({ price: 50, order: Math.max(0, m.A - m.B * 50) }),
};

function play(fn) {
  let st = L.lavkaNewState(), total = 0, firstBuy = {};
  for (let d = 0; d < DAYS; d++) {
    for (const [day, id] of BUY) {
      const u = L.LAVKA_UPGRADES.find((x) => x.id === id);
      if (d >= day && !st.upgrades[id] && st.cash >= u.cost) { st.cash -= u.cost; st.upgrades[id] = true; firstBuy[id] = st.day; }
    }
    for (const p of L.lavkaOpenPoints(st)) for (const pid of L.lavkaUnlocked(st)) {
      const m = L.lavkaParams(st, p, pid), s = fn(m);
      st.settings[p][pid] = { price: Math.max(1, s.price), order: Math.max(0, Math.round(s.order) - (st.stock[p][pid] || 0)) };
    }
    const { next, report } = L.lavkaSimulate(st); total += report.profit; st = next;
  }
  return { total, cash: st.cash, rep: st.rep.main, firstBuy };
}

const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  let t = 0, c = 0, r = 0;
  for (let i = 0; i < RUNS; i++) { const o = play(fn); t += o.total; c += o.cash; r += o.rep; }
  rows.push({ стратегия: name, "прибыль за период": Math.round(t / RUNS), "касса в конце": Math.round(c / RUNS), "лояльность парка": (r / RUNS).toFixed(2) });
}
rows.sort((a, b) => b["прибыль за период"] - a["прибыль за период"]);
console.log(`Дней: ${DAYS}, прогонов на стратегию: ${RUNS}`);
console.table(rows);
