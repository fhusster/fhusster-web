/* HOME only. The corner swarm: a stream of tilted blocks in the logo's two
   colours (navy and magenta) that pours out of the top right corner of the
   hero, thins as it sweeps left over the headline, and ends in a fine pale
   tail. The deepest shades cluster in the corner; the tints pale toward the
   tail. A few pale strays have escaped the bunch and float aimlessly in the
   section below. Every block is a little extruded cube drawn as vector
   geometry at the display's own resolution — true-resolution edges, no
   pixel grid — so the tilted faces stay clean at any size or zoom.

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
  // TWO canvases. The far, pale two thirds of the swarm never move, so they
  // are painted once onto the lower one; only the near cluster and the strays
  // are repainted per frame, onto the upper one. Since the swarm is already
  // sorted far-to-near, "the ones that move" are exactly the ones that belong
  // on top, so the depth order survives the split.
  var still = document.createElement("canvas");
  still.className = "pixel-background";
  var canvas = document.createElement("canvas");
  canvas.className = "pixel-background";
  field.appendChild(still);
  field.appendChild(canvas);
  var stillContext = still.getContext("2d");
  var context = canvas.getContext("2d");
  if (!context || !stillContext) return;
  // AFTER the rails in source order: same z-index, so the art paints over the
  // rails and they run behind it (.site, z 200, still sits above both).
  if (railsLayer) document.body.insertBefore(field, railsLayer.nextSibling);
  else document.body.insertBefore(field, document.body.firstChild);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- look ---- */
  var MIN_SIZE = 3;          // smallest cube in the tail, CSS px
  var MAX_DPR = 2;           // 3x tripled the fill cost for no visible gain
  var DRIFT_SHARE = .3;      // the nearest third drifts; the rest is painted once
  var FPS = 20;              // full rate: the split canvas made it cheap again
  var DRIFT_SLOW = 1.15;     // every period stretched 15%, every spin 15% slower
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
  var SHADES = 20;           // distinct levels per hue (the eight-stop ramps are interpolated)
  var NAVY_SHARE = .56;
  // The two visible receding faces, in shades deeper than the lit front face:
  // light comes from the upper right, so the left flank is darker and the
  // underside darker still. That is what makes each block read as a solid.
  var SIDE_STEP = 1.15;
  var UNDER_STEP = 1.9;
  var FLOATER_COUNT = 11;    // strays in the section below (phones get about half)

  var below = section.nextElementSibling;
  var width = 0, height = 0, fullHeight = 0, ratio = 1;
  var ready = false;
  var blocks = [];
  var drifters = [];
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
  /* A ramp's colour at a fractional shade, as a CSS colour. Below shade 0
     there is nothing deeper on the ramp, so the full colour is darkened. */
  function shadeOf(ramp, shade) {
    var low = Math.max(0, Math.min(ramp.length - 1, Math.floor(shade)));
    var high = Math.min(ramp.length - 1, low + 1);
    var mix = Math.max(0, Math.min(1, shade - low));
    var dim = shade < 0 ? Math.max(.55, 1 + shade * .22) : 1;
    var channel = function (index) {
      return Math.round((ramp[low][index] + (ramp[high][index] - ramp[low][index]) * mix) * dim);
    };
    return "rgb(" + channel(0) + "," + channel(1) + "," + channel(2) + ")";
  }

  /* Where the tail dies out: just past the right end of the kicker, in the
     clear strip between the header and the copy. Anchoring it to that word
     rather than to a fraction of the width keeps the same relationship at
     every size — the stream always arrives from the right and stops short
     of the words, never over them. */
  function tailTarget(sectionRect) {
    var first = section.querySelector(".kicker") || section.querySelector("h1");
    if (!first) return { x: width * .25, y: Math.max(18, height * .1) };
    var range = document.createRange();
    range.selectNodeContents(first);
    var text = range.getBoundingClientRect();
    if (!text.width) return { x: width * .25, y: Math.max(18, height * .1) };
    var top = text.top - sectionRect.top;
    return {
      x: Math.min(text.right - sectionRect.left + Math.max(14, width * .02), width * .8),
      y: Math.max(14, Math.min(top * .58, top - 12))
    };
  }

  /* Boxes nothing may be drawn behind: every line of hero copy and the
     buttons, in layer coordinates. The stream is carved around them. */
  function keepClear(sectionRect) {
    var boxes = [];
    var pad = width < 700 ? 11 : 16;
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
  function blocked(boxes, x, y, reachX, reachY) {
    if (reachY === undefined) reachY = reachX;
    for (var index = 0; index < boxes.length; index++) {
      var box = boxes[index];
      if (x + reachX > box[0] && x - reachX < box[2] && y + reachY > box[1] && y - reachY < box[3]) return true;
    }
    return false;
  }

  function build() {
    var sectionRect = section.getBoundingClientRect();
    var tail = tailTarget(sectionRect);
    var boxes = keepClear(sectionRect);
    // Cubic path: dives out of the corner, bellies down in the open space to
    // the right of the copy, then levels out INTO the clear strip above the
    // copy before it reaches the text, and runs flat along it to the tail.
    var copyRight = boxes.reduce(function (edge, box) { return Math.max(edge, box[2]); }, 0);
    var narrowStart = Math.max(0, Math.min(1, (900 - width) / 520));
    // A phone has a header right above the strip, so a head that starts off
    // the top is half eaten by it. The source moves down onto the page as the
    // screen narrows, and in from the right edge, so the whole burst shows.
    var p0 = { x: width * (1.01 - .07 * narrowStart), y: -height * .08 + height * .09 * narrowStart };
    var p3 = tail;
    // The belly needs open page to the right of the copy. A wide screen has
    // it and the stream dives before it levels off; a phone, where the copy
    // runs the full width, has none, so the same curve flattens into a sweep
    // across the clear strip. One path, one shape, scaled to the room.
    var gutter = Math.max(0, width - copyRight);
    var belly = Math.max(0, Math.min(1, (gutter / width - .10) / .22));
    // A phone has no gutter to dive down, but the copy still leaves pockets:
    // the short second line of the headline, the ends of the lede's lines.
    // The stream dips into them along the right edge rather than running as
    // a flat band across the thin strip, which is what makes it read as a
    // swarm at that size instead of a streak. Blocks that would land on a
    // line of type are dropped either way.
    belly = Math.max(belly, Math.min(1, Math.max(0, (900 - width) / 520)) * .62);
    var entry = Math.min(Math.max(copyRight + width * .035, p3.x + width * .06), width * .82);
    var p1 = { x: entry + (p0.x - entry) * .55, y: p3.y + belly * (height * .7 - p3.y) };
    var p2 = { x: entry, y: p3.y };
    var random = generator(20260919);
    // Everything scales with the width, so a narrow screen gets the whole
    // galaxy rather than a corner of a big one — and it takes a BIGGER share
    // of a small screen, because at phone width a swarm sized off the width
    // alone reads as a scatter of specks. `narrow` runs 0 at 900px and up to
    // 1 at 380px and under, and drives size, spread and count together.
    var narrow = Math.max(0, Math.min(1, (900 - width) / 520));
    var headSize = Math.max(14, Math.min(74, width / (19 - 4 * narrow)));
    var headSpread = Math.min(width * (.27 + .16 * narrow), height * .92);
    var count = Math.round(Math.max(220, Math.min(1400, width * (.66 + 1.0 * narrow))));

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
      var spread = 15 + (headSpread - 15) * Math.pow(inverse, 1.5);
      x += -dy * scatter * spread;
      y += dx * scatter * spread;

      var size = MIN_SIZE + (headSize - MIN_SIZE) * Math.pow(inverse, 1.55) * (.45 + random() * .85);
      var aspect = .8 + random() * .55;
      // The layer ends at the divider. Drop whole blocks rather than slicing
      // them on that line, so a short section gets a ragged edge, not a cut.
      if (y + size * .95 + 8 > height) continue;
      // Copy stays on clean white: nothing is drawn behind a line of text.
      if (blocked(boxes, x, y, size * .75 + 9)) continue;
      // Tone follows the stream (deep corner → pale tail) with some jitter, so
      // neighbours differ and each block reads on its own; the top-right gets
      // an extra pull toward the deepest shades. The result snaps to one of
      // SHADES evenly spaced levels, interpolated along the hue's ramp.
      var corner = Math.max(0, 1 - Math.sqrt(Math.pow((width - x) / (width * .34), 2) + Math.pow(y / (height * .62), 2)));
      var tone = t * 6.6 + (random() - .5) * 3 - corner * 2.4 + Math.abs(scatter) * 1.1;
      var top = TINTS.length - 1;
      tone = Math.round(Math.max(0, Math.min(top, tone)) / top * (SHADES - 1)) / (SHADES - 1) * top;
      var hue = RAMPS[random() < NAVY_SHARE ? 0 : 1];

      blocks.push({
        t: t, x: x, y: y, dx: dx, dy: dy,
        w: size * aspect, h: size,
        angle: TILT + (random() - .5) * TILT_JITTER * 2,
        face: shadeOf(hue, tone),
        side: shadeOf(hue, tone - SIDE_STEP),
        under: shadeOf(hue, tone - UNDER_STEP),
        depth: size > 11 ? size * .2 : 0,
        phase: random() * Math.PI * 2,
        period: (5200 + random() * 6200) * DRIFT_SLOW,
        sway: (2.5 + size * .16) * (.6 + random() * .8),
        order: t + (random() - .5) * .3
      });
    }
    // Far, pale blocks first; the near, dark cluster paints over them.
    blocks.sort(function (a, b) { return b.order - a.order; });
    var cut = Math.floor(blocks.length * (1 - DRIFT_SHARE));
    drifters = blocks.slice(cut);
    blocks = blocks.slice(0, cut);
    buildFloaters(random);
    paintStill();
  }

  /* The far two thirds, painted once at their resting positions. */
  function paintStill() {
    if (!ready) return;
    stillContext.clearRect(0, 0, width, fullHeight);
    for (var index = 0; index < blocks.length; index++) {
      var block = blocks[index];
      cube(stillContext, block.x, block.y, block.w, block.h,
        Math.cos(block.angle), Math.sin(block.angle), block);
    }
  }

  /* The escapees: a handful of pale blocks adrift in the section below the
     hero, mostly under the bunch they fell from. Each wanders on two
     unrelated slow sines per axis (so the path never visibly repeats) and
     tumbles as it goes.

     The WHOLE wander, not just the home position, is kept clear of the page's
     opaque blocks (the card, the ribbon) and inside the layer: the card sits
     above this layer, so a stray that drifted onto it came out sliced in half
     against the card's edge, and one that drifted past the layer's bottom was
     cut by its overflow. A stray with no room to roam that far roams less
     instead of being dropped. */
  function buildFloaters(random) {
    var compact = width < 700;
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
      var spin = (random() < .5 ? -1 : 1) * (.05 + random() * .12) / DRIFT_SLOW;
      var values = [random(), random(), random(), random(), random(), random()];
      // Half the tumbling cube's own footprint: the diagonal (it spins, so
      // any corner can lead) plus the extrusion that trails down-left.
      var reach = size * .78 + (size > 11 ? size * .2 : 0) + 2;
      // The sines sum to at most 1 of the amplitude on each axis; y uses .7.
      while (roam > 8 && !roomFor(covers, x, y, reach, roam)) roam -= 8;
      if (!roomFor(covers, x, y, reach, roam)) continue;
      floaters.push({
        x: x, y: y, w: size * (.85 + random() * .4), h: size,
        face: shadeOf(hue, tone), side: shadeOf(hue, tone - SIDE_STEP * .6),
        under: shadeOf(hue, tone - UNDER_STEP * .6),
        depth: size > 11 ? size * .2 : 0,
        roam: roam, spin: spin, angle: TILT + (random() - .5),
        a: (9000 + values[0] * 9000) * DRIFT_SLOW, b: (15000 + values[1] * 14000) * DRIFT_SLOW,
        c: (11000 + values[2] * 9000) * DRIFT_SLOW, d: (17000 + values[3] * 15000) * DRIFT_SLOW,
        p: values[4] * Math.PI * 2, q: values[5] * Math.PI * 2
      });
    }
  }

  /* Is there room for a stray whose home is (x, y) to wander `roam` in every
     direction without touching an opaque block or leaving the layer? */
  function roomFor(covers, x, y, reach, roam) {
    var reachX = reach + roam, reachY = reach + roam * .7;
    if (x - reachX < 2 || x + reachX > width - 2) return false;
    if (y - reachY < height + 4 || y + reachY > fullHeight - 4) return false;
    return !blocked(covers, x, y, reachX, reachY);
  }

  /* One extruded cube: the lit front face plus the two faces that recede
     from it. Corners are computed in page space and filled as paths, so the
     renderer resolves every edge at device resolution instead of snapping it
     to a grid. The receding faces are pushed half a pixel UNDER the front
     face, which hides the hairline an antialiased shared edge leaves —
     stroking each face closed it too, but at twice the drawing cost. */
  function quad(ctx, a, b, c, d, colour) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }
  function cube(ctx, x, y, w, h, cos, sin, block) {
    var hw = w / 2, hh = h / 2;
    var wc = hw * cos, ws = hw * sin, hc = hh * cos, hs = hh * sin;
    var tl = [x - wc + hs, y - ws - hc];
    var tr = [x + wc + hs, y + ws - hc];
    var br = [x + wc - hs, y + ws + hc];
    var bl = [x - wc - hs, y - ws + hc];
    if (block.depth) {
      // The extrusion runs down and to the left, away from the light. Its
      // near corners start half a pixel back up the extrusion, under the face.
      var ex = -block.depth * .8, ey = block.depth;
      var back = .5 / Math.sqrt(ex * ex + ey * ey);
      var bx = -ex * back, by = -ey * back;
      var tlu = [tl[0] + bx, tl[1] + by];
      var blu = [bl[0] + bx, bl[1] + by];
      var bru = [br[0] + bx, br[1] + by];
      quad(ctx, blu, bru, [br[0] + ex, br[1] + ey], [bl[0] + ex, bl[1] + ey], block.under);
      quad(ctx, tlu, blu, [bl[0] + ex, bl[1] + ey], [tl[0] + ex, tl[1] + ey], block.side);
    }
    quad(ctx, tl, tr, br, bl, block.face);
  }

  function draw() {
    if (!ready) return;
    context.clearRect(0, 0, width, fullHeight);
    var frozen = reduced.matches;
    for (var index = 0; index < drifters.length; index++) {
      var block = drifters[index];
      var swing = frozen ? 0 : Math.sin(elapsed / block.period * Math.PI * 2 + block.phase);
      var lift = frozen ? 0 : Math.cos(elapsed / (block.period * 1.37) * Math.PI * 2 + block.phase);
      var x = block.x + block.dx * swing * block.sway - block.dy * lift * block.sway * .45;
      var y = block.y + block.dy * swing * block.sway + block.dx * lift * block.sway * .45;
      var angle = block.angle + swing * .045;
      cube(context, x, y, block.w, block.h, Math.cos(angle), Math.sin(angle), block);
    }
    var turn = Math.PI * 2;
    for (var stray = 0; stray < floaters.length; stray++) {
      var f = floaters[stray];
      var fx = f.x, fy = f.y, fAngle = f.angle;
      if (!frozen) {
        fx += (Math.sin(elapsed / f.a * turn + f.p) * .62 + Math.sin(elapsed / f.b * turn + f.q) * .38) * f.roam;
        fy += (Math.cos(elapsed / f.c * turn + f.q) * .62 + Math.sin(elapsed / f.d * turn + f.p) * .38) * f.roam * .7;
        fAngle += elapsed / 1000 * f.spin;
      }
      cube(context, fx, fy, f.w, f.h, Math.cos(fAngle), Math.sin(fAngle), f);
    }
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
    var nextRatio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (nextWidth === width && nextHeight === height && nextFull === fullHeight
      && nextRatio === ratio && ready) return;
    width = nextWidth; height = nextHeight; fullHeight = nextFull; ratio = nextRatio;
    // Backing stores at device resolution, laid over the CSS-pixel box.
    [still, canvas].forEach(function (node) {
      node.width = Math.round(width * ratio);
      node.height = Math.round(fullHeight * ratio);
      node.style.width = width + "px";
      node.style.height = fullHeight + "px";
    });
    stillContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    ready = true;
    build();
    draw();
  }

  function animate(timestamp) {
    frame = requestAnimationFrame(animate);
    if (!previous) previous = timestamp;
    if (timestamp - previous < 1000 / FPS) return;
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
