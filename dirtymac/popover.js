/* dirtymac — the interactive menu bar panel on the product page.
   It behaves like the app (1.4.0): the power button locks, the status pill and
   the menu bar count the time, and holding Esc for three seconds counts down
   "Unlocking in 3…", then asks to let go of the key, which unlocks. Letting go
   early starts over. Nothing here blocks your keyboard. */

(function () {
  "use strict";

  var popover = document.querySelector("[data-popover]");
  if (!popover) return;

  var HOLD_MS = 3000; // KeyboardBlocker.escHoldDuration
  var GRACE_MS = 1500; // KeyboardBlocker.escReleaseGrace: a lost key-up cannot keep the lock on

  var power = popover.querySelector("[data-power]");
  var headline = popover.querySelector("[data-headline]");
  var caption = popover.querySelector("[data-caption]");
  var hold = popover.querySelector("[data-hold]");
  var holdFill = popover.querySelector("[data-hold-fill]");
  var holdText = popover.querySelector("[data-hold-text]");
  var label = popover.querySelector("[data-pill-label]");
  var time = popover.querySelector("[data-pill-time]");
  var desktop = popover.closest(".desktop");
  var menubarTitle = desktop && desktop.querySelector("[data-menubar-title]");

  var locked = false;
  var startedAt = 0;
  var ticker = null;

  // The Esc hold: idle, holding (counting down) or letGo (held long enough,
  // the unlock finishes when the key comes up).
  var esc = "idle";
  var escStartedAt = 0;
  var escTimer = null;
  var graceTimer = null;

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function clock(seconds) {
    return pad(Math.floor(seconds / 60)) + ":" + pad(seconds % 60);
  }

  function elapsedSeconds() {
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  // Whole seconds still to hold: 3 at the start, 1 for the last stretch.
  function remaining() {
    var left = Math.ceil((HOLD_MS - (Date.now() - escStartedAt)) / 1000);
    return Math.min(3, Math.max(1, left));
  }

  function render() {
    popover.classList.toggle("is-locked", locked);
    power.setAttribute("aria-pressed", locked ? "true" : "false");
    power.setAttribute("aria-label", locked ? "Unlock Keyboard" : "Lock Keyboard");
    headline.textContent = locked ? "Cleaning Mode Active" : "Click to Lock Keyboard";
    caption.hidden = locked;
    hold.hidden = !locked;
    label.textContent = locked ? "Locked" : "Ready";
    time.hidden = !locked;
    if (desktop) desktop.classList.toggle("is-locked", locked);

    var progress = 0;
    var text = "Hold Esc for 3 seconds to unlock.";
    var title = clock(elapsedSeconds());
    if (esc === "holding") {
      progress = Math.min(1, (Date.now() - escStartedAt) / HOLD_MS);
      text = "Unlocking in " + remaining() + "…";
      title = "Esc " + remaining();
    } else if (esc === "letGo") {
      progress = 1;
      text = "Let go of Esc.";
      title = "Esc 0";
    }
    hold.classList.toggle("is-running", esc !== "idle");
    holdFill.style.width = progress * 100 + "%";
    if (holdText.textContent !== text) holdText.textContent = text;
    if (menubarTitle) {
      menubarTitle.hidden = !locked;
      if (menubarTitle.textContent !== title) menubarTitle.textContent = title;
    }
    if (locked) time.textContent = clock(elapsedSeconds());
  }

  function cancelEsc() {
    window.clearInterval(escTimer);
    window.clearTimeout(graceTimer);
    escTimer = null;
    graceTimer = null;
    esc = "idle";
  }

  function lock() {
    locked = true;
    startedAt = Date.now();
    ticker = window.setInterval(render, 250);
    render();
  }

  function unlock() {
    locked = false;
    cancelEsc();
    window.clearInterval(ticker);
    ticker = null;
    render();
  }

  function escDown() {
    esc = "holding";
    escStartedAt = Date.now();
    escTimer = window.setInterval(function () {
      if (Date.now() - escStartedAt >= HOLD_MS) {
        window.clearInterval(escTimer);
        escTimer = null;
        esc = "letGo";
        graceTimer = window.setTimeout(unlock, GRACE_MS);
      }
      render();
    }, 100);
    render();
  }

  power.addEventListener("click", function (event) {
    if (locked) unlock();
    else lock();
    // Holding Esc afterwards would otherwise light the keyboard focus ring on
    // a button that was clicked with the mouse. A click by keyboard (Enter or
    // Space, which report no pointer) keeps its focus.
    if (event.detail > 0) power.blur();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || event.repeat || !locked || esc !== "idle") return;
    escDown();
  });

  document.addEventListener("keyup", function (event) {
    if (event.key !== "Escape" || !locked) return;
    if (esc === "letGo") {
      unlock();
    } else if (esc === "holding") {
      cancelEsc();
      render();
    }
  });

  render();
})();
