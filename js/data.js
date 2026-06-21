// Слой за зареждане на данните: при всяко отваряне дърпа пресни данни от
// Google Sheets (network-first). При липса на интернет използва последно
// кешираните данни от localStorage.

// Изтегляне на един лист като суров CSV текст (без кеширане от браузъра).
async function fetchSheet(sheetName) {
  const url = sheetCsvUrl(sheetName);
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} за ${sheetName}`);
  return await resp.text();
}

// Изтегляне на всички листове паралелно.
async function fetchAllSheets() {
  const [formula, recipe, calculator, amine, notes] = await Promise.all([
    fetchSheet(SHEETS.FORMULA),
    fetchSheet(SHEETS.RECIPE),
    fetchSheet(SHEETS.CALCULATOR),
    fetchSheet(SHEETS.AMINE),
    fetchSheet(SHEETS.NOTES),
  ]);
  return { formula, recipe, calculator, amine, notes };
}

function saveCache(raw) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch (e) {
    console.warn("Неуспешно кеширане:", e);
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function cacheTimestamp() {
  const ts = localStorage.getItem(CACHE_TS_KEY);
  return ts ? parseInt(ts, 10) : null;
}

// Главна функция за зареждане.
// Връща { model, fromCache, ts, error }.
async function loadData() {
  try {
    const raw = await fetchAllSheets();
    saveCache(raw);
    return {
      model: buildModel(raw),
      fromCache: false,
      ts: Date.now(),
      error: null,
    };
  } catch (err) {
    // Няма мрежа / грешка -> опит за кеш
    const cached = loadCache();
    if (cached) {
      return {
        model: buildModel(cached),
        fromCache: true,
        ts: cacheTimestamp(),
        error: err,
      };
    }
    // Нито мрежа, нито кеш
    return { model: null, fromCache: false, ts: null, error: err };
  }
}
