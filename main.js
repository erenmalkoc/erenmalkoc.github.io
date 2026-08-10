/* erenium.tech — shared behaviour for the landing page and product pages. */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- theme -------------------------------------------------------------
     The stored preference is applied by the inline script in <head> so the
     page never flashes the wrong scheme; here we only wire up the toggle. */

  function currentTheme() {
    var stored = document.documentElement.getAttribute("data-theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function syncToggleIcon(button) {
    var icon = button.querySelector(".material-symbols-outlined");
    if (icon) icon.textContent = currentTheme() === "dark" ? "light_mode" : "dark_mode";
  }

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    syncToggleIcon(themeToggle);
    themeToggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (err) {
        /* private mode — the choice just won't survive a reload */
      }
      syncToggleIcon(themeToggle);
    });
  }

  /* --- app bar ----------------------------------------------------------- */

  var appBar = document.getElementById("appBar");
  if (appBar) {
    var updateBar = function () {
      appBar.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    updateBar();
    window.addEventListener("scroll", updateBar, { passive: true });
  }

  /* --- greeting cycler ---------------------------------------------------
     Without JS — or with reduced motion — all four greetings stay visible
     side by side, so nobody has to wait for a rotation to read them. */

  var hello = document.getElementById("hello");
  var chips = document.querySelectorAll("#langs .chip");

  if (hello && !reduceMotion.matches) {
    var words = hello.querySelectorAll(".hello__word");
    var index = 0;
    var timer = null;
    var INTERVAL = 2600;

    hello.classList.add("is-cycling");

    function show(next) {
      index = (next + words.length) % words.length;
      for (var i = 0; i < words.length; i++) {
        words[i].classList.toggle("is-active", i === index);
      }
      for (var j = 0; j < chips.length; j++) {
        chips[j].setAttribute("aria-pressed", j === index ? "true" : "false");
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

    show(0);
    start();

    for (var c = 0; c < chips.length; c++) {
      (function (position, chip) {
        chip.addEventListener("click", function () {
          show(position);
          start();
        });
      })(c, chips[c]);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });
  } else if (chips.length) {
    /* Static fallback: the chips describe the greetings rather than switch them. */
    for (var k = 0; k < chips.length; k++) {
      chips[k].setAttribute("aria-pressed", "true");
      chips[k].disabled = true;
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
