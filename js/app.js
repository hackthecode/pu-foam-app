// ====== Главна логика на приложението ======
let MODEL = null;

// Помощни функции
const $ = (id) => document.getElementById(id);
function fmt(n, dec = 3) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("bg-BG", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
function fmtInt(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("bg-BG");
}
// Адаптивно форматиране на килограми: по-големите стойности с по-малко
// десетични знаци, за да не стават числата прекалено широки на тесен екран.
function fmtKg(n) {
  if (n == null || isNaN(n)) return "—";
  const dec = n >= 100 ? 1 : n >= 10 ? 2 : 3;
  return n.toLocaleString("bg-BG", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
// Чете числова стойност от поле; връща NaN ако е празно/невалидно
function valNum(id) {
  return parseNum($(id).value);
}

// ====== Навигация между табове ======
function setupNav() {
  const nav = $("bottomNav");
  nav.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      nav.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-page").forEach((p) => {
        p.classList.toggle("active", p.id === tab);
      });
      window.scrollTo(0, 0);
    });
  });
}

// ====== Статус на синхронизация ======
function setSyncStatus(state, ts) {
  const el = $("syncStatus");
  el.className = "sync-status " + state;
  if (state === "live") {
    const t = ts ? new Date(ts).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }) : "";
    el.textContent = `● Данните са актуални от таблицата (${t})`;
  } else if (state === "cache") {
    const t = ts ? new Date(ts).toLocaleString("bg-BG") : "неизвестно";
    el.textContent = `⚠ Офлайн — кеширани данни от ${t}`;
  } else if (state === "error") {
    el.textContent = "✕ Няма данни. Провери интернет връзката.";
  } else {
    el.textContent = "Свързване…";
  }
}

// ====== Любими рецепти (запазени локално на устройството) ======
const FAV_KEY = "pu_foam_favorites_v1";
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; }
}
function isFavorite(num) { return getFavorites().includes(String(num)); }
function toggleFavorite(num) {
  num = String(num);
  const favs = getFavorites();
  const i = favs.indexOf(num);
  if (i >= 0) favs.splice(i, 1); else favs.push(num);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

// ====== Wake Lock — държи екрана включен по време на работа ======
let wakeLock = null;
let wakeWanted = false;
async function requestWake() {
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
    return true;
  } catch (e) { return false; }
}
async function toggleWakeLock() {
  const btn = $("wakeBtn");
  if (wakeWanted) {
    wakeWanted = false;
    if (wakeLock) { try { await wakeLock.release(); } catch (e) {} wakeLock = null; }
    btn.classList.remove("toggle-on");
  } else {
    if (!("wakeLock" in navigator)) { alert("Браузърът не поддържа заключване на екрана."); return; }
    if (await requestWake()) { wakeWanted = true; btn.classList.add("toggle-on"); }
    else alert("Неуспешно заключване на екрана.");
  }
}

// ====== Цени на суровини (запазени локално, в €/кг) ======
const PRICES_KEY = "pu_foam_prices_v1";
function getPrices() {
  try { return JSON.parse(localStorage.getItem(PRICES_KEY)) || {}; } catch (e) { return {}; }
}
function setPrices(obj) { localStorage.setItem(PRICES_KEY, JSON.stringify(obj)); }
function allMaterialNames() {
  const set = new Set();
  MODEL.recipes.forEach((r) => r.components.forEach((c) => set.add(c.name)));
  return [...set].sort();
}
// Себестойност (€) на компоненти при множител; null ако няма въведени цени.
function costOf(components, mult) {
  const prices = getPrices();
  let total = 0, any = false;
  components.forEach((c) => {
    const p = prices[c.name];
    if (p != null && !isNaN(p)) { total += c.kg * mult * p; any = true; }
  });
  return any ? total : null;
}

let _priceNames = [];
function openPricesModal() {
  const prices = getPrices();
  _priceNames = allMaterialNames();
  $("pricesList").innerHTML = _priceNames
    .map((n, i) => `
      <div class="field" style="margin-bottom:8px;">
        <label class="lbl">${n}</label>
        <input type="text" inputmode="decimal" data-idx="${i}" value="${prices[n] != null ? String(prices[n]).replace(".", ",") : ""}" placeholder="€/кг" />
      </div>`)
    .join("");
  $("pricesModal").classList.add("open");
}
function savePrices() {
  const obj = {};
  $("pricesList").querySelectorAll("input[data-idx]").forEach((inp) => {
    const v = parseNum(inp.value);
    if (!isNaN(v) && v > 0) obj[_priceNames[inp.dataset.idx]] = v;
  });
  setPrices(obj);
  $("pricesModal").classList.remove("open");
  recalcCalc();
  recalcSim();
}

// ====== Споделяне / копиране на текст ======
async function shareText(title, body) {
  const full = title + "\n\n" + body + "\n\n— ПУ Пяна асистент";
  if (navigator.share) {
    try { await navigator.share({ title, text: full }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(full);
    alert("Копирано! Постави го в съобщение или бележка.");
  } catch (e) {
    prompt("Копирай текста:", full);
  }
}

// ====== ТАБ 1: Калкулатор ======
// Попълва падащо меню с рецепти (по избор филтриран списък).
function fillRecipeSelect(sel, recipes) {
  const list = recipes || MODEL.recipes;
  const prev = sel.value;
  sel.innerHTML = "";
  if (!list.length) {
    const o = document.createElement("option");
    o.value = ""; o.textContent = "няма съвпадение";
    sel.appendChild(o);
    return;
  }
  list.forEach((rec) => {
    const o = document.createElement("option");
    o.value = rec.number;
    o.textContent = `№${rec.number} — ${rec.kind}` + (isFavorite(rec.number) ? "  ★" : "");
    sel.appendChild(o);
  });
  // Запазваме предишния избор, ако още присъства в списъка
  if (prev && list.some((r) => r.number === prev)) sel.value = prev;
}
// Филтрира рецептите по номер / вид / боя.
function filterRecipes(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return MODEL.recipes;
  return MODEL.recipes.filter((r) =>
    r.number.toLowerCase().includes(q) ||
    r.kind.toLowerCase().includes(q) ||
    (r.color && r.color.toLowerCase().includes(q))
  );
}
function getRecipe(num) {
  return MODEL.recipes.find((r) => r.number === String(num));
}

// Намиране на калибровката (грамове на 1 RPM/пулс) за даден материал по име.
// Нормализира интервалите, защото някои имена имат двойни интервали (напр. "PETOL  56-3").
function calibForMaterial(name) {
  if (!MODEL || !MODEL.calibration) return null;
  const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();
  const target = norm(name);
  const c = MODEL.calibration.find((x) => norm(x.name) === target);
  return c ? c.gramsPerRpm : null;
}

function setupCalc() {
  const sel = $("calcRecipe");
  fillRecipeSelect(sel);

  let blockKgEdited = false;
  $("calcBlockKg").addEventListener("input", () => { blockKgEdited = true; recalcCalc(); });

  // При смяна на рецепта попълваме теглото на блока с теглото на замеса
  function onRecipeChange() {
    const rec = getRecipe(sel.value);
    if (rec && !blockKgEdited) {
      $("calcBlockKg").value = rec.total.toFixed(3).replace(".", ",");
    }
    recalcCalc();
  }
  sel.addEventListener("change", () => { blockKgEdited = false; onRecipeChange(); });
  $("calcRecipeSearch").addEventListener("input", () => {
    fillRecipeSelect(sel, filterRecipes($("calcRecipeSearch").value));
    blockKgEdited = false;
    onRecipeChange();
  });
  ["calcW", "calcH", "calcL", "calcPuls"].forEach((id) =>
    $(id).addEventListener("input", recalcCalc)
  );

  onRecipeChange();
}

function recalcCalc() {
  const rec = getRecipe($("calcRecipe").value);
  if (!rec) {
    $("calcMatCard").style.display = "none";
    $("calcDensityCard").style.display = "none";
    $("calcIndexHint").style.display = "none";
    return;
  }

  // TDI индекс (ако е записан в описанието на рецептата)
  const ih = $("calcIndexHint");
  if (rec.index != null) {
    const danger = rec.index > 120;
    ih.innerHTML = `TDI индекс: <b style="color:${danger ? "var(--red)" : "var(--green)"}">${fmt(rec.index, 1)}</b>` + (danger ? " ⚠ опасно високо!" : "");
    ih.style.display = "block";
  } else {
    ih.style.display = "none";
  }

  const w = valNum("calcW"), h = valNum("calcH"), l = valNum("calcL");
  const puls = Math.max(1, Math.round(valNum("calcPuls")) || 1);
  const blockKg = valNum("calcBlockKg");

  // Плътност = тегло (кг) / обем (м³); размерите са в см -> делим на 100
  const densityCard = $("calcDensityCard");
  if (!isNaN(w) && !isNaN(h) && !isNaN(l) && w > 0 && h > 0 && l > 0 && !isNaN(blockKg) && blockKg > 0) {
    const volM3 = (w / 100) * (h / 100) * (l / 100);
    const density = blockKg / volM3;
    $("calcDensity").textContent = fmt(density, 2);
    densityCard.style.display = "block";
  } else {
    densityCard.style.display = "none";
  }

  // Таблица материали: на пуск и общо
  const tbl = $("calcMatTable");
  let html = `<tr><th>Материал</th><th class="num">гр/RPM</th><th class="num">RPM</th><th class="num">1 пуск</th><th class="num">× ${puls}</th></tr>`;
  let sum1 = 0, sumAll = 0;
  rec.components.forEach((c) => {
    sum1 += c.kg;
    sumAll += c.kg * puls;
    const cal = calibForMaterial(c.name);
    const calStr = cal != null ? fmt(cal, 3) : "—";
    // Реалните обороти за машината = грамове на пуск / коефициент (гр на 1 RPM)
    const rpm = cal != null && cal > 0 ? (c.kg * 1000) / cal : null;
    const rpmStr = rpm != null ? `<b style="color:var(--blue)">${fmtInt(rpm)}</b>` : "—";
    html += `<tr><td class="name">${c.name}</td><td class="num" style="color:var(--text-dim)">${calStr}</td><td class="num">${rpmStr}</td><td class="num val">${fmt(c.kg)}</td><td class="num val">${fmt(c.kg * puls)}</td></tr>`;
  });
  html += `<tr class="total"><td>Общо (кг)</td><td class="num"></td><td class="num"></td><td class="num val">${fmt(sum1)}</td><td class="num val">${fmt(sumAll)}</td></tr>`;
  tbl.innerHTML = html;
  $("calcMatCard").style.display = "block";

  // Себестойност (ако са въведени цени на суровини)
  const cost1 = costOf(rec.components, 1);
  const costCard = $("calcCostCard");
  if (cost1 != null) {
    $("calcCost1").textContent = fmt(cost1, 2) + " €";
    $("calcCostNlabel").textContent = `За ${puls} ${puls === 1 ? "пуск" : "пуска"}`;
    $("calcCostN").textContent = fmt(cost1 * puls, 2) + " €";
    costCard.style.display = "block";
  } else {
    costCard.style.display = "none";
  }
}

// ====== ТАБ 2: Калибратор ======
function setupCalibrator() {
  const sel = $("calMat");
  sel.innerHTML = "";
  MODEL.calibration.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.name;
    o.textContent = c.name;
    sel.appendChild(o);
  });

  function loadCoeff() {
    const c = MODEL.calibration.find((x) => x.name === sel.value);
    if (c) $("calCoeff").value = String(c.gramsPerRpm).replace(".", ",");
    recalcCal();
  }
  sel.addEventListener("change", loadCoeff);
  $("calCoeff").addEventListener("input", recalcCal);
  $("calRpm").addEventListener("input", recalcCal);
  $("calGrams").addEventListener("input", recalcCal);

  // Сегментен превключвател
  document.querySelectorAll("#tab-cal .segment button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tab-cal .segment button").forEach((b) => b.classList.toggle("active", b === btn));
      const rpm2g = btn.dataset.dir === "rpm2g";
      $("calInRpmField").style.display = rpm2g ? "block" : "none";
      $("calInGField").style.display = rpm2g ? "none" : "block";
      recalcCal();
    });
  });

  loadCoeff();
}

function recalcCal() {
  const coeff = valNum("calCoeff");
  const isRpm2g = document.querySelector("#tab-cal .segment button.active").dataset.dir === "rpm2g";
  const card = $("calResCard");
  if (isNaN(coeff) || coeff <= 0) { card.style.display = "none"; return; }

  if (isRpm2g) {
    const rpm = valNum("calRpm");
    if (isNaN(rpm)) { card.style.display = "none"; return; }
    const grams = rpm * coeff;
    $("calResLabel").textContent = "Количество (грамове)";
    $("calResVal").textContent = fmtInt(grams) + " гр";
    $("calResKg").textContent = fmt(grams / 1000) + " кг";
  } else {
    const grams = valNum("calGrams");
    if (isNaN(grams)) { card.style.display = "none"; return; }
    const rpm = grams / coeff;
    $("calResLabel").textContent = "Необходими обороти";
    $("calResVal").textContent = fmtInt(rpm) + " RPM";
    $("calResKg").textContent = fmt(grams / 1000) + " кг";
  }
  card.style.display = "block";
}

// ====== ТАБ 3: Рецепти ======
function setupRecipes() {
  $("recSearch").addEventListener("input", renderRecipeList);
  $("favFilterChip").addEventListener("click", () => {
    const chip = $("favFilterChip");
    const on = chip.dataset.on === "1";
    chip.dataset.on = on ? "0" : "1";
    chip.classList.toggle("active", !on);
    renderRecipeList();
  });
  renderRecipeList();
  $("recModal").addEventListener("click", (e) => {
    if (e.target.id === "recModal") closeRecipeModal();
  });
}
function renderRecipeList() {
  const q = $("recSearch").value.trim().toLowerCase();
  const onlyFav = $("favFilterChip").dataset.on === "1";
  const list = $("recList");
  const filtered = MODEL.recipes.filter((r) => {
    if (onlyFav && !isFavorite(r.number)) return false;
    if (!q) return true;
    return (
      r.number.toLowerCase().includes(q) ||
      r.kind.toLowerCase().includes(q) ||
      (r.color && r.color.toLowerCase().includes(q))
    );
  });
  if (!filtered.length) {
    list.innerHTML = `<div class="empty">${onlyFav ? "Нямаш любими рецепти още." : "Няма намерени рецепти."}</div>`;
    return;
  }
  list.innerHTML = filtered
    .map(
      (r) => `
    <div class="recipe-card" data-num="${r.number}">
      <div class="badge">${r.number}</div>
      <div class="info">
        <div class="kind">${r.kind}${r.index != null ? ` <span style="color:var(--text-faint);font-weight:400">· инд ${fmt(r.index, 1)}</span>` : ""}</div>
        <div class="meta">${fmt(r.total, 2)} кг замес${r.color ? " · " + r.color : ""}</div>
      </div>
      <button class="fav-btn ${isFavorite(r.number) ? "on" : ""}" data-fav="${r.number}" title="Любима">★</button>
      <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
    </div>`
    )
    .join("");
  list.querySelectorAll(".recipe-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn")) return;
      openRecipeModal(card.dataset.num);
    });
  });
  list.querySelectorAll(".fav-btn").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(b.dataset.fav);
      renderRecipeList();
    });
  });
}
function openRecipeModal(num) {
  const rec = getRecipe(num);
  if (!rec) return;
  $("recModalTitle").textContent = `№${rec.number} — ${rec.kind}`;
  $("recModalSub").textContent =
    `Общо Смес: ${fmt(rec.total, 2)} кг` +
    (rec.color ? ` · Боя: ${rec.color}` : "") +
    (rec.index != null ? ` · TDI индекс: ${fmt(rec.index, 1)}` : "");
  let html = `<tr><th>Компонент</th><th class="num">за 1 кг</th><th class="num">кг</th><th class="num">RPM</th></tr>`;
  let sumNorm = 0;
  rec.components.forEach((c) => {
    // Разходна норма: колко кг суровина се влагат за 1 кг от рецептата (замеса)
    const norm = rec.total > 0 ? c.kg / rec.total : 0;
    sumNorm += norm;
    // RPM (настройка за машината): директно от листа Recipe, иначе по калибровка.
    let rpm = c.rpm;
    if (rpm == null) {
      const cal = calibForMaterial(c.name);
      if (cal != null && cal > 0) rpm = (c.kg * 1000) / cal;
    }
    const rpmStr = rpm != null ? `<b style="color:var(--blue)">${fmtInt(rpm)}</b>` : "—";
    html += `<tr><td class="name">${c.name}</td><td class="num" style="color:var(--text-dim)">${fmt(norm, 6)}</td><td class="num val">${fmt(c.kg)}</td><td class="num">${rpmStr}</td></tr>`;
  });
  html += `<tr class="total"><td>Общо</td><td class="num" style="color:var(--text-dim)">${fmt(sumNorm, 6)}</td><td class="num val">${fmt(rec.total, 2)}</td><td class="num"></td></tr>`;
  $("recModalTable").innerHTML = html;
  $("recModal").classList.add("open");
}
function closeRecipeModal() {
  $("recModal").classList.remove("open");
}

// ====== ТАБ 4: 33LV ======
function setupAmine() {
  $("amineCoeffShow").textContent = fmt(MODEL.amineCoeff, 4) + " гр/пулс";
  $("amineCoeffInput").value = String(MODEL.amineCoeff).replace(".", ",");

  $("amineCoeffInput").addEventListener("input", recalcAmine);
  $("aminePulses").addEventListener("input", recalcAmine);
  $("amineGrams").addEventListener("input", recalcAmine);

  document.querySelectorAll("#tab-amine .segment button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#tab-amine .segment button").forEach((b) => b.classList.toggle("active", b === btn));
      const p2g = btn.dataset.dir === "p2g";
      $("amineInPField").style.display = p2g ? "block" : "none";
      $("amineInGField").style.display = p2g ? "none" : "block";
      recalcAmine();
    });
  });
}
function recalcAmine() {
  const coeff = valNum("amineCoeffInput");
  const p2g = document.querySelector("#tab-amine .segment button.active").dataset.dir === "p2g";
  const row = $("amineResRow");
  const diff = $("amineDiff");
  if (isNaN(coeff) || coeff <= 0) { row.style.display = "none"; diff.textContent = ""; return; }

  if (p2g) {
    const pulses = valNum("aminePulses");
    if (isNaN(pulses)) { row.style.display = "none"; diff.textContent = ""; return; }
    const grams = pulses * coeff;
    $("amineResLabel").textContent = "Грамове";
    $("amineResVal").textContent = fmt(grams, 3) + " гр";
    diff.textContent = `${fmtInt(pulses)} пулса × ${fmt(coeff, 4)} гр/пулс`;
  } else {
    const grams = valNum("amineGrams");
    if (isNaN(grams)) { row.style.display = "none"; diff.textContent = ""; return; }
    const pulses = grams / coeff;
    $("amineResLabel").textContent = "Пулсове";
    $("amineResVal").textContent = fmt(pulses, 1) + " пулса";
    diff.textContent = `${fmt(grams, 1)} гр ÷ ${fmt(coeff, 4)} гр/пулс`;
  }
  row.style.display = "flex";
}

// ====== ТАБ 5: Симулатор ======
function setupSimulator() {
  const sel = $("simRecipe");
  fillRecipeSelect(sel);

  sel.addEventListener("change", recalcSim);
  $("simRecipeSearch").addEventListener("input", () => {
    fillRecipeSelect(sel, filterRecipes($("simRecipeSearch").value));
    recalcSim();
  });
  $("simTarget").addEventListener("input", () => {
    syncChips();
    recalcSim();
  });
  $("simPct").addEventListener("input", recalcSim);
  document.querySelectorAll("#simChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $("simTarget").value = chip.dataset.kg;
      syncChips();
      recalcSim();
    });
  });
  // Превключвател между режим "по тегло" и "корекция ±%"
  document.querySelectorAll("#simModeSeg button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#simModeSeg button").forEach((b) => b.classList.toggle("active", b === btn));
      const kg = btn.dataset.mode === "kg";
      $("simKgField").style.display = kg ? "block" : "none";
      $("simPctField").style.display = kg ? "none" : "block";
      recalcSim();
    });
  });

  recalcSim();
}
function syncChips() {
  const v = $("simTarget").value.replace(",", ".");
  document.querySelectorAll("#simChips .chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.kg === v);
  });
}
function recalcSim() {
  const rec = getRecipe($("simRecipe").value);
  const card = $("simResCard");
  if (!rec || rec.total <= 0) { card.style.display = "none"; return; }

  const mode = document.querySelector("#simModeSeg button.active").dataset.mode;
  let K;
  if (mode === "kg") {
    const target = valNum("simTarget");
    if (isNaN(target) || target <= 0) { card.style.display = "none"; return; }
    K = target / rec.total;
    $("simK").textContent = "× " + fmt(K, 5);
  } else {
    const pct = valNum("simPct");
    if (isNaN(pct)) { card.style.display = "none"; return; }
    K = 1 + pct / 100;
    if (K <= 0) { card.style.display = "none"; return; }
    $("simK").textContent = (pct >= 0 ? "+" : "") + fmt(pct, 1) + "%  (× " + fmt(K, 4) + ")";
  }

  let html = `<tr><th>Материал</th><th class="num">грамове</th><th class="num">кг</th></tr>`;
  let sum = 0;
  rec.components.forEach((c) => {
    const g = c.kg * 1000 * K;
    sum += g;
    html += `<tr><td class="name">${c.name}</td><td class="num val">${fmt(g, 1)}</td><td class="num">${fmt(g / 1000, 4)}</td></tr>`;
  });
  html += `<tr class="total"><td>Общо</td><td class="num val">${fmt(sum, 1)}</td><td class="num">${fmt(sum / 1000, 3)}</td></tr>`;
  $("simTable").innerHTML = html;
  card.style.display = "block";
}

// Текстови отчети за споделяне
function calcShareText() {
  const rec = getRecipe($("calcRecipe").value);
  if (!rec) return ["", ""];
  const puls = Math.max(1, Math.round(valNum("calcPuls")) || 1);
  const lines = [];
  if (rec.index != null) lines.push(`TDI индекс: ${fmt(rec.index, 1)}`);
  lines.push(`Брой пускове: ${puls}`, "");
  rec.components.forEach((c) => {
    let rpm = c.rpm;
    if (rpm == null) { const cal = calibForMaterial(c.name); if (cal) rpm = (c.kg * 1000) / cal; }
    lines.push(`${c.name}: ${rpm != null ? fmtInt(rpm) + " об" : "—"} | ${fmt(c.kg)} кг/пуск`);
  });
  const cost = costOf(rec.components, puls);
  if (cost != null) lines.push("", `Себестойност (${puls} пуска): ${fmt(cost, 2)} €`);
  return [`Рецепта №${rec.number} — ${rec.kind}`, lines.join("\n")];
}
function simShareText() {
  const rec = getRecipe($("simRecipe").value);
  if (!rec) return ["", ""];
  const rows = $("simTable").rows;
  const lines = [];
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i].cells;
    lines.push(`${c[0].textContent}: ${c[1].textContent} гр`);
  }
  return [`Тестов блок — Рецепта №${rec.number} (${rec.kind})`, lines.join("\n")];
}

// ====== Инициализация ======
function renderAll() {
  setupCalc();
  setupCalibrator();
  setupRecipes();
  setupAmine();
  setupSimulator();
}

async function init() {
  setupNav();

  const syncBtn = $("syncBtn");
  async function doLoad() {
    syncBtn.classList.add("spinning");
    setSyncStatus("connecting");
    const res = await loadData();
    syncBtn.classList.remove("spinning");

    if (!res.model || !res.model.recipes.length) {
      if (res.error && !res.model) {
        setSyncStatus("error");
        $("loadingText").textContent = "Няма връзка и няма кеширани данни.";
        return;
      }
    }
    MODEL = res.model;
    setSyncStatus(res.fromCache ? "cache" : "live", res.ts);
    renderAll();
    $("loadingScreen").classList.add("hidden");
  }

  syncBtn.addEventListener("click", doLoad);
  $("wakeBtn").addEventListener("click", toggleWakeLock);
  document.addEventListener("visibilitychange", async () => {
    if (wakeWanted && wakeLock === null && document.visibilityState === "visible") {
      await requestWake();
    }
  });

  // Цени и споделяне
  $("calcPricesBtn").addEventListener("click", openPricesModal);
  $("pricesSaveBtn").addEventListener("click", savePrices);
  $("pricesModal").addEventListener("click", (e) => { if (e.target.id === "pricesModal") $("pricesModal").classList.remove("open"); });
  $("calcShareBtn").addEventListener("click", () => { const [t, b] = calcShareText(); if (t) shareText(t, b); });
  $("simShareBtn").addEventListener("click", () => { const [t, b] = simShareText(); if (t) shareText(t, b); });

  await doLoad();
}

// Регистрация на service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW грешка:", e));
  });
}

document.addEventListener("DOMContentLoaded", init);
