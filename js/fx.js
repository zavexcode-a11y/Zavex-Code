/* ZavexCode — extra effects. Each feature is its own function; set a flag to false to switch it off.
   Everything here is optional: the site works with this file missing, with JS off, and with reduced motion. */
(function () {
  "use strict";
  var FEATURES = { headerAutoHide: true, navIndicator: true, viewCursor: true, flipFilter: true };

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* 1. Header hides after 120px of downward scroll, returns on any upward scroll.
        Never hides while the mobile menu or dropdown is open, or a link has keyboard focus. */
  function headerAutoHide() {
    var header = $(".site-header");
    if (!header || reduce) return;
    var last = window.scrollY, ticking = false;
    function blocked() {
      return !!($(".nav-menu.open") || $(".has-sub.open") || header.querySelector(":focus-visible"));
    }
    function update() {
      ticking = false;
      var y = window.scrollY, dy = y - last;
      if (y <= 120 || dy < -2 || blocked()) header.classList.remove("header-hidden");
      else if (dy > 2) header.classList.add("header-hidden");
      last = y;
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    header.addEventListener("focusin", function () { header.classList.remove("header-hidden"); });
  }

  /* 2. One gradient underline that slides between nav links and rests under the current page. */
  function navIndicator() {
    var menu = $(".nav-menu");
    if (!menu) return;
    var links = $$(".nav-menu > .nav-link, .nav-menu > .nav-item > .nav-link");
    if (!links.length) return;
    var bar = document.createElement("span");
    bar.className = "nav-indicator"; bar.setAttribute("aria-hidden", "true");
    menu.appendChild(bar);
    menu.classList.add("has-indicator");
    var current = $(".nav-link.active", menu);
    function moveTo(link) {
      if (!link) { bar.style.opacity = "0"; return; }
      var m = menu.getBoundingClientRect(), r = link.getBoundingClientRect();
      bar.style.opacity = "1";
      bar.style.transform = "translate(" + (r.left - m.left) + "px," + (r.bottom - m.top + 8) + "px) scaleX(" + (r.width / 100) + ")";
    }
    function rest() { moveTo(current); }
    links.forEach(function (l) {
      l.addEventListener("mouseenter", function () { moveTo(l); });
      l.addEventListener("focus", function () { moveTo(l); });
    });
    menu.addEventListener("mouseleave", rest);
    menu.addEventListener("focusout", function (e) { if (!menu.contains(e.relatedTarget)) rest(); });
    bar.style.transition = "none"; rest(); void bar.offsetWidth; bar.style.transition = "";
    window.addEventListener("resize", function () { bar.style.transition = "none"; rest(); void bar.offsetWidth; bar.style.transition = ""; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { bar.style.transition = "none"; rest(); void bar.offsetWidth; bar.style.transition = ""; });
  }

  /* 3. "View" label inside the cursor ring on [data-cursor] elements (desktop with the custom cursor only). */
  function viewCursor() {
    var ring = $(".cursor-ring");
    if (!ring || !root.classList.contains("motion-on")) return;
    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest && e.target.closest("[data-cursor]");
      if (t) { ring.setAttribute("data-label", t.getAttribute("data-cursor")); root.classList.add("cursor-view"); }
      else root.classList.remove("cursor-view");
    });
    document.addEventListener("pointerleave", function () { root.classList.remove("cursor-view"); });
  }

  /* 4. FLIP: cards slide from their old position to their new one when the filter changes. */
  function flipFilter() {
    if (reduce || !("animate" in Element.prototype)) return;
    var first = new Map();
    var ease = "cubic-bezier(.2,.7,.2,1)";
    document.addEventListener("zx:filter-before", function () {
      first.clear();
      $$("[data-cat]").forEach(function (el) { if (!el.classList.contains("is-filtered-out")) first.set(el, el.getBoundingClientRect()); });
    });
    document.addEventListener("zx:filtered", function (e) {
      e.detail.shown.forEach(function (el, i) {
        var f = first.get(el), l = el.getBoundingClientRect();
        if (f) {
          var dx = f.left - l.left, dy = f.top - l.top;
          if (dx || dy) el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: 650, easing: ease });
        } else {
          el.animate([{ opacity: 0, transform: "translateY(26px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 550, delay: 120 + i * 60, easing: ease, fill: "backwards" });
        }
      });
      first.clear();
    });
  }

  [headerAutoHide, navIndicator, viewCursor, flipFilter].forEach(function (fn) {
    var key = fn.name;
    if (!FEATURES[key]) return;
    try { fn(); } catch (err) { if (window.console) console.warn("[fx] " + key, err); }
  });
})();
