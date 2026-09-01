/* MINES STACKER BOT — analysis / visualisation app (NOT a playable game).
   Vanilla JS only. Offline-capable. No external requests. */
(function () {
  "use strict";

  var GRID_SIZE = 25; // 5 x 5, always exactly 25 cells

  /* -------- Seeded PRNG: xmur3 (hash string) + mulberry32 (stream) -------- */
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic RNG from a seed string + mine count.
  function makeRng(seedStr, mines) {
    var seed = xmur3(String(seedStr) + "::" + String(mines));
    return mulberry32(seed());
  }

  /* -------- App state machine -------- */
  var state = {
    stage: "seed", // seed -> mines -> ready -> evaluating -> results
    seed: "",
    mines: null
  };

  var el = {};

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    el.seedInput = $("seedInput");
    el.generateBtn = $("generateBtn");
    el.minesGrid = $("minesGrid");
    el.minesValue = $("minesValue");
    el.analyzeBtn = $("analyzeBtn");
    el.stageEval = $("stageEval");
    el.evalStatus = $("evalStatus");
    el.evalFill = $("evalFill");
    el.stageResults = $("stageResults");
    el.grid = $("grid");
    el.resultsSeed = $("resultsSeed");
    el.resultsMines = $("resultsMines");
    el.reanalyzeBtn = $("reanalyzeBtn");
    el.resetBtn = $("resetBtn");
  }

  /* -------- Seed generation -------- */
  function randomSeed() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < 10; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  /* -------- Mines selector (1..24) -------- */
  function buildMinesSelector() {
    var frag = document.createDocumentFragment();
    for (var n = 1; n <= 24; n++) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "mine-chip";
      chip.textContent = String(n);
      chip.setAttribute("data-mines", String(n));
      chip.addEventListener("click", onSelectMines);
      frag.appendChild(chip);
    }
    el.minesGrid.appendChild(frag);
  }

  function onSelectMines(e) {
    var n = parseInt(e.currentTarget.getAttribute("data-mines"), 10);
    state.mines = n;
    var chips = el.minesGrid.querySelectorAll(".mine-chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle("selected", chips[i] === e.currentTarget);
    }
    el.minesValue.textContent = n;
    updateAnalyzeGuard();
  }

  function updateAnalyzeGuard() {
    state.seed = el.seedInput.value.trim();
    var ok = state.seed.length > 0 && state.mines !== null;
    el.analyzeBtn.disabled = !ok;
  }

  /* -------- Deterministic grid model --------
     REVEAL RULE: never reveal true bomb positions.
     Choose 4-5 safe GEM tiles deterministically; render the rest gray. */
  function buildGridModel(seedStr, mines) {
    var rng = makeRng(seedStr, mines);
    // 4 or 5 gems, deterministic from the seed stream.
    var gemCount = 4 + Math.floor(rng() * 2); // 4 or 5

    var indices = [];
    for (var i = 0; i < GRID_SIZE; i++) indices.push(i);

    // Deterministic Fisher-Yates shuffle using the seeded RNG.
    for (var j = GRID_SIZE - 1; j > 0; j--) {
      var k = Math.floor(rng() * (j + 1));
      var tmp = indices[j];
      indices[j] = indices[k];
      indices[k] = tmp;
    }

    var gemSet = {};
    for (var g = 0; g < gemCount; g++) gemSet[indices[g]] = true;

    var cells = [];
    for (var c = 0; c < GRID_SIZE; c++) {
      cells.push(gemSet[c] ? "gem" : "gray");
    }
    return cells;
  }

  function renderGrid(cells) {
    el.grid.innerHTML = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < cells.length; i++) {
      var cell = document.createElement("div");
      cell.className = "cell " + cells[i];
      // No click / reveal handlers: this is visualisation, not a game.
      if (cells[i] === "gem") {
        cell.textContent = "\uD83D\uDC8E"; // 💎
      }
      cell.style.animationDelay = (i * 18) + "ms";
      frag.appendChild(cell);
    }
    el.grid.appendChild(frag);
  }

  /* -------- Evaluation animation, then reveal -------- */
  var EVAL_MESSAGES = [
    "Initialising bot core...",
    "Hashing seed vector...",
    "Scanning mine field...",
    "Computing safe clusters...",
    "Stacking probabilities...",
    "Finalising analysis..."
  ];

  var evalTimer = null;

  function runEvaluation() {
    if (state.analyzing) return;
    state.stage = "evaluating";
    state.analyzing = true;

    el.stageResults.hidden = true;
    el.stageEval.hidden = false;
    el.analyzeBtn.disabled = true;

    var start = Date.now();
    var duration = 2200; // short animated sequence
    var msgIndex = 0;
    el.evalStatus.textContent = EVAL_MESSAGES[0];
    el.evalFill.style.width = "0%";

    clearInterval(evalTimer);
    evalTimer = setInterval(function () {
      var elapsed = Date.now() - start;
      var pct = Math.min(100, Math.round((elapsed / duration) * 100));
      el.evalFill.style.width = pct + "%";

      var wantIndex = Math.min(
        EVAL_MESSAGES.length - 1,
        Math.floor((elapsed / duration) * EVAL_MESSAGES.length)
      );
      if (wantIndex !== msgIndex) {
        msgIndex = wantIndex;
        el.evalStatus.textContent = EVAL_MESSAGES[msgIndex];
      }

      if (elapsed >= duration) {
        clearInterval(evalTimer);
        finishEvaluation();
      }
    }, 60);
  }

  function finishEvaluation() {
    state.analyzing = false;
    state.stage = "results";

    var cells = buildGridModel(state.seed, state.mines);
    renderGrid(cells);

    el.resultsSeed.textContent = "Seed: " + state.seed;
    el.resultsMines.textContent = "Mines: " + state.mines;

    el.stageEval.hidden = true;
    el.stageResults.hidden = false;
    el.analyzeBtn.disabled = false;
  }

  /* -------- Reset -------- */
  function resetAll() {
    clearInterval(evalTimer);
    state.analyzing = false;
    state.stage = "seed";
    state.mines = null;
    el.seedInput.value = "";
    el.minesValue.textContent = "—";
    var chips = el.minesGrid.querySelectorAll(".mine-chip");
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove("selected");
    el.grid.innerHTML = "";
    el.stageResults.hidden = true;
    el.stageEval.hidden = true;
    updateAnalyzeGuard();
    el.seedInput.focus();
  }

  /* -------- Wiring -------- */
  function init() {
    cacheEls();
    buildMinesSelector();

    el.generateBtn.addEventListener("click", function () {
      el.seedInput.value = randomSeed();
      updateAnalyzeGuard();
    });

    el.seedInput.addEventListener("input", updateAnalyzeGuard);

    el.analyzeBtn.addEventListener("click", function () {
      updateAnalyzeGuard();
      if (el.analyzeBtn.disabled) return;
      runEvaluation();
    });

    el.reanalyzeBtn.addEventListener("click", function () {
      // Same seed + same mine count reproduces the identical grid.
      runEvaluation();
    });

    el.resetBtn.addEventListener("click", resetAll);

    updateAnalyzeGuard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
