# Карта связей: механика игры → уроки → карточки и тесты

Ключи тем совпадают с ключами в econ-trainer.jsx (MASTER_MAP, BIZ_MAP, FINLIT_MAP), ключи уроков — с LESSON_TEXT_INDEX.

| Механика «Лавки» | Темы приложения | Полный текст урока |
| --- | --- | --- |
| Линейный спрос Q = A − B·P; сдвиг кривой против движения вдоль неё (жара, ливень, фестиваль, вывеска, выходные) | `s-equilibrium`, `c-goods-types`, `e-cross-income` | `DT_Equilibrium`, `DT_EquilibriumZero`, `DT_GoodsEffectsFull` |
| Эластичность |E| = B·P/Q, связь с выручкой, неэластичный участок (MR < 0) | `e-basic`, `e-properties`, `e-geometric`, `pr-elast` | `DT_Elasticity`, `DT_ElasticityFull`, `DT_Practice_Elasticity` |
| Оптимум монополиста MR = MC, P* = (A/B + MC)/2, правило Лернера | `s-monopoly`, `pr-monopoly`, `pr-monobah`, `m-derivative` | `DT_MonopolyFull`, `DT_Practice_Monopoly`, `DT_Practice_MonopolyBah`, `DT_MathFull` |
| Излишки CS/PS и DWL в отчёте дня | `i-surplus`, `i-dwl`, `m-integrals` | `DT_Surplus`, `DT_SurplusFull`, `DT_DWL`, `ECON_DWL` |
| Постоянные и переменные издержки, MC (аренда и зарплата не меняют P*) | `p-costs` | `DT_CostsFull` |
| Акциз t: перенос t/2 у монополиста; субсидия | `i-tax`, `i-subsidy` | `DT_Tax`, `DT_TaxFull` |
| Потолок цены: парадокс монополии | `i-price-controls`, `i-lerner-regulation` | `DT_PriceControlsFull`, `DT_Practice_Welfare` |
| Ценовая дискриминация III степени (вторая точка) | `s-discrimination`, `pr-discrim` | `DT_PriceDiscrimination2`, `DT_Practice_Discrim` |
| Конкурент «Семён»: Бертран с дифференцированным товаром, наилучший ответ, Нэш | `s-bertrand`, `s-game-theory`, `s-cournot`, `pr-cournot` | `DT_OligopolyFull`, `DT_Practice_Cournot` |
| Эталон P = MC (откуда DWL монополии) | `s-perfect`, `s-monopolistic` | `DT_PerfectCompetition`, `DT_MarketStructuresFull` |
| Кредит 3 000 ₽ под 10% (погашение из прибыли) | `f-interest`, `f-credit`, `fg-amort`, `fg-risks` | `ECON_SimpleCompound`, `ECON_CreditSchemes`, `FG_Credit` |
| Окупаемость улучшений (вложение сейчас → прибыль потом) | `f-discounting`, `bz-npv` | `DT_Discounting`, `BZ_NPV` |
| Юнит-экономика лавки: маржа на единицу, порча, отчёт P&L | `bz-unit`, `bz-statements`, `bz-costclass` | `BZ_Unit`, `BZ_Statements`, `BZ_CostClassification` |
| Закупка скоропорта, холодильник, задача газетчика, запасы | `bz-inventory`, `bz-working-capital` | `BZ_WorkingCapital` |
| Мощность прилавка 120/день — ограниченный ресурс; помощник | `bz-resource-constraint`, `bz-incremental`, `bz-payroll` | `BZ_ResourceConstraint`, `BZ_IncrementalCost` |
| Тетрадь аналитика: оценка спроса по наблюдениям, «чистые» дни без событий | `bz-causal` | `BZ_CausalInference` |
| Невозвратные затраты на улучшения; решение открыть вторую точку | `bz-sunkcost`, `bz-pilot`, `bz-price-discrim`, `bz-market-structure` | `BZ_SunkCostSwitching`, `BZ_PriceDiscrimination` |
| Вывеска, лояльность, блогер — маркетинг и репутация | `bz-market`, `bz-social` | `BZ_Marketing`, `BZ_SocialContext` |
| Поведенческие ошибки игрока (якорение на вчерашней цене, страх дефицита) | `fg-behavioral`, `fg-budget` | `FG_Behavioral`, `FG_Budget` |

Отобрано: карточек 141/10/17 (экономика/бизнес/финграм), тестов 30/2/14, задач 23, текстов уроков 43.

В «Лавке» уже есть 15 «Вопросов дня» (LAVKA_QUIZ) — они дублируют идеи уроков s-monopoly, i-tax, e-properties, s-discrimination, i-price-controls, s-bertrand, bz-inventory.

Важно: в приложении есть и другие тесты (внутри компонентов уроков, банк ЕГЭ и т. п.), которые этот скрипт не достаёт. Если нужен полный охват — попроси Claude Code найти их поиском по econ-trainer.jsx по ключам тем из таблицы.

## Где лежат уроки в econ-trainer.jsx

LESSON_TEXT_INDEX хранит только поисковый индекс (часто сокращённый). Полный урок — это React-компонент с тем же именем. Номера строк — для файла econ-trainer__17_.jsx; после правок они сдвинутся, ищи по имени.

| Компонент урока | Строка |
| --- | --- |
| `BZ_CausalInference` | 17839 |
| `BZ_CostClassification` | 19722 |
| `BZ_IncrementalCost` | 17988 |
| `BZ_Marketing` | 12453 |
| `BZ_NPV` | 11236 |
| `BZ_PriceDiscrimination` | 18880 |
| `BZ_ResourceConstraint` | 18114 |
| `BZ_SocialContext` | 20123 |
| `BZ_Statements` | 14043 |
| `BZ_SunkCostSwitching` | 19331 |
| `BZ_Unit` | 10930 |
| `BZ_WorkingCapital` | 19049 |
| `DT_CostsFull` | 6138 |
| `DT_DWL` | 3921 |
| `DT_Discounting` | 4918 |
| `DT_Elasticity` | 4769 |
| `DT_ElasticityFull` | 5964 |
| `DT_Equilibrium` | 3724 |
| `DT_EquilibriumZero` | 4964 |
| `DT_GoodsEffectsFull` | 6854 |
| `DT_MarketStructuresFull` | 6924 |
| `DT_MathFull` | 6392 |
| `DT_MonopolyFull` | 5657 |
| `DT_OligopolyFull` | 6566 |
| `DT_PerfectCompetition` | 4829 |
| `DT_Practice_Cournot` | 10078 |
| `DT_Practice_Discrim` | 10006 |
| `DT_Practice_Elasticity` | 10224 |
| `DT_Practice_Monopoly` | 9595 |
| `DT_Practice_MonopolyBah` | 9850 |
| `DT_Practice_Welfare` | 10149 |
| `DT_PriceControlsFull` | 6483 |
| `DT_PriceDiscrimination2` | 4019 |
| `DT_Surplus` | 3649 |
| `DT_SurplusFull` | 5222 |
| `DT_Tax` | 4709 |
| `DT_TaxFull` | 5829 |
| `ECON_CreditSchemes` | 17608 |
| `ECON_DWL` | 17460 |
| `ECON_SimpleCompound` | 17563 |
| `FG_Behavioral` | 12915 |
| `FG_Budget` | 13939 |
| `FG_Credit` | 10607 |

| Ключ темы в карте | Строка |
| --- | --- |
| `bz-causal` | 39287 |
| `bz-costclass` | 39340 |
| `bz-incremental` | 39292 |
| `bz-inventory` | 39364 |
| `bz-market` | 39543 |
| `bz-market-structure` | 39386 |
| `bz-npv` | 39470 |
| `bz-payroll` | 39369 |
| `bz-pilot` | 39358 |
| `bz-price-discrim` | 39316 |
| `bz-resource-constraint` | 39297 |
| `bz-social` | 39354 |
| `bz-statements` | 39480 |
| `bz-sunkcost` | 39327 |
| `bz-unit` | 39455 |
| `bz-working-capital` | 39320 |
| `c-goods-types` | 2185 |
| `e-basic` | 2196 |
| `e-cross-income` | 2205 |
| `e-geometric` | 2202 |
| `e-properties` | 2199 |
| `f-credit` | 2271 |
| `f-discounting` | 2274 |
| `f-interest` | 2269 |
| `fg-amort` | 39119 |
| `fg-behavioral` | 39211 |
| `fg-budget` | 39177 |
| `fg-risks` | 39128 |
| `i-dwl` | 1858 |
| `i-lerner-regulation` | 1995 |
| `i-price-controls` | 2055 |
| `i-subsidy` | 2052 |
| `i-surplus` | 1843 |
| `i-tax` | 2047 |
| `m-derivative` | 2131 |
| `m-integrals` | 2145 |
| `p-costs` | 1884 |
| `pr-cournot` | 2097 |
| `pr-discrim` | 2003 |
| `pr-elast` | 2206 |
| `pr-monobah` | 1999 |
| `pr-monopoly` | 1998 |
| `s-bertrand` | 2083 |
| `s-cournot` | 2077 |
| `s-discrimination` | 1986 |
| `s-equilibrium` | 1839 |
| `s-game-theory` | 2086 |
| `s-monopolistic` | 2224 |
| `s-monopoly` | 1979 |
| `s-perfect` | 2218 |
