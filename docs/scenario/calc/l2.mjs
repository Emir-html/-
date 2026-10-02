// Уровень 2 · Ярмарка: Курно с адаптивными соперниками. Нормированный объём x = q/k, P = a − b·Σx.
export const P2 = { a: 100, b: 0.05, c: 20, kWeek: [1, 1, 1, 1, 1.1, 1.4, 1.3], fee: 3000, unitFee: 10, coolerCut: 4, coolerCost: 40000,
  pFine: 0.08, fine: 25000, r: 0.02 };
export const wd = (d) => (d - 1) % 7;
export const kOf = (d) => P2.kWeek[wd(d)];
export const cournotX = (n, c = P2.c) => (P2.a - c) / (P2.b * (n + 1));
export const cournotP = (n, c = P2.c) => (P2.a + n * c) / (n + 1);
export const br = (others, c) => Math.max(0, (P2.a - c - P2.b * others) / (2 * P2.b));
export const price = (X) => P2.a - P2.b * X;

// сценарий: кто на рынке и какие издержки
export function dayRules(d) {
  const unit = d <= 7 ? P2.unitFee : 0;      // неделя 1 — сбор с единицы, потом — плата за место
  const fixed = d <= 7 ? 0 : P2.fee;
  let rivals = ["semyon"];
  if (d >= 10) rivals.push("ilya");
  if (d >= 15 && d <= 21) rivals.push("students", "zoya");
  if (d === 23 || d === 24) rivals.push("newcomer");
  return { unit, fixed, rivals };
}
