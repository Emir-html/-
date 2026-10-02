/* Баланс «Своего производства» (уровень 4, цех «Заря»): node factory-balance.js
   Стратегии за 21 день: найм по дискретному оптимуму с разными решениями (котёл, договор Нины, письмо) и типичные ошибки.
   Итог — прирост кассы за уровень: прибыль, продажа котла, его цена, письмо, награды и проценты r = 2% на остаток
   (у покупки котла есть альтернативная стоимость — деньги в кассе приносили бы r). */
import * as P from "./factory.js";

const best = (st) => P.factoryBestL({ p: P.factoryPrice(st.day), floor: P.factoryFloor(st) });
const answer = (st, contract, letter) => {
  if (st.offer === "contract") st = P.factoryAnswer(st, "contract", contract);
  if (st.offer === "letter") st = P.factoryAnswer(st, "letter", letter);
  return st;
};
const strategies = {
  "оптимум, котёл на 8-й, без договора, без письма": (st) => { st = answer(st, false, false); if (st.day === 8) st = P.factoryBuyBoiler(st); return { ...st, L: best(st) }; },
  "оптимум, котёл на 1-й": (st) => { st = answer(st, false, false); if (st.day === 1) st = P.factoryBuyBoiler(st); return { ...st, L: best(st) }; },
  "оптимум, аренда котла": (st) => ({ ...answer(st, false, false), L: best(st) }),
  "оптимум + договор Нины": (st) => { st = answer(st, true, false); if (st.day === 8) st = P.factoryBuyBoiler(st); return { ...st, L: best(st) }; },
  "оптимум + письмо против МРОТ": (st) => { st = answer(st, false, true); if (st.day === 8) st = P.factoryBuyBoiler(st); return { ...st, L: best(st) }; },
  "оптимум, но после МРОТ держит 14": (st) => { st = answer(st, false, false); if (st.day === 8) st = P.factoryBuyBoiler(st); return { ...st, L: st.day >= 16 ? 14 : best(st) }; },
  "всегда 14": (st) => ({ ...answer(st, false, false), L: 14 }),
  "игнорирует MRC: MRP = w (18)": (st) => ({ ...answer(st, false, false), L: 18 }),
  "всегда 12 (как на старте)": (st) => ({ ...answer(st, false, false), L: 12 }),
};
function play(fn) {
  let st = P.factoryNewState(300000), total = 0;
  for (let d = 1; d <= P.FACTORY.levelDays; d++) { st = fn(st); const out = P.factorySimulate(st); total += out.report.profit + out.report.resale; st = out.next; }
  return { total: st.cash - 300000, goals: Object.keys(st.goals).length };
}
const rows = Object.entries(strategies).map(([name, fn]) => { const o = play(fn); return { стратегия: name, "прирост кассы": Math.round(o.total), целей: o.goals }; });
rows.sort((a, b) => b["прирост кассы"] - a["прирост кассы"]);
console.log("Цех «Заря»: 21 день (детерминированно — цена задана сетью).");
console.table(rows);
