/* ZavexCode — shared layout. Edit the header, footer and floating buttons HERE, once. */
(function () {
  "use strict";
  var body = document.body;
  var ROOT = body.getAttribute("data-root") || "";
  var PAGE = body.getAttribute("data-page") || "";
  var WA = "https://wa.me/923132649877?text=Hi%20ZavexCode%2C%20I%27d%20like%20to%20discuss%20a%20project.";
  var LOGO = ROOT + "img/zavexcode-logo.png";
  var u = function (p) { return ROOT + p; };

  // Main nav: 5 items. About and Team live in the footer.
  var nav = [
    ["home", "Home", "index.html"],
    ["services", "Services", "services/index.html"],
    ["work", "Work", "work/index.html"],
    ["pricing", "Pricing", "pricing.html"],
    ["contact", "Contact", "contact.html"]
  ];

  var services = [
    ["Website Development", "services/web-development.html", "fa-laptop-code"],
    ["AI Chatbot Development", "services/ai-chatbots.html", "fa-comments"],
    ["AI & Workflow Automation", "services/automation.html", "fa-diagram-project"],
    ["SEO Services", "services/seo.html", "fa-chart-line"]
  ];

  var navHtml = nav.map(function (n) {
    var on = n[0] === PAGE;
    var link = '<a class="nav-link' + (on ? " active" : "") + '" href="' + u(n[2]) + '"' + (on ? ' aria-current="page"' : "") + ">" + n[1] + "</a>";
    if (n[0] !== "services") return link;
    return '<div class="nav-item has-sub">' + link +
      '<button class="sub-toggle" type="button" aria-expanded="false" aria-controls="sub-services" aria-label="Services menu"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>' +
      '<div class="submenu" id="sub-services">' +
      services.map(function (s) { return '<a class="sub-link" href="' + u(s[1]) + '"><i class="fa-solid ' + s[2] + '" aria-hidden="true"></i>' + s[0].replace("&", "&amp;") + "</a>"; }).join("") +
      '<a class="sub-link sub-all" href="' + u("services/index.html") + '">All services <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></div></div>';
  }).join("");

  var header =
    '<a class="skip-link" href="#main">Skip to content</a>' +
    '<header class="site-header" id="top"><nav class="nav container" aria-label="Main navigation">' +
    '<a class="brand" href="' + u("index.html") + '" aria-label="ZavexCode home"><img class="brand-logo" src="' + LOGO + '" alt="ZavexCode — Innovating the Future" width="104" height="57"></a>' +
    '<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-menu" aria-label="Open navigation menu"><span></span><span></span></button>' +
    '<div class="nav-menu" id="primary-menu">' + navHtml +
    '<a class="button button-small button-primary nav-cta" data-magnetic href="' + u("contact.html") + '">Let’s Talk <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' +
    "</div></nav></header>";

  var footer =
    '<footer class="site-footer"><div class="container footer-main">' +
    '<div class="footer-brand"><a class="brand" href="' + u("index.html") + '" aria-label="ZavexCode home"><img class="brand-logo" src="' + LOGO + '" alt="ZavexCode — Innovating the Future" loading="lazy"></a><p>Thoughtful digital solutions for businesses ready to move forward.</p></div>' +
    '<div class="footer-column"><h3>Explore</h3><a href="' + u("index.html") + '">Home</a><a href="' + u("about.html") + '">About</a><a href="' + u("work/index.html") + '">Work</a><a href="' + u("team.html") + '">Our team</a><a href="' + u("pricing.html") + '">Pricing</a><a href="' + u("contact.html") + '">Contact</a></div>' +
    '<div class="footer-column"><h3>What we do</h3><a href="' + u("services/web-development.html") + '">Website development</a><a href="' + u("services/ai-chatbots.html") + '">AI chatbots</a><a href="' + u("services/automation.html") + '">Workflow automation</a><a href="' + u("services/seo.html") + '">SEO services</a><a href="' + u("services/software.html") + '">Software (coming soon)</a></div>' +
    '<div class="footer-column footer-contact"><h3>Get in touch</h3><a href="tel:+923132649877">+92 313 2649877</a><a href="mailto:zavexcode@gmail.com">zavexcode@gmail.com</a><a href="' + WA + '" target="_blank" rel="noopener noreferrer">Chat on WhatsApp <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>' +
    '</div><div class="container footer-bottom"><span>© ' + new Date().getFullYear() + ' ZavexCode. Built with purpose.</span><a href="#top" data-top>Back to top <i class="fa-solid fa-arrow-up"></i></a><span>Web · AI · Automation · SEO</span></div></footer>';

  var floats =
    '<a class="whatsapp-float" href="' + WA + '" target="_blank" rel="noopener noreferrer" aria-label="Start a WhatsApp chat with ZavexCode" title="Chat with ZavexCode on WhatsApp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>Chat on WhatsApp</span><i class="fa-solid fa-arrow-up-right-from-square whatsapp-external" aria-hidden="true"></i></a>' +
    '<a class="back-to-top" href="#top" data-top aria-label="Back to top"><i class="fa-solid fa-arrow-up"></i></a>';

  var hh = document.getElementById("site-header");
  var ff = document.getElementById("site-footer");
  if (hh) hh.outerHTML = header;
  if (ff) ff.outerHTML = footer + floats;

  // motion-only overlays (the head script sets html.motion-on when the visitor allows motion)
  var root = document.documentElement;
  if (root.classList.contains("motion-on")) {
    var extra = '<div class="scroll-progress" aria-hidden="true"></div><div class="page-curtain" aria-hidden="true"><img src="' + LOGO + '" alt=""></div>';
    if (root.classList.contains("is-loading")) {
      extra += '<div class="preloader" aria-hidden="true"><img src="' + LOGO + '" alt=""><div class="pl-count">0</div><div class="pl-bar"><i></i></div></div>';
    }
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      extra += '<div class="cursor-dot" aria-hidden="true"></div><div class="cursor-ring" aria-hidden="true"></div>';
    }
    body.insertAdjacentHTML("beforeend", extra);
  }

  /* ---- Services dropdown (desktop hover/keyboard; expandable list on mobile). Remove this call to switch it off. ---- */
  function initServicesDropdown() {
    var item = document.querySelector(".has-sub");
    if (!item) return;
    var btn = item.querySelector(".sub-toggle");
    var desktop = window.matchMedia("(min-width: 761px)");
    var timer, pinned = false;
    function set(open) {
      if (!open) pinned = false;
      item.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    // a click pins the menu open (hover alone does not), so hover-then-click never closes it by accident
    btn.addEventListener("click", function () {
      if (item.classList.contains("open") && (pinned || !desktop.matches)) set(false);
      else { set(true); pinned = true; }
    });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); set(true); var first = item.querySelector(".sub-link"); if (first) first.focus(); }
    });
    item.addEventListener("mouseenter", function () { if (desktop.matches) { clearTimeout(timer); set(true); } });
    item.addEventListener("mouseleave", function () { if (desktop.matches && !pinned) { clearTimeout(timer); timer = setTimeout(function () { set(false); }, 160); } });
    item.addEventListener("focusin", function (e) { if (desktop.matches && e.target.matches && e.target.matches(":focus-visible")) set(true); });
    item.addEventListener("focusout", function (e) { if (desktop.matches && !item.contains(e.relatedTarget)) set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && item.classList.contains("open")) {
        var had = item.contains(document.activeElement);
        set(false);
        if (had) btn.focus();
      }
    });
    document.addEventListener("click", function (e) { if (!item.contains(e.target)) set(false); });
    desktop.addEventListener ? desktop.addEventListener("change", function () { set(false); }) : null;
  }
  initServicesDropdown();
})();
