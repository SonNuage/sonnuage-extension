# SonNuage : extension de navigateur

Extension Manifest V3 (Chrome, Edge, Firefox 128+) pour [SonNuage](https://git.pmjb.org/pmj.bailly/sonnuage). Un clic sur
son icône, dans la barre d'outils, ouvre un menu qui agit sur l'onglet YouTube / YouTube Music affiché, sans rien
ajouter dans les pages de YouTube :

- **Vidéo** (`watch?v=…`, `/shorts/…`, `youtu.be/…`) : *Importer cette vidéo*, avec son état sur le serveur
  (en file, téléchargement, traitement, importée, échec, ignorée).
- **Playlist ou album** (paramètre `list=`, album si l'identifiant commence par `OLAK5uy_`, ou page
  `music.youtube.com/browse/MPREb_…`) : *Synchroniser cette playlist / cet album* (abonnement) ou *Importer une fois*,
  avec les options *C'est un album* et *Importer aussi les vidéos déjà publiées*. Une vidéo ouverte dans une playlist
  propose les deux. Les mix et listes personnelles (`RD…`, `LL`, `WL`, `LM`) sont ignorés.
- **Chaîne** (`/@nom`, `/channel/UC…`, `/c/…`, `/user/…`, y compris leurs onglets) : *Synchroniser toute la
  chaîne*, abonnement à la racine de la chaîne (le serveur en lit les albums, EP et singles). Sur une page de vidéo,
  la chaîne de la vidéo est aussi proposée quand la page la donne.

Le menu affiche aussi l'instance visée et son état (*Connecté*, *Injoignable*, *Clé refusée*), l'état de l'envoi des
cookies (« envoyés il y a … · prochain envoi dans … », bouton *Envoyer les cookies maintenant*) et un lien vers les
réglages. Permissions : `storage`, `alarms` (envoi périodique des cookies), `activeTab` (lire l'adresse de
l'onglet au clic sur l'icône), `scripting` (lire le titre et la chaîne de la vidéo dans la page YouTube), accès à
www / music / m.youtube.com. `cookies` et l'accès à chaque serveur SonNuage sont demandés à la configuration.

1. Dans SonNuage : *Administration → YouTube → Réglages → Extension de navigateur*, créer une clé et la copier
   (elle n'est affichée qu'une fois, seule son empreinte est conservée). La clé ne permet que quatre actions :
   ajouter des vidéos à la file, lire une adresse YouTube, s'abonner, envoyer des cookies YouTube. Plus
   l'état d'une vidéo. Rien d'autre de l'API n'est accessible avec elle. Révoquez-la depuis le même écran.
2. Charger l'extension non empaquetée, depuis ce dépôt ou depuis le zip produit par la CI
   (`sonnuage-extension-X.Y.Z.zip`, artefact du job `package` ou paquet de la release) :
   - **Chrome / Edge** : `chrome://extensions` → activer le *mode développeur* → *Charger l'extension non
     empaquetée* → choisir le dossier de ce dépôt (ou du zip décompressé).
   - **Firefox** : `about:debugging#/runtime/this-firefox` → *Charger un module complémentaire temporaire* →
     choisir `manifest.json` (retiré au redémarrage de Firefox).
3. Cliquer sur l'icône de l'extension puis sur la roue dentée (ou *Options*), saisir le nom, l'adresse du serveur (par exemple
   `https://musique.exemple.fr`, ou `http://localhost:5080` en développement) et la clé, puis
   *Enregistrer et tester* : le navigateur demande l'accès à ce seul serveur.

**Plusieurs instances** : *Ajouter une instance* enregistre d'autres serveurs SonNuage (chacun avec sa propre
clé). Le menu de l'extension vise l'instance cochée *Instance par défaut*. Une liste déroulante y permet d'en
choisir une autre le temps d'une action.

**Envoi des cookies** (facultatif, désactivé par défaut, au choix pour chaque instance) : l'extension exporte
périodiquement les cookies youtube.com / google.com du navigateur au format Netscape vers
`PUT /api/admin/youtube/cookies` des instances cochées, ce qui évite les blocages « confirmez que vous n'êtes pas
un robot ». L'intervalle est commun. *Envoyer les cookies maintenant* fait un envoi ponctuel. Ces cookies
ouvrent votre compte Google à chaque serveur qui les reçoit : utilisez un profil connecté avec un compte
secondaire. La permission « cookies » est rendue dès qu'aucune instance ne les reçoit plus.

**Langues** : l'extension suit la langue du navigateur, en français ou en anglais (anglais par défaut pour les
autres langues). Les textes sont dans `_locales/<langue>/messages.json` (format `chrome.i18n`, avec une
description par message pour les traducteurs). Pour ajouter une langue, copier `en/` vers le code de la
langue (`de`, `es`, `pt_BR`…) et traduire les champs `message` en gardant les `$PARAMÈTRES$`. Les messages
d'erreur venus du serveur restent en français.

Derrière Cloudflare Access, autorisez l'en-tête `Authorization: ApiKey …` (règle *Bypass* ou jeton de
service) pour les chemins `/api/admin/youtube/*` et `/api/extension/*`.

## Développement et CI

Pas d'étape de build : les fichiers à la racine sont l'extension. [.gitlab-ci.yml](.gitlab-ci.yml) vérifie la
syntaxe des scripts et des JSON, contrôle que les clés de traduction sont les mêmes dans toutes les langues, puis
produit `dist/sonnuage-extension-X.Y.Z.zip` (version lue dans `manifest.json`). Sur un tag `vX.Y.Z` (qui doit
correspondre à la version du manifeste), le zip va dans le registre de paquets génériques et une release GitLab
est créée.

Sur GitHub, [.github/workflows/ci.yml](.github/workflows/ci.yml) fait les mêmes vérifications, produit le même zip
et le joint à une release sur les tags `vX.Y.Z`.
