/* =====================================================================
   MineStackerBot — analysis console + overlay + grid reveal

   The same console component is mounted twice: once in the landing
   page's interactive demo, once in the Analyze dashboard. Both run the
   identical model and write to the same local history — the demo is the
   real bot, not a mock.

   The grid is visualization only: cells are non-interactive, carry no
   click handlers, and true mine positions are never computed.
   ===================================================================== */
window.MSBAnalysis = (function () {
  "use strict";

  var Model = window.MSBModel;
  var Store = window.MSBStore;
  var UI = window.MSBUI;
  var $ = UI.$;
  var $$ = UI.$$;
  var icon = UI.icon;

  var PHASES = ["INITIALIZING ANALYSIS", "ANALYZING GRID", "GENERATING VISUALIZATION"];
  var SPEEDS = { fast: 1200, normal: 2200, cinematic: 3000 };

  var instances = [];
  var listeners = [];
  var busy = false;

  function onAnalysis(fn) { listeners.push(fn); }
  function emit(entry) { listeners.forEach(function (fn) { try { fn(entry); } catch (e) {} }); }

  /* ---------------------------------------------------------- markup */
  function gridWrapHTML(extraClass) {
    return '' +
      '<div class="gridwrap ' + (extraClass || "") + '" data-el="gridwrap">' +
        '<span class="gridwrap__border" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
        '<span class="gridwrap__scan" aria-hidden="true"></span>' +
        '<div class="grid" data-el="grid" role="img" aria-label="Estimated 5 by 5 grid visualization"></div>' +
      '</div>';
  }

  function consoleHTML(id) {
    return '' +
    /* ---- client seed ---- */
    '<section class="card seedcard">' +
      '<h4 class="mono">ENTER CLIENT SEED</h4>' +
      '<p class="seedcard__desc">Paste your client seed or seed hash to generate an estimated grid visualization.</p>' +
      '<div class="field">' +
        '<label class="sr-only" for="seed-' + id + '">Client seed or seed hash</label>' +
        '<input class="input" id="seed-' + id + '" type="text" inputmode="text" spellcheck="false" ' +
          'autocomplete="off" autocapitalize="off" placeholder="Paste client seed or seed hash..." data-el="seed">' +
      '</div>' +
      '<div class="seedcard__actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-act="paste">' + icon("paste") + ' PASTE</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="clear">' + icon("x") + ' CLEAR</button>' +
        '<button class="btn btn--ghost btn--sm btn--link" type="button" data-act="random">Insert a random test seed</button>' +
      '</div>' +
    '</section>' +

    /* ---- mine selection ---- */
    '<section class="card">' +
      '<div class="card__head">' +
        '<h4 class="mono">SELECT MINES</h4>' +
        '<span class="risk" data-el="risk" role="status">' + icon("warn") + ' HIGH RISK</span>' +
      '</div>' +
      '<div class="mines">' +
        '<div class="mines__slider">' +
          '<span class="mono">1</span>' +
          '<label class="sr-only" for="slider-' + id + '">Select mines</label>' +
          '<input class="slider" id="slider-' + id + '" type="range" min="1" max="24" step="1" value="3" data-el="slider">' +
          '<span class="mono">24</span>' +
        '</div>' +
        '<div class="chips" data-el="chips" role="group" aria-label="Mine count, 1 to 24"></div>' +
        '<p class="selected-line">SELECTED: <strong data-el="selected">3</strong>' +
          '<span class="selected-line__hint">Safe tiles revealed at this count: <strong data-el="range">5&ndash;6</strong></span>' +
        '</p>' +
      '</div>' +
    '</section>' +

    /* ---- analyze ---- */
    '<button class="btn btn--primary btn--lg btn--full analyze" type="button" data-act="analyze" data-ripple>' +
      'ANALYZE GRID</button>' +

    /* ---- results ---- */
    '<section class="results" data-el="results" hidden aria-live="polite">' +
      '<header class="results__head">' +
        '<p class="results__ok mono">' + icon("check") + ' ANALYSIS COMPLETE</p>' +
        '<div class="conf">' +
          '<span class="conf__value" data-el="conf">—</span>' +
          '<span class="conf__label mono">ESTIMATED CONFIDENCE · SIMULATED ILLUSTRATIVE METRIC, NOT MEASURED ACCURACY</span>' +
        '</div>' +
      '</header>' +
      gridWrapHTML() +
      '<p class="results__positions mono" data-el="positions"></p>' +
      '<dl class="infocards">' +
        '<div class="infocard"><dt>SELECTED MINES</dt><dd data-el="infoMines">—</dd></div>' +
        '<div class="infocard infocard--accent"><dt>REVEALED SAFE TILES</dt><dd data-el="infoGems">—</dd></div>' +
        '<div class="infocard"><dt>GRID</dt><dd>5 × 5</dd></div>' +
        '<div class="infocard"><dt>STATUS</dt><dd data-el="infoStatus">ANALYSIS COMPLETE</dd></div>' +
      '</dl>' +
      '<p class="results__foot">' + icon("info") +
        '<span>Estimated visualization. Unrevealed cells carry no information — true mine positions are never ' +
        'calculated or displayed. This is not a prediction of any future game outcome.</span></p>' +
      '<div class="results__actions">' +
        '<button class="btn btn--outline" type="button" data-act="again">Run again</button>' +
        '<a class="btn btn--ghost" href="#/history">View history</a>' +
      '</div>' +
    '</section>';
  }

  /* ---------------------------------------------------------- grid render */
  function positionLabel(index) {
    return "R" + (Math.floor(index / 5) + 1) + "C" + ((index % 5) + 1);
  }

  function renderGrid(gridEl, cells, gemIndexes, animate) {
    gridEl.innerHTML = "";
    var frag = document.createDocumentFragment();
    var base = animate ? 860 : 0;
    for (var i = 0; i < cells.length; i++) {
      var cell = document.createElement("div");
      var isGem = cells[i] === "gem";
      /* No event listeners of any kind: cells are never interactive. */
      cell.className = "cell " + (isGem ? "cell--gem" : "cell--hidden");
      cell.style.setProperty("--d", (base + i * 20) + "ms");
      cell.innerHTML = icon(isGem ? "gem" : "hidden") +
        '<span class="sr-only">' + positionLabel(i) + (isGem ? ": gem, revealed safe tile" : ": unrevealed") + "</span>";
      if (!animate) cell.classList.add("is-shown");
      frag.appendChild(cell);
    }
    gridEl.appendChild(frag);
    gridEl.setAttribute("aria-label",
      "Estimated 5 by 5 grid visualization: " + gemIndexes.length + " revealed safe gem tile" +
      (gemIndexes.length === 1 ? "" : "s") + " of 25 cells at " +
      gemIndexes.map(positionLabel).join(", ") + ". All other cells are unrevealed.");
  }

  /* Choreography: container fade -> border draws -> scan sweep ->
     cells appear in sequence -> icons scale in -> one soft glow pulse. */
  function playReveal(wrap) {
    var animate = !UI.motionOff();
    if (!animate) {
      $$(".cell", wrap).forEach(function (c) { c.classList.add("is-shown"); });
      return;
    }
    wrap.classList.remove("is-pulse");
    wrap.classList.add("is-revealing");
    var cells = $$(".cell", wrap);
    var last = 860 + cells.length * 20 + 300;
    window.setTimeout(function () {
      cells.forEach(function (c) { c.classList.add("is-shown"); });
      wrap.classList.remove("is-revealing");
      wrap.classList.add("is-pulse");
      window.setTimeout(function () { wrap.classList.remove("is-pulse"); }, 1000);
    }, last);
  }

  /* ---------------------------------------------------------- overlay */
  var overlay = null, overlayPhase = null, overlayProgress = null, rocket = null;

  function cacheOverlay() {
    overlay = document.getElementById("analysisOverlay");
    overlayPhase = document.getElementById("overlayPhase");
    overlayProgress = document.getElementById("overlayProgress");
    rocket = document.getElementById("rocket");
  }

  function runOverlay(done) {
    if (!overlay) cacheOverlay();
    var duration = SPEEDS[Store.getSettings().speed] || SPEEDS.normal;

    if (UI.motionOff() || !overlay) {
      // Reduced motion / animations off: skip straight to the result.
      window.setTimeout(done, 60);
      return;
    }

    UI.particles(document.getElementById("overlayParticles"), 14);
    overlay.hidden = false;
    overlayPhase.textContent = PHASES[0];
    overlayProgress.style.width = "0%";
    if (rocket) rocket.classList.remove("is-launch");

    var start = (window.performance && performance.now) ? performance.now() : Date.now();
    var phase = 0;
    var launched = false;
    UI.sound.tap();

    function frame(now) {
      var t = ((window.performance && performance.now) ? now : Date.now()) - start;
      var pct = Math.min(1, t / duration);
      overlayProgress.style.width = (pct * 100).toFixed(1) + "%";

      var wantPhase = Math.min(PHASES.length - 1, Math.floor(pct * PHASES.length));
      if (wantPhase !== phase) {
        phase = wantPhase;
        overlayPhase.textContent = PHASES[phase];
      }
      if (!launched && pct >= 0.38) {
        launched = true;
        if (rocket) rocket.classList.add("is-launch");
        UI.sound.launch();
      }
      if (pct < 1) { window.requestAnimationFrame(frame); return; }

      overlay.hidden = true;
      if (rocket) rocket.classList.remove("is-launch");
      done();
    }
    window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------- instance */
  function mount(host, options) {
    if (!host) return null;
    var opts = options || {};
    var id = host.getAttribute("data-console") || ("c" + instances.length);
    host.innerHTML = consoleHTML(id);

    var el = {
      seed: $('[data-el="seed"]', host),
      chips: $('[data-el="chips"]', host),
      slider: $('[data-el="slider"]', host),
      selected: $('[data-el="selected"]', host),
      range: $('[data-el="range"]', host),
      risk: $('[data-el="risk"]', host),
      results: $('[data-el="results"]', host),
      wrap: $('[data-el="gridwrap"]', host),
      grid: $('[data-el="grid"]', host),
      conf: $('[data-el="conf"]', host),
      positions: $('[data-el="positions"]', host),
      infoMines: $('[data-el="infoMines"]', host),
      infoGems: $('[data-el="infoGems"]', host),
      analyze: $('[data-act="analyze"]', host)
    };

    var state = { mines: 3 };

    /* -- mine chips 1..24, laid out 8 per row -- */
    var frag = document.createDocumentFragment();
    for (var n = 1; n <= 24; n++) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = String(n);
      chip.setAttribute("data-mines", String(n));
      chip.setAttribute("aria-pressed", n === 3 ? "true" : "false");
      if (n >= Model.HIGH_RISK_FROM) {
        chip.setAttribute("data-risk", "1");
        chip.setAttribute("aria-label", n + " mines, high risk");
      } else {
        chip.setAttribute("aria-label", n + " mines");
      }
      frag.appendChild(chip);
    }
    el.chips.appendChild(frag);

    function setMines(n, fromChip) {
      state.mines = Model.clampMines(n);
      el.slider.value = String(state.mines);
      el.slider.style.setProperty("--fill", ((state.mines - 1) / 23 * 100).toFixed(1) + "%");
      el.selected.textContent = String(state.mines);
      el.range.innerHTML = Model.safeTileRangeLabel(state.mines);
      el.risk.classList.toggle("is-on", Model.isHighRisk(state.mines));
      $$(".chip", el.chips).forEach(function (c) {
        c.setAttribute("aria-pressed",
          parseInt(c.getAttribute("data-mines"), 10) === state.mines ? "true" : "false");
      });
      if (fromChip) { UI.sound.select(); UI.haptic(8); }
    }

    el.chips.addEventListener("click", function (e) {
      var chip = e.target.closest ? e.target.closest(".chip") : null;
      if (!chip) return;
      setMines(parseInt(chip.getAttribute("data-mines"), 10), true);
    });

    // arrow-key convenience inside the chip group
    el.chips.addEventListener("keydown", function (e) {
      var map = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 };
      if (!(e.key in map)) return;
      var chip = e.target.closest ? e.target.closest(".chip") : null;
      if (!chip) return;
      e.preventDefault();
      var next = Model.clampMines(parseInt(chip.getAttribute("data-mines"), 10) + map[e.key]);
      setMines(next, true);
      var target = $('.chip[data-mines="' + next + '"]', el.chips);
      if (target) target.focus();
    });

    el.slider.addEventListener("input", function () { setMines(el.slider.value, false); });
    el.slider.addEventListener("change", function () { UI.sound.select(); });

    host.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-act]") : null;
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "clear") {
        el.seed.value = "";
        el.seed.focus();
        UI.sound.tap();
      } else if (act === "paste") {
        pasteFromClipboard(el.seed);
      } else if (act === "random") {
        el.seed.value = randomSeed();
        UI.sound.tap();
      } else if (act === "analyze" || act === "again") {
        analyze();
      }
    });

    el.seed.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); analyze(); }
    });

    function analyze() {
      var seed = (el.seed.value || "").trim();
      if (!seed) {
        UI.toast("Enter a client seed to run an analysis.", "warn");
        el.seed.focus();
        return;
      }
      if (busy) return;
      busy = true;
      el.analyze.disabled = true;
      if (opts.onStart) opts.onStart();

      runOverlay(function () {
        var result = Model.buildGrid(seed, state.mines);
        show(result);
        busy = false;
        el.analyze.disabled = false;

        var entry = {
          id: Store.newId(),
          ts: Date.now(),
          seed: result.seed,
          hash: result.shortHash,
          mines: result.mines,
          gems: result.gems,
          confidence: result.confidence
        };
        Store.addHistory(entry);
        emit(entry);
        if (opts.onDone) opts.onDone(entry);
        UI.sound.done();
        UI.haptic([10, 40, 14]);
      });
    }

    function show(result) {
      el.results.hidden = false;
      el.conf.textContent = result.confidence.toFixed(1) + "%";
      el.infoMines.textContent = result.mines + " / 24";
      el.infoGems.textContent = result.gems + " / 25";
      el.positions.textContent = "GEM TILES: " +
        result.gemIndexes.map(positionLabel).join(" · ");
      renderGrid(el.grid, result.cells, result.gemIndexes, !UI.motionOff());
      playReveal(el.wrap);
      if (opts.scrollToResults !== false) {
        window.setTimeout(function () {
          try {
            el.results.scrollIntoView({
              behavior: UI.motionOff() ? "auto" : "smooth",
              block: "nearest"
            });
          } catch (e) { /* older browsers: no smooth scroll, no problem */ }
        }, 40);
      }
    }

    setMines(3, false);
    var api = { host: host, setMines: setMines, analyze: analyze, focusSeed: function () { el.seed.focus(); } };
    instances.push(api);
    return api;
  }

  /* ---------------------------------------------------------- helpers */
  function randomSeed() {
    var chars = "abcdef0123456789";
    var out = "";
    for (var i = 0; i < 24; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  function pasteFromClipboard(input) {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (text) {
        if (text) {
          input.value = text.trim();
          UI.sound.tap();
          UI.toast("Seed pasted from clipboard.");
        } else {
          UI.toast("Clipboard is empty.", "warn");
        }
      }).catch(function () {
        input.focus();
        UI.toast("Clipboard access was blocked — paste manually with Ctrl/Cmd + V.", "warn");
      });
    } else {
      input.focus();
      UI.toast("Clipboard API unavailable — paste manually with Ctrl/Cmd + V.", "warn");
    }
  }

  /* Read-only grid for the history detail view. */
  function renderStaticGrid(gridEl, seed, mines) {
    var result = Model.buildGrid(seed, mines);
    renderGrid(gridEl, result.cells, result.gemIndexes, false);
    return result;
  }

  return {
    mount: mount,
    onAnalysis: onAnalysis,
    gridWrapHTML: gridWrapHTML,
    renderGrid: renderGrid,
    renderStaticGrid: renderStaticGrid,
    positionLabel: positionLabel,
    instances: instances
  };
})();
