/* «Ярмарка» — экраны уровня 2 (серый прототип на общих компонентах) и карточка завершения уровня 1.
   Логика — ./fair.js; состояние уровня 2 живёт в lavka-save → st.fair. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  FAIR, FAIR_GOALS, FAIR_CHAPTERS, FAIR_UPGRADES, LEVEL1_DIVIDEND,
  fairCartelMath, fairSalePrice, fairSimulate, fairVerdict, fairBuy, fairFit, fairMC, levelFinish, fairRivalsToday,
  fairExamOpen, fairExamNew, fairExamPlayDay, fairExamResult, fairExamFinish,
} from "./fair.js";
import { LavkaStepper, LavkaAwning, LavkaCard } from "./components.jsx";

/* Карточка в «Лавке»: экзамен сдан с медалью → закрыть уровень 1: продать лавку или оставить дочкой. */
function LevelFinishCard({ st, update }) {
  const [sure, setSure] = useState(null);
  const medalId = st.examBest && st.examBest.medal;
  if (!medalId) return null;
  const medal = LAVKA_MEDALS.find((m) => m.id === medalId);
  const price = Math.round(fairSalePrice(medalId)), D = LEVEL1_DIVIDEND[medalId];
  return (
    <LavkaCard tint={COLORS.sageSoft}>
      <p className="font-semibold">{medal.emoji} Уровень 1 сдан — можно открыть уровень 2 «Ярмарка»</p>
      <p className="text-sm mt-1" style={{ color: COLORS.ink }}>
        Покупатель лавки видит только медаль. Выбор — настоящая задача на дисконтирование:
      </p>
      <ul className="text-sm mt-1 list-disc pl-5" style={{ color: COLORS.ink }}>
        <li><b>Продать</b>: сразу {lavkaRub(price)} = {lavkaFmt(D)} ₽ × (1 − 1,005⁻⁶⁰)/0,005 — аннуитет на {FAIR.dividendDays} дней при r = 0,5%/день.</li>
        <li><b>Оставить дочкой</b>: {lavkaFmt(D)} ₽ в день {FAIR.dividendDays} дней.</li>
      </ul>
      <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
        Деньги на счёте ярмарки приносят r = 0,5% в день (игровая ставка, очень высокая: ≈ 500% годовых), поэтому без вложений
        варианты равноценны по PV. Продажа выгоднее, если деньги нужны сейчас на вложение доходнее r (например, «Своя мука»)
        и взять кредит под r нельзя. Старт уровня 2 — грант {lavkaRub(FAIR.grant)} плюс выбранное.
      </p>
      {sure ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => update((s) => levelFinish(s, sure) || s)} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>
            Да, {sure === "sell" ? "продать" : "оставить дочкой"} и перейти на ярмарку
          </button>
          <button onClick={() => setSure(null)} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Отмена</button>
        </div>
      ) : (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => setSure("sell")} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Продать за {lavkaRub(price)}</button>
          <button onClick={() => setSure("keep")} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontWeight: 600 }}>Оставить дочкой ({lavkaFmt(D)} ₽/день)</button>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Лавка уйдёт в архив; её можно будет переиграть позже.</p>
    </LavkaCard>
  );
}

/* Экзамен уровня 2: 4 дня без подсказок на копии ярмарки. */
function FairExam({ fair, setFair }) {
  const exam = fair.examActive;
  const [q, setQ] = useState(50);
  const [last, setLast] = useState(null);
  const i = exam.results.length, done = i >= exam.days.length;
  const medalOf = (id) => LAVKA_MEDALS.find((m) => m.id === id);
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 2{done ? " — итог" : ` · день ${i + 1} из ${exam.days.length}`}</p>
      <p className="text-sm mt-1">Четыре дня без подсказок: Курно на троих, дешёвый конкурент, картель, лидерство. Объёмы конкурентов
        не показываются — известны их число и MC. Оценка — точность решения: маржа против бота на том же шоке спроса, пересчитанная в ошибку объёма; касса не меняется.</p>
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
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>ты испёк {r.q}, лучший ответ {r.botQ}; конкуренты {Math.round(r.Qr)}, цена {Math.round(r.P)} ₽{r.cheated ? " · обман картеля: наказание засчитано" : ""}</p>
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
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Спрос P = 200 − Q (± шок 5%), твои MC = {fairMC(fair)} ₽.</p>
      </LavkaCard>
      <LavkaCard>
        <p className="font-semibold">Сколько испечь</p>
        <div className="mt-2"><LavkaStepper value={q} onChange={setQ} min={0} max={200} suffix=" шт." /></div>
        <input type="range" min={0} max={160} value={Math.min(q, 160)} onChange={(e) => setQ(Number(e.target.value))} className="w-full mt-2" style={{ accentColor: COLORS.sage }} aria-label="Сколько испечь на экзамене" />
      </LavkaCard>
      <button onClick={() => { const out = fairExamPlayDay(fair, exam, q); setLast(out.result); setFair((f) => ({ ...f, examActive: out.exam })); window.scrollTo?.(0, 0); }}
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
  const mc = fairMC(fair), cm = fairCartelMath(mc);
  const ch = FAIR_CHAPTERS[fair.chapter - 1], next = FAIR_CHAPTERS[fair.chapter];
  const Qr = fair.rivals.reduce((s, r) => s + r.q, 0);
  const oracle = fair.day <= FAIR.oracleDays, fit = fairFit(fair.obs);
  const inCartel = !!(fair.cartel && fair.cartel.active && fair.cartel.punish === 0) && !fair.leader;
  const dividends = (fair.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);

  /* Прогноз — только по тому, что игрок знает: первую неделю по истинному спросу, потом по своей оценке. */
  const expRivals = fair.leader ? null : fairRivalsToday(fair);
  const est = oracle ? { A: FAIR.A, B: FAIR.B } : fit;
  /* Лидер: конкуренты ответят на твой объём — прогноз по остаточному спросу лидера. */
  const P = !est ? null : fair.leader
    ? Math.max(0, (est.A + fair.rivals.length * FAIR.c) / (fair.rivals.length + 1) - (est.B * fair.q) / (fair.rivals.length + 1))
    : Math.max(0, est.A - est.B * (expRivals + fair.q));
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

  return (
    <div>
      <LavkaAwning title="Ярмарка" sub={`Уровень 2 · глава ${fair.chapter} «${ch.title}» · день ${fair.day} · на счёте ${lavkaRub(fair.cash)}${dividends ? ` · дочки +${lavkaFmt(dividends)} ₽/день` : ""}`} />
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
                <Line l={`Цена при Q = ${Math.round(rep.Q)} (ты ${rep.q}, конкуренты ${Math.round(rep.Qr)})`} v={`${rep.P.toFixed(0)} ₽`} />
                <Line l={`Выручка − издержки (MC ${rep.mc} ₽) − аренда ${lavkaFmt(FAIR.rent)}`} v={lavkaRub(rep.profit)} />
                {rep.dividend > 0 && <Line l="Дивиденды дочек" v={"+" + lavkaRub(rep.dividend)} />}
                {rep.interest > 0 && <Line l="Проценты на остаток (0,5%)" v={"+" + lavkaRub(rep.interest)} />}
                {rep.reward > 0 && <Line l="Награды за цели" v={"+" + lavkaRub(rep.reward)} />}
              </div>
              <p className="text-sm mt-2" style={{ color: COLORS.ink }}>{fairVerdict(rep)}</p>
              {rep.cheated && <p className="text-sm mt-2" style={{ color: COLORS.rust }}>Семён заметил обман: {FAIR.punishDays} дней он печёт по Курно.</p>}
              {rep.entered && <p className="text-sm mt-2" style={{ color: COLORS.ink }}>🏪 На ярмарку пришёл новый продавец: {rep.entered}. Пока продавцы в плюсе, новички ждут прибыль — и входят.</p>}
              {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{FAIR_CHAPTERS[rep.newChapter - 1].title}»</p>}
              {rep.newGoals.map((id) => { const g = FAIR_GOALS.find((x) => x.id === id); return <p key={id} className="text-sm mt-1 font-semibold">{g.emoji} Цель: {g.title} (+{lavkaFmt(g.reward)} ₽)</p>; })}
            </LavkaCard>
          )}

          {fairExamOpen(fair) && (
            <LavkaCard tint={COLORS.blueSoft}>
              <p className="font-semibold">🎓 Экзамен уровня 2 открыт</p>
              <p className="text-sm mt-1">4 дня без подсказок: Курно на троих, дешёвый конкурент, картель, лидерство. MC конкурентов каждый раз новые — равновесие придётся считать. Касса не меняется, пересдавать можно.</p>
              {fair.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(fair.examBest.eff * 100)}%{fair.examBest.medal ? " " + LAVKA_MEDALS.find((m) => m.id === fair.examBest.medal).emoji : ""} · попыток {fair.examBest.attempts}</p>}
              <button onClick={() => setFair((f) => ({ ...f, examActive: fairExamNew(f, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Сдать экзамен</button>
            </LavkaCard>
          )}

          {fair.day === 1 && !rep && (
            <LavkaCard tint={COLORS.sageSoft}>
              <p className="text-sm leading-relaxed">
                Ты на городской ярмарке и печёшь пирожки. Теперь решаешь не цену, а <b>сколько испечь</b>: цена сложится сама —
                P = 200 − Q, где Q — все пирожки на ярмарке, твои и конкурентов. Каждый лишний пирожок сбивает цену на все остальные.
                Себестоимость {FAIR.c} ₽, аренда места {lavkaFmt(FAIR.rent)} ₽ в день. Рядом печёт Семён.
              </p>
            </LavkaCard>
          )}

          <LavkaCard>
            <p className="font-semibold">Конкуренты</p>
            {fair.rivals.map((r) => (
              <div key={r.name} className="flex justify-between text-sm mt-1"><span>{r.name}</span><span style={{ fontFamily: LAVKA_MONO }}>вчера {Math.round(r.q)} шт.</span></div>
            ))}
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
              {fair.leader ? "У тебя утренний прилавок: конкуренты видят твой сегодняшний объём и отвечают на него."
                : inCartel ? `Картель: ты печёшь ${Math.round(cm.qPlayer)}, Семён — ${Math.round(cm.qRival)}.`
                  : fair.cartel && fair.cartel.punish > 0 ? `Семён наказывает за обман: ещё ${fair.cartel.punish} дн. печёт по Курно.`
                    : "Опытные торговцы печь будут как в равновесии Курно — каждый ждёт от остальных рационального ответа. (Наивно «отвечать на вчерашний объём» при трёх и более продавцах не сходится — цены бы качались.)"}
            </p>
          </LavkaCard>

          {fair.chapter === 3 && fair.cartel && (
            <LavkaCard tint={COLORS.amberSoft}>
              <p className="font-semibold">🤝 Предложение Семёна</p>
              <p className="text-sm mt-1">«Ты печёшь {Math.round(cm.qPlayer)}, я — {Math.round(cm.qRival)}: цена будет {Math.round(cm.P)} ₽, тебе ≈ {lavkaFmt(cm.cartelProfit)} ₽ до аренды (по Курно ≈ {lavkaFmt(cm.cournotProfit)}). Обманешь — {FAIR.punishDays} дней буду печь по Курно».</p>
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Повторяющаяся дилемма заключённого: обман даст ≈ +{lavkaFmt(cm.cheatGain)} ₽ за день, наказание отнимет ≈ {lavkaFmt(cm.punishLoss)} ₽. Квоты пропорциональны долям в Курно — так выигрывают оба.</p>
            </LavkaCard>
          )}

          <LavkaCard>
            <p className="font-semibold">Сколько испечь сегодня</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <LavkaStepper value={fair.q} onChange={(v) => setFair((f) => ({ ...f, q: v }))} min={0} max={200} suffix=" шт." />
            </div>
            <input type="range" min={0} max={160} value={Math.min(fair.q, 160)} onChange={(e) => setFair((f) => ({ ...f, q: Number(e.target.value) }))}
              className="w-full mt-2" style={{ accentColor: COLORS.sage }} aria-label="Сколько испечь" />
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>
              {est
                ? `${oracle ? "" : "📓 по твоей оценке: "}${fair.leader ? "конкуренты ответят на твой объём" : `если конкуренты испекут ${Math.round(expRivals)}`}, цена ≈ ${P.toFixed(0)} ₽, прибыль ≈ ${lavkaRub((P - mc) * fair.q - FAIR.rent)}`
                : "Оценка спроса появится после 3 дней с разным суммарным объёмом."}
            </p>
            {oracle && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Первую неделю прогноз — по истинному спросу. Потом — только по твоим наблюдениям.</p>}
          </LavkaCard>

          <button onClick={open} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>
            Открыть ярмарку · испечь {fair.q} шт. ({lavkaRub(fair.q * mc)})
          </button>
        </div>
      )}

      {tab === "upgrades" && FAIR_UPGRADES.map((u) => {
        const owned = fair.upgrades && fair.upgrades[u.id], locked = fair.chapter < u.chapter, afford = fair.cash >= u.cost;
        return (
          <LavkaCard key={u.id} tint={owned ? COLORS.sageSoft : undefined} style={locked ? { opacity: 0.55 } : undefined}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{locked ? "🔒" : u.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{u.title}</p>
                <p className="text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{locked ? `Откроется в главе ${u.chapter} «${FAIR_CHAPTERS[u.chapter - 1].title}».` : u.desc}</p>
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
            <p className="text-sm mt-1">{next && ch.goal ? <>Чтобы открыть главу {next.n} «{next.title}»: цель {FAIR_GOALS.find((g) => g.id === ch.goal).emoji} «{FAIR_GOALS.find((g) => g.id === ch.goal).title}»{fair.day < next.fromDay ? ` и ${next.fromDay}-й день` : ""}.</> : "Все главы уровня 2 открыты."}</p>
          </LavkaCard>
          {FAIR_GOALS.map((g) => (
            <LavkaCard key={g.id} tint={fair.goals[g.id] ? COLORS.sageSoft : undefined}>
              <p className="font-semibold">{g.emoji} {g.title}</p>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
            </LavkaCard>
          ))}
          {st.level1 && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Уровень 1: медаль {LAVKA_MEDALS.find((m) => m.id === st.level1.medal)?.emoji}, лавка {st.level1.choice === "sell" ? `продана за ${lavkaRub(st.level1.sale)}` : "оставлена дочкой"}.</p>}
        </div>
      )}
    </div>
  );
}

export { FairScreen, LevelFinishCard };
