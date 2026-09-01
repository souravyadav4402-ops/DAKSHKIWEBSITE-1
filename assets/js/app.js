/* =====================================================================
   MineStackerBot — application shell
   hash router · navigation · settings · history · profile · landing
   One adaptive layout, one design system, one set of data.
   ===================================================================== */
(function () {
  "use strict";

  var Model = window.MSBModel;
  var Store = window.MSBStore;
  var UI = window.MSBUI;
  var Analysis = window.MSBAnalysis;
  var $ = UI.$;
  var $$ = UI.$$;
  var icon = UI.icon;

  var ROUTES = ["home", "analyze", "history", "detail", "subscription", "settings", "profile", "about"];
  var current = null;
  var heroTimer = null;

  /* ================================================================
     SETTINGS
     ================================================================ */
  function applySettings(settings) {
    var s = settings || Store.getSettings();
    document.documentElement.setAttribute("data-theme", s.theme);
    document.documentElement.setAttribute("lang", s.language === "en" ? "en" : s.language);
    document.documentElement.classList.toggle("no-anim", s.animations === false);
    return s;
  }

  function syncSettingsView() {
    var s = Store.getSettings();
    $$("[data-setting]").forEach(function (node) {
      var key = node.getAttribute("data-setting");
      if (node.tagName === "SELECT") node.value = s[key];
      else node.setAttribute("aria-checked", s[key] ? "true" : "false");
    });
    var p = Store.getProfile();
    setText("rowProfileName", p.name);
    setText("rowPlan", p.plan);
  }

  function initSettings() {
    document.addEventListener("click", function (e) {
      var toggle = e.target.closest ? e.target.closest(".toggle[data-setting]") : null;
      if (!toggle) return;
      var key = toggle.getAttribute("data-setting");
      var next = toggle.getAttribute("aria-checked") !== "true";
      toggle.setAttribute("aria-checked", next ? "true" : "false");
      applySettings(Store.setSetting(key, next));
      if (key === "sound" && next) UI.sound.select();
      if (key === "haptics" && next) { UI.haptic(20); }
      UI.toast(labelFor(key) + (next ? " enabled." : " disabled."));
      if (key === "animations") {
        // reveal animations are set up once; make sure content stays visible
        if (!next) UI.revealAllNow(); else UI.observeReveals();
      }
    });

    $$("select[data-setting]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var key = sel.getAttribute("data-setting");
        applySettings(Store.setSetting(key, sel.value));
        if (key === "language") {
          UI.toast("Language preference saved. Full localization is still pending.");
        } else {
          UI.toast(labelFor(key) + " set to " + sel.options[sel.selectedIndex].text + ".");
        }
      });
    });
  }

  function labelFor(key) {
    return {
      speed: "Analysis speed", animations: "Animations", sound: "Sound effects",
      haptics: "Haptics", theme: "Theme", language: "Language", notifications: "Notifications"
    }[key] || key;
  }

  /* ================================================================
     ROUTER
     ================================================================ */
  function parseHash() {
    var raw = (window.location.hash || "").replace(/^#\/?/, "");
    var parts = raw.split("/").filter(function (p) { return p.length; });
    var name = parts[0] || "home";
    var param = parts[1] || "";
    // #/history/<id> opens the read-only detail view
    if (name === "history" && param) name = "detail";
    if (ROUTES.indexOf(name) === -1) name = "home";
    return { name: name, param: param };
  }

  function go(route) {
    var view = document.getElementById("view-" + route.name);
    if (!view) return;

    $$(".view").forEach(function (v) {
      if (v !== view) { v.hidden = true; v.classList.remove("is-entering"); }
    });
    view.hidden = false;
    view.classList.remove("is-entering");
    // force a reflow so the entrance animation replays on every navigation
    void view.offsetWidth;
    if (!UI.motionOff()) view.classList.add("is-entering");

    setText("pageTitle", view.getAttribute("data-title") || "MineStackerBot");
    $$("[data-route]").forEach(function (link) {
      var match = link.getAttribute("data-route") === route.name ||
        (route.name === "detail" && link.getAttribute("data-route") === "history");
      link.classList.toggle("is-active", match);
      if (match) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (current !== route.name) window.scrollTo(0, 0);
    current = route.name;

    if (route.name === "history") renderHistory();
    if (route.name === "detail") renderDetail(route.param);
    if (route.name === "profile") renderProfile();
    if (route.name === "settings") syncSettingsView();
    if (route.name === "home") startHeroLoop(); else stopHeroLoop();

    UI.observeReveals(view);
  }

  function initRouter() {
    window.addEventListener("hashchange", function () {
      UI.closeAllModals();
      go(parseHash());
    });
    if (!window.location.hash) window.location.replace("#/home");
    go(parseHash());
  }

  /* ================================================================
     HELPERS
     ================================================================ */
  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  /* ================================================================
     HISTORY
     ================================================================ */
  function historyItemHTML(entry, index) {
    var risk = Model.isHighRisk(entry.mines);
    return '' +
      '<button class="hitem" type="button" role="listitem" data-history="' + entry.id + '" ' +
        'style="animation-delay:' + Math.min(index * 45, 500) + 'ms">' +
        '<span class="hitem__gem" aria-hidden="true">' + icon("gem") + '</span>' +
        '<span class="hitem__body">' +
          '<span class="hitem__top">' +
            '<span class="hitem__when">' + UI.escapeHtml(UI.whenOf(entry.ts)) + '</span>' +
            '<span class="hitem__hash">' + UI.escapeHtml(entry.hash) + '</span>' +
          '</span>' +
          '<span class="hitem__meta">' +
            '<span class="hitem__mines">' + entry.mines + (entry.mines === 1 ? ' MINE' : ' MINES') + '</span>' +
            '<span>' + entry.confidence.toFixed(0) + '% ESTIMATED CONFIDENCE</span>' +
            '<span>' + entry.gems + (entry.gems === 1 ? ' SAFE TILE' : ' SAFE TILES') + '</span>' +
            (risk ? '<span class="hitem__risk">' + icon("warn") + ' HIGH RISK</span>' : '') +
          '</span>' +
        '</span>' +
        icon("chevron", "row__chev") +
      '</button>';
  }

  function renderHistory() {
    var host = document.getElementById("historyList");
    if (!host) return;
    var query = ($("#historySearch") && $("#historySearch").value || "").trim().toLowerCase();
    var all = Store.getHistory();
    var list = all.filter(function (e) {
      if (!query) return true;
      var haystack = [
        UI.whenOf(e.ts), UI.fullDate(e.ts), e.hash,
        e.mines + " mines", String(e.mines),
        e.confidence.toFixed(1) + "%",
        Model.isHighRisk(e.mines) ? "high risk" : ""
      ].join(" ").toLowerCase();
      return haystack.indexOf(query) !== -1;
    });

    if (!all.length) {
      host.innerHTML = '<div class="empty">' + icon("history", "icon--lg") +
        '<h4>No analyses yet</h4>' +
        '<p>Run your first analysis and it will appear here with its date, seed hash, mine count and ' +
        'simulated confidence figure. Nothing is pre-filled — this list only ever shows your own runs.</p>' +
        '<a class="btn btn--primary" href="#/analyze">Start an analysis</a></div>';
      setText("historyCount", "");
      return;
    }
    if (!list.length) {
      host.innerHTML = '<div class="empty">' + icon("search", "icon--lg") +
        '<h4>No matches</h4><p>Nothing matched &ldquo;' + UI.escapeHtml(query) +
        '&rdquo;. Try a date such as ' + UI.escapeHtml(UI.fullDate(Date.now())) + ', or a mine count.</p></div>';
      setText("historyCount", "0 of " + all.length + " ANALYSES");
      return;
    }

    host.innerHTML = list.map(historyItemHTML).join("");
    setText("historyCount", list.length + " OF " + all.length + " ANALYSES STORED LOCALLY");
  }

  function initHistory() {
    var search = document.getElementById("historySearch");
    if (search) search.addEventListener("input", renderHistory);

    var clear = document.getElementById("historyClear");
    if (clear) {
      clear.addEventListener("click", function () {
        if (!Store.getHistory().length) { UI.toast("History is already empty."); return; }
        if (window.confirm("Delete all locally stored analyses? This cannot be undone.")) {
          Store.clearHistory();
          renderHistory();
          refreshStats();
          UI.toast("History cleared.");
        }
      });
    }

    document.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest("[data-history]") : null;
      if (!item) return;
      UI.sound.tap();
      window.location.hash = "#/history/" + item.getAttribute("data-history");
    });
  }

  /* ================================================================
     HISTORY DETAIL (read-only)
     ================================================================ */
  function renderDetail(id) {
    var host = document.getElementById("detailBody");
    if (!host) return;
    var entry = id ? Store.findHistory(id) : null;

    if (!entry) {
      host.innerHTML = '<div class="empty">' + icon("warn", "icon--lg") +
        '<h4>Analysis not found</h4><p>This record is no longer stored on this device.</p>' +
        '<a class="btn btn--primary" href="#/analyze">New analysis</a></div>';
      return;
    }

    var risk = Model.isHighRisk(entry.mines);
    host.innerHTML = '' +
      '<div class="card">' +
        Analysis.gridWrapHTML() +
        '<p class="results__positions mono" data-el="positions"></p>' +
        '<dl class="infocards">' +
          '<div class="infocard"><dt>SELECTED MINES</dt><dd>' + entry.mines + ' / 24</dd></div>' +
          '<div class="infocard infocard--accent"><dt>REVEALED SAFE TILES</dt><dd>' + entry.gems + ' / 25</dd></div>' +
          '<div class="infocard"><dt>GRID</dt><dd>5 × 5</dd></div>' +
          '<div class="infocard"><dt>STATUS</dt><dd>ANALYSIS COMPLETE</dd></div>' +
        '</dl>' +
      '</div>' +
      '<aside class="detail__side">' +
        '<div class="card card--tight">' +
          '<h4 class="mono">RECORD</h4>' +
          '<dl class="kv">' +
            '<div><dt>Date</dt><dd>' + UI.escapeHtml(UI.dayOf(entry.ts)) + '</dd></div>' +
            '<div><dt>Time</dt><dd>' + UI.escapeHtml(UI.timeOf(entry.ts)) + '</dd></div>' +
            '<div><dt>Seed hash</dt><dd class="mono">' + UI.escapeHtml(entry.hash) + '</dd></div>' +
            '<div><dt>Selected mines</dt><dd>' + entry.mines + ' / 24' +
              (risk ? ' <span class="hitem__risk">' + icon("warn") + ' HIGH RISK</span>' : '') + '</dd></div>' +
            '<div><dt>Estimated confidence</dt><dd>' + entry.confidence.toFixed(1) + '%</dd></div>' +
          '</dl>' +
          '<p class="note note--inline">' + icon("info") +
            '<span>Simulated illustrative metric — not measured accuracy, and not a prediction.</span></p>' +
          '<p class="detail__readonly">' + icon("lock") + ' READ-ONLY RECORD</p>' +
        '</div>' +
        '<a class="btn btn--primary btn--full" href="#/analyze" data-ripple>NEW ANALYSIS</a>' +
      '</aside>';

    var grid = $('[data-el="grid"]', host);
    var result = Analysis.renderStaticGrid(grid, entry.seed, entry.mines);
    var positions = $('[data-el="positions"]', host);
    if (positions) {
      positions.textContent = "GEM TILES: " + result.gemIndexes.map(Analysis.positionLabel).join(" · ");
    }
  }

  /* ================================================================
     PROFILE
     ================================================================ */
  function renderProfile() {
    var p = Store.getProfile();
    var list = Store.getHistory();
    setText("profileName", p.name);
    setText("profileSince", "Member since " + UI.fullDate(p.createdAt));
    setText("profileCount", String(list.length));
    setText("profileLast", list.length ? UI.whenOf(list[0].ts) : "—");
    setText("profilePlan", p.plan);
    setText("profilePlanRow", p.plan);
    var input = document.getElementById("profileInput");
    if (input) input.value = p.name;
  }

  function initProfile() {
    var form = document.getElementById("profileForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("profileInput");
      var name = (input.value || "").trim().slice(0, 24) || "Operator";
      Store.setProfile({ name: name });
      renderProfile();
      syncSettingsView();
      UI.toast("Profile updated.");
    });
  }

  /* ================================================================
     SUBSCRIPTION
     ================================================================ */
  var PRICES = {
    monthly: { pro: "$19", vip: "$49", label: "/month", note: "Billed monthly. Cancel anytime." },
    yearly: { pro: "$182", vip: "$470", label: "/year", note: "Two months off versus monthly billing." }
  };

  function initSubscription() {
    $$("[data-cycle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cycle = btn.getAttribute("data-cycle");
        $$("[data-cycle]").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        var price = PRICES[cycle];
        $$("[data-price-pro]").forEach(function (n) { n.textContent = price.pro; });
        $$("[data-price-vip]").forEach(function (n) { n.textContent = price.vip; });
        $$("[data-cycle-label]").forEach(function (n) { n.textContent = price.label; });
        $$("[data-price-note]").forEach(function (n) { n.textContent = price.note; });
        UI.sound.select();
      });
    });

    /* --------------------------------------------------------------
       PAYMENT INTEGRATION POINT — deliberately a no-op.
       No payment is taken and no plan is activated here. A developer
       replaces this with a real provider call (e.g. a hosted checkout
       session) and only marks a plan active after the provider — or a
       trusted backend webhook — confirms the payment. The UI must never
       display a successful payment state without that confirmation.
       -------------------------------------------------------------- */
    function requestCheckout(planId) {
      UI.toast("Checkout is not connected in this build — no payment was taken and no plan was changed.", "warn");
      if (window.console && console.info) {
        console.info("[MineStackerBot] checkout placeholder invoked for plan:", planId);
      }
    }

    $$("[data-checkout]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        requestCheckout(btn.getAttribute("data-checkout"));
      });
    });
  }

  /* ================================================================
     LANDING EXTRAS
     ================================================================ */
  function buildHeroGrid() {
    var host = document.getElementById("heroGrid");
    if (!host) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 25; i++) frag.appendChild(document.createElement("span"));
    host.appendChild(frag);
    cycleHeroGems();
  }

  function cycleHeroGems() {
    var host = document.getElementById("heroGrid");
    if (!host) return;
    var cells = $$("span", host);
    cells.forEach(function (c) { c.classList.remove("is-gem"); });
    var picked = {};
    var want = 5;
    while (Object.keys(picked).length < want) picked[Math.floor(Math.random() * 25)] = true;
    Object.keys(picked).forEach(function (idx, n) {
      var cell = cells[idx];
      if (!cell) return;
      if (UI.motionOff()) { cell.classList.add("is-gem"); return; }
      window.setTimeout(function () { cell.classList.add("is-gem"); }, n * 170);
    });
  }

  function startHeroLoop() {
    stopHeroLoop();
    if (UI.motionOff()) return;
    heroTimer = window.setInterval(function () {
      if (document.hidden) return;
      cycleHeroGems();
    }, 3400);
  }
  function stopHeroLoop() {
    if (heroTimer) { window.clearInterval(heroTimer); heroTimer = null; }
  }

  function initScrollButtons() {
    $$("[data-scroll-to]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = document.getElementById(btn.getAttribute("data-scroll-to"));
        if (!target) return;
        try {
          target.scrollIntoView({ behavior: UI.motionOff() ? "auto" : "smooth", block: "start" });
        } catch (e) { target.scrollIntoView(); }
        UI.sound.tap();
      });
    });
  }

  function initSocials() {
    $$("[data-social]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        /* Placeholder: replace with the project's real profile URLs. */
        UI.toast(btn.getAttribute("data-social") + " link is not configured yet.", "warn");
      });
    });
  }

  /* ================================================================
     STATS / STATUS
     ================================================================ */
  function refreshStats() {
    var list = Store.getHistory();
    setText("sideCount", String(list.length));
    setText("sideSeed", list.length ? list[0].hash : "—");
    var p = Store.getProfile();
    setText("planBadge", p.plan);
    var badge = document.getElementById("planBadge");
    if (badge) badge.title = "Current plan: " + p.plan;
  }

  function setStatus(state) {
    var chip = document.getElementById("statusChip");
    if (!chip) return;
    chip.setAttribute("data-state", state === "busy" ? "busy" : "ready");
    var label = $(".mono", chip);
    if (label) label.textContent = state === "busy" ? "ANALYZING" : "READY";
  }

  /* ================================================================
     BOOT
     ================================================================ */
  function buildBootGrid() {
    var host = document.querySelector(".boot__grid");
    if (!host) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 25; i++) {
      var cell = document.createElement("i");
      cell.style.animationDelay = (i * 45) + "ms";
      frag.appendChild(cell);
    }
    host.appendChild(frag);
  }

  function hideBoot() {
    var boot = document.getElementById("boot");
    if (!boot) return;
    var delay = UI.motionOff() ? 60 : 900;
    window.setTimeout(function () {
      boot.classList.add("is-done");
      window.setTimeout(function () { boot.hidden = true; }, 420);
    }, delay);
  }

  function init() {
    applySettings();
    buildBootGrid();
    buildHeroGrid();

    UI.initRipples();
    UI.initModals();
    UI.initReveal();
    UI.initCursor();
    UI.particles(document.getElementById("ambientParticles"), 14);

    initSettings();
    initRouter();
    initHistory();
    initProfile();
    initSubscription();
    initScrollButtons();
    initSocials();

    setText("footYear", String(new Date().getFullYear()));
    syncSettingsView();
    refreshStats();

    // Mount the analysis console twice: dashboard + landing demo.
    Analysis.mount($('[data-console="app"]'), {
      onStart: function () { setStatus("busy"); },
      onDone: function () { setStatus("ready"); }
    });
    Analysis.mount($('[data-console="demo"]'), {});

    Analysis.onAnalysis(function () {
      refreshStats();
      if (current === "history") renderHistory();
    });

    if (!Store.available) {
      UI.toast("Local storage is unavailable, so settings and history will reset when you close this tab.", "warn");
    }

    hideBoot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
