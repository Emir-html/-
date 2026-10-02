/* «Сеть кофеен» — экраны уровня 3 (серый прототип) и карточка завершения уровня 2.
   Логика — ./chain.js; состояние уровня 3 живёт в lavka-save → st.chain. */
import React, { useState } from "react";
import { COLORS } from "../../ui/theme.js";
import { LAVKA_MONO, lavkaRub, lavkaFmt, LAVKA_MEDALS } from "./model.js";
import {
  CHAIN, CHAIN_GOALS, CHAIN_CHAPTERS, CHAIN_UPGRADES,
  chainDay, chainMC, chainZoya, chainBuy, chainSetT, chainDecideT, chainCloseK1, chainSimulate, chainVerdict, chainK1MinAC, chainTContribution, levelFinish2,
  chainExamOpen, chainExamNew, chainExamPlayDay, chainExamResult, chainExamFinish,
} from "./chain.js";
import { LavkaStepper, LavkaAwning, LavkaCard, LevelFinishCapital } from "./components.jsx";
import { LevelFinish3Card } from "./factory-ui.jsx";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const f1 = (x) => (Math.round(x * 10) / 10).toString().replace(".", ",");

/* Карточка на ярмарке: экзамен уровня 2 сдан с медалью → продать квасную точку или оставить дочкой. */
function LevelFinish2Card({ st, update }) {
  if (!st.fair) return null;
  return <LevelFinishCapital level={2} examBest={st.fair.examBest} nextTitle="Сеть кофеен" business="Ярмарка"
    onFinish={(choice) => update((s) => levelFinish2(s, choice) || s)} />;
}

/* Поля решения дня: цены кофеен и выпуск кухонь (общие для дня и экзамена). */
function ChainControls({ v, set, k1Open, tOpen, k1Locked }) {
  return (
    <LavkaCard>
      <p className="font-semibold">Цены порции</p>
      <div className="flex items-center justify-between gap-2 mt-2 text-sm"><span>N «На Набережной»</span>
        <LavkaStepper value={v.pN} onChange={(x) => set({ ...v, pN: x })} min={0} max={250} suffix=" ₽" /></div>
      <div className="flex items-center justify-between gap-2 mt-2 text-sm" style={tOpen ? undefined : { opacity: 0.5 }}><span>T «У Техникума»{tOpen ? "" : " (закрыта)"}</span>
        <LavkaStepper value={v.pT} onChange={(x) => set({ ...v, pT: x })} min={0} max={150} suffix=" ₽" /></div>
      <p className="font-semibold mt-3">Своя выпечка, порций</p>
      <div className="flex items-center justify-between gap-2 mt-2 text-sm" style={k1Open ? undefined : { opacity: 0.5 }}><span>Кухня 1 «Заводская»{k1Open ? ` · MC ${f1(chainMC(CHAIN.kitchens[0], v.q[0]))}` : k1Locked ? " (сдана)" : " (не работает)"}</span>
        <LavkaStepper value={v.q[0]} onChange={(x) => set({ ...v, q: [x, v.q[1]] })} step={5} min={0} max={k1Open ? 200 : 0} /></div>
      <div className="flex items-center justify-between gap-2 mt-2 text-sm"><span>Кухня 2 «Ковчег» · MC {f1(chainMC(CHAIN.kitchens[1], v.q[1]))}</span>
        <LavkaStepper value={v.q[1]} onChange={(x) => set({ ...v, q: [v.q[0], x] })} step={5} min={0} max={220} /></div>
    </LavkaCard>
  );
}

/* Экзамен уровня 3: 3 дня на копии сети. */
function ChainExam({ chain, setChain }) {
  const exam = chain.examActive;
  const [v, setV] = useState({ pN: 95, pT: 80, q: [0, 160], tOpen: true, k1Open: false });
  const [last, setLast] = useState(null);
  const i = exam.results.length, done = i >= exam.days.length;
  const head = (
    <LavkaCard tint={COLORS.blueSoft}>
      <p className="font-semibold">🎓 Экзамен уровня 3{done ? " — итог" : ` · день ${i + 1} из ${exam.days.length}`}</p>
      <p className="text-sm mt-1">Три дня без подсказок: Семён напротив, фестиваль, практика студентов. Решаешь цены, выпуск кухонь, открывать ли T и арендовать ли сегодня Заводскую.
        Оценка — по марже после устранимых издержек (бариста, аренда Заводской): 1 − √(1 − маржа/маржа эталона). Касса не меняется.</p>
    </LavkaCard>
  );
  if (done) {
    const res = chainExamResult(exam), medal = res && res.medal;
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
            const r = exam.results[k], b = r.best;
            return (
              <div key={k} className="text-sm py-1.5" style={{ borderTop: `1px solid ${COLORS.line}` }}>
                <div className="flex justify-between gap-2"><span>{k + 1}. {d.title}</span><span style={{ fontFamily: LAVKA_MONO }}>{res ? Math.round(res.days[k] * 100) + "%" : ""}</span></div>
                <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                  ты: N {r.ans.pN} ₽, T {r.ans.tOpen ? `${r.ans.pT} ₽` : "закрыта"}, кухни {r.ans.k1Open ? r.ans.q[0] : "—"}/{r.ans.q[1]} → {lavkaRub(r.playerMargin)};
                  эталон: N {f1(b.pN)} ₽, T {b.tOpen ? `${f1(b.pT)} ₽` : "закрыта"}, кухни {b.k1Open ? b.q[0] : "—"}/{b.q[1]} → {lavkaRub(r.botMargin)}
                </p>
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
      {last && <LavkaCard><p className="text-sm">День {i} закрыт: маржа {lavkaRub(last.playerMargin)}. Разбор — в конце экзамена.</p></LavkaCard>}
      <LavkaCard tint={COLORS.amberSoft}>
        <p className="font-semibold">День {i + 1}: {d.title}</p>
        <p className="text-sm mt-1">{d.text}</p>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Спрос N: Q = {String(d.nk).replace(".", ",")}·({d.nA} − {d.noSemyon ? "2" : "2,2"}·P), мест {CHAIN.cafes[0].cap + (d.terrace ? CHAIN.terrace.plus : 0) + (d.extraSeats || 0)}; T: Q = {d.tA} − 2,5·P, мест 100.
          {d.extraSeats ? ` +${d.extraSeats} уличных столиков.` : ""} Скидка Гены: −2 ₽ на все свои порции от 250, −3 ₽ от 350. Бариста 1 500 ₽ на кофейню, аренда Заводской 2 000 ₽.</p>
      </LavkaCard>
      <LavkaCard>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.tOpen} onChange={(e) => setV({ ...v, tOpen: e.target.checked })} /> Открыть T сегодня</label>
        <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" checked={v.k1Open} onChange={(e) => setV({ ...v, k1Open: e.target.checked, q: [e.target.checked ? v.q[0] : 0, v.q[1]] })} /> Арендовать Заводскую сегодня</label>
      </LavkaCard>
      <ChainControls v={v} set={setV} k1Open={v.k1Open} tOpen={v.tOpen} />
      <button onClick={() => { const out = chainExamPlayDay(chain, exam, v); setLast(out.result); setChain((c) => ({ ...c, examActive: out.exam })); window.scrollTo?.(0, 0); }}
        className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Завершить день {i + 1} из {exam.days.length}</button>
      <button onClick={() => setChain((c) => ({ ...c, examActive: null }))} className="w-full py-2.5 rounded-full text-sm mt-2" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.inkSoft }}>Прервать экзамен (не засчитается)</button>
    </div>
  );
}

function ChainScreen({ st, update }) {
  const chain = st.chain;
  const [tab, setTab] = useState("chain");
  const [rep, setRep] = useState(null);
  const setChain = (fn) => update((s) => ({ ...s, chain: fn(s.chain) }));
  const day = chain.day, dd = chainDay(chain), zp = chainZoya(day);
  const ch = CHAIN_CHAPTERS[chain.chapter - 1], next = CHAIN_CHAPTERS[chain.chapter];
  const dividends = (chain.subsidiaries || []).filter((x) => x.daysLeft > 0).reduce((s, x) => s + x.dividend, 0);
  const toggles = day >= CHAIN.togglesFromDay, levelOver = day > CHAIN.levelDays;
  const open = () => {
    const out = chainSimulate(chain, Math.random);
    setRep({ ...out.report, verdict: chainVerdict(out.report, chain.obs) });
    update((s) => ({ ...s, chain: out.next }));
    window.scrollTo?.(0, 0);
  };
  if (chain.examActive) return (
    <div>
      <LavkaAwning title="Сеть кофеен" sub={`Уровень 3 · экзамен · на счёте ${lavkaRub(chain.cash)}`} />
      <ChainExam chain={chain} setChain={setChain} />
    </div>
  );
  const Line = ({ l, v, strong }) => (
    <div className="flex justify-between text-sm py-0.5 gap-2"><span>{l}</span><span style={{ fontFamily: LAVKA_MONO, fontWeight: strong ? 700 : 400, whiteSpace: "nowrap" }}>{v}</span></div>
  );
  const tabs = [["chain", "Сеть"], ["upgrades", "Улучшения"], ["goals", "Цели"]];
  const [cN, cT] = dd.cafes;
  const tC = toggles ? chainTContribution({ ...dd, tOpen: true }) : null, minAC = chainK1MinAC();

  return (
    <div>
      <LavkaAwning title="Сеть кофеен" sub={`Уровень 3 · глава ${chain.chapter} «${ch.title}» · день ${day} (${WEEKDAYS[(day - 1) % 7]}) · на счёте ${lavkaRub(chain.cash)}${dividends ? ` · дочки +${lavkaFmt(dividends)} ₽/день` : ""}`} />
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
              <div className="mt-2">
                <Line l={`N: ${Math.round(rep.sold[0])} порций по ${rep.pN} ₽${rep.queue[0] > 0.5 ? ` (не сели ${Math.round(rep.queue[0])})` : ""}`} v={lavkaRub(rep.sold[0] * rep.pN)} />
                {rep.pT != null && <Line l={`T: ${Math.round(rep.sold[1])} по ${rep.pT} ₽${rep.queue[1] > 0.5 ? ` (не сели ${Math.round(rep.queue[1])})` : ""}`} v={lavkaRub(rep.sold[1] * rep.pT)} />}
                <Line l={`Своя выпечка ${rep.q[0]} + ${rep.q[1]}${rep.tier ? ` (скидка Гены ${rep.tier} ₽)` : ""}`} v={"−" + lavkaRub(rep.ownCost)} />
                {rep.z > 0 && <Line l={`У Зои ${Math.round(rep.z)} по ${rep.zoya} ₽`} v={"−" + lavkaRub(rep.zoyaCost)} />}
                <Line l="Устранимые: бариста, аренда Заводской" v={"−" + lavkaRub(rep.avoid)} />
                <Line l="Неустранимые: аренды кофеен, «Ковчег»" v={"−" + lavkaRub(rep.sunk)} />
                {rep.dividend > 0 && <Line l="Дивиденды дочек" v={"+" + lavkaRub(rep.dividend)} />}
                {rep.interest !== 0 && <Line l="Проценты на остаток (2%)" v={(rep.interest > 0 ? "+" : "") + lavkaRub(rep.interest)} />}
                {rep.reward > 0 && <Line l="Награды за цели" v={"+" + lavkaRub(rep.reward)} />}
              </div>
              <p className="text-sm mt-2">{rep.verdict}</p>
              {rep.newChapter && <p className="text-sm mt-2 font-semibold">📖 Открыта глава {rep.newChapter}: «{CHAIN_CHAPTERS[rep.newChapter - 1].title}»</p>}
              {rep.newGoals.map((id) => { const g = CHAIN_GOALS.find((x) => x.id === id); return <p key={id} className="text-sm mt-1 font-semibold">{g.emoji} Цель: {g.title} (+{lavkaFmt(g.reward)} ₽)</p>; })}
            </LavkaCard>
          )}

          <LevelFinish3Card st={st} update={update} />
          {chainExamOpen(chain) && (
            <LavkaCard tint={COLORS.blueSoft}>
              <p className="font-semibold">🎓 Экзамен уровня 3 открыт</p>
              <p className="text-sm mt-1">3 дня без подсказок. Числа каждый раз новые. Касса не меняется, пересдавать можно.</p>
              {chain.examBest && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Лучший результат: {Math.round(chain.examBest.eff * 100)}%{chain.examBest.medal ? " " + LAVKA_MEDALS.find((m) => m.id === chain.examBest.medal).emoji : ""} · попыток {chain.examBest.attempts}</p>}
              <button onClick={() => setChain((c) => ({ ...c, examActive: chainExamNew(c, Math.floor(Math.random() * 2 ** 31)) }))} className="mt-3 text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Сдать экзамен</button>
            </LavkaCard>
          )}

          {day === 1 && !rep && (
            <LavkaCard tint={COLORS.sageSoft}>
              <p className="text-sm leading-relaxed">
                Две кофейни: N «На Набережной» (Q = 400 − 2·P, мест 140) и T «У Техникума» (Q = 300 − 2,5·P, мест 100). Две кухни:
                «Заводская» (первая порция 30 ₽, каждая следующая дороже на 10 коп.) и «Ковчег» (10 ₽, +15 коп.). Утром решаешь цены и выпуск каждой кухни.
                С 4-го дня Зоя довозит недостающее по фиксированной цене.
              </p>
            </LavkaCard>
          )}

          <LavkaCard>
            <p className="font-semibold">Сегодня</p>
            <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
              N: людей ×{String(cN.k).replace(".", ",")}, мест {cN.cap}{day >= CHAIN.semyonDay ? " · Семён напротив (спрос A ×0,8, B ×1,1)" : ""}{CHAIN.kiraDays.includes(day) ? " · пост Киры (A ×1,1)" : ""}{CHAIN.eduardDays.includes(day) ? " · Эдуард занял столик (−10 мест)" : ""}.
              {" "}T: людей ×{String(cT.k).replace(".", ",")}, мест {cT.cap}. Зоя: {zp == null ? "ещё не работает" : `${zp} ₽ за порцию`}.{dd.tiersOn ? " Скидка Гены: −2 ₽ от 250 своих, −3 ₽ от 350." : ""}
            </p>
            {toggles && (
              <div className="mt-2 text-sm">
                {chain.tClosed ? <p className="text-xs">Кофейня T закрыта навсегда: бариста не платится, аренда 2 000 по договору — платится.</p> : (<>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={chain.tOpen !== false} onChange={(e) => setChain((c) => chainSetT(c, e.target.checked))} /> Кофейня T открыта сегодня</label>
                  <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Закрыть T на день — сэкономить бариста 1 500 ₽; аренда 2 000 по договору платится в любом случае.{chain.tDecision ? ` Вклад T сегодня ≈ ${lavkaRub(tC.beforeBarista)} сверх выпечки.` : ""}</p>
                </>)}
                {!chain.k1Closed ? (
                  <button onClick={() => setChain((c) => chainCloseK1(c))} className="mt-2 text-sm px-3.5 py-1.5 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Сдать Заводскую кухню (навсегда)</button>
                ) : <p className="text-xs mt-1">Заводская сдана — её аренда 2 000 ₽ больше не платится.</p>}
                {!chain.k1Closed && <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>AC Заводской = 2 000/q + 30 + 0,05·q: минимум {f1(minAC.ac)} ₽ при {Math.round(minAC.q)} порциях.</p>}
              </div>
            )}
          </LavkaCard>

          {day === CHAIN.tDecisionDay && !chain.tDecision && (
            <LavkaCard tint={COLORS.amberSoft}>
              <p className="font-semibold">🧾 Вера: «Отчёт по точкам». Кофейня T в минусе?</p>
              <div className="mt-1 text-sm" style={{ fontFamily: LAVKA_MONO }}>
                {[["Выручка (100 × 80)", "8 000"], ["Выпечка и кофе (по средней 25 ₽)", "−2 501"], ["Аренда", "−2 000"], ["Бариста", "−1 500"], ["Доля расходов кухонь", "−2 247"], ["Ремонт (40 000 на 20 дней)", "−2 000"], ["Итого", "−2 248"]].map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-2"><span>{l}</span><span>{v}</span></div>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>«Вот что получается, если всё разложить по точкам. Вопрос — что из этого исчезнет, если закрыть». Реши сам(а), потом посмотришь расчёт.</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => setChain((c) => chainDecideT(c, "keep"))} className="text-sm px-4 py-2 rounded-full" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 600 }}>Оставить T</button>
                <button onClick={() => setChain((c) => chainDecideT(c, "close"))} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Закрыть T навсегда</button>
              </div>
            </LavkaCard>
          )}
          {chain.tDecision && day === CHAIN.tDecisionDay && (
            <LavkaCard tint={chain.tDecision.right ? COLORS.sageSoft : COLORS.rustSoft}>
              <p className="text-sm">{chain.tDecision.right ? "Верно. " : "Неверно. "}Закрытие убирает выручку T и устранимые издержки — выпечку для T и бариста. Аренда по договору и ремонт останутся при любом решении — они невозвратные.
                Вклад T сверх выпечки ≈ {lavkaRub(chain.tDecision.beforeBarista)} против бариста 1 500: {chain.tDecision.contribution > 0 ? `T приносит сети ≈ +${lavkaFmt(chain.tDecision.contribution)} ₽ в день.` : "T не покрывает даже бариста."}</p>
            </LavkaCard>
          )}

          {levelOver ? <LavkaCard><p className="text-sm">Месяц закончился. Дальше — экзамен.</p></LavkaCard> : (<>
            <ChainControls v={{ pN: chain.pN, pT: chain.pT, q: chain.q }} set={(v) => setChain((c) => ({ ...c, pN: v.pN, pT: v.pT, q: v.q }))}
              k1Open={!chain.k1Closed} tOpen={chain.tOpen !== false} k1Locked={chain.k1Closed} />
            {day <= CHAIN.oracleDays && <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Первую неделю Вера с калькулятором сверяет твои решения с истинным спросом. Потом — только твои наблюдения.</p>}
            <button onClick={open} className="w-full py-3.5 rounded-full text-base" style={{ background: COLORS.onyx, color: COLORS.onyxText, fontWeight: 700 }}>Открыть кофейни</button>
          </>)}
        </div>
      )}

      {tab === "upgrades" && CHAIN_UPGRADES.map((u) => {
        const owned = chain[u.id], locked = day < u.fromDay, afford = chain.cash >= u.cost;
        return (
          <LavkaCard key={u.id} tint={owned ? COLORS.sageSoft : undefined} style={locked ? { opacity: 0.55 } : undefined}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{locked ? "🔒" : u.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{u.title}</p>
                <p className="text-sm mt-0.5" style={{ color: COLORS.inkSoft }}>{locked ? `Откроется на ${u.fromDay}-й день.` : u.desc}</p>
                {owned && <p className="text-sm mt-2">{u.lesson}</p>}
              </div>
              {!locked && !owned && (
                <button onClick={() => setChain((c) => chainBuy(c, u.id))} disabled={!afford} className="text-sm px-3.5 py-2 rounded-full whitespace-nowrap"
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
            <p className="text-sm mt-1">{next ? <>Глава {next.n} «{next.title}» откроется на {next.fromDay}-й день. Ключевая цель главы: {CHAIN_GOALS.find((g) => g.id === ch.goal).emoji} «{CHAIN_GOALS.find((g) => g.id === ch.goal).title}».</> : "Все главы открыты. С 22-го дня — экзамен."}</p>
          </LavkaCard>
          {CHAIN_GOALS.map((g) => (
            <LavkaCard key={g.id} tint={chain.goals[g.id] ? COLORS.sageSoft : undefined}>
              <p className="font-semibold">{g.emoji} {g.title}</p>
              <p className="text-sm" style={{ color: COLORS.inkSoft }}>{g.desc} Награда {lavkaFmt(g.reward)} ₽.</p>
            </LavkaCard>
          ))}
          {st.level2 && <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Уровень 2: медаль {LAVKA_MEDALS.find((m) => m.id === st.level2.medal)?.emoji}, ярмарка {st.level2.choice === "sell" ? `продана за ${lavkaRub(st.level2.sale)}` : `оставлена дочкой (${lavkaRub(st.level2.D || 0)}/день)`}.</p>}
        </div>
      )}
    </div>
  );
}

export { ChainScreen, LevelFinish2Card };
