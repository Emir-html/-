/* «Холдинг» — экраны уровня 5 (серый прототип): «Совет» с доской решений, экзамен, финал; карточка завершения уровня 4.
   Логика — ./holding.js; состояние уровня 5 живёт в lavka-save → st.holding. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  HOLDING, HOLDING_GOALS, HOLDING_CHAPTERS,
  holdingNPV, holdingPI, holdingPayback, holdingBoard, holdingApprove, holdingChooseTax, holdingTax, holdingTakeLoan, holdingSchedule, holdingSchedulePV,
  holdingHedge, holdingInsure, holdingExposure, holdingPolicies, holdingCashForecast, holdingInsuranceCost, holdingMove, holdingDam, holdingActionGain,
  holdingNextDay, holdingDailyFlow, holdingOffers, holdingSell,
  holdingExamOpen, holdingExamNew, holdingExamPlay, holdingExamResult, holdingExamFinish, levelFinish4,
} from "./holding.js";
import { LavkaAwning, LavkaCard, LevelFinishCapital } from "./components.jsx";

const rub = (x) => lavkaRub(Math.round(x));
const btn = { background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 };
const ghost = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };
const medalOf = (id) => LAVKA_MEDALS.find((m) => m.id === id);

/* Карточка в цехе: экзамен уровня 4 сдан с медалью → продать цех или оставить дочкой и открыть холдинг. */
function LevelFinish4Card({ st, update }) {
  if (!st.factory) return null;
  return <LevelFinishCapital level={4} examBest={st.factory.examBest} nextTitle="Холдинг" business="Цех «Заря»"
    onFinish={(choice) => update((s) => levelFinish4(s, choice) || s)} />;
}

function Row({ l, v }) {
  return <div className="flex justify-between text-sm py-0.5 gap-2"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO, whiteSpace: "nowrap" }}>{v}</span></div>;
}

/* Экзамен уровня 5. */
function HoldingExam({ h, setH }) {
  const ex = h.examActive;
  const [ids, setIds] = useState([]);
  const [fin, setFin] = useState({ scheme: "annuity", regime: "usn15" });
  const i = ex.results.length, done = i >= ex.days.length;
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 5{done ? " — итог" : ` · задача ${i + 1} из ${ex.days.length}`}</p>
      <p className="text-sm mt-1">Портфель, кредит и налог, страховка. Оценка — деньгами: NPV набора к лучшему; издержки эталона к твоим. Касса не меняется.</p>
    </LavkaCard>
  );
  if (done) {
    const res = holdingExamResult(ex), medal = res && res.medal;
    return (
      <div className="ms-rise">
        {head}
        <LavkaCard tint={medal ? COLORS.sageSoft : COLORS.rustSoft}>
          <p className="text-3xl" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{Math.round(res.eff * 100)}%</p>
          <p className="text-base mt-1 font-semibold">{medal ? `${medal.emoji} ${medal.title}` : "Без медали"}</p>
          {ex.days.map((d, k) => {
            const r = ex.results[k];
            const show = d.kind === "portfolio" ? `ты: ${(r.ans.ids || []).join(" + ") || "ничего"}; эталон: ${r.best.ids.join(" + ")}`
              : d.kind === "finance" ? `ты: ${r.ans.scheme === "diff" ? "дифф." : "аннуитет"}, ${r.ans.regime === "usn6" ? "6%" : "15%"}; эталон: ${r.best.scheme === "diff" ? "дифф." : "аннуитет"}, ${r.best.regime === "usn6" ? "6%" : "15%"}`
                : `ты: ${({ none: "без полиса", deductible: "с франшизой", full: "полный" })[r.ans.choice]}; эталон: ${({ none: "без полиса", deductible: "с франшизой", full: "полный" })[r.best.choice]}`;
            return (
              <div key={k} className="text-sm py-1.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <div className="flex justify-between gap-2"><span>{k + 1}. {d.title}</span><span style={{ fontFamily: LAVKA_MONO }}>{Math.round(res.days[k] * 100)}%</span></div>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>{show}</p>
              </div>
            );
          })}
        </LavkaCard>
        <button onClick={() => setH((x) => holdingExamFinish(x, x.examActive))} className="w-full py-3.5 rounded-full text-base" style={{ ...btn, fontWeight: 700 }}>Вернуться в совет</button>
      </div>
    );
  }
  const d = ex.days[i];
  const play = (ans) => { const out = holdingExamPlay(ex, ans); setIds([]); setH((x) => ({ ...x, examActive: out.exam })); window.scrollTo?.(0, 0); };
  return (
    <div>
      {head}
      <LavkaCard tint={COLORS.amberSoft}><p className="font-semibold">{d.title}</p><p className="text-sm mt-1">{d.text}</p></LavkaCard>
      {d.kind === "portfolio" && (
        <LavkaCard>
          {d.projects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={ids.includes(p.id)} onChange={(e) => setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))} />
              <span className="flex-1">{p.id}: вложение {rub(p.cost)}, поток {rub(p.cf)}/день</span>
            </label>
          ))}
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>Выбрано на {rub(d.projects.filter((p) => ids.includes(p.id)).reduce((s, p) => s + p.cost, 0))} из {rub(d.budget)}. a(2%, 30) = 22,396.</p>
          <button onClick={() => play({ ids })} className="mt-3 w-full py-3 rounded-full" style={btn}>Утвердить</button>
        </LavkaCard>
      )}
      {d.kind === "finance" && (
        <LavkaCard>
          <p className="text-sm font-semibold">Схема кредита</p>
          <div className="flex gap-2 mt-1 flex-wrap">{[["annuity", "Аннуитет"], ["diff", "Дифференцированный"]].map(([k, l]) => (
            <button key={k} onClick={() => setFin({ ...fin, scheme: k })} className="text-sm px-3 py-1.5 rounded-full" style={fin.scheme === k ? btn : ghost}>{l}</button>))}</div>
          <p className="text-sm font-semibold mt-3">Режим налога</p>
          <div className="flex gap-2 mt-1 flex-wrap">{[["usn6", "УСН 6% доходов"], ["usn15", "УСН 15% (доходы − расходы)"]].map(([k, l]) => (
            <button key={k} onClick={() => setFin({ ...fin, regime: k })} className="text-sm px-3 py-1.5 rounded-full" style={fin.regime === k ? btn : ghost}>{l}</button>))}</div>
          <button onClick={() => play(fin)} className="mt-3 w-full py-3 rounded-full" style={btn}>Решить</button>
        </LavkaCard>
      )}
      {d.kind === "insurance" && (
        <LavkaCard>
          <div className="flex gap-2 flex-wrap">{[["none", "Не страховать"], ["deductible", "С франшизой"], ["full", "Полный полис"]].map(([k, l]) => (
            <button key={k} onClick={() => play({ choice: k })} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>{l}</button>))}</div>
        </LavkaCard>
      )}
      <button onClick={() => setH((x) => ({ ...x, examActive: null }))} className="w-full py-2.5 rounded-full text-sm mt-2" style={{ ...ghost, color: COLORS.inkSoft }}>Прервать экзамен (не засчитается)</button>
    </div>
  );
}

function HoldingScreen({ st, update }) {
  const h = st.holding;
  const [rep, setRep] = useState(null);
  const [pick, setPick] = useState([]);
  const [showNPV, setShowNPV] = useState(false);
  const setH = (fn) => update((s) => ({ ...s, holding: fn(s.holding) }));
  const day = h.day, ch = HOLDING_CHAPTERS[h.chapter - 1];
  const flow = holdingDailyFlow(h);
  if (h.examActive) return (<div><LavkaAwning title="Холдинг" sub={`Уровень 5 · экзамен · на счёте ${rub(h.cash)}`} /><HoldingExam h={h} setH={setH} /></div>);

  const board = holdingBoard(h), oracle = day <= HOLDING.oracleDays;
  const pickCost = board.filter((p) => pick.includes(p.id)).reduce((s, p) => s + p.cost, 0);
  const ex = holdingExposure(h), pol = holdingPolicies(ex);
  const L = HOLDING.loan, ann = holdingSchedule({ amount: L.amount, rate: L.rate, n: L.n }, "annuity"), dif = holdingSchedule({ amount: L.amount, rate: L.rate, n: L.n }, "diff");
  const next = () => { const out = holdingNextDay(h); setRep(out.report); update((s) => ({ ...s, holding: out.next })); window.scrollTo?.(0, 0); };
  const levelOver = day > HOLDING.levelDays;

  return (
    <div>
      <LavkaAwning title="Холдинг" sub={`Уровень 5 · глава ${h.chapter} «${ch.title}» · день ${day} · на счёте ${rub(h.cash)} · поток ${rub(flow)}/день`} />

      {rep && (
        <LavkaCard tint={rep.net >= 0 ? COLORS.sageSoft : COLORS.rustSoft}>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>День {rep.day} закрыт</p>
          <p className="text-2xl mt-1" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: rep.net >= 0 ? COLORS.sage : COLORS.rust }}>{rep.net >= 0 ? "+" : ""}{rub(rep.net)}</p>
          <div className="mt-2">
            {rep.dividend > 0 && <Row l="Дивиденды дочек" v={"+" + rub(rep.dividend)} />}
            {rep.projectCF > 0 && <Row l="Потоки проектов" v={"+" + rub(rep.projectCF)} />}
            {rep.loanPay > 0 && <Row l="Платёж по кредиту" v={"−" + rub(rep.loanPay)} />}
            {rep.interest !== 0 && <Row l="Проценты на остаток (2%)" v={(rep.interest > 0 ? "+" : "") + rub(rep.interest)} />}
            {rep.fx > 0 && <Row l={`Зерно 1 000 у. е. по ${h.hedged ? "форварду 96" : `споту ${rep.spot}`}`} v={"−" + rub(rep.fx)} />}
            {rep.tax > 0 && <Row l="Налог УСН за период" v={"−" + rub(rep.tax)} />}
            {rep.premium > 0 && <Row l="Премия страховки" v={"−" + rub(rep.premium)} />}
            {rep.flood && <Row l={`Паводок: убыток ${rub(rep.flood.gross)}, страховка ${rub(rep.flood.payout)}`} v={"−" + rub(rep.flood.net)} />}
            {rep.emergency > 0 && <Row l="Касса в минусе — экстренный кредит (5% в день на 20 дней)" v={rub(rep.emergency)} />}
          </div>
          {rep.fx > 0 && <p className="text-sm mt-2">Курс оказался {rep.spot} ₽. {h.hedged ? `Форвард зафиксировал 96 ₽ — ${rep.spot > 96 ? "сегодня это выгодно" : "сегодня это дороже спота"}.` : `Без форварда — ${rep.spot} ₽.`} Решение оценивают до того, как курс стал известен: ожидание 95 ₽, форвард 96 — цена определённости 1 000 ₽.</p>}
          {rep.flood && <p className="text-sm mt-2">Сонная вышла из берегов: Набережная и Заречье под водой, парк и вокзал — сухие. Кофейни и цех стоят у одной реки: вероятность потерять оба — 0,3, а не 0,3 × 0,3 = 0,09. Это один риск два раза.</p>}
          {rep.day === HOLDING.floodDay && !rep.flood && <p className="text-sm mt-2">Сонная осталась в берегах. Решения о риске принимались до того, как это стало известно.</p>}
          {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{HOLDING_CHAPTERS[rep.newChapter - 1].title}»</p>}
        </LavkaCard>
      )}

      {day === 1 && !rep && (
        <LavkaCard tint={COLORS.sageSoft}>
          <p className="text-sm leading-relaxed">Совет в башне. Дочки работают сами и приносят {rub((h.subsidiaries || []).filter((s) => s.daysLeft > 0).reduce((s, x) => s + x.dividend, 0))} в день. Совет выделил фонд развития {rub(HOLDING.devFund)} на проекты апреля.
            Марк Ильич: «Деньги, которые лежат, стоят два процента в день. Не мне — вам самим».</p>
          {(h.subsidiaries || []).map((s) => <Row key={s.name} l={s.name} v={`${rub(s.dividend)}/день · ${s.daysLeft} дн.`} />)}
        </LavkaCard>
      )}

      {/* Портфель */}
      {!h.approved && day >= 2 && day <= HOLDING.approveBy && (
        <LavkaCard>
          <p className="font-semibold">📊 Доска проектов · бюджет {rub(HOLDING.budget)} · утвердить до {HOLDING.approveBy}-го дня</p>
          {board.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-sm py-1">
              <input type="checkbox" className="mt-1" checked={pick.includes(p.id)} onChange={(e) => setPick(e.target.checked ? [...pick, p.id] : pick.filter((x) => x !== p.id))} />
              <span className="flex-1">{p.id} «{p.name}»: {rub(p.cost)}, {rub(p.cf)}/день · окупаемость {holdingPayback(p).toFixed(1).replace(".", ",")} дн.
                {showNPV && <span style={{ fontFamily: LAVKA_MONO }}> · NPV {rub(holdingNPV(p))} · PI {holdingPI(p).toFixed(3).replace(".", ",")}</span>}</span>
            </label>
          ))}
          {day < 5 && <p className="text-xs" style={{ color: COLORS.inkSoft }}>Ещё проекты появятся {day < 4 && h.semyonTrust ? "на 4-й и 5-й день" : "на 5-й день"}.</p>}
          <p className="text-xs mt-1" style={{ fontFamily: LAVKA_MONO, color: pickCost > HOLDING.budget ? COLORS.rust : COLORS.inkSoft }}>Выбрано на {rub(pickCost)} из {rub(HOLDING.budget)}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {!showNPV && <button onClick={() => setShowNPV(true)} className="text-sm px-3.5 py-1.5 rounded-full" style={ghost}>📓 Привести к сегодня (NPV при 2%, 30 дней)</button>}
            <button onClick={() => setH((x) => holdingApprove(x, pick))} disabled={pickCost > HOLDING.budget || pickCost > h.cash} className="text-sm px-4 py-2 rounded-full" style={btn}>Утвердить портфель</button>
          </div>
          {showNPV && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Окупаемость меньше срока ещё не значит NPV &gt; 0: деньги через 30 дней стоят меньше сегодняшних. PI = PV/вложение ранжирует делимые проекты; неделимые сравнивают наборами.</p>}
        </LavkaCard>
      )}
      {h.approved && day <= HOLDING.approveBy + 1 && (
        <LavkaCard tint={h.approved.right ? COLORS.sageSoft : COLORS.amberSoft}>
          <p className="text-sm">Портфель: {h.approved.ids.join(" + ") || "без проектов"}, NPV {rub(h.approved.npv)}. Лучший набор в бюджете — NPV {rub(h.approved.best)}.{h.approved.right ? "" : " Жадный выбор по PI теряет на неделимости: проверь наборы."}</p>
        </LavkaCard>
      )}

      {/* Налог */}
      {!h.taxRegime && day >= HOLDING.tax.fromDay && !levelOver && (
        <LavkaCard>
          <p className="font-semibold">🧾 Налоговый режим холдинга</p>
          <p className="text-sm mt-1">Доходы за период {rub(HOLDING.tax.R)}, расходы {rub(HOLDING.tax.E)} (E/R = {(HOLDING.tax.E / HOLDING.tax.R).toFixed(2).replace(".", ",")}). Налог платится на 21-й день; не выберешь — останешься на УСН 6%.</p>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Граница: 0,06·R = 0,15·(R − E) ⇔ E/R = 60%. В игре налог упрощён: без страховых взносов, НДС и региональных ставок.</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={() => setH((x) => holdingChooseTax(x, "usn6"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>УСН 6% доходов</button>
            <button onClick={() => setH((x) => holdingChooseTax(x, "usn15"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>УСН 15% (доходы − расходы)</button>
          </div>
        </LavkaCard>
      )}
      {h.taxRegime && day === HOLDING.tax.fromDay + 1 && <LavkaCard><p className="text-sm">Режим: {h.taxRegime === "usn6" ? "6%" : "15%"} → налог {rub(holdingTax(HOLDING.tax, h.taxRegime))} (другой — {rub(holdingTax(HOLDING.tax, h.taxRegime === "usn6" ? "usn15" : "usn6"))}).</p></LavkaCard>}

      {/* Кредит */}
      {!h.loan && day >= L.day && !levelOver && (
        <LavkaCard>
          <p className="font-semibold">🏦 Кредит Марка Ильича: 300 000 на 10 дней под 2%</p>
          <Row l="Аннуитет: платёж ровный" v={`${rub(ann[0])} × 10 = ${rub(ann.reduce((s, x) => s + x, 0))}`} />
          <Row l="Дифференцированный" v={`${rub(dif[0])} → ${rub(dif[9])} = ${rub(dif.reduce((s, x) => s + x, 0))}`} />
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Переплата у дифференцированного меньше — но потому, что долг гасится быстрее. Деньги на счёте приносят те же 2%, поэтому PV платежей обеих схем ровно 300 000 ({rub(holdingSchedulePV(ann))} и {rub(holdingSchedulePV(dif))}): здесь кредит нейтрален. Схема важна, когда ставка кредита отличается от доходности денег или когда деньги вложены и на первые платежи может не хватить.</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={() => setH((x) => holdingTakeLoan(x, "annuity"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Аннуитет</button>
            <button onClick={() => setH((x) => holdingTakeLoan(x, "diff"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Дифференцированный</button>
            <button onClick={() => setH((x) => holdingTakeLoan(x, "none"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Не брать</button>
          </div>
        </LavkaCard>
      )}

      {/* Валюта */}
      {h.hedged == null && day >= HOLDING.fx.day && day < HOLDING.fx.payDay && (
        <LavkaCard>
          <p className="font-semibold">💱 Твёрдый курс: зерно на 1 000 у. е. оплатить на {HOLDING.fx.payDay}-й день</p>
          <p className="text-sm mt-1">Сейчас 90 ₽. Через 10 дней — 80 или 110, поровну (в среднем 95). Марк Ильич предлагает форвард: 96 ₽ что бы ни случилось.</p>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Форвард дороже ожидаемого курса на 1 ₽ — это цена определённости (здесь курс назначает банк, депозита в у. е. нет). Нейтральному к риску выгоднее спот; форвард — если скачок на 20 000 ₽ ударит по кассе.</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={() => setH((x) => holdingHedge(x, true))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Форвард 96</button>
            <button onClick={() => setH((x) => holdingHedge(x, false))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Платить по споту</button>
          </div>
        </LavkaCard>
      )}

      {/* Страховка */}
      {!h.insurance && day >= HOLDING.insurance.fromDay && day <= HOLDING.insurance.untilDay && (
        <LavkaCard>
          <p className="font-semibold">☂️ Эдуард: страховка от паводка (до {HOLDING.insurance.untilDay}-го дня)</p>
          {pol.loss === 0 ? <p className="text-sm mt-1">У реки у холдинга ничего нет: кофейни и цех проданы. Страховать нечего.</p> : (<>
            <p className="text-sm mt-1">Паводок бывает три весны из десяти. Под водой: {ex.cafes ? `кофейни ${rub(ex.cafes)}` : ""}{ex.cafes && ex.factory ? ", " : ""}{ex.factory ? `цех ${rub(ex.factory)}` : ""}. Премия платится в день начала половодья (18-го).</p>
            {(() => { const f = holdingCashForecast(h); return (<>
              <Row l="Полный полис" v={`${rub(pol.full)} → ожидаемо ${rub(holdingInsuranceCost("full", pol, f))}`} />
              <Row l={`С франшизой 20 000 на объект`} v={`${rub(pol.deductible)} → ожидаемо ${rub(holdingInsuranceCost("deductible", pol, f))}`} />
              <Row l="Без полиса" v={`ожидаемо ${rub(holdingInsuranceCost("none", pol, f))}`} />
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Прогноз кассы к 18-му ≈ {rub(f)}. Если 18-го денег не хватит (премия, убыток) — экстренный кредит: 5% в день на 20 дней, по обычной ставке после убытка не дают; в PV он обходится ≈ 0,79 рубля на рубль нехватки. Премия с нагрузкой всегда дороже ожидаемого убытка — страховка нужна тому, кого убыток выбивает из кассы.</p>
            </>); })()}
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Марк Ильич: «Рисков почти нет: бизнесы разные». Эдуард: «Вы страхуете два бизнеса от одной реки. Это один риск два раза».</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[["none", "Не страховать"], ["deductible", "С франшизой"], ["full", "Полный"]].map(([k, l]) => (
                <button key={k} onClick={() => setH((x) => holdingInsure(x, k))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>{l}</button>))}
            </div>
          </>)}
        </LavkaCard>
      )}
      {h.insurance && !h.insurance.nothing && day === HOLDING.insurance.untilDay + 1 && h.insurance.costs && (
        <LavkaCard tint={h.insurance.right ? COLORS.sageSoft : COLORS.amberSoft}><p className="text-sm">Страховка: выбрано «{({ none: "без полиса", deductible: "с франшизой", full: "полный" })[h.insurance.choice]}», дешевле всего по ожиданию — «{({ none: "без полиса", deductible: "с франшизой", full: "полный" })[h.insurance.best]}».</p></LavkaCard>
      )}

      {/* Вода */}
      {day === 13 && <LavkaCard><p className="text-sm">Лёва: «Снега зимой было на треть больше нормы. Сонная в такие годы выходит из берегов примерно в трёх вёснах из десяти. Я не пугаю — я считаю».</p></LavkaCard>}
      {day >= HOLDING.flagDay && day < HOLDING.floodDay && h.world.flag && (
        <LavkaCard tint={COLORS.rustSoft}>
          <p className="font-semibold">🚩 Красный флаг: Сонная за ночь поднялась на метр</p>
          <p className="text-sm mt-1">После красного флага паводок случается в половине случаев. Страховку уже не продают: «Если бы я продавал полисы тем, кто уже знает, что вода идёт, — у меня были бы только такие клиенты» (неблагоприятный отбор).</p>
          {!h.moved ? (<>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Поднять запасы наверх — {rub(HOLDING.move.cost)}, убыток −40%. Без флага это было бы лишним: паводка без флага не бывает — в этом ценность информации. Но если убыток покрыт полисом, беречь запасы холдингу незачем (моральный риск — поэтому страховщики и ставят франшизу): ожидаемая выгода для тебя ≈ {rub(holdingActionGain(h, { moved: true }))}.</p>
            <button onClick={() => setH((x) => holdingMove(x))} className="mt-2 text-sm px-3.5 py-2 rounded-full" style={btn}>Перенести запасы</button>
          </>) : <p className="text-xs mt-1">Запасы перенесены.</p>}
          {day >= HOLDING.dam.day && h.damPaid == null && (<>
            <p className="text-sm mt-3 font-semibold">🧱 Мешки с песком: дамба — 20 000 с каждого из шести на Набережной</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Двое платят в любом случае; Семён и ещё двое — если платишь ты. Дамба строится при четырёх взносах и снижает убыток кофеен ещё на 60%. Дамба одна на всех — кто не скинулся, тоже будет сухим. Здесь твой взнос решающий: платить выгодно, если ожидаемое снижение твоего незастрахованного убытка ({rub(holdingActionGain(h, { damBuilt: true }))}) больше взноса.</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button onClick={() => setH((x) => holdingDam(x, true))} className="text-sm px-3.5 py-2 rounded-full" style={btn}>Скинуться 20 000</button>
              <button onClick={() => setH((x) => holdingDam(x, false))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Построят и без меня</button>
            </div>
          </>)}
          {h.damPaid != null && <p className="text-xs mt-1">{h.damPaid ? "Ты скинулся(лась) — Семён и ещё двое тоже: дамба строится." : "Ты не дал(а) — Семён тоже: дамбы не будет."}</p>}
        </LavkaCard>
      )}
      {day >= HOLDING.flagDay && day < HOLDING.floodDay && !h.world.flag && <LavkaCard><p className="text-sm">Сонная спокойна, красного флага нет.</p></LavkaCard>}

      {/* Экзамен и финал */}
      {holdingExamOpen(h) && !h.sold && (
        <LavkaCard tint={COLORS.blueSoft}>
          <p className="font-semibold">🎓 Экзамен уровня 5 открыт</p>
          {h.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(h.examBest.eff * 100)}%{h.examBest.medal ? " " + medalOf(h.examBest.medal).emoji : ""} · попыток {h.examBest.attempts}</p>}
          <button onClick={() => setH((x) => ({ ...x, examActive: holdingExamNew(x, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={btn}>Сдать экзамен</button>
        </LavkaCard>
      )}
      {h.examBest && h.examBest.medal && !h.sold && (() => {
        const o = holdingOffers(h, h.examBest.medal);
        return (
          <LavkaCard tint={COLORS.sageSoft}>
            <p className="font-semibold">⛲ Скамейка у фонтана: продажа холдинга</p>
            <Row l={`Плотников (рейтинг ${medalOf(h.examBest.medal).emoji})`} v={rub(o.plotnikov)} />
            <Row l="Железнова (95% после аудита)" v={rub(o.zheleznova)} />
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Истинная стоимость = дочки (PV оставшихся выплат + a(2%, 30) дневных дивидендов после них) + PV оставшихся потоков проектов = {rub(o.trueValue)}. Плотников видит только рейтинг и платит по среднему продающих; лучшие уходят к тем, кто смотрит отчёты, — и средняя цена у него падает. Тому, кто лучше своего рейтинга, выгодно раскрыться; кто хуже — промолчать.</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button onClick={() => setH((x) => holdingSell(x, "plotnikov"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Продать Плотникову</button>
              <button onClick={() => setH((x) => holdingSell(x, "zheleznova"))} className="text-sm px-3.5 py-2 rounded-full" style={ghost}>Открыть отчёты Железновой</button>
            </div>
          </LavkaCard>
        );
      })()}
      {h.sold && (
        <LavkaCard tint={COLORS.sageSoft}>
          <p className="font-semibold">🔑 Путь компании пройден</p>
          <p className="text-sm mt-1">Холдинг продан {h.sold.buyer === "zheleznova" ? "Железновой" : "Плотникову"} за {rub(h.sold.price)}. Итоговый капитал: <b>{rub(h.finalCapital)}</b>.</p>
          <p className="text-sm mt-2">Медали: {[st.level1, st.level2, st.level3, st.level4].map((x, i) => (x ? medalOf(x.medal)?.emoji : "·")).join(" ")} {medalOf(h.examBest.medal)?.emoji}</p>
          <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Вера: «Ключ тугой. Поворачивай два раза».</p>
        </LavkaCard>
      )}

      {!levelOver && !h.sold && <button onClick={next} className="w-full py-3.5 rounded-full text-base" style={{ ...btn, fontWeight: 700 }}>Следующий день</button>}

      <div className="mt-4">
        {HOLDING_GOALS.map((g) => (
          <LavkaCard key={g.id} tint={h.goals[g.id] ? COLORS.sageSoft : undefined}>
            <p className="font-semibold">{g.emoji} {g.title}</p>
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
          </LavkaCard>
        ))}
      </div>
    </div>
  );
}

export { HoldingScreen, LevelFinish4Card };
