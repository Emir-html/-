/* «Лавка» — чистая логика игры (без React). Снимок из econ-trainer__17_.jsx, блок «ПЕРЕРЫВ · ЛАВКА».
   В приложении этот код пока живёт внутри econ-trainer.jsx; этот файл — заготовка для выноса в src/games/lavka/model.js. */

/* Уютный тайкун с настоящей микроэкономикой. Отдельный раздел «Перерыв»:
   учебный материал не трогает, прогресс игры хранится в одном ключе
   "lavka-save" (правило слияния — более новая запись по полю at).

   Модель (всё линейное, чтобы MR = MC решалось в уме):
     спрос точки на товар   Q = A − B·P
     предельная выручка     MR = A/B − 2Q/B   ⇔  при цене P: MR = 2P − A/B
     предельные издержки    MC = закупка (+ акциз, если он есть)
     оптимум монополиста    P* = (A/B + MC)/2,  Q* = A − B·P*
     излишек потребителя    CS = S·(A/B − P) − S²/(2B)  (S — продано, рационирование эффективное)
     общий излишек          TS(S) = S·(A/B − c) − S²/(2B),  DWL = TS(Q_эфф) − TS(S),  Q_эфф = A − B·c
   Дуополия (событие «конкурент»): Q = 0,55·A − B·P + 0,5·B·Pк,
     наилучший ответ конкурента Pк = (0,55·A + 0,5·B·P + B·c)/(2B). */

const LAVKA_PRODUCTS = {
  lemonade:  { name: "Лимонад",   emoji: "🍋", unit: "стак.", a: 160, b: 2,   c: 20 },
  croissant: { name: "Круассан",  emoji: "🥐", unit: "шт.",   a: 200, b: 2.5, c: 30 },
  coffee:    { name: "Кофе",      emoji: "☕", unit: "чаш.",  a: 100, b: 0.5, c: 40, needs: "coffee" },
  icecream:  { name: "Мороженое", emoji: "🍦", unit: "шт.",   a: 180, b: 2,   c: 25, needs: "freezer" },
};
const LAVKA_PIDS = ["lemonade", "croissant", "coffee", "icecream"];

const LAVKA_POINTS = {
  main:   { name: "У парка",          emoji: "🌳", aMult: 1,    bMult: 1,    rent: 400 },
  office: { name: "У бизнес-центра",  emoji: "🏢", aMult: 0.85, bMult: 0.55, rent: 900 },
};
const LAVKA_CAPACITY = 120;       // покупателей в день на точку
const LAVKA_HELPER_CAP = 100;     // + от помощника
const LAVKA_HELPER_WAGE = 500;    // ₽/день на точку
const LAVKA_FRIDGE_KEEP = 0.8;

/* Ритм недели: день 1 — понедельник. Парк оживает в выходные, бизнес-центр пустеет —
   один и тот же календарь сдвигает спрос двух рынков в разные стороны. */
const LAVKA_WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const LAVKA_WEEK_MULT = {
  main:   [1, 1, 1, 1, 1.1, 1.3, 1.25],
  office: [1.05, 1.05, 1.05, 1.05, 1, 0.45, 0.4],
};
const lavkaWeekday = (day) => (day - 1) % 7;
/* Лояльность: дефицит сегодня — меньше покупателей завтра. Диапазон 80…110%. */
const LAVKA_REP_MIN = 0.8, LAVKA_REP_MAX = 1.1;

const LAVKA_UPGRADES = [
  { id: "analyst", emoji: "📓", title: "Тетрадь аналитика", cost: 2500,
    desc: "По твоим наблюдениям строит линию спроса, MR и MC и отмечает точку MR = MC.",
    lesson: "Спрос не дан свыше — его оценивают по данным «цена → сколько хотели купить». Берём только обычные дни: в дни событий кривая была другой." },
  { id: "coffee", emoji: "☕", title: "Кофемашина", cost: 5000,
    desc: "Открывает кофе: дорогая закупка, но спрос слабо реагирует на цену.",
    lesson: "Чем менее эластичен спрос в оптимуме, тем больше наценка: правило Лернера (P − MC)/P = 1/|E|." },
  { id: "fridge", emoji: "🧊", title: "Холодильник", cost: 4000,
    desc: "Непроданное больше не выбрасывается: 80% доживает до завтра.",
    lesson: "Порча — цена ошибки прогноза. Хранение удешевляет ошибку «закупил слишком много», поэтому закупать можно смелее." },
  { id: "helper", emoji: "🧑‍🍳", title: "Помощник за прилавком", cost: 6000,
    desc: "+100 покупателей в день к пропускной способности каждой точки. Зарплата 500 ₽/день за точку.",
    lesson: "Зарплата помощника — постоянные издержки: от Q они не зависят, поэтому оптимальную цену не меняют. Меняется только ограничение мощности." },
  { id: "sign", emoji: "🪧", title: "Яркая вывеска", cost: 7000,
    desc: "Спрос на всё +15%: кривая сдвигается вправо.",
    lesson: "Реклама — неценовой фактор: сдвиг спроса, а не движение вдоль него. Старые наблюдения в тетради стали неактуальны." },
  { id: "freezer", emoji: "🍦", title: "Морозильный ларь", cost: 9000,
    desc: "Открывает мороженое. Спрос сильно зависит от погоды.", lesson: "Неценовые факторы сдвигают спрос на разные товары в разные стороны — следи за прогнозом." },
  { id: "supplier", emoji: "🚚", title: "Оптовый поставщик", cost: 12000,
    desc: "Закупочная цена всех товаров −15%.",
    lesson: "MC упали на ΔMC — при линейном спросе оптимальная цена падает на ΔMC/2, объём растёт. Половина выгоды достаётся покупателям." },
  { id: "office", emoji: "🏢", title: "Вторая точка у бизнес-центра", cost: 30000,
    desc: "Новый рынок: клиенты менее чувствительны к цене. Аренда 900 ₽/день, свои цены и закупка.",
    lesson: "Ценовая дискриминация III степени: MC одинаковы, а MR₁ = MR₂ = MC. Где спрос менее эластичен, там цена выше." },
];

const lavkaRand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const LAVKA_EVENTS = {
  heat: {
    emoji: "☀️", title: "Жара +32°", days: [1, 2], weight: 3,
    text: () => "Весь город хочет холодного: лимонад и мороженое сметают, горячий кофе берут реже.",
    effect: (pid) => ({ lemonade: { aMult: 1.5 }, icecream: { aMult: 1.6 }, coffee: { aMult: 0.85 } })[pid],
    theory: () => "Погода — неценовой фактор: кривая спроса сдвигается целиком. При Q = A − B·P и постоянных MC оптимум P* = (A/B + MC)/2. Рост A в 1,5 раза поднимает резервную цену A/B в 1,5 раза, а P* — на половину этого прироста.",
  },
  rain: {
    emoji: "🌧", title: "Ливень весь день", days: [1, 2], weight: 3,
    text: () => "Прохожих меньше, холодное почти не берут, зато все греются кофе.",
    effect: (pid) => ({ lemonade: { aMult: 0.6 }, icecream: { aMult: 0.5 }, coffee: { aMult: 1.3 } })[pid],
    theory: () => "Один и тот же неценовой фактор сдвигает спрос на разные блага в разные стороны: на холодное — влево, на кофе — вправо. Оптимум пересчитывается по каждому товару отдельно.",
  },
  festival: {
    emoji: "🎪", title: "Городской фестиваль", days: [1, 1], weight: 2,
    text: () => "В парке фестиваль — покупателей на треть больше по всем товарам.",
    effect: () => ({ aMult: 1.3 }),
    theory: () => "Больше покупателей — спрос вправо (A ×1,3), наклон B прежний. При той же цене Q выросло, значит |E| = B·P/Q упала: спрос стал менее эластичным в каждой точке, и оптимальная цена растёт.",
  },
  flour: {
    emoji: "🌾", title: "Подорожала мука", days: [2, 3], weight: 2,
    text: () => "Пекарня подняла закупочную цену круассанов на 12 ₽.",
    effect: (pid) => (pid === "croissant" ? { cAdd: 12 } : null),
    theory: () => "Рост MC на 12 ₽. Условие MR = MC теперь выполняется при меньшем Q. При линейном спросе P* растёт ровно на ΔMC/2 = 6 ₽: половину удорожания платят покупатели, половину ты — из маржи. Переложить всё не выйдет: MR падает вдвое быстрее цены.",
  },
  blogger: {
    emoji: "📸", title: "Блогер похвалил круассаны", days: [2, 3], weight: 2,
    text: () => "Пришли фанаты: покупателей больше, и цена их почти не смущает.",
    effect: (pid) => (pid === "croissant" ? { aMult: 1.3, bMult: 0.75 } : null),
    theory: () => "Два эффекта: спрос вправо (A ×1,3) и спрос круче (B ×0,75) — лояльные покупатели меньше реагируют на цену. По правилу Лернера (P − MC)/P = 1/|E|: чем ниже эластичность в оптимуме, тем выше наценка.",
  },
  tax: {
    emoji: "🧾", title: "Акциз 10 ₽", days: [2, 3], weight: 2, needsProduct: true,
    text: (ev) => `Город ввёл акциз: 10 ₽ с каждой проданной единицы товара «${LAVKA_PRODUCTS[ev.product].name}». Платит продавец.`,
    effect: (pid, point, ev) => (pid === ev.product ? { tax: 10 } : null),
    theory: () => "Для продавца налог — рост MC на t. Монополист с линейным спросом поднимает цену на t/2 = 5 ₽: бремя делится поровну между покупателями и продавцом, хотя юридически платит продавец. Объём падает — растёт DWL.",
  },
  ceiling: {
    emoji: "📜", title: "Потолок цен", days: [2, 2], weight: 2, needsProduct: true,
    text: (ev) => `Мэрия: «${LAVKA_PRODUCTS[ev.product].name}» — не дороже ${ev.cap} ₽. Цена выше потолка автоматически срезается до него.`,
    effect: (pid, point, ev) => (pid === ev.product ? { cap: ev.cap } : null),
    theory: () => "Парадокс монополии: потолок между MC и монопольной ценой может увеличить объём. До объёма D(потолок) каждая следующая единица продаётся по одной и той же цене — MR горизонтальна и равна потолку, а это выше MC. Выгодно продать ровно D(потолок): объём больше монопольного, DWL меньше. Поставь цену на потолок и закупи больше.",
  },
  competitor: {
    emoji: "🏪", title: "Рядом открылась лавка «У Семёна»", days: [4, 4], weight: 2, needsProduct: true,
    text: (ev) => `Семён продаёт тот же товар «${LAVKA_PRODUCTS[ev.product].name}» у парка. Каждое утро он смотрит на твою вчерашнюю цену и выбирает свою.`,
    effect: (pid, point, ev) => (pid === ev.product && point === "main" ? { comp: true } : null),
    theory: () => "Дуополия Бертрана с дифференцированным товаром: твой спрос Q = 0,55·A − B·P + 0,5·B·Pк — растёт, если Семён дорожает. Он играет наилучший ответ Pк = (0,55·A + 0,5·B·P + B·c)/(2B). Если оба отвечают наилучшим образом, цены сходятся к равновесию Нэша P = (0,55·A + B·c)/(1,5·B) — ниже монопольной. Демпинг до MC невыгоден: товары не одинаковы, покупатели не уходят все сразу.",
  },
};

function lavkaUnlocked(st) {
  return LAVKA_PIDS.filter((pid) => !LAVKA_PRODUCTS[pid].needs || st.upgrades[LAVKA_PRODUCTS[pid].needs]);
}
function lavkaOpenPoints(st) {
  return st.upgrades.office ? ["main", "office"] : ["main"];
}

function lavkaDefaultSettings() {
  const d = { lemonade: [40, 50], croissant: [45, 50], coffee: [100, 30], icecream: [50, 40] };
  const one = () => Object.fromEntries(LAVKA_PIDS.map((p) => [p, { price: d[p][0], order: d[p][1] }]));
  return { main: one(), office: one() };
}

function lavkaNewState() {
  const empty = () => Object.fromEntries(LAVKA_PIDS.map((p) => [p, []]));
  return {
    v: 1, at: Date.now(), day: 1, cash: 2000, debt: 0,
    upgrades: {},
    settings: lavkaDefaultSettings(),
    stock: { main: {}, office: {} },
    event: null,
    obs: { main: empty(), office: empty() },
    history: [],
    last: null,
    goals: {},
    stats: { totalProfit: 0, bestDay: null, totalSold: 0 },
    rep: { main: 1, office: 1 },
    quiz: { lastDay: 0, right: 0, total: 0 },
    plusStreak: 0,
  };
}

/* Параметры рынка товара pid в точке point на сегодня (с учётом события). */
function lavkaParams(st, point, pid, ignoreEvent) {
  const pr = LAVKA_PRODUCTS[pid], pt = LAVKA_POINTS[point];
  const k = LAVKA_WEEK_MULT[point][lavkaWeekday(st.day)] * ((st.rep && st.rep[point]) || 1);
  let A = pr.a * pt.aMult * (st.upgrades.sign ? 1.15 : 1) * k;
  let B = pr.b * pt.bMult;
  let cBuy = pr.c * (st.upgrades.supplier ? 0.85 : 1);
  let tax = 0, cap = null, comp = null, base = true;
  const ev = ignoreEvent ? null : st.event;
  if (ev) {
    const eff = LAVKA_EVENTS[ev.id].effect(pid, point, ev);
    if (eff) {
      base = false;
      if (eff.aMult) A *= eff.aMult;
      if (eff.bMult) B *= eff.bMult;
      if (eff.cAdd) cBuy += eff.cAdd;
      if (eff.tax) tax = eff.tax;
      if (eff.cap != null) cap = eff.cap;
      if (eff.comp) { comp = ev.compPrice; A = 0.55 * A + 0.5 * B * comp; }
    }
  }
  const mc = cBuy + tax;
  let pOpt = (A / B + mc) / 2;
  if (cap != null && cap < pOpt && cap >= mc) pOpt = cap;
  const qOpt = Math.max(0, A - B * pOpt);
  return { A, B, cBuy, tax, mc, cap, comp, base, pOpt, qOpt, choke: A / B, k };
}

/* Наилучший ответ конкурента на нашу цену P (его MC = базовая закупка). */
function lavkaCompBR(st, pid, P) {
  const pr = LAVKA_PRODUCTS[pid];
  const { A, B } = lavkaParams(st, "main", pid, true);
  return Math.round((0.55 * A + 0.5 * B * P + B * pr.c) / (2 * B));
}

function lavkaTS(S, choke, c, B) { return S * (choke - c) - (S * S) / (2 * B); }

/* Один день торговли. Возвращает { next, report }. Чистая функция, кроме Math.random. */
function lavkaSimulate(st) {
  const points = lavkaOpenPoints(st), pids = lavkaUnlocked(st);
  const rows = [], tokens = [];
  let revenue = 0, buyCost = 0, taxPaid = 0, fixed = 0, sold = 0;
  const stock = { main: { ...st.stock.main }, office: { ...st.stock.office } };
  for (const point of points) {
    const cap = LAVKA_CAPACITY + (st.upgrades.helper ? LAVKA_HELPER_CAP : 0);
    fixed += LAVKA_POINTS[point].rent + (st.upgrades.helper ? LAVKA_HELPER_WAGE : 0);
    const pre = pids.map((pid) => {
      const m = lavkaParams(st, point, pid);
      const set = st.settings[point][pid];
      const P = m.cap != null ? Math.min(set.price, m.cap) : set.price;
      const dExp = Math.max(0, m.A - m.B * P);
      const D = Math.max(0, Math.round(dExp * (0.92 + Math.random() * 0.16)));
      const carried = stock[point][pid] || 0;
      const have = carried + set.order;
      return { pid, m, P, dExp, D, carried, order: set.order, have, wanted: Math.min(D, have) };
    });
    const wantedTotal = pre.reduce((s, r) => s + r.wanted, 0);
    const k = wantedTotal > cap ? cap / wantedTotal : 1;
    for (const r of pre) {
      const S = Math.floor(r.wanted * k);
      const lostStock = r.D - r.wanted, lostQueue = r.wanted - S;
      const left = r.have - S;
      const carry = st.upgrades.fridge ? Math.floor(left * LAVKA_FRIDGE_KEEP) : 0;
      const spoiled = left - carry;
      stock[point][r.pid] = carry;
      const rev = r.P * S, cost = r.m.cBuy * r.order, tx = r.m.tax * S;
      revenue += rev; buyCost += cost; taxPaid += tx; sold += S;
      const { A, B, cBuy, mc } = r.m;
      const choke = A / B;
      const cs = Math.max(0, S * (choke - r.P) - (S * S) / (2 * B));
      const qEff = Math.max(0, A - B * cBuy);
      const dwl = Math.max(0, lavkaTS(qEff, choke, cBuy, B) - lavkaTS(S, choke, cBuy, B));
      const mr = r.dExp > 0 ? 2 * r.P - choke : null;
      const el = r.dExp > 0 ? (B * r.P) / r.dExp : null;
      rows.push({
        point, pid: r.pid, P: r.P, priceSet: st.settings[point][r.pid].price, D: r.D, S, lostStock, lostQueue,
        carried: r.carried, order: r.order, have: r.have, carry, spoiled, rev, cost, tax: tx, cBuy, k: r.m.k,
        mr, mc, el, cs, ps: (r.P - mc) * S, dwl, pOpt: r.m.pOpt, qOpt: r.m.qOpt,
        cap: r.m.cap, comp: r.m.comp, base: r.m.base, capacityBound: k < 1,
      });
      for (let i = 0; i < S; i++) tokens.push({ pid: r.pid, point, ok: true, P: r.P });
      for (let i = 0; i < lostStock + lostQueue; i++) tokens.push({ pid: r.pid, point, ok: false });
    }
  }
  for (let i = tokens.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tokens[i], tokens[j]] = [tokens[j], tokens[i]]; }

  const profit = revenue - buyCost - taxPaid - fixed;
  let cash = st.cash + profit, debt = st.debt || 0, repaid = 0;
  if (debt > 0 && profit > 0) { repaid = Math.min(debt, Math.round(profit * 0.5), Math.max(0, cash)); debt -= repaid; cash -= repaid; }

  /* Наблюдения для тетради: цена → сколько хотели купить. */
  const obs = { main: { ...st.obs.main }, office: { ...st.obs.office } };
  for (const r of rows) {
    obs[r.point][r.pid] = [...(obs[r.point][r.pid] || []), { P: r.P, D: r.D, k: r.k, day: st.day, base: r.base }].slice(-30);
  }

  /* Лояльность по точкам: обслужил почти всех — растёт, многим не хватило — падает. */
  const repNew = { main: 1, office: 1, ...(st.rep || {}) }, repDelta = {};
  for (const point of points) {
    const pr = rows.filter((r) => r.point === point);
    const want = pr.reduce((s, r) => s + r.D, 0), lost = pr.reduce((s, r) => s + r.lostStock + r.lostQueue, 0);
    const share = want > 0 ? lost / want : 0;
    const old = repNew[point];
    const nv = share <= 0.03 ? old + 0.02 : old - 0.3 * share;
    repNew[point] = Math.round(Math.min(LAVKA_REP_MAX, Math.max(LAVKA_REP_MIN, nv)) * 1000) / 1000;
    repDelta[point] = { from: old, to: repNew[point], lostShare: share };
  }

  /* Цели. */
  const goals = { ...st.goals }, newGoals = [];
  const hit = (id) => { if (!goals[id]) { goals[id] = st.day; newGoals.push(id); } };
  if (profit > 0) hit("first");
  if (rows.length && rows.every((r) => r.mr != null && Math.abs(r.mr - r.mc) <= 3 && r.cap == null)) hit("mrmc");
  if (rows.some((r) => r.S > 0) && rows.every((r) => r.spoiled === 0 && r.lostStock === 0)) hit("exact");
  if (st.event?.id === "ceiling") {
    const r = rows.find((x) => x.pid === st.event.product && x.point === "main");
    const mono = lavkaParams(st, "main", st.event.product, true);
    if (r && r.S > mono.qOpt + 2) hit("ceiling");
  }
  if (points.length === 2) {
    for (const pid of pids) {
      const a = rows.find((r) => r.point === "main" && r.pid === pid), b = rows.find((r) => r.point === "office" && r.pid === pid);
      if (a && b && a.P !== b.P && a.cap == null && b.cap == null && a.comp == null && Math.abs(a.P - a.pOpt) <= 3 && Math.abs(b.P - b.pOpt) <= 3) hit("discr");
    }
  }
  let event = st.event ? { ...st.event } : null;
  if (event?.id === "competitor") event.warProfit = (event.warProfit || 0) + profit;
  if (cash >= 50000) hit("k50");
  if (points.some((p) => repNew[p] >= 1.05)) hit("rep105");
  const plusStreak = profit > 0 ? (st.plusStreak || 0) + 1 : 0;
  if (plusStreak >= 7) hit("week");
  if (st.day >= 30) hit("day30");

  /* Следующее утро: событие стареет, возможно, приходит новое. */
  const nextBase = { ...st, day: st.day + 1, rep: repNew };
  if (event) {
    event.daysLeft -= 1;
    if (event.daysLeft <= 0) {
      if (event.id === "competitor" && (event.warProfit || 0) > 0) hit("war");
      event = null;
    }
  }
  if (!event && st.day >= 2 && Math.random() < 0.45) event = lavkaRollEvent(nextBase);
  if (event?.id === "competitor") event.compPrice = lavkaCompBR(nextBase, event.product, st.settings.main[event.product].price);

  let reward = 0;
  for (const id of newGoals) reward += (LAVKA_GOALS.find((g) => g.id === id)?.reward || 0);
  cash += reward;

  const report = {
    day: st.day, rows, revenue, buyCost, taxPaid, fixed, profit, repaid, reward, newGoals,
    event: st.event, tokens, sold, repDelta, weekday: lavkaWeekday(st.day),
  };
  const stats = {
    totalProfit: (st.stats.totalProfit || 0) + profit,
    totalSold: (st.stats.totalSold || 0) + sold,
    bestDay: st.stats.bestDay == null || profit > st.stats.bestDay ? profit : st.stats.bestDay,
  };
  const next = {
    ...nextBase, at: Date.now(), cash: Math.round(cash), debt, stock, obs, goals, stats, event, rep: repNew, plusStreak,
    history: [...st.history, { day: st.day, profit: Math.round(profit) }].slice(-60),
    last: { ...report, tokens: undefined },
  };
  return { next, report };
}

function lavkaRollEvent(st) {
  const pids = lavkaUnlocked(st);
  const pool = [];
  for (const [id, e] of Object.entries(LAVKA_EVENTS)) for (let i = 0; i < e.weight; i++) pool.push(id);
  const id = lavkaRand(pool), def = LAVKA_EVENTS[id];
  const [d0, d1] = def.days;
  const ev = { id, daysLeft: d0 + Math.floor(Math.random() * (d1 - d0 + 1)) };
  if (def.needsProduct) ev.product = lavkaRand(pids);
  if (id === "ceiling") {
    const m = lavkaParams(st, "main", ev.product, true);
    ev.cap = Math.round(m.cBuy + 0.55 * (m.pOpt - m.cBuy));
  }
  return ev;
}

const LAVKA_GOALS = [
  { id: "first",   emoji: "🌱", title: "Первая прибыль",        desc: "Закончи день в плюсе.", reward: 300 },
  { id: "exact",   emoji: "🎯", title: "Точная закупка",        desc: "День без порчи и без покупателей, которым не хватило товара.", reward: 800 },
  { id: "mrmc",    emoji: "🧠", title: "Чуйка монополиста",     desc: "У всех товаров |MR − MC| ≤ 3 ₽ в один день (то же, что |P − P*| ≤ 1,5 ₽).", reward: 1500 },
  { id: "ceiling", emoji: "📜", title: "Парадокс потолка",      desc: "Во время потолка цен продай этого товара больше монопольного объёма.", reward: 2000 },
  { id: "war",     emoji: "⚔️", title: "Пережил Семёна",        desc: "Пройди визит конкурента с суммарной прибылью в плюсе.", reward: 2000 },
  { id: "discr",   emoji: "⚖️", title: "Дискриминация III степени", desc: "Один товар в двух точках по разным ценам, каждая в пределах 3 ₽ от своего оптимума.", reward: 3000 },
  { id: "rep105",  emoji: "💛", title: "Любимая лавка",          desc: "Подними лояльность любой точки до 105%: не оставляй людей без товара.", reward: 1500 },
  { id: "week",    emoji: "📈", title: "Неделя в плюсе",          desc: "7 дней подряд с прибылью.", reward: 2500 },
  { id: "quiz10",  emoji: "🎓", title: "Экономист у прилавка",    desc: "10 верных ответов на «Вопрос дня».", reward: 2000 },
  { id: "k50",     emoji: "💰", title: "Капитал 50 000 ₽",       desc: "Накопи 50 000 ₽ на счёте.", reward: 0 },
  { id: "day30",   emoji: "📅", title: "Месяц за прилавком",     desc: "Отработай 30 дней.", reward: 0 },
];

/* Вопрос дня: короткие задачи в духе ВП по тому, что происходит в лавке. */
const LAVKA_QUIZ = [
  { q: "Спрос Q = 100 − 2P, MC = 10 ₽. Какую цену выберет монополист?", opts: ["25 ₽", "30 ₽", "45 ₽"], a: 1,
    why: "MR = 50 − Q, MC = 10 → Q* = 40, P* = (100 − 40)/2 = 30 ₽. Проверка формулой: P* = (A/B + MC)/2 = (50 + 10)/2 = 30." },
  { q: "Монополист с линейным спросом и постоянными MC. Ввели налог t с единицы. Насколько вырастет цена?", opts: ["на t", "на t/2", "не изменится"], a: 1,
    why: "Налог сдвигает MC на t. P* = (A/B + MC + t)/2 — цена растёт на t/2, вторую половину налога несёт продавец." },
  { q: "Аренда лавки выросла вдвое. Что сделает оптимальная цена (если лавка не закрывается)?", opts: ["вырастет", "не изменится", "упадёт"], a: 1,
    why: "Аренда — постоянные издержки: от Q не зависят, MC и MR не меняют. Меняется только прибыль (и решение о закрытии в долгом периоде)." },
  { q: "В оптимуме монополиста с MC > 0 спрос по цене…", opts: ["эластичный, |E| > 1", "неэластичный, |E| < 1", "единичный, |E| = 1"], a: 0,
    why: "MR = P·(1 − 1/|E|). Раз MR = MC > 0, то 1 − 1/|E| > 0, то есть |E| > 1." },
  { q: "Правило Лернера: в оптимуме |E| = 4. Чему равна наценка (P − MC)/P?", opts: ["0,25", "0,4", "4"], a: 0,
    why: "(P − MC)/P = 1/|E| = 1/4 = 0,25. Чем эластичнее спрос, тем меньше рыночная власть." },
  { q: "Потолок цены установлен между MC и монопольной ценой. Что будет с объёмом продаж монополиста?", opts: ["упадёт", "вырастет", "не изменится"], a: 1,
    why: "До объёма D(потолок) MR горизонтальна и равна потолку > MC, поэтому выгодно продать больше, чем без потолка. DWL сокращается." },
  { q: "Ценовая дискриминация III степени при равных MC. Где цена выше?", opts: ["где спрос эластичнее", "где спрос менее эластичен", "везде одинакова"], a: 1,
    why: "MR₁ = MR₂ = MC и MR = P(1 − 1/|E|). При меньшей |E| множитель меньше, значит, P должна быть выше." },
  { q: "Выручка выросла после снижения цены. Спрос на этом участке…", opts: ["эластичный", "неэластичный", "абсолютно неэластичный"], a: 0,
    why: "При |E| > 1 объём растёт в процентах сильнее, чем падает цена, поэтому TR = P·Q растёт." },
  { q: "При какой эластичности линейного спроса выручка TR максимальна?", opts: ["|E| = 0", "|E| = 1", "|E| → ∞"], a: 1,
    why: "TR максимальна при MR = 0, а MR = P(1 − 1/|E|) = 0 ⇔ |E| = 1 — в середине линейной кривой спроса." },
  { q: "Жара увеличила число желающих купить лимонад при любой цене. Это…", opts: ["движение вдоль кривой спроса", "сдвиг кривой спроса вправо", "сдвиг предложения"], a: 1,
    why: "Изменился неценовой фактор (погода) — меняется вся функция Qd(P), кривая сдвигается." },
  { q: "Бертран: одинаковый товар, одинаковые MC = 20, две фирмы. Равновесная цена?", opts: ["20", "монопольная", "между ними"], a: 0,
    why: "Любая цена выше MC — повод сбить её на копейку и забрать весь рынок. Равновесие: P = MC (парадокс Бертрана). В лавке товар дифференцирован, поэтому цены выше MC." },
  { q: "Монополисту дали субсидию s за каждую проданную единицу (линейный спрос). Цена…", opts: ["упадёт на s", "упадёт на s/2", "не изменится"], a: 1,
    why: "Субсидия — отрицательный налог: MC падают на s, P* = (A/B + MC − s)/2, цена снижается на s/2." },
  { q: "Скоропорт: лишняя проданная единица даёт +30 ₽ маржи, выброшенная — −20 ₽. Какую долю дней спрос должен «покрываться» запасом?", opts: ["40%", "60%", "100%"], a: 1,
    why: "Задача газетчика: критическая доля = Cu/(Cu + Co) = 30/(30 + 20) = 0,6. Закупай столько, чтобы в 60% дней товара хватало." },
  { q: "Почему монополия создаёт DWL?", opts: ["MC растут быстрее", "P > MC: часть сделок, выгодных обеим сторонам, не происходит", "из-за налогов"], a: 1,
    why: "Покупатели между Q_монопольным и Q_эффективным ценят товар выше MC, но не покупают по цене P > MC. Эти несостоявшиеся сделки и есть DWL." },
  { q: "Спрос Q = 120 − 2P. Чему равна MR при Q = 40?", opts: ["40", "20", "0"], a: 1,
    why: "P = 60 − Q/2, TR = 60Q − Q²/2, MR = 60 − Q = 20. MR падает вдвое быстрее обратного спроса." },
];

const lavkaFmt = (n) => Math.round(n).toLocaleString("ru-RU");
const lavkaRub = (n) => `${n < 0 ? "−" : ""}${lavkaFmt(Math.abs(n))} ₽`;
const LAVKA_MONO = "'IBM Plex Mono', monospace";

/* МНК по обычным дням: D = α − β·P. */
function lavkaFit(list) {
  const pts = (list || []).filter((o) => o.base);
  if (pts.length < 3) return null;
  const n = pts.length;
  const dn = (o) => o.D / (o.k || 1); // спрос, приведённый к «обычному будню при лояльности 100%»
  const mp = pts.reduce((s, o) => s + o.P, 0) / n, md = pts.reduce((s, o) => s + dn(o), 0) / n;
  let sxy = 0, sxx = 0;
  for (const o of pts) { sxy += (o.P - mp) * (dn(o) - md); sxx += (o.P - mp) ** 2; }
  if (sxx < 1e-6) return null;
  const slope = sxy / sxx;
  if (slope >= 0) return null;
  const beta = -slope, alpha = md + beta * mp;
  return { alpha, beta, n };
}


export {
  LAVKA_PRODUCTS, LAVKA_PIDS, LAVKA_POINTS, LAVKA_CAPACITY, LAVKA_HELPER_CAP, LAVKA_HELPER_WAGE, LAVKA_FRIDGE_KEEP,
  LAVKA_WEEKDAYS, LAVKA_WEEK_MULT, lavkaWeekday, LAVKA_REP_MIN, LAVKA_REP_MAX,
  LAVKA_UPGRADES, LAVKA_EVENTS, LAVKA_GOALS, LAVKA_QUIZ,
  lavkaUnlocked, lavkaOpenPoints, lavkaDefaultSettings, lavkaNewState, lavkaParams, lavkaCompBR, lavkaTS,
  lavkaSimulate, lavkaRollEvent, lavkaFit, lavkaFmt, lavkaRub, LAVKA_MONO,
};
