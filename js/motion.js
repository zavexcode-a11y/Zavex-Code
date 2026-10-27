/* ZavexCode — motion engine (GSAP + ScrollTrigger + Lenis).
   Everything here is progressive enhancement: if the libraries fail to load, or the visitor
   prefers reduced motion, the site is fully visible and usable without it. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  function clearCovers() {
    root.classList.remove("is-loading", "is-entering", "motion-on");
    $$(".preloader, .page-curtain, .scroll-progress").forEach(function (e) { e.remove(); });
  }
  function fireReady() { document.dispatchEvent(new Event("zx:ready")); }

  if (reduce || typeof window.gsap === "undefined" || typeof window.ScrollTrigger === "undefined") {
    clearCovers(); fireReady();
    return;
  }

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  var safe = function (fn) { try { fn(); } catch (err) { if (window.console) console.warn("[motion]", err); } };

  /* ---------- smooth scrolling (Lenis) ---------- */
  var lenis = null;
  safe(function () {
    if (!window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  });
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: target === 0 ? 0 : -80, duration: 1.2 });
    else if (target === 0) window.scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='#']");
    if (!a || e.defaultPrevented) return;
    var h = a.getAttribute("href");
    var target = h === "#top" || h === "#" ? 0 : $(h);
    if (target === null) return;
    e.preventDefault();
    scrollToTarget(target);
  });

  /* ---------- overlays: preloader (first visit) / page-curtain (between pages) ---------- */
  var curtain = $(".page-curtain");
  var preloader = $(".preloader");
  var bar = $(".scroll-progress");
  if (curtain) gsap.set(curtain, { yPercent: root.classList.contains("is-entering") ? 0 : 100, autoAlpha: 1 });

  // "ready" may fire before the hero code below has been set up (reloads, repeat visits), so callbacks are queued
  var readyFired = false, readyQueue = [];
  function ready() { if (readyFired) return; readyFired = true; readyQueue.splice(0).forEach(function (fn) { safe(fn); }); fireReady(); }
  function onReady(fn) { if (readyFired) safe(fn); else readyQueue.push(fn); }

  try { sessionStorage.removeItem("zx-nav"); sessionStorage.setItem("zx-seen", "1"); } catch (e) {}

  if (preloader && root.classList.contains("is-loading")) {
    var count = $(".pl-count", preloader), fill = $(".pl-bar i", preloader), logo = $("img", preloader);
    var o = { v: 0 };
    root.classList.remove("is-loading");
    gsap.timeline({ defaults: { ease: "power2.inOut" } })
      .from(logo, { autoAlpha: 0, y: 14, duration: 0.5 })
      .to(o, { v: 100, duration: 1.1, onUpdate: function () { count.textContent = Math.round(o.v); } }, 0.1)
      .to(fill, { scaleX: 1, duration: 1.1 }, 0.1)
      .to([count, logo, fill.parentNode], { autoAlpha: 0, y: -10, duration: 0.35, stagger: 0.04 }, "+=0.1")
      .to(preloader, { yPercent: -100, duration: 0.85, ease: "expo.inOut", onStart: function () { setTimeout(ready, 380); } })
      .add(function () { preloader.remove(); ready(); });
  } else if (curtain && root.classList.contains("is-entering")) {
    root.classList.remove("is-entering");
    gsap.to(curtain, { yPercent: -100, duration: 0.8, ease: "expo.inOut", delay: 0.05, onStart: function () { setTimeout(ready, 250); }, onComplete: function () { ready(); gsap.set(curtain, { yPercent: 100 }); } });
  } else {
    root.classList.remove("is-loading", "is-entering");
    ready();
  }
  setTimeout(ready, 4500); // never leave hero content hidden

  /* ---------- page transitions ---------- */
  var leaving = false;
  document.addEventListener("click", function (e) {
    if (leaving || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || !curtain) return;
    if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.protocol !== location.protocol || url.host !== location.host) return;
    if (!/^(https?|file):$/.test(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash
    e.preventDefault();
    leaving = true;
    try { sessionStorage.setItem("zx-nav", "1"); } catch (err) {}
    curtain.style.pointerEvents = "auto";
    gsap.to(curtain, { yPercent: 0, duration: 0.6, ease: "expo.inOut", onComplete: function () { location.href = url.href; } });
    setTimeout(function () { location.href = url.href; }, 1500); // failsafe
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) { leaving = false; gsap.set(curtain, { yPercent: 100 }); curtain.style.pointerEvents = "none"; }
  });

  /* ---------- scroll progress bar ---------- */
  if (bar) gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.2 } });

  /* ---------- split text ---------- */
  function split(el) {
    if (el.getAttribute("data-split-done")) return [];
    el.setAttribute("data-split-done", "1");
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    var words = [];
    (function walk(node, grad) {
      [].slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
            var i = document.createElement("span"); i.className = "wi" + (grad ? " gradient-text" : "");
            i.textContent = part; w.appendChild(i); frag.appendChild(w); words.push(i);
          });
          ch.parentNode.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== "BR") {
          var g = grad || ch.classList.contains("gradient-text");
          ch.classList.remove("gradient-text");
          walk(ch, g);
        }
      });
    })(el, false);
    return words;
  }
  function playWords(words, vars) {
    return gsap.fromTo(words, { yPercent: 115, rotate: 4 }, Object.assign({ yPercent: 0, rotate: 0, duration: 1, ease: "expo.out", stagger: 0.055 }, vars || {}));
  }

  var heroItems = $$("[data-hero-item]");
  var heroSplit = [];
  $$("[data-split]").forEach(function (el) {
    var words = split(el);
    var inHero = el.hasAttribute("data-hero-item");
    gsap.set(words, { yPercent: 115, rotate: 4 });
    gsap.set(el, { opacity: 1 });
    if (inHero) { heroSplit.push(words); return; }
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: function () { playWords(words); } });
  });

  /* ---------- hero entrance ---------- */
  var heroPlayed = false;
  onReady(function () {
    heroPlayed = true;
    var plain = heroItems.filter(function (el) { return !el.hasAttribute("data-split"); });
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    heroSplit.forEach(function (w) { tl.add(playWords(w), 0); });
    if (plain.length) tl.fromTo(plain, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1, stagger: 0.1, clearProps: "transform" }, 0.15);
    // hero art children: opacity only (their transform is owned by CSS animations)
    var art = $$(".hero-art .float-card, .hero-art .core-orb, .hero-art .orbit, .hero-art .art-spark");
    if (art.length) tl.fromTo(art, { opacity: 0 }, { opacity: 1, duration: 1.2, stagger: 0.12, ease: "power2.out", clearProps: "opacity" }, 0.3);
  });
  // failsafe: if the hero entrance never ran, show the hero as it is
  setTimeout(function () {
    if (heroPlayed) return;
    heroItems.forEach(function (el) { el.style.opacity = 1; });
    heroSplit.forEach(function (words) { gsap.set(words, { yPercent: 0, rotate: 0 }); });
  }, 6500);

  /* ---------- hero mouse parallax (CSS vars drive the `translate` property) ---------- */
  var heroArt = $(".hero-art");
  if (heroArt && fine) {
    var pos = { x: 0, y: 0 };
    var apply = function () { heroArt.style.setProperty("--px", pos.x.toFixed(3)); heroArt.style.setProperty("--py", pos.y.toFixed(3)); };
    var hero = heroArt.closest(".hero") || heroArt;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      gsap.to(pos, { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5, duration: 0.9, ease: "power3.out", overwrite: true, onUpdate: apply });
    });
    hero.addEventListener("pointerleave", function () { gsap.to(pos, { x: 0, y: 0, duration: 1.2, ease: "power3.out", overwrite: true, onUpdate: apply }); });
  }

  /* ---------- counters ---------- */
  $$("[data-count]").forEach(function (el) {
    var end = parseFloat(el.getAttribute("data-count")) || 0, o = { v: 0 };
    el.textContent = "0";
    ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: function () {
      gsap.to(o, { v: end, duration: 1.6, ease: "power2.out", onUpdate: function () { el.textContent = Math.round(o.v); } });
    } });
  });

  /* ---------- pinned horizontal services (desktop only) ---------- */
  var hs = $(".hscroll");
  if (hs) {
    var mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", function () {
      var track = $(".hscroll-track", hs), pin = $(".hscroll-pin", hs), prog = $(".hscroll-progress i", hs), cnt = $(".hscroll-count b", hs);
      hs.classList.add("hs-on");
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, { x: function () { return -dist(); }, ease: "none" });
      var st = ScrollTrigger.create({
        trigger: hs, start: "top top", end: function () { return "+=" + dist(); },
        pin: pin, pinSpacing: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, animation: tween,
        onUpdate: function (self) {
          if (prog) gsap.set(prog, { scaleX: self.progress });
          if (cnt) { var n = track.children.length, i = Math.min(n, Math.floor(self.progress * n) + 1); cnt.textContent = (i < 10 ? "0" : "") + i; }
        }
      });
      return function () { hs.classList.remove("hs-on"); gsap.set(track, { clearProps: "all" }); if (prog) gsap.set(prog, { clearProps: "all" }); if (cnt) cnt.textContent = "01"; st.kill(); tween.kill(); };
    });
  }

  /* ---------- process: line draws, steps light up ---------- */
  $$(".process-grid").forEach(function (grid) {
    var line = $(".process-line i", grid);
    if (line) gsap.to(line, { scaleX: 1, ease: "none", scrollTrigger: { trigger: grid, start: "top 70%", end: "bottom 60%", scrub: 0.6 } });
    $$(".process-step", grid).forEach(function (step) {
      ScrollTrigger.create({ trigger: step, start: "top 72%", onEnter: function () { step.classList.add("is-active"); }, onLeaveBack: function () { step.classList.remove("is-active"); } });
    });
  });

  /* ---------- magnetic buttons ---------- */
  if (fine) {
    $$("[data-magnetic], .button-primary").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.35, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", function () { gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.45)" }); });
    });

    /* ---------- card tilt ---------- */
    $$("[data-tilt]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(el, { rotationY: px * 9, rotationX: -py * 9, transformPerspective: 900, duration: 0.45, ease: "power2.out" });
      });
      el.addEventListener("pointerleave", function () { gsap.to(el, { rotationX: 0, rotationY: 0, duration: 0.8, ease: "power3.out" }); });
    });

    /* ---------- custom cursor ---------- */
    var dot = $(".cursor-dot"), ring = $(".cursor-ring");
    if (dot && ring) {
      var dx = gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3" }), dy = gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3" });
      var rx = gsap.quickTo(ring, "x", { duration: 0.4, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.4, ease: "power3" });
      window.addEventListener("pointermove", function (e) { root.classList.add("cursor-on"); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
      document.addEventListener("pointerleave", function () { root.classList.remove("cursor-on"); });
      document.addEventListener("pointerover", function (e) { root.classList.toggle("cursor-hover", !!(e.target.closest && e.target.closest("a, button, summary, .chip, [data-tilt]"))); });
    }
  }

  /* ---------- filter: layout changed, so recalculate scroll triggers ---------- */
  document.addEventListener("zx:filtered", function () { setTimeout(function () { ScrollTrigger.refresh(); }, 700); });

  /* ---------- refresh once everything has loaded ---------- */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
