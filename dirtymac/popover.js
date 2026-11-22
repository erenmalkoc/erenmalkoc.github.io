/* dirtymac — the interactive menu bar panel on the product page.
   It behaves like the app: the power button locks and releases, the status
   pill counts the time while locked, and holding Esc for three seconds
   releases the lock, as in the real app. Nothing here blocks your keyboard. */

(function () {
  "use strict";

  var popover = document.querySelector("[data-popover]");
  if (!popover) return;

  var power = popover.querySelector("[data-power]");
  var headline = popover.querySelector("[data-headline]");
  var caption = popover.querySelector("[data-caption]");
  var label = popover.querySelector("[data-pill-label]");
  var time = popover.querySelector("[data-pill-time]");
  var desktop = popover.closest(".desktop");

  var locked = false;
  var startedAt = 0;
  var ticker = null;
  var escTimer = null;

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function elapsed() {
    var seconds = Math.floor((Date.now() - startedAt) / 1000);
    return pad(Math.floor(seconds / 60)) + ":" + pad(seconds % 60);
  }

  function render() {
    popover.classList.toggle("is-locked", locked);
    power.setAttribute("aria-pressed", locked ? "true" : "false");
    power.setAttribute("aria-label", locked ? "Unlock Keyboard" : "Lock Keyboard");
    headline.textContent = locked ? "Cleaning Mode Active" : "Click to Lock Keyboard";
    caption.textContent = locked
      ? "Hold Esc for 3 seconds to unlock."
      : "Mouse and trackpad stay enabled.";
    label.textContent = locked ? "Locked" : "Ready";
    time.hidden = !locked;
    if (desktop) desktop.classList.toggle("is-locked", locked);
  }

  function lock() {
    locked = true;
    startedAt = Date.now();
    time.textContent = "00:00";
    ticker = window.setInterval(function () {
      time.textContent = elapsed();
    }, 1000);
    render();
  }

  function unlock() {
    locked = false;
    window.clearInterval(ticker);
    ticker = null;
    render();
  }

  power.addEventListener("click", function () {
    if (locked) unlock();
    else lock();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || event.repeat || !locked || escTimer !== null) return;
    escTimer = window.setTimeout(function () {
      escTimer = null;
      unlock();
    }, 3000);
  });

  document.addEventListener("keyup", function (event) {
    if (event.key === "Escape" && escTimer !== null) {
      window.clearTimeout(escTimer);
      escTimer = null;
    }
  });

  render();
})();
