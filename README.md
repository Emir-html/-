# MirStudy

Личный учебный тренажёр (олимпиада «Высшая проба»: экономика, бизнес, финграмотность; ЕГЭ) и игра «Лавка».

## Запуск на своём компьютере

Нужны Node.js 20+ и git. Пошагово для Windows — [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md).

```bash
git clone https://github.com/Emir-html/-.git mirstudy
cd mirstudy
git checkout claude/inspiring-cray-gwn2yz
npm install
npm run dev        # откроется http://localhost:5173
```

Прогресс хранится в браузере (localStorage через `src/storage-shim.js`). Перенести прогресс из claude.ai:
«План подготовки» → «Резервная копия прогресса» → «Загрузить из файла» → `data/progress-2026-09-24.json`.

AI-проверка письменных ответов работает только в версии на claude.ai.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | приложение на localhost |
| `npm run build` | сборка в `dist/` |
| `npm test` | тесты модели «Лавки» |
| `npm run balance -- 40 20` | баланс стратегий (дней, прогонов) |
| `npm run check` | быстрая сборка esbuild + тесты (после каждой правки) |

Правила проекта — `CLAUDE.md`, этапы игры — `docs/ROADMAP.md`, исходный комплект — `kit/`.
