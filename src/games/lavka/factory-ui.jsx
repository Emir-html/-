/* «Своё производство» — экраны уровня 4 (серый прототип) и карточка завершения уровня 3.
   Логика — ./factory.js; состояние уровня 4 живёт в lavka-save → st.factory. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  FACTORY, FACTORY_GOALS, FACTORY_CHAPTERS, LEVEL3_DIVIDEND,
  factoryQ, factoryWage, factoryCost, factoryOvenMath, factorySalePrice3,
  factoryBuyOven, factorySimulate, factoryVerdict, levelFinish3,
  factoryExamOpen, factoryExamNew, factoryExamPlayDay, factoryExamResult, factoryExamFinish,
} from "./factory.js";
import { LavkaStepper, LavkaAwning, LavkaCard } from "./components.jsx";

/* Карточка в сети кофеен: экзамен уровня 3 сдан → продать сеть или оставить дочкой. */
function LevelFinish3Card({ st, update }) {
  const [sure, setSure] = useState(null);
  const medalId = st.chain && st.chain.examBest && st.chain.examBest.medal;
  if (!medalId) return null;
  const medal = LAVKA_MEDALS.find((m) => m.id === medalId);
  const price = Math.round(factorySalePrice3(medalId)), D = LEVEL3_DIVIDEND[medalId];
  return (
    <LavkaCard tint={COLORS.sageSoft}>
      <p className="font-semibold">{medal.emoji} Уровень 3 сдан — можно открыть уровень 4 «Своё производство»</p>
      <ul className="text-sm mt-1 list-disc pl-5">
        <li><b>Продать сеть</b>: сразу {lavkaRub(price)} — аннуитет {lavkaFmt(D)} ₽ × 60 дней при r = 0,5%/день.</li>
        <li><b>Оставить дочкой</b>: {lavkaFmt(D)} ₽ в день 60 дней. Прежние дочки продолжают платить.</li>
      </ul>
      {sure ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          <button onClick={() => update((s) => levelFinish3(s, sure) || s)} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Да, {sure === "sell" ? "продать" : "оставить дочкой"} и открыть пекарню</button>
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

/* Экзамен уровня 4: найм на трёх рынках труда и печь по NPV. */
function FactoryExam({ f, setF }) {
  const exam = f.examActive;
  const [L, setL] = useState(15);
  const [buy, setBuy] = useState(null);
  const i = exam.results.length, done = i >= exam.days.length;
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 4{done ? " — итог" : ` · задача ${i + 1} из ${exam.days.length}`}</p>
      <p className="text-sm mt-1">Рынок труда, монопсония, МРОТ, печь. Оценка — по решениям: насколько найм близок к оптимальному и верно ли решение о печи. Касса не меняется.</p>
    </LavkaCard>
  );
  if (done) {
    const res = factoryExamResult(exam), medal = res && res.medal;
    return (
      <div className="ms-rise">
        {head}
        <LavkaCard tint={medal ? COLORS.sageSoft : COLORS.rustSoft}>
          <p className="text-3xl" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{Math.round(res.eff * 100)}%</p>
          <p className="text-base mt-1 font-semibold">{medal ? `${medal.emoji} ${medal.title}` : "Без медали"}</p>
          {exam.days.map((d, k) => {
            const r = exam.results[k];
            return (
              <div key={k} className="text-sm py-1.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <div className="flex justify-between gap-2"><span>{k + 1}. {d.title}</span><span style={{ fontFamily: LAVKA_MONO }}>{Math.round(res.days[k] * 100)}%</span></div>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>{d.kind === "oven" ? `ты: ${r.ans.buy ? "купить" : "арендовать"}, верно: ${r.best.buy ? "купить" : "арендовать"}` : `ты: ${r.ans.L}, оптимум ≈ ${r.best.L.toFixed(1)}`}</p>
              </div>
            );
          })}
        </LavkaCard>
        <button onClick={() => setF((x) => factoryExamFinish(x, x.examActive))} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Вернуться в пекарню</button>
      </div>
    );
  }
  const d = exam.days[i];
  return (
    <div>
      {head}
      <LavkaCard tint={COLORS.amberSoft}><p className="font-semibold">Задача {i + 1}: {d.title}</p><p className="text-sm mt-1">{d.text}</p></LavkaCard>
      {d.kind === "oven" ? (
        <LavkaCard>
          <div className="flex gap-2">
            {[[true, "Купить"], [false, "Арендовать"]].map(([v, l]) => (
              <button key={l} onClick={() => setBuy(v)} className="text-sm px-4 py-2 rounded-full" style={{ background: buy === v ? COLORS.onyx : COLORS.surfaceSolid, color: buy === v ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>{l}</button>
            ))}
          </div>
        </LavkaCard>
      ) : (
        <LavkaCard><p className="font-semibold">Сколько нанять</p><div className="mt-2"><LavkaStepper value={L} onChange={setL} min={0} max={40} suffix=" чел." /></div></LavkaCard>
      )}
      <button disabled={d.kind === "oven" && buy == null} onClick={() => { const out = factoryExamPlayDay(f, exam, d.kind === "oven" ? { buy } : { L }); setF((x) => ({ ...x, examActive: out.exam })); setBuy(null); window.scrollTo?.(0, 0); }}
        className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700, opacity: d.kind === "oven" && buy == null ? 0.5 : 1 }}>Ответить · {i + 1} из {exam.days.length}</button>
      <button onClick={() => setF((x) => ({ ...x, examActive: null }))} className="w-full py-2.5 rounded-full text-sm mt-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}>Прервать экзамен (не засчитается)</button>
    </div>
  );
}

function FactoryScreen({ st, update }) {
  const f = st.factory;
  const [tab, setTab] = useState("bakery");
  const [rep, setRep] = useState(null);
  const setF = (fn) => update((s) => ({ ...s, factory: fn(s.factory) }));
  const ch = FACTORY_CHAPTERS[f.chapter - 1];
  const dividends = (f.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);
  const L = f.L, wage = factoryWage(f, L), oven = factoryOvenMath(f.day);
  const dQn = factoryQ(L + 1) - factoryQ(L), dCn = factoryCost(f, L + 1) - factoryCost(f, L), dQl = factoryQ(L) - factoryQ(L - 1), dCl = factoryCost(f, L) - factoryCost(f, Math.max(0, L - 1));
  const Line = ({ l, v }) => <div className="flex justify-between text-sm py-0.5"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO }}>{v}</span></div>;
  const open = () => { const out = factorySimulate(f, Math.random); setRep(out.report); update((s) => ({ ...s, factory: out.next })); window.scrollTo?.(0, 0); };
  const tabs = [["bakery", "Пекарня"], ["goals", "Цели"]];
  if (f.examActive) return (
    <div>
      <LavkaAwning title="Своё производство" sub={`Уровень 4 · экзамен · на счёте ${lavkaRub(f.cash)}`} />
      <FactoryExam f={f} setF={setF} />
    </div>
  );
  return (
    <div>
      <LavkaAwning title="Своё производство" sub={`Уровень 4 · глава ${f.chapter} «${ch.title}» · день ${f.day} · на счёте ${lavkaRub(f.cash)}${dividends ? ` · дочки +${lavkaFmt(dividends)} ₽/день` : ""}`} />
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="text-sm px-4 py-2 rounded-full"
            style={{ background: tab === id ? COLORS.onyx : COLORS.surfaceSolid, color: tab === id ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>{label}</button>
        ))}
      </div>
      {tab === "bakery" && (
        <div>
          {rep && (
            <LavkaCard tint={rep.profit >= 0 ? COLORS.sageSoft : COLORS.rustSoft}>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>День {rep.day} закрыт</p>
              <p className="text-2xl mt-1" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: rep.profit >= 0 ? COLORS.sage : COLORS.rust }}>{rep.profit >= 0 ? "+" : ""}{lavkaRub(rep.profit)}</p>
              <Line l={`Выручка: ${Math.round(rep.Q)} пирожков × ${rep.P.toFixed(0)} ₽`} v={lavkaRub(rep.P * rep.Q)} />
              <Line l={`Зарплаты: ${rep.L} × ${Math.round(rep.wage)} ₽`} v={"−" + lavkaRub(rep.wage * rep.L)} />
              {rep.oven > 0 && <Line l="Аренда печи" v={"−" + lavkaRub(rep.oven)} />}
              {rep.dividend > 0 && <Line l="Дивиденды дочек" v={"+" + lavkaRub(rep.dividend)} />}
              {rep.interest > 0 && <Line l="Проценты на остаток" v={"+" + lavkaRub(rep.interest)} />}
              <p className="text-sm mt-2">{factoryVerdict(rep)}</p>
              {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{FACTORY_CHAPTERS[rep.newChapter - 1].title}»</p>}
              {rep.newGoals.map((id) => { const g = FACTORY_GOALS.find((x) => x.id === id); return <p key={id} className="text-sm mt-1 font-semibold">{g.emoji} Цель: {g.title} (+{lavkaFmt(g.reward)} ₽)</p>; })}
            </LavkaCard>
          )}
          {factoryExamOpen(f) && (
            <LavkaCard tint={COLORS.blueSoft}>
              <p className="font-semibold">🎓 Экзамен уровня 4 открыт</p>
              <p className="text-sm mt-1">Найм на трёх рынках труда и решение о печи; параметры каждый раз новые. Касса не меняется.</p>
              {f.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(f.examBest.eff * 100)}%{f.examBest.medal ? " " + LAVKA_MEDALS.find((m) => m.id === f.examBest.medal).emoji : ""} · попыток {f.examBest.attempts}</p>}
              <button onClick={() => setF((x) => ({ ...x, examActive: factoryExamNew(x, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Сдать экзамен</button>
            </LavkaCard>
          )}

          {f.day === 1 && !rep && (
            <LavkaCard tint={COLORS.sageSoft}>
              <p className="text-sm leading-relaxed">Теперь ты сам печёшь пирожки и продаёшь их оптом по рыночной цене ≈ {FACTORY.price} ₽. Решение дня — <b>сколько нанять пекарей</b>.
                Каждый следующий добавляет меньше (MPL = {FACTORY.a} − L). Нанимать стоит, пока пирожки последнего работника (MRP = P·MPL) окупают то, во что он обходится.</p>
            </LavkaCard>
          )}
          {f.chapter === 2 && <LavkaCard tint={COLORS.amberSoft}><p className="text-sm">🏭 Пекарня — единственный работодатель в городке. Чтобы нанять больше, придётся поднять зарплату всем: w = {FACTORY.supplyC} + {FACTORY.supplyD}·L.</p></LavkaCard>}
          {f.chapter === 3 && <LavkaCard tint={COLORS.amberSoft}><p className="text-sm">📈 Введён МРОТ {lavkaFmt(FACTORY.wMin)} ₽. Платить меньше нельзя; больше — можно.</p></LavkaCard>}
          <LavkaCard>
            <p className="font-semibold">Сколько нанять сегодня</p>
            <div className="mt-2"><LavkaStepper value={L} onChange={(v) => setF((x) => ({ ...x, L: v }))} min={0} max={40} suffix=" чел." /></div>
            <p className="text-xs mt-2" style={{ fontFamily: LAVKA_MONO }}>
              {L}-й даёт ≈ {dQl.toFixed(1)} пирожка (≈ {Math.round(FACTORY.price * dQl)} ₽), расходы на труд растут на ≈ {Math.round(dCl)} ₽; следующий: ≈ {Math.round(FACTORY.price * dQn)} ₽ против ≈ {Math.round(dCn)} ₽. Зарплата всем {Math.round(wage)} ₽.
              Выпуск {Math.round(factoryQ(L))}, прибыль до шока ≈ {lavkaRub(FACTORY.price * factoryQ(L) - wage * L - (f.ovenOwned ? 0 : FACTORY.ovenRent))}.
            </p>
          </LavkaCard>
          <LavkaCard>
            <p className="font-semibold">🔥 Печь: {f.ovenOwned ? "своя" : `в аренде (${lavkaFmt(FACTORY.ovenRent)} ₽/день)`}</p>
            {!f.ovenOwned && (
              <>
                <p className="text-sm mt-1">Купить за {lavkaFmt(FACTORY.ovenPrice)} ₽? В {FACTORY.ovenDays}-й день печь продаётся за {lavkaFmt(FACTORY.ovenSalvage)} ₽ — осталось {Math.max(0, oven.N)} дн.
                  Сравни по NPV при r = 0,5%/день (игровая ставка, ≈ 500% годовых): PV аренды = {lavkaFmt(FACTORY.ovenRent)}·(1 − 1,005^−N)/0,005, PV покупки = цена − остаточная/1,005^N.</p>
                <button onClick={() => setF(factoryBuyOven)} disabled={f.cash < FACTORY.ovenPrice} className="mt-2 text-sm px-4 py-2 rounded-full"
                  style={{ background: f.cash >= FACTORY.ovenPrice ? COLORS.onyx : COLORS.paperDeep, color: f.cash >= FACTORY.ovenPrice ? COLORS.onyxText : COLORS.inkSoft }}>Купить печь</button>
              </>
            )}
            {f.ovenOwned && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>PV аренды ≈ {lavkaFmt(oven.pvRent)} ₽ против PV покупки ≈ {lavkaFmt(oven.pvBuy)} ₽ — {oven.buyBetter ? "покупка дешевле" : "аренда дешевле"}.</p>}
          </LavkaCard>
          <button onClick={open} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Начать смену · {L} пекарей</button>
        </div>
      )}
      {tab === "goals" && (
        <div>
          {FACTORY_GOALS.map((g) => (
            <LavkaCard key={g.id} tint={f.goals[g.id] ? COLORS.sageSoft : undefined}>
              <p className="font-semibold">{g.emoji} {g.title}</p>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
            </LavkaCard>
          ))}
          <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Уровень 5 «Холдинг» — в разработке.</p>
        </div>
      )}
    </div>
  );
}

export { FactoryScreen, LevelFinish3Card };
