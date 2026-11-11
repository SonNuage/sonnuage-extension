# SonNuage: browser extension

**English** · [Français](README.fr.md)

Manifest V3 extension (Chrome, Edge, Firefox 128+) for [SonNuage](https://github.com/SonNuage/sonnuage). A click on
its icon, in the toolbar, opens a menu that acts on the YouTube / YouTube Music tab on screen, without
adding anything to YouTube's pages.

Status: work in progress, unsigned. It is loaded as an unpacked extension (see below).

- **Video** (`watch?v=…`, `/shorts/…`, `youtu.be/…`): *Import this video*, with its state on the server
  (queued, downloading, processing, imported, failed, skipped).
- **Playlist or album** (`list=` parameter, album if the identifier starts with `OLAK5uy_`, or a
  `music.youtube.com/browse/MPREb_…` page): *Sync this playlist / this album* (subscription) or *Import once*,
  with the options *This is an album* and *Also import the videos already published*. A video opened in a playlist
  offers both. Mixes and personal lists (`RD…`, `LL`, `WL`, `LM`) are ignored.
- **Channel** (`/@name`, `/channel/UC…`, `/c/…`, `/user/…`, including their tabs): *Sync the whole
  channel*, subscription to the root of the channel (the server reads its albums, EPs and singles). On a video page,
  the video's channel is also offered when the page gives it.

The menu also shows the targeted instance and its state (*Connected*, *Unreachable*, *Key rejected*), the state of
the cookie upload ("sent … ago · next in …", button *Send cookies now*) and a link to the
settings. Permissions: `storage`, `alarms` (periodic cookie upload), `activeTab` (read the address of
the tab when the icon is clicked), `scripting` (read the title and the channel of the video in the YouTube page), access to
www / music / m.youtube.com. `cookies` and the access to each SonNuage server are requested during setup.

1. In SonNuage: *Administration → YouTube → Settings → Browser extension*, create a key and copy it
   (it is shown only once, only its fingerprint is kept). The key allows only four actions:
   adding videos to the queue, reading a YouTube address, subscribing, sending YouTube cookies. Plus
   the state of a video. Nothing else in the API is reachable with it. Revoke it from the same screen.
2. Load the unpacked extension, from this repository or from the zip produced by the CI
   (`sonnuage-extension-X.Y.Z.zip`, artifact of the `package` job or package of the release):
   - **Chrome / Edge**: `chrome://extensions` → turn on *developer mode* → *Load unpacked* →
     choose the folder of this repository (or of the unzipped archive).
   - **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* →
     choose `manifest.json` (removed when Firefox restarts).
3. Click the extension's icon, then the gear (or *Options*), enter the name, the server address (for example
   `https://music.example.org`, or `http://localhost:5080` in development) and the key, then
   *Save and test*: the browser asks for access to this server only.

**Several instances**: *Add an instance* saves other SonNuage servers (each with its own
key). The extension's menu targets the instance ticked *Default instance*. A drop-down list there lets you
pick another one for a single action.

**Cookie upload** (optional, off by default, chosen for each instance): the extension periodically
exports the browser's youtube.com / google.com cookies in Netscape format to
`PUT /api/admin/youtube/cookies` of the ticked instances, which avoids the "confirm you are not
a robot" blocks. The interval is shared. *Send cookies now* does a one-off upload. These cookies
open your Google account to every server that receives them: use a profile signed in with a secondary
account. The "cookies" permission is given back as soon as no instance receives them any more.

**Languages**: the extension follows the browser's language, in French or in English (English by default for
other languages). The texts are in `_locales/<language>/messages.json` (`chrome.i18n` format, with a
description per message for translators). To add a language, copy `en/` to the language
code (`de`, `es`, `pt_BR`…) and translate the `message` fields, keeping the `$PARAMETERS$`. Error
messages coming from the server stay in French.

Behind Cloudflare Access, allow the header `Authorization: ApiKey …` (*Bypass* rule or service
token) for the paths `/api/admin/youtube/*` and `/api/extension/*`.

## Development and CI

No build step: the files at the root are the extension. [.gitlab-ci.yml](.gitlab-ci.yml) checks the
syntax of the scripts and the JSON files, runs the tests (`node --test test/*.test.js`, no dependency: the `test/` folder
does not go into the zip), checks that the translation keys are the same in all languages, then
produces `dist/sonnuage-extension-X.Y.Z.zip`. The manifest keeps version `0.0.0`: on a `vX.Y.Z` tag, the CI
writes the tag's version into it, then attaches the zip to the release (generic package registry). The `v0.0.0` tag marks the
starting point of the versions: the first published version is 0.1.0, until the extension is signed.

### Versions

Versions are published by [semantic-release](https://semantic-release.gitbook.io/) ([.releaserc.json](.releaserc.json)),
from the commit messages in the [Conventional Commits](https://www.conventionalcommits.org/en/) format:
`fix: …` gives a patch (1.0.1), `feat: …` a minor version (1.1.0), `feat!: …` or a
`BREAKING CHANGE:` footer a major version (2.0.0). `docs`, `chore`, `ci`, `refactor`, `test` publish nothing.
On `main`, the `semantic-release` job creates the `vX.Y.Z` tag and the GitLab release with its notes. The tag's
pipeline then publishes the version. It uses `GITLAB_TOKEN`, a token of the `sonnuage` group (masked and protected variable,
protected `v*` tags).

On GitHub, [.github/workflows/ci.yml](.github/workflows/ci.yml) runs the same checks, produces the same zip
and attaches it to a release on `vX.Y.Z` tags.

## Licence

SonNuage is free software under the [GNU AGPL v3.0 or later](LICENSE) licence: anyone can use it,
study it, modify it and redistribute it. A modified version, including one offered as an online service, must
publish its source code under the same licence.

Copyright © 2026 pmj.bailly and the SonNuage contributors.
