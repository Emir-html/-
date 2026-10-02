/* Калибровка капитала «Пути компании»: node src/games/lavka/capital-calibrate.js
   π̄_эт уровней 2–4 (матожидание прибыли эталона на экзамене) и π̄_город — неподвижная точка «рынка лимонов»
   на ботах с эффективностью, равномерной внутри каждой медали. Результат переносится в CITY_PROFIT (capital.js)
   и CHAIN_EXAM_PI (chain.js). */
import * as C from "./chain.js";
import * as F from "./fair.js";
import * as P from "./factory.js";
import * as K from "./capital.js";

const E3 = (terrace) => {
  let s = 0, n = 0;
  for (let i = 1; i <= 60; i++) for (const d of C.chainExamNew({ ...C.chainNewState(), terrace }, 7919 * i).days) {
    const b = C.chainExamBest(d); s += C.chainOutcome(C.chainExamDD(d, b), b).profit; n++;
  }
  return s / n;
};
const samples = (pi) => {
  const out = [];
  for (const [m, lo, hi] of [["gold", 0.95, 1], ["silver", 0.85, 0.95], ["bronze", 0.7, 0.85]])
    for (let i = 0; i < 20; i++) out.push({ medal: m, eff: lo + ((hi - lo) * (i + 0.5)) / 20, piBot: pi });
  return out;
};
const pis = { 2: F.fairExamExpectedProfit({ ...F.fairNewState(), day: 22, chapter: 3 }), 3: E3(false), "3 (терраса)": E3(true), 4: P.factoryExamExpectedProfit() };
const rows = Object.entries(pis).map(([L, pi]) => ({ уровень: L, "π̄_эт": Math.round(pi), "π̄_город": Math.round(K.capitalCityFixedPoint(samples(pi))),
  "в capital.js": K.CITY_PROFIT[parseInt(L, 10)] }));
console.table(rows);
