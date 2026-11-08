// Lecteur d'adresses YouTube (page-info.js) : ce que le menu propose pour chaque adresse d'onglet.
const test = require("node:test");
const assert = require("node:assert/strict");

require("../page-info.js");
const { parse, channelOf } = globalThis.SonNuagePage;

const video = (videoId, origin = "https://www.youtube.com") => ({ videoId, url: `${origin}/watch?v=${videoId}` });

test("hors de YouTube ou adresse illisible : rien", () => {
  assert.equal(parse("https://example.org/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parse("ftp://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parse("pas une adresse"), null);
  assert.equal(parse(""), null);
});

test("page YouTube sans vidéo, liste ni chaîne : tout vide", () => {
  assert.deepEqual(parse("https://www.youtube.com/"), { music: false, video: null, list: null, channel: null });
  assert.deepEqual(parse("https://www.youtube.com/results?search_query=x").video, null);
});

test("vidéo : watch, youtu.be, shorts, live, mobile", () => {
  assert.deepEqual(parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10").video, video("dQw4w9WgXcQ"));
  assert.deepEqual(parse("https://youtu.be/dQw4w9WgXcQ?si=abc").video, video("dQw4w9WgXcQ"));
  assert.deepEqual(parse("https://www.youtube.com/shorts/dQw4w9WgXcQ").video, video("dQw4w9WgXcQ"));
  assert.deepEqual(parse("https://www.youtube.com/live/dQw4w9WgXcQ").video, video("dQw4w9WgXcQ"));
  assert.deepEqual(parse("https://m.youtube.com/watch?v=dQw4w9WgXcQ").video, video("dQw4w9WgXcQ"));
});

test("vidéo YouTube Music : adresse music.youtube.com", () => {
  const info = parse("https://music.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(info.music, true);
  assert.deepEqual(info.video, video("dQw4w9WgXcQ", "https://music.youtube.com"));
});

test("identifiant de vidéo malformé : ignoré", () => {
  assert.equal(parse("https://www.youtube.com/watch?v=court").video, null);
  assert.equal(parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ%22").video, null);
});

test("vidéo ouverte dans une playlist : les deux, pas de chaîne", () => {
  const info = parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc_123");
  assert.deepEqual(info.video, video("dQw4w9WgXcQ"));
  assert.deepEqual(info.list, { id: "PLabc_123", url: "https://www.youtube.com/playlist?list=PLabc_123", album: false });
  assert.equal(info.channel, null);
});

test("album : identifiant OLAK5uy_ ou page /browse/MPREb_ de YouTube Music", () => {
  assert.equal(parse("https://www.youtube.com/playlist?list=OLAK5uy_abc").list.album, true);
  assert.deepEqual(parse("https://music.youtube.com/browse/MPREb_xyz").list, {
    id: "MPREb_xyz",
    url: "https://music.youtube.com/browse/MPREb_xyz",
    album: true,
  });
  // /browse/ n'a ce sens que sur YouTube Music.
  assert.equal(parse("https://www.youtube.com/browse/MPREb_xyz").list, null);
});

test("listes personnelles et mix : ignorés, sauf les playlists RDCLAK de YouTube Music", () => {
  for (const id of ["RDdQw4w9WgXcQ", "RDMM", "LL", "WL", "LM"]) {
    assert.equal(parse(`https://www.youtube.com/playlist?list=${id}`).list, null, id);
  }
  assert.equal(parse("https://music.youtube.com/playlist?list=RDCLAK5uy_abc").list.id, "RDCLAK5uy_abc");
  // LL n'est personnelle qu'en entier : « LLxyz » est une vraie liste.
  assert.equal(parse("https://www.youtube.com/playlist?list=LLxyz").list.id, "LLxyz");
});

test("identifiant de liste malformé : ignoré", () => {
  assert.equal(parse("https://www.youtube.com/playlist?list=a%20b").list, null);
});

test("chaîne : @nom, %40nom, channel/UC, c/, user/, onglets compris", () => {
  const channel = (href) => parse(href).channel;
  assert.deepEqual(channel("https://www.youtube.com/@artiste/videos"), { url: "https://www.youtube.com/@artiste", label: "@artiste" });
  assert.deepEqual(channel("https://www.youtube.com/%40artiste"), { url: "https://www.youtube.com/@artiste", label: "@artiste" });
  assert.deepEqual(channel("https://www.youtube.com/channel/UCabc-_1/releases"), {
    url: "https://www.youtube.com/channel/UCabc-_1",
    label: "UCabc-_1",
  });
  assert.deepEqual(channel("https://www.youtube.com/c/Nom%20Long"), { url: "https://www.youtube.com/c/Nom%20Long", label: "Nom Long" });
  assert.deepEqual(channel("https://www.youtube.com/user/vieux"), { url: "https://www.youtube.com/user/vieux", label: "vieux" });
});

test("chaîne proposée seulement quand l'adresse ne donne ni vidéo ni liste", () => {
  const info = parse("https://www.youtube.com/@artiste/playlists?list=PLabc");
  assert.equal(info.list.id, "PLabc");
  assert.equal(info.channel, null);
});

test("hôte en majuscules : reconnu", () => {
  assert.deepEqual(parse("https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ").video, video("dQw4w9WgXcQ"));
});

test("chaîne à l'encodage invalide : libellé laissé tel quel", () => {
  assert.equal(parse("https://www.youtube.com/c/a%E0b").channel.label, "c/a%E0b");
});

test("page d'artiste YouTube Music : chaîne YouTube correspondante", () => {
  assert.deepEqual(parse("https://music.youtube.com/browse/UCabc").channel, {
    url: "https://www.youtube.com/channel/UCabc",
    label: "UCabc",
  });
});

test("channelOf : adresse relative ou absolue du propriétaire lue dans la page", () => {
  assert.deepEqual(channelOf("/@artiste"), { url: "https://www.youtube.com/@artiste", label: "@artiste" });
  assert.deepEqual(channelOf("https://music.youtube.com/channel/UCabc"), {
    url: "https://www.youtube.com/channel/UCabc",
    label: "UCabc",
  });
  assert.equal(channelOf("/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(channelOf("http://[bad"), null);
});
