/* Тесты банка «Вопросов дня» сценария: node --test quiz-scenario.test.js */
import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIO_QUIZ, scenarioQuiz } from "./quiz-scenario.js";
import * as L from "./model.js";

test("100 вопросов, по 20 на уровень; у каждого 3 варианта, верный индекс в диапазоне, есть объяснение", () => {
  assert.equal(SCENARIO_QUIZ.length, 100);
  for (let l = 1; l <= 5; l++) assert.equal(scenarioQuiz(l).length, 20);
  assert.equal(new Set(SCENARIO_QUIZ.map((x) => x.id)).size, 100);
  for (const x of SCENARIO_QUIZ) {
    assert.equal(x.opts.length, 3, x.id); assert.ok(x.a >= 0 && x.a < 3, x.id); assert.ok(x.why && x.q, x.id);
  }
});

test("правки экономиста на месте: дискретный MRP (13 при МРОТ 2 300), пик 400, наказание 5 дней, паводок 50%", () => {
  const by = (id) => SCENARIO_QUIZ.find((x) => x.id === id);
  assert.match(by("L4-13").opts[by("L4-13").a], /^13/);
  assert.match(by("L4-19").q, /400/); assert.equal(by("L4-20").a, 0);
  assert.match(by("L2-20").q, /5 дней/); assert.match(by("L5-18").q, /50%/);
});

test("уровень 1: вопросы сценария входят в пул «Вопроса дня» с главой 1–3", () => {
  const items = L.lavkaStudyItems({}).filter((x) => x.id.startsWith("scen:"));
  assert.equal(items.length, 20);
  assert.ok(items.every((x) => [1, 2, 3].includes(x.chapter)));
});
