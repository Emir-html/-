/* Общая тема MirStudy: палитры светлой и тёмной темы, фон страниц.
   Вынесено из App.jsx без изменений (блок «UI ХЕЛПЕРЫ»), чтобы экраны «Лавки» и приложение
   пользовались одним объектом COLORS. COLORS — изменяемый объект: AppRoot переключает тему
   через Object.assign(COLORS, DARK_COLORS | LIGHT_COLORS), поэтому все импорты видят текущую тему. */

/* Общие токены, не зависящие от темы — используются там, где элемент должен
   оставаться контрастной «чёрной панелью» независимо от выбранной темы
   (активная вкладка навигации, тёмная панель прогресса, чёрные кнопки). */
const ONYX = "#0A0D10";
const ONYX_TEXT = "#F4F6EF";

/* Палитра «тихая бумага»: тёплый нейтральный фон, глубокий графит вместо чистого
   чёрного, приглушённые акценты. Линии намеренно светлые — структуру держат
   отступы и мягкие тени, а не жирные рамки. */
const LIGHT_COLORS = {
  paper: "#FAFAF8",
  paperDeep: "#F0F0EC",
  surface: "#FFFFFFD9",
  surfaceSolid: "#FFFFFF",
  ink: "#1B1F23",
  inkSoft: "#697077",
  line: "#E4E4DE",
  blue: "#1F5F4B",
  blueSoft: "#E3F0EA",
  amber: "#C77D28",
  amberSoft: "#FBF0DC",
  yellow: "#B99516",
  yellowSoft: "#FAF3D9",
  sage: "#2E8B57",
  sageSoft: "#E2F2E8",
  teal: "#2A7F7C",
  tealSoft: "#E1F0EF",
  rust: "#B24F38",
  rustSoft: "#FAE7E1",
  onyx: ONYX,
  onyxText: ONYX_TEXT,
  /* --card-shadow из мобильного мокапа MirStudy — едва заметная тень у крупных
     карточек (флешкарты, панели уроков/задач), чтобы они чуть приподнимались
     над фоном страницы, не споря с плоской «флэт»-эстетикой. */
  cardShadow: "0 10px 26px rgba(27,31,35,0.06)",
};

/* Тёмная тема «флэт-дизайн»: почти чёрный фон и карточки, один доминирующий
   кислотно-лаймовый акцент (как в чёрно-салатовых мобильных UI-китах) плюс
   набор второстепенных акцентов, разведённых по оттенку, чтобы графики,
   бейджи и статусы прогресса оставались различимы на чёрном. */
const DARK_COLORS = {
  paper: "#0A0A0A",
  paperDeep: "#141414",
  surface: "#1A1A1AE6",
  surfaceSolid: "#1A1A1A",
  ink: "#F2F2F0",
  inkSoft: "#8F9490",
  line: "#262626",
  blue: "#8BC34A",
  blueSoft: "#1C2A0F",
  amber: "#F0B94E",
  amberSoft: "#2B2313",
  yellow: "#D9C04A",
  yellowSoft: "#2B2712",
  sage: "#4CAF50",
  sageSoft: "#16260F",
  teal: "#3AC7B0",
  tealSoft: "#122A26",
  rust: "#F0644A",
  rustSoft: "#2E1710",
  onyx: ONYX,
  onyxText: ONYX_TEXT,
  cardShadow: "0 10px 26px rgba(0,0,0,0.45)",
};

/* COLORS — изменяемый объект: его поля переписываются при смене темы
   (см. Object.assign в компоненте), поэтому все хелперы ниже, читающие
   COLORS.xxx во время рендера, автоматически подхватывают нужную тему. */
const COLORS = { ...LIGHT_COLORS };

/* Фон страницы собирается из четырёх слоёв: точечная сетка (отсылка к блокноту
   для набросков графиков), две мягкие цветные ауры в акцентных тонах и базовая
   бумага. Всё намеренно на грани заметности — фон должен читаться как текстура,
   а не как узор. */
function pageBackground(tint) {
  const isDark = COLORS.paper === DARK_COLORS.paper;
  if (isDark) {
    /* В тёмной теме — ровный чёрный без сетки и цветных пятен: */
    return COLORS.paper;
  }
  const aura = tint || COLORS.sage;
  return [
    `radial-gradient(circle at 1px 1px, ${COLORS.line}80 1px, transparent 0)`,
    `radial-gradient(900px 420px at 88% -8%, ${aura}0F, transparent 62%)`,
    `radial-gradient(760px 380px at 6% 104%, ${COLORS.teal}0C, transparent 60%)`,
    COLORS.paper,
  ].join(", ");
}

const PAGE_BG_SIZE = "24px 24px, 100% 100%, 100% 100%, 100% 100%";

export { ONYX, ONYX_TEXT, LIGHT_COLORS, DARK_COLORS, COLORS, pageBackground, PAGE_BG_SIZE };
