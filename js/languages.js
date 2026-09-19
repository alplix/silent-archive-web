/*
 * Registry of languages available on the site. Both the game engine
 * (Engine.boot, which fetches data/dil/<code>.json for each entry) and the
 * site-chrome switcher (main.js/i18n.js) read this list, so adding a
 * language is just: add a dil/<code>.json file, add an entry here, and
 * (optionally) add a UI_STRINGS[<code>] block to i18n.js for full site-chrome
 * coverage — anything missing there falls back to English automatically.
 */
const LANGUAGE_META = [
  { code: "en", label: "English" },
  { code: "tr", label: "Türkçe" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
];

window.LANGUAGE_META = LANGUAGE_META;
