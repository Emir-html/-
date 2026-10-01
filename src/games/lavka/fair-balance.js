/* Баланс «Ярмарки» (уровень 2): node fair-balance.js [дней=30] [прогонов=30]
   Стратегии × выбор капитала (продать лавку / оставить дочкой, медаль «серебро»).
   Итог — капитал на конец периода + PV оставшихся дивидендов по ставке r. */
import * as F from "./fair.js";
import * as L from "./model.js";

const DAYS = Number(process.argv[2] || 30), RUNS = Number(process.argv[3] || 30);
const today = (st) => F.fairRivalsReply(st.lastQ, st.rivals.length) * st.rivals.length; // конкуренты отвечают на вчерашний объём

const strategies = {
  "наилучший ответ + верность картелю + вложения": (st) => {
    st = F.fairBuy(F.fairBuy(st, "flour"), "leader");
    const c = F.fairMC(st);
    if (st.cartel && st.cartel.active && st.cartel.punish === 0 && !st.leader) return { ...st, q: Math.round(F.fairCartelMath().qCartel) };
    if (st.leader) return { ...st, q: Math.round((F.FAIR.A - c) / (2 * F.FAIR.B)) };
    return { ...st, q: Math.round(F.fairBR(today(st), c)) };
  },
  "наилучший ответ без вложений": (st) => {
    if (st.cartel && st.cartel.active && st.cartel.punish === 0) return { ...st, q: Math.round(F.fairCartelMath().qCartel) };
    return { ...st, q: Math.round(F.fairBR(today(st))) };
  },
  "наилучший ответ, но обманывает картель": (st) => ({ ...st, q: Math.round(F.fairBR(st.cartel && st.cartel.active && st.cartel.punish === 0 ? F.fairCartelMath().qCartel : today(st))) }),
  "всегда Курно на двоих (53)": (st) => ({ ...st, q: 53 }),
  "всегда монопольный объём (80)": (st) => ({ ...st, q: 80 }),
  "печёт мало (20)": (st) => ({ ...st, q: 20 }),
};

function play(fn, choice, seed) {
  const l1 = L.lavkaNewState(); l1.examBest = { eff: 0.9, medal: "silver", attempts: 1 };
  let st = F.levelFinish(l1, choice).fair, total = 0;
  const rng = L.lavkaRng(seed);
  for (let d = 0; d < DAYS; d++) { st = fn(st); const out = F.fairSimulate(st, rng); total += out.report.profit; st = out.next; }
  const r = F.FAIR.rate;
  const pvLeft = (st.subsidiaries || []).reduce((s, x) => s + x.dividend * (1 - (1 + r) ** -x.daysLeft) / r, 0);
  return { total, worth: st.cash + pvLeft, chapter: st.chapter, goals: Object.keys(st.goals).length };
}

const rows = [];
for (const [name, fn] of Object.entries(strategies)) for (const choice of ["sell", "keep"]) {
  let t = 0, w = 0, ch = 0, g = 0;
  for (let i = 0; i < RUNS; i++) { const o = play(fn, choice, 700 + i); t += o.total; w += o.worth; ch += o.chapter; g += o.goals; }
  rows.push({ стратегия: name, капитал: choice === "sell" ? "продать" : "дочка", "прибыль ярмарки": Math.round(t / RUNS),
    "стоимость к концу": Math.round(w / RUNS), "глава": (ch / RUNS).toFixed(1), "целей": (g / RUNS).toFixed(1) });
}
rows.sort((a, b) => b["стоимость к концу"] - a["стоимость к концу"]);
console.log(`Ярмарка: ${DAYS} дней, прогонов ${RUNS}; продажа лавки (серебро) = ${Math.round(F.fairSalePrice("silver"))} ₽`);
console.table(rows);
