/* Smaller squares belong to the opening section, never the viewport. */
(function () {
  "use strict";
  var section = document.querySelector("main .hero, main .page-head, main .hb-hero, main .dr-hero");
  var divider = section && section.querySelector(".rule-dia");
  if (!divider) return;
  var canvas = document.createElement("canvas");
  canvas.className = "pixel-background";
  canvas.setAttribute("aria-hidden", "true");
  section.classList.add("pixel-section");
  section.prepend(canvas);
  var context = canvas.getContext("2d");
  if (!context) { canvas.remove(); return; }
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var width = 0, height = 0, ratio = 1, cell = 0;
  var frame = 0, previous = 0, elapsed = 0, visible = true;
  var rows = [12, 12, 11, 10, 8, 7, 5, 3, 1];
  var extentX = 0, extentY = 0;
  var rails = Array.prototype.slice.call(document.querySelectorAll(".rail"));

  function resize() {
    width = section.clientWidth;
    height = Math.max(0, divider.getBoundingClientRect().top - section.getBoundingClientRect().top);
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    cell = Math.round(Math.max(12, Math.min(24, width / 55)));
    extentX = Math.min(width * .8, 720);
    extentY = Math.min(height, 390);
    canvas.style.height = height + "px";
    canvas.style.maskImage = "radial-gradient(ellipse " + extentX + "px " + extentY + "px at 100% 0%, #000 0%, rgba(0,0,0,.65) 35%, transparent 100%)";
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#c9cdd2";
    // A single silhouette joins the corner tiles without hairline seams.
    context.beginPath();
    context.moveTo(width, 0);
    context.lineTo(width - rows[0] * cell, 0);
    for (var row = 0; row < rows.length; row++) {
      context.lineTo(width - rows[row] * cell, (row + 1) * cell);
      if (row + 1 < rows.length) context.lineTo(width - rows[row + 1] * cell, (row + 1) * cell);
    }
    context.lineTo(width, rows.length * cell);
    context.closePath();
    context.fill();
    // Local floating motion, independent of scrolling.
    for (var y = 0; y < 15; y++) {
      for (var x = 0; x < 29; x++) {
        if (y < rows.length && x < rows[y]) continue;
        var noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        var seed = Math.floor((noise - Math.floor(noise)) * 19);
        if (seed > 5 || x * cell > extentX || y * cell > extentY) continue;
        var drift = reduced.matches ? 0 : Math.sin(elapsed / 6000 + x * .7 + y) * cell * .22;
        var size = Math.round(cell * (.65 + seed * .045));
        context.fillRect(Math.round(width - (x + 1) * cell - drift), Math.round(y * cell + drift * .4), size, size);
      }
    }
    // The fixed navy/magenta side rails live behind the page. Cut their exact
    // channels through the pixel canvas so the squares visibly pass beneath
    // both rails without moving the rails above the footer or page content.
    var canvasRect = canvas.getBoundingClientRect();
    rails.forEach(function (rail) {
      var railRect = rail.getBoundingClientRect();
      if (!railRect.width) return;
      context.clearRect(Math.floor(railRect.left - canvasRect.left), 0,
        Math.ceil(railRect.width), height);
    });
  }
  function animate(timestamp) {
    frame = 0;
    if (!previous) previous = timestamp;
    if (timestamp - previous >= 1000 / 24) {
      elapsed += Math.min(timestamp - previous, 100);
      previous = timestamp;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  function updateMotion() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    draw();
    if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(animate);
  }
  new ResizeObserver(resize).observe(section);
  var observer = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    updateMotion();
  });
  observer.observe(section);
  document.addEventListener("visibilitychange", updateMotion);
  reduced.addEventListener("change", updateMotion);
  resize();
  updateMotion();
})();
