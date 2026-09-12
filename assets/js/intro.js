/* Fhusster intro, ported from fhusster-intro.html.
   Runs only when the inline <head> script has set html.intro-pending
   (once per session + no prefers-reduced-motion). The heavy asset file
   (intro-assets.js: FRAMES, EMBLEM_SRC, LETTERS — byte-for-byte copies of
   the originals) is loaded on demand so returning visitors never fetch it. */
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("intro-pending")) return;

  /* Mark seen as soon as the intro is committed to, so it plays exactly once
     per session (sessionStorage: a new tab or browser start plays it again). */
  try { sessionStorage.setItem("fhusster_intro_seen", "1"); } catch (e) {}

  var script = document.createElement("script");
  script.src = "assets/js/intro-assets.js";
  script.onload = function () { runIntro(); };
  script.onerror = function () { finish(true); };
  document.head.appendChild(script);

  function runIntro() {
    var intro = document.getElementById("intro");
    if (!intro || typeof FRAMES === "undefined") { finish(true); return; }

    /* Build the stage (same structure as the original file). */
    var stage = document.createElement("div");
    stage.className = "intro-stage";

    var emblem = document.createElement("div");
    emblem.className = "emblem";
    var seq = document.createElement("img");
    seq.className = "seq";
    seq.alt = "";
    var finalimg = document.createElement("img");
    finalimg.className = "finalimg";
    finalimg.alt = "";
    finalimg.src = EMBLEM_SRC;
    emblem.appendChild(seq);
    emblem.appendChild(finalimg);

    var word = document.createElement("div");
    word.className = "word";
    LETTERS.forEach(function (L) {
      var img = document.createElement("img");
      img.className = "letter";
      img.alt = "";
      img.style.left = L.left;
      img.style.top = L.top;
      img.style.width = L.width;
      img.style.setProperty("--d", L.d);
      img.src = L.src;
      word.appendChild(img);
    });

    stage.appendChild(emblem);
    stage.appendChild(word);
    intro.appendChild(stage);

    /* ---- original timing constants, preserved ---- */
    var FORM_MS = 540;      // formation
    var DOCK_AT = 840;      // small pause after forming, then slide left
    var OUTRO_AT = 2300;
    var OUTRO_MS = 800;

    var CENTER = "translate(calc(0.2422 * var(--sw)), calc(-0.0037 * var(--sh)))";
    var GROW_END = 0.90;    // reaches full size ~4 frames before the end
    var easeInOut = function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };

    var imgs = FRAMES.map(function (s) { var i = new Image(); i.src = s; return i; });

    var start = null;
    seq.src = FRAMES[0];
    emblem.style.transform = CENTER + " scale(0.3)";
    function tick(t) {
      if (start === null) start = t;
      var el = t - start;
      if (el < FORM_MS) {
        var p = el / FORM_MS;
        seq.src = FRAMES[Math.min(FRAMES.length - 1, Math.floor(p * FRAMES.length))];
        var s = 0.3 + 0.7 * easeInOut(Math.min(1, p / GROW_END));
        emblem.style.transform = CENTER + " scale(" + s.toFixed(4) + ")";
      } else {
        seq.src = FRAMES[FRAMES.length - 1];
        emblem.style.transform = CENTER;      // full size during the hold
        if (el >= DOCK_AT) {
          emblem.style.transform = "";        // hand off to CSS for the slide
          emblem.classList.add("docked");
          return;
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    /* Outro: stage fades into white, then the site slides up over it. */
    setTimeout(function () {
      stage.style.transition = "opacity " + OUTRO_MS + "ms ease-in-out";
      stage.style.opacity = 0;
    }, OUTRO_AT);
    setTimeout(function () { finish(false); }, OUTRO_AT + OUTRO_MS);
  }

  function finish(instant) {
    var intro = document.getElementById("intro");
    if (instant) {
      root.classList.remove("intro-pending");
      if (intro) intro.remove();
      return;
    }
    root.classList.add("site-enter");   // .site: translateY(100vh) -> 0, .7s ease-out
    var done = false;
    function end() {
      if (done) return;
      done = true;
      root.classList.remove("intro-pending");
      root.classList.remove("site-enter");
      if (intro) intro.remove();
    }
    var site = document.querySelector(".site");
    if (site) {
      site.addEventListener("transitionend", function (e) {
        /* Only the .site slide itself may finish the sequence; transitionend
           bubbles up from children and would otherwise end it early. */
        if (e.target === site && e.propertyName === "transform") end();
      });
    }
    setTimeout(end, 900); // fallback if transitionend never fires
  }
})();
