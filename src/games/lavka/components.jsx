/* Общие компоненты экранов «Пути компании» (уровни 1 и 2). Вынесены из ui.jsx без изменений. */
import React from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO } from "./model.js";

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

export { LavkaStepper, LavkaAwning, LavkaCard };
