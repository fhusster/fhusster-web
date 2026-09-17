/* Dad Reflex game page.
   Two jobs: point the store buttons at the listing, and hold the hero reel
   back until it is actually on screen. */
(function () {
  "use strict";

  /* TODO: paste the real App Store listing URL here when the listing is live,
     e.g. "https://apps.apple.com/app/dad-reflex/id0000000000". Leave it as an
     empty string until then and the buttons say so rather than lying. */
  var APP_STORE_URL = "";

  /* ---- store buttons -------------------------------------------------- */
  var buttons = document.querySelectorAll("[data-app-store]");
  Array.prototype.forEach.call(buttons, function (btn) {
    if (APP_STORE_URL) {
      btn.setAttribute("href", APP_STORE_URL);
      btn.setAttribute("rel", "noopener");
      return;
    }
    /* No link yet: keep the button in the layout but make it honest and
       keep it out of the tab order, rather than sending anyone to "#". */
    btn.removeAttribute("href");
    btn.setAttribute("role", "link");
    btn.setAttribute("aria-disabled", "true");
    btn.style.opacity = ".55";
    btn.style.cursor = "default";
    btn.title = "App Store link coming shortly";
  });

  /* ---- the hero reel, loaded on demand -------------------------------- */
  var reel = document.getElementById("dr-hero-reel");
  if (!reel) return;

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  /* Reduced motion gets the poster and a play button, never a loop that
     starts on its own. */
  if (reduced) {
    reel.setAttribute("controls", "");
    reel.removeAttribute("loop");
  }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    [["data-src-webm", "video/webm"], ["data-src-mp4", "video/mp4"]].forEach(function (pair) {
      var src = reel.getAttribute(pair[0]);
      if (!src) return;
      var s = document.createElement("source");
      s.src = src;
      s.type = pair[1];
      reel.appendChild(s);
    });
    reel.load();
    if (!reduced) {
      var p = reel.play();
      /* Safari rejects the promise if the tab is backgrounded. The poster
         stays up; nothing to do about it and nothing to log. */
      if (p && p.catch) p.catch(function () {});
    }
  }

  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.disconnect();
      load();
    });
  }, { rootMargin: "200px" });
  io.observe(reel);
})();
