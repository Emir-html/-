/* «Лавка» — чистая логика игры (без React). Единственный источник: App.jsx импортирует экраны из ./ui.jsx,
   а они — логику отсюда. Тесты: model.test.js, баланс: balance.js (npm test, npm run balance -- 40 20). */

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
const LAVKA_SIGN_MULT = 1.15;     // вывеска: покупателей на 15% больше
/* Версия экономической модели в сохранении. 2 — «больше покупателей» = k·(A − B·P) (1 октября 2026). */
const LAVKA_MODEL_VERSION = 2;

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
    lesson: "Зарплата помощника — постоянные издержки: от Q они не зависят и сами по себе P* не меняют. Но помощник расширяет мощность: если прилавок был узким местом, теневая цена места λ падает, и выгодная цена (MR = MC + λ) снижается." },
  { id: "sign", emoji: "🪧", title: "Яркая вывеска", cost: 7000,
    desc: "Покупателей на 15% больше: при любой цене спрос ×1,15 — кривая сдвигается вправо.",
    lesson: "Реклама — неценовой фактор: сдвиг спроса, а не движение вдоль него. Пришло больше таких же покупателей — резервная цена и эластичность при каждой цене прежние, поэтому P* не меняется, растёт объём. Если прилавок и так полон, вывеска поднимет теневую цену места — и выгодную цену." },
  { id: "freezer", emoji: "🍦", title: "Морозильный ларь", cost: 9000,
    desc: "Открывает мороженое. Спрос сильно зависит от погоды.", lesson: "Неценовые факторы сдвигают спрос на разные товары в разные стороны — следи за прогнозом." },
  { id: "supplier", emoji: "🚚", title: "Оптовый поставщик", cost: 12000,
    desc: "Закупочная цена всех товаров −15%.",
    lesson: "MC упали на ΔMC — при линейном спросе и свободном прилавке оптимальная цена падает на ΔMC/2, объём растёт, половина выгоды достаётся покупателям. Если прилавок — узкое место, цена падает меньше: выгода уходит в теневую цену места λ." },
  { id: "office", emoji: "🏢", title: "Вторая точка у бизнес-центра", cost: 30000,
    desc: "Новый рынок: клиенты менее чувствительны к цене. Аренда 900 ₽/день, свои цены и закупка.",
    lesson: "Ценовая дискриминация III степени: рынки разделены (перепродать товар из одной точки в другую нельзя), MC одинаковы, а MR₁ = MR₂ = MC (если у точки полон прилавок — MRᵢ = MC + λᵢ). Где спрос менее эластичен, там цена выше." },
];

/* Главы уровня 1: механики открываются, когда прошла неделя И выполнена ключевая цель прошлой главы.
   «Оракул» (вердикт по истинным параметрам) — только первые LAVKA_ORACLE_DAYS дней. */
const LAVKA_CHAPTERS = [
  { n: 1, title: "Спрос", fromDay: 1, goal: "mrmc", fallback: { fromDay: 14, streak: 3 },
    events: ["heat", "rain", "festival"], upgrades: ["analyst", "fridge", "helper"] },
  { n: 2, title: "Издержки и налоги", fromDay: 8, goal: "week",
    events: ["flour", "tax", "blogger"], upgrades: ["sign", "supplier", "coffee"] },
  { n: 3, title: "Регулирование и рынки", fromDay: 15, goal: null,
    events: ["ceiling", "competitor"], upgrades: ["freezer", "office"] },
];
const LAVKA_ORACLE_DAYS = 7;
const lavkaChapterOf = (kind, id) => (LAVKA_CHAPTERS.find((c) => c[kind].includes(id)) || LAVKA_CHAPTERS[0]).n;
/* Улучшение доступно, если его глава открыта; купленное раньше остаётся навсегда. */
const lavkaUpgradeOpen = (st, u) => !!st.upgrades[u.id] || lavkaChapterOf("upgrades", u.id) <= (st.chapter || 1);
/* Старое сохранение без глав: глава по номеру дня, чтобы ничего не отнять. */
const lavkaChapterByDay = (day) => [...LAVKA_CHAPTERS].reverse().find((c) => day >= c.fromDay).n;

const lavkaRand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const LAVKA_EVENTS = {
  heat: {
    emoji: "☀️", title: "Жара +32°", days: [1, 2], weight: 3,
    text: () => "Весь город хочет холодного: лимонад и мороженое сметают, горячий кофе берут реже.",
    effect: (pid) => ({ lemonade: { aMult: 1.5 }, icecream: { aMult: 1.6 }, coffee: { aMult: 0.85 } })[pid],
    theory: () => "Погода — неценовой фактор: кривая спроса сдвигается целиком. При Q = A − B·P и постоянных MC оптимум P* = (A/B + MC)/2. Рост A в 1,5 раза поднимает резервную цену A/B в 1,5 раза, а P* — на половину этого прироста (если прилавок не узкое место; иначе растёт и теневая цена места λ).",
  },
  rain: {
    emoji: "🌧", title: "Ливень весь день", days: [1, 2], weight: 3,
    text: () => "Холодного почти не хочется, зато все греются кофе.",
    effect: (pid) => ({ lemonade: { aMult: 0.6 }, icecream: { aMult: 0.5 }, coffee: { aMult: 1.3 } })[pid],
    theory: () => "Один и тот же неценовой фактор сдвигает спрос на разные блага в разные стороны: на холодное — влево, на кофе — вправо. Оптимум пересчитывается по каждому товару отдельно.",
  },
  festival: {
    emoji: "🎪", title: "Городской фестиваль", days: [1, 1], weight: 2,
    text: () => "В парке фестиваль — покупателей на треть больше по всем товарам.",
    effect: () => ({ nMult: 1.3 }),
    theory: () => "Пришло больше таких же покупателей: рыночный спрос — сумма индивидуальных, Q = 1,3·(A − B·P). Кривая сдвигается вправо, но резервная цена A/B и эластичность при каждой цене прежние — значит, P* = (A/B + MC)/2 не меняется, растёт только объём. Если же прилавок не справится с потоком, появится теневая цена места λ — и выгодная цена поднимется (MR = MC + λ).",
  },
  flour: {
    emoji: "🌾", title: "Подорожала мука", days: [2, 3], weight: 2,
    text: () => "Пекарня подняла закупочную цену круассанов на 12 ₽.",
    effect: (pid) => (pid === "croissant" ? { cAdd: 12 } : null),
    theory: () => "Рост MC на 12 ₽. Условие MR = MC теперь выполняется при меньшем Q. При линейном спросе и свободном прилавке (λ = 0) P* растёт ровно на ΔMC/2 = 6 ₽: половину удорожания платят покупатели, половину ты — из маржи. Переложить всё не выйдет: MR падает вдвое быстрее цены. Если прилавок полон, места освобождаются для других товаров, λ падает — и цена круассана растёт меньше чем на 6 ₽.",
  },
  blogger: {
    emoji: "📸", title: "Блогер похвалил круассаны", days: [2, 3], weight: 2,
    text: () => "Пришли фанаты: они готовы платить больше, и цена их почти не смущает.",
    effect: (pid) => (pid === "croissant" ? { aMult: 1.3, bMult: 0.75 } : null),
    theory: () => "Два эффекта: каждый покупатель готов платить больше (A ×1,3) и меньше реагирует на цену (B ×0,75) — резервная цена A/B растёт в 1,73 раза. По правилу Лернера (P − MC)/P = 1/|E|: чем ниже эластичность в оптимуме, тем выше наценка.",
  },
  tax: {
    emoji: "🧾", title: "Акциз 10 ₽", days: [2, 3], weight: 2, needsProduct: true,
    text: (ev) => `Город ввёл акциз: 10 ₽ с каждой проданной единицы товара «${LAVKA_PRODUCTS[ev.product].name}». Платит продавец.`,
    effect: (pid, point, ev) => (pid === ev.product ? { tax: 10 } : null),
    theory: () => "Для продавца налог — рост MC на t. Монополист с линейным спросом и свободным прилавком (λ = 0) поднимает цену на t/2 = 5 ₽: бремя делится поровну между покупателями и продавцом, хотя юридически платит продавец. Если прилавок полон, перенос меньше половины: часть налога «съедает» теневая цена места. Объём падает — растёт DWL.",
  },
  ceiling: {
    emoji: "📜", title: "Потолок цен", days: [2, 2], weight: 2, needsProduct: true,
    text: (ev) => `Мэрия: «${LAVKA_PRODUCTS[ev.product].name}» — не дороже ${ev.cap} ₽. Цена выше потолка автоматически срезается до него.`,
    effect: (pid, point, ev) => (pid === ev.product ? { cap: ev.cap } : null),
    theory: () => "Парадокс монополии: потолок между MC и монопольной ценой может увеличить объём. До объёма D(потолок) каждая следующая единица продаётся по одной и той же цене — MR горизонтальна и равна потолку, а это выше MC. Выгодно продать ровно D(потолок): объём больше монопольного, DWL меньше. Оговорка: если прилавок полон, место стоит λ, и потолок выгоден только пока он выше MC + λ — тогда товар занимает лишь свободные места. Если прилавок свободен — поставь цену на потолок и закупи больше.",
  },
  competitor: {
    emoji: "🏪", title: "Рядом открылась лавка «У Семёна»", days: [4, 4], weight: 2, needsProduct: true,
    text: (ev) => `Семён продаёт тот же товар «${LAVKA_PRODUCTS[ev.product].name}» у парка. Каждое утро он смотрит на твою вчерашнюю цену и выбирает свою.`,
    effect: (pid, point, ev) => (pid === ev.product && point === "main" ? { comp: true } : null),
    theory: () => "Дуополия Бертрана с дифференцированным товаром: твой спрос Q = 0,55·A − B·P + 0,5·B·Pк — растёт, если Семён дорожает. Он играет наилучший ответ Pк = (0,55·A + 0,5·B·P + B·c)/(2B). Семён отвечает на твою вчерашнюю цену, его MC — базовая закупка c. Если оба раз за разом отвечают наилучшим образом, цены сходятся к равновесию Нэша P = (0,55·A + B·c)/(1,5·B) — ниже монопольной (без учёта мощности; при полном прилавке твоя лучшая цена выше). Демпинг до MC невыгоден: товары не одинаковы, покупатели не уходят все сразу.",
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
    v: 1, model: LAVKA_MODEL_VERSION, at: Date.now(), day: 1, chapter: 1, cash: 2000, debt: 0,
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
  /* k — во сколько раз больше покупателей, чем в обычный будний день при лояльности 100%:
     день недели × лояльность × вывеска (× фестиваль ниже). Каждый покупатель тот же, поэтому спрос
     складывается по горизонтали: Q = k·(a − b·P) — растут и A, и B, резервная цена A/B и P* не меняются. */
  let k = LAVKA_WEEK_MULT[point][lavkaWeekday(st.day)] * ((st.rep && st.rep[point]) || 1) * (st.upgrades.sign ? LAVKA_SIGN_MULT : 1);
  let A = pr.a * pt.aMult * k;
  let B = pr.b * pt.bMult * k;
  let cBuy = pr.c * (st.upgrades.supplier ? 0.85 : 1);
  let tax = 0, cap = null, comp = null, base = true;
  const ev = ignoreEvent ? null : st.event;
  if (ev) {
    const eff = LAVKA_EVENTS[ev.id].effect(pid, point, ev);
    if (eff) {
      /* Наблюдение «чистое», если событие не меняет кривую одного покупателя: налог и мука меняют MC,
         потолок — цену, фестиваль — только число покупателей (учтено в k). */
      if (eff.aMult || eff.bMult || eff.comp) base = false;
      if (eff.nMult) { A *= eff.nMult; B *= eff.nMult; k *= eff.nMult; }
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

/* Оптимум точки с учётом мощности прилавка. Каждое место у прилавка можно отдать одному покупателю
   любого товара, поэтому максимизируем Σ(Pᵢ − MCᵢ)·Qᵢ при ΣQᵢ ≤ мощность. Условие оптимума:
   MRᵢ = MCᵢ + λ, где λ ≥ 0 — теневая цена места (λ = 0, если мощность не ограничивает).
   При линейном спросе Pᵢ = (Aᵢ/Bᵢ + MCᵢ + λ)/2. Товар с потолком цены продаётся по потолку,
   если потолок ≥ MC + λ, иначе место выгоднее отдать другим товарам. λ ищем бисекцией. */
function lavkaPlan(st, point) {
  const capacity = LAVKA_CAPACITY + (st.upgrades.helper ? LAVKA_HELPER_CAP : 0);
  const pids = lavkaUnlocked(st);
  const ms = Object.fromEntries(pids.map((pid) => [pid, lavkaParams(st, point, pid)]));
  const at = (lam) => {
    const rows = {};
    for (const pid of pids) {
      const m = ms[pid];
      let p = (m.A / m.B + m.mc + lam) / 2, q;
      if (m.cap != null && m.cap < p) { p = m.cap; q = m.cap >= m.mc + lam ? Math.max(0, m.A - m.B * m.cap) : 0; }
      else q = Math.max(0, m.A - m.B * p);
      rows[pid] = { pOpt: p, qOpt: q };
    }
    return rows;
  };
  const total = (rows) => Object.values(rows).reduce((sum, r) => sum + r.qOpt, 0);
  let rows = at(0), lambda = 0;
  if (total(rows) > capacity) {
    let lo = 0, hi = Math.max(...pids.map((pid) => ms[pid].A / ms[pid].B));
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (total(at(mid)) > capacity) lo = mid; else hi = mid; }
    lambda = hi; rows = at(hi);
    /* Товар с потолком при λ ≈ потолок − MC продаётся частично — добираем остаток мощности. */
    let rest = capacity - total(rows);
    for (const pid of pids) {
      const m = ms[pid];
      if (rest > 1e-9 && m.cap != null && rows[pid].qOpt === 0 && Math.abs(m.cap - m.mc - lambda) < 1e-3) {
        const add = Math.min(rest, Math.max(0, m.A - m.B * m.cap));
        rows[pid] = { pOpt: m.cap, qOpt: add }; rest -= add;
      }
    }
  }
  return { capacity, lambda, rows };
}

/* λ, которую видит игрок: меньше 2 ₽ — место почти ничего не стоит, считаем 0 (вердикт, строка «вчера», цель). */
const LAVKA_LAMBDA_SHOWN = 2;
const lavkaShownLambda = (lam) => ((lam || 0) >= LAVKA_LAMBDA_SHOWN ? lam : 0);

/* Потолок увеличивает выгодный объём (парадокс монополии) только если он выше MC + λ без потолка. */
function lavkaCeilingParadox(st) {
  const ev = st.event;
  if (!ev || ev.id !== "ceiling") return false;
  const withCap = lavkaPlan(st, "main").rows[ev.product].qOpt;
  const noCap = lavkaPlan({ ...st, event: null }, "main").rows[ev.product].qOpt;
  return withCap > noCap + 2;
}

/* Вердикт отчёта по товару: что говорит теория о вчерашнем решении. Чистая функция строки отчёта. */
function lavkaVerdict(r) {
  const mode = r.mode || "oracle"; // старые отчёты в сохранении — без режима
  if (mode === "facts") return lavkaFactsVerdict(r);
  if (r.mr == null) return "Спроса при такой цене нет совсем: цена выше резервной цены всех покупателей.";
  if (mode === "notebook") return lavkaNotebookVerdict(r);
  const lam = lavkaShownLambda(r.lambda), narrow = lam > 0;
  const buyers = lavkaBuyers;
  const target = r.mc + (narrow ? lam : 0);
  const rhs = narrow ? `MC + λ = ${r.mc.toFixed(0)} + ${lam.toFixed(0)} = ${target.toFixed(0)} ₽` : `MC = ${r.mc.toFixed(0)} ₽`;
  if (r.cap != null && r.P >= r.cap) {
    const rawLam = r.lambda || 0;
    if (rawLam > 0 && Math.abs(r.cap - r.mc - rawLam) < 0.5) {
      const q = Math.round(r.qBest ?? 0);
      return `Цена стоит на потолке ${r.cap} ₽, и потолок ровно окупает место у прилавка: MR = ${r.cap} ₽ = MC + λ = ${r.mc.toFixed(0)} + ${rawLam.toFixed(0)} ₽. ` +
        (r.dExp != null && q < r.dExp - 1
          ? `Этот товар выгоден, пока у прилавка есть свободные места после других: закупай около ${q} шт., а не весь спрос при потолке.`
          : `Места хватает на весь спрос при потолке: закупай около ${q} шт.`);
    }
    return r.cap >= target
      ? `Цена стоит на потолке ${r.cap} ₽. До объёма D(потолок) каждая единица приносит ровно потолок: MR = ${r.cap} ₽ ≥ ${rhs}. Цену поднять нельзя — продавай всё, что спрашивают: закупай под D(потолок).`
      : `Цена стоит на потолке ${r.cap} ₽, а место у прилавка дороже: MR = ${r.cap} ₽ < ${rhs}. Отдай места другим товарам — закупай этого меньше.`;
  }
  const d = r.mr - target;
  const mr = `MR = ${r.mr.toFixed(0)} ₽`;
  if (r.lostStock > 0) {
    return `Товар кончился: ${buyers(r.lostStock)} без покупки. Сначала закупка — при цене ${r.P} ₽ спрос был ${r.D}, а не ${r.S}. ` +
      (Math.abs(d) <= 3 ? `Цена при этом почти верная: ${mr} ≈ ${rhs}.` : d > 0 ? `${mr} > ${rhs}: цену можно снизить, но только вместе с закупкой.` : `${mr} < ${rhs}: цену стоит поднять.`);
  }
  if (Math.abs(d) <= 3) {
    return narrow
      ? `${mr} ≈ ${rhs}. Прилавок — узкое место, и с учётом теневой цены места λ цена почти идеальна.`
      : `${mr} ≈ ${rhs} — цена почти идеальна.`;
  }
  if (d > 0) {
    if (r.lostQueue > 0) return `${mr} > ${rhs}, но ${buyers(r.lostQueue)} из очереди: прилавок не успевает. Снижение цены лишь удлинит очередь — сначала нужна мощность (помощник) или места, освобождённые от других товаров.`;
    return narrow
      ? `${mr} > ${rhs}: даже с учётом цены места следующая единица выгодна. Снизь цену — продашь больше.`
      : `${mr} > ${rhs}: следующая единица приносит больше, чем стоит. Снизь цену — продашь больше.`;
  }
  return narrow
    ? `${mr} < ${rhs}: место у прилавка стоит λ ≈ ${lam.toFixed(0)} ₽, а последние единицы его не окупают. Подними цену.`
    : `${mr} < ${rhs}: последние единицы продавались себе в убыток. Подними цену.`;
}

const lavkaBuyers = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "покупатель ушёл" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "покупателя ушли" : "покупателей ушли"}`;

/* После первой недели без тетради: только то, что игрок видел своими глазами. */
function lavkaFactsVerdict(r) {
  const facts = [`продано ${r.S} из ${r.D} желающих`];
  if (r.lostStock > 0) facts.push(`товар кончился — ${lavkaBuyers(r.lostStock)} без покупки`);
  if (r.lostQueue > 0) facts.push(`${lavkaBuyers(r.lostQueue)} из очереди`);
  if (r.spoiled > 0) facts.push(`выброшено ${r.spoiled}`);
  const hint = r.why === "event"
    ? "Сегодня событие изменило саму кривую спроса — тетрадь её не знает, поэтому MR не оцениваем."
    : r.why === "few-obs"
      ? "Для оценки MR тетради нужно хотя бы 3 обычных дня с разными ценами."
      : r.why === "flat"
        ? "Обычных дней в тетради хватает, но цены в них слишком близки — наклон спроса не виден. Разнеси цены сильнее (на 5–10 ₽)."
      : "Подсказки «оракула» были только в первую неделю. Чтобы оценивать MR, нужна тетрадь аналитика и 3 обычных дня с разными ценами.";
  return `Факты дня: ${facts.join(", ")}. ${hint}`;
}

/* Вердикт по оценке спроса из тетради: MR = 2P − α/β. Теневую цену места игрок не знает —
   при очереди только напоминаем, что место у прилавка тоже стоит денег. */
function lavkaNotebookVerdict(r) {
  const d = r.mr - r.mc;
  const mr = `по тетради MR ≈ ${r.mr.toFixed(0)} ₽`, mc = `MC = ${r.mc.toFixed(0)} ₽`;
  if (r.cap != null && r.P >= r.cap) return `Цена стоит на потолке ${r.cap} ₽: до объёма D(потолок) каждая единица приносит потолок, ${r.cap >= r.mc ? "это выше" : "это ниже"} ${mc}. Оцени по тетради D(потолок) и сколько мест у прилавка останется после других товаров.`;
  if (r.lostStock > 0) return `Товар кончился: ${lavkaBuyers(r.lostStock)} без покупки. Сначала закупка — спрос при ${r.P} ₽ был ${r.D}. Цена: ${mr}, ${mc}.`;
  const full = `прилавок был полон (${lavkaBuyers(r.lostQueue)} из очереди)`;
  const placeRule = "пока прилавок полон, место тоже стоит денег: MR = MC + цена места > MC";
  if (r.lostQueue > 0) {
    if (Math.abs(d) <= 3) return `${mr} ≈ ${mc}, но ${full}. А ${placeRule} — подними цену, освободишь место под другой товар.`;
    if (d > 0) return `${mr} > ${mc}, но ${full}. Снизишь цену — этот товар займёт места других, а выручка с места упадёт: ${placeRule}.`;
    return `${mr} < ${mc}: подними цену — и прибыль вырастет, и место освободится (${full}).`;
  }
  if (Math.abs(d) <= 3) return `${mr} ≈ ${mc} — по твоей оценке спроса цена близка к оптимуму.`;
  if (d > 0) return `${mr} > ${mc}: по оценке тетради следующая единица выгодна — снизь цену и закупи больше.`;
  return `${mr} < ${mc}: по оценке тетради последние единицы продавались себе в убыток — подними цену.`;
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
    const plan = lavkaPlan(st, point), cap = plan.capacity;
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
      const { cBuy, mc } = r.m;
      const metrics = (A, B) => {
        const choke = A / B, dExp = Math.max(0, A - B * r.P);
        const qEff = Math.max(0, A - B * cBuy);
        return {
          mr: dExp > 0 ? 2 * r.P - choke : null,
          el: dExp > 0 ? (B * r.P) / dExp : null,
          cs: Math.max(0, S * (choke - r.P) - (S * S) / (2 * B)),
          dwl: Math.max(0, lavkaTS(qEff, choke, cBuy, B) - lavkaTS(S, choke, cBuy, B)),
        };
      };
      const truth = metrics(r.m.A, r.m.B);
      /* Что видит игрок: первую неделю — истину («оракул»), потом — оценку своей тетради
         (только в обычный день и если в ней ≥ 3 обычных дней), иначе — только факты. */
      const fs = st.upgrades.analyst && r.m.base ? lavkaFitStatus(st.obs[point]?.[r.pid]) : { fit: null, reason: null };
      const fit = fs.fit;
      const mode = st.day <= LAVKA_ORACLE_DAYS ? "oracle" : fit ? "notebook" : "facts";
      const shown = mode === "oracle" ? truth
        : mode === "notebook" ? metrics(fit.alpha * r.m.k, fit.beta * r.m.k)
        : { mr: null, el: null, cs: null, dwl: null };
      const why = mode !== "facts" ? null : !st.upgrades.analyst ? "no-notebook" : !r.m.base ? "event" : fs.reason === "flat" ? "flat" : "few-obs";
      const { mr, el, cs, dwl } = shown;
      rows.push({
        point, pid: r.pid, P: r.P, priceSet: st.settings[point][r.pid].price, D: r.D, S, lostStock, lostQueue,
        carried: r.carried, order: r.order, have: r.have, carry, spoiled, rev, cost, tax: tx, cBuy, k: r.m.k,
        mr, mc, el, dExp: r.dExp, cs, ps: (r.P - mc) * S, dwl, pOpt: r.m.pOpt, qOpt: r.m.qOpt,
        mode, why, mrTrue: truth.mr,
        cap: r.m.cap, comp: r.m.comp, base: r.m.base, capacityBound: k < 1,
        lambda: plan.lambda, pBest: plan.rows[r.pid].pOpt, qBest: plan.rows[r.pid].qOpt,
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
  if (rows.length && rows.every((r) => r.mrTrue != null && Math.abs(r.mrTrue - r.mc - lavkaShownLambda(r.lambda)) <= 3 && r.cap == null && r.lostStock === 0)) hit("mrmc");
  if (rows.some((r) => r.S > 0) && rows.every((r) => r.spoiled === 0 && r.lostStock === 0)) hit("exact");
  if (st.event?.id === "ceiling") {
    const r = rows.find((x) => x.pid === st.event.product && x.point === "main");
    const noCap = lavkaPlan({ ...st, event: null }, "main").rows[st.event.product].qOpt;
    if (r && lavkaCeilingParadox(st) && r.S > noCap + 2) hit("ceiling");
  }
  if (points.length === 2) {
    for (const pid of pids) {
      const a = rows.find((r) => r.point === "main" && r.pid === pid), b = rows.find((r) => r.point === "office" && r.pid === pid);
      if (a && b && a.P !== b.P && a.cap == null && b.cap == null && a.comp == null && Math.abs(a.P - a.pBest) <= 3 && Math.abs(b.P - b.pBest) <= 3) hit("discr");
    }
  }
  let event = st.event ? { ...st.event } : null;
  if (event?.id === "competitor") event.warProfit = (event.warProfit || 0) + profit;
  if (cash >= 50000) hit("k50");
  if (points.some((p) => repNew[p] >= 1.05)) hit("rep105");
  const plusStreak = profit > 0 ? (st.plusStreak || 0) + 1 : 0;
  if (plusStreak >= 7) hit("week");
  if (st.day >= 30) hit("day30");

  /* Что мешает ключевой цели главы 1. Цель судится по истинному спросу, поэтому и подсказка — по нему
     (без чисел); после 7-го дня тетрадь даёт лишь оценку, и это сказано прямо. */
  let chapterHint = null;
  if ((st.chapter || 1) === 1 && !goals.mrmc) {
    const why = [];
    for (const r of rows) {
      const nm = `«${LAVKA_PRODUCTS[r.pid].name}»`;
      if (r.lostStock > 0) why.push(`${nm}: товар кончился`);
      else if (r.cap != null) why.push(`${nm}: действует потолок`);
      else if (r.mrTrue == null || Math.abs(r.mrTrue - r.mc - lavkaShownLambda(r.lambda)) > 3) why.push(`${nm}: по истинному спросу цена ещё не там, где MR = MC${lavkaShownLambda(r.lambda) > 0 ? " + λ" : ""}${st.day > LAVKA_ORACLE_DAYS ? " (тетрадь даёт лишь оценку — уточни её, разнеся цены)" : ""}`);
    }
    if (why.length) chapterHint = `Цель «Чуйка монополиста» (ключ к главе 2) сегодня не засчитана — ${why.join("; ")}.`;
  }

  /* Новая глава: прошла неделя И выполнена ключевая цель текущей главы. */
  /* Запасной вход: если ключевая цель не даётся, с fallback.fromDay хватает fallback.streak дней подряд
     с прибылью и без дефицита. Цель при этом не засчитывается (и награды нет). */
  const cleanStreak = profit > 0 && rows.every((r) => r.lostStock === 0) ? (st.cleanStreak || 0) + 1 : 0;
  let chapter = st.chapter || 1, newChapter = null, chapterFallback = false;
  const upcoming = LAVKA_CHAPTERS[chapter], cur = LAVKA_CHAPTERS[chapter - 1];
  if (upcoming && st.day + 1 >= upcoming.fromDay) {
    if (cur.goal && goals[cur.goal]) { chapter += 1; newChapter = chapter; }
    else if (cur.fallback && st.day >= cur.fallback.fromDay && cleanStreak >= cur.fallback.streak) { chapter += 1; newChapter = chapter; chapterFallback = true; }
  }

  /* Следующее утро: событие стареет, возможно, приходит новое. */
  const nextBase = { ...st, day: st.day + 1, rep: repNew, chapter };
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
    day: st.day, rows, revenue, buyCost, taxPaid, fixed, profit, repaid, reward, newGoals, newChapter, chapterFallback, chapterHint,
    event: st.event, tokens, sold, repDelta, weekday: lavkaWeekday(st.day),
  };
  const stats = {
    totalProfit: (st.stats.totalProfit || 0) + profit,
    totalSold: (st.stats.totalSold || 0) + sold,
    bestDay: st.stats.bestDay == null || profit > st.stats.bestDay ? profit : st.stats.bestDay,
  };
  const next = {
    ...nextBase, at: Date.now(), cash: Math.round(cash), debt, stock, obs, goals, stats, event, rep: repNew, plusStreak, cleanStreak,
    history: [...st.history, { day: st.day, profit: Math.round(profit) }].slice(-60),
    last: { ...report, tokens: undefined },
  };
  return { next, report };
}

function lavkaRollEvent(st) {
  const pids = lavkaUnlocked(st);
  const pool = [];
  for (const [id, e] of Object.entries(LAVKA_EVENTS)) {
    if (lavkaChapterOf("events", id) > (st.chapter || 1)) continue;
    for (let i = 0; i < e.weight; i++) pool.push(id);
  }
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
  { id: "mrmc",    emoji: "🧠", title: "Чуйка монополиста",     desc: "У всех товаров в один день MR = MC с точностью 3 ₽ (если прилавок — узкое место, MR = MC + λ) и товара хватило всем.", reward: 1500 },
  { id: "ceiling", emoji: "📜", title: "Парадокс потолка",      desc: "Во время потолка цен продай этого товара больше, чем было бы выгодно без потолка (если потолок выше MC + λ).", reward: 2000 },
  { id: "war",     emoji: "⚔️", title: "Пережил Семёна",        desc: "Пройди визит конкурента с суммарной прибылью в плюсе.", reward: 2000 },
  { id: "discr",   emoji: "⚖️", title: "Дискриминация III степени", desc: "Один товар в двух точках по разным ценам, каждая в пределах 3 ₽ от своего оптимума (с учётом мощности точки).", reward: 3000 },
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

/* Загрузка сохранения "lavka-save": недостающие поля — по умолчанию; наблюдения, записанные
   по старой модели спроса (до LAVKA_MODEL_VERSION), уходят из оценки тетради (base: false). */
function lavkaLoad(raw) {
  const fresh = lavkaNewState();
  let s = null;
  try { s = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { s = null; }
  if (!s || s.v !== 1) return fresh;
  const obs = {
    main: { ...fresh.obs.main, ...(s.obs?.main || {}) },
    office: { ...fresh.obs.office, ...(s.obs?.office || {}) },
  };
  if ((s.model || 1) < LAVKA_MODEL_VERSION) {
    for (const p of Object.keys(obs)) for (const pid of Object.keys(obs[p])) obs[p][pid] = (obs[p][pid] || []).map((o) => ({ ...o, base: false }));
  }
  return {
    ...fresh, ...s, model: LAVKA_MODEL_VERSION, obs,
    chapter: s.chapter || lavkaChapterByDay(s.day || 1),
    settings: { main: { ...fresh.settings.main, ...(s.settings?.main || {}) }, office: { ...fresh.settings.office, ...(s.settings?.office || {}) } },
    stock: { main: { ...(s.stock?.main || {}) }, office: { ...(s.stock?.office || {}) } },
  };
}

/* МНК по обычным дням. Наблюдение: D = k·(α − β·P), k — число покупателей относительно обычного будня
   (день недели × лояльность × вывеска), поэтому D/k = α − β·P — точная линейная зависимость. */
function lavkaFit(list) { return lavkaFitStatus(list).fit; }

/* То же с причиной, почему оценки нет: few — меньше 3 обычных дней, flat — цены слишком близки
   или шум дал неубывающую линию. */
function lavkaFitStatus(list) {
  const pts = (list || []).filter((o) => o.base);
  if (pts.length < 3) return { fit: null, reason: "few" };
  const f = lavkaFitRaw(pts);
  return f ? { fit: f, reason: null } : { fit: null, reason: "flat" };
}

function lavkaFitRaw(pts) {
  const n = pts.length;
  const dn = (o) => o.D / (o.k || 1); // спрос на «одного обычного будничного покупателя»
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
  lavkaPlan, lavkaVerdict, lavkaLoad, lavkaFitStatus, LAVKA_MODEL_VERSION, LAVKA_SIGN_MULT,
  lavkaCeilingParadox, lavkaShownLambda, LAVKA_LAMBDA_SHOWN,
  LAVKA_CHAPTERS, LAVKA_ORACLE_DAYS, lavkaChapterOf, lavkaUpgradeOpen, lavkaChapterByDay,
};
