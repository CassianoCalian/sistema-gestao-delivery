/* Depósito do Zé - cache apenas da interface do PDV e de scripts estáticos.
 * NUNCA cachear respostas de API ou dados autenticados do servidor. */
const VERSION = "deposito-ze-pdv-shell-v1";
const OFFLINE = "/admin/pdv/offline";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // O registro acontece após autenticação e carregamento do PDV.
    const response = await fetch(OFFLINE, { credentials: "include", cache: "no-store" });
    if (!response.ok || response.redirected || response.url.includes("/admin/login")) {
      throw new Error("Não foi possível preparar a página offline autenticada.");
    }
    const cache = await caches.open(VERSION);
    await cache.put(OFFLINE, response.clone());
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const all = await caches.keys();
    await Promise.all(all.filter((key) => key.startsWith("deposito-ze-pdv-shell-") && key !== VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  if (request.mode === "navigate" && (
    url.pathname === "/admin/pdv" ||
    url.pathname === "/admin/pdv/" ||
    url.pathname === OFFLINE
  )) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok || response.redirected || response.status === 401 || response.status === 403) return response;
        throw new Error("PDV temporariamente inacessível");
      } catch {
        return (await caches.match(OFFLINE)) ?? Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
