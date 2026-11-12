/* Guarda o app no aparelho para abrir sem internet.
   Ao publicar uma nova versão do app, troque o número abaixo (v1 -> v2) para os aparelhos atualizarem. */
const VERSAO = "ocorrencias-v1";
const ARQUIVOS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== "fontes").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function comPrazo(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("prazo")), ms))]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fontes do Google: guardadas na primeira vez que carregam
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("fontes").then(async c => {
      const salvo = await c.match(req);
      if (salvo) return salvo;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (x) { return Response.error(); }
    }));
    return;
  }

  // A planilha (Google Apps Script) nunca passa pelo cache
  if (url.origin !== self.location.origin) return;

  // Página: tenta a versão nova por 4 s; sem sinal, usa a guardada
  if (req.mode === "navigate") {
    e.respondWith(
      comPrazo(fetch(req), 4000)
        .then(r => { const cp = r.clone(); caches.open(VERSAO).then(c => c.put("./index.html", cp)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
