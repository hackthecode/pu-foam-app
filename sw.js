// Service Worker — кешира само обвивката на приложението (app shell).
// ВАЖНО: данните от Google Sheets (gviz) НИКОГА не се кешират тук,
// за да се гарантира, че при всяко отваряне се зареждат най-новите данни
// (live-sync). Офлайн резервът за данните е в localStorage (виж data.js).

const CACHE = "pu-foam-shell-v10";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/i18n.js",
  "./js/csv.js",
  "./js/parse.js",
  "./js/data.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  // cache: "reload" — взимаме файловете от мрежата, не от HTTP кеша на браузъра
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Заявките към Google (данните) минават директно по мрежата — без кеш.
  if (url.hostname.includes("google.com") || url.hostname.includes("googleusercontent.com")) {
    return; // оставяме браузъра да я обработи нормално (network)
  }

  // За обвивката: stale-while-revalidate — бързо от кеша, обновяване на фон.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((resp) => {
          if (resp && resp.status === 200 && e.request.method === "GET") {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
