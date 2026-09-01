/* Node verification for the MineStackerBot grid model.
   Run: node tools/verify-model.js
   Not loaded by the website; a developer check only. */
"use strict";

var model = require("../assets/js/model.js");

var EXPECTED = {
  1: [5, 6], 2: [6, 6], 3: [5, 6], 4: [5, 5], 5: [4, 5], 6: [4, 4],
  7: [3, 4], 8: [3, 3], 9: [2, 3], 10: [2, 2], 11: [2, 2], 12: [2, 2],
  13: [2, 2], 14: [2, 2], 15: [2, 2], 16: [2, 2], 17: [2, 2], 18: [2, 2],
  19: [2, 2], 20: [2, 2], 21: [2, 2], 22: [2, 2], 23: [2, 2], 24: [1, 1]
};

var failures = [];
function check(name, ok, extra) {
  if (!ok) failures.push(name + (extra ? " -> " + extra : ""));
}

var SEEDS = [];
for (var s = 0; s < 400; s++) SEEDS.push("seed-" + s + "-" + (s * 7919).toString(16));
SEEDS.push("", "a", "A8F2C1D09B", "\u00e9\u00fc\u4e2d\u6587", "0", "  spaced seed  ");

/* 1. gem counts honour the table; always 25 cells; no bomb data. */
var seenCounts = {};
for (var m = 1; m <= 24; m++) {
  seenCounts[m] = {};
  for (var i = 0; i < SEEDS.length; i++) {
    var g = model.buildGrid(SEEDS[i], m);
    check("cells length (mines=" + m + ")", g.cells.length === 25, g.cells.length);
    var gems = g.cells.filter(function (c) { return c === "gem"; }).length;
    var hidden = g.cells.filter(function (c) { return c === "hidden"; }).length;
    check("only gem/hidden states (mines=" + m + ")", gems + hidden === 25);
    check("gems match reported count (mines=" + m + ")", gems === g.gems, gems + "!=" + g.gems);
    check("gems in table range (mines=" + m + ")",
      gems >= EXPECTED[m][0] && gems <= EXPECTED[m][1], "got " + gems);
    check("no mine cell state (mines=" + m + ")",
      g.cells.indexOf("mine") === -1 && g.cells.indexOf("bomb") === -1);
    var keys = Object.keys(g).join(",");
    check("no bomb/mine position field (mines=" + m + ")",
      !/bomb|mineIndex|minePositions|bombIndexes/i.test(keys), keys);
    check("mines echoed (mines=" + m + ")", g.mines === m);
    check("confidence sane (mines=" + m + ")",
      g.confidence >= 60 && g.confidence <= 95, g.confidence);
    check("confidence never 99 (mines=" + m + ")", g.confidence < 99);
    seenCounts[m][gems] = true;
  }
}

/* 2. ranged entries actually produce both values across seeds. */
Object.keys(EXPECTED).forEach(function (k) {
  var lo = EXPECTED[k][0], hi = EXPECTED[k][1];
  if (lo === hi) {
    check("fixed entry only value " + k,
      Object.keys(seenCounts[k]).length === 1 && seenCounts[k][lo]);
  } else {
    check("range entry " + k + " produces " + lo, !!seenCounts[k][lo]);
    check("range entry " + k + " produces " + hi, !!seenCounts[k][hi]);
    check("range entry " + k + " stays inside range",
      Object.keys(seenCounts[k]).length === 2);
  }
});

/* 3. determinism: same seed + same mines => identical layout. */
for (var d = 0; d < 50; d++) {
  var seed = SEEDS[d];
  var mines = (d % 24) + 1;
  var a = model.buildGrid(seed, mines);
  var b = model.buildGrid(seed, mines);
  check("determinism " + seed + "/" + mines,
    a.cells.join("") === b.cells.join("") && a.confidence === b.confidence);
}

/* 4. divergence: changing seed OR mines changes the layout. */
var diffSeed = 0, diffMines = 0, trialsSeed = 0, trialsMines = 0;
for (var t = 0; t < 300; t++) {
  var base = model.buildGrid("diverge-" + t, 3);
  var other = model.buildGrid("diverge-" + (t + 1), 3);
  trialsSeed++;
  if (base.cells.join("") !== other.cells.join("")) diffSeed++;

  var mA = model.buildGrid("fixed-seed-" + t, 2);
  var mB = model.buildGrid("fixed-seed-" + t, 7);
  trialsMines++;
  if (mA.cells.join("") !== mB.cells.join("")) diffMines++;
}
check("seed change alters layout (>=97%)", diffSeed / trialsSeed >= 0.97,
  diffSeed + "/" + trialsSeed);
check("mine-count change alters layout (>=97%)", diffMines / trialsMines >= 0.97,
  diffMines + "/" + trialsMines);

/* 5. clamping + hash helpers. */
check("clamp low", model.clampMines(0) === 1);
check("clamp high", model.clampMines(99) === 24);
check("clamp NaN", model.clampMines("abc") === 1);
check("high risk 9", model.isHighRisk(9) === false);
check("high risk 10", model.isHighRisk(10) === true);
check("high risk 24", model.isHighRisk(24) === true);
check("range label 1", model.safeTileRangeLabel(1) === "5\u20136");
check("range label 24", model.safeTileRangeLabel(24) === "1");
check("short hash format", /^#[0-9a-f]{4}\.\.\.[0-9a-f]{2}$/.test(model.shortHash("x")),
  model.shortHash("x"));
check("short hash deterministic", model.shortHash("abc") === model.shortHash("abc"));
check("short hash differs", model.shortHash("abc") !== model.shortHash("abd"));

/* 6. gem index integrity. */
var gi = model.buildGrid("index-check", 5);
check("gemIndexes length", gi.gemIndexes.length === gi.gems);
gi.gemIndexes.forEach(function (idx) {
  check("gem index in range", idx >= 0 && idx < 25, String(idx));
  check("gem index marks a gem cell", gi.cells[idx] === "gem");
});
check("gemIndexes unique",
  gi.gemIndexes.length === gi.gemIndexes.filter(function (v, i, arr) {
    return arr.indexOf(v) === i;
  }).length);

/* 7. distribution sanity: gems are not stuck in the same cells. */
var hits = new Array(25).fill(0);
for (var q = 0; q < 2000; q++) {
  model.buildGrid("dist-" + q, 3).gemIndexes.forEach(function (idx) { hits[idx]++; });
}
check("every cell can hold a gem", hits.every(function (h) { return h > 0; }), hits.join(","));

/* ------------------------------------------------------------------ */
if (failures.length) {
  console.error("FAILED (" + failures.length + "):");
  failures.slice(0, 40).forEach(function (f) { console.error("  - " + f); });
  process.exit(1);
}
console.log("Model verification passed.");
console.log("  seeds tested per mine count : " + SEEDS.length);
console.log("  mine counts tested          : 1..24");
console.log("  safe-tile table honoured    : yes (ranges hit both endpoints)");
console.log("  cells always 25             : yes");
console.log("  bomb positions in model     : none");
console.log("  deterministic + divergent   : yes");
