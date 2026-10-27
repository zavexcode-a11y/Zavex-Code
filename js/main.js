/* ZavexCode — core behaviour: menu, header state, reveal, forms, filters. Works without any animation library. */
"use strict";
window.__zx = true;

(function () {
  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  var menuToggle = document.querySelector(".menu-toggle");
  var navMenu = document.querySelector(".nav-menu");
  var backToTop = document.querySelector(".back-to-top");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- mobile menu ---- */
  function closeMenu() {
    if (!navMenu) return;
    navMenu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
  }
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", function () {
      var isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Open navigation menu" : "Close navigation menu");
      navMenu.classList.toggle("open", !isOpen);
    });
    navMenu.querySelectorAll("a").forEach(function (l) { l.addEventListener("click", closeMenu); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navMenu.classList.contains("open")) { closeMenu(); menuToggle.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) closeMenu();
    });
  }

  /* ---- header + back-to-top state ---- */
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 18);
    if (backToTop) backToTop.classList.toggle("visible", y > 500);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- reveal on scroll (IntersectionObserver; motion.js adds richer effects on top) ---- */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  // stagger siblings
  reveals.forEach(function (el) {
    var sibs = [].slice.call(el.parentElement.children).filter(function (c) { return c.classList.contains("reveal"); });
    var i = sibs.indexOf(el);
    if (sibs.length > 1 && i > 0) el.style.setProperty("--reveal-delay", Math.min(i, 6) * 80 + "ms");
  });
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---- work filter (state lives in the URL hash: #web, #ai ...) ---- */
  var chips = [].slice.call(document.querySelectorAll("[data-filter]"));
  var items = [].slice.call(document.querySelectorAll("[data-cat]"));
  function applyFilter(f) {
    document.dispatchEvent(new Event("zx:filter-before")); // lets fx.js record "first" positions
    var shown = [];
    chips.forEach(function (c) { var on = c.getAttribute("data-filter") === f; c.classList.toggle("is-on", on); c.setAttribute("aria-pressed", String(on)); });
    items.forEach(function (it) {
      var match = f === "all" || it.getAttribute("data-cat") === f;
      it.classList.toggle("is-filtered-out", !match);
      if (match) { shown.push(it); it.classList.add("is-visible"); }
    });
    document.dispatchEvent(new CustomEvent("zx:filtered", { detail: { shown: shown, filter: f } }));
  }
  function filterFromHash() {
    var h = decodeURIComponent(location.hash.replace("#", ""));
    return chips.some(function (c) { return c.getAttribute("data-filter") === h; }) ? h : "all";
  }
  if (chips.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.getAttribute("data-filter");
        applyFilter(f);
        try { history.replaceState(null, "", f === "all" ? location.pathname + location.search : "#" + f); } catch (e) {}
      });
    });
    window.addEventListener("hashchange", function () { applyFilter(filterFromHash()); });
    if (filterFromHash() !== "all") applyFilter(filterFromHash());
  }

  /* ---- forms (contact + software interest): validation, sending state, thank-you redirect ---- */
  function thanksUrl() { return new URL((document.body.getAttribute("data-root") || "") + "thanks.html", location.href).href; }
  var apiRaw = (window.ZX_CONFIG && window.ZX_CONFIG.apiUrl) || "";
  var apiOn = typeof apiRaw === "string" && apiRaw.length > 0; // "" = off, "/" = same domain
  var apiBase = apiRaw.replace(/\/$/, "");

  /* Send the form to our own backend as JSON. Resolves {ok:true} or {ok:false, status, errors, error}. Never rejects. */
  function sendToBackend(form) {
    var data = {};
    new FormData(form).forEach(function (v, k) { if (k.charAt(0) !== "_" || k === "_honey") data[k] = v; });
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 12000);
    return fetch(apiBase + form.getAttribute("data-endpoint"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: ctl.signal })
      .then(function (r) { clearTimeout(timer); return r.json().catch(function () { return {}; }).then(function (j) { j.ok = r.ok && j.ok !== false; j.status = r.status; return j; }); })
      .catch(function () { clearTimeout(timer); return { ok: false, status: 0 }; });
  }

  function setupForm(form) {
    // FormSubmit needs an absolute redirect URL, so it is added here (and only over http/https)
    if (/^https?:/.test(location.protocol) && !form.querySelector('input[name="_next"]')) {
      var next = document.createElement("input");
      next.type = "hidden"; next.name = "_next"; next.value = thanksUrl();
      form.appendChild(next);
    }
    var qs = new URLSearchParams(location.search).get("service");
    var sel = form.querySelector("select[name='service']");
    if (qs && sel) { [].slice.call(sel.options).forEach(function (o) { if (o.text.toLowerCase() === qs.toLowerCase()) sel.value = o.value || o.text; }); }

    var statusEl = form.querySelector(".form-status");
    var button = form.querySelector("button[type='submit']");
    var btnLabel = button ? button.firstChild.textContent : "";
    var fields = [].slice.call(form.querySelectorAll(".form-field")).map(function (wrap) {
      var input = wrap.querySelector("input, select, textarea");
      var label = wrap.querySelector("label");
      return { input: input, error: wrap.querySelector(".field-error"), label: label ? label.textContent : "This field" };
    }).filter(function (f) { return f.input && f.error; });

    function fieldError(f) {
      var v = f.input.value.trim();
      if (!v) return f.label + " is required.";
      if (f.input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
      var min = parseInt(f.input.getAttribute("data-min") || "0", 10);
      if (min && v.length < min) return "Please enter at least " + min + " characters.";
      return "";
    }
    function validate(f) {
      var msg = fieldError(f);
      f.error.textContent = msg;
      f.input.setAttribute("aria-invalid", String(Boolean(msg)));
      return !msg;
    }
    fields.forEach(function (f) {
      f.input.addEventListener("blur", function () { validate(f); });
      ["input", "change"].forEach(function (ev) {
        f.input.addEventListener(ev, function () { if (f.input.getAttribute("aria-invalid") === "true") validate(f); });
      });
    });
    form.addEventListener("submit", function (e) {
      statusEl.textContent = ""; statusEl.style.color = "";
      var ok = fields.map(validate).every(Boolean);
      if (!ok) {
        e.preventDefault();
        form.querySelector('[aria-invalid="true"]').focus();
        statusEl.textContent = "Please review the highlighted fields.";
        statusEl.style.color = "#ff9aa2";
        return;
      }
      statusEl.textContent = "Sending your message…";
      if (button) { button.disabled = true; button.classList.add("is-sending"); button.firstChild.textContent = "Sending… "; }
      if (!apiOn || !form.getAttribute("data-endpoint")) return; // backend off: normal FormSubmit post
      e.preventDefault();
      sendToBackend(form).then(function (res) {
        if (res.ok) { location.href = thanksUrl(); return; }
        if (res.status === 400 || res.status === 429) { // the server answered: show its message, let the visitor fix it
          statusEl.textContent = res.status === 429 ? "Too many requests. Please try again in a few minutes." : "Please review the form and try again.";
          statusEl.style.color = "#ff9aa2";
          if (res.errors) fields.forEach(function (f) { var name = f.input.name; if (res.errors[name]) { f.error.textContent = res.errors[name]; f.input.setAttribute("aria-invalid", "true"); } });
          if (button) { button.disabled = false; button.classList.remove("is-sending"); button.firstChild.textContent = btnLabel; }
          return;
        }
        // backend unreachable or broken: fall back to FormSubmit so the message is never lost
        HTMLFormElement.prototype.submit.call(form);
      });
    });
    // back/forward cache: never leave the button stuck in "sending"
    window.addEventListener("pageshow", function () { if (button) { button.disabled = false; button.classList.remove("is-sending"); button.firstChild.textContent = btnLabel; } });
  }
  [].slice.call(document.querySelectorAll("form.contact-form")).forEach(setupForm);
})();
