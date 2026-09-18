/* Dad Reflex store links. Shared video behaviour lives in site.js. */
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

})();
