/* Outbound links the studio has not published yet: the App Store listing, the
   public TestFlight invite, and the tip page.

   Fill a constant below and every button carrying that name becomes a real
   link, opening in a new tab. Leave it empty and the button stays where it is
   in the layout but tells the truth — no href, not announced as a live link,
   dimmed, and it does not press when hovered — instead of sending anyone to
   "#", which looks like a working button and goes nowhere. */
(function () {
  "use strict";

  var LINKS = {
    /* The listing URL, e.g. https://apps.apple.com/app/dad-reflex/id000000000 */
    "app-store": "",
    /* App Store Connect > TestFlight > the tester group > Enable Public Link */
    "testflight": "",
    /* Whatever the studio collects with: a Ko-fi page, a PayPal.me handle,
       a Stripe payment link. Any URL works; it is only ever a link. */
    "tip": "https://ko-fi.com/fhussterdev"
  };

  var PENDING = {
    "app-store": "App Store link coming shortly",
    "testflight": "TestFlight invite opens shortly",
    "tip": "Tips open shortly"
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-link]"), function (node) {
    var name = node.getAttribute("data-link");
    var url = LINKS[name];
    if (url) {
      node.setAttribute("href", url);
      node.setAttribute("rel", "noopener noreferrer");
      if (/^https?:/i.test(url)) node.setAttribute("target", "_blank");
      node.removeAttribute("aria-disabled");
      node.classList.remove("btn--pending");
      return;
    }
    node.removeAttribute("href");
    node.setAttribute("role", "link");
    node.setAttribute("aria-disabled", "true");
    node.classList.add("btn--pending");
    node.title = PENDING[name] || "Coming shortly";
  });
})();
