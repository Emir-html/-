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

test("вердикт на потолке: «не весь спрос» — только если выгодный объём меньше спроса при потолке", () => {
  const base = { P: 37, priceSet: 37, cap: 37, mr: -6, lambda: 17 };
  assert.match(L.lavkaVerdict(row({ ...base, qBest: 43, dExp: 86 })), /а не весь спрос/);
  assert.match(L.lavkaVerdict(row({ ...base, qBest: 79, dExp: 79 })), /Места хватает на весь спрос/);
});

/* ===== Кривая сложности: главы уровня 1 и «оракул» только в первую неделю ===== */

test("режим «Сложнее» — глава 1: только события спроса и улучшения главы 1", () => {
  const st = L.lavkaNewState("hard");
  assert.equal(st.chapter, 1);
  for (let i = 0; i < 300; i++) assert.ok(["heat", "rain", "festival"].includes(L.lavkaRollEvent(st).id));
  const open = L.LAVKA_UPGRADES.filter((u) => L.lavkaUpgradeOpen(st, u)).map((u) => u.id).sort();
  assert.deepEqual(open, ["analyst", "fridge", "helper"]);
  st.chapter = 3;
  assert.equal(L.LAVKA_UPGRADES.filter((u) => L.lavkaUpgradeOpen(st, u)).length, L.LAVKA_UPGRADES.length);
});

test("режим «История»: события по календарю сценария, магазин по дням, без мороженого и оптовика; старое сохранение — «Сложнее»", () => {
  let st = fresh();
  assert.equal(st.mode, "story");
  const seen = {};
  for (let d = 1; d <= 21; d++) {
    st.settings = JSON.parse(JSON.stringify(st.settings));
    const out = L.lavkaSimulate(st, L.lavkaRng(d));
    st = { ...out.next, cash: 1e5 };
    if (st.event) seen[st.day] = st.event.id + (st.event.product ? ":" + st.event.product : "") + (st.event.cap ? ":" + st.event.cap : "");
  }
  assert.deepEqual(seen, { 4: "flour", 5: "flour", 9: "competitor:lemonade", 10: "competitor:lemonade", 11: "competitor:lemonade", 12: "competitor:lemonade",
    13: "ceiling:lemonade:37", 16: "tax:lemonade", 17: "tax:lemonade", 18: "blogger", 19: "blogger", 20: "heat" });
  const openOn = (day) => L.LAVKA_UPGRADES.filter((u) => L.lavkaUpgradeOpen({ ...fresh(), day }, u)).map((u) => u.id).sort();
  assert.deepEqual(openOn(2), []); assert.deepEqual(openOn(3), ["analyst"]); assert.deepEqual(openOn(8), ["analyst", "fridge", "helper"]);
  assert.deepEqual(openOn(21), ["analyst", "coffee", "fridge", "helper", "office", "sign"]);
  assert.equal(L.lavkaLoad(JSON.stringify({ ...fresh(), mode: undefined })).mode, "hard");
  near(fresh().settings.main.lemonade.price, 60); near(fresh().settings.main.croissant.order, 38);
});

test("лояльность: не хватило товара — обида 0,3 × доля, не дождались в очереди — 0,15 × доля", () => {
  const st = fresh(); st.settings.main.lemonade = { price: 30, order: 500 }; st.settings.main.croissant = { price: 30, order: 500 };
  const r = L.lavkaSimulate(st, L.lavkaRng(3)).report;
  const rows = r.rows.filter((x) => x.point === "main"), want = rows.reduce((s, x) => s + x.D, 0);
  const lostQ = rows.reduce((s, x) => s + x.lostQueue, 0), lostS = rows.reduce((s, x) => s + x.lostStock, 0);
  assert.ok(lostQ > 0);
  near(r.repDelta.main.to, Math.round(Math.max(0.8, 1 - (0.3 * lostS + 0.15 * lostQ) / want) * 1000) / 1000, 1e-9);
});

test("глава открывается, когда прошла неделя И выполнена ключевая цель", () => {
  const day = (d, goals) => { const st = fresh(); st.day = d; st.goals = goals; st.cash = 1e5; return L.lavkaSimulate(st).next.chapter; };
  assert.equal(day(5, { mrmc: 3 }), 1, "цель есть, но неделя не прошла");
  assert.equal(day(7, { mrmc: 3 }), 2, "после 7-го дня с целью — глава 2");
  assert.equal(day(20, {}), 1, "без цели глава не открывается");
  const st = fresh(); st.day = 14; st.chapter = 2; st.goals = { mrmc: 3, week: 12 }; st.cash = 1e5;
  const { next, report } = L.lavkaSimulate(st);
  assert.equal(next.chapter, 3); assert.equal(report.newChapter, 3);
});

test("старое сохранение без глав: глава по номеру дня, купленное не пропадает", () => {
  const old = { ...fresh(), day: 16, upgrades: { office: true, coffee: true } };
  delete old.chapter;
  const s = L.lavkaLoad(JSON.stringify(old));
  assert.equal(s.chapter, 3); assert.ok(s.upgrades.office);
  assert.equal(L.lavkaLoad(JSON.stringify({ ...old, day: 9 })).chapter, 2);
  assert.equal(L.lavkaLoad(JSON.stringify({ ...old, day: 3 })).chapter, 1);
});

const dayReport = (d, opts = {}) => {
  const st = fresh(); st.day = d; st.chapter = 2; st.cash = 1e5; Object.assign(st.upgrades, opts.upgrades || {});
  if (opts.obs) st.obs.main.lemonade = opts.obs;
  st.settings.main.lemonade = { price: 45, order: 70 };
  return L.lavkaSimulate(st).report.rows.find((r) => r.pid === "lemonade");
};
const goodObs = [30, 40, 50, 60].map((P, i) => ({ P, D: 160 - 2 * P, k: 1, day: i + 1, base: true }));

test("оракул в первую неделю, потом вердикт по тетради или только факты", () => {
  const r1 = dayReport(7);
  assert.equal(r1.mode, "oracle"); assert.match(L.lavkaVerdict(r1), /MR/);
  const r2 = dayReport(8, { upgrades: { analyst: true }, obs: goodObs });
  assert.equal(r2.mode, "notebook");
  near(r2.mr, 2 * 45 - 80, 1e-6); // MR по оценке тетради: 2P − α/β
  assert.match(L.lavkaVerdict(r2), /тетрад/i);
  const r3 = dayReport(8);
  assert.equal(r3.mode, "facts");
  assert.equal(r3.mr, null); assert.equal(r3.el, null); assert.equal(r3.dwl, null);
  const v3 = L.lavkaVerdict(r3);
  assert.ok(!/MR\s*[=≈<>]/.test(v3), v3); assert.match(v3, /тетрад/i);
  const r4 = dayReport(8, { upgrades: { analyst: true }, obs: goodObs.slice(0, 2) });
  assert.equal(r4.mode, "facts", "меньше 3 обычных дней — оценки нет");
});

test("вердикт по тетради не врёт в день события и при очереди упоминает цену места", () => {
  const st = fresh(); st.day = 9; st.chapter = 2; st.cash = 1e5; st.upgrades.analyst = true;
  st.obs.main.lemonade = goodObs; st.event = { id: "heat", daysLeft: 1 };
  st.settings.main.lemonade = { price: 45, order: 70 };
  const r = L.lavkaSimulate(st).report.rows.find((x) => x.pid === "lemonade");
  assert.equal(r.mode, "facts", "в день события тетрадь не знает сегодняшнюю кривую");
  const q = L.lavkaVerdict({ ...row({ mode: "notebook", mr: 30, lostQueue: 10, D: 80, S: 70 }) });
  assert.match(q, /очеред|прилав/i);
});

/* ===== Ревью глав: тетрадь в дни налогов, тексты при очереди, подсказка главы ===== */

test("акциз, мука, потолок и фестиваль не портят тетрадь: спрос в эти дни прежний", () => {
  for (const ev of [{ id: "tax", daysLeft: 1, product: "lemonade" }, { id: "flour", daysLeft: 1 }, { id: "ceiling", daysLeft: 1, product: "lemonade", cap: 37 }, { id: "festival", daysLeft: 1 }]) {
    const st = fresh(); st.event = ev;
    assert.equal(L.lavkaParams(st, "main", "lemonade").base, true, ev.id);
  }
  for (const ev of [{ id: "heat", daysLeft: 1 }, { id: "blogger", daysLeft: 1 }]) {
    const st = fresh(); st.event = ev;
    const pid = ev.id === "blogger" ? "croissant" : "lemonade";
    assert.equal(L.lavkaParams(st, "main", pid).base, false, ev.id);
  }
  const st = fresh(); st.day = 9; st.chapter = 2; st.cash = 1e5; st.upgrades.analyst = true;
  st.obs.main.lemonade = goodObs; st.event = { id: "tax", daysLeft: 1, product: "lemonade" };
  st.settings.main.lemonade = { price: 45, order: 70 };
  const r = L.lavkaSimulate(st).report.rows.find((x) => x.pid === "lemonade");
  assert.equal(r.mode, "notebook"); near(r.mc, 30); near(r.mr, 10, 1e-6);
});

test("тетрадь: «цены слишком близки» отличается от «мало дней»", () => {
  assert.equal(L.lavkaFitStatus(goodObs.slice(0, 2)).reason, "few");
  const flat = [50, 50, 51].map((P, i) => ({ P, D: 60 + i, k: 1, day: i + 1, base: true }));
  assert.equal(L.lavkaFitStatus(flat).reason, "flat");
  assert.ok(L.lavkaFitStatus(goodObs).fit);
});

test("вердикт по тетради при очереди не противоречит себе", () => {
  const near0 = L.lavkaVerdict(row({ mode: "notebook", mr: 21, lostQueue: 10, D: 80, S: 70 }));
  assert.ok(!/близка к оптимуму/.test(near0), near0);
  assert.match(near0, /подними цену/i);
  const pos = L.lavkaVerdict(row({ mode: "notebook", mr: 35, lostQueue: 10, D: 80, S: 70 }));
  assert.match(pos, /мест/);
  assert.ok(!/удлинит очередь/.test(pos), pos);
});

test("в главе 1 отчёт называет, что мешает цели «Чуйка монополиста»", () => {
  const st = fresh(); st.cash = 1e5;
  st.settings.main.lemonade = { price: 50, order: 10 }; // товар точно кончится
  const { report } = L.lavkaSimulate(st);
  assert.ok(report.chapterHint && /Лимонад/.test(report.chapterHint) && /кончил/.test(report.chapterHint), report.chapterHint);
});

test("запасной вход в главу 2: с 14-го дня — 3 дня подряд без дефицита и с прибылью, цель не засчитывается", () => {
  const run = (day, streak) => {
    const st = fresh(); st.day = day; st.cleanStreak = streak; st.cash = 1e5;
    st.settings.main.lemonade = { price: 70, order: 60 };   // спрос при 70 ₽ ≈ 20 — дефицита нет
    st.settings.main.croissant = { price: 70, order: 60 };  // ≈ 25
    return L.lavkaSimulate(st);
  };
  const ok = run(14, 2);
  assert.equal(ok.next.chapter, 2); assert.equal(ok.report.newChapter, 2); assert.equal(ok.report.chapterFallback, true);
  assert.ok(!ok.next.goals.mrmc, "цель «Чуйка монополиста» сама не засчитывается");
  assert.equal(run(13, 5).next.chapter, 1, "до 14-го дня запасного входа нет");
  assert.equal(run(14, 1).next.chapter, 1, "нужно 3 дня подряд");
  assert.equal(run(14, 1).next.cleanStreak, 2);
});

/* ===== Генератор с сидом и экзамен уровня 1 ===== */

const examReady = () => { const st = fresh(); st.day = 22; st.chapter = 3; st.upgrades.analyst = true; st.cash = 5000; return st; };

test("генератор с сидом: одинаковый сид — одинаковый день", () => {
  const a = L.lavkaRng(42), b = L.lavkaRng(42), c = L.lavkaRng(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, [c(), c(), c()]);
  for (const x of sa) assert.ok(x >= 0 && x < 1);
  const st = fresh(); st.event = null;
  const r1 = L.lavkaSimulate(st, L.lavkaRng(7)).report, r2 = L.lavkaSimulate(st, L.lavkaRng(7)).report;
  assert.equal(r1.profit, r2.profit);
  assert.deepEqual(r1.rows.map((r) => r.D), r2.rows.map((r) => r.D));
});

test("экзамен открывается в главе 3 с 22-го дня", () => {
  const st = examReady();
  assert.equal(L.lavkaExamOpen(st), true);
  assert.equal(L.lavkaExamOpen({ ...st, day: 21 }), false);
  assert.equal(L.lavkaExamOpen({ ...st, chapter: 2 }), false);
});

test("экзамен: 3 сценария (обычный / сдвиг спроса / политика), детерминированы сидом", () => {
  const st = examReady();
  const e1 = L.lavkaExamNew(st, 101), e2 = L.lavkaExamNew(st, 101);
  assert.deepEqual(e1.days, e2.days);
  assert.deepEqual(e1.days.map((d) => d.kind), ["normal", "shift", "policy", "capacity"]);
  assert.equal(e1.days[0].event, null);
  assert.ok(["heat", "rain"].includes(e1.days[1].event.id));
  assert.ok(["tax", "ceiling"].includes(e1.days[2].event.id));
  const kinds = new Set();
  for (let s = 1; s < 60; s++) kinds.add(L.lavkaExamNew(st, s).days[2].event.id);
  assert.equal(kinds.size, 2, "встречаются и акциз, и потолок");
});

test("экзамен: игра как бот даёт эффективность 100%, плохие цены — без медали; касса не меняется", () => {
  const st = examReady();
  let ex = L.lavkaExamNew(st, 5);
  for (let i = 0; i < 4; i++) ex = L.lavkaExamPlayDay(st, ex, L.lavkaExamBotSettings(L.lavkaExamDayState(st, ex, i))).exam;
  assert.equal(ex.results.length, 4);
  near(L.lavkaExamEfficiency(ex), 1, 1e-9);
  assert.equal(L.lavkaExamMedal(1).id, "gold");
  let bad = L.lavkaExamNew(st, 5);
  for (let i = 0; i < 4; i++) {
    const s = JSON.parse(JSON.stringify(L.lavkaExamDayState(st, bad, i).settings));
    for (const pid of L.LAVKA_PIDS) s.main[pid] = { price: L.LAVKA_PRODUCTS[pid].c + 3, order: 150 };
    bad = L.lavkaExamPlayDay(st, bad, s).exam;
  }
  assert.ok(L.lavkaExamEfficiency(bad) < 0.7, `эффективность ${L.lavkaExamEfficiency(bad)}`);
  assert.equal(L.lavkaExamMedal(L.lavkaExamEfficiency(bad)), null);
  const after = L.lavkaExamFinish(st, ex);
  assert.equal(after.cash, st.cash); assert.equal(after.day, st.day);
  assert.equal(after.examBest.medal, "gold"); assert.equal(after.examBest.attempts, 1);
  const worse = L.lavkaExamFinish(after, bad);
  assert.equal(worse.examBest.medal, "gold", "в зачёт идёт лучшая попытка"); assert.equal(worse.examBest.attempts, 2);
});

test("медали: бронза ≥ 70%, серебро ≥ 85%, золото ≥ 95% — и порог каждого дня", () => {
  assert.equal(L.lavkaExamMedal(0.9, 0.6).id, "bronze", "провал одного дня не даёт серебра");
  assert.equal(L.lavkaExamMedal(0.97, 0.8).id, "silver");
  assert.equal(L.lavkaExamMedal(0.69), null);
  assert.equal(L.lavkaExamMedal(0.7).id, "bronze");
  assert.equal(L.lavkaExamMedal(0.85).id, "silver");
  assert.equal(L.lavkaExamMedal(0.95).id, "gold");
});

/* Экзамен должен различать понимание: стратегии, знающие обычный спрос, но игнорирующие одну идею. */
const examWith = (fn, seeds = 12) => {
  let sum = 0;
  for (let k = 0; k < seeds; k++) {
    const st = examReady(); st.upgrades.coffee = true; st.upgrades.helper = true;
    let ex = L.lavkaExamNew(st, 500 + k);
    for (let i = 0; i < ex.days.length; i++) ex = L.lavkaExamPlayDay(st, ex, fn(L.lavkaExamDayState(st, ex, i), ex.days[i])).exam;
    const res = L.lavkaExamResult(ex);
    sum += res.medal && (res.medal.id === "gold" || res.medal.id === "silver") ? 1 : 0;
  }
  return sum / seeds; // доля попыток с серебром или золотом
};
const planWith = (day, base) => {
  const s = JSON.parse(JSON.stringify(day.settings));
  for (const p of L.lavkaOpenPoints(day)) {
    const plan = L.lavkaPlan(base, p);
    for (const pid of L.lavkaUnlocked(day)) s[p][pid] = { price: Math.round(plan.rows[pid].pOpt), order: Math.round(plan.rows[pid].qOpt * 1.02) };
  }
  return s;
};

test("экзамен: игнор событий (сдвиг, налог, потолок) — серебро почти никогда", () => {
  const share = examWith((day) => planWith(day, { ...day, event: null }));
  assert.ok(share <= 0.2, `игнор событий: серебро+ в ${share * 100}% попыток`);
});

test("экзамен: игнор мощности (MR = MC без λ) — серебро почти никогда", () => {
  const share = examWith((day) => {
    const s = JSON.parse(JSON.stringify(day.settings));
    for (const p of L.lavkaOpenPoints(day)) for (const pid of L.lavkaUnlocked(day)) { const m = L.lavkaParams(day, p, pid); s[p][pid] = { price: Math.round(m.pOpt), order: Math.round(m.qOpt * 1.02) }; }
    return s;
  });
  assert.ok(share <= 0.2, `игнор λ: серебро+ в ${share * 100}% попыток`);
});

test("экзамен: день недели меняется от попытки к попытке, при Σ бота ≤ 0 экзамен недействителен", () => {
  const st = examReady();
  const d0 = L.lavkaExamDayState(st, L.lavkaExamNew(st, 1), 0).day;
  const d1 = L.lavkaExamDayState({ ...st, examBest: { eff: 0.5, medal: null, attempts: 1 } }, L.lavkaExamNew({ ...st, examBest: { attempts: 1 } }, 1), 0).day;
  assert.notEqual(d0 % 7, d1 % 7);
  assert.equal(L.lavkaExamEfficiency({ days: [{}], results: [{ player: 100, bot: -5, playerMargin: 100, botMargin: -5 }] }), null);
});

test("экзамен: прерванная попытка тоже сдвигает рынок (нельзя перебирать через «Прервать»)", () => {
  const st = examReady();
  const a = L.lavkaExamStart(st, 1);
  const aborted = { ...a, examActive: null };
  const b = L.lavkaExamStart(aborted, 1);
  assert.equal(b.examStarts, 2);
  const w = (s) => L.lavkaWeekday(L.lavkaExamDayState(s, s.examActive, 0).day);
  assert.notEqual(w(a), w(b));
});

/* ===== «Вопрос дня» из уроков MirStudy ===== */

const fakeBank = {
  tests: [
    { id: "t1", topic: "s-equilibrium", q: "Спрос складывается по горизонтали.", a: true, why: "Да." },
    { id: "t9", topic: "mk-gdp", q: "ВВП — запас.", a: false, why: "Поток." },
    { id: "t5", topic: "i-tax", q: "Налог на продавца платит только продавец.", a: false, why: "Делится." },
  ],
  hard: [
    { th: "micro", q: "Аккордный налог на монополиста. Выпуск?", opts: ["сократится", "вырастет", "не изменится"], a: 2, why: "Постоянные." },
    { th: "macro", q: "Инфляция?", opts: ["a", "b"], a: 0, why: "-" },
  ],
  cards: [
    { id: "c1", topic: "e-basic", topicLabel: "Эластичность", front: "Что такое эластичность?", back: "Отношение процентных изменений." },
    { id: "c2", topic: "e-properties", topicLabel: "Эластичность", front: "Когда выручка максимальна?", back: "При |E| = 1." },
    { id: "c3", topic: "s-monopoly", topicLabel: "Монополия", front: "Условие оптимума монополиста?", back: "MR = MC." },
    { id: "c4", topic: "i-price-controls", topicLabel: "Потолок", front: "Потолок у монополиста?", back: "Может увеличить объём." },
    { id: "c5", topic: "mk-gdp", topicLabel: "ВВП", front: "Что такое ВВП?", back: "Рыночная стоимость конечных благ." },
  ],
};

test("банк уроков: тесты, вопросы с вариантами и карточки приводятся к единому виду, макро не попадает", () => {
  const items = L.lavkaStudyItems(fakeBank);
  const ids = items.map((x) => x.id);
  assert.ok(ids.includes("test:t1") && ids.includes("card:c1") && ids.some((x) => x.startsWith("hard:")));
  assert.ok(!ids.includes("test:t9") && !ids.includes("card:c5"), "ВВП — не тема «Лавки»");
  assert.equal(items.filter((x) => x.id.startsWith("hard:")).length, 1, "только микро");
  for (const it of items) { assert.ok(it.a >= 0 && it.a < it.opts.length, it.id); assert.ok(it.chapter >= 1 && it.chapter <= 3); }
  const t1 = items.find((x) => x.id === "test:t1");
  assert.deepEqual(t1.opts, ["Верно", "Неверно"]); assert.equal(t1.a, 0);
  const c3 = items.find((x) => x.id === "card:c3");
  assert.equal(c3.opts[c3.a], "MR = MC."); assert.equal(new Set(c3.opts).size, c3.opts.length);
  assert.equal(items.find((x) => x.id === "test:t5").chapter, 2);
  assert.equal(items.find((x) => x.id === "card:c4").chapter, 3);
});

test("выбор вопроса: детерминирован по дню, только открытые главы, без повторов, слабые темы чаще", () => {
  const items = L.lavkaStudyItems(fakeBank);
  const a = L.lavkaPickQuiz(items, { day: 5, chapter: 1, seen: [], weak: [] });
  assert.equal(a.id, L.lavkaPickQuiz(items, { day: 5, chapter: 1, seen: [], weak: [] }).id);
  for (let d = 1; d < 40; d++) assert.equal(L.lavkaPickQuiz(items, { day: d, chapter: 1, seen: [], weak: [] }).chapter, 1);
  const seen = items.filter((x) => x.chapter === 1).map((x) => x.id).slice(1);
  const left = items.filter((x) => x.chapter === 1).map((x) => x.id)[0];
  assert.equal(L.lavkaPickQuiz(items, { day: 9, chapter: 1, seen, weak: [] }).id, left);
  let weakHits = 0, base = 0;
  for (let d = 1; d < 400; d++) {
    if (L.lavkaPickQuiz(items, { day: d, chapter: 3, seen: [], weak: ["s-monopoly"] }).topic === "s-monopoly") weakHits++;
    if (L.lavkaPickQuiz(items, { day: d, chapter: 3, seen: [], weak: [] }).topic === "s-monopoly") base++;
  }
  assert.ok(weakHits > base * 1.8, `слабая тема: ${weakHits} против ${base}`);
  assert.equal(L.lavkaPickQuiz([], { day: 3, chapter: 1, seen: [], weak: [] }).id.startsWith("lavka:"), true, "пустой банк → свои задачи");
});

test("слабые темы из прогресса SM-2 (только чтение)", () => {
  const now = Date.UTC(2026, 9, 1);
  const weak = L.lavkaWeakTopics(fakeBank.cards, { c1: { ease: 1.6, due: now + 1e9 }, c2: { ease: 2.6, due: now - 1 }, c3: { ease: 2.6, due: now + 1e9 } }, { c4: { at: 1, topic: "i-price-controls" } }, now);
  assert.deepEqual(weak.sort(), ["e-basic", "e-properties", "i-price-controls"]);
});
