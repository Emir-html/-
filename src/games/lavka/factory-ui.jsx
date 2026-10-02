/* «Своё производство» — экраны уровня 4 (серый прототип) и карточка завершения уровня 3.
   Логика — ./factory.js; состояние уровня 4 живёт в lavka-save → st.factory. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  FACTORY, FACTORY_GOALS, FACTORY_CHAPTERS,
  factoryQ, factoryPrice, factoryFloor, factoryWage, factoryBoilerMath, factoryBuyBoiler, factoryAnswer, factorySimulate, factoryVerdict,
  factoryExamOpen, factoryExamNew, factoryExamPlayDay, factoryExamResult, factoryExamFinish, levelFinish3,
} from "./factory.js";
import { LavkaStepper, LavkaAwning, LavkaCard, LevelFinishCapital } from "./components.jsx";

const f0 = (x) => Math.round(x).toLocaleString("ru-RU");

/* Карточка в сети кофеен: экзамен уровня 3 сдан с медалью → продать сеть или оставить дочкой. */
function LevelFinish3Card({ st, update }) {
  if (!st.chain) return null;
  return <LevelFinishCapital level={3} examBest={st.chain.examBest} nextTitle="Своё производство" business="Сеть кофеен"
    onFinish={(choice) => update((s) => levelFinish3(s, choice) || s)} />;
}

/* Экзамен уровня 4: 3 сценария. */
function FactoryExam({ factory, setFactory }) {
  const exam = factory.examActive;
  const [L, setL] = useState(14);
  const [buy, setBuy] = useState(false);
  const [last, setLast] = useState(null);
  const i = exam.results.length, done = i >= exam.days.length;
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 4{done ? " — итог" : ` · день ${i + 1} из ${exam.days.length}`}</p>
      <p className="text-sm mt-1">Три сценария: монопсония, МРОТ, котёл при новой ставке. Оценка дня ≈ 1 − 2 × относительная ошибка найма (прибыль по найму плоская, поэтому строго);
        неверный котёл вычитает свою переплату в дневном эквиваленте PV. Касса не меняется.</p>
    </LavkaCard>
  );
  if (done) {
    const res = factoryExamResult(exam), medal = res && res.medal;
    return (
      <div className="ms-rise">
        {head}
        <LavkaCard tint={medal ? COLORS.sageSoft : COLORS.rustSoft}>
          {res ? (<>
            <p className="text-3xl" style={{ fontFamily: LAVKA_MONO, fontWeight: 700 }}>{Math.round(res.eff * 100)}%</p>
            <p className="text-base mt-1 font-semibold">{medal ? `${medal.emoji} ${medal.title}` : "Без медали"}</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Худший день: {Math.round(res.minDay * 100)}%.</p>
          </>) : <p className="font-semibold">Экзамен недействителен — пересдай.</p>}
          {exam.days.map((d, k) => {
            const r = exam.results[k];
            return (
              <div key={k} className="text-sm py-1.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <div className="flex justify-between gap-2"><span>{k + 1}. {d.title}</span><span style={{ fontFamily: LAVKA_MONO }}>{res ? Math.round(res.days[k] * 100) + "%" : ""}</span></div>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>ты: {r.ans.L} чел.{d.kind === "boiler" ? (r.ans.buy ? ", купить" : ", аренда") : ""}; эталон: {r.best.L}{d.kind === "boiler" ? (r.best.buy ? ", купить" : ", аренда") : ""}
                  {d.kind === "minwage" && r.best.L < 14 ? " — МРОТ выше MRP при монопсоническом найме: занятость падает" : ""}</p>
              </div>
            );
          })}
        </LavkaCard>
        <button onClick={() => setFactory((f) => factoryExamFinish(f, f.examActive))} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Вернуться в цех</button>
      </div>
    );
  }
  const d = exam.days[i];
  return (
    <div>
      {head}
      {last && <LavkaCard><p className="text-sm">День {i} закрыт. Разбор — в конце экзамена.</p></LavkaCard>}
      <LavkaCard tint={COLORS.amberSoft}>
        <p className="font-semibold">День {i + 1}: {d.title}</p>
        <p className="text-sm mt-1">{d.text}</p>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Q(L) = 14L − 0,25L² наборов.</p>
      </LavkaCard>
      <LavkaCard>
        <p className="font-semibold">Сколько людей</p>
        <div className="mt-2"><LavkaStepper value={L} onChange={setL} min={0} max={40} suffix=" чел." /></div>
        {d.kind === "boiler" && (
          <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={buy} onChange={(e) => setBuy(e.target.checked)} /> Купить котёл (иначе — аренда)</label>
        )}
      </LavkaCard>
      <button onClick={() => { const out = factoryExamPlayDay(factory, exam, { L, buy: d.kind === "boiler" && buy }); setLast(out.result); setFactory((f) => ({ ...f, examActive: out.exam })); window.scrollTo?.(0, 0); }}
        className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Завершить день {i + 1} из {exam.days.length}</button>
      <button onClick={() => setFactory((f) => ({ ...f, examActive: null }))} className="w-full py-2.5 rounded-full text-sm mt-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}>Прервать экзамен (не засчитается)</button>
    </div>
  );
}

function FactoryScreen({ st, update, children }) {
  const factory = st.factory;
  const [tab, setTab] = useState("shop");
  const [rep, setRep] = useState(null);
  const [rate, setRate] = useState(2);
  const setFactory = (fn) => update((s) => ({ ...s, factory: fn(s.factory) }));
  const day = factory.day, p = factoryPrice(day), floor = factoryFloor(factory), L = factory.L;
  const ch = FACTORY_CHAPTERS[factory.chapter - 1], next = FACTORY_CHAPTERS[factory.chapter];
  const dividends = (factory.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);
  const levelOver = day > FACTORY.levelDays;
  const open = () => {
    const out = factorySimulate(factory, Math.random);
    setRep(out.report);
    update((s) => ({ ...s, factory: out.next }));
    window.scrollTo?.(0, 0);
  };
  if (factory.examActive) return (
    <div>
      <LavkaAwning title="Цех «Заря»" sub={`Уровень 4 · экзамен · на счёте ${lavkaRub(factory.cash)}`} />
      <FactoryExam factory={factory} setFactory={setFactory} />
    </div>
  );
  const Line = ({ l, v }) => (
    <div className="flex justify-between text-sm py-0.5 gap-2"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO, whiteSpace: "nowrap" }}>{v}</span></div>
  );
  const bm = factoryBoilerMath(rate / 100);
  const wNow = factoryWage(L, floor);

  return (
    <div>
      <LavkaAwning title="Цех «Заря»" sub={`Уровень 4 · глава ${factory.chapter} «${ch.title}» · день ${day} · на счёте ${lavkaRub(factory.cash)}${dividends ? ` · дочки +${lavkaFmt(dividends)} ₽/день` : ""}`} />
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[["shop", "Цех"], ["boiler", "Котёл"], ["goals", "Цели"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="text-sm px-4 py-2 rounded-full"
            style={{ background: tab === id ? COLORS.onyx : COLORS.surfaceSolid, color: tab === id ? COLORS.onyxText : COLORS.ink, border: `1px solid ${COLORS.line}` }}>{label}</button>
        ))}
      </div>

      {tab === "shop" && (
        <div>
          {rep && (
            <LavkaCard tint={rep.profit >= 0 ? COLORS.sageSoft : COLORS.rustSoft}>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>День {rep.day} закрыт</p>
              <p className="text-2xl mt-1" style={{ fontFamily: LAVKA_MONO, fontWeight: 700, color: rep.profit >= 0 ? COLORS.sage : COLORS.rust }}>{rep.profit >= 0 ? "+" : ""}{lavkaRub(rep.profit)}</p>
              <div className="mt-2">
                <Line l={`${f0(rep.Q)} наборов по ${rep.p} ₽ (без сырья)`} v={lavkaRub(rep.p * rep.Q)} />
                <Line l={`Зарплата: ${rep.L} × ${f0(rep.wage)} ₽`} v={"−" + lavkaRub(rep.wage * rep.L)} />
                <Line l="Аренда цеха" v={"−" + lavkaRub(rep.shop)} />
                <Line l={factory.boiler && !factory.boiler.sold ? "Обслуживание котла" : "Аренда котла"} v={"−" + lavkaRub(rep.boilerCost)} />
                {rep.dividend > 0 && <Line l="Дивиденды дочек" v={"+" + lavkaRub(rep.dividend)} />}
                {rep.interest !== 0 && <Line l="Проценты на остаток (2%)" v={(rep.interest > 0 ? "+" : "") + lavkaRub(rep.interest)} />}
                {rep.reward > 0 && <Line l="Награды за цели" v={"+" + lavkaRub(rep.reward)} />}
                {rep.resale > 0 && <Line l="Котёл продан (б/у, по оставшемуся сроку)" v={"+" + lavkaRub(rep.resale)} />}
              </div>
              <p className="text-sm mt-2">{factoryVerdict(rep)}</p>
              {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{FACTORY_CHAPTERS[rep.newChapter - 1].title}»</p>}
              {rep.newGoals.map((id) => { const g = FACTORY_GOALS.find((x) => x.id === id); return <p key={id} className="text-sm mt-1 font-semibold">{g.emoji} Цель: {g.title} (+{lavkaFmt(g.reward)} ₽)</p>; })}
            </LavkaCard>
          )}

          {children}
          {factoryExamOpen(factory) && (
            <LavkaCard tint={COLORS.blueSoft}>
              <p className="font-semibold">🎓 Экзамен уровня 4 открыт</p>
              <p className="text-sm mt-1">3 сценария без подсказок; числа каждый раз новые. Касса не меняется, пересдавать можно.</p>
              {factory.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(factory.examBest.eff * 100)}%{factory.examBest.medal ? " " + LAVKA_MEDALS.find((m) => m.id === factory.examBest.medal).emoji : ""} · попыток {factory.examBest.attempts}</p>}
              <button onClick={() => setFactory((f) => ({ ...f, examActive: factoryExamNew(f, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Сдать экзамен</button>
            </LavkaCard>
          )}

          {day === 1 && !rep && (
            <LavkaCard tint={COLORS.sageSoft}>
              <p className="text-sm leading-relaxed">
                Цех варенья на закрытом заводе «Заря». Набор уходит областной сети по 520 ₽, сырьё — 220: тебе остаётся {FACTORY.p} ₽. Выпуск Q(L) = 14L − 0,25L²:
                каждый следующий работник добавляет меньше. Ты — единственный работодатель в Заречье: чтобы пришли L человек, платишь каждому 600 + 50·L ₽.
              </p>
            </LavkaCard>
          )}

          {factory.offer === "contract" && (
            <LavkaCard tint={COLORS.amberSoft}>
              <p className="font-semibold">📝 Договор Нины</p>
              <p className="text-sm mt-1">«Коллективный договор: 1 400 каждому. И мы приводим ещё двоих — они за столько пойдут».</p>
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Граница 1 400 делает MRC плоской до 16 человек: при 16 прибыль ≈ 14 600 против 14 900 при монопсонии — договор стоит ≈ 300 ₽ в день и даёт работу ещё двоим. Решение — твоё.</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => setFactory((f) => factoryAnswer(f, "contract", true))} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Принять</button>
                <button onClick={() => setFactory((f) => factoryAnswer(f, "contract", false))} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Отказаться</button>
              </div>
            </LavkaCard>
          )}
          {factory.offer === "letter" && (
            <LavkaCard tint={COLORS.amberSoft}>
              <p className="font-semibold">✉️ Письмо против МРОТ</p>
              <p className="text-sm mt-1">Союз промышленников просит подписать письмо губернатору и оплатить юриста ({lavkaRub(FACTORY.letterCost)}): «МРОТ поднимут — наймут меньше. Это закон рынка».</p>
              <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Посчитай для своего цеха: при 1 400 готовы работать 16 человек, а 16-й приносит ≈ 1 800 ₽. МРОТ введут в любом случае — письмо параметров не меняет.</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => setFactory((f) => factoryAnswer(f, "letter", false))} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Не подписывать</button>
                <button onClick={() => setFactory((f) => factoryAnswer(f, "letter", true))} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Подписать (−{lavkaFmt(FACTORY.letterCost)} ₽)</button>
              </div>
            </LavkaCard>
          )}

          {levelOver ? <LavkaCard><p className="text-sm">Предновогодняя смена закончилась. Дальше — экзамен.</p></LavkaCard> : (<>
            <LavkaCard>
              <p className="font-semibold">Сколько людей на смену</p>
              <p className="text-xs" style={{ color: COLORS.inkSoft }}>Цена набора без сырья {p} ₽{day >= FACTORY.peakFrom ? " (предновогодний пик)" : ""}{floor ? ` · граница зарплаты ${floor} ₽ (${day >= FACTORY.minWageDay ? "МРОТ" : "договор Нины"})` : ""}</p>
              <div className="mt-2"><LavkaStepper value={L} onChange={(v) => setFactory((f) => ({ ...f, L: v }))} min={0} max={40} suffix=" чел." /></div>
              <p className="text-xs mt-2" style={{ color: COLORS.inkSoft, fontFamily: LAVKA_MONO }}>Чтобы пришли {L} человек, нужно платить {f0(wNow)} ₽ каждому · выпуск {f0(factoryQ(L))} наборов</p>
            </LavkaCard>
            <button onClick={open} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Начать смену</button>
          </>)}
        </div>
      )}

      {tab === "boiler" && (
        <LavkaCard>
          <p className="font-semibold">🔥 Котёл</p>
          <p className="text-sm mt-1">Аренда {lavkaRub(FACTORY.boiler.rent)} в день или покупка {lavkaRub(FACTORY.boiler.price)}: обслуживание {lavkaRub(FACTORY.boiler.maint)} в день,
            через {FACTORY.boiler.life} дней службы продаётся за {lavkaRub(FACTORY.boiler.salvage)}. Б/у котёл на рынке стоит столько, сколько сбережёт следующему владельцу, — поэтому сравнивают PV на весь срок службы.</p>
          <div className="flex items-center gap-3 mt-3 text-sm"><span>Ставка, % в день</span>
            <LavkaStepper value={rate} onChange={setRate} step={0.5} min={0.5} max={5} suffix="%" /></div>
          <div className="mt-2 text-sm" style={{ fontFamily: LAVKA_MONO }}>
            <p>PV аренды = {f0(FACTORY.boiler.rent)} × a({String(rate).replace(".", ",")}%, 48) = {f0(bm.pvRent)} ₽</p>
            <p>PV покупки = {f0(FACTORY.boiler.price)} + {f0(FACTORY.boiler.maint)} × a − {f0(FACTORY.boiler.salvage)}/(1 + r)⁴⁸ = {f0(bm.pvBuy)} ₽</p>
            <p className="mt-1" style={{ color: bm.buyBetter ? COLORS.sage : COLORS.rust }}>{bm.buyBetter ? `Купить дешевле на ${f0(bm.saving)} ₽` : `Аренда дешевле на ${f0(-bm.saving)} ₽`}</p>
          </div>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>«Восемь тысяч на сорок восемь дней — 384 000, покупка дешевле!» — так складывают рубли из разных дней. Приведи всё к сегодня. Ставка в игре — 2%.</p>
          {factory.boiler ? (
            <p className="text-sm mt-3">{factory.boiler.sold ? `Котёл продан за ${lavkaRub(factory.boiler.resale)}.` : `Котёл куплен на ${factory.boiler.day}-й день. В конце уровня продашь его по рыночной цене б/у.`}</p>
          ) : day <= FACTORY.levelDays && (
            <button onClick={() => setFactory((f) => factoryBuyBoiler(f))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>
              Купить котёл за {lavkaRub(FACTORY.boiler.price)}{factory.cash < FACTORY.boiler.price ? " (в кредит под 2%)" : ""}
            </button>
          )}
        </LavkaCard>
      )}

      {tab === "goals" && (
        <div>
          <LavkaCard tint={COLORS.blueSoft}>
            <p className="font-semibold">📖 Глава {ch.n}: «{ch.title}»</p>
            <p className="text-sm mt-1">{next ? <>Глава {next.n} «{next.title}» откроется на {next.fromDay}-й день. Ключевая цель главы: {FACTORY_GOALS.find((g) => g.id === ch.goal).emoji} «{FACTORY_GOALS.find((g) => g.id === ch.goal).title}».</> : "Все главы открыты. С 22-го дня — экзамен."}</p>
          </LavkaCard>
          {FACTORY_GOALS.map((g) => (
            <LavkaCard key={g.id} tint={factory.goals[g.id] ? COLORS.sageSoft : undefined}>
              <p className="font-semibold">{g.emoji} {g.title}</p>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
            </LavkaCard>
          ))}
          {st.level3 && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Уровень 3: медаль {LAVKA_MEDALS.find((m) => m.id === st.level3.medal)?.emoji}, сеть {st.level3.choice === "sell" ? `продана за ${lavkaRub(st.level3.sale)}` : `оставлена дочкой (${lavkaRub(st.level3.D || 0)}/день)`}.</p>}
        </div>
      )}
    </div>
  );
}

export { FactoryScreen, LevelFinish3Card };
