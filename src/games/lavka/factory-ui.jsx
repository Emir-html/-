/* «Своё производство» — экраны уровня 4 (серый прототип) и карточка завершения уровня 3.
   Логика — ./factory.js; состояние уровня 4 живёт в lavka-save → st.factory. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  FACTORY, FACTORY_GOALS, FACTORY_CHAPTERS, LEVEL3_DIVIDEND,
  factoryQ, factoryMPL, factoryMRP, factoryWage, factoryMarginalLaborCost, factoryOvenMath, factorySalePrice3,
  factoryBuyOven, factorySimulate, factoryVerdict, levelFinish3,
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

function FactoryScreen({ st, update }) {
  const f = st.factory;
  const [tab, setTab] = useState("bakery");
  const [rep, setRep] = useState(null);
  const setF = (fn) => update((s) => ({ ...s, factory: fn(s.factory) }));
  const ch = FACTORY_CHAPTERS[f.chapter - 1];
  const dividends = (f.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);
  const L = f.L, wage = factoryWage(f, L), mlc = factoryMarginalLaborCost(f, L), oven = factoryOvenMath();
  const Line = ({ l, v }) => <div className="flex justify-between text-sm py-0.5"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO }}>{v}</span></div>;
  const open = () => { const out = factorySimulate(f, Math.random); setRep(out.report); update((s) => ({ ...s, factory: out.next })); window.scrollTo?.(0, 0); };
  const tabs = [["bakery", "Пекарня"], ["goals", "Цели"]];
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
              {L}-й даёт {factoryMPL(L).toFixed(0)} пирожков → MRP ≈ {factoryMRP(L).toFixed(0)} ₽; зарплата всем {Math.round(wage)} ₽; {L}-й обходится в {Math.round(mlc)} ₽{f.chapter === 2 ? " (MRC)" : ""}.
              Выпуск {Math.round(factoryQ(L))}, прибыль до шока ≈ {lavkaRub(FACTORY.price * factoryQ(L) - wage * L - (f.ovenOwned ? 0 : FACTORY.ovenRent))}.
            </p>
          </LavkaCard>
          <LavkaCard>
            <p className="font-semibold">🔥 Печь: {f.ovenOwned ? "своя" : `в аренде (${lavkaFmt(FACTORY.ovenRent)} ₽/день)`}</p>
            {!f.ovenOwned && (
              <>
                <p className="text-sm mt-1">Купить за {lavkaFmt(FACTORY.ovenPrice)} ₽ (через {FACTORY.ovenDays} дней её можно продать за {lavkaFmt(FACTORY.ovenSalvage)} ₽)?
                  Сравни по NPV при r = 0,5%/день: PV аренды = {lavkaFmt(FACTORY.ovenRent)}·(1 − 1,005⁻⁶⁰)/0,005, PV покупки = цена − PV остаточной стоимости.</p>
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
