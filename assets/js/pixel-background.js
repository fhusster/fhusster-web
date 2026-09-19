/* The corner swarm: a stream of tilted grey blocks that pours out of the top
   right corner of the opening section, thins as it sweeps down-left, and ends
   in a fine tail beside the headline. It is rasterised by hand into a
   low-resolution buffer (one art pixel = several CSS pixels, hard edges, no
   antialiasing) so the tilt reads as stair-stepped pixel art.

   The layer lives OUTSIDE .site, directly beneath the fixed side rails, so the
   rails are simply two lines laid over the art. Nothing is cut out for them. */
(function () {
  "use strict";
  var section = document.querySelector("main .hero, main .page-head, main .hb-hero, main .dr-hero");
  var divider = section && section.querySelector(".rule-dia");
  var railsLayer = document.querySelector(".rails");
  if (!divider) return;

  var field = document.createElement("div");
  field.className = "pixel-field";
  field.setAttribute("aria-hidden", "true");
  var canvas = document.createElement("canvas");
  canvas.className = "pixel-background";
  field.appendChild(canvas);
  var context = canvas.getContext("2d");
  if (!context) return;
  // Before the rails in source order: same z-index, so the rails paint on top.
  if (railsLayer) document.body.insertBefore(field, railsLayer);
  else document.body.insertBefore(field, document.body.firstChild);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- look ---- */
  var ART_PX = 3;            // CSS pixels per art pixel
  var TILT = -0.27;          // base tilt in radians (counter-clockwise, as the reference)
  var TILT_JITTER = 0.2;
  // Cool greys, darkest first. #A1A4A8 is the old corner grey darkened by 20%.
  var GREYS = [
    [161, 164, 168], [176, 179, 184], [191, 194, 199], [201, 205, 210],
    [212, 215, 219], [222, 225, 229], [231, 233, 236], [239, 240, 243]
  ];
  var SIDE_SHADE = 0.8;      // the block's receding face, relative to its front

  var width = 0, height = 0, cols = 0, rows = 0;
  var image = null, pixels = null;
  var blocks = [];
  var frame = 0, previous = 0, elapsed = 0, visible = true;

  /* Deterministic: the swarm must not reshuffle on every resize. */
  function generator(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pack(rgb, shade) {
    var r = Math.round(rgb[0] * shade), g = Math.round(rgb[1] * shade), b = Math.round(rgb[2] * shade);
    return (255 << 24 | b << 16 | g << 8 | r) >>> 0; // little-endian RGBA
  }

  /* Where the tail should die out: just past the right edge of the headline's
     actual text, level with its lower half. */
  function tailTarget(sectionRect) {
    var heading = section.querySelector("h1");
    var x = width * .42, y = height * .48;
    if (heading) {
      var range = document.createRange();
      range.selectNodeContents(heading);
      var text = range.getBoundingClientRect();
      if (text.width) {
        x = text.right - sectionRect.left + 18;
        y = text.top - sectionRect.top + text.height * .62;
      }
    }
    return { x: Math.max(width * .2, Math.min(x, width * .66)), y: Math.max(height * .3, Math.min(y, height * .8)) };
  }

  function build() {
    var sectionRect = section.getBoundingClientRect();
    var tail = tailTarget(sectionRect);
    // Quadratic path: dives out of the corner, then flattens toward the tail.
    var p0 = { x: width * 1.01, y: -height * .1 };
    var p2 = tail;
    var p1 = { x: p2.x + (p0.x - p2.x) * .46, y: p2.y + height * .1 };
    var random = generator(20260919);
    // Phones: the headline runs the full width, so the cluster stays small,
    // pale and tucked into the corner instead of sitting behind the type.
    var compact = width < 700;
    var headSize = compact ? 22 : Math.max(30, Math.min(60, width / 22));
    var headSpread = compact ? Math.max(60, width * .17)
      : Math.min(Math.max(150, Math.min(330, width * .23)), height * .85);
    var count = Math.round(Math.max(320, Math.min(760, width * .5)));

    blocks = [];
    for (var index = 0; index < count; index++) {
      var t = random();
      var inverse = 1 - t;
      var x = inverse * inverse * p0.x + 2 * inverse * t * p1.x + t * t * p2.x;
      var y = inverse * inverse * p0.y + 2 * inverse * t * p1.y + t * t * p2.y;
      var dx = 2 * inverse * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
      var dy = 2 * inverse * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
      var length = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= length; dy /= length;

      // Bell-shaped scatter across the stream, with a few strays.
      var scatter = (random() + random() + random() - 1.5) / 1.5;
      if (random() < .09) scatter *= 1.9;
      var spread = 14 + (headSpread - 14) * Math.pow(inverse, 1.15);
      x += -dy * scatter * spread;
      y += dx * scatter * spread;

      var size = ART_PX + (headSize - ART_PX) * Math.pow(inverse, 1.55) * (.45 + random() * .85);
      var aspect = .8 + random() * .55;
      // The layer ends at the divider. Drop whole blocks rather than slicing
      // them on that line, so a short section gets a ragged edge, not a cut.
      if (y + size * .95 + 8 > height) continue;
      // Tone follows the stream (dark corner → pale tail); the top-right gets
      // an extra pull toward the darkest greys.
      var corner = Math.max(0, 1 - Math.sqrt(Math.pow((width - x) / (width * .34), 2) + Math.pow(y / (height * .62), 2)));
      var tone = t * 6.4 + (random() - .5) * 4.6 - corner * 2.4 + Math.abs(scatter) * 1.1;
      if (compact) tone += 2;
      tone = Math.max(0, Math.min(GREYS.length - 1, Math.round(tone)));

      blocks.push({
        t: t, x: x, y: y, dx: dx, dy: dy,
        w: size * aspect, h: size,
        angle: TILT + (random() - .5) * TILT_JITTER * 2,
        face: pack(GREYS[tone], 1),
        side: pack(GREYS[tone], SIDE_SHADE),
        depth: size > 13 ? Math.max(ART_PX, size * .2) : 0,
        phase: random() * Math.PI * 2,
        period: 5200 + random() * 6200,
        sway: (2.5 + size * .16) * (.6 + random() * .8),
        order: t + (random() - .5) * .3
      });
    }
    // Far, pale blocks first; the near, dark cluster paints over them.
    blocks.sort(function (a, b) { return b.order - a.order; });
  }

  /* Hard-edged rotated rectangle, point-sampled at art-pixel centres. */
  function stamp(cx, cy, w, h, cos, sin, colour) {
    var halfW = w / 2, halfH = h / 2;
    var reach = Math.abs(halfW * cos) + Math.abs(halfH * sin);
    var rise = Math.abs(halfW * sin) + Math.abs(halfH * cos);
    var x0 = Math.max(0, Math.floor((cx - reach) / ART_PX));
    var x1 = Math.min(cols - 1, Math.ceil((cx + reach) / ART_PX));
    var y0 = Math.max(0, Math.floor((cy - rise) / ART_PX));
    var y1 = Math.min(rows - 1, Math.ceil((cy + rise) / ART_PX));
    for (var py = y0; py <= y1; py++) {
      var oy = (py + .5) * ART_PX - cy;
      var row = py * cols;
      for (var px = x0; px <= x1; px++) {
        var ox = (px + .5) * ART_PX - cx;
        if (Math.abs(ox * cos + oy * sin) <= halfW && Math.abs(oy * cos - ox * sin) <= halfH) pixels[row + px] = colour;
      }
    }
  }

  function draw() {
    if (!pixels) return;
    pixels.fill(0);
    var still = reduced.matches;
    for (var index = 0; index < blocks.length; index++) {
      var block = blocks[index];
      var swing = still ? 0 : Math.sin(elapsed / block.period * Math.PI * 2 + block.phase);
      var lift = still ? 0 : Math.cos(elapsed / (block.period * 1.37) * Math.PI * 2 + block.phase);
      var x = block.x + block.dx * swing * block.sway - block.dy * lift * block.sway * .45;
      var y = block.y + block.dy * swing * block.sway + block.dx * lift * block.sway * .45;
      var angle = block.angle + swing * .045;
      var cos = Math.cos(angle), sin = Math.sin(angle);
      if (block.depth) stamp(x - block.depth * .8, y + block.depth, block.w, block.h, cos, sin, block.side);
      stamp(x, y, block.w, block.h, cos, sin, block.face);
    }
    context.putImageData(image, 0, 0);
  }

  function resize() {
    var sectionRect = section.getBoundingClientRect();
    var nextWidth = document.documentElement.clientWidth;
    var nextHeight = Math.max(0, Math.round(divider.getBoundingClientRect().top - sectionRect.top));
    // offsetTop, not the bounding rect: the intro slides .site in on a
    // transform, which would bake a 100vh offset into the layer's position.
    var top = 0;
    for (var node = section; node; node = node.offsetParent) top += node.offsetTop;
    field.style.top = top + "px";
    field.style.height = nextHeight + "px";
    if (nextWidth === width && nextHeight === height && pixels) return;
    width = nextWidth; height = nextHeight;
    ART_PX = width < 700 ? 2 : 3;
    cols = Math.max(1, Math.ceil(width / ART_PX));
    rows = Math.max(1, Math.ceil(height / ART_PX));
    canvas.width = cols; canvas.height = rows;
    canvas.style.width = cols * ART_PX + "px";
    canvas.style.height = rows * ART_PX + "px";
    image = context.createImageData(cols, rows);
    pixels = new Uint32Array(image.data.buffer);
    build();
    draw();
  }

  function animate(timestamp) {
    frame = requestAnimationFrame(animate);
    if (!previous) previous = timestamp;
    if (timestamp - previous < 1000 / 20) return;
    elapsed += Math.min(timestamp - previous, 100);
    previous = timestamp;
    draw();
  }
  function updateMotion() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    draw();
    if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(animate);
  }

  new ResizeObserver(resize).observe(section);
  new ResizeObserver(resize).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { width = 0; resize(); });
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    updateMotion();
  }).observe(section);
  document.addEventListener("visibilitychange", updateMotion);
  reduced.addEventListener("change", updateMotion);
  resize();
  updateMotion();
})();
