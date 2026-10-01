/* Тесты модели «Лавки»: node --test lavka-model.test.js
   Проверяют экономику (оптимум, налог, потолок, дискриминация), инварианты симуляции и сохранения. */
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "./model.js";

const fresh = () => L.lavkaNewState();
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("оптимум монополиста: P* = (A/B + MC)/2 в будний день", () => {
  const st = fresh(); // день 1 = понедельник, k = 1
  const m = L.lavkaParams(st, "main", "lemonade");
  near(m.pOpt, 50); near(m.qOpt, 60);
  const c = L.lavkaParams(st, "main", "croissant");
  near(c.pOpt, 55); near(c.qOpt, 62.5);
});

test("в оптимуме MR = MC и спрос эластичен (|E| > 1)", () => {
  const m = L.lavkaParams(fresh(), "main", "lemonade");
  const mr = 2 * m.pOpt - m.A / m.B;
  near(mr, m.mc);
  assert.ok((m.B * m.pOpt) / m.qOpt > 1);
});

test("акциз t сдвигает P* ровно на t/2", () => {
  const st = fresh();
  const base = L.lavkaParams(st, "main", "lemonade", true).pOpt;
  st.event = { id: "tax", daysLeft: 2, product: "lemonade" };
  near(L.lavkaParams(st, "main", "lemonade").pOpt - base, 5);
});

test("рост MC муки на 12 ₽ поднимает P* круассана на 6 ₽", () => {
  const st = fresh();
  const base = L.lavkaParams(st, "main", "croissant", true).pOpt;
  st.event = { id: "flour", daysLeft: 2 };
  near(L.lavkaParams(st, "main", "croissant").pOpt - base, 6);
});

test("потолок между MC и P* становится оптимальной ценой и увеличивает объём", () => {
  const st = fresh();
  const mono = L.lavkaParams(st, "main", "lemonade", true);
  st.event = { id: "ceiling", daysLeft: 2, product: "lemonade", cap: 37 };
  const m = L.lavkaParams(st, "main", "lemonade");
  near(m.pOpt, 37);
  assert.ok(m.qOpt > mono.qOpt);
});

test("дискриминация III степени: у бизнес-центра (менее эластичный спрос) P* выше", () => {
  const st = fresh(); st.upgrades.office = true;
  for (const pid of ["lemonade", "croissant"]) {
    assert.ok(L.lavkaParams(st, "office", pid).pOpt > L.lavkaParams(st, "main", pid).pOpt);
  }
});

test("наилучший ответ конкурента и равновесие Нэша ниже монопольной цены", () => {
  const st = fresh();
  let p = 50;
  for (let i = 0; i < 60; i++) {
    const pk = L.lavkaCompBR(st, "lemonade", p);
    st.event = { id: "competitor", daysLeft: 3, product: "lemonade", compPrice: pk };
    p = Math.round(L.lavkaParams(st, "main", "lemonade").pOpt);
  }
  assert.ok(p < 50, `цена Нэша ${p} должна быть ниже 50`);
});

test("постоянные издержки (помощник) не меняют P*", () => {
  const st = fresh(); const a = L.lavkaParams(st, "main", "lemonade").pOpt;
  st.upgrades.helper = true; near(L.lavkaParams(st, "main", "lemonade").pOpt, a);
});

test("симуляция: баланс денег сходится, запас не уходит в минус, лояльность в границах", () => {
  let st = fresh();
  for (let d = 0; d < 40; d++) {
    const before = st.cash;
    const { next, report } = L.lavkaSimulate(st);
    const expected = before + report.profit - report.repaid + report.reward;
    assert.ok(Math.abs(next.cash - expected) <= 1, `день ${report.day}: касса ${next.cash} ≠ ${expected}`);
    for (const r of report.rows) {
      assert.ok(r.S >= 0 && r.S <= r.have && r.S <= r.D);
      assert.equal(r.S + r.lostStock + r.lostQueue, r.D);
      assert.ok(r.dwl >= -1e-9 && r.cs >= -1e-9);
    }
    for (const v of Object.values(next.rep)) assert.ok(v >= L.LAVKA_REP_MIN && v <= L.LAVKA_REP_MAX);
    assert.equal(next.day, st.day + 1);
    st = next;
  }
});

test("МНК восстанавливает спрос по точным наблюдениям", () => {
  const obs = [30, 40, 50, 60].map((P) => ({ P, D: 160 - 2 * P, base: true, k: 1 }));
  const f = L.lavkaFit(obs); near(f.alpha, 160, 1e-6); near(f.beta, 2, 1e-6);
  const withK = [30, 40, 50].map((P) => ({ P, D: 1.3 * (160 - 2 * P), base: true, k: 1.3 }));
  near(L.lavkaFit(withK).beta, 2, 1e-6);
});

test("в Вопросе дня верный вариант существует", () => {
  for (const q of L.LAVKA_QUIZ) assert.ok(q.a >= 0 && q.a < q.opts.length);
});

/* ===== Исправления по ревью экономиста (docs/reviews/2026-10-01-economist.md) ===== */

const sumQ = (plan) => Object.values(plan.rows).reduce((s, r) => s + r.qOpt, 0);

test("больше покупателей (выходные, лояльность, вывеска, фестиваль): спрос ×n, P* не меняется", () => {
  const mon = L.lavkaParams(fresh(), "main", "lemonade");
  const sat = fresh(); sat.day = 6; sat.rep.main = 1.1; sat.upgrades.sign = true; // сб ×1,3 · лояльность · вывеска
  const m = L.lavkaParams(sat, "main", "lemonade");
  near(m.pOpt, mon.pOpt);
  near(m.qOpt, mon.qOpt * 1.3 * 1.1 * 1.15, 1e-9);
  const fest = fresh(); fest.event = { id: "festival", daysLeft: 1 };
  const f = L.lavkaParams(fest, "main", "lemonade");
  near(f.pOpt, mon.pOpt); near(f.qOpt, mon.qOpt * 1.3, 1e-9);
});

test("тетрадь: МНК по дням с разным числом покупателей восстанавливает базовый спрос точно", () => {
  const obs = [];
  for (const [day, rep, P] of [[1, 1, 30], [3, 0.9, 45], [6, 1.05, 50], [7, 1.1, 60], [5, 0.85, 40]]) {
    const st = fresh(); st.day = day; st.rep.main = rep;
    const m = L.lavkaParams(st, "main", "lemonade");
    obs.push({ P, D: m.A - m.B * P, k: m.k, base: true });
  }
  const f = L.lavkaFit(obs);
  near(f.alpha, 160, 1e-6); near(f.beta, 2, 1e-6);
});

test("мощность не ограничивает → план совпадает с монопольным оптимумом, λ = 0", () => {
  const st = fresh(); st.upgrades.helper = true; // 220 мест, а Q* = 122,5
  const plan = L.lavkaPlan(st, "main");
  assert.equal(plan.lambda, 0);
  near(plan.rows.lemonade.pOpt, 50); near(plan.rows.croissant.pOpt, 55);
});

test("мощность ограничивает → MR = MC + λ для каждого товара и ΣQ = мощность", () => {
  const st = fresh(); st.day = 6; // суббота: Q* = 84 + 92,5 > 120
  const plan = L.lavkaPlan(st, "main");
  assert.ok(plan.lambda > 0);
  near(sumQ(plan), L.LAVKA_CAPACITY, 1e-6);
  for (const pid of ["lemonade", "croissant"]) {
    const m = L.lavkaParams(st, "main", pid), r = plan.rows[pid];
    near(2 * r.pOpt - m.A / m.B, m.mc + plan.lambda, 1e-6);
    assert.ok(r.pOpt > m.pOpt, "с узким местом выгодная цена выше монопольной");
  }
});

test("баланс денег и инварианты сохраняются при новой модели (40 дней со всеми улучшениями)", () => {
  let st = fresh();
  st.cash = 1e6; for (const u of L.LAVKA_UPGRADES) st.upgrades[u.id] = true;
  for (let d = 0; d < 40; d++) {
    for (const p of L.lavkaOpenPoints(st)) {
      const plan = L.lavkaPlan(st, p);
      for (const pid of L.lavkaUnlocked(st)) st.settings[p][pid] = { price: Math.round(plan.rows[pid].pOpt), order: Math.round(plan.rows[pid].qOpt * 1.05) };
    }
    const before = st.cash;
    const { next, report } = L.lavkaSimulate(st);
    assert.ok(Math.abs(next.cash - (before + report.profit - report.repaid + report.reward)) <= 1);
    for (const r of report.rows) { assert.ok(r.lambda >= 0); assert.equal(r.S + r.lostStock + r.lostQueue, r.D); }
    st = next;
  }
});

const row = (o) => ({ P: 50, priceSet: 50, D: 60, S: 60, lostStock: 0, lostQueue: 0, mc: 20, lambda: 0, cap: null, mr: 20, el: 1.67, ...o });

test("вердикт: цена ровно на потолке — не советует поднять цену", () => {
  const v = L.lavkaVerdict(row({ P: 37, priceSet: 37, cap: 37, mr: 2 * 37 - 80 }));
  assert.ok(!/Подними/.test(v), v);
  assert.match(v, /потол/i);
});

test("вердикт: товар кончился — сначала закупка, а не «снизь цену»", () => {
  const v = L.lavkaVerdict(row({ P: 45, mr: 10, D: 70, S: 50, lostStock: 20 }));
  assert.ok(!/Снизь цену — продашь больше/.test(v), v);
  assert.match(v, /закуп/i);
});

test("вердикт: очередь при MR > MC — снижение цены не добавит продаж", () => {
  const v = L.lavkaVerdict(row({ P: 45, mr: 30, D: 70, S: 55, lostQueue: 15 }));
  assert.ok(!/Снизь цену — продашь больше/.test(v), v);
  assert.match(v, /очеред|прилав/i);
});

test("вердикт при узком месте сравнивает MR с MC + λ", () => {
  const v = L.lavkaVerdict(row({ P: 56, mr: 32, lambda: 12 }));
  assert.match(v, /λ/);
  assert.ok(!/Подними|Снизь/.test(v), v);
});

test("старое сохранение (до модели n·(A − B·P)) загружается, старые наблюдения не портят тетрадь", () => {
  const old = { ...fresh(), day: 11, cash: 26866, upgrades: { analyst: true }, at: 1 };
  delete old.model;
  old.obs.main.lemonade = [{ P: 50, D: 70, k: 1.3, day: 6, base: true }];
  const s = L.lavkaLoad(JSON.stringify(old));
  assert.equal(s.day, 11); assert.equal(s.cash, 26866); assert.ok(s.upgrades.analyst);
  assert.equal(s.obs.main.lemonade[0].base, false);
  assert.equal(s.model, L.LAVKA_MODEL_VERSION);
  const again = L.lavkaLoad(JSON.stringify({ ...s, obs: { ...s.obs, main: { ...s.obs.main, croissant: [{ P: 50, D: 70, k: 1, day: 12, base: true }] } } }));
  assert.equal(again.obs.main.croissant[0].base, true, "новые наблюдения не трогаем");
  assert.equal(L.lavkaLoad(null).day, 1);
  assert.equal(L.lavkaLoad("{битый json").day, 1);
});

test("вердикт: склонение «покупатель» и λ < 2 ₽ не показывается", () => {
  assert.match(L.lavkaVerdict(row({ lostStock: 1, D: 61 })), /1 покупатель ушёл/);
  assert.match(L.lavkaVerdict(row({ lostStock: 22, D: 82 })), /22 покупателя ушли/);
  assert.match(L.lavkaVerdict(row({ lostStock: 41, D: 101 })), /41 покупатель ушёл/);
  assert.match(L.lavkaVerdict(row({ lostStock: 12, D: 72 })), /12 покупателей ушли/);
  assert.ok(!/λ/.test(L.lavkaVerdict(row({ lambda: 1.1 }))));
});

/* ===== Повторное ревью: потолок при узком месте ===== */

const ceilingDay = (day, extra = {}) => {
  const st = fresh(); st.day = day; Object.assign(st.upgrades, extra);
  st.event = { id: "ceiling", daysLeft: 1, product: "lemonade", cap: 37 };
  return st;
};

test("потолок ровно окупает место (λ = потолок − MC): вердикт не противоречит себе и называет объём", () => {
  const st = ceilingDay(1), plan = L.lavkaPlan(st, "main");
  near(plan.lambda, 17, 1e-3);
  const q = plan.rows.lemonade.qOpt;
  assert.ok(q > 0 && q < 86, `частичная продажа, q = ${q}`);
  const v = L.lavkaVerdict(row({ P: 37, priceSet: 37, cap: 37, mr: 2 * 37 - 80, lambda: plan.lambda, qBest: q }));
  assert.ok(!/37 ₽ < /.test(v), v);
  assert.match(v, new RegExp(String(Math.round(q))));
});

test("цель «Парадокс потолка» — только если потолок действительно увеличивает выгодный объём", () => {
  const play = (st) => {
    const m = L.lavkaParams(st, "main", "lemonade");
    st.settings.main.lemonade = { price: 37, order: Math.round(m.A - m.B * 37) };
    st.settings.main.croissant = { price: 60, order: 0 };
    for (const pid of ["coffee", "icecream"]) st.settings.main[pid] = { price: 200, order: 0 };
    st.cash = 1e5;
    return L.lavkaSimulate(st).report.newGoals.includes("ceiling");
  };
  assert.equal(L.lavkaCeilingParadox(ceilingDay(1)), true, "понедельник: потолок поднимает выгодный объём");
  assert.equal(play(ceilingDay(1)), true);
  const sat = ceilingDay(6, { coffee: true, freezer: true });
  assert.equal(L.lavkaCeilingParadox(sat), false, "суббота с полным прилавком: место дороже потолка");
  assert.equal(play(sat), false);
});

test("цель «Чуйка монополиста» согласована с вердиктом при малой λ", () => {
  const st = fresh(), plan = L.lavkaPlan(st, "main"); // будни: λ ≈ 1,1
  assert.ok(plan.lambda > 0 && plan.lambda < 2);
  for (const pid of ["lemonade", "croissant"]) {
    const m = L.lavkaParams(st, "main", pid);
    st.settings.main[pid] = { price: Math.round(m.pOpt), order: Math.round(m.qOpt * 1.2) };
  }
  st.cash = 1e5;
  let hits = 0;
  for (let i = 0; i < 20; i++) {
    const { report } = L.lavkaSimulate(st);
    const vOk = report.rows.every((r) => /≈/.test(L.lavkaVerdict(r)));
    if (vOk && report.rows.every((r) => r.lostStock === 0)) hits += report.newGoals.includes("mrmc") ? 1 : 0;
    else hits += 1;
  }
  assert.equal(hits, 20, "если вердикт говорит «≈» и товара хватило — цель засчитывается");
});
