/* Баланс «Ярмарки» (уровень 2, квас): node fair-balance.js [прогонов=40]
   Стратегии за 21 день ярмарки. Итог — прибыль ярмарки (без капитала) и касса к концу + выкуп бочки. */
import * as F from "./fair.js";
import * as L from "./model.js";

const RUNS = Number(process.argv[2] || 40);
const brQ = (st) => { // наилучший ответ (реальные стаканы) на объём соперников; лидер — объём лидера
  const k = F.fairK(st.day), cp = F.fairMC(st);
  if (st.leader) return Math.round(F.fairStackelberg(st.rivals.length, cp, F.fairRivalMC(st.day)).xL * k);
  if (F.fairInCartel(st)) return Math.round(F.fairCartelMath(cp, F.fairRivalMC(st.day)).qPlayer * k);
  return Math.round(F.fairBR(F.fairRivalX(st, 0) * st.rivals.length, cp) * k);
};
const cheatQ = (st) => Math.round(F.fairBR(F.fairRivalX(st, 0) * st.rivals.length, F.fairMC(st)) * F.fairK(st.day));

const strategies = {
  "наилучший ответ, отказ от сговора, бочка на 8-й": (st) => {
    if (st.offer) st = F.fairAnswerOffer(st, false);
    if (st.day === 8) st = F.fairBuy(st, "barrel");
    return { ...st, q: brQ(st) };
  },
  "то же + утренний прилавок на 11-й": (st) => {
    if (st.offer) st = F.fairAnswerOffer(st, false);
    if (st.day === 8) st = F.fairBuy(st, "barrel");
    if (st.day === 11) st = F.fairBuy(st, "leader");
    return { ...st, q: brQ(st) };
  },
  "только прилавок на 11-й": (st) => {
    if (st.offer) st = F.fairAnswerOffer(st, false);
    if (st.day === 11) st = F.fairBuy(st, "leader");
    return { ...st, q: brQ(st) };
  },
  "наилучший ответ, без вложений": (st) => { if (st.offer) st = F.fairAnswerOffer(st, false); return { ...st, q: brQ(st) }; },
  "сговор, держит квоту": (st) => { if (st.offer) st = F.fairAnswerOffer(st, true); return { ...st, q: brQ(st) }; },
  "сговор и обман": (st) => { if (st.offer) st = F.fairAnswerOffer(st, true); return { ...st, q: cheatQ(st) }; },
  "бочка поздно (15-й)": (st) => {
    if (st.offer) st = F.fairAnswerOffer(st, false);
    if (st.day === 15) st = F.fairBuy(st, "barrel");
    return { ...st, q: brQ(st) };
  },
  "всегда 400": (st) => ({ ...(st.offer ? F.fairAnswerOffer(st, false) : st), q: 400 }),
  "монопольный объём 800": (st) => ({ ...(st.offer ? F.fairAnswerOffer(st, false) : st), q: 800 }),
};

function play(fn, seed) {
  let st = F.fairNewState(200000), total = 0;
  const rng = L.lavkaRng(seed);
  for (let d = 1; d <= F.FAIR.levelDays; d++) {
    st = fn(st);
    const out = F.fairSimulate(st, rng);
    total += out.report.profit + out.report.salvage; st = out.next;
  }
  for (const u of F.FAIR_UPGRADES) if (st.upgrades && st.upgrades[u.id]) total -= u.cost;
  return { total, firms: st.rivals.length + 1, goals: Object.keys(st.goals).length, fined: st.flags && st.flags.fined ? 1 : 0 };
}

const rows = [];
for (const [name, fn] of Object.entries(strategies)) {
  let t = 0, n = 0, g = 0, fined = 0;
  for (let i = 0; i < RUNS; i++) { const o = play(fn, 700 + i); t += o.total; n += o.firms; g += o.goals; fined += o.fined; }
  rows.push({ стратегия: name, "прибыль ярмарки + выкуп − вложения": Math.round(t / RUNS), "продавцов к концу": (n / RUNS).toFixed(1),
    "целей": (g / RUNS).toFixed(1), "штрафов": `${fined}/${RUNS}` });
}
rows.sort((a, b) => b["прибыль ярмарки + выкуп − вложения"] - a["прибыль ярмарки + выкуп − вложения"]);
console.log(`Ярмарка: 21 день, прогонов ${RUNS}. Вложения учтены как расход в день покупки (касса), прибыль — по дням.`);
console.table(rows);
