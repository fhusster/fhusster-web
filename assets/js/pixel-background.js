/* HOME only. The corner swarm: a stream of tilted blocks in the logo's two
   colours (navy and magenta) that pours out of the top right corner of the
   hero, thins as it sweeps left over the headline, and ends in a fine pale
   tail. The deepest shades cluster in the corner; the tints pale toward the
   tail. A few pale strays have escaped the bunch and float aimlessly in the
   section below. Everything is rasterised by hand into a
   low-resolution buffer (one art pixel = several CSS pixels, hard edges, no
   antialiasing) so the tilt reads as stair-stepped pixel art.

   The layer lives OUTSIDE .site, directly on top of the fixed side rails, so
   the rails run behind the art and show only through its gaps. */
(function () {
  "use strict";
  var section = document.querySelector("main .hero");
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
  // AFTER the rails in source order: same z-index, so the art paints over the
  // rails and they run behind it (.site, z 200, still sits above both).
  if (railsLayer) document.body.insertBefore(field, railsLayer.nextSibling);
  else document.body.insertBefore(field, document.body.firstChild);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- look ---- */
  var ART_PX = 3;            // CSS pixels per art pixel
  var TILT = -0.27;          // base tilt in radians (counter-clockwise, as the reference)
  var TILT_JITTER = 0.2;
  // The logo's two colours, each as an eight-shade ramp (deepest first).
  // Magenta is a bright colour, so washing it toward white stays pink all the
  // way. Navy is a DARK colour: washed toward white it turns slate grey, so
  // its ramp is drawn by hand through saturated blue instead
  // (navy → blue → light blue → palest blue), lightening in step with the pinks.
  var MAGENTA = [255, 43, 115];               // --magenta
  var TINTS = [0, .15, .31, .47, .61, .73, .83, .9];
  var RAMPS = [
    [[8, 43, 92], [12, 60, 130], [18, 82, 176], [36, 110, 216],   // --navy first
      [86, 148, 234], [138, 183, 243], [184, 212, 249], [217, 232, 253]],
    TINTS.map(function (tint) {
      return MAGENTA.map(function (value) { return Math.round(value + (255 - value) * tint); });
    })
  ];
  var NAVY_SHARE = .56;
  var SIDE_STEP = 1.15;      // the receding face sits this many shades deeper than the front
  var FLOATER_COUNT = 11;    // strays in the section below (phones get about half)

  var below = section.nextElementSibling;
  var width = 0, height = 0, fullHeight = 0, cols = 0, rows = 0;
  var image = null, pixels = null;
  var blocks = [];
  var floaters = [];
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
  /* A ramp's colour at a fractional shade. Below shade 0 there is nothing
     deeper on the ramp, so the full colour is darkened instead. */
  function pack(ramp, shade) {
    var low = Math.max(0, Math.min(ramp.length - 1, Math.floor(shade)));
    var high = Math.min(ramp.length - 1, low + 1);
    var mix = Math.max(0, Math.min(1, shade - low));
    var dim = shade < 0 ? Math.max(.55, 1 + shade * .22) : 1;
    var channel = function (index) {
      return Math.round((ramp[low][index] + (ramp[high][index] - ramp[low][index]) * mix) * dim);
    };
    return (255 << 24 | channel(2) << 16 | channel(1) << 8 | channel(0)) >>> 0; // little-endian RGBA
  }

  /* Where the tail dies out. Desktop: far to the left (as far as the short
     "Join Us" headline used to let it run), riding in the clear strip between
     the header and the kicker so it passes OVER the headline, not through it.
     Phones: just past the headline's text, as before. */
  function tailTarget(sectionRect, compact) {
    var heading = section.querySelector("h1");
    var first = section.querySelector(".kicker") || heading;
    if (!compact) {
      var clear = first ? first.getBoundingClientRect().top - sectionRect.top : height * .18;
      return { x: width * .25, y: Math.max(22, clear * .58) };
    }
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

  /* Boxes nothing may be drawn behind: every line of hero copy and the
     buttons, in layer coordinates. The stream is carved around them. */
  function keepClear(sectionRect) {
    var boxes = [];
    var pad = 16;
    section.querySelectorAll(".kicker, h1, .lede").forEach(function (node) {
      var range = document.createRange();
      range.selectNodeContents(node);
      Array.prototype.forEach.call(range.getClientRects(), function (rect) {
        boxes.push([rect.left - pad, rect.top - sectionRect.top - pad, rect.right + pad, rect.bottom - sectionRect.top + pad]);
      });
    });
    section.querySelectorAll(".btn").forEach(function (node) {
      var rect = node.getBoundingClientRect();
      boxes.push([rect.left - pad, rect.top - sectionRect.top - pad, rect.right + pad, rect.bottom - sectionRect.top + pad]);
    });
    return boxes;
  }
  function blocked(boxes, x, y, reach) {
    for (var index = 0; index < boxes.length; index++) {
      var box = boxes[index];
      if (x + reach > box[0] && x - reach < box[2] && y + reach > box[1] && y - reach < box[3]) return true;
    }
    return false;
  }

  function build() {
    var sectionRect = section.getBoundingClientRect();
    // Phones: the headline runs the full width, so the cluster stays small,
    // pale and tucked into the corner instead of sitting behind the type.
    var compact = width < 700;
    var tail = tailTarget(sectionRect, compact);
    var boxes = keepClear(sectionRect);
    // Cubic path: dives out of the corner, bellies down in the open space to
    // the right of the copy, then levels out INTO the clear strip above the
    // copy before it reaches the text, and runs flat along it to the tail.
    var copyRight = boxes.reduce(function (edge, box) { return Math.max(edge, box[2]); }, 0);
    var p0 = { x: width * 1.01, y: -height * .08 };
    var p3 = tail;
    var p1, p2;
    if (compact) {
      p1 = { x: p3.x + (p0.x - p3.x) * .6, y: p3.y + height * .07 };
      p2 = { x: p3.x + (p0.x - p3.x) * .3, y: p3.y + height * .07 };
    } else {
      var entry = Math.min(Math.max(copyRight + 50, p3.x + 80), width * .82);
      p1 = { x: entry + (p0.x - entry) * .55, y: height * .7 };
      p2 = { x: entry, y: p3.y };
    }
    var random = generator(20260919);
    var headSize = compact ? 22 : Math.max(34, Math.min(74, width / 19));
    var headSpread = compact ? Math.max(60, width * .17)
      : Math.min(Math.max(170, Math.min(400, width * .27)), height * .92);
    var count = Math.round(Math.max(320, Math.min(1000, width * .66)));

    blocks = [];
    for (var index = 0; index < count; index++) {
      var t = Math.pow(random(), .85);   // a few more blocks toward the tail
      var inverse = 1 - t;
      var b0 = inverse * inverse * inverse, b1 = 3 * inverse * inverse * t, b2 = 3 * inverse * t * t, b3 = t * t * t;
      var x = b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x;
      var y = b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y;
      var dx = 3 * inverse * inverse * (p1.x - p0.x) + 6 * inverse * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
      var dy = 3 * inverse * inverse * (p1.y - p0.y) + 6 * inverse * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
      var length = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= length; dy /= length;

      // Bell-shaped scatter across the stream, with a few strays.
      var scatter = (random() + random() + random() - 1.5) / 1.5;
      if (random() < .09) scatter *= 1.9;
      var spread = 15 + (headSpread - 15) * Math.pow(inverse, compact ? 1.15 : 1.5);
      x += -dy * scatter * spread;
      y += dx * scatter * spread;

      var size = ART_PX + (headSize - ART_PX) * Math.pow(inverse, 1.55) * (.45 + random() * .85);
      var aspect = .8 + random() * .55;
      // The layer ends at the divider. Drop whole blocks rather than slicing
      // them on that line, so a short section gets a ragged edge, not a cut.
      if (y + size * .95 + 8 > height) continue;
      // Copy stays on clean white: nothing is drawn behind a line of text.
      if (blocked(boxes, x, y, size * .75 + 9)) continue;
      // Tone follows the stream (dark corner → pale tail); the top-right gets
      // an extra pull toward the darkest greys.
      var corner = Math.max(0, 1 - Math.sqrt(Math.pow((width - x) / (width * .34), 2) + Math.pow(y / (height * .62), 2)));
      var tone = t * 6.6 + (random() - .5) * 3 - corner * 2.4 + Math.abs(scatter) * 1.1;
      if (compact) tone += 2;
      tone = Math.max(0, Math.min(TINTS.length - 1, Math.round(tone)));
      var hue = RAMPS[random() < NAVY_SHARE ? 0 : 1];

      blocks.push({
        t: t, x: x, y: y, dx: dx, dy: dy,
        w: size * aspect, h: size,
        angle: TILT + (random() - .5) * TILT_JITTER * 2,
        face: pack(hue, tone),
        side: pack(hue, tone - SIDE_STEP),
        depth: size > 13 ? Math.max(ART_PX, size * .2) : 0,
        phase: random() * Math.PI * 2,
        period: 5200 + random() * 6200,
        sway: (2.5 + size * .16) * (.6 + random() * .8),
        order: t + (random() - .5) * .3
      });
    }
    // Far, pale blocks first; the near, dark cluster paints over them.
    blocks.sort(function (a, b) { return b.order - a.order; });
    buildFloaters(random, compact);
  }

  /* The escapees: a handful of pale blocks adrift in the section below the
     hero, mostly under the bunch they fell from. Each wanders on two
     unrelated slow sines per axis (so the path never visibly repeats) and
     tumbles as it goes. Homes avoid the section's card, which would hide them. */
  function buildFloaters(random, compact) {
    floaters = [];
    if (fullHeight - height < 80) return;
    var sectionRect = section.getBoundingClientRect();
    var covers = [];
    if (below) below.querySelectorAll(".card, .ribbon").forEach(function (node) {
      var rect = node.getBoundingClientRect();
      covers.push([rect.left - 6, rect.top - sectionRect.top - 6, rect.right + 6, rect.bottom - sectionRect.top + 6]);
    });
    var wanted = compact ? Math.ceil(FLOATER_COUNT / 2) : FLOATER_COUNT;
    for (var attempt = 0; attempt < 400 && floaters.length < wanted; attempt++) {
      var x = width * (.12 + .86 * Math.pow(random(), .62));
      var y = height + 18 + (fullHeight - height - 40) * Math.pow(random(), 1.5);
      var size = (compact ? 7 : 9) + random() * (compact ? 9 : 19);
      var tone = 4 + Math.floor(random() * 3);
      var hue = RAMPS[random() < NAVY_SHARE ? 0 : 1];
      var roam = 26 + random() * 70;
      var spin = (random() < .5 ? -1 : 1) * (.05 + random() * .12);
      var values = [random(), random(), random(), random(), random(), random()];
      if (blocked(covers, x, y, size)) continue;
      floaters.push({
        x: x, y: y, w: size * (.85 + random() * .4), h: size,
        face: pack(hue, tone), side: pack(hue, tone - SIDE_STEP * .6),
        depth: size > 13 ? Math.max(ART_PX, size * .2) : 0,
        roam: roam, spin: spin, angle: TILT + (random() - .5),
        a: 9000 + values[0] * 9000, b: 15000 + values[1] * 14000,
        c: 11000 + values[2] * 9000, d: 17000 + values[3] * 15000,
        p: values[4] * Math.PI * 2, q: values[5] * Math.PI * 2
      });
    }
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
    var turn = Math.PI * 2;
    for (var stray = 0; stray < floaters.length; stray++) {
      var f = floaters[stray];
      var fx = f.x, fy = f.y, fAngle = f.angle;
      if (!still) {
        fx += (Math.sin(elapsed / f.a * turn + f.p) * .62 + Math.sin(elapsed / f.b * turn + f.q) * .38) * f.roam;
        fy += (Math.cos(elapsed / f.c * turn + f.q) * .62 + Math.sin(elapsed / f.d * turn + f.p) * .38) * f.roam * .7;
        fAngle += elapsed / 1000 * f.spin;
      }
      var fCos = Math.cos(fAngle), fSin = Math.sin(fAngle);
      if (f.depth) stamp(fx - f.depth * .8, fy + f.depth, f.w, f.h, fCos, fSin, f.side);
      stamp(fx, fy, f.w, f.h, fCos, fSin, f.face);
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
    // The layer runs on through the section below, where the strays float.
    var nextFull = below ? Math.round(below.getBoundingClientRect().bottom - sectionRect.top) : nextHeight;
    nextFull = Math.max(nextHeight, nextFull);
    field.style.height = nextFull + "px";
    if (nextWidth === width && nextHeight === height && nextFull === fullHeight && pixels) return;
    width = nextWidth; height = nextHeight; fullHeight = nextFull;
    ART_PX = width < 700 ? 2 : 3;
    cols = Math.max(1, Math.ceil(width / ART_PX));
    rows = Math.max(1, Math.ceil(fullHeight / ART_PX));
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
  if (below) new ResizeObserver(resize).observe(below);
  new ResizeObserver(resize).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { width = 0; resize(); });
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    updateMotion();
  }).observe(field);
  document.addEventListener("visibilitychange", updateMotion);
  reduced.addEventListener("change", updateMotion);
  resize();
  updateMotion();
})();
