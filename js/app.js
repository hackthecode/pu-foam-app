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

// ====== ТАБ 1: Калкулатор ======
function fillRecipeSelect(sel, includeEmpty) {
  sel.innerHTML = "";
  if (includeEmpty) {
    const o = document.createElement("option");
    o.value = ""; o.textContent = "— избери —";
    sel.appendChild(o);
  }
  MODEL.recipes.forEach((rec) => {
    const o = document.createElement("option");
    o.value = rec.number;
    o.textContent = `№${rec.number} — ${rec.kind}`;
    sel.appendChild(o);
  });
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
  fillRecipeSelect(sel, false);

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
  ["calcW", "calcH", "calcL", "calcPuls"].forEach((id) =>
    $(id).addEventListener("input", recalcCalc)
  );

  onRecipeChange();
}

function recalcCalc() {
  const rec = getRecipe($("calcRecipe").value);
  if (!rec) return;
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
  renderRecipeList();
  $("recModal").addEventListener("click", (e) => {
    if (e.target.id === "recModal") closeRecipeModal();
  });
}
function renderRecipeList() {
  const q = $("recSearch").value.trim().toLowerCase();
  const list = $("recList");
  const filtered = MODEL.recipes.filter((r) => {
    if (!q) return true;
    return (
      r.number.toLowerCase().includes(q) ||
      r.kind.toLowerCase().includes(q) ||
      (r.color && r.color.toLowerCase().includes(q))
    );
  });
  if (!filtered.length) {
    list.innerHTML = `<div class="empty">Няма намерени рецепти.</div>`;
    return;
  }
  list.innerHTML = filtered
    .map(
      (r) => `
    <div class="recipe-card" data-num="${r.number}">
      <div class="badge">${r.number}</div>
      <div class="info">
        <div class="kind">${r.kind}</div>
        <div class="meta">${fmt(r.total, 2)} кг замес${r.color ? " · " + r.color : ""}</div>
      </div>
      <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
    </div>`
    )
    .join("");
  list.querySelectorAll(".recipe-card").forEach((card) => {
    card.addEventListener("click", () => openRecipeModal(card.dataset.num));
  });
}
function openRecipeModal(num) {
  const rec = getRecipe(num);
  if (!rec) return;
  $("recModalTitle").textContent = `№${rec.number} — ${rec.kind}`;
  $("recModalSub").textContent =
    `Общо Смес: ${fmt(rec.total, 2)} кг` + (rec.color ? ` · Боя: ${rec.color}` : "");
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
  fillRecipeSelect(sel, false);

  sel.addEventListener("change", recalcSim);
  $("simTarget").addEventListener("input", () => {
    syncChips();
    recalcSim();
  });
  document.querySelectorAll("#simChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $("simTarget").value = chip.dataset.kg;
      syncChips();
      recalcSim();
    });
  });

  // Бележки
  const nl = $("notesList");
  nl.innerHTML = MODEL.notes
    .slice(0, 60)
    .map((n) => `<div class="note-line">${escapeHtml(n)}</div>`)
    .join("");

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
  const target = valNum("simTarget");
  const card = $("simResCard");
  if (!rec || isNaN(target) || target <= 0 || rec.total <= 0) {
    card.style.display = "none";
    return;
  }
  const K = target / rec.total;
  $("simK").textContent = "× " + fmt(K, 5);

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

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
  await doLoad();
}

// Регистрация на service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW грешка:", e));
  });
}

document.addEventListener("DOMContentLoaded", init);
