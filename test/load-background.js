// Charge background.js dans un contexte isolé, avec un faux `chrome` et un faux `fetch`, et lui parle comme le menu :
// par messages. Les traductions renvoient « clé|param1|param2 » pour que les tests lisent quel message est choisi.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
const json = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/**
 * @param {object} options
 * @param {object} [options.storage]  contenu initial de chrome.storage.local
 * @param {(url: string, init: object) => Response | Promise<Response>} [options.respond]  réponse du serveur
 * @param {object[]} [options.cookies]  cookies du navigateur (format chrome.cookies.Cookie)
 * @param {boolean} [options.cookiePermission]
 */
function loadBackground({ storage = {}, respond = () => new Response("{}"), cookies = [], cookiePermission = true } = {}) {
  const data = json(storage);
  const listeners = { message: [], changed: [], alarm: [], installed: [], startup: [] };
  const event = (list) => ({ addListener: (fn) => list.push(fn) });
  const alarms = new Map();

  const read = (keys) => {
    if (keys == null) return json(data);
    if (typeof keys === "string") keys = [keys];
    if (Array.isArray(keys)) return json(Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])));
    return json(Object.fromEntries(Object.entries(keys).map(([k, fallback]) => [k, k in data ? data[k] : fallback])));
  };

  const chrome = {
    i18n: { getMessage: (key, subs = []) => [key, ...subs].join("|") },
    storage: {
      local: {
        get: async (keys) => read(keys),
        set: async (values) => {
          const changes = {};
          for (const [k, v] of Object.entries(values)) {
            changes[k] = { oldValue: data[k], newValue: v };
            data[k] = json(v);
          }
          listeners.changed.forEach((fn) => fn(changes, "local"));
        },
        remove: async (keys) => [].concat(keys).forEach((k) => delete data[k]),
      },
      onChanged: event(listeners.changed),
    },
    alarms: {
      clear: async (name) => alarms.delete(name),
      create: (name, info) => alarms.set(name, json(info)),
      onAlarm: event(listeners.alarm),
    },
    runtime: {
      id: "sonnuage-self",
      onMessage: event(listeners.message),
      onInstalled: event(listeners.installed),
      onStartup: event(listeners.startup),
      openOptionsPage: () => {},
    },
    permissions: { contains: async () => cookiePermission },
    cookies: { getAll: async ({ domain }) => json(cookies.filter((c) => c.domain.replace(/^\./, "").endsWith(domain))) },
  };

  const requests = [];
  const fetch = async (url, init = {}) => {
    const request = { url, method: init.method, headers: init.headers, credentials: init.credentials, body: init.body && JSON.parse(init.body) };
    requests.push(request);
    return respond(url, request);
  };

  vm.runInContext(SOURCE, vm.createContext({ chrome, fetch, crypto, URL, URLSearchParams, console }), { filename: "background.js" });

  /** Envoie un message comme le menu ou les options ; `undefined` quand le service worker ne répond pas. */
  function send(message, sender = { id: chrome.runtime.id }) {
    return new Promise((resolve) => {
      const willRespond = listeners.message.some((fn) => fn(message, sender, (r) => resolve(json(r))) === true);
      if (!willRespond) resolve(undefined);
    });
  }

  const fire = async (kind, ...args) => {
    for (const fn of listeners[kind]) await fn(...args);
  };

  return { send, requests, storage: data, alarms, fire };
}

const reply = (status, body) =>
  new Response(body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body), { status });

module.exports = { loadBackground, reply };
