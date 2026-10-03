/* ==========================================================================
   ARX MODS TM — main.js
   Progressive enhancement only. The site is fully functional without JS.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer  = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ----------------------------------------------------------------------
     1. Footer year
     ---------------------------------------------------------------------- */
  var yearEl = doc.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ----------------------------------------------------------------------
     2. Header scroll state
     ---------------------------------------------------------------------- */
  var header = doc.getElementById("siteHeader");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----------------------------------------------------------------------
     3. Mobile navigation
     ---------------------------------------------------------------------- */
  var menuBtn  = doc.getElementById("menuBtn");
  var mobileNav = doc.getElementById("mobileNav");

  function setMenu(open) {
    if (!menuBtn || !mobileNav) return;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    mobileNav.hidden = !open;
  }

  if (menuBtn && mobileNav) {
    setMenu(false);

    menuBtn.addEventListener("click", function () {
      setMenu(menuBtn.getAttribute("aria-expanded") !== "true");
    });

    mobileNav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuBtn.focus();
      }
    });

    // Reset when the viewport grows back to desktop.
    var wide = window.matchMedia("(min-width: 860px)");
    var onWide = function (m) { if (m.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ----------------------------------------------------------------------
     4. Entrance animations
     ---------------------------------------------------------------------- */
  var revealables = Array.prototype.slice.call(doc.querySelectorAll(".reveal"));

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     5. Scroll spy for the primary nav
     ---------------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(doc.querySelectorAll(".nav__link"));
  var sections = navLinks
    .map(function (a) { return doc.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ----------------------------------------------------------------------
     6. Logo — pointer-reactive lighting
     ---------------------------------------------------------------------- */
  var stage = doc.getElementById("logoStage");

  if (stage && finePointer && !reduceMotion) {
    var frame = 0;
    var targetX = 0, targetY = 0, curX = 0, curY = 0, running = false;

    var tick = function () {
      curX += (targetX - curX) * 0.09;
      curY += (targetY - curY) * 0.09;

      stage.style.setProperty("--px", curX.toFixed(4));
      stage.style.setProperty("--py", curY.toFixed(4));

      if (Math.abs(targetX - curX) > 0.001 || Math.abs(targetY - curY) > 0.001) {
        frame = window.requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    var start = function () {
      if (running) return;
      running = true;
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", function (e) {
      var rect = stage.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;

      // Normalised -1..1 offset, clamped so distant movement stays subtle.
      targetX = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2)));
      targetY = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2)));
      start();
    }, { passive: true });

    window.addEventListener("pointerleave", function () {
      targetX = 0; targetY = 0; start();
    });

    window.addEventListener("blur", function () {
      targetX = 0; targetY = 0; start();
    });

    // Avoid a leaked rAF on page hide.
    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden && frame) {
        window.cancelAnimationFrame(frame);
        running = false;
      }
    });
  }

  /* ----------------------------------------------------------------------
     7. Logo image fallback (logo.png → clean ARX mark)
     ---------------------------------------------------------------------- */
  var logoImg = doc.querySelector("[data-logo-img]");
  if (logoImg && stage) {
    var useFallback = function () {
      stage.classList.add("is-fallback");
      logoImg.remove();
    };
    logoImg.addEventListener("error", useFallback, { once: true });
    // Cached-broken images can already be "complete" with zero width.
    if (logoImg.complete && logoImg.naturalWidth === 0) useFallback();
  }

  /* ----------------------------------------------------------------------
     8. Telegram card hydration
     Public channels only. Private invite links never resolve publicly,
     so those cards keep their curated content — nothing is faked.
     ---------------------------------------------------------------------- */
  var tgCards = Array.prototype.slice.call(doc.querySelectorAll(".tcard[data-tg]"));

  if (tgCards.length) {
    // If every request fails, we simply leave the static cards untouched.
    tgCards.forEach(hydrateTelegramCard);
  }

  function hydrateTelegramCard(card) {
    var username = card.getAttribute("data-tg");
    if (!username || !/^[A-Za-z0-9_]{4,32}$/.test(username)) return;

    var avatar   = card.querySelector("[data-tg-avatar]");
    var titleEl  = card.querySelector("[data-tg-title]");
    var descEl   = card.querySelector("[data-tg-desc]");
    var metaEl   = card.querySelector("[data-tg-meta]");
    var kindEl   = card.querySelector("[data-tg-kind-label]");

    var controller = null;
    var timeout = window.setTimeout(function () { if (controller) controller.abort(); }, 6000);

    controller = new AbortController();

    fetch("/api/telegram?u=" + encodeURIComponent(username), {
      signal: controller.signal,
      headers: { accept: "application/json" }
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        window.clearTimeout(timeout);
        if (!data || data.ok !== true) return;

        // Remote avatar — only swap in if it actually loads.
        if (avatar && typeof data.image === "string" && /^https:\/\//.test(data.image)) {
          avatar.addEventListener("load", function () {
            avatar.hidden = false;
          }, { once: true });
          avatar.addEventListener("error", function () {
            avatar.hidden = true;
            avatar.removeAttribute("src");
          }, { once: true });
          avatar.src = data.image;
          avatar.alt = data.title ? data.title + " — Telegram avatar" : "";
        }

        // Type badge (channel / group) — only when confidently detected.
        if (kindEl && (data.kind === "channel" || data.kind === "group")) {
          kindEl.textContent = data.kind;
          kindEl.className = "tag tag--" + data.kind;
        }

        // Live channel title, but only if we have no curated name.
        if (titleEl && !titleEl.textContent.trim() && data.title) {
          titleEl.textContent = data.title;
        }

        // Description: fill the gap only.
        if (descEl && !descEl.textContent.trim() && data.description) {
          descEl.textContent = data.description;
        }

        // Metadata strip: real numbers or nothing at all.
        var bits = [];
        if (typeof data.members === "number" && data.members > 0) {
          bits.push(data.members.toLocaleString("en-US") + " " + data.memberLabel);
        }
        if (data.verified === true) bits.push("Verified");

        if (metaEl && bits.length) {
          metaEl.textContent = bits.join(" \u00B7 ");
          metaEl.hidden = false;
        }
      })
      .catch(function () {
        window.clearTimeout(timeout);
        /* Silent — the static card is the fallback. */
      });
  }

  /* ----------------------------------------------------------------------
     9. External link safety net
     ---------------------------------------------------------------------- */
  Array.prototype.forEach.call(doc.querySelectorAll('a[target="_blank"]'), function (a) {
    var rel = (a.getAttribute("rel") || "").split(/\s+/);
    if (rel.indexOf("noopener") === -1) rel.push("noopener");
    if (rel.indexOf("noreferrer") === -1) rel.push("noreferrer");
    a.setAttribute("rel", rel.join(" ").trim());
  });

})();
