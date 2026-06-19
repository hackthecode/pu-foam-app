// Конфигурация на приложението
// Идентификатор на Google Sheets таблицата (публично достъпна за четене)
const SHEET_ID = "1YID36c0sLq-lJQcG5h0qYMK7938CCmDQe-ST-1f4yOs";

// Имена на листовете в таблицата
const SHEETS = {
  RECIPE: "Recipe",
  FORMULA: "Formula",
  CALIBRATION: "calibration",
  AMINE: "33LV",
  NOTES: "Notes",
  CALCULATOR: "Calculator",
};

// Изграждане на URL за изтегляне на лист като CSV чрез gviz API.
// Добавя cache-busting параметър, за да гарантира пресни данни при всяко зареждане.
function sheetCsvUrl(sheetName) {
  const bust = Date.now();
  return (
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&_=${bust}`
  );
}

// URL за отваряне на таблицата в браузър (за бутон "Отвори таблицата")
const SHEET_VIEW_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

// Ключ за локално кеширане
const CACHE_KEY = "pu_foam_data_v1";
const CACHE_TS_KEY = "pu_foam_data_ts_v1";
