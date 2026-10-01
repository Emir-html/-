/*
 * МирСтади — слияние прогресса (единый источник правил).
 *
 * КОНТРАКТ
 *   mergeValue(key, local, incoming) → merged
 *     key       — ключ хранилища ("review-state", "fg-checked", ...)
 *     local     — значение на этом устройстве (уже JSON.parse), может быть undefined
 *     incoming  — значение из файла/облака, может быть undefined
 *     merged    — результат; НИЧЕГО не пишет сам — чистая функция
 *
 *   mergeAll(localMap, incomingMap) → { data, changed:[keys], same:[keys] }
 *
 * ГАРАНТИИ (проверяются тестами test/progress-merge.test.mjs)
 *   1. Идемпотентность:   merge(merge(L,I), I) === merge(L,I)
 *      → повторный импорт того же файла ничего не меняет и не задваивает.
 *   2. Ничего не теряется: всё, что было локально, остаётся (кроме случаев,
 *      когда в файле ТА ЖЕ запись новее — тогда берётся более новая).
 *   3. Порядок не важен: merge(L,I) и merge(I,L) дают одинаковый прогресс
 *      (исключение — ui-theme, это настройка устройства, всегда локальная).
 *
 * Почему не «последняя запись побеждает целиком»: review-state — это ОДИН ключ
 * со всеми карточками SM-2. Если на телефоне повторил 10 карточек, а на ноутбуке
 * другие 10, перезапись целиком потеряет половину. Здесь сливается по карточкам.
 */

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* Метка времени записи: SM-2 → last, задачи/бустеры → at, план → setAt. */
const stamp = (v) => (isObj(v) ? Number(v.last ?? v.at ?? v.setAt ?? 0) || 0 : 0);

/* Из двух версий одной записи — более новая; при равенстве остаётся локальная. */
function newer(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (a === null) return b; // «пусто» проигрывает любым данным
  if (b === null) return a;
  return stamp(b) > stamp(a) ? b : a;
}

/* Поштучно по ключам объекта: для каждой записи — более новая. */
function byNewest(a, b) {
  if (!isObj(a)) return isObj(b) ? { ...b } : a;
  if (!isObj(b)) return { ...a };
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = newer(a[k], b[k]);
  return out;
}

/* Отметки «изучено/повторено»: тема отмечена, если отмечена хоть где-то. */
function byOr(a, b) {
  if (!isObj(a)) return isObj(b) ? { ...b } : a;
  if (!isObj(b)) return { ...a };
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = Boolean(a[k]) || Boolean(b[k]);
  return out;
}

/* Счётчики и проценты: берём максимум по каждому числовому полю (рекурсивно).
   Сумма здесь недопустима — повторный импорт удвоил бы статистику. */
function deepMax(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  if (isObj(a) && isObj(b)) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMax(a[k], b[k]);
    return out;
  }
  return a; // несовпадение типов — оставляем локальное
}

/* Серия дней: побеждает более поздняя дата; при равной — большая серия. */
function streak(a, b) {
  if (!isObj(a)) return isObj(b) ? { ...b } : a;
  if (!isObj(b)) return { ...a };
  const da = String(a.lastDate || ""), db = String(b.lastDate || "");
  if (db > da) return { ...b };
  if (da > db) return { ...a };
  return { ...a, count: Math.max(a.count || 0, b.count || 0) };
}

/* Свои карточки: объединение по id. */
function unionById(a, b, idOf = (x) => x && x.id) {
  const A = Array.isArray(a) ? a : [], B = Array.isArray(b) ? b : [];
  if (!Array.isArray(a) && !Array.isArray(b)) return a ?? b;
  const seen = new globalThis.Map()  /* globalThis: в приложении имя Map занято иконкой lucide */;
  for (const x of A) seen.set(idOf(x), x);
  for (const x of B) if (!seen.has(idOf(x))) seen.set(idOf(x), x);
  return [...seen.values()];
}

/* Время занятий: по дням — максимум, общий счётчик — максимум,
   текущая сессия (running/last) — локальная. */
function time(a, b) {
  if (!isObj(a)) return isObj(b) ? { ...b } : a;
  if (!isObj(b)) return { ...a };
  const days = deepMax(a.days || {}, b.days || {});
  const day = String(a.day || "") >= String(b.day || "") ? a.day : b.day;
  return {
    ...a,
    total: Math.max(a.total || 0, b.total || 0),
    day,
    today: days[day] ?? Math.max(a.today || 0, b.today || 0),
    days,
  };
}

const localWins = (a, b) => (a === undefined ? b : a);

/* История попыток: объединяем по времени попытки, новые сверху, не больше 60. */
function q1History(a, b) {
  if (!Array.isArray(a) && !Array.isArray(b)) return a ?? b;
  const all = unionById(a, b, (x) => (x && x.ts != null ? "ts:" + x.ts : stableStringify(x)));
  return all.sort((x, y) => (y && y.ts || 0) - (x && x.ts || 0)).slice(0, 60);
}

/* Ключ элемента массива для объединения без дублей. */
const itemId = (x) => (isObj(x) ? (x.id ?? (x.ts != null ? "ts:" + x.ts : x.at != null ? "at:" + x.at : stableStringify(x))) : stableStringify(x));

/* Универсальное правило для ключей, которых ещё нет в таблице (защита будущего):
   числа → max, логические → OR, объекты → рекурсивно, массивы → объединение
   без дублей (порядок: сначала локальные), прочее → локальное. */
function generic(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  if (typeof a === "boolean" && typeof b === "boolean") return a || b;
  if (isObj(a) && isObj(b)) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = generic(a[k], b[k]);
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) return unionById(a, b, itemId);
  return a;
}

/* Таблица правил. Суффиксные правила покрывают треки fg / bz / ru и будущие. */
const EXACT_RULES = {
  "review-state": byNewest,          // SM-2: { cardId: {ease, interval, reps, due, last} }
  "social-review-state": byNewest,
  "problem-progress": byNewest,      // { id: {status, at} }
  "problem-attempts": byNewest,      // { id: {correct, difficulty, at, ...} }
  "struggling-cards": byNewest,      // { cardId: {at, topic} }
  "social-struggling": byNewest,
  "study-plan": newer,               // {key, label, setAt} | null
  "topic-progress": deepMax,         // { topicKey: 0..100 }
  "social-topic-stats": deepMax,     // { topic: {correct, partial, wrong} }
  "review-stats": deepMax,           // {totalReviews, correctReviews}
  "ege-test-stats": deepMax,         // {right, total}
  "testbank-stats": deepMax,
  "ru-taskstats": deepMax,           // { taskNum: {right, total} }
  "streak-data": streak,
  "social-streak": streak,
  "streak": streak,
  "custom-cards": unionById,
  "time-v2": time,
  "ui-theme": localWins,             // настройка устройства, не прогресс
  "backup-log": (a, b) => unionById(a, b, (x) => x && x.at + ":" + x.action),
  "q1-history": q1History,           // пробные экзамены 1 тура: [{..., ts}], новые сверху, ≤60
  "lavka-save": newer,               // игра «Лавка»: цельное сохранение {..., at}, побеждает более новое
};

const SUFFIX_RULES = [
  ["-checked", byOr],                // { topicKey: true }
  ["-reviewed", byOr],
  ["-struggling", byNewest],         // fg/bz/ru: { id: true } или { id: {at} }
  ["-teststats", deepMax],
  ["-stats", deepMax],
];

export function ruleFor(key) {
  if (EXACT_RULES[key]) return EXACT_RULES[key];
  for (const [suf, fn] of SUFFIX_RULES) if (key.endsWith(suf)) return fn;
  return generic;
}

export function mergeValue(key, local, incoming) {
  return ruleFor(key)(local, incoming);
}

/* Стабильная сериализация: порядок ключей не влияет на сравнение «изменилось ли». */
export function stableStringify(v) {
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  if (isObj(v)) return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

export function mergeAll(localMap, incomingMap) {
  const data = {}, changed = [], same = [];
  const keys = new Set([...Object.keys(localMap || {}), ...Object.keys(incomingMap || {})]);
  for (const k of keys) {
    const merged = mergeValue(k, localMap[k], incomingMap[k]);
    data[k] = merged;
    if (stableStringify(merged) === stableStringify(localMap[k])) same.push(k);
    else changed.push(k);
  }
  return { data, changed, same };
}

/* Читаем файл резервной копии любой версии → { key: разобранное значение }.
   v1: значения — JSON-строки (старый BackupPanel). v2: значения — объекты. */
export function readBackup(parsed) {
  if (!parsed || (parsed.app !== "mirstudy" && parsed.app !== "econ-trainer") || !isObj(parsed.data)) {
    throw new Error("not-a-backup");
  }
  const out = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (parsed.version >= 2) out[k] = v;
    else { try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; } }
  }
  return out;
}

/* Короткая человекочитаемая сводка «предмет → что сделано» для progress.json.
   Её читает Claude в любом чате проекта, не разбирая сырые ключи. */
export function summarize(data) {
  const cnt = (o) => (isObj(o) ? Object.values(o).filter(Boolean).length : 0);
  const list = (o) => (isObj(o) ? Object.keys(o).filter((k) => o[k]).sort() : []);
  const acc = (s) => (isObj(s) && s.total ? Math.round((100 * (s.right || 0)) / s.total) + "% из " + s.total : "нет данных");
  const track = (p) => ({
    studied: list(data[p + "-checked"]),
    struggling: cnt(data[p + "-struggling"]),
    tests: acc(data[p + "-teststats"]),
  });
  return {
    economics: {
      studied: list(data["topic-checked"]),
      cardsInSM2: isObj(data["review-state"]) ? Object.keys(data["review-state"]).length : 0,
      strugglingCards: cnt(data["struggling-cards"]),
      problemsSolved: isObj(data["problem-progress"]) ? Object.values(data["problem-progress"]).filter((p) => p && p.status === "solved").length : 0,
    },
    social: {
      studied: list(data["social-checked"]),
      cardsInSM2: isObj(data["social-review-state"]) ? Object.keys(data["social-review-state"]).length : 0,
      struggling: cnt(data["social-struggling"]),
      egeTests: acc(data["ege-test-stats"]),
    },
    finlit: track("fg"),
    business: track("bz"),
    russian: track("ru"),
    hoursTotal: isObj(data["time-v2"]) ? Math.round((data["time-v2"].total || 0) / 360) / 10 : 0,
  };
}
