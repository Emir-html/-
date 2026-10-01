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
