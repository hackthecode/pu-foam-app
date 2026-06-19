// Превръщане на суровите CSV данни от листовете в структурирани модели.

// Индекси на колоните с компоненти в листа Formula (0-базирани).
// Имената се вземат от заглавния ред, за да следват таблицата автоматично.
const FORMULA_FIRST_COMP_COL = 1; // "P1 1105"
const FORMULA_LAST_COMP_COL = 18; // "Rokopol M1170"

// Построяване на списък с рецепти от листовете Formula (тегла в кг) и Recipe (боя).
function buildRecipes(formulaRows, recipeRows) {
  if (!formulaRows || formulaRows.length < 2) return [];

  const header = formulaRows[0];
  const compNames = [];
  for (let c = FORMULA_FIRST_COMP_COL; c <= FORMULA_LAST_COMP_COL; c++) {
    compNames.push((header[c] || "").trim());
  }

  // Карта номер -> боя и -> целия ред от листа Recipe.
  // Листът Recipe съдържа RPM/пулсовете (настройките за машината): за полиоли,
  // изоцианати, силикон и вода стойностите са в обороти, а за 33LV/T9/SIL627/
  // Rokopol са в кг. Колоните съвпадат по индекс с листа Formula.
  const colorByNumber = {};
  const recipeRowByNumber = {};
  if (recipeRows && recipeRows.length > 1) {
    for (let r = 1; r < recipeRows.length; r++) {
      const row = recipeRows[r];
      const numStr = (row[0] || "").trim();
      if (numStr === "") continue;
      recipeRowByNumber[numStr] = row;
      const color = (row[20] || "").trim();
      if (color) colorByNumber[numStr] = color;
    }
  }

  const recipes = [];
  for (let r = 1; r < formulaRows.length; r++) {
    const row = formulaRows[r];
    const numStr = (row[0] || "").trim();
    if (numStr === "") continue;

    // Компоненти
    const components = [];
    let mtotalFromComp = 0;
    const rRow = recipeRowByNumber[numStr];
    for (let c = FORMULA_FIRST_COMP_COL; c <= FORMULA_LAST_COMP_COL; c++) {
      const val = num0(row[c]);
      if (val > 0) {
        // RPM от листа Recipe (същата колона). Само ако е чисто число без "кг";
        // компонентите дадени в кг (33LV/T9/...) се пресмятат после по калибровка.
        let rpm = null;
        if (rRow) {
          const rawR = (rRow[c] || "").trim();
          if (rawR && !/кг/i.test(rawR)) {
            const rv = parseNum(rawR);
            if (!isNaN(rv) && rv > 0) rpm = rv;
          }
        }
        components.push({
          name: compNames[c - FORMULA_FIRST_COMP_COL],
          kg: val,
          rpm,
        });
        mtotalFromComp += val;
      }
    }

    // Вид дунапрен и общо тегло са последните две непразни клетки на реда.
    let kind = "";
    let total = 0;
    const trailing = [];
    for (let c = row.length - 1; c >= FORMULA_LAST_COMP_COL + 1; c--) {
      const cell = (row[c] || "").trim();
      if (cell !== "") trailing.push(cell);
      if (trailing.length === 2) break;
    }
    // trailing[0] = последна (общо тегло), trailing[1] = предпоследна (вид)
    if (trailing.length >= 1) total = num0(trailing[0]);
    if (trailing.length >= 2) kind = trailing[1];

    // Пропускаме празни/неизползвани рецепти
    if (mtotalFromComp <= 0) continue;

    recipes.push({
      number: numStr,
      kind: kind || "(без описание)",
      color: colorByNumber[numStr] || "",
      components,
      total: total > 0 ? total : mtotalFromComp,
    });
  }
  return recipes;
}

// Извличане на калибровъчни коефициенти (грамове на 1 RPM/пулс) от листа Calculator.
// Материалите са в редове ~5-17: колона 0 = име, колона 1 = коефициент ("38,70 гр").
function buildCalibration(calcRows, amineRows) {
  const coeffs = []; // { name, gramsPerRpm }
  const seen = new Set();

  if (calcRows && calcRows.length) {
    for (let r = 0; r < calcRows.length; r++) {
      const row = calcRows[r];
      const name = (row[0] || "").trim();
      const coeffRaw = (row[1] || "").trim();
      if (!name || !coeffRaw) continue;
      // Истинската калибровка е в горната таблица и е в ГРАМОВЕ на 1 RPM
      // (суфикс "гр"). Изключваме редове в "кг" или "%" — това са разходни
      // норми / проценти от другите секции, а не калибровка. Така отпадат и
      // материали без машинна калибровка (напр. T9, който се добавя ръчно).
      if (!/гр/i.test(coeffRaw) || /кг/i.test(coeffRaw) || coeffRaw.indexOf("%") !== -1) continue;
      const coeff = parseNum(coeffRaw);
      if (isNaN(coeff) || coeff <= 0) continue;
      if (/изчисляване|материал|sum|тест|табл|обороти/i.test(name)) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      coeffs.push({ name, gramsPerRpm: coeff });
    }
  }

  return coeffs;
}

// Извличане на коефициента грамове/пулс за катализатора 33LV от листа 33LV.
function buildAmineCoeff(amineRows) {
  if (!amineRows) return 1.00638;
  // По-точната стойност е във вторичната таблица (колона 13, напр. 1,00638).
  for (let r = 1; r < amineRows.length; r++) {
    const v = parseNum(amineRows[r][13]);
    if (!isNaN(v) && v > 0.9 && v < 1.1) return v;
  }
  // Резерв: показаната калибровка в колона "калибровка гр/пулс".
  for (let r = 1; r < amineRows.length; r++) {
    const v = parseNum(amineRows[r][3]);
    if (!isNaN(v) && v > 0.5 && v < 2) return v;
  }
  return 1.00638;
}

// Редовете с 33LV данни по рецепта (за справка в таб 4).
function buildAmineRows(amineRows) {
  const out = [];
  if (!amineRows) return out;
  for (let r = 1; r < amineRows.length; r++) {
    const row = amineRows[r];
    const num = (row[0] || "").trim();
    if (num === "") continue;
    const grams = parseNum(row[1]);
    const pulses = parseNum(row[2]);
    if (isNaN(grams) && isNaN(pulses)) continue;
    out.push({
      number: num,
      grams: isNaN(grams) ? null : grams,
      pulses: isNaN(pulses) ? null : pulses,
    });
  }
  return out;
}

// Извличане на текстовите бележки от листа Notes (първа колона).
function buildNotes(notesRows) {
  const out = [];
  if (!notesRows) return out;
  for (let r = 0; r < notesRows.length; r++) {
    const cell = (notesRows[r][0] || "").trim();
    if (cell.length > 3) out.push(cell);
  }
  return out;
}

// Построяване на пълния модел на данните от всички листове.
function buildModel(raw) {
  const formulaRows = parseCSV(raw.formula || "");
  const recipeRows = parseCSV(raw.recipe || "");
  const calcRows = parseCSV(raw.calculator || "");
  const amineRows = parseCSV(raw.amine || "");
  const notesRows = parseCSV(raw.notes || "");

  const calibration = buildCalibration(calcRows, amineRows);
  const amineCoeff = buildAmineCoeff(amineRows);
  // Синхронизираме калибровката на 33LV с по-точната стойност гр/пулс,
  // за да съвпада с таб 33LV.
  const lv = calibration.find((c) => c.name === "33LV");
  if (lv) lv.gramsPerRpm = amineCoeff;

  return {
    recipes: buildRecipes(formulaRows, recipeRows),
    calibration,
    amineCoeff,
    amineRows: buildAmineRows(amineRows),
    notes: buildNotes(notesRows),
  };
}
