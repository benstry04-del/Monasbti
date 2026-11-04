const CACHE = "habb-experience-shell-v2";
const CORE = [
  "/index.html",
  "/brand-motion/logo/habb-logo-v1.webp",
  "/brand-motion/objects/event-objects-v1.webp",
  "/brand-motion/posters/intro-poster-v1.webp",
  "/assets/fonts.css",
  "/assets/font0.woff2",
  "/assets/font1.woff2",
  "/assets/font2.woff2",
  "/assets/font3.woff2",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const html = await fetch("/index.html", { cache: "reload" });
      if (!html.ok) throw new Error("App shell unavailable");
      await cache.put("/index.html", html.clone());
      const text = await html.text();
      const assets = [
        ...text.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g),
      ].map((m) => m[1]);
      await Promise.allSettled(
        [...new Set([...CORE, ...assets])].map(async (url) => {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("habb-experience-shell-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    url.origin !== location.origin ||
    request.method !== "GET" ||
    request.destination === "video" ||
    /\.(mp4|webm)$/.test(url.pathname) ||
    request.headers.has("range")
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(async (response) => {
          if (
            response.ok &&
            (response.headers.get("content-type") || "").includes("text/html")
          ) {
            const cache = await caches.open(CACHE);
            await cache.put("/index.html", response.clone());
          }
          return response;
        })
        .catch(
          async () => (await caches.match("/index.html")) || Response.error(),
        ),
    );
    return;
  }
  if (
    !url.pathname.startsWith("/assets/") &&
    !url.pathname.startsWith("/brand-motion/")
  )
    return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > 64)
          for (const key of keys.slice(0, keys.length - 64))
            if (
              !CORE.includes(new URL(key.url).pathname) &&
              !/\.(js|css|woff2)$/.test(new URL(key.url).pathname)
            )
              await cache.delete(key);
      }
      return response;
    })(),
  );
});
