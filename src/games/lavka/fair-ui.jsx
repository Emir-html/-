/* «Ярмарка» — экраны уровня 2 (серый прототип на общих компонентах) и карточка завершения уровня 1.
   Логика — ./fair.js; состояние уровня 2 живёт в lavka-save → st.fair. Объёмы — в реальных стаканах дня. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  FAIR, FAIR_GOALS, FAIR_CHAPTERS, FAIR_UPGRADES,
  fairK, fairFixed, fairTax, fairMC, fairMCbase, fairCartelMath, fairRivalMC, fairInCartel, fairSimulate, fairVerdict, fairBuy, fairFit,
  fairBarrelNPV, fairRivalsToday, fairAnswerOffer, fairLeaveCartel, levelFinish,
  fairExamOpen, fairExamNew, fairExamPlayDay, fairExamResult, fairExamFinish,
} from "./fair.js";
import { LavkaStepper, LavkaAwning, LavkaCard, LevelFinishCapital } from "./components.jsx";
import { LevelFinish2Card } from "./chain-ui.jsx";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/* Карточка в «Лавке»: экзамен сдан с медалью → закрыть уровень 1: продать лавку или оставить дочкой. */
function LevelFinishCard({ st, update }) {
  return <LevelFinishCapital level={1} examBest={st.examBest} nextTitle="Ярмарка" business="Лавка"
    onFinish={(choice) => update((s) => levelFinish(s, choice) || s)} />;
}

/* Экзамен уровня 2 «Закрытие сезона»: 3 дня, соперники объявляют объёмы. */
function FairExam({ fair, setFair }) {
  const exam = fair.examActive;
  const [q, setQ] = useState(400);
  const [join, setJoin] = useState(false);
  const [last, setLast] = useState(null);
  const i = exam.results.length, done = i >= exam.days.length;
  const medalOf = (id) => LAVKA_MEDALS.find((m) => m.id === id);
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 2 «Закрытие сезона»{done ? " — итог" : ` · день ${i + 1} из ${exam.days.length}`}</p>
      <p className="text-sm mt-1">Три дня без Веры. Соня спросила у всех, сколько они везут, — экзамен проверяет наилучший ответ, а не угадывание.
        Оценка — по марже до платы за место: 1 − √(1 − маржа/маржа эталона), то есть примерно «1 − ошибка объёма». Касса не меняется.</p>
    </LavkaCard>
  );
  if (done) {
    const res = fairExamResult(exam), medal = res && res.medal;
    return (
      <div className="ms-rise">
        {head}
        <LavkaCard tint={medal ? COLORS.sageSoft : COLORS.rustSoft}>
          {res ? (<>
            <p className="text-3xl" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{Math.round(res.eff * 100)}%</p>
            <p className="text-base mt-1 font-semibold">{medal ? `${medal.emoji} ${medal.title}` : "Без медали"}</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Худший день: {Math.round(res.minDay * 100)}%. Медали: 🥉 ≥ 70% и каждый день ≥ 50%, 🥈 ≥ 85% и ≥ 70%, 🥇 ≥ 95% и ≥ 85%.</p>
          </>) : <p className="font-semibold">Экзамен недействителен — пересдай.</p>}
          {exam.days.map((d, k) => {
            const r = exam.results[k];
            return (
              <div key={k} className="text-sm py-1.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <div className="flex justify-between gap-2"><span>{k + 1}. {d.title}</span><span style={{ fontFamily: LAVKA_MONO }}>{res ? Math.round(res.days[k] * 100) + "%" : ""}</span></div>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                  ты: {r.join ? "в сговоре, " : ""}{r.q} → маржа {lavkaRub(r.playerMargin)}; эталон: {r.botJoin ? "в сговоре, " : ""}{r.botQ} → {lavkaRub(r.botMargin)}
                  {d.kind === "cartel" && !r.botJoin ? " (вне сговора: наилучший ответ и без штрафа)" : ""}
                </p>
              </div>
            );
          })}
          {fair.examBest && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Лучший результат до этой попытки: {Math.round(fair.examBest.eff * 100)}%{fair.examBest.medal ? " " + medalOf(fair.examBest.medal).emoji : ""}, попыток {fair.examBest.attempts}.</p>}
        </LavkaCard>
        <button onClick={() => setFair((f) => fairExamFinish(f, f.examActive))} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Вернуться на ярмарку</button>
      </div>
    );
  }
  const d = exam.days[i];
  return (
    <div>
      {head}
      {last && <LavkaCard><p className="text-sm">День {i} закрыт: маржа {lavkaRub(last.playerMargin)}. Разбор — в конце экзамена.</p></LavkaCard>}
      <LavkaCard tint={COLORS.amberSoft}>
        <p className="font-semibold">День {i + 1}: {d.title}</p>
        <p className="text-sm mt-1">{d.text}</p>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Будний день: P = 100 − 0,05·Q (± шок 4%), твои MC = {fairMCbase(fair)} ₽, плата за место 3 000 ₽ — в любом случае.</p>
      </LavkaCard>
      {d.kind === "cartel" && (
        <LavkaCard>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={join} onChange={(e) => setJoin(e.target.checked)} /> Вступить в договор (квота {d.quota})</label>
        </LavkaCard>
      )}
      <LavkaCard>
        <p className="font-semibold">Сколько везёшь</p>
        <div className="mt-2"><LavkaStepper value={q} onChange={setQ} step={10} min={0} max={1600} suffix=" ст." /></div>
        <input type="range" min={0} max={1000} step={10} value={Math.min(q, 1000)} onChange={(e) => setQ(Number(e.target.value))} className="w-full mt-2" style={{ accentColor: COLORS.sage }} aria-label="Сколько везёшь на экзамене" />
      </LavkaCard>
      <button onClick={() => { const out = fairExamPlayDay(fair, exam, { q, join: d.kind === "cartel" && join }); setLast(out.result); setJoin(false); setFair((f) => ({ ...f, examActive: out.exam })); window.scrollTo?.(0, 0); }}
        className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Завершить день {i + 1} из {exam.days.length}</button>
      <button onClick={() => setFair((f) => ({ ...f, examActive: null }))} className="w-full py-2.5 rounded-full text-sm mt-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}>Прервать экзамен (не засчитается)</button>
    </div>
  );
}

function FairScreen({ st, update }) {
  const fair = st.fair;
  const [tab, setTab] = useState("fair");
  const [rep, setRep] = useState(null);
  const setFair = (fn) => update((s) => ({ ...s, fair: fn(s.fair) }));
  const day = fair.day, k = fairK(day), mc = fairMC(fair), cr = fairRivalMC(day), cm = fairCartelMath(mc, cr);
  const ch = FAIR_CHAPTERS[fair.chapter - 1], next = FAIR_CHAPTERS[fair.chapter];
  const oracle = day <= FAIR.oracleDays, fit = fairFit(fair.obs);
  const inCartel = fairInCartel(fair);
  const dividends = (fair.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);
  const fixed = fairFixed(day), m = fair.rivals.length;

  /* Прогноз — только по тому, что игрок знает: первую неделю по истинному спросу, потом по своей оценке. */
  const expRivals = fairRivalsToday(fair);
  const est = oracle ? { a: FAIR.a, b: FAIR.b } : fit;
  const x = fair.q / k;
  const P = !est ? null : fair.leader
    ? Math.max(0, (est.a + m * cr) / (m + 1) - (est.b * x) / (m + 1))
    : Math.max(0, est.a - est.b * (expRivals / k + x));
  const open = () => {
    const out = fairSimulate(fair, Math.random);
    setRep(out.report);
    update((s) => ({ ...s, fair: out.next }));
    window.scrollTo?.(0, 0);
  };
  const tabs = [["fair", "Ярмарка"], ["upgrades", "Улучшения"], ["goals", "Цели"]];
  if (fair.examActive) return (
    <div>
      <LavkaAwning title="Ярмарка" sub={`Уровень 2 · экзамен · на счёте ${lavkaRub(fair.cash)}`} />
      <FairExam fair={fair} setFair={setFair} />
    </div>
  );
  const Line = ({ l, v, strong }) => (
    <div className="flex justify-between text-sm py-0.5"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO, fontWeight: strong ? 700 : 400 }}>{v}</span></div>
  );
  const levelOver = day > FAIR.levelDays;

  return (
    <div>
      <LavkaAwning title="Ярмарка" sub={`Уровень 2 · глава ${fair.chapter} «${ch.title}» · день ${day} (${WEEKDAYS[(day - 1) % 7]}) · на счёте ${lavkaRub(fair.cash)}${dividends ? ` · дочки +${lavkaFmt(dividends)} ₽/день` : ""}`} />
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="text-sm px-4 py-2 rounded-full"
            style={{ background: tab === id ? COLORS.onyx : COLORS.surfaceSolid, color: tab === id ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>{label}</button>
        ))}
      </div>

      {tab === "fair" && (
        <div>
          {rep && (
            <LavkaCard tint={rep.profit >= 0 ? COLORS.sageSoft : COLORS.rustSoft}>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>День {rep.day} закрыт</p>
              <p className="text-2xl mt-1" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: rep.profit >= 0 ? COLORS.sage : COLORS.rust }}>{rep.profit >= 0 ? "+" : ""}{lavkaRub(rep.profit)}</p>
              <div className="mt-2">
                <Line l={`Цена при ${Math.round(rep.Q)} стаканах (ты ${rep.q}, соперники ${Math.round(rep.Xr * rep.k)})`} v={`${rep.P.toFixed(1).replace(".", ",")} ₽`} />
                <Line l={`Маржа (P − MC ${rep.mc} ₽${rep.tax ? ", в т. ч. сбор 10 ₽" : ""}) × ${rep.q}`} v={lavkaRub(rep.margin)} />
                {rep.fixed > 0 && <Line l="Плата за место" v={"−" + lavkaRub(rep.fixed)} />}
                {rep.fined > 0 && <Line l="Штраф за сговор" v={"−" + lavkaRub(rep.fined)} />}
                {rep.dividend > 0 && <Line l="Дивиденды дочек" v={"+" + lavkaRub(rep.dividend)} />}
                {rep.interest !== 0 && <Line l="Проценты на остаток (2%)" v={(rep.interest > 0 ? "+" : "") + lavkaRub(rep.interest)} />}
                {rep.reward > 0 && <Line l="Награды за цели" v={"+" + lavkaRub(rep.reward)} />}
                {rep.salvage > 0 && <Line l="Гена выкупил бочку" v={"+" + lavkaRub(rep.salvage)} />}
              </div>
              <p className="text-sm mt-2" style={{ color: COLORS.ink }}>{fairVerdict(rep)}</p>
              {rep.entered.length > 0 && <p className="text-sm mt-2">🏪 Завтра на ярмарке новые продавцы: {rep.entered.join(", ")}. Пока новичок ждёт прибыль выше платы за место, он входит.</p>}
              {rep.dissolved && <p className="text-sm mt-2">♟️ Семён: «С Ильёй наш договор нам невыгоден. Посчитал»: вдвоём против Ильи каждому ≈ {lavkaFmt(rep.dissolved.eachInCartel)} ₽, в честном Курно на троих — {lavkaFmt(rep.dissolved.eachCournot3)} ₽.</p>}
              {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{FAIR_CHAPTERS[rep.newChapter - 1].title}»</p>}
              {rep.newGoals.map((id) => { const g = FAIR_GOALS.find((x) => x.id === id); return <p key={id} className="text-sm mt-1 font-semibold">{g.emoji} Цель: {g.title} (+{lavkaFmt(g.reward)} ₽)</p>; })}
            </LavkaCard>
          )}

          <LevelFinish2Card st={st} update={update} />
          {fairExamOpen(fair) && (
            <LavkaCard tint={COLORS.blueSoft}>
              <p className="font-semibold">🎓 Экзамен уровня 2 открыт</p>
              <p className="text-sm mt-1">3 дня без подсказок: трое на ярмарке, новый продавец, искушение картеля. Объёмы каждый раз новые. Касса не меняется, пересдавать можно.</p>
              {fair.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(fair.examBest.eff * 100)}%{fair.examBest.medal ? " " + LAVKA_MEDALS.find((mm) => mm.id === fair.examBest.medal).emoji : ""} · попыток {fair.examBest.attempts}</p>}
              <button onClick={() => setFair((f) => ({ ...f, examActive: fairExamNew(f, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Сдать экзамен</button>
            </LavkaCard>
          )}

          {day === 1 && !rep && (
            <LavkaCard tint={COLORS.sageSoft}>
              <p className="text-sm leading-relaxed">
                Летняя ярмарка у вокзала, квас в розлив. Теперь ты решаешь не цену, а <b>сколько привезти</b>: цену ставит рынок —
                P = 100 − 0,05·Q в будни, где Q — все стаканы на ярмарке, твои и чужие. Каждый лишний стакан сбивает цену на все остальные.
                Квас стоит {FAIR.c} ₽, первую неделю Смычков берёт сбор {FAIR.unitTax} ₽ со стакана. Рядом — Семён.
              </p>
            </LavkaCard>
          )}

          {fair.offer && (
            <LavkaCard tint={COLORS.amberSoft}>
              <p className="font-semibold">🤝 Семён предлагает договор</p>
              <p className="text-sm mt-1">«Возим по {Math.round(fair.offer.qPlayer)}, цена будет {Math.round(fair.offer.P)} ₽ — тебе ≈ {lavkaFmt(fair.offer.cartelProfit)} ₽ в будни, а в Курно ≈ {lavkaFmt(fair.offer.cournotProfit)}.
                Привезёшь больше — {FAIR.punishDays} дней вожу как без договора».</p>
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Сговор о ценах запрещён. Выигрыш договора — {lavkaFmt(fair.offer.cartelGain)} ₽ в будни; инспектор раскрывает сговор с вероятностью 8% в день, штраф 25 000 ₽ — ожидаемо {lavkaFmt(fair.offer.expFine)} ₽ в день. А покупатели платят больше.</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => setFair((f) => fairAnswerOffer(f, false))} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Отказаться</button>
                <button onClick={() => setFair((f) => fairAnswerOffer(f, true))} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Договориться</button>
              </div>
            </LavkaCard>
          )}

          <LavkaCard>
            <p className="font-semibold">Соперники · мест на ярмарке: {m + 1}</p>
            {fair.rivals.map((r) => (
              <div key={r.name} className="flex justify-between text-sm mt-1"><span>{r.name}</span><span style={{ fontFamily: LAVKA_MONO }}>вчера {Math.round(r.q || 0)} ст.</span></div>
            ))}
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
              {fair.leader ? "У тебя утренний прилавок: соперники видят твой сегодняшний объём и отвечают на него."
                : inCartel ? `Договор: ты возишь ${Math.round(cm.qPlayer * k)}, Семён — ${Math.round(cm.qRival * k)} (сегодня людей ×${String(k).replace(".", ",")}).`
                  : fair.cartel && fair.cartel.punish > 0 ? `Семён наказывает за обман: ещё ${fair.cartel.punish} дн. возит по Курно.`
                    : "Опытные торговцы возят как в равновесии Курно — каждый ждёт от остальных рационального ответа."}
            </p>
            {inCartel && <button onClick={() => setFair((f) => fairLeaveCartel(f))} className="mt-2 text-sm px-3.5 py-1.5 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Выйти из договора</button>}
          </LavkaCard>

          {levelOver ? (
            <LavkaCard><p className="text-sm">Ярмарка закрылась после {FAIR.levelDays}-го дня. Дальше — экзамен.</p></LavkaCard>
          ) : (<>
            <LavkaCard>
              <p className="font-semibold">Сколько везём сегодня</p>
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                {WEEKDAYS[(day - 1) % 7]}: людей ×{String(k).replace(".", ",")} · MC {mc} ₽{fairTax(day) ? " (с учётом сбора 10 ₽)" : ""} · плата за место {lavkaRub(fixed)}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <LavkaStepper value={fair.q} onChange={(v) => setFair((f) => ({ ...f, q: v }))} step={10} min={0} max={2000} suffix=" ст." />
              </div>
              <input type="range" min={0} max={1400} step={10} value={Math.min(fair.q, 1400)} onChange={(e) => setFair((f) => ({ ...f, q: Number(e.target.value) }))}
                className="w-full mt-2" style={{ accentColor: COLORS.sage }} aria-label="Сколько везём" />
              <p className="text-xs mt-2" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>
                {est
                  ? `${oracle ? "" : "📓 по твоей оценке: "}${fair.leader ? "соперники ответят на твой объём" : `если соперники привезут ${Math.round(expRivals)}`}, цена ≈ ${P.toFixed(1).replace(".", ",")} ₽, прибыль ≈ ${lavkaRub((P - mc) * fair.q - fixed)}`
                  : "Оценка спроса появится после 3 дней с разным общим объёмом."}
              </p>
              {oracle && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Первую неделю Вера Павловна подсказывает по истинному спросу. Потом — только твои наблюдения.</p>}
            </LavkaCard>
            <button onClick={open} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>
              Открыть ярмарку · везём {fair.q} ст. ({lavkaRub(fair.q * mc)})
            </button>
          </>)}
        </div>
      )}

      {tab === "upgrades" && FAIR_UPGRADES.map((u) => {
        const owned = fair.upgrades && fair.upgrades[u.id], afford = fair.cash >= u.cost;
        const locked = fair.chapter < u.chapter || (u.fromDay && day < u.fromDay) || (u.untilDay && day > u.untilDay);
        const npv = u.id === "barrel" && !owned && !locked ? fairBarrelNPV(fair) : null;
        return (
          <LavkaCard key={u.id} tint={owned ? COLORS.sageSoft : undefined} style={locked ? { opacity: 0.55 } : undefined}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{locked ? "🔒" : u.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{u.title}</p>
                <p className="text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{locked ? (u.untilDay && day > u.untilDay ? "Ряд перестроен — утреннего прилавка больше нет." : `Откроется ${u.fromDay ? `на ${u.fromDay}-й день` : `в главе ${u.chapter} «${FAIR_CHAPTERS[u.chapter - 1].title}»`}.`) : u.desc}</p>
                {npv != null && <p className="text-xs mt-1" style={{ fontFamily: LAVKA_MONO, color: npv > 0 ? COLORS.sage : COLORS.rust }}>NPV при покупке сегодня ≈ {lavkaRub(npv)} (r = 2%, до конца ярмарки + выкуп)</p>}
                {owned && <p className="text-sm mt-2">{u.lesson}</p>}
              </div>
              {!locked && !owned && (
                <button onClick={() => setFair((f) => fairBuy(f, u.id))} disabled={!afford} className="text-sm px-3.5 py-2 rounded-full whitespace-nowrap"
                  style={{ background: afford ? COLORS.onyx : COLORS.paperDeep, color: afford ? COLORS.onyxText : COLORS.inkSoft, fontFamily: LAVKA_MONO }}>{lavkaRub(u.cost)}</button>
              )}
            </div>
          </LavkaCard>
        );
      })}

      {tab === "goals" && (
        <div>
          <LavkaCard tint={COLORS.blueSoft}>
            <p className="font-semibold">📖 Глава {ch.n}: «{ch.title}»</p>
            <p className="text-sm mt-1">{next ? <>Глава {next.n} «{next.title}» откроется на {next.fromDay}-й день — рынок не ждёт. Ключевая цель главы: {FAIR_GOALS.find((g) => g.id === ch.goal).emoji} «{FAIR_GOALS.find((g) => g.id === ch.goal).title}».</> : "Все главы уровня 2 открыты. С 22-го дня — экзамен."}</p>
          </LavkaCard>
          {FAIR_GOALS.map((g) => (
            <LavkaCard key={g.id} tint={fair.goals[g.id] ? COLORS.sageSoft : undefined}>
              <p className="font-semibold">{g.emoji} {g.title}</p>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
            </LavkaCard>
          ))}
          {st.level1 && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Уровень 1: медаль {LAVKA_MEDALS.find((mm) => mm.id === st.level1.medal)?.emoji}, лавка {st.level1.choice === "sell" ? `продана за ${lavkaRub(st.level1.sale)}` : `оставлена дочкой (${lavkaRub(st.level1.D || 0)}/день)`}.</p>}
        </div>
      )}
    </div>
  );
}

export { FairScreen, LevelFinishCard };
