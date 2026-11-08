// Service worker (background.js) vu du menu et des options : messages envoyés, requêtes au serveur, réponses.
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadBackground, reply } = require("./load-background.js");

const HOME = { id: "home", name: "Maison", url: "https://music.example.org", apiKey: "lfy_ext_secret", sendCookies: true };
const WORK = { id: "work", name: "Bureau", url: "https://work.example.org/sonnuage", apiKey: "lfy_ext_other", sendCookies: false };
const configured = (extra = {}) => ({ servers: [HOME, WORK], defaultServerId: "home", ...extra });

// ---------- Instance visée ----------

test("aucune instance configurée : erreur notConfigured", async () => {
  const bg = loadBackground();
  assert.deepEqual(await bg.send({ type: "status", videoId: "dQw4w9WgXcQ" }), {
    ok: false,
    error: "errNotConfigured",
    status: 0,
    code: "notConfigured",
  });
  assert.equal(bg.requests.length, 0);
});

test("instance sans clé : ignorée", async () => {
  const bg = loadBackground({ storage: { servers: [{ ...HOME, apiKey: "" }], defaultServerId: "home" } });
  assert.equal((await bg.send({ type: "test" })).code, "notConfigured");
});

test("instance par défaut, instance choisie, instance inconnue", async () => {
  const bg = loadBackground({ storage: configured() });
  await bg.send({ type: "test" });
  await bg.send({ type: "test", serverId: "work" });
  assert.deepEqual(bg.requests.map((r) => new URL(r.url).host), ["music.example.org", "work.example.org"]);
  assert.equal((await bg.send({ type: "test", serverId: "gone" })).code, "notConfigured");
});

test("défaut disparu : première instance", async () => {
  const bg = loadBackground({ storage: configured({ defaultServerId: "gone" }) });
  await bg.send({ type: "test" });
  assert.equal(new URL(bg.requests[0].url).host, "music.example.org");
});

// ---------- Requêtes ----------

test("status : clé dans l'en-tête, sans cookies du navigateur, nom de l'instance ajouté", async () => {
  const bg = loadBackground({ storage: configured(), respond: () => reply(200, { status: "Done" }) });
  const r = await bg.send({ type: "status", videoId: "dQw4w9WgXcQ", url: undefined });
  assert.deepEqual(r, { ok: true, data: { status: "Done", serverName: "Maison" } });
  const [req] = bg.requests;
  assert.equal(req.url, "https://music.example.org/api/extension/status?videoId=dQw4w9WgXcQ");
  assert.equal(req.method, "GET");
  assert.equal(req.headers.Authorization, "ApiKey lfy_ext_secret");
  assert.equal(req.headers["Content-Type"], undefined);
  assert.equal(req.credentials, "omit");
});

test("adresse d'instance avec chemin : conservée devant /api", async () => {
  const bg = loadBackground({ storage: configured() });
  await bg.send({ type: "status", serverId: "work", url: "https://www.youtube.com/@a" });
  assert.equal(bg.requests[0].url, "https://work.example.org/sonnuage/api/extension/status?url=https%3A%2F%2Fwww.youtube.com%2F%40a");
});

test("réponse vide : null", async () => {
  const bg = loadBackground({ storage: configured(), respond: () => reply(204) });
  assert.deepEqual(await bg.send({ type: "subscribe", url: "https://www.youtube.com/@a" }), { ok: true, data: null });
});

test("subscribe : corps JSON, drapeaux en booléens", async () => {
  const bg = loadBackground({ storage: configured() });
  await bg.send({ type: "subscribe", url: "https://www.youtube.com/@a", isAlbum: undefined, importExisting: 1 });
  const [req] = bg.requests;
  assert.equal(req.method, "POST");
  assert.equal(req.url, "https://music.example.org/api/admin/youtube/subscriptions");
  assert.equal(req.headers["Content-Type"], "application/json");
  assert.deepEqual(req.body, { url: "https://www.youtube.com/@a", isAlbum: false, importExisting: true });
});

// ---------- Erreurs du serveur ----------

const errorFor = async (respond) => (await loadBackground({ storage: configured(), respond }).send({ type: "test" }));

test("serveur injoignable : code unreachable", async () => {
  const r = await errorFor(() => {
    throw new TypeError("Failed to fetch");
  });
  assert.deepEqual(r, { ok: false, error: "errUnreachable|Maison", status: 0, code: "unreachable" });
});

test("401 : clé refusée, même avec un détail", async () => {
  const r = await errorFor(() => reply(401, { detail: "ignoré" }));
  assert.deepEqual(r, { ok: false, error: "errKeyRejected|Maison", status: 401, code: null });
});

test("429 : trop de requêtes", async () => {
  assert.equal((await errorFor(() => reply(429))).error, "errThrottled");
});

test("détail JSON du serveur : affiché", async () => {
  const r = await errorFor(() => reply(400, { detail: "Adresse non prise en charge" }));
  assert.equal(r.error, "errServerDetail|Maison|Adresse non prise en charge");
  assert.equal(r.status, 400);
});

test("403 sans détail : accès refusé", async () => {
  assert.equal((await errorFor(() => reply(403, "<html>Cloudflare</html>"))).error, "errForbidden|Maison");
});

test("autre erreur sans détail : code HTTP", async () => {
  assert.equal((await errorFor(() => reply(502))).error, "errServer|Maison|502");
});

test("200 qui n'est pas du JSON (page de connexion devant le serveur) : message clair", async () => {
  const r = await errorFor(() => reply(200, "<!doctype html><title>Sign in</title>"));
  assert.deepEqual(r, { ok: false, error: "errNotSonNuage|Maison", status: 200, code: null });
});

// ---------- Import d'une vidéo ----------

const ENTRY = { videoId: "dQw4w9WgXcQ", title: "Titre exact", channel: "Chaîne", durationSeconds: 212, thumbnailUrl: "t.jpg", importStatus: null };
const importMessage = { type: "import", videoId: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Titre de la page", channel: "Chaîne page" };

test("import : la fiche lue par le serveur part dans la file", async () => {
  const bg = loadBackground({
    storage: configured(),
    respond: (url) => (url.includes("/resolve") ? reply(200, { entries: [{ ...ENTRY, videoId: "autre123456" }, ENTRY] }) : reply(200, { queued: 1 })),
  });
  assert.deepEqual(await bg.send(importMessage), { ok: true, data: { queued: 1 } });
  assert.equal(bg.requests[0].url, "https://music.example.org/api/admin/youtube/resolve?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");
  assert.deepEqual(bg.requests[1].body, { videos: [ENTRY], albumHint: null });
});

test("import : lecture impossible côté serveur, ce qu'affiche la page", async () => {
  const bg = loadBackground({ storage: configured(), respond: (url) => (url.includes("/resolve") ? reply(500) : reply(200, { queued: 1 })) });
  assert.equal((await bg.send(importMessage)).ok, true);
  assert.deepEqual(bg.requests[1].body.videos, [
    { videoId: "dQw4w9WgXcQ", title: "Titre de la page", channel: "Chaîne page", durationSeconds: null, thumbnailUrl: null, importStatus: null },
  ]);
});

test("import : sans titre de page, l'identifiant sert de titre", async () => {
  const bg = loadBackground({ storage: configured(), respond: (url) => (url.includes("/resolve") ? reply(200, { entries: [] }) : reply(200, {})) });
  await bg.send({ ...importMessage, title: "", channel: "" });
  assert.equal(bg.requests[1].body.videos[0].title, "dQw4w9WgXcQ");
  assert.equal(bg.requests[1].body.videos[0].channel, null);
});

test("import : clé refusée ou serveur injoignable à la lecture, rien n'est envoyé", async () => {
  const bg = loadBackground({ storage: configured(), respond: () => reply(401) });
  assert.equal((await bg.send(importMessage)).status, 401);
  assert.equal(bg.requests.length, 1);
});

// ---------- Import d'une liste ----------

test("importList : album, titre de la liste en indice d'album", async () => {
  const listing = { title: "Mon album", entries: [ENTRY] };
  const bg = loadBackground({ storage: configured(), respond: (url) => (url.includes("/resolve") ? reply(200, listing) : reply(200, { queued: 1, alreadyKnown: 0 })) });
  await bg.send({ type: "importList", url: "https://www.youtube.com/playlist?list=OLAK5uy_a", isAlbum: true });
  assert.deepEqual(bg.requests[1].body, { videos: [ENTRY], albumHint: "Mon album" });
});

test("importList : playlist, pas d'indice d'album", async () => {
  const bg = loadBackground({ storage: configured(), respond: (url) => (url.includes("/resolve") ? reply(200, { title: "P", entries: [ENTRY] }) : reply(200, {})) });
  await bg.send({ type: "importList", url: "https://www.youtube.com/playlist?list=PLa", isAlbum: false });
  assert.equal(bg.requests[1].body.albumHint, null);
});

test("importList : liste vide, rien n'est envoyé", async () => {
  const bg = loadBackground({ storage: configured(), respond: () => reply(200, { entries: [] }) });
  assert.deepEqual(await bg.send({ type: "importList", url: "https://www.youtube.com/playlist?list=PLa" }), {
    ok: true,
    data: { queued: 0, alreadyKnown: 0 },
  });
  assert.equal(bg.requests.length, 1);
});

// ---------- Cookies ----------

const COOKIES = [
  { domain: ".youtube.com", hostOnly: false, httpOnly: true, path: "/", secure: true, session: false, expirationDate: 1893456000.7, name: "SID", value: "a" },
  { domain: "www.youtube.com", hostOnly: true, httpOnly: false, path: "/", secure: false, session: true, expirationDate: 5, name: "PREF", value: "b" },
  { domain: "google.com", hostOnly: false, httpOnly: false, path: "/x", secure: true, session: false, name: "NID", value: "c" },
  { domain: ".google.com", hostOnly: true, httpOnly: false, path: "/", secure: true, session: false, expirationDate: 10, name: "H", value: "d" },
];

test("uploadCookies : fichier Netscape envoyé aux instances cochées, état enregistré", async () => {
  const bg = loadBackground({ storage: configured(), cookies: COOKIES });
  assert.deepEqual(await bg.send({ type: "uploadCookies" }), { ok: true });
  assert.equal(bg.requests.length, 1);
  const [req] = bg.requests;
  assert.equal(req.method, "PUT");
  assert.equal(req.url, "https://music.example.org/api/admin/youtube/cookies");
  assert.equal(
    req.body.content,
    [
      "# Netscape HTTP Cookie File",
      "# SonNuage browser extension",
      "",
      "#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1893456000\tSID\ta",
      "www.youtube.com\tFALSE\t/\tFALSE\t0\tPREF\tb",
      ".google.com\tTRUE\t/x\tTRUE\t0\tNID\tc",
      "google.com\tFALSE\t/\tTRUE\t10\tH\td",
      "",
    ].join("\n"),
  );
  assert.equal(bg.storage.cookieState.home.error, null);
  assert.equal(typeof bg.storage.cookieState.home.at, "number");
  assert.equal(bg.storage.cookieState.work, undefined);
});

test("uploadCookies : envoi ponctuel à une instance non cochée", async () => {
  const bg = loadBackground({ storage: configured(), cookies: COOKIES });
  await bg.send({ type: "uploadCookies", serverId: "work" });
  assert.deepEqual(bg.requests.map((r) => r.url), ["https://work.example.org/sonnuage/api/admin/youtube/cookies"]);
});

test("uploadCookies : aucune instance cochée", async () => {
  const bg = loadBackground({ storage: { servers: [WORK] }, cookies: COOKIES });
  assert.equal((await bg.send({ type: "uploadCookies" })).code, "notConfigured");
});

test("uploadCookies : permission absente, erreur enregistrée pour l'instance", async () => {
  const bg = loadBackground({ storage: configured(), cookies: COOKIES, cookiePermission: false });
  assert.equal((await bg.send({ type: "uploadCookies" })).error, "errCookiePermission");
  assert.deepEqual(bg.storage.cookieState.home, { at: null, error: "errCookiePermission" });
  assert.equal(bg.requests.length, 0);
});

test("uploadCookies : pas de session YouTube dans le navigateur", async () => {
  const bg = loadBackground({ storage: configured(), cookies: COOKIES.filter((c) => c.domain.includes("google")) });
  assert.equal((await bg.send({ type: "uploadCookies" })).error, "errNoYoutubeCookies");
});

test("uploadCookies : échec d'une instance, les autres reçoivent quand même", async () => {
  const bg = loadBackground({
    storage: configured({ servers: [HOME, { ...WORK, sendCookies: true }] }),
    cookies: COOKIES,
    respond: (url) => (url.startsWith(HOME.url) ? reply(500) : reply(204)),
  });
  assert.equal((await bg.send({ type: "uploadCookies" })).error, "errServer|Maison|500");
  assert.deepEqual(bg.storage.cookieState.home, { at: null, error: "errServer|Maison|500" });
  assert.equal(bg.storage.cookieState.work.error, null);
});

test("envoi périodique : alarme seulement si une instance reçoit les cookies", async () => {
  const bg = loadBackground({ storage: configured({ cookieHours: 6 }) });
  await bg.fire("startup");
  assert.deepEqual(bg.alarms.get("sonnuage-cookies"), { periodInMinutes: 360, delayInMinutes: 1 });
  const off = loadBackground({ storage: { servers: [WORK] } });
  await off.fire("installed");
  assert.equal(off.alarms.size, 0);
});

test("alarme : envoie les cookies", async () => {
  const bg = loadBackground({ storage: configured(), cookies: COOKIES });
  await bg.fire("alarm", { name: "sonnuage-cookies" });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(bg.requests[0]?.method, "PUT");
});

// ---------- Anciens réglages ----------

test("migrate : réglages d'une seule instance convertis", async () => {
  const bg = loadBackground({
    storage: { serverUrl: "https://old.example.org", apiKey: "k", cookieSync: true, lastCookieSync: 1, lastCookieError: "x" },
  });
  assert.equal((await bg.send({ type: "migrate" })).ok, true);
  const [server] = bg.storage.servers;
  assert.deepEqual({ ...server, id: "?" }, { id: "?", name: "old.example.org", url: "https://old.example.org", apiKey: "k", sendCookies: true });
  assert.equal(bg.storage.defaultServerId, server.id);
  for (const k of ["serverUrl", "apiKey", "cookieSync", "lastCookieSync", "lastCookieError"]) assert.equal(k in bg.storage, false, k);
});

test("migrate : déjà converti, rien ne change", async () => {
  const bg = loadBackground({ storage: { ...configured(), serverUrl: "https://old.example.org" } });
  await bg.send({ type: "migrate" });
  assert.deepEqual(bg.storage.servers, [HOME, WORK]);
});

// ---------- Qui peut parler au service worker ----------

test("message d'une autre extension ou d'une page : ignoré", async () => {
  const bg = loadBackground({ storage: configured() });
  assert.equal(await bg.send({ type: "test" }, { id: "autre-extension" }), undefined);
  assert.equal(await bg.send({ type: "test" }, {}), undefined);
  assert.equal(bg.requests.length, 0);
});

test("type de message inconnu : ignoré", async () => {
  const bg = loadBackground({ storage: configured() });
  assert.equal(await bg.send({ type: "nope" }), undefined);
  assert.equal(await bg.send(null), undefined);
});
