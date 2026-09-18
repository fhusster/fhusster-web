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
    var userPaused = false;
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
    expand.innerHTML = '<span class="media-expand-label"></span>';
    frame.appendChild(expand);

    var play = document.createElement("button");
    play.type = "button";
    play.className = "media-play";
    frame.appendChild(play);

    function setExpanded(on) {
      layout.classList.toggle("is-expanded", on);
      expand.setAttribute("aria-expanded", String(on));
      expand.setAttribute("aria-label", (on ? "Collapse " : "Expand ") + title + " video");
      expand.firstChild.textContent = on ? "↙  Collapse" : "↗  Expand";
    }
    setExpanded(false);
    expand.addEventListener("click", function () {
      setExpanded(!layout.classList.contains("is-expanded"));
    });
    layout.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && layout.classList.contains("is-expanded")) {
        setExpanded(false);
        expand.focus({ preventScroll: true });
      }
    });

    function syncPlayButton() {
      play.textContent = video.paused ? "▶  Play" : "Ⅱ  Pause";
      play.setAttribute("aria-label", (video.paused ? "Play " : "Pause ") + title + " video");
    }
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
      if (promise) promise.catch(syncPlayButton);
    }
    function updatePlayback() {
      if (visible && !document.hidden && !userPaused && (!reduced.matches || requestedPlay)) start();
      else video.pause();
    }
    play.addEventListener("click", function () {
      if (video.paused) {
        userPaused = false;
        requestedPlay = true;
        start();
      } else {
        userPaused = true;
        video.pause();
      }
    });
    video.addEventListener("play", syncPlayButton);
    video.addEventListener("pause", syncPlayButton);
    syncPlayButton();
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
