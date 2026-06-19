// Надежден CSV парсер, който поддържа:
//  - стойности в кавички, съдържащи запетаи, нови редове и екранирани кавички ("")
//  - редове с различен брой колони
// Връща масив от редове, всеки ред е масив от низове (клетки).
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // екранирана кавичка
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // последното поле / ред
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Преобразуване на числов низ от европейски формат към число.
// Обработва: разделители за хиляди (интервал, nbsp, тесен интервал),
// мерни единици (" кг", " гр"), запетая като десетичен знак.
// Връща NaN при невалидна стойност.
function parseNum(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (s === "") return NaN;

  // премахване на мерни единици и текстови суфикси
  s = s.replace(/гр\.?/gi, "").replace(/кг\.?/gi, "").replace(/%/g, "");

  // премахване на всякакви интервали (вкл. nbsp   и тесен интервал  ),
  // които служат като разделители за хиляди
  s = s.replace(/[\s  ]/g, "");

  // ако има и точка и запетая -> точката е разделител за хиляди, запетаята десетична
  if (s.indexOf(".") !== -1 && s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // само запетая -> десетичен знак
    s = s.replace(",", ".");
  }

  const val = parseFloat(s);
  return val;
}

// Безопасна версия, която връща 0 вместо NaN (за сумиране на компоненти)
function num0(raw) {
  const v = parseNum(raw);
  return isNaN(v) ? 0 : v;
}
