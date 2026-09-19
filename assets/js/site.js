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

/* Keep the four header clouds in one non-overlapping convoy. Every time a
   cloud loops behind the others it receives a new gap; some gaps are exactly
   zero so neighbouring cloud edges can meet naturally. */
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
    if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(animate);
  }

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { layout(); updateMotion(); }, 120);
  }, { passive: true });
  document.addEventListener("visibilitychange", updateMotion);
  reduced.addEventListener("change", function () { layout(); updateMotion(); });
  layout();
  updateMotion();
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
    } else {
      visible = true;
      updatePlayback();
    }
  });
})();
