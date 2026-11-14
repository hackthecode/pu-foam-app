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
const TAB_KEY = "pu_foam_tab_v1";
function showTab(tab) {
  if (!tab || !$(tab)) tab = "tab-calc";
  document.querySelectorAll("button[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.toggle("active", p.id === tab));
  // Ако табът е от менюто „Още“, на телефон светва бутонът „Още“
  const isSec = !!document.querySelector(`#bottomNav button.sec[data-tab="${tab}"]`);
  $("navMore").classList.toggle("active", isSec);
  $("moreModal").classList.remove("open");
  try { localStorage.setItem(TAB_KEY, tab); } catch (e) {}
  window.scrollTo(0, 0);
  if (MODEL) {
    if (tab === "tab-multi") recalcMulti();
    if (tab === "tab-stock") recalcStock();
  }
}
function currentTabTitle() {
  const h = document.querySelector(".tab-page.active .section-title");
  return h ? h.textContent : "";
}
function setupNav() {
  document.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });
  $("navMore").addEventListener("click", () => $("moreModal").classList.add("open"));
  $("moreModal").addEventListener("click", (e) => { if (e.target.id === "moreModal") $("moreModal").classList.remove("open"); });
  const v = "Версия " + APP_VERSION;
  $("navVersion").textContent = v;
  $("moreVersion").textContent = v;
  let saved = null;
  try { saved = localStorage.getItem(TAB_KEY); } catch (e) {}
  showTab(saved);
  // Escape затваря отворения модал (удобно на компютър)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal-overlay.open").forEach((m) => m.classList.remove("open"));
  });
}

// ====== Кратко известие (вместо системен прозорец) ======
let _toastTimer = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ====== Статус на синхронизация ======
function setSyncStatus(state, ts) {
  const el = $("syncStatus");
  el.className = "sync-status " + state;
  if (state === "live") {
    const t = ts ? new Date(ts).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }) : "";
    el.textContent = `● Актуални данни${t ? " · " + t : ""}`;
  } else if (state === "cache") {
    const t = ts ? new Date(ts).toLocaleString("bg-BG") : "неизвестно";
    el.textContent = `⚠ Офлайн · данни от ${t}`;
  } else if (state === "error") {
    el.textContent = "✕ Няма данни. Провери интернета.";
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
    if (!("wakeLock" in navigator)) { toast("Браузърът не поддържа задържане на екрана."); return; }
    if (await requestWake()) { wakeWanted = true; btn.classList.add("toggle-on"); toast("Екранът ще стои включен."); }
    else toast("Екранът не може да се задържи включен.");
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
        <label class="lbl">${escapeHtml(n)}</label>
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
  if (MODEL && $("multiRec0")) recalcMulti();
  toast("Цените са запазени.");
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
    toast("Копирано. Постави го в съобщение или бележка.");
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
// ====== Избор на рецепта: бутон, който отваря лист с търсене ======
// Скритият <select> остава източник на стойността; бутонът само го управлява.
let _pickSel = null;
function attachPicker(sel, placeholder) {
  if (!sel._pickBtn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "picker-btn";
    sel.style.display = "none";
    sel.after(b);
    b.addEventListener("click", () => openPicker(sel));
    sel._pickBtn = b;
  }
  sel._ph = placeholder || "Избери рецепта";
  refreshPicker(sel);
}
function refreshPicker(sel) {
  const b = sel._pickBtn;
  if (!b) return;
  const rec = getRecipe(sel.value);
  b.classList.toggle("unset", !rec);
  const chev = `<svg class="pk-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>`;
  b.innerHTML = rec
    ? `<span class="pk-num">${escapeHtml(rec.number)}</span><span class="pk-kind">${escapeHtml(rec.kind)}</span>${chev}`
    : `<span class="pk-kind">${escapeHtml(sel._ph)}</span>${chev}`;
}
function openPicker(sel) {
  _pickSel = sel;
  $("pickSearch").value = "";
  renderPickList();
  $("pickModal").classList.add("open");
  $("pickModal").querySelector(".modal").scrollTop = 0;
  // На компютър фокусираме търсачката; на телефон не, за да не скача клавиатурата
  if (window.matchMedia("(pointer: fine)").matches) $("pickSearch").focus();
}
// Търсене по думи: всяка дума трябва да се среща в номера, вида или боята.
function searchRecipes(q) {
  const words = (q || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  let list = MODEL.recipes.filter((r) => {
    const hay = (r.number + " " + r.kind + " " + (r.color || "")).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const q1 = words.length === 1 ? words[0] : null;
  const rank = (r) => {
    const n = r.number.toLowerCase();
    if (q1 && n === q1) return 0;                 // точен номер
    if (q1 && n.startsWith(q1)) return 1;         // номерът започва с търсеното
    return isFavorite(r.number) ? 2 : 3;          // после любимите
  };
  // stable sort: при равен ранг се пази редът от таблицата
  return list.map((r, i) => [rank(r), i, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
}
function renderPickList() {
  const sel = _pickSel;
  if (!sel) return;
  const list = searchRecipes($("pickSearch").value);
  const canClear = !!sel.querySelector('option[value=""]');
  let html = "";
  if (canClear && sel.value) html += `<button type="button" class="pick-item clear" data-num="">Без рецепта (изчисти реда)</button>`;
  html += list.map((r) => `
    <button type="button" class="pick-item${r.number === sel.value ? " current" : ""}" data-num="${escapeHtml(r.number)}">
      <span class="pk-num">${escapeHtml(r.number)}</span>
      <span class="pk-body">
        <span class="pk-kind">${escapeHtml(r.kind)}</span>
        <div class="pk-meta">${fmt(r.total, 2)} кг замес${r.color ? ", " + escapeHtml(r.color) : ""}</div>
      </span>
      ${isFavorite(r.number) ? '<span class="pk-fav">★</span>' : ""}
    </button>`).join("");
  if (!list.length) html += `<div class="empty">Няма рецепта с „${escapeHtml($("pickSearch").value.trim())}“.</div>`;
  $("pickList").innerHTML = html;
}
function setupPicker() {
  $("pickSearch").addEventListener("input", renderPickList);
  $("pickSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const first = $("pickList").querySelector(".pick-item:not(.clear)"); if (first) first.click(); }
  });
  $("pickList").addEventListener("click", (e) => {
    const item = e.target.closest(".pick-item");
    if (!item || !_pickSel) return;
    const sel = _pickSel;
    sel.value = item.dataset.num;
    refreshPicker(sel);
    $("pickModal").classList.remove("open");
    sel.dispatchEvent(new Event("change"));
  });
  $("pickModal").addEventListener("click", (e) => { if (e.target.id === "pickModal") $("pickModal").classList.remove("open"); });
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
  attachPicker(sel);
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
    <div class="recipe-card" data-num="${escapeHtml(r.number)}">
      <div class="badge">${escapeHtml(r.number)}</div>
      <div class="info">
        <div class="kind">${escapeHtml(r.kind)}${r.index != null ? ` <span style="color:var(--text-faint);font-weight:400">инд. ${fmt(r.index, 1)}</span>` : ""}</div>
        <div class="meta">${fmt(r.total, 2)} кг замес${r.color ? ", " + escapeHtml(r.color) : ""}</div>
      </div>
      <button class="fav-btn ${isFavorite(r.number) ? "on" : ""}" data-fav="${escapeHtml(r.number)}" title="Любима">★</button>
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
  attachPicker(sel);
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ====== ТАБ 6: Дневник на замесите (запазен локално) ======
const LOG_KEY = "pu_foam_batch_log_v1";
function getLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
function setLog(arr) { localStorage.setItem(LOG_KEY, JSON.stringify(arr)); }
function addLogFromCalc() {
  const rec = getRecipe($("calcRecipe").value);
  if (!rec) { toast("Първо избери рецепта в Калкулатор."); return; }
  const w = valNum("calcW"), h = valNum("calcH"), l = valNum("calcL"), blockKg = valNum("calcBlockKg");
  const puls = Math.max(1, Math.round(valNum("calcPuls")) || 1);
  let density = null;
  if (!isNaN(w) && !isNaN(h) && !isNaN(l) && w > 0 && h > 0 && l > 0 && !isNaN(blockKg) && blockKg > 0) {
    density = blockKg / ((w / 100) * (h / 100) * (l / 100));
  }
  const entry = {
    ts: Date.now(), num: rec.number, kind: rec.kind,
    w: isNaN(w) ? null : w, h: isNaN(h) ? null : h, l: isNaN(l) ? null : l,
    blockKg: isNaN(blockKg) ? null : blockKg, density, puls,
  };
  const log = getLog();
  log.unshift(entry);
  setLog(log);
  renderLog();
  toast("Записано в дневника.");
}
function renderLog() {
  const list = $("logList");
  if (!list) return;
  const log = getLog();
  if (!log.length) { list.innerHTML = `<div class="empty">Няма записи още.</div>`; return; }
  list.innerHTML = log.map((e) => {
    const d = new Date(e.ts);
    const dateStr = d.toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const dims = e.w && e.h && e.l ? `${fmt(e.w, 0)}×${fmt(e.h, 0)}×${fmt(e.l, 0)} см` : "—";
    return `<div class="log-item">
      <div class="log-head">
        <span class="log-recipe">№${e.num} — ${escapeHtml(e.kind)}</span>
        <span class="log-date">${dateStr}</span>
      </div>
      <div class="log-body">
        Размери: ${dims} · Тегло: ${e.blockKg != null ? fmt(e.blockKg, 2) + " кг" : "—"} · Пускове: ${e.puls}<br>
        Плътност: <span class="log-dens">${e.density != null ? fmt(e.density, 2) + " кг/м³" : "—"}</span>
      </div>
      <button class="log-del" data-ts="${e.ts}">Изтрий</button>
    </div>`;
  }).join("");
  list.querySelectorAll(".log-del").forEach((b) => b.addEventListener("click", () => {
    if (confirm("Изтрий този запис?")) { setLog(getLog().filter((e) => String(e.ts) !== b.dataset.ts)); renderLog(); }
  }));
}

// ====== ТАБ 7: Сборен калкулатор (до 10 рецепти × брой) ======
const MULTI_KEY = "pu_foam_multi_v1";
const MULTI_ROWS = 10;
let _multiBound = false;

function getMultiState() {
  try {
    const s = JSON.parse(localStorage.getItem(MULTI_KEY));
    if (Array.isArray(s)) return s;
  } catch (e) {}
  return [];
}
function saveMultiState() {
  const rows = [];
  for (let i = 0; i < MULTI_ROWS; i++) {
    rows.push({ num: $("multiRec" + i).value, cnt: $("multiCnt" + i).value });
  }
  localStorage.setItem(MULTI_KEY, JSON.stringify(rows));
}
// Нормализиран ключ за материал (някои имена са с двойни интервали)
function matKey(name) { return String(name).replace(/\s+/g, " ").trim().toLowerCase(); }

function setupMulti() {
  const wrap = $("multiRows");
  const state = getMultiState();
  // При повторно зареждане на данните пазим текущо въведеното
  if (wrap.children.length) {
    for (let i = 0; i < MULTI_ROWS; i++) {
      state[i] = { num: $("multiRec" + i).value, cnt: $("multiCnt" + i).value };
    }
  }
  let html = "";
  for (let i = 0; i < MULTI_ROWS; i++) {
    html += `<div class="multi-row">
      <span class="multi-idx">${i + 1}</span>
      <div><select id="multiRec${i}" data-i="${i}" aria-label="Рецепта на ред ${i + 1}"></select></div>
      <input type="text" inputmode="decimal" id="multiCnt${i}" placeholder="0" aria-label="Брой пускове на ред ${i + 1}" />
    </div>`;
  }
  wrap.innerHTML = html;

  for (let i = 0; i < MULTI_ROWS; i++) {
    const sel = $("multiRec" + i);
    let opts = `<option value="">— избери —</option>`;
    MODEL.recipes.forEach((r) => {
      opts += `<option value="${escapeHtml(r.number)}">№${escapeHtml(r.number)} — ${escapeHtml(r.kind)}${isFavorite(r.number) ? "  ★" : ""}</option>`;
    });
    sel.innerHTML = opts;
    const st = state[i] || {};
    if (st.num && getRecipe(st.num)) sel.value = st.num;
    $("multiCnt" + i).value = st.cnt || "";
    sel.addEventListener("change", () => {
      // При избор на рецепта без брой — слагаме 1 по подразбиране
      const cnt = $("multiCnt" + i);
      if (sel.value && !cnt.value.trim()) cnt.value = "1";
      onMultiChange();
    });
    $("multiCnt" + i).addEventListener("input", onMultiChange);
    attachPicker(sel, "Избери рецепта");
  }

  if (!_multiBound) {
    _multiBound = true;
    $("multiClearBtn").addEventListener("click", () => {
      if (!confirm("Изчисти всички редове?")) return;
      for (let i = 0; i < MULTI_ROWS; i++) { $("multiRec" + i).value = ""; $("multiCnt" + i).value = ""; refreshPicker($("multiRec" + i)); }
      onMultiChange();
    });
    $("multiDeductBtn").addEventListener("click", deductPlanFromStock);
    $("multiShareBtn").addEventListener("click", () => { const [t, b] = multiShareText(); if (t) shareText(t, b); });
  }
  recalcMulti();
}
function onMultiChange() { saveMultiState(); recalcMulti(); }

// Връща попълнените редове: [{rec, cnt}]
function multiEntries() {
  const out = [];
  for (let i = 0; i < MULTI_ROWS; i++) {
    const rec = getRecipe($("multiRec" + i).value);
    const cnt = valNum("multiCnt" + i);
    const inp = $("multiCnt" + i);
    const bad = rec && (isNaN(cnt) || cnt <= 0) && inp.value.trim() !== "";
    inp.classList.toggle("invalid", !!bad);
    inp.closest(".multi-row").classList.toggle("filled", !!rec);
    if (rec && !isNaN(cnt) && cnt > 0) out.push({ rec, cnt, row: i + 1 });
  }
  return out;
}
// Сумира материалите по име за всички редове (запазва реда на появяване)
function multiTotals(entries) {
  const map = new Map();
  entries.forEach(({ rec, cnt }) => {
    rec.components.forEach((c) => {
      const k = matKey(c.name);
      if (!map.has(k)) map.set(k, { name: c.name, kg: 0 });
      map.get(k).kg += c.kg * cnt;
    });
  });
  return [...map.values()];
}
function cntLabel(n) { return n === 1 ? "пуск" : "пуска"; }

function recalcMulti() {
  const entries = multiEntries();
  const totalCard = $("multiTotalCard");
  const per = $("multiPerRecipe");
  if (!entries.length) {
    totalCard.style.display = "none";
    per.innerHTML = `<div class="empty">Избери рецепта и брой поне на един ред.</div>`;
    return;
  }

  // --- Общо за всички ---
  const totals = multiTotals(entries);
  const stock = getStock();
  const tracked = totals.some((t) => stock[matKey(t.name)] != null);
  let grand = 0;
  totals.forEach((t) => { grand += t.kg; });
  let html = `<tr><th>Материал</th><th class="num">Нужни кг</th><th class="num">${tracked ? "Остават" : "%"}</th></tr>`;
  const shorts = [];
  totals.forEach((t) => {
    let third;
    if (tracked) {
      const have = stock[matKey(t.name)];
      if (have == null) third = `<td class="num" style="color:var(--text-faint)">—</td>`;
      else {
        const left = have - t.kg;
        if (left < -1e-9) { shorts.push(`${t.name} (${fmtKg(-left)} кг)`); third = `<td class="num short">−${fmtKg(-left)}</td>`; }
        else third = `<td class="num ok">${fmtKg(left)}</td>`;
      }
    } else {
      const pct = grand > 0 ? (t.kg / grand) * 100 : 0;
      third = `<td class="num" style="color:var(--text-dim)">${fmt(pct, 1)}</td>`;
    }
    html += `<tr><td class="name">${escapeHtml(t.name)}</td><td class="num val">${fmtKg(t.kg)}</td>${third}</tr>`;
  });
  html += `<tr class="total"><td>Общо (кг)</td><td class="num val">${fmtKg(grand)}</td><td class="num"></td></tr>`;
  $("multiTotalTable").innerHTML = html;
  const sh = $("multiShort");
  sh.style.display = shorts.length ? "block" : "none";
  sh.textContent = shorts.length ? "Не достигат в склада: " + shorts.join(", ") : "";
  $("multiDeductBtn").style.display = tracked ? "" : "none";
  const totalCnt = entries.reduce((s, e) => s + e.cnt, 0);
  $("multiTotalSub").textContent = `${entries.length} ${entries.length === 1 ? "рецепта" : "рецепти"}, общо ${fmt(totalCnt, totalCnt % 1 ? 1 : 0)} ${cntLabel(totalCnt)}`;

  let costAll = 0, anyCost = false;
  entries.forEach(({ rec, cnt }) => {
    const c = costOf(rec.components, cnt);
    if (c != null) { costAll += c; anyCost = true; }
  });
  $("multiCostRow").style.display = anyCost ? "flex" : "none";
  if (anyCost) $("multiCost").textContent = fmt(costAll, 2) + " €";
  totalCard.style.display = "block";

  // --- Поотделно за всяка рецепта ---
  per.innerHTML = entries.map(({ rec, cnt, row }) => {
    let t = `<tr><th>Материал</th><th class="num">1 пуск</th><th class="num">× ${fmt(cnt, cnt % 1 ? 1 : 0)}</th></tr>`;
    let s1 = 0;
    rec.components.forEach((c) => {
      s1 += c.kg;
      t += `<tr><td class="name">${escapeHtml(c.name)}</td><td class="num" style="color:var(--text-dim)">${fmt(c.kg)}</td><td class="num val">${fmtKg(c.kg * cnt)}</td></tr>`;
    });
    t += `<tr class="total"><td>Общо (кг)</td><td class="num">${fmt(s1)}</td><td class="num val">${fmtKg(s1 * cnt)}</td></tr>`;
    const cost = costOf(rec.components, cnt);
    return `<details class="card multi-rec">
      <summary>
        <span class="multi-rec-title"><span class="multi-idx">${row}</span>№${escapeHtml(rec.number)} — ${escapeHtml(rec.kind)}</span>
        <span class="multi-rec-sum">${fmt(cnt, cnt % 1 ? 1 : 0)} ${cntLabel(cnt)}, ${fmtKg(s1 * cnt)} кг${cost != null ? ", " + fmt(cost, 2) + " €" : ""}</span>
      </summary>
      <table class="mat-table" style="margin-top:8px;">${t}</table>
    </details>`;
  }).join("");
}

function multiShareText() {
  const entries = multiEntries();
  if (!entries.length) return ["", ""];
  const lines = [];
  entries.forEach(({ rec, cnt }) => {
    const s1 = rec.components.reduce((s, c) => s + c.kg, 0);
    lines.push(`№${rec.number} — ${rec.kind} × ${fmt(cnt, cnt % 1 ? 1 : 0)} (${fmtKg(s1 * cnt)} кг)`);
    rec.components.forEach((c) => lines.push(`   ${c.name}: ${fmtKg(c.kg * cnt)} кг`));
    lines.push("");
  });
  lines.push("ОБЩО ЗА ВСИЧКИ:");
  let grand = 0;
  multiTotals(entries).forEach((t) => { grand += t.kg; lines.push(`${t.name}: ${fmtKg(t.kg)} кг`); });
  lines.push(`Общо: ${fmtKg(grand)} кг`);
  let costAll = 0, any = false;
  entries.forEach(({ rec, cnt }) => { const c = costOf(rec.components, cnt); if (c != null) { costAll += c; any = true; } });
  if (any) lines.push(`Себестойност: ${fmt(costAll, 2)} €`);
  return ["Сборен калкулатор — материали", lines.join("\n")];
}

// ====== ТАБ: Склад / наличности (запазени локално, в кг) ======
const STOCK_KEY = "pu_foam_stock_v1";
function getStock() {
  try {
    const s = JSON.parse(localStorage.getItem(STOCK_KEY));
    if (s && typeof s === "object" && !Array.isArray(s)) return s;
  } catch (e) {}
  return {};
}
function setStock(obj) { localStorage.setItem(STOCK_KEY, JSON.stringify(obj)); }
// Всички суровини от рецептите, без повторения (имена с двойни интервали се обединяват)
function stockMaterials() {
  const map = new Map();
  MODEL.recipes.forEach((r) => r.components.forEach((c) => {
    const k = matKey(c.name);
    if (!map.has(k)) map.set(k, String(c.name).replace(/\s+/g, " ").trim());
  }));
  return [...map.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, "bg"));
}
function numToField(n) { return String(Math.round(n * 1000) / 1000).replace(".", ","); }

let _stockMats = [];
function setupStock() {
  _stockMats = stockMaterials();
  const stock = getStock();
  $("stockList").innerHTML = _stockMats.map((m, i) => `
    <div class="stock-row" data-i="${i}">
      <div class="stock-main">
        <label class="stock-name" for="stockIn${i}">${escapeHtml(m.name)}</label>
        <input type="text" inputmode="decimal" id="stockIn${i}" placeholder="кг" value="${stock[m.key] != null ? numToField(stock[m.key]) : ""}" />
        <button type="button" class="stock-add-btn" data-add="${i}" title="Добави доставка" aria-label="Добави доставка за ${escapeHtml(m.name)}">+</button>
      </div>
      <div class="stock-add" id="stockAdd${i}" hidden>
        <input type="text" inputmode="decimal" id="stockAddIn${i}" placeholder="Доставка, кг" />
        <button type="button" class="btn" data-addok="${i}">Добави</button>
      </div>
      <div class="stock-note" id="stockNote${i}"></div>
    </div>`).join("") || `<div class="empty">Няма суровини в рецептите.</div>`;

  const list = $("stockList");
  if (!list._bound) {
    list._bound = true;
    list.addEventListener("input", (e) => {
      const m = /^stockIn(\d+)$/.exec(e.target.id || "");
      if (!m) return;
      const i = +m[1], st = getStock(), raw = e.target.value.trim(), v = parseNum(raw);
      const bad = raw !== "" && isNaN(v);
      e.target.classList.toggle("invalid", bad);
      if (bad) return;
      if (raw === "") delete st[_stockMats[i].key]; else st[_stockMats[i].key] = v;
      setStock(st);
      recalcStock();
    });
    list.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) {
        const box = $("stockAdd" + add.dataset.add);
        box.hidden = !box.hidden;
        if (!box.hidden) $("stockAddIn" + add.dataset.add).focus();
        return;
      }
      const ok = e.target.closest("[data-addok]");
      if (ok) addDelivery(+ok.dataset.addok);
    });
    list.addEventListener("keydown", (e) => {
      const m = /^stockAddIn(\d+)$/.exec(e.target.id || "");
      if (m && e.key === "Enter") addDelivery(+m[1]);
    });
    $("stockShareBtn").addEventListener("click", () => { const [t, b] = stockShareText(); if (t) shareText(t, b); else toast("Нищо не достига за плана."); });
  }
  recalcStock();
}
function addDelivery(i) {
  const inp = $("stockAddIn" + i);
  const v = parseNum(inp.value);
  if (isNaN(v) || v <= 0) { inp.classList.add("invalid"); return; }
  inp.classList.remove("invalid");
  const st = getStock(), k = _stockMats[i].key;
  st[k] = (st[k] || 0) + v;
  setStock(st);
  $("stockIn" + i).value = numToField(st[k]);
  $("stockIn" + i).classList.remove("invalid");
  inp.value = "";
  $("stockAdd" + i).hidden = true;
  recalcStock();
  toast(`Добавени ${fmtKg(v)} кг ${_stockMats[i].name}.`);
}
// Нужни количества по плана от „Сборен“: { ключ: кг }
function planNeeds() {
  const need = {};
  if (!$("multiRec0")) return need;
  multiTotals(multiEntries()).forEach((t) => { need[matKey(t.name)] = t.kg; });
  return need;
}
// Суровини, които не достигат за плана: [{name, need, have, short}]
function stockShortages() {
  const st = getStock(), need = planNeeds();
  return _stockMats
    .filter((m) => need[m.key] != null && st[m.key] != null && st[m.key] - need[m.key] < -1e-9)
    .map((m) => ({ name: m.name, need: need[m.key], have: st[m.key], short: need[m.key] - st[m.key] }));
}
function recalcStock() {
  if (!$("stockIn0") && _stockMats.length) return;
  const st = getStock(), need = planNeeds();
  const hasPlan = Object.keys(need).length > 0;
  let untracked = 0;
  _stockMats.forEach((m, i) => {
    const note = $("stockNote" + i);
    if (!note) return;
    const n = need[m.key], have = st[m.key];
    note.className = "stock-note";
    if (n == null) { note.textContent = ""; return; }
    if (have == null) { untracked++; note.textContent = `За плана трябват ${fmtKg(n)} кг`; return; }
    const left = have - n;
    if (left < -1e-9) { note.classList.add("short"); note.textContent = `За плана трябват ${fmtKg(n)} кг, не достигат ${fmtKg(-left)} кг`; }
    else { note.classList.add("ok"); note.textContent = `За плана трябват ${fmtKg(n)} кг, остават ${fmtKg(left)} кг`; }
  });

  const box = $("stockSummary");
  const shorts = stockShortages();
  if (!hasPlan) {
    box.innerHTML = `<h3 class="card-title">Няма план за сравнение</h3><div class="card-sub" style="margin:0;">Попълни рецепти и брой в „Сборен“ и тук ще видиш какво не достига.</div>`;
  } else if (shorts.length) {
    let t = `<tr><th>Суровина</th><th class="num">Има</th><th class="num">Трябват</th><th class="num">Не достигат</th></tr>`;
    shorts.forEach((x) => { t += `<tr><td class="name">${escapeHtml(x.name)}</td><td class="num">${fmtKg(x.have)}</td><td class="num">${fmtKg(x.need)}</td><td class="num short">${fmtKg(x.short)}</td></tr>`; });
    box.innerHTML = `<h3 class="card-title">${shorts.length === 1 ? "Не достига 1 суровина" : "Не достигат " + shorts.length + " суровини"} за плана</h3><div class="card-sub">Количества в кг, спрямо плана от „Сборен“.</div><table class="mat-table">${t}</table>`;
  } else {
    box.innerHTML = `<h3 class="card-title">Наличностите стигат за плана</h3><p class="ok-line">Всички следени суровини покриват плана от „Сборен“.</p>`;
  }
  if (hasPlan && untracked) box.innerHTML += `<p class="hint">${untracked} ${untracked === 1 ? "суровина от плана няма" : "суровини от плана нямат"} въведена наличност и не се ${untracked === 1 ? "проверява" : "проверяват"}.</p>`;
}
function stockShareText() {
  const shorts = stockShortages();
  if (!shorts.length) return ["", ""];
  const lines = shorts.map((x) => `${x.name}: ${fmtKg(x.short)} кг (има ${fmtKg(x.have)}, трябват ${fmtKg(x.need)})`);
  return ["Списък за поръчка — не достигат за плана", lines.join("\n")];
}
// Изважда плана от „Сборен“ от наличностите (само за следените суровини)
function deductPlanFromStock() {
  const need = planNeeds(), st = getStock();
  const keys = Object.keys(need).filter((k) => st[k] != null);
  if (!keys.length) { toast("Няма следени суровини в този план."); return; }
  if (!confirm(`Приспадни плана от склада?\nЩе се намалят наличностите на ${keys.length} ${keys.length === 1 ? "суровина" : "суровини"}.`)) return;
  // Наличността не пада под нула
  keys.forEach((k) => { st[k] = Math.max(0, Math.round((st[k] - need[k]) * 1000) / 1000); });
  setStock(st);
  _stockMats.forEach((m, i) => { const inp = $("stockIn" + i); if (inp && st[m.key] != null) inp.value = numToField(st[m.key]); });
  recalcMulti();
  recalcStock();
  toast("Планът е приспаднат от склада.");
}

// ====== Печат / PDF на текущия таб ======
let _printOpened = [];
function printTab() {
  const d = new Date().toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  $("printHead").innerHTML = `<b>${escapeHtml(currentTabTitle())}</b><span>ПУ Пяна, ${d}</span>`;
  window.print();
}
function setupPrint() {
  document.querySelectorAll("[data-print]").forEach((b) => b.addEventListener("click", printTab));
  // При печат разгъваме картите на отделните рецепти, после ги връщаме
  window.addEventListener("beforeprint", () => {
    _printOpened = [...document.querySelectorAll(".tab-page.active details:not([open])")];
    _printOpened.forEach((x) => { x.open = true; });
  });
  window.addEventListener("afterprint", () => { _printOpened.forEach((x) => { x.open = false; }); _printOpened = []; });
}

// ====== Помощ / Безопасност (бележки от листа Notes) ======
function renderHelp() {
  const list = $("helpList");
  if (!MODEL.notes || !MODEL.notes.length) { list.innerHTML = `<div class="empty">Няма бележки.</div>`; return; }
  const dangerRe = /опасн|експлоз|внимани|!!!/i;
  list.innerHTML = MODEL.notes.map((n) => {
    const danger = dangerRe.test(n);
    return `<div class="note-line${danger ? " danger" : ""}">${danger ? "⚠ " : ""}${escapeHtml(n)}</div>`;
  }).join("");
}

// ====== Инициализация ======
function renderAll() {
  setupCalc();
  setupCalibrator();
  setupRecipes();
  setupAmine();
  setupSimulator();
  setupMulti();
  setupStock();
  renderLog();
}

async function init() {
  setupNav();
  setupPicker();
  setupPrint();

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

  // Дневник и помощ
  $("calcLogBtn").addEventListener("click", addLogFromCalc);
  $("helpBtn").addEventListener("click", () => { renderHelp(); $("helpModal").classList.add("open"); });
  $("helpModal").addEventListener("click", (e) => { if (e.target.id === "helpModal") $("helpModal").classList.remove("open"); });

  await doLoad();
}

// Регистрация на service worker + известие за нова версия
function showUpdateBar() { $("updateBar").hidden = false; }
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    $("updateBtn").addEventListener("click", () => location.reload());
    try {
      // Ако вече има активен worker, всяка следваща инсталация е обновяване
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register("sw.js");
      const watch = (w) => {
        if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "activated" && hadController) showUpdateBar(); });
      };
      watch(reg.installing);
      reg.addEventListener("updatefound", () => watch(reg.installing));
      // Проверка за нова версия при връщане в приложението
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    } catch (e) { console.warn("SW грешка:", e); }
  });
}

document.addEventListener("DOMContentLoaded", init);
