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
  var MAX_MOUSE_LOCK = 24 * 60 * 60; // LockConfiguration.maxMouseLockSeconds: a day since 1.4.7 (it was 15 min)
  var ESC_CHECK_ABOVE = 5 * 60; // LockConfiguration.escCheckAboveSeconds
  var AUTO_UNLOCK_CHOICES = [0, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 43200, 86400];
  var MAX_AUTO_UNLOCK = 24 * 60 * 60; // LockConfiguration.maxAutoUnlockSeconds: a day
  var LONG_LOCK_ABOVE = 60 * 60; // LockConfiguration.longLockAboveSeconds: more asks first
  var MIN_CUSTOM = 60; // AutoUnlockEntry.minCustomSeconds
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
    autoUnlockAtMinutes: -1, // "Until 17:30" in minutes after midnight, -1 for a length
    autoUnlockCustom: false,
    keepDisplayAwake: true,
    guardPointer: true,
    suppressGestures: true,
    startDelaySeconds: 0,
    playSounds: true,
    appearance: "system",
    // English first, like the page: the demo does not follow the browser unless "System" is
    // picked in Settings. Every one of the app's 17 languages stays on offer there.
    language: "en",
    hotKey: "ctrlOptCmdK",
    openAtLogin: false,
    updateChecks: false
  };

  // -v2: the first version stored "System" as the language, which made the demo open in the
  // visitor's browser language. Starting over puts everyone on English.
  var STORAGE_KEY = "dirtymac-demo-settings-v2";
  // The page's language picker and this panel's share one language (see i18n.js).
  var SHARED_LANGUAGE_KEY = "dirtymac-language";
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
    if (out.language !== "system" && LANGUAGES.indexOf(out.language) < 0) out.language = "en";
    // The language the visitor picked on the page, or in the panel earlier, wins.
    try {
      var shared = window.localStorage.getItem(SHARED_LANGUAGE_KEY);
      if (LANGUAGES.indexOf(shared) >= 0) out.language = shared;
    } catch (e) { /* private mode */ }
    // None, or anything from 30 seconds to a day: a length entered by hand is not on the list.
    if (!(out.autoUnlockSeconds === 0 || (out.autoUnlockSeconds >= 30 && out.autoUnlockSeconds <= MAX_AUTO_UNLOCK))) out.autoUnlockSeconds = 0;
    if (!(out.autoUnlockAtMinutes >= 0 && out.autoUnlockAtMinutes < 24 * 60)) out.autoUnlockAtMinutes = -1;
    out.autoUnlockSeconds = clampedSeconds(out.autoUnlockSeconds, out.mode === "advanced" && out.blockMouseAndTrackpad);
    if (START_DELAY_CHOICES.indexOf(out.startDelaySeconds) < 0) out.startDelaySeconds = 0;
    return out;
  }

  function save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  }

  // Once the mouse is part of the lock the menu bar can no longer be clicked, so the
  // timer is never off and never shorter than 30 s (and, like every lock, at most a day).
  function clampedSeconds(seconds, mouseLocked) {
    return mouseLocked ? Math.min(Math.max(seconds, MIN_MOUSE_LOCK), MAX_MOUSE_LOCK) : seconds;
  }

  // LockConfiguration.effective: Basic is a fixed safe preset of keys and mouse. It keeps the
  // timer the person chose (the mouse is free, so any length is safe).
  function effective(c) {
    // "Until 17:30" is worked out now, so it is always the next 17:30.
    var seconds = c.autoUnlockAtMinutes >= 0 ? secondsUntil(c.autoUnlockAtMinutes, new Date()) : c.autoUnlockSeconds;
    if (c.mode !== "advanced") {
      return {
        blockMouseAndTrackpad: false,
        autoUnlockSeconds: seconds === 0 || (seconds >= 30 && seconds <= MAX_AUTO_UNLOCK) ? seconds : 0,
        startDelaySeconds: c.startDelaySeconds
      };
    }
    var length;
    if (c.blockMouseAndTrackpad) {
      length = clampedSeconds(seconds, true);
    } else {
      length = Math.min(Math.max(seconds, 0), MAX_AUTO_UNLOCK);
    }
    return {
      blockMouseAndTrackpad: c.blockMouseAndTrackpad,
      autoUnlockSeconds: length,
      startDelaySeconds: c.startDelaySeconds
    };
  }

  // LockConfiguration.secondsUntil: the next time the clock reads that, never under 30 s, never over a day.
  function secondsUntil(minutesOfDay, now) {
    var minutes = Math.min(Math.max(minutesOfDay, 0), 24 * 60 - 1);
    var target = new Date(now.getTime());
    target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    var seconds = Math.ceil((target.getTime() - now.getTime()) / 1000);
    return Math.min(Math.max(seconds, MIN_MOUSE_LOCK), MAX_AUTO_UNLOCK);
  }

  // LockConfiguration.requiresLongLockConfirm
  function requiresLongLock(e) {
    return !e.blockMouseAndTrackpad && e.autoUnlockSeconds > LONG_LOCK_ABOVE;
  }

  // What the pop-up shows (AutoUnlockEntry.selection): the length the lock will use, or "custom".
  function timerSelection() {
    var frozen = effective(cfg).blockMouseAndTrackpad;
    var used = frozen ? clampedSeconds(cfg.autoUnlockSeconds, true) : cfg.autoUnlockSeconds;
    if (cfg.autoUnlockCustom || cfg.autoUnlockAtMinutes >= 0 || AUTO_UNLOCK_CHOICES.indexOf(used) < 0) return "custom";
    return used;
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

  // "30 sec", "1 hr", "8 hr 30 min": every unit that is not zero, like the app's Duration style.
  function durationTitle(seconds) {
    var parts = [];
    var rest = Math.max(0, Math.round(seconds));
    [["hour", 3600, " h"], ["minute", 60, " min"], ["second", 1, " s"]].forEach(function (u) {
      var value = Math.floor(rest / u[1]);
      rest -= value * u[1];
      if (value > 0) {
        try {
          parts.push(new Intl.NumberFormat(languageCode, { style: "unit", unit: u[0], unitDisplay: "short" }).format(value));
        } catch (e) {
          parts.push(value + u[2]);
        }
      }
    });
    return parts.join(" ") || "0";
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  // LockStatusTitle.clock: 05:07, and 1:15:10 from an hour on.
  function clock(seconds) {
    var s = Math.max(0, seconds);
    if (s >= 3600) return Math.floor(s / 3600) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }

  // AutoUnlockEntry.endTitle: "11:30 PM", or "Wed 7:00 AM" when it is not today.
  function endTitle(end, now) {
    var sameDay = end.toDateString() === now.toDateString();
    var options = sameDay ? { hour: "numeric", minute: "2-digit" } : { weekday: "short", hour: "numeric", minute: "2-digit" };
    try { return new Intl.DateTimeFormat(languageCode, options).format(end); } catch (e) { return end.toLocaleTimeString(); }
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
    else if (requiresLongLock(effective(cfg))) enterLongConfirm();
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
    if (state === "confirm" || state === "confirmLong") state = "idle";
    render();
  }

  // MainView.longLockConfirm: a lock of many hours says when it ends before it starts.
  function enterLongConfirm() {
    state = "confirmLong";
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

  // ------------------------------------------------------------------ the timer entry box (AutoUnlockControl)

  var boxes = [];

  // One box per place the timer is shown (the panel, Basic and Advanced Settings), built once.
  function buildTimerBox(host) {
    var box = { host: host };
    host.innerHTML =
      '<div class="seg seg--small" role="radiogroup">' +
      '<button type="button" role="radio" data-kind="length"></button>' +
      '<button type="button" role="radio" data-kind="clock"></button></div>' +
      '<div class="timerbox__fields" data-fields-length>' +
      '<label class="timerbox__field"><input type="number" min="0" max="24" step="1" inputmode="numeric" data-hours><span data-hours-unit></span></label>' +
      '<label class="timerbox__field"><input type="number" min="0" max="59" step="1" inputmode="numeric" data-minutes><span data-minutes-unit></span></label></div>' +
      '<div class="timerbox__fields" data-fields-clock><input type="time" step="60" data-time></div>' +
      '<p class="timerbox__end" data-end></p>';
    box.seg = host.querySelector(".seg");
    box.lengthButton = host.querySelector("[data-kind=length]");
    box.clockButton = host.querySelector("[data-kind=clock]");
    box.lengthFields = host.querySelector("[data-fields-length]");
    box.clockFields = host.querySelector("[data-fields-clock]");
    box.hours = host.querySelector("[data-hours]");
    box.minutes = host.querySelector("[data-minutes]");
    box.time = host.querySelector("[data-time]");
    box.end = host.querySelector("[data-end]");

    function commitLength() {
      var h = Math.min(Math.max(parseInt(box.hours.value, 10) || 0, 0), 24);
      var m = h === 24 ? 0 : Math.min(Math.max(parseInt(box.minutes.value, 10) || 0, 0), 59);
      cfg.autoUnlockSeconds = Math.min(Math.max(h * 3600 + m * 60, MIN_CUSTOM), MAX_AUTO_UNLOCK);
      cfg.autoUnlockCustom = true;
      save();
      renderTimerBoxes(false);
      renderPanel();
    }
    box.hours.addEventListener("input", commitLength);
    box.minutes.addEventListener("input", commitLength);
    box.hours.addEventListener("change", function () { renderAll(); });
    box.minutes.addEventListener("change", function () { renderAll(); });
    box.time.addEventListener("input", function () {
      var match = /^(\d{1,2}):(\d{2})/.exec(box.time.value);
      if (!match) return;
      cfg.autoUnlockAtMinutes = Math.min(parseInt(match[1], 10), 23) * 60 + Math.min(parseInt(match[2], 10), 59);
      cfg.autoUnlockCustom = true;
      save();
      renderTimerBoxes(false);
      renderPanel();
    });
    // AutoUnlockEntry.switchedToClock / switchedToLength
    box.lengthButton.addEventListener("click", function () {
      if (cfg.autoUnlockAtMinutes < 0) return;
      var seconds = Math.floor(secondsUntil(cfg.autoUnlockAtMinutes, new Date()) / 60) * 60;
      cfg.autoUnlockSeconds = Math.min(Math.max(seconds, MIN_CUSTOM), MAX_AUTO_UNLOCK);
      cfg.autoUnlockAtMinutes = -1;
      cfg.autoUnlockCustom = true;
      save();
      renderAll();
    });
    box.clockButton.addEventListener("click", function () {
      if (cfg.autoUnlockAtMinutes >= 0) return;
      var end = new Date(Date.now() + Math.max(cfg.autoUnlockSeconds, MIN_CUSTOM) * 1000);
      cfg.autoUnlockAtMinutes = end.getHours() * 60 + end.getMinutes();
      cfg.autoUnlockCustom = true;
      save();
      renderAll();
    });
    return box;
  }

  function renderTimerBoxes(frozen) {
    var shown = timerSelection() === "custom";
    $all("[data-timer-box]").forEach(function (host, i) {
      if (!boxes[i]) boxes[i] = buildTimerBox(host);
      var box = boxes[i];
      host.hidden = !shown;
      if (!shown) return;
      var clockMode = cfg.autoUnlockAtMinutes >= 0;
      box.lengthButton.textContent = t("For");
      box.clockButton.textContent = t("Until");
      box.lengthButton.setAttribute("aria-checked", clockMode ? "false" : "true");
      box.clockButton.setAttribute("aria-checked", clockMode ? "true" : "false");
      box.lengthFields.hidden = clockMode;
      box.clockFields.hidden = !clockMode;
      box.hours.setAttribute("aria-label", t("Hours"));
      box.minutes.setAttribute("aria-label", t("Minutes"));
      box.time.setAttribute("aria-label", t("Until"));
      var hm = [Math.floor(cfg.autoUnlockSeconds / 3600), Math.floor((cfg.autoUnlockSeconds % 3600) / 60)];
      // Never rewritten while it is being typed in.
      if (document.activeElement !== box.hours) box.hours.value = hm[0];
      if (document.activeElement !== box.minutes) box.minutes.value = hm[1];
      box.hours.nextElementSibling.textContent = durationUnit(hm[0], "hour");
      box.minutes.nextElementSibling.textContent = durationUnit(hm[1], "minute");
      if (document.activeElement !== box.time) {
        var at = Math.max(cfg.autoUnlockAtMinutes, 0);
        box.time.value = pad(Math.floor(at / 60)) + ":" + pad(at % 60);
      }
      var now = new Date();
      var seconds = clockMode ? secondsUntil(cfg.autoUnlockAtMinutes, now) : cfg.autoUnlockSeconds;
      box.end.textContent = seconds > 0 ? t("Unlocks at %@", endTitle(new Date(now.getTime() + seconds * 1000), now)) : "";
    });
  }

  // "hr" / "min" next to a number field, in the language of the page.
  function durationUnit(value, unit) {
    try {
      var parts = new Intl.NumberFormat(languageCode, { style: "unit", unit: unit, unitDisplay: "short" }).formatToParts(value);
      return parts.filter(function (p) { return p.type === "unit"; }).map(function (p) { return p.value; }).join("");
    } catch (e) {
      return unit === "hour" ? "h" : "min";
    }
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

    // the long lock confirmation
    if (state === "confirmLong") {
      var now = new Date();
      var end = new Date(now.getTime() + e.autoUnlockSeconds * 1000);
      $("[data-long-text]").textContent = t(
        "The keyboard stays locked for %@, until %@, unless you unlock it sooner.",
        durationTitle(e.autoUnlockSeconds),
        endTitle(end, now)
      );
      setHidden($("[data-long-awake]"), !cfg.keepDisplayAwake);
    }

    // confirmation
    if (state === "confirm") {
      $("[data-confirm-duration]").textContent = t(
        "The keyboard stays locked for %@ unless you unlock it sooner.",
        durationTitle(e.autoUnlockSeconds)
      );
      setHidden($("[data-confirm-awake]"), !(e.autoUnlockSeconds > LONG_LOCK_ABOVE && cfg.keepDisplayAwake));
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
    setHidden($("[data-basic-timer]"), advanced);
    $all("[data-switch]").forEach(function (b) {
      b.setAttribute("aria-checked", cfg[b.dataset.switch] ? "true" : "false");
    });
    var frozen = advanced && cfg.blockMouseAndTrackpad;
    setHidden($("[data-frozen-warning]"), !frozen);
    var note = $("[data-frozen-note]");
    setHidden(note, !frozen);
    if (frozen) {
      note.textContent = t(
        "With the mouse frozen, the lock always ends by itself. Above %@, dirtymac asks you to hold Esc first to check your way out.",
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
    // The panel, Basic Settings and Advanced Settings all show the one setting. Only a
    // frozen mouse holds lengths back, and only Advanced can freeze it.
    var frozen = effective(cfg).blockMouseAndTrackpad;
    var offered = offeredAutoUnlock(frozen);
    $all("[data-select=autoUnlockSeconds]").forEach(function (select) {
      var options = offered.map(function (s) {
        return [s, s === 0 ? t("Off") : durationTitle(s)];
      });
      // "Custom…" opens the box for any length or a time of day, with the mouse frozen too.
      options.push(["custom", t("Custom…")]);
      fillSelect(select, options, timerSelection());
    });
    renderTimerBoxes(frozen);
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
  $("[data-long-cancel]").addEventListener("click", leaveConfirm);
  $("[data-long-lock]").addEventListener("click", function () {
    state = "idle";
    beginLock(false);
    render();
  });
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
        // Mouse lockdown removes the click-to-unlock exit, so the timer is never off and at least 30 s.
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
      if (key === "autoUnlockSeconds") {
        // AutoUnlockEntry.choosing: "Custom…" keeps the length (an hour if there was none), a list entry ends any entry.
        if (value === "custom") {
          cfg.autoUnlockCustom = true;
          if (cfg.autoUnlockAtMinutes < 0 && cfg.autoUnlockSeconds < MIN_CUSTOM) cfg.autoUnlockSeconds = 3600;
        } else {
          cfg.autoUnlockSeconds = Number(value);
          cfg.autoUnlockAtMinutes = -1;
          cfg.autoUnlockCustom = false;
        }
        cfg.autoUnlockSeconds = clampedSeconds(cfg.autoUnlockSeconds, effective(cfg).blockMouseAndTrackpad);
        save();
        renderAll();
        return;
      }
      cfg[key] = key === "startDelaySeconds" ? Number(value) : value;
      save();
      renderAll();
      if (key === "language") {
        // The page follows the panel (the language "System" is whatever the browser speaks).
        try { window.localStorage.setItem(SHARED_LANGUAGE_KEY, languageCode); } catch (e) { /* private mode */ }
        document.dispatchEvent(new CustomEvent("dirtymac-language", { detail: { code: languageCode, source: "demo" } }));
      }
    });
  });

  // The page's language picker changed: the panel follows.
  document.addEventListener("dirtymac-language", function (event) {
    var detail = event.detail || {};
    if (detail.source === "demo" || LANGUAGES.indexOf(detail.code) < 0 || detail.code === languageCode) return;
    cfg.language = detail.code;
    save();
    renderAll();
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
