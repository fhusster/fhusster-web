/* A quiet, scroll-linked pixel field. All drawing is decorative and stays
   outside padded content bounds. No timers, dependencies, or idle render loop. */
(function () {
  "use strict";
  var main = document.querySelector("main");
  if (!main) return;

  var canvas = document.createElement("canvas");
  canvas.className = "pixel-background";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  var context = canvas.getContext("2d");
  if (!context) { canvas.remove(); return; }

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var width = 0, height = 0, ratio = 1, headerHeight = 0;
  var pixels = [], protectedAreas = [], visible = [], rails = [];
  var pending = false, layoutDirty = true, sizeDirty = true;
  var header = document.querySelector(".site-header");
  var padding = 16;
  // Cover whole components and text blocks, including translucent ribbon tails.
  // The field can occupy the surrounding whitespace but never the content itself.
  var selectors = [
    "main h1", "main h2", "main h3", "main h4", "main p",
    "main .kicker", "main .studio-index", "main .ribbon",
    "main .card", "main .btn", "main .badge", "main .rule-dia",
    "main .hb-hero-grid", "main .dr-hero-grid", "main .shots-row",
    "main .dr-shots", "main .hb-diamond-figure", "main form",
    "main ul", "main ol", "main table", "main img", "main video",
    ".site-footer"
  ].join(",");

  function noise(a, b) {
    var value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function resize() {
    width = document.documentElement.clientWidth;
    height = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A compressed field on phones preserves the same corner silhouette.
    var reach = Math.min(460, width * .58, height * .66);
    var scale = reach / 460;
    pixels = [];
    for (var row = 0; row < 38; row++) {
      for (var col = 0; col < 38; col++) {
        var x = (col * 5 + col * col * .27) * scale;
        var y = (row * 5 + row * row * .27) * scale;
        var distance = Math.sqrt(x * x + y * y) / reach;
        if (distance > 1 || noise(col, row) > Math.pow(1 - distance, .7)) continue;
        pixels.push({
          x: x, y: y,
          size: Math.max(2, Math.round((2 + distance * 7) * Math.max(.65, scale))),
          alpha: .62 * Math.pow(1 - distance, 1.3),
          depth: .35 + noise(row + 17, col + 8) * .65
        });
      }
    }
    sizeDirty = false;
  }

  function measure() {
    var scrollY = window.scrollY;
    headerHeight = header ? header.getBoundingClientRect().bottom : 0;
    protectedAreas = [];
    document.querySelectorAll(selectors).forEach(function (element) {
      var rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Ribbon tails extend beyond the parent's layout box.
      var extra = element.classList.contains("ribbon") ? 36 : 0;
      protectedAreas.push({
        left: rect.left - padding - extra, right: rect.right + padding + extra,
        top: rect.top + scrollY - padding, bottom: rect.bottom + scrollY + padding + extra
      });
    });
    rails = [];
    document.querySelectorAll(".rail").forEach(function (element) {
      var rect = element.getBoundingClientRect();
      if (rect.width && rect.height) rails.push({ left: rect.left - 5, right: rect.right + 5 });
    });
    layoutDirty = false;
  }

  function draw() {
    pending = false;
    if (sizeDirty) resize();
    if (layoutDirty) measure();
    context.clearRect(0, 0, width, height);
    var scrollY = window.scrollY;
    visible.length = 0;
    for (var area = 0; area < protectedAreas.length; area++) {
      if (protectedAreas[area].bottom > scrollY && protectedAreas[area].top < scrollY + height) {
        visible.push(protectedAreas[area]);
      }
    }
    var driftY = reduced.matches ? 0 : Math.sin(scrollY / 640) * 26;
    var driftX = reduced.matches ? 0 : Math.sin(scrollY / 920) * 10;
    context.fillStyle = "#c5c9cf";
    for (var corner = 0; corner < 2; corner++) {
      for (var i = 0; i < pixels.length; i++) {
        var pixel = pixels[i];
        var offsetX = pixel.x + driftX * pixel.depth;
        var offsetY = pixel.y + driftY * pixel.depth;
        var x = Math.round(corner ? width - 4 - offsetX - pixel.size : 4 + offsetX);
        var y = Math.round(corner ? height - 4 - offsetY - pixel.size : headerHeight + 8 + offsetY);
        if (x < 0 || y < headerHeight + 4 || x + pixel.size > width || y + pixel.size > height) continue;
        var blocked = false;
        for (var r = 0; !blocked && r < rails.length; r++) {
          blocked = x < rails[r].right && x + pixel.size > rails[r].left;
        }
        for (var j = 0; !blocked && j < visible.length; j++) {
          var rect = visible[j];
          blocked = x < rect.right && x + pixel.size > rect.left &&
            y + scrollY < rect.bottom && y + scrollY + pixel.size > rect.top;
        }
        if (!blocked) {
          context.globalAlpha = pixel.alpha;
          var size = Math.round(pixel.size * ratio) / ratio;
          context.fillRect(Math.round(x * ratio) / ratio, Math.round(y * ratio) / ratio, size, size);
        }
      }
    }
    context.globalAlpha = 1;
  }

  function schedule() {
    if (!pending) { pending = true; window.requestAnimationFrame(draw); }
  }
  function invalidate() { layoutDirty = true; schedule(); }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { sizeDirty = true; invalidate(); }, { passive: true });
  window.addEventListener("load", invalidate);
  reduced.addEventListener("change", schedule);
  if (document.fonts) document.fonts.ready.then(invalidate);
  // The intro translates the whole site without resizing it. Re-measure when
  // its classes are cleared so its temporary positions never enter the mask.
  new MutationObserver(invalidate).observe(document.documentElement, {
    attributes: true, attributeFilter: ["class"]
  });
  if ("ResizeObserver" in window) {
    var observer = new ResizeObserver(invalidate);
    observer.observe(main);
    if (header) observer.observe(header);
    // Re-measure through the inline video animation, including its intermediate frames.
    document.querySelectorAll(".featured-card,.hb-hero-grid,.dr-hero-grid").forEach(function (element) {
      observer.observe(element);
    });
  }
  main.addEventListener("transitionend", invalidate);
  schedule();
})();
