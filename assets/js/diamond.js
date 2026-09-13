/* Heavy Bag: the diamond, built and animated the way the in-game Controls
   page does it. Geometry is the game's (diamond.json: S=260, gap 12,
   triangle height 140, stroke 6 on a 1160x760 canvas centred at 580,380);
   the choreography follows ControlsPageNode: square grows (475 ms) →
   rotates 45° (375 ms) → fractures into the 8 zones that slide from their
   packed spots to their final ones (400 ms); slider and Line fade in over
   that; then dots (1.6 s), leader lines (1.6–2.1 s), arrowheads (2.1 s)
   and labels (2.0–2.6 s). Replay rebuilds it. Under prefers-reduced-motion
   the finished figure is drawn straight away. */
(function () {
  var host = document.getElementById("hb-diamond");
  if (!host) return;
  var NS = "http://www.w3.org/2000/svg";
  var CX = 580, CY = 380, S = 260, G = 12, H = 140, STROKE = 6;
  var hS = S / 2, hG = G / 2;
  var cutX = (hS + G) + H * (1 - G / S);
  var COLORS = { head: "#FF6B6B", body: "#FFD93D", legs: "#4D6BFF" };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Zone polygons in the game's local space (y up), plus packed offsets.
  var ZONES = {
    topRect:       { poly: [[-hS, hG], [hS, hG], [hS, hS], [-hS, hS]], pack: [0, -G / 2] },
    bottomRect:    { poly: [[-hS, -hS], [hS, -hS], [hS, -hG], [-hS, -hG]], pack: [0, G / 2] },
    topTri:        { poly: [[-hS, hS + G], [hS, hS + G], [0, hS + G + H]], pack: [0, -G] },
    bottomTri:     { poly: [[-hS, -(hS + G)], [hS, -(hS + G)], [0, -(hS + G + H)]], pack: [0, G] },
    rightTriUpper: { poly: [[hS + G, hS], [hS + G, hG], [cutX, hG]], pack: [-G, -G / 2] },
    rightTriLower: { poly: [[hS + G, -hS], [hS + G, -hG], [cutX, -hG]], pack: [-G, G / 2] },
    leftTriUpper:  { poly: [[-(hS + G), hS], [-(hS + G), hG], [-cutX, hG]], pack: [G, -G / 2] },
    leftTriLower:  { poly: [[-(hS + G), -hS], [-(hS + G), -hG], [-cutX, -hG]], pack: [G, G / 2] }
  };
  var CALLOUTS = [
    [[580, 191.33], [580, 74]], [[580, 568.67], [580, 686]],
    [[766.51, 332.67], [900, 332.67]], [[766.51, 427.33], [900, 427.33]],
    [[393.49, 332.67], [260, 332.67]], [[393.49, 427.33], [260, 427.33]]
  ];
  var LABELS = [
    ["LEAD UPPERCUT", 580, 26, 1, "middle"], ["Swipe up ANYWHERE", 580, 50, 0, "middle"],
    ["REAR UPPERCUT", 580, 728, 1, "middle"], ["Swipe down ANYWHERE", 580, 752, 0, "middle"],
    ["LEAD HOOK", 928, 328, 1, "start"], ["Swipe right ANYWHERE above line", 928, 354, 0, "start"],
    ["LEAD KICK", 928, 422, 1, "start"], ["Swipe right ANYWHERE below line", 928, 448, 0, "start"],
    ["REAR HOOK", 232, 328, 1, "end"], ["Swipe left ANYWHERE above line", 232, 354, 0, "end"],
    ["REAR KICK", 232, 422, 1, "end"], ["Swipe left ANYWHERE below line", 232, 448, 0, "end"],
    ["JAB", 580, 296, 1, "middle"], ["Tap ANYWHERE", 580, 322, 0, "middle"], ["above line", 580, 346, 0, "middle"],
    ["CROSS", 580, 432, 1, "middle"], ["Tap ANYWHERE", 580, 458, 0, "middle"], ["below line", 580, 482, 0, "middle"]
  ];

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(n);
    return n;
  }
  function toSvg(p) { return (CX + p[0]) + "," + (CY - p[1]); }
  function fadeIn(node, at, dur) {
    if (reduce) { node.setAttribute("opacity", "1"); return; }
    node.setAttribute("opacity", "0");
    node.animate([{ opacity: 0 }, { opacity: 1 }], { delay: at, duration: dur, fill: "forwards", easing: "ease-out" });
  }

  var svg;
  function build() {
    host.innerHTML = "";
    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1160 760");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Heavy Bag's control diamond: eight cue zones, the Head/Body/Legs slider and the Line, each labelled with its gesture");
    host.appendChild(svg);
    el("rect", { x: 0, y: 0, width: 1160, height: 760, fill: "#000" });

    // --- Slider (left) and the Line (right), fading in over the assembly.
    var chrome = el("g", {});
    var sx = 1160 * 0.07, trackH = 760 * 0.41;
    el("rect", { x: sx - 1.5, y: CY - trackH / 2, width: 3, height: trackH, fill: "#fff", opacity: 0.38 }, chrome);
    [["Head", COLORS.head, CY - trackH / 2], ["Body", COLORS.body, CY], ["Leg", COLORS.legs, CY + trackH / 2]].forEach(function (r) {
      el("circle", { cx: sx, cy: r[2], r: 10, fill: r[1], stroke: "rgba(0,0,0,.55)", "stroke-width": 2 }, chrome);
      var t = el("text", { x: sx + 20, y: r[2], fill: "#fff", "font-size": 13, "font-weight": 700,
        "dominant-baseline": "middle", "font-family": "Helvetica, Arial, sans-serif" }, chrome);
      t.textContent = r[0];
    });
    el("rect", { x: 1160 - 1160 * 0.09, y: CY - 1.5, width: 1160 * 0.09, height: 3, fill: "#fff", opacity: 0.6 }, chrome);
    var lineLabel = el("text", { x: 1160 - 8, y: CY - 8, fill: "#fff", "font-size": 12, "font-weight": 700,
      "text-anchor": "end", "font-family": "Helvetica, Arial, sans-serif" }, chrome);
    lineLabel.textContent = "The Line";
    fadeIn(chrome, 0, 1600);

    // --- The intro square: grows, rotates 45°, then hands over to the zones.
    var side = (hS + H) * Math.SQRT2;
    var square = el("rect", { x: CX - side / 2, y: CY - side / 2, width: side, height: side,
      fill: "none", stroke: "#fff", "stroke-width": STROKE, "stroke-linejoin": "round" });
    if (!reduce) {
      square.style.transformOrigin = CX + "px " + CY + "px";
      square.animate([{ transform: "scale(0.001) rotate(0deg)" }, { transform: "scale(1) rotate(0deg)" }],
        { duration: 475, fill: "forwards", easing: "ease-out" });
      square.animate([{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1) rotate(45deg)" }],
        { delay: 475, duration: 375, fill: "forwards", easing: "ease-in-out" });
      square.animate([{ opacity: 1 }, { opacity: 0 }], { delay: 850, duration: 1, fill: "forwards" });
    } else {
      square.setAttribute("opacity", "0");
    }

    // --- The eight zones: packed at 850 ms, separated by 1250 ms.
    var zones = el("g", {});
    Object.keys(ZONES).forEach(function (key) {
      var z = ZONES[key];
      var poly = el("polygon", { points: z.poly.map(toSvg).join(" "), fill: "none", stroke: "#fff",
        "stroke-width": STROKE, "stroke-linejoin": "round" }, zones);
      if (reduce) return;
      poly.setAttribute("opacity", "0");
      var dx = z.pack[0], dy = -z.pack[1];   // local y-up → svg y-down
      poly.animate([{ opacity: 0, transform: "translate(" + dx + "px," + dy + "px)" },
                    { opacity: 1, transform: "translate(" + dx + "px," + dy + "px)", offset: 0.01 },
                    { opacity: 1, transform: "translate(0px,0px)" }],
        { delay: 850, duration: 400, fill: "forwards", easing: "ease-out" });
    });

    // --- Annotations: dots → leaders → arrowheads → labels.
    CALLOUTS.forEach(function (c) {
      var dot = c[0], tip = c[1];
      var dx = tip[0] - dot[0], dy = tip[1] - dot[1], len = Math.hypot(dx, dy);
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var d = el("circle", { cx: dot[0], cy: dot[1], r: 6, fill: "#fff" });
      fadeIn(d, 1600, 260);
      var bar = el("rect", { x: 0, y: -1.5, width: len, height: 3, fill: "#fff",
        transform: "translate(" + dot[0] + " " + dot[1] + ") rotate(" + ang + ")" });
      if (!reduce) {
        bar.setAttribute("opacity", "0");
        bar.style.transformOrigin = "0px 0px";
        bar.style.transformBox = "fill-box";
        bar.animate([{ opacity: 0, transform: "scaleX(0.001)" }, { opacity: 1, transform: "scaleX(0.001)", offset: 0.1 }, { opacity: 1, transform: "scaleX(1)" }],
          { delay: 1600, duration: 500, fill: "forwards", easing: "ease-out" });
      }
      var head = el("polygon", { points: "0,8 0,-8 16,0", fill: "#fff",
        transform: "translate(" + tip[0] + " " + tip[1] + ") rotate(" + ang + ")" });
      fadeIn(head, 2110, 260);
    });
    LABELS.forEach(function (l) {
      var t = el("text", { x: l[1], y: l[2], fill: "#fff", "text-anchor": l[4],
        "font-size": l[3] ? 24 : 22, "font-weight": l[3] ? 700 : 400,
        "font-family": "Helvetica, Arial, sans-serif" });
      t.textContent = l[0];
      fadeIn(t, 1980, 580);
    });
  }

  build();
  var btn = document.getElementById("hb-diamond-replay");
  if (btn) btn.addEventListener("click", function () { reduce = false; build(); });
})();
