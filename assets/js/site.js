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

/* The header clouds are an IDLE reward: they stay hidden until the page has
   sat untouched for 30 minutes, then fade in and drift. Any scrolling fades
   them back out into the white header and the wait starts again.
   While showing, the four clouds keep one non-overlapping convoy. Every time
   a cloud loops behind the others it receives a new gap; some gaps are
   exactly zero so neighbouring cloud edges can meet naturally. */
(function () {
  var track = document.querySelector(".header-clouds");
  if (!track) return;
  var clouds = Array.prototype.slice.call(track.querySelectorAll(".header-cloud"));
  if (!clouds.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var positions = [];
  var widths = [];
  // Transparent padding in the generated PNGs. Scheduling against the visible
  // bounds lets a zero gap look like a true edge touch without cloud overlap.
  var edgeInsets = [[.031, .032], [.047, .049], [.026, .027], [.019, .018]];
  var viewportWidth = 0;
  var speed = 0;
  var frame = 0;
  var previous = 0;
  var accumulator = 0;

  function randomGap() {
    if (Math.random() < .24) return 0;
    return Math.round(10 + Math.random() * Math.min(180, viewportWidth * .18));
  }

  function paint() {
    clouds.forEach(function (cloud, index) {
      cloud.style.transform = "translate3d(" + positions[index].toFixed(2) + "px,0,0)";
    });
  }

  function layout() {
    viewportWidth = track.clientWidth;
    widths = clouds.map(function (cloud) { return cloud.getBoundingClientRect().width; });
    // The previous desktop loop crossed the header in about 160 seconds
    // (120 on small screens). Four times that duration is 75% slower.
    var duration = viewportWidth <= 600 ? 480 : 640;
    var averageWidth = widths.reduce(function (sum, width) { return sum + width; }, 0) / widths.length;
    speed = (viewportWidth + averageWidth) / duration;

    var visibleWidths = widths.map(function (width, index) {
      return width * (1 - edgeInsets[index][0] - edgeInsets[index][1]);
    });
    var totalWidth = visibleWidths.reduce(function (sum, width) { return sum + width; }, 0);
    var availableGap = Math.max(0, viewportWidth - totalWidth);
    var visibleX = -Math.min(visibleWidths[0] * .3, 45);
    var touchingPair = Math.floor(Math.random() * (widths.length - 1));
    positions = widths.map(function (width, index) {
      var position = visibleX - width * edgeInsets[index][0];
      var remaining = widths.length - index - 1;
      var gap = remaining ? Math.min(index === touchingPair ? 0 : randomGap(), availableGap / remaining) : 0;
      availableGap -= gap;
      visibleX += visibleWidths[index] + gap;
      return position;
    });
    track.classList.add("js-clouds");
    paint();
  }

  function animate(timestamp) {
    frame = requestAnimationFrame(animate);
    if (!previous) previous = timestamp;
    var delta = Math.min(timestamp - previous, 100);
    previous = timestamp;
    accumulator += delta;
    if (accumulator < 1000 / 30) return;

    var distance = speed * accumulator / 1000;
    accumulator = 0;
    for (var index = 0; index < positions.length; index++) positions[index] += distance;

    for (var pass = 0; pass < positions.length; pass++) {
      var outgoing = positions.findIndex(function (position, index) {
        return position + widths[index] * edgeInsets[index][0] >= viewportWidth;
      });
      if (outgoing === -1) break;
      var leftmost = Math.min.apply(null, positions.map(function (position, index) {
        return index === outgoing ? Infinity : position + widths[index] * edgeInsets[index][0];
      }));
      positions[outgoing] = leftmost - randomGap() - widths[outgoing] * (1 - edgeInsets[outgoing][1]);
    }
    paint();
  }

  function updateMotion() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    accumulator = 0;
    if (showing && !reduced.matches && !document.hidden) frame = requestAnimationFrame(animate);
  }

  /* ---- idle gate ---- */
  var IDLE_MS = 30 * 60 * 1000;
  var FADE_OUT_MS = 1200;      // keep in step with .header-clouds' transition
  // QA: ?cloudsIdleSec=5 shortens the wait so the fade can be watched.
  var override = /[?&]cloudsIdleSec=(\d+(?:\.\d+)?)/.exec(window.location.search);
  if (override) IDLE_MS = parseFloat(override[1]) * 1000;
  var showing = false;
  var lastActivity = Date.now();
  var idleTimer = 0;
  var restTimer = 0;

  function arm() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(check, Math.max(0, IDLE_MS - (Date.now() - lastActivity)) + 50);
  }
  // Timers are throttled in background tabs, so trust the clock, not the tick.
  function check() {
    if (showing) return;
    if (Date.now() - lastActivity >= IDLE_MS) reveal(); else arm();
  }
  function reveal() {
    clearTimeout(restTimer);
    showing = true;
    layout();
    track.classList.add("is-visible");
    updateMotion();
  }
  function conceal() {
    showing = false;
    track.classList.remove("is-visible");
    // Keep drifting through the fade, then stop spending frames on them.
    clearTimeout(restTimer);
    restTimer = setTimeout(function () {
      if (showing) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }, FADE_OUT_MS + 100);
  }
  function activity() {
    lastActivity = Date.now();
    if (!showing) arm();
  }
  function scrolled() {
    lastActivity = Date.now();
    if (showing) conceal();
    arm();
  }
  window.addEventListener("scroll", scrolled, { passive: true });
  window.addEventListener("wheel", scrolled, { passive: true });
  window.addEventListener("touchmove", scrolled, { passive: true });
  ["pointerdown", "pointermove", "keydown", "touchstart"].forEach(function (type) {
    window.addEventListener(type, activity, { passive: true });
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { layout(); updateMotion(); }, 120);
  }, { passive: true });
  document.addEventListener("visibilitychange", updateMotion);
  reduced.addEventListener("change", function () { layout(); updateMotion(); });
  layout();
  arm();
})();

/* Header and footer menus share the same keyboard and dismissal behaviour. */
(function () {
  document.querySelectorAll(".nav-toggle[aria-controls]").forEach(function (toggle) {
    var nav = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!nav) return;

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
  });
})();

/* Inline gameplay previews. Keep the same video node while the surrounding
   grid expands, so playback does not restart. Native buttons provide touch,
   Enter/Space, visible focus, and an announced expanded state. */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  document.querySelectorAll(".featured-media video, .hb-hero-media video, .dr-hero-media video").forEach(function (video, i) {
    var layout = video.closest(".featured-card, .hb-hero-grid, .dr-hero-grid");
    var frame = video.closest(".brk");
    if (!layout || !frame) return;
    var title = layout.querySelector("h1, h3").textContent.trim();
    var visible = false;
    var requestedPlay = false;
    var loaded = false;
    var rewind = false;
    var restartsOffscreen = !!video.closest(".featured-card");   // home page cards

    video.removeAttribute("autoplay");
    video.controls = false;
    video.id = video.id || "gameplay-preview-" + i;
    frame.classList.add("expandable-media");

    var expand = document.createElement("button");
    expand.type = "button";
    expand.className = "media-expand";
    expand.setAttribute("aria-controls", video.id);
    frame.appendChild(expand);

    // A grid wrapper lets the existing description shrink and return smoothly,
    // instead of disappearing in the first frame of the column transition.
    var copy = layout.querySelector(".featured-body") || layout.firstElementChild;
    var description = document.createElement("div");
    description.className = "preview-description";
    var inner = document.createElement("div");
    var details = copy.querySelectorAll(".featured-sub, p");
    if (details.length) {
      details[0].before(description);
      description.appendChild(inner);
      details.forEach(function (detail) { inner.appendChild(detail); });
    }

    function setExpanded(on) {
      layout.classList.toggle("is-expanded", on);
      expand.setAttribute("aria-expanded", String(on));
      expand.setAttribute("aria-label", (on ? "Collapse " : "Expand ") + title + " video");
      description.setAttribute("aria-hidden", String(on));
    }
    setExpanded(false);
    expand.addEventListener("click", function () {
      setExpanded(!layout.classList.contains("is-expanded"));
      requestedPlay = true;
      start();
    });
    layout.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && layout.classList.contains("is-expanded")) {
        setExpanded(false);
        expand.focus({ preventScroll: true });
      }
    });

    function load() {
      if (loaded) return;
      loaded = true;
      if (video.dataset.src) video.src = video.dataset.src;
      [["srcWebm", "video/webm"], ["srcMp4", "video/mp4"]].forEach(function (entry) {
        if (!video.dataset[entry[0]]) return;
        var source = document.createElement("source");
        source.src = video.dataset[entry[0]];
        source.type = entry[1];
        video.appendChild(source);
      });
      video.load();
    }
    function start() {
      load();
      // Home page: a reel that was scrolled COMPLETELY out of view starts
      // over when it comes back. Any sliver still showing keeps its place.
      if (rewind) {
        rewind = false;
        try { video.currentTime = 0; } catch (e) {}
      }
      var promise = video.play();
      if (promise) promise.catch(function () {});
    }
    function updatePlayback() {
      if (visible && !document.hidden && (!reduced.matches || requestedPlay)) start();
      else video.pause();
    }
    reduced.addEventListener("change", function () {
      requestedPlay = false;
      updatePlayback();
    });
    document.addEventListener("visibilitychange", updatePlayback);
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        updatePlayback();
      }, { threshold: 0.1 });
      observer.observe(video);
      if (restartsOffscreen) {
        // threshold 0: not intersecting means not one pixel is on screen.
        new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting && loaded) rewind = true;
        }, { threshold: 0 }).observe(video);
      }
    } else {
      visible = true;
      updatePlayback();
    }
  });
})();

/* Screenshot lightbox. The thumbnail's own image is copied into a fixed
   layer and flown, by transform alone, from where it sits to its natural
   size in the middle of the viewport; the shade behind fades in on the same
   beat. Closing measures the thumbnail AGAIN — the page may have scrolled —
   and flies back to wherever it is now. */
(function () {
  var shots = document.querySelectorAll(".shot img.art, .dr-shot img.art");
  if (!shots.length) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var open = null;   // { source, img, shade }

  function targetRect(source) {
    var nw = source.naturalWidth || source.width, nh = source.naturalHeight || source.height;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var scale = Math.min(1, (vw * 0.94) / nw, (vh * 0.9) / nh);
    var w = nw * scale, h = nh * scale;
    return { x: (vw - w) / 2, y: (vh - h) / 2, w: w, h: h };
  }
  function place(img, from, to) {
    // `to` is the box the copy is laid out in; `from` is where it appears to be.
    img.style.transform = "translate(" + (from.left - to.x) + "px," + (from.top - to.y) + "px) scale(" +
      (from.width / to.w) + "," + (from.height / to.h) + ")";
  }
  function show(source) {
    if (open) return;
    var to = targetRect(source);
    var shade = document.createElement("div");
    shade.className = "lightbox-shade";
    var img = document.createElement("img");
    img.className = "lightbox-img";
    img.src = source.currentSrc || source.src;
    img.alt = source.alt;
    img.style.width = to.w + "px";
    img.style.height = to.h + "px";
    img.style.left = to.x + "px";
    img.style.top = to.y + "px";
    place(img, source.getBoundingClientRect(), to);
    document.body.appendChild(shade);
    document.body.appendChild(img);
    source.classList.add("is-lightbox-source");
    open = { source: source, img: img, shade: shade, to: to };
    img.getBoundingClientRect();            // commit the start pose
    shade.classList.add("is-on");
    img.style.transform = "none";
    shade.addEventListener("click", hide);
    img.addEventListener("click", hide);
  }
  function hide() {
    if (!open || open.closing) return;
    var o = open;
    o.closing = true;
    function done() {
      if (!o.img.parentNode) return;
      o.source.classList.remove("is-lightbox-source");
      o.img.remove();
      o.shade.remove();
      open = null;
      o.source.focus({ preventScroll: true });
    }
    o.shade.classList.remove("is-on");
    place(o.img, o.source.getBoundingClientRect(), o.to);
    if (reduced.matches) { done(); return; }
    o.img.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 400);                  // a transition that never fires must not strand it
  }

  Array.prototype.forEach.call(shots, function (source) {
    source.tabIndex = 0;
    source.setAttribute("role", "button");
    source.setAttribute("aria-label", "Enlarge screenshot: " + source.alt);
    source.addEventListener("click", function () { show(source); });
    source.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(source); }
    });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  window.addEventListener("resize", hide);
})();
