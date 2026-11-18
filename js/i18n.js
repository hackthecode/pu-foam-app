// ====== Езици (български / English) ======
// Ключът е българският текст; ако няма превод, се показва оригиналът.
// В JS: t("Текст с {0}", стойност). В HTML статичните текстове, placeholder,
// title и aria-label се превеждат автоматично; за текст с вложени тагове
// се ползва data-i18n-html="ключ".

const LANG_KEY = "pu_foam_lang_v1";
let LANG = "bg";
try { if (localStorage.getItem(LANG_KEY) === "en") LANG = "en"; } catch (e) {}

const EN = {
  // --- Заглавие, лента, навигация ---
  "ПУ Пяна — Производствен Асистент": "PU Foam — Production Assistant",
  "ПУ Пяна": "PU Foam",
  "Производствен асистент": "Production assistant",
  "Зареждане на данните от таблицата…": "Loading data from the spreadsheet…",
  "Свързване…": "Connecting…",
  "Помощ и безопасност": "Help & safety",
  "Дръж екрана включен": "Keep screen on",
  "Обнови данните от таблицата": "Refresh data from the spreadsheet",
  "Смени езика": "Change language",
  "Калкулатор": "Calculator",
  "Сборен": "Combined",
  "Рецепти": "Recipes",
  "Склад": "Stock",
  "Калибратор": "Calibrator",
  "Тестов блок": "Test block",
  "Дневник": "Log",
  "Още": "More",
  "Версия {0}": "Version {0}",
  "Има нова версия на приложението.": "A new version of the app is available.",
  "Обнови": "Update",

  // --- Калкулатор ---
  "Калкулатор на материали": "Materials calculator",
  "Избери рецепта, въведи размери и брой пускове.": "Choose a recipe, enter the dimensions and the number of runs.",
  "Рецепта": "Recipe",
  "Размери на блока (см)": "Block dimensions (cm)",
  "Шир.": "Width",
  "Вис.": "Height",
  "Дълж.": "Length",
  "Брой пускове": "Number of runs",
  "Тегло на блока (кг)": "Block weight (kg)",
  "измерено": "measured",
  "Теглото на блока се попълва автоматично с теглото на замеса, но можеш да го смениш с реално измереното тегло за точна плътност.":
    "The block weight is filled in automatically with the batch weight, but you can replace it with the actual measured weight for an accurate density.",
  "кг/м³ — плътност (Density)": "kg/m³ — density",
  "Себестойност на замес": "Cost per batch",
  "Общо": "Total",
  "Изчислено по цените на суровините, които си въвел.": "Calculated from the raw material prices you entered.",
  "Цени": "Prices",
  "Сподели": "Share",
  "Печат / PDF": "Print / PDF",
  "Запиши в дневника": "Save to log",
  "TDI индекс": "TDI index",
  " ⚠ опасно високо!": " ⚠ dangerously high!",
  "Материал": "Material",
  "гр/RPM": "g/RPM",
  "1 пуск": "1 run",
  "Общо (кг)": "Total (kg)",
  "пуск": "run",
  "пуска": "runs",
  "За {0} {1}": "For {0} {1}",

  // --- Калибратор ---
  "Калибратор: обороти ↔ количество": "Calibrator: RPM ↔ quantity",
  "Двупосочно пресмятане според калибровъчния коефициент.": "Two-way conversion using the calibration coefficient.",
  "Коефициент (грамове на 1 RPM)": "Coefficient (grams per 1 RPM)",
  "Зарежда се от таблицата; можеш да го коригираш ръчно.": "Loaded from the spreadsheet; you can adjust it manually.",
  "RPM → грамове": "RPM → grams",
  "грамове → RPM": "grams → RPM",
  "Обороти (RPM / пулсове)": "Revolutions (RPM / pulses)",
  "напр. 2070": "e.g. 2070",
  "Желано количество (грамове)": "Desired quantity (grams)",
  "напр. 80000": "e.g. 80000",
  "Резултат": "Result",
  "В килограми": "In kilograms",
  "Количество (грамове)": "Quantity (grams)",
  "Необходими обороти": "Required RPM",
  "гр": "g",
  "кг": "kg",
  "см": "cm",

  // --- Рецепти ---
  "Рецепти и формули": "Recipes & formulas",
  "Търси по номер или вид дунапрен.": "Search by number or foam type.",
  "Търси рецепта…": "Search recipes…",
  "★ Само любими": "★ Favorites only",
  "Нямаш любими рецепти още.": "You have no favorite recipes yet.",
  "Няма намерени рецепти.": "No recipes found.",
  "инд.": "idx",
  "Любима": "Favorite",
  "{0} кг замес": "{0} kg batch",
  "Общо Смес: {0} кг": "Total mix: {0} kg",
  "Боя: {0}": "Colour: {0}",
  "Компонент": "Component",
  "за 1 кг": "per 1 kg",
  "(без описание)": "(no description)",

  // --- Избор на рецепта ---
  "Номер, вид или боя": "Number, type or colour",
  "Избери рецепта": "Choose a recipe",
  "няма съвпадение": "no match",
  "Без рецепта (изчисти реда)": "No recipe (clear row)",
  "Няма рецепта с „{0}“.": "No recipe matching “{0}”.",

  // --- 33LV ---
  "33LV — Амин / Катализатор": "33LV — Amine / Catalyst",
  "Пресмятане грамове ↔ пулсове по калибровка гр/пулс.": "Convert grams ↔ pulses using the g/pulse calibration.",
  "Текуща калибровка": "Current calibration",
  "Коефициент (грамове на 1 пулс)": "Coefficient (grams per 1 pulse)",
  "пулсове → грамове": "pulses → grams",
  "грамове → пулсове": "grams → pulses",
  "Пулсове": "Pulses",
  "Грамове": "Grams",
  "напр. 191": "e.g. 191",
  "напр. 192": "e.g. 192",
  "гр/пулс": "g/pulse",
  "пулса": "pulses",

  // --- Симулатор ---
  "Симулатор: тестов блок": "Simulator: test block",
  "Мащабира рецепта към точно целево тегло със запазени пропорции.": "Scales a recipe to an exact target weight while keeping its proportions.",
  "По тегло (кг)": "By weight (kg)",
  "Корекция ±%": "Adjust ±%",
  "Целево тегло на тестовия блок (кг)": "Target test block weight (kg)",
  "3 кг": "3 kg",
  "5 кг": "5 kg",
  "10 кг": "10 kg",
  "Корекция спрямо замеса (%)": "Adjustment vs. the batch (%)",
  "напр. 8 или -5": "e.g. 8 or -5",
  "Положително число = повече, отрицателно = по-малко от стандартния замес.": "Positive number = more, negative = less than the standard batch.",
  "Коефициент на мащабиране": "Scaling factor",
  "Грамажът е изчислен за точно целевото тегло при същите пропорции и индекс като оригиналната рецепта.":
    "Quantities are calculated for the exact target weight with the same proportions and index as the original recipe.",
  "грамове": "grams",

  // --- Сборен калкулатор ---
  "Сборен калкулатор": "Combined calculator",
  "До 10 рецепти с брой пускове. Виждаш материалите за всяка рецепта и общо за всички.":
    "Up to 10 recipes with a number of runs. See the materials for each recipe and the total for all of them.",
  "Брой": "Runs",
  "Изчисти всички редове": "Clear all rows",
  "Изчисти всички редове?": "Clear all rows?",
  "Общо за всички рецепти": "Total for all recipes",
  "Обща себестойност": "Total cost",
  "Приспадни от склада": "Deduct from stock",
  "Рецепта на ред {0}": "Recipe in row {0}",
  "Брой пускове на ред {0}": "Number of runs in row {0}",
  "— избери —": "— choose —",
  "Избери рецепта и брой поне на един ред.": "Choose a recipe and a count in at least one row.",
  "Нужни кг": "Needed kg",
  "Остават": "Left",
  "Не достигат в склада: ": "Short in stock: ",
  "рецепта": "recipe",
  "рецепти": "recipes",
  "{0} {1}, общо {2} {3}": "{0} {1}, {2} {3} in total",
  "ОБЩО ЗА ВСИЧКИ:": "TOTAL FOR ALL:",
  "Общо: {0} кг": "Total: {0} kg",
  "Себестойност: {0} €": "Cost: {0} €",
  "Сборен калкулатор — материали": "Combined calculator — materials",

  // --- Склад ---
  "Въведи колко килограма имаш от всяка суровина. Приложението сравнява с плана от „Сборен“ и показва какво не достига.":
    "Enter how many kilograms of each raw material you have. The app compares it with the plan from “Combined” and shows what is missing.",
  "Сподели списък за поръчка": "Share order list",
  "Наличности (кг)": "Stock levels (kg)",
  "Празно поле означава, че суровината не се следи. Бутонът „+“ добавя доставка към наличното.":
    "An empty field means the material is not tracked. The “+” button adds a delivery to the current stock.",
  "Добави доставка": "Add delivery",
  "Добави доставка за {0}": "Add delivery for {0}",
  "Доставка, кг": "Delivery, kg",
  "Добави": "Add",
  "Няма суровини в рецептите.": "No raw materials in the recipes.",
  "Нищо не достига за плана.": "Nothing is short for the plan.",
  "Добавени {0} кг {1}.": "Added {0} kg of {1}.",
  "За плана трябват {0} кг": "The plan needs {0} kg",
  "За плана трябват {0} кг, не достигат {1} кг": "The plan needs {0} kg, short by {1} kg",
  "За плана трябват {0} кг, остават {1} кг": "The plan needs {0} kg, {1} kg left",
  "Няма план за сравнение": "No plan to compare",
  "Попълни рецепти и брой в „Сборен“ и тук ще видиш какво не достига.": "Fill in recipes and counts in “Combined” and you'll see here what is missing.",
  "Суровина": "Material",
  "Има": "In stock",
  "Трябват": "Needed",
  "Не достигат": "Short",
  "Не достига 1 суровина за плана": "1 material is short for the plan",
  "Не достигат {0} суровини за плана": "{0} materials are short for the plan",
  "Количества в кг, спрямо плана от „Сборен“.": "Quantities in kg, against the plan from “Combined”.",
  "Наличностите стигат за плана": "Stock covers the plan",
  "Всички следени суровини покриват плана от „Сборен“.": "All tracked materials cover the plan from “Combined”.",
  "1 суровина от плана няма въведена наличност и не се проверява.": "1 material in the plan has no stock entered and is not checked.",
  "{0} суровини от плана нямат въведена наличност и не се проверяват.": "{0} materials in the plan have no stock entered and are not checked.",
  "{0}: {1} кг (има {2}, трябват {3})": "{0}: {1} kg (have {2}, need {3})",
  "Списък за поръчка — не достигат за плана": "Order list — short for the plan",
  "Няма следени суровини в този план.": "No tracked materials in this plan.",
  "Приспадни плана от склада?\nЩе се намали наличността на 1 суровина.": "Deduct the plan from stock?\nThe stock of 1 material will be reduced.",
  "Приспадни плана от склада?\nЩе се намалят наличностите на {0} суровини.": "Deduct the plan from stock?\nThe stock of {0} materials will be reduced.",
  "Планът е приспаднат от склада.": "The plan has been deducted from stock.",

  // --- Дневник ---
  "Дневник на замесите": "Batch log",
  "Записвай реалните замеси, за да следиш плътността във времето. Записите се пазят на това устройство.":
    "Record actual batches to track density over time. Entries are stored on this device.",
  logHint: 'To add an entry: fill in the recipe, dimensions and measured weight in the <b>Calculator</b> tab, then press <b>“Save to log”</b>.',
  "Първо избери рецепта в Калкулатор.": "First choose a recipe in Calculator.",
  "Записано в дневника.": "Saved to log.",
  "Няма записи още.": "No entries yet.",
  "Размери": "Dimensions",
  "Тегло": "Weight",
  "Пускове": "Runs",
  "Плътност": "Density",
  "Изтрий": "Delete",
  "Изтрий този запис?": "Delete this entry?",

  // --- Цени, споделяне, помощ, статус ---
  "Цени на суровините": "Raw material prices",
  "Въведи цена в €/кг. Запазват се на това устройство.": "Enter prices in €/kg. They are saved on this device.",
  "Запази": "Save",
  "€/кг": "€/kg",
  "Цените са запазени.": "Prices saved.",
  "— ПУ Пяна асистент": "— PU Foam assistant",
  "Копирано. Постави го в съобщение или бележка.": "Copied. Paste it into a message or a note.",
  "Копирай текста:": "Copy the text:",
  "Брой пускове: {0}": "Number of runs: {0}",
  "об": "rev",
  "кг/пуск": "kg/run",
  "Себестойност ({0} пуска): {1} €": "Cost ({0} runs): {1} €",
  "Рецепта №{0} — {1}": "Recipe #{0} — {1}",
  "Тестов блок — Рецепта №{0} ({1})": "Test block — Recipe #{0} ({1})",
  "Бележки от производството (от таблицата).": "Production notes (from the spreadsheet; shown in the original language).",
  "Няма бележки.": "No notes.",
  "● Актуални данни": "● Live data",
  "⚠ Офлайн · данни от {0}": "⚠ Offline · data from {0}",
  "неизвестно": "unknown",
  "✕ Няма данни. Провери интернета.": "✕ No data. Check your internet connection.",
  "Няма връзка и няма кеширани данни.": "No connection and no cached data.",
  "Браузърът не поддържа задържане на екрана.": "This browser can't keep the screen on.",
  "Екранът ще стои включен.": "The screen will stay on.",
  "Екранът не може да се задържи включен.": "Couldn't keep the screen on.",
};

// Превод с параметри {0}, {1}…
function t(s, ...args) {
  const r = LANG === "en" && EN[s] != null ? EN[s] : s;
  return args.length ? r.replace(/\{(\d+)\}/g, (m, i) => (args[i] != null ? args[i] : m)) : r;
}
// Локал за форматиране на числа и дати
function LOC() { return LANG === "en" ? "en-GB" : "bg-BG"; }

// Превод на статичния HTML. Оригиналът (BG) се пази, за да може да се върне.
const I18N_ATTRS = ["placeholder", "title", "aria-label"];
function applyStaticI18n(root) {
  root = root || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    if (n._bg == null) {
      const key = n.nodeValue.trim();
      if (!key || EN[key] == null) return;
      n._bg = n.nodeValue;
    }
    const key = n._bg.trim();
    n.nodeValue = LANG === "en" ? n._bg.replace(key, EN[key]) : n._bg;
  });
  root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => {
    I18N_ATTRS.forEach((a) => {
      if (!el.hasAttribute(a)) return;
      el._bgAttr = el._bgAttr || {};
      if (el._bgAttr[a] == null) {
        const v = el.getAttribute(a);
        if (EN[v] == null) return;
        el._bgAttr[a] = v;
      }
      el.setAttribute(a, t(el._bgAttr[a]));
    });
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    if (el._bgHtml == null) el._bgHtml = el.innerHTML;
    el.innerHTML = LANG === "en" ? EN[el.dataset.i18nHtml] || el._bgHtml : el._bgHtml;
  });
}

function setLang(lang) {
  LANG = lang === "en" ? "en" : "bg";
  try { localStorage.setItem(LANG_KEY, LANG); } catch (e) {}
  document.documentElement.lang = LANG;
  document.title = t("ПУ Пяна — Производствен Асистент");
  applyStaticI18n();
  const b = document.getElementById("langBtn");
  if (b) {
    // Бутонът показва езика, към който ще превключи
    b.textContent = LANG === "en" ? "БГ" : "EN";
    b.setAttribute("aria-label", LANG === "en" ? "Превключи на български" : "Switch to English");
    b.title = b.getAttribute("aria-label");
  }
  if (typeof onLangChange === "function") onLangChange();
}
