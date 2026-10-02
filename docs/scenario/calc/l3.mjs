// Уровень 3 · Сеть кофеен. Порция = кофе + выпечка.
export const P3 = {
  cafes: {
    N: { name: "На Набережной", A: 400, B: 2, K: 140, rent: 3000, barista: 1500, week: [1, 1, 1, 1, 1.1, 1.3, 1.25] },
    T: { name: "У Техникума", A: 300, B: 2.5, K: 100, rent: 2000, barista: 1500, week: [1, 1, 1, 1, 1, 0.5, 0.3] },
  },
  kitchens: {
    k1: { name: "Заводская", c: 30, d: 0.1, F: 2000, max: 200 },
    k2: { name: "«Ковчег»", c: 10, d: 0.15, F: 3000, max: 220 },
  },
  zoya: 34,
  tiers: [[0, 0], [250, 2], [350, 3]], // объём собственной выпечки → скидка Гены на все единицы
  renovationT: 40000,
  r: 0.02,
};
export const wd = (d) => (d - 1) % 7;
export function tierCut(q) { let cut = 0; for (const [v, c] of P3.tiers) if (q >= v) cut = c; return cut; }
// минимальные издержки произвести Q порций (кухни + Зоя)
export function prodCost(Q, o = {}) {
  const ks = o.kitchens || P3.kitchens, zoya = o.zoya === undefined ? P3.zoya : o.zoya, useTiers = o.tiers ?? true;
  const split = (own, cut) => { // распределить own между кухнями при скидке cut: MC1 = MC2
    const c1 = ks.k1.c - cut, c2 = ks.k2.c - cut;
    let lo = Math.min(c1, c2), hi = 2000;
    const f = (m) => Math.min(ks.k1.max, Math.max(0, (m - c1) / ks.k1.d)) + Math.min(ks.k2.max, Math.max(0, (m - c2) / ks.k2.d));
    if (own > ks.k1.max + ks.k2.max + 1e-9) return null;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (f(mid) < own) lo = mid; else hi = mid; }
    const m = hi, q1 = Math.min(ks.k1.max, Math.max(0, (m - c1) / ks.k1.d)), q2 = own - q1;
    const vc = c1 * q1 + ks.k1.d * q1 * q1 / 2 + c2 * q2 + ks.k2.d * q2 * q2 / 2;
    return { q1, q2, vc, m, mc1: c1 + ks.k1.d * q1, mc2: c2 + ks.k2.d * q2 };
  };
  const cands = [];
  const cuts = useTiers ? P3.tiers : [[0, 0]];
  const maxOwn = ks.k1.max + ks.k2.max;
  for (const [thr, cut] of cuts) {
    if (thr > maxOwn) continue;
    // собственное производство: до MC = Зоя, но не меньше порога скидки и не больше Q
    const sAll = split(Math.min(Q, maxOwn), cut);
    let own;
    if (zoya == null) own = Q;
    else { // own, при котором MC = zoya
      const c1 = ks.k1.c - cut, c2 = ks.k2.c - cut;
      const atZ = Math.min(ks.k1.max, Math.max(0, (zoya - c1) / ks.k1.d)) + Math.min(ks.k2.max, Math.max(0, (zoya - c2) / ks.k2.d));
      own = Math.min(Q, atZ);
    }
    own = Math.max(own, Math.min(Q, thr));
    if (own < thr - 1e-9 || own > maxOwn + 1e-9) continue;
    if (zoya == null && own < Q - 1e-9) continue;
    const sp = split(own, cut); if (!sp) continue;
    const z = Q - own;
    cands.push({ cost: sp.vc + (zoya || 0) * z, q1: sp.q1, q2: sp.q2, z, cut, mc1: sp.mc1, mc2: sp.mc2, own });
  }
  cands.sort((a, b) => a.cost - b.cost);
  return cands[0] || null;
}
// оптимум сети: перебор Q_N, Q_T
export function optimum3(day, o = {}) {
  const res = [];
  const cafes = o.cafes || ["N", "T"];
  const dem = {};
  for (const id of cafes) {
    const cf = P3.cafes[id]; const k = (o.kMult?.[id] ?? 1) * cf.week[wd(day)];
    const A = cf.A * (o.aMult?.[id] ?? 1) * k, B = cf.B * (o.bMult?.[id] ?? 1) * k;
    dem[id] = { A, B, K: (o.K?.[id] ?? cf.K) };
  }
  let best = null;
  const step = o.step || 1;
  const rng = (id) => { const d = dem[id]; const out = []; for (let q = 0; q <= Math.min(d.K, d.A); q += step) out.push(q); return out; };
  const QN = cafes.includes("N") ? rng("N") : [0], QT = cafes.includes("T") ? rng("T") : [0];
  for (const qn of QN) for (const qt of QT) {
    const rev = (id, q) => (q > 0 ? (dem[id].A - q) / dem[id].B * q : 0);
    const R = (cafes.includes("N") ? rev("N", qn) : 0) + (cafes.includes("T") ? rev("T", qt) : 0);
    const pc = prodCost(qn + qt, o); if (!pc) continue;
    const pi = R - pc.cost;
    if (!best || pi > best.pi) best = { pi, qn, qt, pc, R };
  }
  const P = (id, q) => (dem[id].A - q) / dem[id].B;
  best.PN = cafes.includes("N") ? P("N", best.qn) : null; best.PT = cafes.includes("T") ? P("T", best.qt) : null;
  best.dem = dem;
  return best;
}
