/* «Лавка» — экраны (React). Вынесено из App.jsx (блок «ПЕРЕРЫВ · ЛАВКА») без изменений логики.
   Тема и таймер — из src/ui, логика — из ./model.js. Хранилище — window.storage, ключ "lavka-save". */
import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Moon, Sun, Check, RotateCcw, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { COLORS, pageBackground, PAGE_BG_SIZE } from "../../ui/theme.js";
import { SessionTimer } from "../../ui/SessionTimer.jsx";
import {
  LAVKA_PRODUCTS, LAVKA_POINTS, LAVKA_CAPACITY, LAVKA_HELPER_CAP, LAVKA_HELPER_WAGE, LAVKA_FRIDGE_KEEP,
  LAVKA_WEEKDAYS, LAVKA_UPGRADES, LAVKA_EVENTS, LAVKA_GOALS, LAVKA_QUIZ, LAVKA_MONO,
  lavkaWeekday, lavkaUnlocked, lavkaOpenPoints, lavkaNewState, lavkaParams, lavkaSimulate, lavkaFit, lavkaFmt, lavkaRub,
  lavkaVerdict, lavkaLoad, lavkaShownLambda,
} from "./model.js";
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

function LavkaEventCard({ st }) {
  const [open, setOpen] = useState(false);
  const ev = st.event;
  if (!ev) {
    return (
      <LavkaCard>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>🌤 Без событий — хороший момент проверить цену: такие дни попадают в тетрадь как «чистые» наблюдения.</p>
      </LavkaCard>
    );
  }
  const def = LAVKA_EVENTS[ev.id];
  const pids = lavkaUnlocked(st);
  const moved = [];
  for (const point of lavkaOpenPoints(st)) for (const pid of pids) {
    const a = lavkaParams(st, point, pid, true), b = lavkaParams(st, point, pid);
    if (!b.base) moved.push({ point, pid, a, b });
  }
  return (
    <LavkaCard tint={COLORS.amberSoft}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{def.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{def.title}</p>
          <p className="text-sm mt-0.5" style={{ color: COLORS.ink }}>{def.text(ev)}</p>
          {ev.id === "competitor" && (
            <p className="text-sm mt-1.5" style={{ color: COLORS.ink }}>Цена Семёна сегодня: <b style={{ fontFamily: LAVKA_MONO }}>{ev.compPrice} ₽</b></p>
          )}
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Осталось дней: {ev.daysLeft}</p>
          <button onClick={() => setOpen(!open)} className="text-xs mt-2 flex items-center gap-1" style={{ color: COLORS.ink, fontWeight: 600 }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Что говорит теория
          </button>
          {open && (
            <div className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.ink }}>
              <p>{def.theory(ev)}</p>
              {moved.length > 0 && (
                <div className="mt-2 rounded-xl p-3" style={{ background: COLORS.surfaceSolid }}>
                  {moved.map(({ point, pid, a, b }) => (
                    <p key={point + pid} className="text-xs" style={{ fontFamily: LAVKA_MONO, color: COLORS.inkSoft }}>
                      {LAVKA_PRODUCTS[pid].emoji} {LAVKA_POINTS[point].name}: P* обычно ≈ {a.pOpt.toFixed(1)} ₽ → сегодня ≈ {b.pOpt.toFixed(1)} ₽
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </LavkaCard>
  );
}

function LavkaQuizCard({ st, onAnswer }) {
  const [picked, setPicked] = useState(null);
  const idx = ((st.day - 1) * 7) % LAVKA_QUIZ.length;
  const item = LAVKA_QUIZ[idx];
  /* Порядок вариантов перемешан детерминированно по дню, чтобы верный не стоял всегда вторым. */
  const order = item.opts.map((_, i) => i).sort((a, b) => ((a * 7 + st.day * 3) % 5) - ((b * 7 + st.day * 3) % 5));
  const answered = st.quiz?.lastDay === st.day;
  if (answered && picked == null) return null;
  return (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="text-xs" style={{ color: COLORS.inkSoft }}>Вопрос дня · +400 ₽ за верный ответ</p>
      <p className="text-sm font-semibold mt-1">{item.q}</p>
      <div className="flex flex-col gap-1.5 mt-3">
        {order.map((i) => {
          const isRight = i === item.a, isPicked = picked === i;
          const bg = picked == null ? COLORS.surfaceSolid : isRight ? COLORS.sageSoft : isPicked ? COLORS.rustSoft : COLORS.surfaceSolid;
          const bd = picked == null ? COLORS.line : isRight ? COLORS.sage : isPicked ? COLORS.rust : COLORS.line;
          return (
            <button key={i} disabled={picked != null} onClick={() => { setPicked(i); onAnswer(i === item.a); }}
              className="text-left text-sm px-3.5 py-2 rounded-xl" style={{ background: bg, border: `1px solid ${bd}`, color: COLORS.ink }}>
              {item.opts[i]}
            </button>
          );
        })}
      </div>
      {picked != null && (
        <p className="text-sm mt-3 leading-relaxed" style={{ color: COLORS.ink }}>
          {picked === item.a ? "✅ Верно. " : "Не совсем. "}{item.why}
        </p>
      )}
    </LavkaCard>
  );
}

function LavkaProductRow({ st, point, pid, onSet, fit }) {
  const pr = LAVKA_PRODUCTS[pid];
  const m = lavkaParams(st, point, pid);
  const set = st.settings[point][pid];
  const carried = st.stock[point][pid] || 0;
  const lastRow = st.last?.rows?.find((r) => r.point === point && r.pid === pid);
  const base = lavkaParams(st, point, pid, true);
  const maxP = Math.ceil((base.choke * 1.3) / 10) * 10;
  const effP = m.cap != null ? Math.min(set.price, m.cap) : set.price;
  /* Оценка тетради — для «обычного будня»; умножаем на сегодняшний k (день недели × лояльность × вывеска).
     В дни событий кривая другая, поэтому прогноз не показываем. */
  const est = fit && m.base ? Math.max(0, Math.round((fit.alpha - fit.beta * effP) * m.k)) : null;
  const estProfit = est != null ? (effP - m.mc) * Math.min(est, carried + set.order) - m.cBuy * Math.max(0, carried + set.order - est) * (st.upgrades.fridge ? 1 - LAVKA_FRIDGE_KEEP : 1) : null;
  const pill = (txt, bg, fg) => <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: bg, color: fg }}>{txt}</span>;
  return (
    <LavkaCard>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl">{pr.emoji}</span>
        <p className="font-semibold">{pr.name}</p>
        <span className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>закупка {m.cBuy.toFixed(0)} ₽/{pr.unit}</span>
        <span className="flex-1" />
        {m.tax > 0 && pill(`акциз ${m.tax} ₽`, COLORS.rustSoft, COLORS.rust)}
        {m.cap != null && pill(`потолок ${m.cap} ₽`, COLORS.blueSoft, COLORS.blue)}
        {m.comp != null && pill(`Семён: ${m.comp} ₽`, COLORS.rustSoft, COLORS.rust)}
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs mb-1" style={{ color: COLORS.inkSoft }}>Цена</p>
          <div className="flex items-center gap-2">
            <LavkaStepper value={set.price} onChange={(v) => onSet({ price: v })} min={1} max={maxP} suffix=" ₽" />
          </div>
          <input type="range" min={1} max={maxP} value={Math.min(set.price, maxP)} onChange={(e) => onSet({ price: Number(e.target.value) })}
            className="w-full mt-2" style={{ accentColor: COLORS.sage }} aria-label={`Цена: ${pr.name}`} />
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: COLORS.inkSoft }}>Закупить утром{carried > 0 ? ` (в холодильнике уже ${carried})` : ""}</p>
          <LavkaStepper value={set.order} onChange={(v) => onSet({ order: v })} step={5} max={400} />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {lastRow && (
              <button onClick={() => onSet({ order: Math.max(0, lastRow.D - carried) })} className="text-xs px-2.5 py-1 rounded-full"
                style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>как вчерашний спрос: {lastRow.D}</button>
            )}
            {est != null && (
              <button onClick={() => onSet({ order: Math.max(0, est - carried) })} className="text-xs px-2.5 py-1 rounded-full"
                style={{ border: `1px solid ${COLORS.sage}`, color: COLORS.sage }}>по оценке спроса: {est}</button>
            )}
          </div>
        </div>
      </div>

      {est != null && (
        <p className="text-xs mt-3" style={{ color: COLORS.ink, fontFamily: LAVKA_MONO }}>
          📓 при {effP} ₽ придут ≈ {est}, маржа минус порча ≈ {lavkaRub(estProfit)}
        </p>
      )}
      {lastRow && (
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>
          вчера: {lastRow.P} ₽, хотели {lastRow.D}, продано {lastRow.S}
          {lastRow.mr != null && (() => { const lam = lavkaShownLambda(lastRow.lambda), t = lastRow.mc + lam;
            return <> , MR {lastRow.mr.toFixed(0)} {Math.abs(lastRow.mr - t) <= 3 ? "≈" : lastRow.mr > t ? ">" : "<"} {lam > 0 ? `MC + λ ${t.toFixed(0)}` : `MC ${lastRow.mc.toFixed(0)}`}</>; })()}
        </p>
      )}
    </LavkaCard>
  );
}

function LavkaDemandChart({ st, point, pid }) {
  const list = st.obs[point]?.[pid] || [];
  const fit = st.upgrades.analyst ? lavkaFit(list) : null;
  const m = lavkaParams(st, point, pid, true);
  const W = 340, H = 230, L = 40, Bt = 30, R = 12, T = 12;
  const dn = (o) => o.D / (o.k || 1);
  const maxQ = Math.max(20, ...list.map(dn), fit ? fit.alpha : 0) * 1.1;
  const maxP = Math.max(20, ...list.map((o) => o.P), fit ? fit.alpha / fit.beta : 0, m.mc) * 1.1;
  const x = (q) => L + (q / maxQ) * (W - L - R), y = (p) => H - Bt - (p / maxP) * (H - Bt - T);
  let opt = null;
  if (fit) {
    const choke = fit.alpha / fit.beta;
    const pO = (choke + m.mc) / 2, qO = Math.max(0, fit.alpha - fit.beta * pO);
    opt = { choke, pO, qO };
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 480 }} role="img" aria-label="Наблюдения спроса">
        <line x1={L} y1={T} x2={L} y2={H - Bt} stroke={COLORS.inkSoft} />
        <line x1={L} y1={H - Bt} x2={W - R} y2={H - Bt} stroke={COLORS.inkSoft} />
        <text x={L - 6} y={T + 8} textAnchor="end" fontSize="10" fill={COLORS.inkSoft}>P</text>
        <text x={W - R} y={H - Bt + 16} textAnchor="end" fontSize="10" fill={COLORS.inkSoft}>Q</text>
        {[0.25, 0.5, 0.75].map((f) => (
          <text key={f} x={L - 5} y={y(maxP * f) + 3} textAnchor="end" fontSize="9" fill={COLORS.inkSoft}>{Math.round(maxP * f)}</text>
        ))}
        {[0.5, 1].map((f) => (
          <text key={f} x={x(maxQ * f * 0.9)} y={H - Bt + 14} textAnchor="middle" fontSize="9" fill={COLORS.inkSoft}>{Math.round(maxQ * f * 0.9)}</text>
        ))}
        {fit && opt && (
          <g>
            <line x1={x(0)} y1={y(opt.choke)} x2={x(fit.alpha)} y2={y(0)} stroke={COLORS.sage} strokeWidth="2" />
            <line x1={x(0)} y1={y(opt.choke)} x2={x(fit.alpha / 2)} y2={y(0)} stroke={COLORS.blue} strokeWidth="2" strokeDasharray="5 4" />
            <line x1={L} y1={y(m.mc)} x2={W - R} y2={y(m.mc)} stroke={COLORS.rust} strokeWidth="2" />
            <line x1={x(opt.qO)} y1={y(opt.pO)} x2={x(opt.qO)} y2={H - Bt} stroke={COLORS.inkSoft} strokeDasharray="3 3" />
            <line x1={L} y1={y(opt.pO)} x2={x(opt.qO)} y2={y(opt.pO)} stroke={COLORS.inkSoft} strokeDasharray="3 3" />
            <circle cx={x(opt.qO)} cy={y(opt.pO)} r="5" fill={COLORS.ink} />
            <circle cx={x(opt.qO)} cy={y(m.mc)} r="3.5" fill={COLORS.blue} />
            <text x={W - R} y={y(m.mc) - 5} textAnchor="end" fontSize="10" fill={COLORS.rust}>MC</text>
            <text x={x(fit.alpha / 2) + 4} y={y(0) - 6} fontSize="10" fill={COLORS.blue}>MR</text>
            <text x={x(fit.alpha) - 4} y={y(0) - 6} textAnchor="end" fontSize="10" fill={COLORS.sage}>D</text>
          </g>
        )}
        {list.map((o, i) => (
          <circle key={i} cx={x(dn(o))} cy={y(o.P)} r="4" fill={o.base ? COLORS.ink : "none"} stroke={COLORS.ink} strokeWidth="1.3" opacity={0.35 + 0.65 * ((i + 1) / list.length)} />
        ))}
      </svg>
      <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
        ● обычный день, ○ день события (в оценку не входит). Спрос пересчитан к обычному будню при лояльности 100%: выходные, лояльность и вывеска меняют число покупателей — известные множители, их убираем, чтобы видеть саму кривую.
      </p>
      {!st.upgrades.analyst && (
        <p className="text-sm mt-3" style={{ color: COLORS.ink }}>
          Пока это просто облако точек. Попробуй разные цены в обычные дни — точки выстроятся вдоль спроса. «Тетрадь аналитика» проведёт через них линию, построит MR и найдёт MR = MC.
        </p>
      )}
      {st.upgrades.analyst && !fit && (
        <p className="text-sm mt-3" style={{ color: COLORS.ink }}>
          Нужно хотя бы 3 обычных дня с разными ценами, чтобы оценить наклон спроса.
        </p>
      )}
      {fit && opt && (
        <div className="text-sm mt-3 leading-relaxed" style={{ color: COLORS.ink }}>
          <p>Оценка по {fit.n} дням: <b style={{ fontFamily: LAVKA_MONO }}>Q ≈ {fit.alpha.toFixed(1)} − {fit.beta.toFixed(2)}·P</b>, резервная цена ≈ {opt.choke.toFixed(1)} ₽.</p>
          <p className="mt-1">Выручка TR = P·Q = (α/β)·Q − Q²/β, поэтому MR = α/β − 2Q/β: у линейного спроса MR начинается там же, а падает вдвое круче.</p>
          <p className="mt-1">MC = {m.mc.toFixed(1)} ₽. MR = MC при Q* ≈ {opt.qO.toFixed(1)}, цену берём со спроса: <b>P* ≈ {opt.pO.toFixed(1)} ₽</b>.</p>
          <p className="mt-1" style={{ color: COLORS.inkSoft }}>Истина скрыта шумом ±8% — оценка уточняется с каждым днём, и тем точнее, чем шире разброс цен в наблюдениях: по трём почти одинаковым ценам наклон не определить. Постоянные издержки (аренда, зарплата) в эти расчёты не входят: на выбор цены они не влияют.</p>
        </div>
      )}
    </div>
  );
}

function LavkaProfitBars({ history }) {
  const h = history.slice(-30);
  if (!h.length) return null;
  const mx = Math.max(1, ...h.map((d) => Math.abs(d.profit)));
  const W = 340, H = 90, mid = 55, bw = W / Math.max(h.length, 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 480 }} role="img" aria-label="Прибыль по дням">
      <line x1="0" y1={mid} x2={W} y2={mid} stroke={COLORS.line} />
      {h.map((d, i) => {
        const hh = (Math.abs(d.profit) / mx) * (d.profit >= 0 ? mid - 6 : H - mid - 6);
        return <rect key={d.day} x={i * bw + 1} y={d.profit >= 0 ? mid - hh : mid} width={Math.max(2, bw - 3)} height={hh} rx="2"
          fill={d.profit >= 0 ? COLORS.sage : COLORS.rust} />;
      })}
    </svg>
  );
}

function LavkaReport({ rep, st, onNext }) {
  const line = (label, v, strong) => (
    <div className="flex justify-between text-sm py-1" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <span style={{ color: strong ? COLORS.ink : COLORS.inkSoft, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontFamily: LAVKA_MONO, fontWeight: strong ? 700 : 400 }}>{v}</span>
    </div>
  );
  const verdict = lavkaVerdict;
  const multi = lavkaOpenPoints(st).length > 1;
  return (
    <div className="ms-rise">
      <LavkaCard tint={rep.profit >= 0 ? COLORS.sageSoft : COLORS.rustSoft}>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>День {rep.day} закрыт</p>
        <p className="text-3xl mt-1" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: rep.profit >= 0 ? COLORS.sage : COLORS.rust }}>
          {rep.profit >= 0 ? "+" : ""}{lavkaRub(rep.profit)}
        </p>
        <div className="mt-3">
          {line("Выручка", lavkaRub(rep.revenue))}
          {line("Закупка товара", "−" + lavkaRub(rep.buyCost))}
          {rep.taxPaid > 0 && line("Акциз", "−" + lavkaRub(rep.taxPaid))}
          {line("Аренда и зарплаты (постоянные)", "−" + lavkaRub(rep.fixed))}
          {rep.repaid > 0 && line("Погашение кредита", "−" + lavkaRub(rep.repaid))}
          {rep.reward > 0 && line("Награды за цели", "+" + lavkaRub(rep.reward))}
          {line("На счёте", lavkaRub(st.cash), true)}
        </div>
      </LavkaCard>

      {rep.newGoals.length > 0 && (
        <LavkaCard tint={COLORS.amberSoft}>
          {rep.newGoals.map((id) => {
            const g = LAVKA_GOALS.find((x) => x.id === id);
            return <p key={id} className="text-sm font-semibold">{g.emoji} Цель выполнена: {g.title}{g.reward ? ` (+${lavkaFmt(g.reward)} ₽)` : ""}</p>;
          })}
        </LavkaCard>
      )}

      {rep.rows.map((r) => {
        const pr = LAVKA_PRODUCTS[r.pid];
        const cell = (label, v, c) => (
          <div>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{label}</p>
            <p className="text-sm" style={{ fontFamily: LAVKA_MONO, color: c || COLORS.ink }}>{v}</p>
          </div>
        );
        return (
          <LavkaCard key={r.point + r.pid}>
            <p className="font-semibold">{pr.emoji} {pr.name}{multi ? ` · ${LAVKA_POINTS[r.point].name}` : ""}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2">
              {cell("Цена", `${r.P} ₽`)}
              {cell("Хотели купить", r.D)}
              {cell("Продано", r.S)}
              {cell("|E| (по средней кривой)", r.el != null ? r.el.toFixed(2) : "—", r.el != null ? (r.el > 1 ? COLORS.sage : COLORS.rust) : undefined)}
              {r.lostStock > 0 && cell("Не хватило товара", r.lostStock, COLORS.rust)}
              {r.lostQueue > 0 && cell("Ушли из очереди", r.lostQueue, COLORS.rust)}
              {r.spoiled > 0 && cell("Выброшено", `${r.spoiled} (−${lavkaFmt(r.spoiled * r.cBuy)} ₽)`, COLORS.rust)}
              {r.carry > 0 && cell("В холодильник", r.carry)}
              {cell("Излишек покупателей", lavkaRub(r.cs))}
              {cell("Твой излишек", lavkaRub(r.ps))}
              {cell("DWL (к P = MC)", lavkaRub(r.dwl), COLORS.rust)}
            </div>
            <p className="text-sm mt-3" style={{ color: COLORS.ink }}>{verdict(r)}</p>
            {r.el != null && r.el < 1 && r.mr != null && (
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>|E| &lt; 1 — неэластичный участок: MR &lt; 0. Монополист здесь не стоит никогда: подняв цену, получишь больше выручки при меньших издержках.</p>
            )}
            {r.capacityBound && (
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Прилавок не справился с потоком: мощность — ещё одно ограничение.{lavkaShownLambda(r.lambda) > 0
                ? ` При лучших ценах место у прилавка стоило бы λ ≈ ${r.lambda.toFixed(0)} ₽ (теневая цена мощности), и правило становится MR = MC + λ: выгоднее поднять цены, чем держать очередь.`
                : " Мощности хватает на лучшие цены — очередь из-за низкой цены или случайного всплеска спроса."}</p>
            )}
          </LavkaCard>
        );
      })}

      {rep.repDelta && Object.entries(rep.repDelta).map(([p, d]) => {
        const up = d.to > d.from + 1e-9, down = d.to < d.from - 1e-9;
        return (
          <LavkaCard key={"rep" + p}>
            <p className="text-sm">
              💛 Лояльность{multi ? ` «${LAVKA_POINTS[p].name}»` : ""}: <b style={{ fontFamily: LAVKA_MONO }}>{Math.round(d.from * 100)}% → {Math.round(d.to * 100)}%</b>
            </p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
              {up ? "Почти всех обслужил — завтра придёт чуть больше людей."
                : down ? `Без товара ушли ${Math.round(d.lostShare * 100)}% желающих. Дефицит — скрытые издержки: сегодня ты сэкономил на закупке, а завтра спрос будет ниже.`
                : "Без изменений."}
            </p>
          </LavkaCard>
        );
      })}

      {rep.day % 7 === 0 && (() => {
        const h = st.history, w = h.slice(-7).reduce((a, d) => a + d.profit, 0), pw = h.slice(-14, -7).reduce((a, d) => a + d.profit, 0);
        return (
          <LavkaCard tint={COLORS.tealSoft}>
            <p className="font-semibold">Итоги недели {rep.day / 7}</p>
            <p className="text-sm mt-1" style={{ fontFamily: LAVKA_MONO }}>прибыль {lavkaRub(w)}{h.length > 7 ? ` (прошлая неделя ${lavkaRub(pw)}, ${w >= pw ? "+" : "−"}${lavkaFmt(Math.abs(w - pw))} ₽)` : ""}</p>
          </LavkaCard>
        );
      })()}

      <LavkaCard>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>Завтра</p>
        <p className="text-sm mt-0.5">
          {LAVKA_WEEKDAYS[lavkaWeekday(st.day)]}
          {lavkaWeekday(st.day) >= 5 ? " — выходной: в парке людно, у бизнес-центра пусто" : lavkaWeekday(st.day) === 4 ? " — пятница, вечером народу больше" : ""}
          {st.event ? ` · ${LAVKA_EVENTS[st.event.id].emoji} ${LAVKA_EVENTS[st.event.id].title}` : ""}
        </p>
      </LavkaCard>

      <button onClick={onNext} className="w-full py-3.5 rounded-full text-base mt-1" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>
        Следующее утро <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 12 }}>(Enter)</span>
      </button>
    </div>
  );
}

function LavkaRun({ rep, onDone }) {
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (t >= 1) { const id = setTimeout(onDone, 450); return () => clearTimeout(id); }
    const id = setInterval(() => setT((v) => Math.min(1, v + 0.012 * speed)), 90);
    return () => clearInterval(id);
  }, [t >= 1, speed]);
  const n = Math.floor(rep.tokens.length * t);
  const shown = rep.tokens.slice(0, n);
  const soldN = shown.filter((x) => x.ok).length, lostN = n - soldN;
  const rev = shown.reduce((s, x) => s + (x.ok ? x.P : 0), 0);
  const start = Math.max(0, n - 24);
  const hour = 8 + 12 * t, hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  const clockAt = (f) => { const h = 8 + 12 * f, H = Math.floor(h), M = Math.floor((h - H) * 6) * 10; return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`; };
  /* Когда товар закончился: номер токена, на котором продана последняя единица запаса. */
  const soldOut = useMemo(() => {
    const out = {}, cnt = {};
    rep.tokens.forEach((x, i) => {
      if (!x.ok) return;
      const key = x.point + x.pid;
      cnt[key] = (cnt[key] || 0) + 1;
      const row = rep.rows.find((r) => r.point === x.point && r.pid === x.pid);
      if (row && row.have > 0 && cnt[key] === row.have) out[key] = i / Math.max(1, rep.tokens.length);
    });
    return out;
  }, [rep]);
  const soldBy = {};
  for (const x of shown) if (x.ok) soldBy[x.point + x.pid] = (soldBy[x.point + x.pid] || 0) + 1;
  const multiPt = new Set(rep.rows.map((r) => r.point)).size > 1;
  const faces = ["🙂", "😊", "🧑", "👩", "👨", "🧒", "👵", "🧔"];
  return (
    <LavkaCard>
      <div className="flex items-center justify-between">
        <p className="text-3xl" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}</p>
        <div className="flex gap-1.5">
          {[1, 3].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: speed === s ? COLORS.onyx : COLORS.paperDeep, color: speed === s ? COLORS.onyxText : COLORS.ink }}>×{s}</button>
          ))}
          <button onClick={() => setT(1)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: COLORS.paperDeep, color: COLORS.ink }}>К итогам</button>
        </div>
      </div>
      <div className="w-full h-1.5 rounded-full mt-3" style={{ background: COLORS.paperDeep }}>
        <div className="h-1.5 rounded-full" style={{ width: `${t * 100}%`, background: COLORS.sage, transition: "width .09s linear" }} />
      </div>
      <div className="mt-4 space-y-2">
        {rep.rows.map((r) => {
          const key = r.point + r.pid, left = Math.max(0, r.have - (soldBy[key] || 0));
          const out = soldOut[key] != null && t >= soldOut[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-base w-6 text-center">{LAVKA_PRODUCTS[r.pid].emoji}</span>
              {multiPt && <span className="text-xs w-5">{LAVKA_POINTS[r.point].emoji}</span>}
              <div className="flex-1 h-2.5 rounded-full" style={{ background: COLORS.paperDeep }}>
                <div className="h-2.5 rounded-full" style={{ width: `${r.have ? (left / r.have) * 100 : 0}%`, background: out ? COLORS.rust : COLORS.amber, transition: "width .09s linear" }} />
              </div>
              <span className="text-xs text-right" style={{ fontFamily: LAVKA_MONO, minWidth: 104, color: out ? COLORS.rust : COLORS.inkSoft }}>
                {out ? `кончилось в ${clockAt(soldOut[key])}` : `осталось ${left}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-4" style={{ minHeight: 92, alignContent: "flex-start" }}>
        {shown.slice(start).map((x, i) => (
          <span key={start + i} className="lavka-pop text-sm px-2 py-1 rounded-full"
            style={{ background: x.ok ? COLORS.sageSoft : COLORS.rustSoft }}>
            {faces[(start + i) % faces.length]}{x.ok ? LAVKA_PRODUCTS[x.pid].emoji : "💨"}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[["Продано", soldN, COLORS.sage], ["Выручка", lavkaRub(rev), COLORS.ink], ["Ушли ни с чем", lostN, COLORS.rust]].map(([l, v, c]) => (
          <div key={l}>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{l}</p>
            <p className="text-lg" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: c }}>{v}</p>
          </div>
        ))}
      </div>
    </LavkaCard>
  );
}

function LavkaScreen({ onBack, theme, onToggleTheme }) {
  const [st, setSt] = useState(null);
  const [tab, setTab] = useState("shop");
  const [point, setPoint] = useState("main");
  const [phase, setPhase] = useState("morning"); // morning | running | report
  const [rep, setRep] = useState(null);
  const [toast, setToast] = useState(null);
  const [nbPid, setNbPid] = useState("lemonade");
  const [confirmReset, setConfirmReset] = useState(false);
  const enterRef = React.useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Enter" || e.repeat) return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "BUTTON" || tag === "TEXTAREA" || tag === "SELECT") return; // кнопка нажмётся сама
      if (enterRef.current) { e.preventDefault(); enterRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    (async () => {
      let raw = null;
      try { const r = await window.storage.get("lavka-save"); if (r) raw = r.value; } catch (e) {}
      setSt(lavkaLoad(raw));
    })();
  }, []);

  const save = (s) => { window.storage.set("lavka-save", JSON.stringify({ ...s, at: Date.now() }), false).catch(() => {}); };
  const update = (fn, persist = true) => setSt((prev) => { const n = fn(prev); if (persist) save(n); return n; });
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4200); };

  if (!st) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.paper, color: COLORS.inkSoft }}><Loader2 className="animate-spin" /></div>;
  }

  const points = lavkaOpenPoints(st), pids = lavkaUnlocked(st);
  const curPoint = points.includes(point) ? point : "main";
  const orderCost = points.reduce((s, p) => s + pids.reduce((t, pid) => t + lavkaParams(st, p, pid).cBuy * st.settings[p][pid].order, 0), 0);
  const canOpen = orderCost === 0 || orderCost <= st.cash + 1e-9;

  const setProd = (p, pid, patch) => update((s) => ({ ...s, settings: { ...s.settings, [p]: { ...s.settings[p], [pid]: { ...s.settings[p][pid], ...patch } } } }));

  const openShop = () => {
    const { next, report } = lavkaSimulate(st);
    setRep(report); setSt(next); save(next); setPhase("running");
  };

  const buy = (u) => {
    if (st.cash < u.cost || st.upgrades[u.id]) return;
    update((s) => {
      const n = { ...s, cash: s.cash - u.cost, upgrades: { ...s.upgrades, [u.id]: true } };
      if (u.id === "office") n.settings = { ...s.settings, office: { ...s.settings.main } };
      return n;
    });
    flash(`${u.emoji} ${u.title}. ${u.lesson}`);
  };

  const answerQuiz = (ok) => {
    const right = (st.quiz?.right || 0) + (ok ? 1 : 0);
    const goal = right >= 10 && !st.goals.quiz10;
    const bonus = (ok ? 400 : 0) + (goal ? LAVKA_GOALS.find((g) => g.id === "quiz10").reward : 0);
    update((s) => ({
      ...s, cash: s.cash + bonus,
      quiz: { lastDay: s.day, right, total: (s.quiz?.total || 0) + 1 },
      goals: goal ? { ...s.goals, quiz10: s.day } : s.goals,
    }));
    if (goal) flash("🎓 Цель выполнена: Экономист у прилавка (+2 000 ₽)");
  };

  const takeLoan = () => update((s) => ({ ...s, cash: s.cash + 3000, debt: (s.debt || 0) + 3300 }));

  enterRef.current = phase === "morning" && tab === "shop" && canOpen ? openShop
    : phase === "report" ? () => { setPhase("morning"); setTab("shop"); window.scrollTo?.(0, 0); } : null;

  const tabs = [["shop", "Лавка"], ["upgrades", "Улучшения"], ["notebook", "Тетрадь"], ["goals", "Цели"]];
  const nbPids = pids.includes(nbPid) ? nbPid : pids[0];
  const nbFit = (p, pid) => (st.upgrades.analyst ? lavkaFit(st.obs[p]?.[pid]) : null);

  return (
    <div className="min-h-screen w-full" style={{ background: pageBackground(), backgroundSize: PAGE_BG_SIZE, color: COLORS.ink, fontFamily: "'Figtree', ui-sans-serif, sans-serif" }}>
      <style>{`
        @keyframes lavkaPop { from { transform: translateY(6px) scale(.85); opacity: 0 } to { transform: none; opacity: 1 } }
        .lavka-pop { animation: lavkaPop .28s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .lavka-pop { animation: none; } }
      `}</style>
      <header className="max-w-3xl mx-auto px-5 pt-8 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button onClick={onBack} className="text-xs flex items-center gap-1" style={{ color: COLORS.inkSoft }}>
            <ArrowLeft size={13} /> На главный экран
          </button>
          <div className="flex items-center gap-2">
            <SessionTimer />
            <button onClick={onToggleTheme} className="flex items-center gap-2 px-4 py-2.5 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText }}
              aria-label="Сменить тему">
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 pb-24">
        <LavkaAwning title="Лавка" sub={`День ${st.day}, ${LAVKA_WEEKDAYS[lavkaWeekday(st.day)]} · на счёте ${lavkaRub(st.cash)}${st.debt > 0 ? ` · долг ${lavkaRub(st.debt)}` : ""} · лояльность ${points.map((p) => Math.round(((st.rep || {})[p] || 1) * 100) + "%").join(" / ")}`} />

        {phase === "morning" && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className="text-sm px-4 py-2 rounded-full"
                style={{ background: tab === id ? COLORS.onyx : COLORS.surfaceSolid, color: tab === id ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {phase === "running" && rep && <LavkaRun rep={rep} onDone={() => setPhase("report")} />}
        {phase === "report" && rep && <LavkaReport rep={rep} st={st} onNext={() => { setPhase("morning"); setTab("shop"); window.scrollTo?.(0, 0); }} />}

        {phase === "morning" && tab === "shop" && (
          <div>
            {st.day === 1 && !st.last && (
              <LavkaCard tint={COLORS.sageSoft}>
                <p className="text-sm leading-relaxed">
                  Ты открыл маленькую лавку у парка. Каждое утро выбираешь цену и сколько закупить, потом смотришь, как проходит день.
                  Непроданное к вечеру портится, аренда 400 ₽ в день. Спрос у каждого товара свой, а заранее его никто не скажет —
                  его придётся нащупать. Цель простая: найти цену, при которой прибыль максимальна.
                  По выходным в парке людно, а если товара не хватает, лояльность падает и завтра придёт меньше людей.
                </p>
              </LavkaCard>
            )}
            <LavkaEventCard st={st} />
            {st.day > 1 && <LavkaQuizCard key={st.day} st={st} onAnswer={answerQuiz} />}
            {points.length > 1 && (
              <div className="flex gap-1.5 mb-3">
                {points.map((p) => (
                  <button key={p} onClick={() => setPoint(p)} className="text-sm px-4 py-2 rounded-full"
                    style={{ background: curPoint === p ? COLORS.sageSoft : COLORS.surfaceSolid, color: COLORS.ink, border: `1px solid ${curPoint === p ? COLORS.sage : COLORS.line}` }}>
                    {LAVKA_POINTS[p].emoji} {LAVKA_POINTS[p].name}
                  </button>
                ))}
              </div>
            )}
            {pids.map((pid) => (
              <LavkaProductRow key={curPoint + pid} st={st} point={curPoint} pid={pid} fit={nbFit(curPoint, pid)} onSet={(patch) => setProd(curPoint, pid, patch)} />
            ))}
            <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
              Пропускная способность: {LAVKA_CAPACITY + (st.upgrades.helper ? LAVKA_HELPER_CAP : 0)} покупателей в день на точку.
              Постоянные издержки: {lavkaRub(points.reduce((s, p) => s + LAVKA_POINTS[p].rent + (st.upgrades.helper ? LAVKA_HELPER_WAGE : 0), 0))} в день.
            </p>
            <button onClick={openShop} disabled={!canOpen} className="w-full py-3.5 rounded-full text-base"
              style={{ background: canOpen ? COLORS.onyx : COLORS.paperDeep, color: canOpen ? COLORS.onyxText : COLORS.inkSoft, fontWeight: 700 }}>
              Открыть лавку · закупка {lavkaRub(orderCost)} <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 12 }}>(Enter)</span>
            </button>
            {!canOpen && <p className="text-sm mt-2" style={{ color: COLORS.rust }}>На закупку не хватает {lavkaRub(orderCost - st.cash)}. Уменьши закупку{(st.debt || 0) > 3300 ? "" : " или возьми кредит"}.</p>}
            {st.cash < 1500 && (st.debt || 0) <= 3300 && (
              <button onClick={takeLoan} className="w-full py-3 rounded-full text-sm mt-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
                Взять кредит 3 000 ₽: вернуть 3 300 ₽ (разовая переплата 300 ₽ = 10% суммы, без срока) из половины будущей прибыли
              </button>
            )}
          </div>
        )}

        {phase === "morning" && tab === "upgrades" && (
          <div>
            {LAVKA_UPGRADES.map((u) => {
              const owned = !!st.upgrades[u.id], afford = st.cash >= u.cost;
              return (
                <LavkaCard key={u.id} tint={owned ? COLORS.sageSoft : undefined}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{u.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{u.title}</p>
                      <p className="text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{u.desc}</p>
                      {owned && <p className="text-sm mt-2" style={{ color: COLORS.ink }}>{u.lesson}</p>}
                    </div>
                    {owned ? (
                      <span className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: COLORS.sage, color: "#fff" }}><Check size={12} /> есть</span>
                    ) : (
                      <button onClick={() => buy(u)} disabled={!afford} className="text-sm px-3.5 py-2 rounded-full whitespace-nowrap"
                        style={{ background: afford ? COLORS.onyx : COLORS.paperDeep, color: afford ? COLORS.onyxText : COLORS.inkSoft, fontFamily: LAVKA_MONO }}>
                        {lavkaRub(u.cost)}
                      </button>
                    )}
                  </div>
                </LavkaCard>
              );
            })}
          </div>
        )}

        {phase === "morning" && tab === "notebook" && (
          <div>
            <LavkaCard>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {points.length > 1 && points.map((p) => (
                  <button key={p} onClick={() => setPoint(p)} className="text-xs px-3 py-1.5 rounded-full"
                    style={{ background: curPoint === p ? COLORS.sageSoft : COLORS.paperDeep, color: COLORS.ink }}>{LAVKA_POINTS[p].emoji} {LAVKA_POINTS[p].name}</button>
                ))}
                {pids.map((pid) => (
                  <button key={pid} onClick={() => setNbPid(pid)} className="text-xs px-3 py-1.5 rounded-full"
                    style={{ background: nbPids === pid ? COLORS.onyx : COLORS.paperDeep, color: nbPids === pid ? COLORS.onyxText : COLORS.ink }}>
                    {LAVKA_PRODUCTS[pid].emoji} {LAVKA_PRODUCTS[pid].name}
                  </button>
                ))}
              </div>
              <LavkaDemandChart st={st} point={curPoint} pid={nbPids} />
            </LavkaCard>
            <LavkaCard>
              <p className="font-semibold mb-2">Прибыль по дням</p>
              {st.history.length ? <LavkaProfitBars history={st.history} /> : <p className="text-sm" style={{ color: COLORS.inkSoft }}>Пока пусто — открой лавку.</p>}
            </LavkaCard>
          </div>
        )}

        {phase === "morning" && tab === "goals" && (
          <div>
            <LavkaCard>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Дней", st.day - 1], ["Прибыль всего", lavkaRub(st.stats.totalProfit || 0)], ["Лучший день", st.stats.bestDay == null ? "—" : lavkaRub(st.stats.bestDay)], ["Продано", lavkaFmt(st.stats.totalSold || 0)]].map(([l, v]) => (
                  <div key={l}>
                    <p className="text-xs" style={{ color: COLORS.inkSoft }}>{l}</p>
                    <p className="text-base" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{v}</p>
                  </div>
                ))}
              </div>
            </LavkaCard>
            {LAVKA_GOALS.map((g) => {
              const done = st.goals[g.id];
              return (
                <LavkaCard key={g.id} tint={done ? COLORS.sageSoft : undefined}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl" style={{ opacity: done ? 1 : 0.45 }}>{g.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{g.title}</p>
                      <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc}</p>
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ fontFamily: LAVKA_MONO, color: done ? COLORS.sage : COLORS.inkSoft }}>
                      {done ? `день ${done}` : g.reward ? `+${lavkaFmt(g.reward)} ₽` : ""}
                    </span>
                  </div>
                </LavkaCard>
              );
            })}
            <div className="mt-6 text-center">
              {!confirmReset ? (
                <button onClick={() => setConfirmReset(true)} className="text-xs flex items-center gap-1 mx-auto" style={{ color: COLORS.inkSoft }}>
                  <RotateCcw size={12} /> Начать лавку заново
                </button>
              ) : (
                <div className="flex gap-2 justify-center">
                  <button onClick={() => { const f = lavkaNewState(); setSt(f); save(f); setConfirmReset(false); setTab("shop"); }} className="text-xs px-3 py-1.5 rounded-full" style={{ background: COLORS.rust, color: "#fff" }}>Да, сбросить всё</button>
                  <button onClick={() => setConfirmReset(false)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: COLORS.paperDeep, color: COLORS.ink }}>Отмена</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed left-1/2 bottom-6 px-5 py-3 text-sm ms-rise" role="status"
          style={{ transform: "translateX(-50%)", maxWidth: "min(92vw, 560px)", background: COLORS.onyx, color: COLORS.onyxText, borderRadius: 18, zIndex: 60, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

export { LavkaScreen };
