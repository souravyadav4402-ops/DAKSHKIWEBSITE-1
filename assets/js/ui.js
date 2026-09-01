/* =====================================================================
   MineStackerBot — UI utilities
   toasts · ripples · synthesized sound · haptics · modals · scroll
   reveal · ambient particles · desktop cursor · date formatting
   Zero dependencies, zero network, zero external assets.
   ===================================================================== */
window.MSBUI = (function () {
  "use strict";

  var Store = window.MSBStore;

  /* ---------------------------------------------------------- dom */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function icon(name, cls) {
    return '<svg class="icon' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' +
      name + '"></use></svg>';
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------------------------------------------------- motion */
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function prefersReducedMotion() { return !!(mqReduce && mqReduce.matches); }
  function motionOff() {
    var s = Store.getSettings();
    return prefersReducedMotion() || s.animations === false;
  }

  /* ---------------------------------------------------------- toasts */
  var toastHost = null;
  function toast(message, kind) {
    if (Store.getSettings().notifications === false) return;
    if (!toastHost) toastHost = document.getElementById("toasts");
    if (!toastHost) return;
    var node = document.createElement("div");
    node.className = "toast" + (kind === "warn" ? " toast--warn" : "");
    node.setAttribute("role", "status");
    node.innerHTML = icon(kind === "warn" ? "warn" : "info") +
      "<span>" + escapeHtml(message) + "</span>";
    toastHost.appendChild(node);
    window.setTimeout(function () {
      node.style.transition = "opacity 200ms linear, transform 200ms linear";
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 240);
    }, kind === "warn" ? 4600 : 3200);
  }

  /* ---------------------------------------------------------- sound
     Synthesized with WebAudio — no audio files. Default OFF; the user
     enables it from Settings > Sound Effects. */
  var ctx = null;
  function audio() {
    if (!Store.getSettings().sound) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended" && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function tone(freq, dur, type, gain) {
    var ac = audio();
    if (!ac) return;
    try {
      var osc = ac.createOscillator();
      var amp = ac.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      amp.gain.setValueAtTime(0.0001, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(gain || 0.06, ac.currentTime + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.09));
      osc.connect(amp).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + (dur || 0.09) + 0.02);
    } catch (e) { /* audio is a nicety, never a hard failure */ }
  }
  var sound = {
    tap: function () { tone(520, 0.06, "triangle", 0.045); },
    select: function () { tone(720, 0.07, "triangle", 0.04); },
    launch: function () { tone(180, 0.5, "sawtooth", 0.03); tone(320, 0.42, "sine", 0.025); },
    done: function () { tone(660, 0.1, "sine", 0.05); window.setTimeout(function () { tone(990, 0.16, "sine", 0.045); }, 90); }
  };

  /* ---------------------------------------------------------- haptics */
  function haptic(pattern) {
    if (!Store.getSettings().haptics) return;
    if (navigator && typeof navigator.vibrate === "function") {
      try { navigator.vibrate(pattern || 12); } catch (e) {}
    }
  }

  /* ---------------------------------------------------------- ripple */
  function ripple(button, event) {
    if (motionOff()) return;
    var rect = button.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.1;
    var span = document.createElement("span");
    span.className = "ripple";
    span.style.width = span.style.height = size + "px";
    var x = (event && event.clientX ? event.clientX : rect.left + rect.width / 2) - rect.left - size / 2;
    var y = (event && event.clientY ? event.clientY : rect.top + rect.height / 2) - rect.top - size / 2;
    span.style.left = x + "px";
    span.style.top = y + "px";
    button.appendChild(span);
    window.setTimeout(function () {
      if (span.parentNode) span.parentNode.removeChild(span);
    }, 620);
  }
  function initRipples() {
    document.addEventListener("pointerdown", function (e) {
      var target = e.target && e.target.closest ? e.target.closest("[data-ripple]") : null;
      if (target) ripple(target, e);
    }, { passive: true });
  }

  /* ---------------------------------------------------------- modals */
  var lastFocus = null;
  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    var focusable = $$("button, a[href], input, select, textarea", modal);
    if (focusable.length) focusable[0].focus();
    sound.tap();
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function closeAllModals() {
    $$(".modal").forEach(function (m) { if (!m.hidden) closeModal(m); });
  }
  function initModals() {
    document.addEventListener("click", function (e) {
      var opener = e.target.closest ? e.target.closest("[data-modal]") : null;
      if (opener) { e.preventDefault(); openModal(opener.getAttribute("data-modal")); return; }
      var closer = e.target.closest ? e.target.closest("[data-modal-close]") : null;
      if (closer) { closeModal(closer.closest(".modal")); return; }
      var backdrop = e.target.classList && e.target.classList.contains("modal") ? e.target : null;
      if (backdrop) closeModal(backdrop);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllModals();
      // keep tab focus inside an open dialog
      if (e.key !== "Tab") return;
      var open = $$(".modal").filter(function (m) { return !m.hidden; })[0];
      if (!open) return;
      var items = $$("button, a[href], input, select, textarea", open).filter(function (n) {
        return !n.disabled && n.offsetParent !== null;
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------------------------------------------------------- scroll reveal */
  var observer = null;
  function initReveal() {
    if (motionOff() || !("IntersectionObserver" in window)) {
      $$("[data-reveal]").forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    observeReveals();
  }
  function observeReveals(root) {
    var nodes = $$("[data-reveal]", root).filter(function (n) { return !n.classList.contains("is-in"); });
    if (!observer) { nodes.forEach(function (n) { n.classList.add("is-in"); }); return; }
    nodes.forEach(function (n) { observer.observe(n); });
  }
  function revealAllNow(root) {
    $$("[data-reveal]", root).forEach(function (n) { n.classList.add("is-in"); });
  }

  /* ---------------------------------------------------------- particles
     Deliberately cheap: a handful of 2px dots, transform-only motion. */
  function particles(host, count) {
    if (!host) return;
    host.innerHTML = "";
    if (motionOff()) return;
    var n = count || 12;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var p = document.createElement("span");
      p.className = "p";
      p.style.left = (Math.random() * 100).toFixed(2) + "%";
      p.style.top = (Math.random() * 100).toFixed(2) + "%";
      p.style.animationDelay = (Math.random() * 6).toFixed(2) + "s";
      p.style.animationDuration = (6 + Math.random() * 6).toFixed(2) + "s";
      frag.appendChild(p);
    }
    host.appendChild(frag);
  }

  /* ---------------------------------------------------------- cursor
     Desktop only; the real cursor is never hidden. */
  function initCursor() {
    var node = document.getElementById("cursor");
    if (!node || !window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (prefersReducedMotion()) return;
    var x = 0, y = 0, raf = null;
    function paint() {
      node.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      raf = null;
    }
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      node.classList.add("is-on");
      var hot = e.target && e.target.closest &&
        e.target.closest("button, a, input, select, .chip, .toggle, .hitem");
      node.classList.toggle("is-hot", !!hot);
      if (!raf) raf = window.requestAnimationFrame(paint);
    }, { passive: true });
    document.addEventListener("pointerleave", function () { node.classList.remove("is-on"); });
  }

  /* ---------------------------------------------------------- dates */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function timeOf(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function dayOf(ts) {
    var d = new Date(ts);
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return "Today";
    var yest = new Date(now.getTime() - 86400000);
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return d.getDate() + " " + months[d.getMonth()] +
      (d.getFullYear() !== now.getFullYear() ? " " + d.getFullYear() : "");
  }
  function whenOf(ts) { return dayOf(ts) + ", " + timeOf(ts); }
  function fullDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  return {
    $: $, $$: $$, icon: icon, escapeHtml: escapeHtml,
    prefersReducedMotion: prefersReducedMotion, motionOff: motionOff,
    toast: toast, sound: sound, haptic: haptic,
    ripple: ripple, initRipples: initRipples,
    openModal: openModal, closeAllModals: closeAllModals, initModals: initModals,
    initReveal: initReveal, observeReveals: observeReveals, revealAllNow: revealAllNow,
    particles: particles, initCursor: initCursor,
    timeOf: timeOf, dayOf: dayOf, whenOf: whenOf, fullDate: fullDate
  };
})();
