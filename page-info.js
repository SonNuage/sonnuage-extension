// Lecture d'une adresse YouTube / YouTube Music : vidéo, playlist (ou album) et chaîne.
// Travaille sur une chaîne d'adresse (onglet actif lu par le menu), pas sur `location`.
// Exposé en global : SonNuagePage.parse(href) → { video, list, channel } ou null hors de YouTube.

(() => {
  const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
  const VIDEO_ID = /^[\w-]{11}$/;
  const LIST_ID = /^[\w-]+$/;
  // Listes propres à un compte ou générées à la volée (mix « RD… » sauf playlists RDCLAK de YouTube Music,
  // « J'aime », « À regarder plus tard », titres aimés de YouTube Music) : rien à synchroniser.
  const PERSONAL_LIST = /^(RD(?!CLAK)|LL$|WL$|LM$)/;
  const CHANNEL_PATH = /^\/((?:@|%40)[^/]+|channel\/UC[\w-]+|c\/[^/]+|user\/[^/]+)(?:\/|$)/;

  function channelFrom(path) {
    const root = path.match(CHANNEL_PATH)?.[1]?.replace(/^%40/, "@");
    if (!root) return null;
    let label = root;
    try {
      label = decodeURIComponent(root.replace(/^(channel|c|user)\//, ""));
    } catch {
      // Encodage invalide : on garde le chemin tel quel.
    }
    // Racine de la chaîne (sans onglet /videos, /releases…) : le serveur choisit lui-même les onglets à lire.
    return { url: `https://www.youtube.com/${root}`, label };
  }

  /** Adresse d'un site YouTube, ou null (autre site, autre protocole, adresse invalide). */
  function youtubeUrl(href) {
    let u;
    try {
      u = new URL(href);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return HOSTS.has(u.hostname) ? u : null; // hostname déjà en minuscules (URL)
  }

  function videoFrom(u, origin) {
    const path = u.pathname;
    const videoId =
      u.hostname === "youtu.be" ? path.slice(1).split("/")[0]
      : path === "/watch" ? u.searchParams.get("v")
      : path.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1];
    return videoId && VIDEO_ID.test(videoId) ? { videoId, url: `${origin}/watch?v=${videoId}` } : null;
  }

  /** Playlist du paramètre list=, sauf listes personnelles et mix. */
  function listFrom(u, origin) {
    const id = u.searchParams.get("list");
    if (!id || !LIST_ID.test(id) || PERSONAL_LIST.test(id)) return null;
    return { id, url: `${origin}/playlist?list=${id}`, album: id.startsWith("OLAK5uy_") };
  }

  /** YouTube Music : /browse/MPREb_… est une page d'album, /browse/UC… une page d'artiste. */
  function musicBrowse(path, origin) {
    const id = path.match(/^\/browse\/([\w-]+)/)?.[1];
    if (id?.startsWith("MPREb_")) return { list: { id, url: `${origin}/browse/${id}`, album: true } };
    if (id?.startsWith("UC")) return { channel: { url: `https://www.youtube.com/channel/${id}`, label: id } };
    return {};
  }

  function parse(href) {
    const u = youtubeUrl(href);
    if (!u) return null;
    const music = u.hostname === "music.youtube.com";
    const origin = music ? "https://music.youtube.com" : "https://www.youtube.com";
    const browse = music ? musicBrowse(u.pathname, origin) : {};
    const info = { music, video: videoFrom(u, origin), list: browse.list ?? listFrom(u, origin), channel: browse.channel ?? null };
    // Chaîne seulement quand l'adresse ne donne rien d'autre : sur une vidéo, le menu la lit dans la page.
    if (!info.video && !info.list && !info.channel) info.channel = channelFrom(u.pathname);
    return info;
  }

  /** Chaîne d'une adresse de propriétaire lue dans la page (« /@nom », « https://music.youtube.com/channel/UC… »). */
  function channelOf(href) {
    try {
      return channelFrom(new URL(href, "https://www.youtube.com").pathname);
    } catch {
      return null;
    }
  }

  globalThis.SonNuagePage = { parse, channelOf };
})();
