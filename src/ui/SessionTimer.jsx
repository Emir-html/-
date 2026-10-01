/* Таймер сессии MirStudy — вынесен из App.jsx без изменений (нужен и приложению, и «Лавке»). */
import React, { useState, useEffect, useMemo } from "react";
import { COLORS } from "./theme.js";

/* ===== ТАЙМЕР СЕССИИ =====
   Показывает время текущей сессии и суммарное время за сегодня.
   Пауза при уходе со вкладки, чтобы не накручивать время впустую. */
/* День считаем по UTC+5: начинается в 00:00 и заканчивается в 23:59 по этому поясу. */
function dayKeyUTC5() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function SessionTimer() {
  const [sec, setSec] = useState(0);
  const [st, setSt] = useState({ total: 0, today: 0, last: 0, day: dayKeyUTC5(), days: {} });
  const [active, setActive] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  /* Загрузка: поднимаем накопленное, переносим прошлую сессию, при смене суток обнуляем дневной счётчик. */
  useEffect(() => {
    (async () => {
      const BASE_TOTAL = 47 * 3600;   // время до появления счётчика
      const BASE_TODAY = 2 * 3600;    // уже проведённое сегодня
      let v = null;
      try {
        const r = await window.storage.get("time-v2");
        if (r) v = JSON.parse(r.value);
      } catch (e) { /* первый запуск */ }

      const today = dayKeyUTC5();
      let next;
      if (!v) {
        next = { total: BASE_TOTAL + BASE_TODAY, today: BASE_TODAY, last: 0, day: today,
                 days: { [today]: BASE_TODAY }, running: 0 };
      } else {
        const sameDay = v.day === today;
        next = {
          total: v.total || 0,
          today: sameDay ? (v.today || 0) : 0,      // новые сутки — счётчик дня с нуля
          last: v.running || v.last || 0,           // прошлая сессия = то, что шло в прошлый заход
          day: today,
          days: v.days || {},
          running: 0,
        };
      }
      setSt(next);
      try { window.storage.set("time-v2", JSON.stringify(next)); } catch (e) { /* не критично */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSec((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  /* Каждые 5 секунд пишем реальное накопленное время — и посекундную историю по дням. */
  useEffect(() => {
    if (!loaded || sec === 0 || sec % 5 !== 0) return;
    const today = dayKeyUTC5();
    /* Если сутки сменились прямо во время сессии — переводим счётчик дня на новые сутки. */
    if (today !== st.day) {
      setSt((p) => ({ ...p, day: today, today: 0 }));
      setSec(0);
      return;
    }
    const payload = {
      total: st.total + sec,
      today: st.today + sec,
      last: st.last,
      day: today,
      days: { ...st.days, [today]: st.today + sec },
      running: sec,
    };
    try { window.storage.set("time-v2", JSON.stringify(payload)); } catch (e) { /* не критично */ }
  }, [sec, loaded, st]);

  const fmt = (t) => {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = t % 60;
    return h > 0 ? `${h} ч ${m} мин` : m > 0 ? `${m} мин ${String(ss).padStart(2, "0")} с` : `${ss} с`;
  };
  const short = (t) => {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = t % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
  };

  /* Последние 7 дней для мини-истории. */
  const recent = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + 5 * 3600 * 1000 - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const val = key === st.day ? st.today + sec : (st.days?.[key] || 0);
      out.push({ key, label: String(d.getUTCDate()).padStart(2, "0") + "." + String(d.getUTCMonth() + 1).padStart(2, "0"), val });
    }
    return out;
  }, [st, sec]);
  const maxDay = Math.max(1, ...recent.map((r) => r.val));

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        title="Время в приложении"
        style={{ background: COLORS.paperDeep, border: `1px solid ${COLORS.line}` }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? COLORS.sage : COLORS.inkSoft, flexShrink: 0 }} />
        <span className="text-xs font-medium tabular-nums" style={{ color: COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{short(sec)}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 p-3.5 z-50 ms-rise" style={{ background: COLORS.surfaceSolid, border: `1px solid ${COLORS.line}`, borderRadius: 20, minWidth: 250, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <p className="text-xs font-semibold mb-2.5 uppercase tracking-wide" style={{ color: COLORS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>Время в приложении</p>
          {[
            ["Сейчас идёт", fmt(sec), COLORS.sage],
            ["Прошлая сессия", st.last ? fmt(st.last) : "—", COLORS.inkSoft],
            ["Сегодня", fmt(st.today + sec), COLORS.blue],
            ["За всё время", fmt(st.total + sec), COLORS.teal],
          ].map(([k, v, c]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-1">
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>{k}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: c, fontFamily: "'IBM Plex Mono', monospace" }}>{v}</span>
            </div>
          ))}
          <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
            <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Последние 7 дней</p>
            <div className="flex items-end gap-1" style={{ height: 40 }}>
              {recent.map((r) => (
                <div key={r.key} className="flex-1 flex flex-col items-center gap-1" title={`${r.label}: ${fmt(r.val)}`}>
                  <div style={{ width: "100%", height: Math.max(2, (r.val / maxDay) * 30), background: r.val > 0 ? COLORS.teal : COLORS.line, borderRadius: 2 }} />
                  <span style={{ fontSize: 8, color: COLORS.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{r.label.slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs mt-2.5 pt-2" style={{ color: COLORS.inkSoft, borderTop: `1px solid ${COLORS.line}` }}>
            Сутки считаются по UTC+5 {!active && <span style={{ color: COLORS.amber }}>· пауза</span>}
          </p>
        </div>
      )}
    </div>
  );
}

export { dayKeyUTC5, SessionTimer };
