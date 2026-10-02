/* Капитал «Пути компании» — общая финансовая математика переходов между уровнями (чистая логика, без React).
   Решения сценария (docs/scenario/ПАРАМЕТРЫ.md, П-26) с правками экономиста (docs/reviews/2026-10-02-scenario.md):
   - ставка r = 2% за игровой день (игровая условность: это тысячи процентов годовых);
   - бизнес уровня L после экзамена можно продать Плотникову или оставить дочкой;
   - дочка платит дивиденд D = s·e·π̄_эт: s — доля прибыли, которую дочка отдаёт владельцу без его участия,
     e — эффективность владельца на экзамене, π̄_эт — средняя дневная прибыль эталона на экзамене в его состоянии;
   - Плотников видит только медаль (рейтинг) и платит V = s·ē(медаль)·π̄_город·F: «рынок лимонов».
     π̄_город — средняя прибыль ПРОДАЮЩИХ бизнесов уровня (продают те, кому держать невыгодно, поэтому она ниже
     средней по всем; калибровка — неподвижная точка по ботам, см. capitalCityFixedPoint);
   - F — множитель потока: дивиденд идёт до конца игры (N дней), а в финале дочка продаётся вместе с холдингом
     за a(r, 30) дневных дивидендов. Поэтому F = a(r, N) + a(r, 30)/(1 + r)^N, одинаковый для «держать» и «продать». */

const CAPITAL = {
  rate: 0.02,
  share: 0.3,
  terminalDays: 30,
  /* Сколько игровых дней осталось до финала после экзамена уровня L: уровни 2–5 по 21 дню (экзамен дней не тратит). */
  horizon: { 1: 84, 2: 63, 3: 42, 4: 21 },
  /* Середины диапазонов эффективности по медалям — так Плотников оценивает продавца. */
  medalE: { gold: 0.975, silver: 0.9, bronze: 0.775 },
  /* Грант на старт уровня («Молодой предприниматель Кленовска»). */
  grant: { 2: 20000, 3: 30000, 4: 50000, 5: 0 },
};

/* Средняя дневная прибыль продающих бизнесов уровня L (₽/день) — неподвижная точка «рынка лимонов»
   (capitalCityFixedPoint) на ботах с e, равномерной внутри каждой медали, и π̄_эт уровня (матожидание экзамена):
   уровни 2–4 — 0,908·π̄_эт (6 621 / 5 091 / 14 736; у цеха π̄_эт — прибыль в обычных условиях после МРОТ). Плотников платит как за слабейшего продающего с такой медалью.
   Уровень 1 — π̄_эт зависит от состояния лавки; 2 600 ≈ 0,908 × медиана ботов в свежем состоянии (2 859) — до калибровки
   по реальным игрокам. Пересчёт: node src/games/lavka/capital-calibrate.js. */
const CITY_PROFIT = { 1: 2600, 2: 6013, 3: 4623, 4: 13381 };

const annuity = (N, r = CAPITAL.rate) => (N <= 0 ? 0 : r === 0 ? N : (1 - (1 + r) ** -N) / r);
/* PV одного рубля дивиденда в день: N дней до финала + продажа в финале за a(30). */
const capitalFactor = (level) => {
  const N = CAPITAL.horizon[level] || 0, r = CAPITAL.rate;
  return annuity(N) + annuity(CAPITAL.terminalDays) / (1 + r) ** N;
};
/* Дивиденд оставленной дочки (₽/день). */
const capitalDividend = (eff, piBot) => Math.max(0, CAPITAL.share * Math.max(0, eff || 0) * Math.max(0, piBot || 0));
/* Цена Плотникова по медали. */
const capitalSalePrice = (level, medal) =>
  CAPITAL.share * (CAPITAL.medalE[medal] || 0) * (CITY_PROFIT[level] || 0) * capitalFactor(level);
/* Сравнение: PV дивидендов против цены Плотникова — одна и та же ставка и горизонт. */
function capitalCompare(level, medal, eff, piBot) {
  const D = capitalDividend(eff, piBot), F = capitalFactor(level);
  const keepPV = D * F, sale = capitalSalePrice(level, medal);
  return { D, F, keepPV, sale, keepBetter: keepPV > sale };
}

/* «Рынок лимонов»: продают те, у кого e·π̄_эт < ē·π̄_город. Покупатель, знающий это, платит по средней
   прибыли продающих — неподвижная точка. samples — выборка [{ medal, eff, piBot }] (боты разной силы).
   Возвращает π̄_город, при которой средняя e·π̄_эт продающих с данной медалью совпадает с ē·π̄_город
   (в среднем по медалям); если не продаёт никто — минимум выборки. */
function capitalCityFixedPoint(samples, iters = 60) {
  const ok = samples.filter((x) => x.medal && x.piBot > 0);
  if (!ok.length) return 0;
  let city = ok.reduce((s, x) => s + x.piBot, 0) / ok.length;
  for (let i = 0; i < iters; i++) {
    const sellers = ok.filter((x) => x.eff * x.piBot <= CAPITAL.medalE[x.medal] * city + 1e-9);
    if (!sellers.length) return Math.min(...ok.map((x) => x.piBot));
    const next = sellers.reduce((s, x) => s + (x.eff * x.piBot) / CAPITAL.medalE[x.medal], 0) / sellers.length;
    if (Math.abs(next - city) < 1e-6) break;
    city = next;
  }
  return city;
}

/* Дочки: дневной дивиденд, пока daysLeft > 0. Общая функция для уровней 2–5. */
function capitalPayDividends(subsidiaries) {
  let dividend = 0;
  const next = (subsidiaries || []).map((s) => {
    if (s.daysLeft > 0) { dividend += s.dividend; return { ...s, daysLeft: s.daysLeft - 1 }; }
    return s;
  });
  return { dividend, subsidiaries: next };
}
/* Проценты на остаток (и на долг — тоже по r: игровой банк симметричен). */
const capitalInterest = (cash) => cash * CAPITAL.rate;

/* Переход с уровня L на L + 1 по итогам экзамена. examBest = { eff, medal, piBot }.
   Возвращает { cash, subsidiary|null, sale, D } или null, если медали нет. */
function capitalTransition(level, examBest, choice, name) {
  const medal = examBest && examBest.medal;
  if (!medal) return null;
  const sale = Math.round(capitalSalePrice(level, medal));
  const D = Math.round(capitalDividend(examBest.eff, examBest.piBot));
  const grant = CAPITAL.grant[level + 1] || 0;
  return {
    medal, sale, D, grant,
    cash: grant + (choice === "sell" ? sale : 0),
    subsidiary: choice === "keep" ? { name, level, medal, dividend: D, daysLeft: CAPITAL.horizon[level] } : null,
  };
}

export {
  CAPITAL, CITY_PROFIT, annuity, capitalFactor, capitalDividend, capitalSalePrice, capitalCompare,
  capitalCityFixedPoint, capitalPayDividends, capitalInterest, capitalTransition,
};
