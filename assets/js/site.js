/* Fhusster — shared site behaviour (mobile nav, logo reveal). */

/* Header logo: same `extend` reveal as the CSS fallback, but driven with the
   Web Animations API so leaving the logo rewinds the letters from wherever
   they currently are (same speed, stagger played backwards) instead of
   snapping them away. Every letter shares one end time via endDelay, so a
   single reverse() rewinds the whole staggered sequence in sync. */
(function () {
  if (!("animate" in Element.prototype)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  Array.prototype.forEach.call(document.querySelectorAll(".logo"), function (logo) {
    var letters = logo.querySelectorAll(".hletter");
    if (!letters.length) return;

    logo.classList.add("js-reveal");

    var anims = null;
    var hovered = false;
    var focused = false;

    function build() {
      var slide = -0.030 * logo.getBoundingClientRect().width;
      var ease = "cubic-bezier(.25,.7,.2,1)";
      var delays = Array.prototype.map.call(letters, function (el) {
        return (parseFloat(getComputedStyle(el).getPropertyValue("--d")) || 0) * 1000;
      });
      var maxDelay = Math.max.apply(null, delays);
      anims = Array.prototype.map.call(letters, function (el, i) {
        return el.animate(
          [
            { opacity: 0, transform: "translateX(" + slide + "px)", easing: ease },
            { opacity: 1, offset: 0.4, easing: ease },
            { opacity: 1, transform: "translateX(0px)" }
          ],
          {
            duration: 400,
            delay: delays[i],
            endDelay: maxDelay - delays[i],
            fill: "both"
          }
        );
      });
    }

    function update() {
      var on = hovered || focused;
      if (!anims) {
        if (on) build(); /* animations autoplay forward on creation */
        return;
      }
      var rate = on ? 1 : -1;
      anims.forEach(function (a) {
        if (a.playbackRate !== rate) a.reverse();
      });
    }

    logo.addEventListener("mouseenter", function () { hovered = true; update(); });
    logo.addEventListener("mouseleave", function () { hovered = false; update(); });
    logo.addEventListener("focusin", function () { focused = true; update(); });
    logo.addEventListener("focusout", function () { focused = false; update(); });
  });
})();

/* Mobile nav. */
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  toggle.addEventListener("click", function () {
    setOpen(!nav.classList.contains("open"));
  });

  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });
})();
