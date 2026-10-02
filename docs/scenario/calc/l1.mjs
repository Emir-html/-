// Модель уровня 1 по решениям (01_РЕШЕНИЯ_И_УРОВНИ.md):
// сдвиг «больше людей» (день недели, лояльность, вывеска, фестиваль) умножает A и B на k;
// мощность K на точку, теневая цена λ; сид mulberry32.
export const PR = {
  lemonade: { name: "Лимонад", a: 160, b: 2, c: 20 },
  croissant: { name: "Круассан", a: 200, b: 2.5, c: 30 },
  coffee: { name: "Кофе", a: 100, b: 0.5, c: 40 },
  icecream: { name: "Мороженое", a: 180, b: 2, c: 25 },
};
export const PT = {
  main: { aMult: 1, bMult: 1, rent: 400, week: [1, 1, 1, 1, 1.1, 1.3, 1.25] },
  office: { aMult: 0.85, bMult: 0.55, rent: 900, week: [1.05, 1.05, 1.05, 1.05, 1, 0.45, 0.4] },
};
export const wd = (day) => (day - 1) % 7;
export const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// параметры товара: ev — список эффектов {pid?, point?, type, ...}
export function params(day, point, pid, o = {}) {
  const pr = PR[pid], pt = PT[point];
  const rep = (o.rep && o.rep[point]) || 1;
  let k = pt.week[wd(day)] * rep * (o.sign ? 1.15 : 1);
  let A = pr.a * pt.aMult, B = pr.b * pt.bMult;
  let c = pr.c * (o.supplier ? 0.85 : 1), tax = 0, cap = null, comp = null, base = true;
  for (const e of o.events || []) {
    if (e.point && e.point !== point) continue;
    if (e.pid && e.pid !== pid) continue;
    base = false;
    if (e.kMult) k *= e.kMult;            // «больше людей»
    if (e.aMult) A *= e.aMult;            // «платят больше» / меньше
    if (e.bMult) B *= e.bMult;
    if (e.cAdd) c += e.cAdd;
    if (e.tax) tax += e.tax;
    if (e.cap != null) cap = e.cap;
    if (e.comp != null) comp = e.comp;
  }
  A *= k; B *= k;
  if (comp != null) A = 0.55 * A + 0.5 * B * comp;
  const mc = c + tax;
  return { pid, A, B, c, tax, mc, cap, comp, k, base, choke: A / B };
}

// оптимальный объём одного товара при теневой цене λ
function qAt(m, lam) {
  const pu = (m.choke + m.mc + lam) / 2;
  if (m.cap != null && m.cap < pu) {
    if (m.cap >= m.mc + lam) return { P: m.cap, Q: Math.max(0, m.A - m.B * m.cap) };
    // потолок ниже MC+λ: выгодно продать столько, сколько даёт MR-кривая? MR при Q>D(cap) ниже cap — не продаём больше 0
    return { P: m.cap, Q: 0 };
  }
  return { P: pu, Q: Math.max(0, m.A - m.B * pu) };
}
export function optimum(ms, K) {
  const tot = (l) => ms.reduce((s, m) => s + qAt(m, l).Q, 0);
  let lam = 0;
  if (tot(0) > K) {
    let lo = 0, hi = 500;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tot(mid) > K) lo = mid; else hi = mid; }
    lam = hi;
  }
  let rows = ms.map((m) => {
    const { P, Q } = qAt(m, lam);
    // при потолке и λ>0 объём может упереться в мощность «внутри» горизонтального участка
    return { ...m, P, Q, profit: (P - m.mc) * Q, E: Q > 0 ? (m.B * P) / Q : null };
  });
  // потолок, где cap − MC = λ: товар на потолке добирает свободную мощность (MR горизонтальна)
  let free = K - rows.reduce((s, r) => s + r.Q, 0);
  if (lam > 0 && free > 1e-6) for (const r of rows) if (r.cap != null && Math.abs(r.cap - r.mc - lam) < 1e-3) { const add = Math.min(free, Math.max(0, r.A - r.B * r.cap) - r.Q); r.Q += add; free -= add; r.profit = (r.P - r.mc) * r.Q; }
  // если потолок с горизонтальным MR и сумма всё ещё > K — урезаем товар на потолке
  let over = rows.reduce((s, r) => s + r.Q, 0) - K;
  if (over > 1e-6) for (const r of rows) if (r.cap != null && r.P === r.cap) { const cut = Math.min(over, r.Q); r.Q -= cut; over -= cut; r.profit = (r.P - r.mc) * r.Q; }
  return { lam, rows, profit: rows.reduce((s, r) => s + r.profit, 0) };
}
export const lamFormula = (ms, K) => Math.max(0, (ms.reduce((s, m) => s + m.A, 0) - ms.reduce((s, m) => s + m.B * m.mc, 0) - 2 * K) / ms.reduce((s, m) => s + m.B, 0));

export const compBR = (A0, B0, c, P) => (0.55 * A0 + 0.5 * B0 * P + B0 * c) / (2 * B0); // A0,B0 без конкурента
export const nash = (A0, B0, c) => (0.55 * A0 + B0 * c) / (1.5 * B0);
export const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("ru-RU");
