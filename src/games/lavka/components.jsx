/* Общие компоненты экранов «Пути компании» (уровни 1 и 2). Вынесены из ui.jsx без изменений. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, LAVKA_MEDALS } from "./model.js";
import { CAPITAL, CITY_PROFIT, capitalCompare } from "./capital.js";

function LavkaStepper({ value, onChange, step = 1, min = 0, max = 9999, suffix }) {
  const btn = { background: COLORS.paperDeep, color: COLORS.ink, border: `1px solid ${COLORS.line}` };
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(min, value - step))} className="w-8 h-8 rounded-full text-sm" style={btn} aria-label="Меньше">−</button>
      <span className="text-sm text-center" style={{ minWidth: 58, fontFamily: LAVKA_MONO, color: COLORS.ink }}>{value}{suffix}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="w-8 h-8 rounded-full text-sm" style={btn} aria-label="Больше">+</button>
    </div>
  );
}

function LavkaAwning({ title, sub }) {
  const stripe = COLORS.sage;
  return (
    <div className="relative mb-5" style={{ borderRadius: 22, overflow: "hidden", border: `1px solid ${COLORS.line}`, background: COLORS.surfaceSolid }}>
      <div style={{ height: 34, background: `repeating-linear-gradient(90deg, ${stripe} 0 28px, ${COLORS.surfaceSolid} 28px 56px)` }} />
      <div style={{ height: 12, background: `radial-gradient(circle at 14px 0, ${stripe} 13px, transparent 14px) 0 0 / 56px 12px repeat-x, radial-gradient(circle at 42px 0, ${COLORS.paperDeep} 13px, transparent 14px) 0 0 / 56px 12px repeat-x` }} />
      <div className="px-5 pb-4 pt-2">
        <p className="text-2xl" style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</p>
        {sub && <p className="text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{sub}</p>}
      </div>
    </div>
  );
}

function LavkaCard({ children, tint, style }) {
  return (
    <div className="p-4 mb-3" style={{ background: tint || COLORS.surfaceSolid, border: `1px solid ${COLORS.line}`, borderRadius: 18, boxShadow: COLORS.cardShadow, ...style }}>
      {children}
    </div>
  );
}

const rub = (x) => `${Math.round(x).toLocaleString("ru-RU")} ₽`;
const fmt2 = (x, d = 3) => x.toFixed(d).replace(".", ",");

/* Экзамен уровня сдан с медалью → продать бизнес Плотникову или оставить дочкой (общая для уровней 1–4).
   Плотников видит только медаль и платит по средней прибыли продающих («рынок лимонов»); дивиденд дочки зависит
   от настоящей эффективности владельца. Обе стороны — по одной ставке r и одному горизонту. */
function LevelFinishCapital({ level, examBest, nextTitle, business, onFinish }) {
  const [sure, setSure] = useState(null);
  const medalId = examBest && examBest.medal;
  if (!medalId) return null;
  const medal = LAVKA_MEDALS.find((m) => m.id === medalId);
  const piBot = examBest.piBot != null ? examBest.piBot : CITY_PROFIT[level];
  const c = capitalCompare(level, medalId, examBest.eff, piBot);
  const N = CAPITAL.horizon[level], grant = CAPITAL.grant[level + 1] || 0;
  const btn = { background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 };
  const ghost = { border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontWeight: 600 };
  return (
    <LavkaCard tint={COLORS.sageSoft}>
      <p className="font-semibold">{medal.emoji} Уровень {level} сдан — можно открыть уровень {level + 1} «{nextTitle}»</p>
      <ul className="text-sm mt-1 list-disc pl-5" style={{ color: COLORS.ink }}>
        <li><b>Продать Плотникову</b>: {rub(c.sale)}. Он видит только медаль и платит как за среднего продающего с такой медалью:
          V = s·ē·π̄_город·F = 0,3 × {String(CAPITAL.medalE[medalId]).replace(".", ",")} × {rub(CITY_PROFIT[level])} × {fmt2(c.F)}.</li>
        <li><b>Оставить дочкой</b>: {rub(c.D)} в день = s·e·π̄_эт = 0,3 × {Math.round(examBest.eff * 100)}% × {rub(piBot)} (прибыль эталона на твоём экзамене).
          PV = D·F = {rub(c.keepPV)}.</li>
      </ul>
      <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
        F = a(2%, {N}) + a(2%, 30)/1,02^{N}: дивиденды идут {N} дней до финала, а в финале дочка продаётся вместе с холдингом.
        Ставка r = 2% в день — игровая. Продают те, кому держать невыгодно, поэтому средняя прибыль продающих ниже средней по всем — и цена Плотникова тоже.
        {c.keepBetter ? " Тебе выгоднее оставить." : " Тебе выгоднее продать."} Старт уровня {level + 1} — грант {rub(grant)} плюс выбранное.
      </p>
      {sure ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => onFinish(sure)} className="text-sm px-4 py-2 rounded-full" style={btn}>Да, {sure === "sell" ? "продать" : "оставить дочкой"} и перейти</button>
          <button onClick={() => setSure(null)} className="text-sm px-4 py-2 rounded-full" style={ghost}>Отмена</button>
        </div>
      ) : (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setSure("sell")} className="text-sm px-4 py-2 rounded-full" style={btn}>Продать за {rub(c.sale)}</button>
          <button onClick={() => setSure("keep")} className="text-sm px-4 py-2 rounded-full" style={ghost}>Оставить: {rub(c.D)}/день</button>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>{business} уйдёт в архив; касса уровня не переносится.</p>
    </LavkaCard>
  );
}

export { LavkaStepper, LavkaAwning, LavkaCard, LevelFinishCapital };
