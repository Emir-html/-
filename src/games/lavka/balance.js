/* Баланс «Лавки»: node balance.js [дней=40] [прогонов=20] [open]
   open — все главы открыты с первого дня: видно, во сколько обходится сама ошибка, без цены «застрял в главе».
   Сравнивает стратегии и печатает среднюю прибыль. Ворота этапа 2:
   оптимальная стратегия должна обгонять все «тупые», а их разрыв — быть заметным. */
import * as L from "./model.js";

const DAYS = Number(process.argv[2] || 40), RUNS = Number(process.argv[3] || 20), OPEN = process.argv[4] === "open";
const BUY = [[5, "analyst"], [12, "coffee"], [14, "helper"], [20, "fridge"], [25, "office"]];

/* m — параметры товара (lavkaParams), b — план точки с учётом мощности (lavkaPlan): MR = MC + λ. */
const strategies = {
  "оптимум (P*, закупка 105%)": (m, b) => ({ price: Math.round(b.pOpt), order: b.qOpt * 1.05 }),
  "оптимум, закупка 85%":       (m, b) => ({ price: Math.round(b.pOpt), order: b.qOpt * 0.85 }),
  "оптимум, закупка 125%":      (m, b) => ({ price: Math.round(b.pOpt), order: b.qOpt * 1.25 }),
  "MR = MC без учёта мощности": (m) => ({ price: Math.round(m.pOpt), order: m.qOpt * 1.05 }),
  "дёшево (P = MC + 5)":        (m) => ({ price: Math.round(m.mc + 5), order: m.A - m.B * (m.mc + 5) }),
  "дорого (P = 0,9·резерв.)":    (m) => ({ price: Math.round(0.9 * m.choke), order: m.A - m.B * 0.9 * m.choke }),
  "цена не меняется (50 ₽)":    (m) => ({ price: 50, order: Math.max(0, m.A - m.B * 50) }),
};

function play(fn) {
  let st = L.lavkaNewState(), total = 0, firstBuy = {};
  if (OPEN) st.chapter = L.LAVKA_CHAPTERS.length;
  for (let d = 0; d < DAYS; d++) {
    for (const [day, id] of BUY) {
      const u = L.LAVKA_UPGRADES.find((x) => x.id === id);
      if (d >= day && !st.upgrades[id] && L.lavkaUpgradeOpen(st, u) && st.cash >= u.cost) { st.cash -= u.cost; st.upgrades[id] = true; firstBuy[id] = st.day; }
    }
    for (const p of L.lavkaOpenPoints(st)) for (const pid of L.lavkaUnlocked(st)) {
      const m = L.lavkaParams(st, p, pid), s = fn(m, L.lavkaPlan(st, p).rows[pid]);
      st.settings[p][pid] = { price: Math.max(1, s.price), order: Math.max(0, Math.round(s.order) - (st.stock[p][pid] || 0)) };
    }
    const { next, report } = L.lavkaSimulate(st); total += report.profit; st = next;
  }
  return { total, cash: st.cash, rep: st.rep.main, firstBuy, chapter: st.chapter };
}

const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  let t = 0, c = 0, r = 0, ch = 0;
  const first = [], office = []; // день первой покупки улучшения и день открытия второй точки
  for (let i = 0; i < RUNS; i++) {
    const o = play(fn); t += o.total; c += o.cash; r += o.rep; ch += o.chapter;
    const days = Object.values(o.firstBuy); if (days.length) first.push(Math.min(...days));
    if (o.firstBuy.office) office.push(o.firstBuy.office);
  }
  const avg = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) + (a.length < RUNS ? ` (${a.length}/${RUNS})` : "") : "—");
  rows.push({ стратегия: name, "прибыль за период": Math.round(t / RUNS), "касса в конце": Math.round(c / RUNS), "лояльность парка": (r / RUNS).toFixed(2),
    "глава к концу": (ch / RUNS).toFixed(1), "1-я покупка, день": avg(first), "2-я точка, день": avg(office) });
}
rows.sort((a, b) => b["прибыль за период"] - a["прибыль за период"]);
console.log(`Дней: ${DAYS}, прогонов на стратегию: ${RUNS}${OPEN ? ", все главы открыты" : ""}`);
console.table(rows);
