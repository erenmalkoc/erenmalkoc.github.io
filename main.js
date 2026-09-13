/* erenium.tech — shared behaviour for the landing page and product pages. */

(function () {
  "use strict";

  /* --- language swap -----------------------------------------------------
     Every .swap element holds the same list of translations in the same order,
     and they all advance together so the page never mixes two languages.
     The rotation runs even under prefers-reduced-motion — the stylesheet drops
     it to a plain crossfade there instead of sliding. Without JS all variants
     stay visible side by side. */

  var swaps = document.querySelectorAll(".swap");

  if (swaps.length) {
    var groups = [];
    var count = 0;

    for (var s = 0; s < swaps.length; s++) {
      var group = swaps[s].querySelectorAll(".swap__word");
      if (!group.length) continue;
      swaps[s].classList.add("is-cycling");
      groups.push(group);
      count = Math.max(count, group.length);
    }

    var index = 0;
    var timer = null;
    var INTERVAL = 2600;

    function show(next) {
      index = (next + count) % count;
      for (var g = 0; g < groups.length; g++) {
        var words = groups[g];
        /* A shorter list just holds its last entry rather than going blank. */
        var active = Math.min(index, words.length - 1);
        for (var i = 0; i < words.length; i++) {
          words[i].classList.toggle("is-active", i === active);
        }
      }
    }

    function start() {
      stop();
      timer = window.setInterval(function () {
        show(index + 1);
      }, INTERVAL);
    }

    function stop() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    if (count > 0) {
      show(0);
      start();

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop();
        else start();
      });
    }
  }

  /* --- copy buttons + snackbar ------------------------------------------- */

  var snackbar = document.getElementById("snackbar");
  var snackTimer = null;

  function notify(message) {
    if (!snackbar) return;
    snackbar.textContent = message;
    snackbar.classList.add("is-visible");
    if (snackTimer !== null) window.clearTimeout(snackTimer);
    snackTimer = window.setTimeout(function () {
      snackbar.classList.remove("is-visible");
    }, 2400);
  }

  var copyButtons = document.querySelectorAll("[data-copy]");
  for (var b = 0; b < copyButtons.length; b++) {
    (function (button) {
      button.addEventListener("click", function () {
        var text = button.getAttribute("data-copy");
        if (!navigator.clipboard) {
          notify("Copying isn't available in this browser");
          return;
        }
        navigator.clipboard.writeText(text).then(
          function () {
            notify("Copied to clipboard");
          },
          function () {
            notify("Couldn't copy — select the command manually");
          }
        );
      });
    })(copyButtons[b]);
  }
})();

/* Footer year — keeps the copyright current without a redeploy. */
(function () {
  "use strict";

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
