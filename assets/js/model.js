/* =====================================================================
   MineStackerBot — grid model (pure, deterministic, no DOM)
   ---------------------------------------------------------------------
   This module is the single source of truth for what the 5 x 5
   visualization contains.

   IMPORTANT PRODUCT / SAFETY RULE
   ------------------------------
   True bomb ("mine") positions are NEVER computed, stored or returned
   anywhere in this codebase. There is deliberately no array of bomb
   indices that could leak through the DOM, a global, or devtools.
   The model only decides WHICH SAFE GEM TILES ARE REVEALED; every other
   cell is simply "hidden" (unrevealed) and carries no information.

   The model is deterministic: the same (seed, mines) pair always yields
   the same layout; changing either changes the layout.

   Loadable both in the browser (attaches to window.MSBModel) and in
   Node (module.exports) so the model can be verified from a script.
   ===================================================================== */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MSBModel = api;
})(typeof self !== "undefined" ? self : null, function () {
  "use strict";

  var GRID_CELLS = 25; // always exactly 25 cells (5 x 5)
  var MIN_MINES = 1;
  var MAX_MINES = 24;

  /* ---------------------------------------------------------------
     AUTHORITATIVE SAFE-TILE TABLE
     How many safe gem tiles are revealed for a selected mine count.
     A two-value entry is an inclusive range; the value inside the
     range is chosen deterministically from the seeded PRNG.
     --------------------------------------------------------------- */
  var SAFE_TILE_TABLE = {
    1: [5, 6],
    2: [6, 6],
    3: [5, 6],
    4: [5, 5],
    5: [4, 5],
    6: [4, 4],
    7: [3, 4],
    8: [3, 3],
    9: [2, 3],
    10: [2, 2],
    11: [2, 2],
    12: [2, 2],
    13: [2, 2],
    14: [2, 2],
    15: [2, 2],
    16: [2, 2],
    17: [2, 2],
    18: [2, 2],
    19: [2, 2],
    20: [2, 2],
    21: [2, 2],
    22: [2, 2],
    23: [2, 2],
    24: [1, 1]
  };

  var HIGH_RISK_FROM = 10; // 10..24 are flagged "HIGH RISK"

  /* -------- Seeded PRNG: xmur3 (string -> 32-bit seeds) -------- */
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

  /* -------- mulberry32: fast 32-bit PRNG stream in [0, 1) -------- */
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic stream keyed by both the seed string and the mine count.
  function makeRng(seed, mines) {
    var next = xmur3(String(seed) + "::mines=" + String(mines));
    return mulberry32(next());
  }

  function clampMines(mines) {
    var n = parseInt(mines, 10);
    if (isNaN(n)) n = MIN_MINES;
    return Math.min(MAX_MINES, Math.max(MIN_MINES, n));
  }

  function isHighRisk(mines) {
    return clampMines(mines) >= HIGH_RISK_FROM;
  }

  // Human-readable table entry, e.g. "5-6" or "2".
  function safeTileRangeLabel(mines) {
    var r = SAFE_TILE_TABLE[clampMines(mines)];
    return r[0] === r[1] ? String(r[0]) : r[0] + "\u2013" + r[1];
  }

  /* -------- Short display hash for a seed (never reversible) -------- */
  function seedHashHex(seed) {
    var next = xmur3("hash::" + String(seed));
    var a = next(), b = next();
    var hex = ("00000000" + a.toString(16)).slice(-8) +
              ("00000000" + b.toString(16)).slice(-8);
    return hex;
  }

  // e.g. "#a8f2...9b"
  function shortHash(seed) {
    var hex = seedHashHex(seed);
    return "#" + hex.slice(0, 4) + "..." + hex.slice(-2);
  }

  /* ---------------------------------------------------------------
     buildGrid(seed, mines)
     Returns:
       {
         seed, mines, gems, cells: ["hidden"|"gem", ... 25],
         gemIndexes: [..], confidence: Number (SIMULATED metric),
         highRisk: Boolean, shortHash: String
       }
     There is no bomb / mine index list — by design.
     --------------------------------------------------------------- */
  function buildGrid(seed, mines) {
    var m = clampMines(mines);
    var rng = makeRng(seed, m);
    var range = SAFE_TILE_TABLE[m];

    // Always draw exactly one value for the gem count so the PRNG
    // stream advances identically for fixed and ranged entries.
    var span = range[1] - range[0] + 1;
    var gems = range[0] + Math.floor(rng() * span);

    // Deterministic Fisher-Yates shuffle of all 25 cell indexes.
    var order = [];
    for (var i = 0; i < GRID_CELLS; i++) order.push(i);
    for (var j = GRID_CELLS - 1; j > 0; j--) {
      var k = Math.floor(rng() * (j + 1));
      var tmp = order[j];
      order[j] = order[k];
      order[k] = tmp;
    }

    // The first `gems` shuffled indexes become revealed safe tiles.
    // The remaining indexes are NOT bombs and are not tracked as such —
    // they are simply left unrevealed.
    var gemIndexes = order.slice(0, gems).sort(function (a, b) { return a - b; });

    var isGem = {};
    for (var g = 0; g < gemIndexes.length; g++) isGem[gemIndexes[g]] = true;

    var cells = [];
    for (var c = 0; c < GRID_CELLS; c++) cells.push(isGem[c] ? "gem" : "hidden");

    return {
      seed: String(seed),
      mines: m,
      gems: gems,
      cells: cells,
      gemIndexes: gemIndexes,
      confidence: simulatedConfidence(m, rng),
      highRisk: isHighRisk(m),
      shortHash: shortHash(seed)
    };
  }

  /* ---------------------------------------------------------------
     simulatedConfidence()
     An ILLUSTRATIVE, SIMULATED figure only. It is a deterministic
     function of the seed stream and the mine count. It is NOT a
     measured accuracy, hit rate or win probability, and the UI always
     labels it as simulated. Deliberately capped well below 100.
     --------------------------------------------------------------- */
  function simulatedConfidence(mines, rng) {
    var draw = typeof rng === "function" ? rng() : 0.5;
    var raw = 92 - (clampMines(mines) - 1) * 1.05 + draw * 3;
    raw = Math.min(95, Math.max(60, raw));
    return Math.round(raw * 10) / 10;
  }

  return {
    GRID_CELLS: GRID_CELLS,
    MIN_MINES: MIN_MINES,
    MAX_MINES: MAX_MINES,
    HIGH_RISK_FROM: HIGH_RISK_FROM,
    SAFE_TILE_TABLE: SAFE_TILE_TABLE,
    xmur3: xmur3,
    mulberry32: mulberry32,
    makeRng: makeRng,
    clampMines: clampMines,
    isHighRisk: isHighRisk,
    safeTileRangeLabel: safeTileRangeLabel,
    seedHashHex: seedHashHex,
    shortHash: shortHash,
    buildGrid: buildGrid
  };
});
