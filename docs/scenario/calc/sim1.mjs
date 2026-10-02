// Симуляция уровня 1 по сценарному календарю (дни 1–24) с шумом и лояльностью.
import * as L from "./l1.mjs";
export const COST = { analyst: 2500, fridge: 4000, coffee: 5000, helper: 6000, sign: 7000, freezer: 9000, supplier: 12000, office: 30000 };
// день открытия улучшения в лавке (сценарий)
export const UNLOCK = { analyst: 3, helper: 7, fridge: 8, coffee: 10, sign: 12, office: 15, freezer: 17, supplier: 19 };
// сценарный календарь событий
export function eventsOf(day, st) {
  switch (day) {
    case 4: case 5: return [{ id: "flour", pid: "croissant", cAdd: 12 }];
    case 9: case 10: case 11: case 12: return [{ id: "competitor", pid: "lemonade", point: "main", comp: st.compPrice }];
    case 13: return [{ id: "ceiling", pid: "lemonade", point: "main", cap: 37 }];
    case 16: case 17: return [{ id: "tax", pid: "lemonade", tax: 10 }];
    case 18: case 19: return [{ id: "blogger", pid: "croissant", aMult: 1.3, bMult: 0.75 }];
    case 20: return [{ id: "heat", pid: "lemonade", aMult: 1.5 }, { id: "heat", pid: "icecream", aMult: 1.6 }, { id: "heat", pid: "coffee", aMult: 0.85 }];
    case 23: return [{ id: "festival", point: "main", kMult: 1.3 }];
    case 24: return [{ id: "ceiling", pid: "croissant", point: "main", cap: 44 }];
    default: return [];
  }
}
const unlocked = (st) => ["lemonade", "croissant", ...(st.up.coffee ? ["coffee"] : []), ...(st.up.freezer ? ["icecream"] : [])];
const points = (st) => (st.up.office ? ["main", "office"] : ["main"]);

// strategy(st, day, point, ms, opt) -> [{P, orderMult}]
export function run({ seed = 1, strategy, buy = Object.keys(UNLOCK), buffer = 1500, days = 24, buyUntil = 21 }) {
  const rnd = L.mulberry32(seed);
  const st = { cash: 2000, up: {}, rep: { main: 1, office: 1 }, stock: { main: {}, office: {} }, compPrice: null, lastLem: 50 };
  const log = [];
  for (let day = 1; day <= days; day++) {
    for (const id of buy) if (day <= buyUntil && day >= UNLOCK[id] && !st.up[id] && st.cash >= COST[id] + buffer) { st.up[id] = true; st.cash -= COST[id]; log.push({ day, buy: id }); }
    if (day === 9) st.compPrice = Math.round(L.compBR(160, 2, 20, st.lastLem));
    const ev = eventsOf(day, st);
    let profit = 0, fixed = 0;
    const K = 120 + (st.up.helper ? 100 : 0);
    for (const pt of points(st)) {
      fixed += L.PT[pt].rent + (st.up.helper ? 500 : 0);
      const o = { rep: st.rep, sign: st.up.sign, supplier: st.up.supplier, events: ev };
      const ms = unlocked(st).map((pid) => L.params(day, pt, pid, o));
      const opt = L.optimum(ms, K);
      const dec = strategy(st, day, pt, ms, opt);
      const pre = ms.map((m, i) => {
        let P = dec[i].P; if (m.cap != null) P = Math.min(P, m.cap);
        const eq = Math.max(0, m.A - m.B * P);
        const D = Math.max(0, Math.round(eq * (0.92 + rnd() * 0.16)));
        const carried = st.stock[pt][m.pid] || 0;
        const order = Math.max(0, Math.round(dec[i].order != null ? dec[i].order : eq * dec[i].orderMult) - carried);
        const have = carried + order;
        return { m, P, D, order, have, wanted: Math.min(D, have) };
      });
      const want = pre.reduce((s, r) => s + r.wanted, 0), kk = want > K ? K / want : 1;
      let lost = 0, D = 0;
      for (const r of pre) {
        const S = Math.floor(r.wanted * kk); const left = r.have - S;
        st.stock[pt][r.m.pid] = st.up.fridge ? Math.floor(left * 0.8) : 0;
        profit += r.P * S - r.m.c * r.order - r.m.tax * S;
        lost += r.D - S; D += r.D;
        if (pt === "main" && r.m.pid === "lemonade") st.lastLem = r.P;
      }
      const share = D > 0 ? lost / D : 0, old = st.rep[pt];
      st.rep[pt] = Math.round(Math.min(1.1, Math.max(0.8, share <= 0.03 ? old + 0.02 : old - 0.3 * share)) * 1000) / 1000;
    }
    profit -= fixed; st.cash += profit;
    if (day >= 9 && day <= 12) st.compPrice = Math.round(L.compBR(160, 2, 20, st.lastLem));
    log.push({ day, profit: Math.round(profit), cash: Math.round(st.cash), rep: st.rep.main, K });
  }
  return { st, log };
}
// оптимальная стратегия (знает истинные параметры, газетчик)
export const optimal = (st, day, pt, ms, opt) => opt.rows.map((r) => {
  let P = r.P;
  if (r.comp != null) { // дуэль: лучший ответ на цену Семёна
    const m0 = L.params(day, "main", "lemonade", { rep: st.rep });
    P = L.compBR(m0.A, m0.B, r.mc, r.comp);
  }
  const cr = (P - r.mc) / P; // Cu/(Cu+Co), Co = c (всё выбрасывается)
  return { P: Math.round(P), orderMult: 0.92 + 0.16 * cr };
});
