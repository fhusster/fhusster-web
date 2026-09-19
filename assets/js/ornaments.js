/* Fhusster ornaments: waving-ribbon column slicer, from
   fhusster-ribbon-rails.html. Rebuilds every .ribbon-body as vertical
   columns so the banner can ripple WHEN HOVERED (the columns sit in
   register and read as one solid banner the rest of the time; the wave
   itself is CSS, on .ribbon:hover). Runs once on load, again when the
   webfont lands, and on any width change. Does nothing under
   prefers-reduced-motion, and the ribbon renders flat and correct if this
   file never loads at all. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var widths = new WeakMap();

  function slice(ribbon) {
    var body = ribbon.querySelector(".ribbon-body");
    if (!body) return;

    // first run: wrap the text so we keep an authoritative copy
    var label = body.querySelector(".ribbon-label");
    if (!label) {
      label = document.createElement("span");
      label.className = "ribbon-label";
      label.textContent = body.textContent.trim();
      body.textContent = "";
      body.appendChild(label);
    }

    var old = body.querySelectorAll(".ribbon-slice");
    for (var j = 0; j < old.length; j++) old[j].remove();

    if (reduce.matches) {
      ribbon.classList.remove("is-waving");
      return;
    }

    var width = Math.round(body.getBoundingClientRect().width);
    if (!width) return;
    widths.set(ribbon, width);

    var step = parseInt(getComputedStyle(ribbon).getPropertyValue("--rib-slice"), 10) || 8;
    var count = Math.ceil(width / step);
    var frag = document.createDocumentFragment();

    // Half a pixel of bleed on each side: neighbouring columns overlap, so a
    // rounding gap between two clip paths can never show as a hairline down
    // the banner while the ripple has them at different heights.
    var bleed = .5;
    for (var i = 0; i < count; i++) {
      var left = Math.max(0, i * step - bleed);
      var right = Math.max(0, width - (i + 1) * step - bleed);
      var col = document.createElement("span");
      col.className = "ribbon-slice";
      col.setAttribute("aria-hidden", "true");
      col.style.setProperty("--i", i);
      col.style.clipPath = "inset(0 " + right + "px 0 " + left + "px)";
      col.style.webkitClipPath = col.style.clipPath;
      frag.appendChild(col);
    }
    body.appendChild(frag);

    var rightTail = ribbon.querySelector(".ribbon-tail--r");
    if (rightTail) rightTail.style.setProperty("--i", count - 1);
    ribbon.classList.add("is-waving");
  }

  function sliceAll() {
    var all = document.querySelectorAll(".ribbon");
    for (var i = 0; i < all.length; i++) slice(all[i]);
  }

  function init() {
    sliceAll();

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sliceAll);

    // width changes only — the columns are absolute, so they can't feed back
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var ribbon = entries[i].target;
          var now = Math.round(entries[i].contentRect.width);
          if (widths.get(ribbon) !== now) slice(ribbon);
        }
      });
      var all = document.querySelectorAll(".ribbon");
      for (var i = 0; i < all.length; i++) ro.observe(all[i]);
    } else {
      var timer;
      window.addEventListener("resize", function () {
        clearTimeout(timer);
        timer = setTimeout(sliceAll, 150);
      });
    }

    reduce.addEventListener("change", sliceAll);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // call after changing a ribbon's text
  window.FhussterRibbon = {
    refresh: sliceAll,
    setText: function (ribbon, text) {
      var label = ribbon.querySelector(".ribbon-label") || ribbon.querySelector(".ribbon-body");
      label.textContent = text;
      slice(ribbon);
    }
  };
})();
