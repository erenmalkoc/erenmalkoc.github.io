/* dirtymac page — language of the page text.

   The page is written in English and opens in English. The language picker in the app bar
   swaps every text marked data-i18n (and the aria-label / alt attributes marked
   data-i18n-aria-label / data-i18n-alt) for the same text from i18n/<code>.json, which exist
   for the app's 17 languages. The choice is remembered, and it is the same language as the
   demo panel's: either one changes the other (the "dirtymac-language" event).
   Without JavaScript the page stays English, which is what it is written in. */

(function () {
  "use strict";

  var KEY = "dirtymac-language"; // shared with popover.js
  // English first, then LanguagePreference.allCases without it. Endonyms, as the app lists them.
  var LANGUAGES = [
    ["en", "English"], ["de", "Deutsch"], ["es", "Español"], ["fr", "Français"], ["it", "Italiano"],
    ["tr", "Türkçe"], ["ru", "Русский"], ["ko", "한국어"], ["ja", "日本語"], ["pl", "Polski"],
    ["nl", "Nederlands"], ["uk", "Українська"], ["vi", "Tiếng Việt"], ["id", "Bahasa Indonesia"],
    ["pt-BR", "Português (Brasil)"], ["zh-Hans", "简体中文"], ["zh-Hant", "繁體中文"]
  ];
  var CODES = LANGUAGES.map(function (l) { return l[0]; });

  var current = "en";
  var dictionaries = {};
  var pending = {};

  function read() {
    try {
      var value = window.localStorage.getItem(KEY);
      return CODES.indexOf(value) >= 0 ? value : "en";
    } catch (e) { return "en"; }
  }

  function write(code) {
    try { window.localStorage.setItem(KEY, code); } catch (e) { /* private mode */ }
  }

  function load(code, done) {
    if (dictionaries[code]) { done(dictionaries[code]); return; }
    if (pending[code]) { pending[code].push(done); return; }
    pending[code] = [done];
    var request = new XMLHttpRequest();
    request.open("GET", "i18n/" + code + ".json");
    request.onload = function () {
      var waiting = pending[code] || [];
      delete pending[code];
      if (request.status !== 200) return;
      try { dictionaries[code] = JSON.parse(request.responseText); } catch (e) { return; }
      waiting.forEach(function (callback) { callback(dictionaries[code]); });
    };
    request.onerror = function () { delete pending[code]; };
    request.send();
  }

  function apply(dict, code) {
    var i;
    var texts = document.querySelectorAll("[data-i18n]");
    for (i = 0; i < texts.length; i++) {
      var value = dict[texts[i].getAttribute("data-i18n")];
      if (typeof value !== "string") continue;
      if (texts[i].hasAttribute("data-i18n-html")) texts[i].innerHTML = value;
      else texts[i].textContent = value;
    }
    ["aria-label", "alt"].forEach(function (attribute) {
      var marked = document.querySelectorAll("[data-i18n-" + attribute + "]");
      for (var j = 0; j < marked.length; j++) {
        var text = dict[marked[j].getAttribute("data-i18n-" + attribute)];
        if (typeof text === "string") marked[j].setAttribute(attribute, text);
      }
    });
    if (dict["page.title"]) document.title = dict["page.title"];
    setMeta('meta[name="description"]', dict["meta.description"]);
    setMeta('meta[property="og:title"]', dict["og.title"]);
    setMeta('meta[property="og:description"]', dict["og.description"]);
    document.documentElement.setAttribute("lang", code);
  }

  function setMeta(selector, value) {
    var node = document.querySelector(selector);
    if (node && typeof value === "string") node.setAttribute("content", value);
  }

  var select = document.querySelector("[data-lang-select]");

  function set(code, quiet) {
    if (CODES.indexOf(code) < 0) return;
    current = code;
    write(code);
    if (select) select.value = code;
    load(code, function (dict) {
      if (current !== code) return; // another choice was made meanwhile
      apply(dict, code);
    });
    if (!quiet) {
      document.dispatchEvent(new CustomEvent("dirtymac-language", { detail: { code: code, source: "page" } }));
    }
  }

  if (select) {
    LANGUAGES.forEach(function (language) {
      var option = document.createElement("option");
      option.value = language[0];
      option.textContent = language[1];
      select.appendChild(option);
    });
    select.addEventListener("change", function () { set(select.value, false); });
  }

  // The demo panel changed its language: the page follows.
  document.addEventListener("dirtymac-language", function (event) {
    var detail = event.detail || {};
    if (detail.source === "page" || detail.code === current) return;
    set(detail.code, true);
  });

  // The strings other scripts need (the copy confirmations in main.js).
  window.pageI18n = {
    language: function () { return current; },
    t: function (key, fallback) {
      var dict = dictionaries[current];
      return dict && typeof dict[key] === "string" ? dict[key] : fallback;
    }
  };

  current = read();
  if (select) select.value = current;
  if (current !== "en") set(current, true);
})();
