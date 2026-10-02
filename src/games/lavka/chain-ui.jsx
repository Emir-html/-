/* «Сеть кофеен» — экраны уровня 3 (серый прототип) и карточка завершения уровня 2.
   Логика — ./chain.js; состояние уровня 3 живёт в lavka-save → st.chain. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import { chainFit } from "./chain.js";
import {
  CHAIN, CHAIN_GOALS, CHAIN_CHAPTERS, LEVEL2_DIVIDEND,
  chainMC, chainVC, chainA, chainSalePrice2, chainSetOpen, chainSimulate, chainVerdict, levelFinish2,
  chainExamOpen, chainExamNew, chainExamPlayDay, chainExamResult, chainExamFinish,
} from "./chain.js";
import { LavkaStepper, LavkaAwning, LavkaCard } from "./components.jsx";
import { LevelFinish3Card } from "./factory-ui.jsx";

/* Карточка на ярмарке: экзамен уровня 2 сдан с медалью → продать ярмарку или оставить дочкой. */
function LevelFinish2Card({ st, update }) {
  const [sure, setSure] = useState(null);
  const medalId = st.fair && st.fair.examBest && st.fair.examBest.medal;
  if (!medalId) return null;
  const medal = LAVKA_MEDALS.find((m) => m.id === medalId);
  const price = Math.round(chainSalePrice2(medalId)), D = LEVEL2_DIVIDEND[medalId];
  return (
    <LavkaCard tint={COLORS.sageSoft}>
      <p className="font-semibold">{medal.emoji} Уровень 2 сдан — можно открыть уровень 3 «Сеть кофеен»</p>
      <ul className="text-sm mt-1 list-disc pl-5">
        <li><b>Продать ярмарку</b>: сразу {lavkaRub(price)} — аннуитет {lavkaFmt(D)} ₽ × 60 дней при r = 0,5%/день.</li>
        <li><b>Оставить дочкой</b>: {lavkaFmt(D)} ₽ в день 60 дней. Прежние дочки (лавка) продолжают платить.</li>
      </ul>
      <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Старт уровня 3 — грант {lavkaRub(CHAIN.grant)} плюс выбранное; касса ярмарки уходит в архив.</p>
      {sure ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => update((s) => levelFinish2(s, sure) || s)} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Да, {sure === "sell" ? "продать" : "оставить дочкой"} и открыть сеть</button>
          <button onClick={() => setSure(null)} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}` }}>Отмена</button>
        </div>
      ) : (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setSure("sell")} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Продать за {lavkaRub(price)}</button>
          <button onClick={() => setSure("keep")} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, fontWeight: 600 }}>Оставить дочкой ({lavkaFmt(D)} ₽/день)</button>
        </div>
      )}
    </LavkaCard>
  );
}

/* Экзамен уровня 3: 4 дня на копии сети, оценка — по решениям (выпуск кухонь, закрытие). */
function ChainExam({ chain, setChain }) {
  const exam = chain.examActive;
  const [q, setQ] = useState([40, 50]);
  const [close, setClose] = useState(null);
  const i = exam.results.length, done = i >= exam.days.length;
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 3{done ? " — итог" : ` · день ${i + 1} из ${exam.days.length}`}</p>
      <p className="text-sm mt-1">Четыре задачи: две кухни, убыточная точка, опт, мощность. Оценка — по решениям: насколько твои выпуски кухонь близки
        к оптимальным, и верно ли решение о закрытии. Касса не меняется, параметры в каждой попытке новые.</p>
    </LavkaCard>
  );
  if (done) {
    const res = chainExamResult(exam), medal = res && res.medal;
    return (
      <div className="ms-rise">
        {head}
        <LavkaCard tint={medal ? COLORS.sageSoft : COLORS.rustSoft}>
          <p className="text-3xl" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{Math.round(res.eff * 100)}%</p>
          <p className="text-base mt-1 font-semibold">{medal ? `${medal.emoji} ${medal.title}` : "Без медали"}</p>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Худший день: {Math.round(res.minDay * 100)}%. Медали: 🥉 ≥ 70% и каждый день ≥ 50%, 🥈 ≥ 85% и ≥ 70%, 🥇 ≥ 95% и ≥ 85%.</p>
          {exam.days.map((d, k) => {
            const r = exam.results[k];
            return (
              <div key={k} className="text-sm py-1.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <div className="flex justify-between gap-2"><span>{k + 1}. {d.title}</span><span style={{ fontFamily: LAVKA_MONO }}>{Math.round(res.days[k] * 100)}%</span></div>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>ты: {r.q.join(" + ")}, оптимум: {r.best.join(" + ")}{r.closeRight != null ? ` · закрытие: ${r.closeRight ? "верно" : "неверно"}` : ""}</p>
              </div>
            );
          })}
        </LavkaCard>
        <button onClick={() => setChain((c) => chainExamFinish(c, c.examActive))} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Вернуться в сеть</button>
      </div>
    );
  }
  const d = exam.days[i];
  return (
    <div>
      {head}
      <LavkaCard tint={COLORS.amberSoft}><p className="font-semibold">День {i + 1}: {d.title}</p><p className="text-sm mt-1">{d.text}</p></LavkaCard>
      {CHAIN.kitchens.map((k, j) => (
        <LavkaCard key={k.name}>
          <p className="font-semibold">☕ {k.name}</p>
          <p className="text-xs" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>MC = {CHAIN.w} (зёрна) + {k.base} + {2 * k.b}·q · мощность {d.caps[j]} · аренда {lavkaFmt(k.F)} ₽</p>
          <div className="mt-2"><LavkaStepper value={Math.min(q[j], d.caps[j])} onChange={(v) => setQ((x) => { const n = [...x]; n[j] = Math.min(d.caps[j], v); return n; })} min={0} max={d.caps[j]} suffix=" ч." /></div>
        </LavkaCard>
      ))}
      {d.kind === "loss" && (
        <LavkaCard>
          <p className="font-semibold">Закрыть Заводскую в длинном периоде?</p>
          <div className="flex gap-2 mt-2">
            {[[true, "Да, закрыть"], [false, "Нет, оставить"]].map(([v, l]) => (
              <button key={l} onClick={() => setClose(v)} className="text-sm px-4 py-2 rounded-full" style={{ background: close === v ? COLORS.onyx : COLORS.surfaceSolid, color: close === v ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>{l}</button>
            ))}
          </div>
        </LavkaCard>
      )}
      <button disabled={d.kind === "loss" && close == null} onClick={() => { const out = chainExamPlayDay(chain, exam, { q: q.map((x, j) => Math.min(x, d.caps[j])), close }); setChain((c) => ({ ...c, examActive: out.exam })); setClose(null); window.scrollTo?.(0, 0); }}
        className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700, opacity: d.kind === "loss" && close == null ? 0.5 : 1 }}>Ответить · день {i + 1} из {exam.days.length}</button>
      <button onClick={() => setChain((c) => ({ ...c, examActive: null }))} className="w-full py-2.5 rounded-full text-sm mt-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}>Прервать экзамен (не засчитается)</button>
    </div>
  );
}

function ChainScreen({ st, update }) {
  const chain = st.chain;
  const [tab, setTab] = useState("chain");
  const [rep, setRep] = useState(null);
  const setChain = (fn) => update((s) => ({ ...s, chain: fn(s.chain) }));
  const ch = CHAIN_CHAPTERS[chain.chapter - 1];
  const oracle = chain.day <= CHAIN.oracleDays, fit = chainFit((chain.obs || []).filter((o) => (o.chapter || 1) === chain.chapter));
  const Amean = chainA(chain), Q = chain.q.reduce((s, x, i) => s + (chain.open[i] ? x : 0), 0);
  const w = chain.chapter >= 3 && Q >= CHAIN.discountQ ? CHAIN.wDiscount : CHAIN.w;
  const est = oracle ? { A: Amean, B: CHAIN.B } : fit;
  const P = est ? Math.max(0, est.A - est.B * Q) : null;
  const dividends = (chain.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);
  const fixed = CHAIN.kitchens.reduce((s, k, i) => s + (chain.open[i] ? k.F : 0), 0);
  const vc = CHAIN.kitchens.reduce((s, k, i) => s + (chain.open[i] ? chainVC(k, chain.q[i], w) : 0), 0);
  const Line = ({ l, v }) => <div className="flex justify-between text-sm py-0.5"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO }}>{v}</span></div>;
  const open = () => { const out = chainSimulate(chain, Math.random); setRep(out.report); update((s) => ({ ...s, chain: out.next })); window.scrollTo?.(0, 0); };
  const tabs = [["chain", "Сеть"], ["goals", "Цели"]];
  if (chain.examActive) return (
    <div>
      <LavkaAwning title="Сеть кофеен" sub={`Уровень 3 · экзамен · на счёте ${lavkaRub(chain.cash)}`} />
      <ChainExam chain={chain} setChain={setChain} />
    </div>
  );

  return (
    <div>
      <LavkaAwning title="Сеть кофеен" sub={`Уровень 3 · глава ${chain.chapter} «${ch.title}» · день ${chain.day} · на счёте ${lavkaRub(chain.cash)}${dividends ? ` · дочки +${lavkaFmt(dividends)} ₽/день` : ""}`} />
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="text-sm px-4 py-2 rounded-full"
            style={{ background: tab === id ? COLORS.onyx : COLORS.surfaceSolid, color: tab === id ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>{label}</button>
        ))}
      </div>

      {tab === "chain" && (
        <div>
          {rep && (
            <LavkaCard tint={rep.profit >= 0 ? COLORS.sageSoft : COLORS.rustSoft}>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>День {rep.day} закрыт</p>
              <p className="text-2xl mt-1" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: rep.profit >= 0 ? COLORS.sage : COLORS.rust }}>{rep.profit >= 0 ? "+" : ""}{lavkaRub(rep.profit)}</p>
              <Line l={`Выручка: ${rep.Q} чашек × ${rep.P.toFixed(0)} ₽`} v={lavkaRub(rep.P * rep.Q)} />
              <Line l={`Переменные издержки (зёрна ${rep.w} ₽/чашка)`} v={"−" + lavkaRub(rep.vc)} />
              <Line l="Аренда открытых кухонь" v={"−" + lavkaRub(rep.fixed)} />
              {rep.dividend > 0 && <Line l="Дивиденды дочек" v={"+" + lavkaRub(rep.dividend)} />}
              {rep.interest > 0 && <Line l="Проценты на остаток" v={"+" + lavkaRub(rep.interest)} />}
              <p className="text-sm mt-2">{chainVerdict(rep)}</p>
              {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{CHAIN_CHAPTERS[rep.newChapter - 1].title}»</p>}
              {rep.newGoals.map((id) => { const g = CHAIN_GOALS.find((x) => x.id === id); return <p key={id} className="text-sm mt-1 font-semibold">{g.emoji} Цель: {g.title} (+{lavkaFmt(g.reward)} ₽)</p>; })}
            </LavkaCard>
          )}

          {chainExamOpen(chain) && (
            <LavkaCard tint={COLORS.blueSoft}>
              <p className="font-semibold">🎓 Экзамен уровня 3 открыт</p>
              <p className="text-sm mt-1">Две кухни, убыточная точка, опт, мощность — 4 задачи, оценка по решениям. Касса не меняется.</p>
              {chain.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(chain.examBest.eff * 100)}%{chain.examBest.medal ? " " + LAVKA_MEDALS.find((m) => m.id === chain.examBest.medal).emoji : ""} · попыток {chain.examBest.attempts}</p>}
              <button onClick={() => setChain((c) => ({ ...c, examActive: chainExamNew(c, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Сдать экзамен</button>
            </LavkaCard>
          )}
          <LevelFinish3Card st={st} update={update} />

          {chain.day === 1 && !rep && (
            <LavkaCard tint={COLORS.sageSoft}>
              <p className="text-sm leading-relaxed">
                У тебя сеть кофеен в районе: спрос P = 300 − Q (Q — все чашки за день). Варят две кухни с разными издержками.
                Решаешь, <b>сколько чашек сварить на каждой</b>. Тот же общий выпуск дешевле всего, когда предельные издержки кухонь равны.
              </p>
            </LavkaCard>
          )}
          {chain.chapter === 2 && <LavkaCard tint={COLORS.amberSoft}><p className="text-sm">🍂 Спад: спрос упал (A = 200). Аренда кухни в этот день уже уплачена, а закрыть кухню можно со следующего — короткий и длинный период.</p></LavkaCard>}
          {chain.chapter === 3 && <LavkaCard tint={COLORS.amberSoft}><p className="text-sm">📦 Опт: от {CHAIN.discountQ} чашек в день поставщик продаёт ВСЕ зёрна по {CHAIN.wDiscount} ₽ вместо {CHAIN.w}. Садовая варит не больше {CHAIN.kitchens[0].cap}.</p></LavkaCard>}

          {CHAIN.kitchens.map((k, i) => {
            const isOpen = chain.open[i], q = chain.q[i], notice = (chain.closeIn || [0, 0])[i];
            return (
              <LavkaCard key={k.name} style={isOpen ? undefined : { opacity: 0.7 }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold">☕ {k.name}</p>
                  <button onClick={() => setChain((c) => chainSetOpen(c, i, !isOpen))} className="text-xs px-3 py-1.5 rounded-full" style={{ border: `1px solid ${COLORS.line}` }}>
                    {!isOpen ? `Открыть снова за ${lavkaFmt(CHAIN.reopenCost)} ₽` : notice ? "Отменить закрытие" : `Уведомить о закрытии (аренда ещё ${CHAIN.noticeDays} дн.)`}
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>MC = зёрна + {k.base} + {2 * k.b}·q · аренда {lavkaFmt(k.F)} ₽ · мощность {k.cap} · min AC при q ≈ {Math.round(Math.sqrt(k.F / k.b))}</p>
                {notice > 0 && <p className="text-xs mt-1" style={{ color: COLORS.rust }}>Закроется через {notice} дн.: аренда по договору уже уплачена — пока вари, если вклад кухни положителен.</p>}
                {isOpen && (
                  <>
                    <div className="mt-2"><LavkaStepper value={q} onChange={(v) => setChain((c) => { const nq = [...c.q]; nq[i] = Math.min(k.cap, v); return { ...c, q: nq }; })} min={0} max={k.cap} suffix=" ч." /></div>
                    <p className="text-xs mt-1" style={{ fontFamily: LAVKA_MONO }}>MC последней чашки ≈ {chainMC(k, q, w).toFixed(0)} ₽ · AVC ≈ {(q ? chainVC(k, q, w) / q : w + k.base).toFixed(0)} ₽ · AC ≈ {q ? ((chainVC(k, q, w) + k.F) / q).toFixed(0) : "—"} ₽</p>
                  </>
                )}
              </LavkaCard>
            );
          })}

          <LavkaCard>
            <p className="text-xs" style={{ fontFamily: LAVKA_MONO }}>
              {est ? `${oracle ? "" : "📓 по твоей оценке: "}при ${Q} чашках цена ≈ ${P.toFixed(0)} ₽, MR ≈ ${(est.A - 2 * est.B * Q).toFixed(0)} ₽, прибыль ≈ ${lavkaRub(P * Q - vc - fixed)}`
                : "Оценка спроса появится после 3 дней с разным выпуском."}
            </p>
          </LavkaCard>
          <button onClick={open} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Открыть кофейни · {Q} чашек</button>
        </div>
      )}

      {tab === "goals" && (
        <div>
          {CHAIN_GOALS.map((g) => (
            <LavkaCard key={g.id} tint={chain.goals[g.id] ? COLORS.sageSoft : undefined}>
              <p className="font-semibold">{g.emoji} {g.title}</p>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
            </LavkaCard>
          ))}
          {st.level2 && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Уровень 2: медаль {LAVKA_MEDALS.find((m) => m.id === st.level2.medal)?.emoji}, ярмарка {st.level2.choice === "sell" ? `продана за ${lavkaRub(st.level2.sale)}` : "оставлена дочкой"}.</p>}
        </div>
      )}
    </div>
  );
}

export { ChainScreen, LevelFinish2Card };
