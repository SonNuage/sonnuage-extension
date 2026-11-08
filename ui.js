// Outils communs au menu (popup.html) et aux options (options.html) : traductions et accès aux éléments.

const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String));
const $ = (id) => document.getElementById(id);
const locale = chrome.i18n.getUILanguage();

/** Traduit les attributs data-i18n (texte), data-i18n-title, data-i18n-aria et data-i18n-placeholder. */
function translate(root) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
}
