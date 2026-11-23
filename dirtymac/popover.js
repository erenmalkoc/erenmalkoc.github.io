/* dirtymac — the menu bar panel on the product page, usable like the app (1.4.0).

   It is the app's own panel rebuilt for the page and it follows the app's own rules:
   the lock modes and their limits (LockConfiguration), the start delay, the
   auto-unlock timer, the full lockdown confirmation with its Esc check (a lock longer
   than five minutes with the mouse frozen first asks you to hold Esc), and the
   hold-Esc exit (KeyboardBlocker). The texts come from the app's string catalog in
   all 17 languages (strings.json, see extract-strings.py).

   Nothing here blocks your keyboard or your mouse: a "frozen mouse" only freezes this
   page's fake desktop, and not at all on touch screens, which have no Esc key. */

(function () {
  "use strict";

  var popover = document.querySelector("[data-popover]");
  if (!popover) return;
  var desktop = popover.closest("[data-desktop]");

  function $(selector) { return popover.querySelector(selector); }
  function $all(selector) { return Array.prototype.slice.call(popover.querySelectorAll(selector)); }

  // ------------------------------------------------------------------ the app's rules

  var HOLD_MS = 3000; // KeyboardBlocker.escHoldDuration
  var GRACE_MS = 1500; // KeyboardBlocker.escReleaseGrace: a lost key-up cannot keep the lock on
  var MIN_MOUSE_LOCK = 30; // LockConfiguration.minMouseLockSeconds
  var MAX_MOUSE_LOCK = 15 * 60; // LockConfiguration.maxMouseLockSeconds
  var ESC_CHECK_ABOVE = 5 * 60; // LockConfiguration.escCheckAboveSeconds
  var AUTO_UNLOCK_CHOICES = [0, 30, 60, 120, 300, 600, 900, 1800, 3600];
  var START_DELAY_CHOICES = [0, 3, 5, 10];
  var HOT_KEYS = {
    off: "",
    ctrlOptCmdK: "⌃⌥⌘K",
    ctrlOptCmdD: "⌃⌥⌘D",
    optShiftCmdK: "⌥⇧⌘K"
  };
  // LanguagePreference.allCases, in the app's order.
  var LANGUAGES = ["de", "en", "es", "fr", "it", "tr", "ru", "ko", "ja", "pl", "nl", "uk", "vi", "id", "pt-BR", "zh-Hans", "zh-Hant"];

  var DEFAULTS = {
    mode: "basic",
    blockModifierKeys: true,
    blockMediaKeys: true,
    blockMouseAndTrackpad: false,
    autoUnlockSeconds: 0,
    keepDisplayAwake: true,
    startDelaySeconds: 0,
    playSounds: true,
    appearance: "system",
    language: "system",
    hotKey: "ctrlOptCmdK",
    openAtLogin: false,
    updateChecks: false
  };

  var STORAGE_KEY = "dirtymac-demo-settings";
  var cfg = load();

  function load() {
    var stored = {};
    try { stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { stored = {}; }
    var out = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      out[key] = typeof stored[key] === typeof DEFAULTS[key] ? stored[key] : DEFAULTS[key];
    });
    if (!(out.hotKey in HOT_KEYS)) out.hotKey = DEFAULTS.hotKey;
    if (["basic", "advanced"].indexOf(out.mode) < 0) out.mode = "basic";
    if (["system", "light", "dark"].indexOf(out.appearance) < 0) out.appearance = "system";
    if (out.language !== "system" && LANGUAGES.indexOf(out.language) < 0) out.language = "system";
    out.autoUnlockSeconds = clampedSeconds(AUTO_UNLOCK_CHOICES.indexOf(out.autoUnlockSeconds) < 0 ? 0 : out.autoUnlockSeconds, out.blockMouseAndTrackpad);
    if (START_DELAY_CHOICES.indexOf(out.startDelaySeconds) < 0) out.startDelaySeconds = 0;
    return out;
  }

  function save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  }

  // Once the mouse is part of the lock the menu bar can no longer be clicked, so the
  // timer is never off, never shorter than 30 s and never longer than 15 min.
  function clampedSeconds(seconds, mouseLocked) {
    return mouseLocked ? Math.min(Math.max(seconds, MIN_MOUSE_LOCK), MAX_MOUSE_LOCK) : seconds;
  }

  // LockConfiguration.effective: Basic is a fixed safe preset.
  function effective(c) {
    if (c.mode !== "advanced") {
      return {
        blockMouseAndTrackpad: false,
        autoUnlockSeconds: 0,
        startDelaySeconds: c.startDelaySeconds
      };
    }
    return {
      blockMouseAndTrackpad: c.blockMouseAndTrackpad,
      autoUnlockSeconds: clampedSeconds(c.autoUnlockSeconds, c.blockMouseAndTrackpad),
      startDelaySeconds: c.startDelaySeconds
    };
  }

  function requiresEscCheck(e) {
    return e.blockMouseAndTrackpad && e.autoUnlockSeconds > ESC_CHECK_ABOVE;
  }

  function offeredAutoUnlock(mouseLocked) {
    return AUTO_UNLOCK_CHOICES.filter(function (s) { return clampedSeconds(s, mouseLocked) === s; });
  }

  // ------------------------------------------------------------------ texts

  var catalog = null; // strings.json
  var languageCode = "en";

  function resolveLanguage() {
    if (cfg.language !== "system") return cfg.language;
    var wanted = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    for (var i = 0; i < wanted.length; i++) {
      var tag = String(wanted[i]);
      var lower = tag.toLowerCase();
      if (lower.indexOf("zh") === 0) return /hant|tw|hk|mo/.test(lower) ? "zh-Hant" : "zh-Hans";
      if (lower.indexOf("pt") === 0) return "pt-BR";
      var base = lower.split("-")[0];
      if (LANGUAGES.indexOf(base) >= 0) return base;
    }
    return "en";
  }

  // The catalog's %@, %lld and %1$@ placeholders, filled in order.
  function t(key) {
    var args = Array.prototype.slice.call(arguments, 1);
    var table = catalog && catalog.strings[languageCode];
    var text = (table && table[key]) || (catalog && catalog.strings.en[key]) || key;
    var next = 0;
    return text.replace(/%(?:\d+\$)?(?:@|lld)/g, function () { return String(args[next++]); });
  }

  function durationTitle(seconds) {
    var unit = seconds >= 3600 ? "hour" : seconds >= 60 ? "minute" : "second";
    var value = unit === "hour" ? seconds / 3600 : unit === "minute" ? seconds / 60 : seconds;
    try {
      return new Intl.NumberFormat(languageCode, { style: "unit", unit: unit, unitDisplay: "short" }).format(value);
    } catch (e) {
      return value + (unit === "hour" ? " h" : unit === "minute" ? " min" : " s");
    }
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(seconds) {
    var s = Math.max(0, seconds);
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }

  // ------------------------------------------------------------------ state

  var state = "idle"; // idle | waiting | locked | confirm
  var panelOpen = true;
  var view = "main";
  var lockedWith = null; // the configuration the running lock was started with
  var startedAt = 0;
  var ticker = null;
  var waitLeft = 0;
  var waitTimer = null;
  var waitWith = null;
  var waitVerified = false;

  // hold Esc to unlock: idle | holding | letGo
  var esc = "idle";
  var escStartedAt = 0;
  var escTimer = null;
  var graceTimer = null;

  // hold Esc before a long full lockdown: the check
  var check = { held: false, startedAt: 0, timer: null, passed: false };

  var touchOnly = window.matchMedia && window.matchMedia("(hover: none)").matches;

  function elapsedSeconds() { return Math.floor((Date.now() - startedAt) / 1000); }

  function remainingHold() {
    var left = Math.ceil((HOLD_MS - (Date.now() - escStartedAt)) / 1000);
    return Math.min(3, Math.max(1, left));
  }

  // ------------------------------------------------------------------ the lock

  function unlockedBy(reason) {
    state = "idle";
    lockedWith = null;
    cancelEsc();
    window.clearInterval(ticker);
    ticker = null;
    desktop.removeAttribute("data-frozen");
    render();
  }

  function startLock(e) {
    state = "locked";
    lockedWith = e;
    startedAt = Date.now();
    window.clearInterval(ticker);
    ticker = window.setInterval(function () {
      if (lockedWith.autoUnlockSeconds > 0 && elapsedSeconds() >= lockedWith.autoUnlockSeconds) {
        unlockedBy("autoUnlock");
        return;
      }
      render();
    }, 250);
    // The mouse freeze only exists where there is a keyboard to leave it with.
    if (e.blockMouseAndTrackpad && !touchOnly) desktop.setAttribute("data-frozen", "");
    render();
  }

  // KeyboardBlocker.beginLock: waits for the start delay, and refuses a long
  // frozen-mouse lock whose Esc check has not been passed.
  function beginLock(verified) {
    var e = effective(cfg);
    if (requiresEscCheck(e) && !verified) return;
    if (e.startDelaySeconds > 0) {
      state = "waiting";
      waitLeft = e.startDelaySeconds;
      waitWith = e;
      waitVerified = verified;
      window.clearInterval(waitTimer);
      waitTimer = window.setInterval(function () {
        waitLeft -= 1;
        if (waitLeft <= 0) {
          cancelWait();
          startLock(waitWith);
        } else {
          render();
        }
      }, 1000);
      render();
    } else {
      startLock(e);
    }
  }

  function cancelWait() {
    window.clearInterval(waitTimer);
    waitTimer = null;
    if (state === "waiting") state = "idle";
    render();
  }

  // MainView.powerTapAction
  function powerTap() {
    if (state === "locked") unlockedBy("clicked");
    else if (state === "waiting") cancelWait();
    else if (effective(cfg).blockMouseAndTrackpad) enterConfirm();
    else beginLock(false);
  }

  // ------------------------------------------------------------------ hold Esc to unlock

  function cancelEsc() {
    window.clearInterval(escTimer);
    window.clearTimeout(graceTimer);
    escTimer = null;
    graceTimer = null;
    esc = "idle";
  }

  function escDown() {
    esc = "holding";
    escStartedAt = Date.now();
    escTimer = window.setInterval(function () {
      if (Date.now() - escStartedAt >= HOLD_MS) {
        window.clearInterval(escTimer);
        escTimer = null;
        esc = "letGo";
        graceTimer = window.setTimeout(function () { unlockedBy("escHeld"); }, GRACE_MS);
      }
      render();
    }, 100);
    render();
  }

  // ------------------------------------------------------------------ the Esc check

  function enterConfirm() {
    resetCheck();
    state = "confirm";
    render();
  }

  function leaveConfirm() {
    resetCheck();
    if (state === "confirm") state = "idle";
    render();
  }

  function resetCheck() {
    window.clearInterval(check.timer);
    check = { held: false, startedAt: 0, timer: null, passed: false };
  }

  function checkDown() {
    check.held = true;
    check.startedAt = Date.now();
    check.timer = window.setInterval(function () {
      if (Date.now() - check.startedAt >= HOLD_MS) {
        window.clearInterval(check.timer);
        check.timer = null;
        check.held = false;
        check.passed = true;
      }
      render();
    }, 100);
    render();
  }

  function checkUp() {
    if (!check.held) return;
    window.clearInterval(check.timer);
    check.timer = null;
    check.held = false;
    render();
  }

  // ------------------------------------------------------------------ rendering

  function setHidden(el, hidden) {
    if (el) el.hidden = hidden;
  }

  function renderPanel() {
    var e = effective(cfg);
    var locked = state === "locked";
    popover.setAttribute("data-state", state);
    desktop.classList.toggle("is-locked", locked);

    // header
    $("[data-pill-label]").textContent = locked ? t("Locked") : t("Ready");
    setHidden($("[data-pill-time]"), !locked);
    if (locked) $("[data-pill-time]").textContent = clock(elapsedSeconds());

    // power
    var power = $("[data-power]");
    power.setAttribute("aria-pressed", locked ? "true" : "false");
    power.setAttribute("aria-label", locked ? t("Unlock Keyboard") : t("Lock Keyboard"));

    // ready / waiting
    $("[data-caption]").textContent = e.blockMouseAndTrackpad
      ? t("Mouse and trackpad will be frozen too.")
      : t("Mouse and trackpad stay enabled.");
    if (state === "waiting") $("[data-wait-text]").textContent = t("Locking in %lld…", waitLeft);

    // locked
    var holdBox = $("[data-hold]");
    var progress = 0;
    var text = t("Hold Esc for 3 seconds to unlock.");
    var title = null;
    if (locked) {
      var seconds = lockedWith.autoUnlockSeconds;
      var unlocks = $("[data-unlocks]");
      setHidden(unlocks, seconds <= 0);
      if (seconds > 0) $("[data-unlocks-text]").textContent = t("Unlocks in %@", clock(seconds - elapsedSeconds()));
      title = clock(seconds > 0 ? seconds - elapsedSeconds() : elapsedSeconds());
      if (esc === "holding") {
        progress = Math.min(1, (Date.now() - escStartedAt) / HOLD_MS);
        text = t("Unlocking in %lld…", remainingHold());
        title = "Esc " + remainingHold();
      } else if (esc === "letGo") {
        progress = 1;
        text = t("Let go of Esc.");
        title = "Esc 0";
      }
    } else if (state === "waiting") {
      title = t("Locking in %lld…", waitLeft);
    }
    holdBox.classList.toggle("is-running", esc !== "idle");
    $("[data-hold-fill]").style.width = progress * 100 + "%";
    var holdText = $("[data-hold-text]");
    if (holdText.textContent !== text) holdText.textContent = text;

    // the status item
    var menubarTitle = desktop.querySelector("[data-menubar-title]");
    if (menubarTitle) {
      menubarTitle.hidden = title === null;
      if (title !== null && menubarTitle.textContent !== title) menubarTitle.textContent = title;
    }

    // confirmation
    if (state === "confirm") {
      $("[data-confirm-duration]").textContent = t(
        "The keyboard stays locked for %@ unless you unlock it sooner.",
        durationTitle(e.autoUnlockSeconds)
      );
      var needsCheck = requiresEscCheck(e);
      setHidden($("[data-esc-check]"), !needsCheck);
      setHidden($("[data-esc-progress]"), check.passed);
      setHidden($("[data-esc-done]"), !check.passed);
      $("[data-esc-fill]").style.width = (check.held ? Math.min(1, (Date.now() - check.startedAt) / HOLD_MS) * 100 : 0) + "%";
      var lockButton = $("[data-confirm-lock]");
      var blocked = needsCheck && !check.passed;
      lockButton.disabled = blocked;
      lockButton.setAttribute("aria-disabled", blocked ? "true" : "false");
    }
  }

  function renderSettings() {
    var advanced = cfg.mode === "advanced";
    $all("[data-seg=mode] [role=radio]").forEach(function (b) {
      b.setAttribute("aria-checked", b.dataset.value === cfg.mode ? "true" : "false");
    });
    $all("[data-seg=appearance] [role=radio]").forEach(function (b) {
      b.setAttribute("aria-checked", b.dataset.value === cfg.appearance ? "true" : "false");
    });
    setHidden($("[data-advanced]"), !advanced);
    $all("[data-switch]").forEach(function (b) {
      b.setAttribute("aria-checked", cfg[b.dataset.switch] ? "true" : "false");
    });
    var frozen = advanced && cfg.blockMouseAndTrackpad;
    setHidden($("[data-frozen-warning]"), !frozen);
    var note = $("[data-frozen-note]");
    setHidden(note, !frozen);
    if (frozen) {
      note.textContent = t(
        "With the mouse frozen, the lock lasts at most %@. Above %@, dirtymac asks you to hold Esc first to check your way out.",
        durationTitle(MAX_MOUSE_LOCK),
        durationTitle(ESC_CHECK_ABOVE)
      );
    }
    setHidden($("[data-check-row]"), !cfg.updateChecks);
    popover.setAttribute("data-scheme", cfg.appearance);
  }

  function fillSelect(select, options, value) {
    var key = options.map(function (o) { return o[0] + "=" + o[1]; }).join("|");
    if (select.dataset.key !== key) {
      select.dataset.key = key;
      select.textContent = "";
      options.forEach(function (o) {
        var option = document.createElement("option");
        option.value = o[0];
        option.textContent = o[1];
        select.appendChild(option);
      });
    }
    select.value = String(value);
  }

  function renderSelects() {
    var offered = offeredAutoUnlock(cfg.blockMouseAndTrackpad);
    fillSelect($("[data-select=autoUnlockSeconds]"), offered.map(function (s) {
      return [s, s === 0 ? t("Off") : durationTitle(s)];
    }), cfg.autoUnlockSeconds);
    fillSelect($("[data-select=startDelaySeconds]"), START_DELAY_CHOICES.map(function (s) {
      return [s, s === 0 ? t("Off") : durationTitle(s)];
    }), cfg.startDelaySeconds);
    fillSelect($("[data-select=language]"), [["system", t("System")]].concat(LANGUAGES.map(function (code) {
      return [code, catalog ? catalog.names[code] : code];
    })), cfg.language);
    fillSelect($("[data-select=hotKey]"), Object.keys(HOT_KEYS).map(function (key) {
      return [key, key === "off" ? t("Off") : HOT_KEYS[key]];
    }), cfg.hotKey);
  }

  function renderStatic() {
    $all("[data-t]").forEach(function (el) {
      el.textContent = t(el.dataset.t);
    });
    $("[data-open-settings]").setAttribute("aria-label", t("Settings"));
    $("[data-back]").setAttribute("aria-label", t("Back"));
    $("[data-seg=mode]").setAttribute("aria-label", t("Mode"));
    $("[data-seg=appearance]").setAttribute("aria-label", t("Appearance"));
    $("[data-select=language]").setAttribute("aria-label", t("Language"));
    document.documentElement.setAttribute("data-demo-language", languageCode);
  }

  function render() {
    renderPanel();
  }

  function renderAll() {
    languageCode = resolveLanguage();
    renderStatic();
    renderSelects();
    renderSettings();
    renderPanel();
  }

  // ------------------------------------------------------------------ the panel opening, closing, Settings

  function setView(next, from) {
    view = next;
    var main = $("[data-view-main]");
    var settings = $("[data-view-settings]");
    main.hidden = next !== "main";
    settings.hidden = next !== "settings";
    var shown = next === "main" ? main : settings;
    shown.removeAttribute("data-enter");
    void shown.offsetWidth; // restart the animation
    shown.setAttribute("data-enter", from);
  }

  function setPanel(open) {
    panelOpen = open;
    popover.hidden = !open;
    var glyph = desktop.querySelector("[data-glyph]");
    glyph.setAttribute("aria-expanded", open ? "true" : "false");
    // A confirmation left open does not wait for the next click.
    if (!open && state === "confirm") leaveConfirm();
  }

  function openSettings() {
    if (state === "confirm") leaveConfirm();
    setView("settings", "right");
    var back = $("[data-back]");
    if (back) back.focus({ preventScroll: true });
  }

  function closeSettings() {
    setView("main", "left");
    var gear = $("[data-open-settings]");
    if (gear) gear.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ events

  $("[data-power]").addEventListener("click", function (event) {
    powerTap();
    // Holding Esc afterwards would otherwise light the keyboard focus ring on a button
    // that was clicked with the mouse. A click by keyboard keeps its focus.
    if (event.detail > 0) event.currentTarget.blur();
  });

  $("[data-wait-cancel]").addEventListener("click", cancelWait);
  $("[data-confirm-cancel]").addEventListener("click", leaveConfirm);
  $("[data-confirm-lock]").addEventListener("click", function () {
    var verified = check.passed;
    resetCheck();
    state = "idle";
    beginLock(verified);
    render();
  });
  $("[data-open-settings]").addEventListener("click", openSettings);
  $("[data-back]").addEventListener("click", closeSettings);
  $("[data-quit]").addEventListener("click", function () {
    // Quitting releases the keyboard, like the app's own Quit.
    cancelWait();
    if (state === "locked") unlockedBy("quit");
    if (state === "confirm") leaveConfirm();
    setPanel(false);
  });

  desktop.querySelector("[data-glyph]").addEventListener("click", function () {
    setPanel(!panelOpen);
  });

  // Mode and Appearance
  $all("[data-seg] [role=radio]").forEach(function (button) {
    button.addEventListener("click", function () {
      var group = button.closest("[data-seg]").dataset.seg;
      cfg[group] = button.dataset.value;
      if (group === "mode") cfg.autoUnlockSeconds = clampedSeconds(cfg.autoUnlockSeconds, effective(cfg).blockMouseAndTrackpad);
      save();
      renderAll();
    });
  });

  // Switches
  $all("[data-switch]").forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.dataset.switch;
      cfg[key] = !cfg[key];
      if (key === "blockMouseAndTrackpad") {
        // Mouse lockdown removes the click-to-unlock exit, so the timer is forced into 30 s to 15 min.
        cfg.autoUnlockSeconds = clampedSeconds(cfg.autoUnlockSeconds, cfg[key]);
      }
      if (key === "updateChecks" && cfg[key]) runUpdateCheck();
      save();
      renderAll();
    });
  });

  // Pop-up menus
  $all("[data-select]").forEach(function (select) {
    select.addEventListener("change", function () {
      var key = select.dataset.select;
      var value = select.value;
      cfg[key] = key === "autoUnlockSeconds" || key === "startDelaySeconds" ? Number(value) : value;
      if (key === "autoUnlockSeconds") cfg[key] = clampedSeconds(cfg[key], effective(cfg).blockMouseAndTrackpad);
      save();
      renderAll();
    });
  });

  // The update check is simulated: this page makes no network request of its own.
  var checkTimer = null;
  function runUpdateCheck() {
    var status = $("[data-check-status]");
    status.textContent = t("Checking…");
    window.clearTimeout(checkTimer);
    checkTimer = window.setTimeout(function () {
      status.textContent = t("dirtymac is up to date.");
    }, 900);
  }
  $("[data-check-now]").addEventListener("click", runUpdateCheck);

  // Esc: the exit of a running lock, and the check before a long frozen-mouse lock.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !event.repeat) {
      if (state === "locked" && esc === "idle") {
        escDown();
        return;
      }
      if (state === "confirm" && panelOpen && view === "main" && requiresEscCheck(effective(cfg)) && !check.passed && !check.held) {
        event.preventDefault();
        checkDown();
        return;
      }
    }
    // The global shortcut opens and closes the panel from anywhere on the page.
    if (cfg.hotKey !== "off" && event.metaKey && event.altKey && event.code === "Key" + (cfg.hotKey.slice(-1))) {
      var wantsShift = cfg.hotKey === "optShiftCmdK";
      if (event.shiftKey === wantsShift && event.ctrlKey === !wantsShift) {
        event.preventDefault();
        setPanel(!panelOpen);
      }
    }
  });

  document.addEventListener("keyup", function (event) {
    if (event.key !== "Escape") return;
    if (state === "locked") {
      if (esc === "letGo") unlockedBy("escHeld");
      else if (esc === "holding") {
        cancelEsc();
        render();
      }
    } else if (state === "confirm") {
      checkUp();
    }
  });

  // ------------------------------------------------------------------ start

  setView("main", "left");
  popover.removeAttribute("data-enter");
  $("[data-view-main]").removeAttribute("data-enter");
  renderAll();

  var request = new XMLHttpRequest();
  request.open("GET", "strings.json");
  request.onload = function () {
    if (request.status !== 200) return;
    try { catalog = JSON.parse(request.responseText); } catch (e) { return; }
    renderAll();
  };
  request.send();
})();
