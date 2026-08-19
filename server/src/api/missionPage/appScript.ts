// Client script for the Mission Center console.
//
// Written without template literals on purpose: this whole file is embedded in a
// TypeScript template literal, so a stray backtick or ${ would terminate it or
// interpolate at build time. String concatenation keeps that impossible.

export const MISSION_APP_SCRIPT = String.raw`
"use strict";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

var $ = function (id) { return document.getElementById(id); };

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function num(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-US");
}

function ago(ts) {
  if (!ts) return "—";
  var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function duration(seconds) {
  var d = Math.floor(seconds / 86400);
  var h = Math.floor((seconds % 86400) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  if (d) return d + "d " + h + "h";
  if (h) return h + "h " + m + "m";
  return m + "m";
}

function api(path, options) {
  var opts = options || {};
  opts.credentials = "same-origin";
  if (opts.body && typeof opts.body !== "string") {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(opts.body);
  }
  return fetch("/api/mission" + path, opts).then(function (res) {
    if (res.status === 401) { window.location.href = "/mission/login"; throw new Error("unauthenticated"); }
    return res.json().catch(function () { return {}; }).then(function (data) {
      if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
      return data;
    });
  });
}

function tile(label, value, sub, tone) {
  return '<div class="tile ' + (tone || "") + '">' +
    '<div class="label">' + esc(label) + '</div>' +
    '<div class="value">' + esc(value) + '</div>' +
    (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
    '</div>';
}

function badge(text, tone) {
  return '<span class="badge ' + (tone || "") + '">' + esc(text) + '</span>';
}

function rowsInto(table, headers, rows, emptyMessage) {
  var head = "<thead><tr>" + headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead>";
  var body = rows.length
    ? rows.join("")
    : '<tr><td colspan="' + headers.length + '" class="muted">' + esc(emptyMessage || "Nothing yet.") + "</td></tr>";
  table.innerHTML = head + "<tbody>" + body + "</tbody>";
}

// ---------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------

var loaders = {};
var loadedOnce = {};

function showTab(name) {
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-panel]"), function (s) {
    s.classList.toggle("hidden", s.dataset.panel !== name);
  });
  window.location.hash = name;
  if (loaders[name]) loaders[name]();
  loadedOnce[name] = true;
}

Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
  b.addEventListener("click", function () { showTab(b.dataset.tab); });
});

// ---------------------------------------------------------------------------
// OPS
// ---------------------------------------------------------------------------

function deployTone(status) {
  var s = String(status).toUpperCase();
  if (s === "SUCCESS" || s === "READY") return "good";
  if (s === "FAILED" || s === "CRASHED" || s === "ERROR" || s === "CANCELED") return "bad";
  return "warn";
}

loaders.ops = function () {
  api("/ops").then(function (ops) {
    var banners = [];
    if (ops.server.staleBuild) {
      banners.push('<div class="banner bad">⚠️ The newest deploy FAILED and an older build is still serving. ' +
        'What you see in prod is not the code on main.</div>');
    }
    if (!ops.database.reachable && ops.database.configured) {
      banners.push('<div class="banner bad">⚠️ The database is not reachable.</div>');
    }
    if (ops.errorsLast15m > 0) {
      banners.push('<div class="banner warn">' + ops.errorsLast15m +
        ' error log line(s) in the last 15 minutes — see the Logs panel.</div>');
    }
    $("opsBanners").innerHTML = banners.join("");

    var db = ops.database.configured
      ? (ops.database.reachable ? ops.database.latencyMs + "ms" : "unreachable")
      : "not configured";

    $("opsTiles").innerHTML = [
      tile("Running version", "v" + ops.version, "uptime " + duration(ops.uptimeSeconds)),
      tile("Players online", num(ops.onlinePlayers), "live, from memory"),
      tile("Database", db, ops.database.configured ? "SELECT 1" : "DATABASE_URL unset",
        ops.database.reachable ? "good" : (ops.database.configured ? "bad" : "")),
      tile("Requests", num(ops.requests.requests), ops.requests.perMinute + "/min over " + ops.requests.windowMinutes + "m"),
      tile("Latency", ops.requests.p50Ms + " / " + ops.requests.p95Ms + "ms", "p50 / p95"),
      tile("5xx rate", ops.requests.errorRate + "%", num(ops.requests.errors5xx) + " responses",
        ops.requests.errors5xx > 0 ? "bad" : "good"),
      tile("Memory", ops.memoryMb + " MB", "resident set size")
    ].join("");

    $("railwayHint").textContent = ops.server.configured ? "" : ops.server.hint;
    rowsInto($("railwayTable"), ["Status", "Commit", "Message", "When"],
      ops.server.deployments.map(function (d) {
        return "<tr><td>" + badge(d.status, deployTone(d.status)) + "</td>" +
          '<td class="mono">' + esc(d.commitSha ? d.commitSha.slice(0, 7) : "—") + "</td>" +
          "<td>" + esc((d.commitMessage || "—").split("\n")[0]) + "</td>" +
          '<td class="muted">' + esc(ago(d.createdAt)) + "</td></tr>";
      }),
      ops.server.configured ? "No deploys returned." : ops.server.hint);

    $("vercelHint").textContent = ops.client.configured ? "" : ops.client.hint;
    rowsInto($("vercelTable"), ["State", "Target", "Commit", "Message", "When"],
      ops.client.deployments.map(function (d) {
        return "<tr><td>" + badge(d.state, deployTone(d.state)) + "</td>" +
          "<td>" + esc(d.target || "—") + "</td>" +
          '<td class="mono">' + esc(d.commitSha ? d.commitSha.slice(0, 7) : "—") + "</td>" +
          "<td>" + esc((d.commitMessage || "—").split("\n")[0]) + "</td>" +
          '<td class="muted">' + esc(ago(d.createdAt)) + "</td></tr>";
      }),
      ops.client.configured ? "No deploys returned." : ops.client.hint);
  }).catch(function (e) {
    $("opsBanners").innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>";
  });

  refreshLogs();
};

function refreshLogs() {
  var params = "?source=" + encodeURIComponent($("logSource").value) +
    "&level=" + encodeURIComponent($("logLevel").value) +
    "&search=" + encodeURIComponent($("logSearch").value);
  api("/logs" + params).then(function (data) {
    var box = $("logBox");
    var atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.innerHTML = data.lines.length
      ? data.lines.map(function (l) {
          var time = new Date(l.at).toISOString().slice(11, 19);
          return '<div class="line lv-' + esc(l.level) + '"><span class="t">' + time + "</span>" + esc(l.message) + "</div>";
        }).join("")
      : '<div class="line muted">No matching lines.</div>';
    if (atBottom) box.scrollTop = box.scrollHeight;
  }).catch(function () {});
}

$("logRefresh").addEventListener("click", refreshLogs);
$("logSource").addEventListener("change", refreshLogs);
$("logLevel").addEventListener("change", refreshLogs);
$("logSearch").addEventListener("keydown", function (e) { if (e.key === "Enter") refreshLogs(); });

// Ops is the tab you leave open, so it polls. The others refresh on visit.
//
// IDLE AUTO-PAUSE — this is a cost control, not a nicety. Neon bills compute
// active time and one query is enough to keep the compute awake, so a console
// left open overnight would stop the database ever suspending and quietly eat
// the month's allowance. A job polling faster than the suspend window is
// exactly what caused a surprise bill here once before. After IDLE_MS without
// interaction the polling stops and says so; any click, key or scroll resumes it.
var IDLE_MS = 10 * 60 * 1000;
var lastInteraction = Date.now();
var paused = false;

function markActive() {
  lastInteraction = Date.now();
  if (paused) {
    paused = false;
    renderPauseState();
    loaders.ops();
  }
}

["click", "keydown", "scroll", "mousemove", "touchstart"].forEach(function (evt) {
  window.addEventListener(evt, markActive, { passive: true });
});

function renderPauseState() {
  var el = $("pauseNote");
  if (!el) return;
  el.innerHTML = paused
    ? '<div class="banner warn">⏸ Live updates paused after 10 minutes idle, so the database can sleep. ' +
      'Click anywhere to resume.</div>'
    : "";
}

function opsVisible() {
  return !document.querySelector('[data-panel="ops"]').classList.contains("hidden");
}

function shouldPoll() {
  if (document.hidden || !opsVisible()) return false;
  if (Date.now() - lastInteraction > IDLE_MS) {
    if (!paused) { paused = true; renderPauseState(); }
    return false;
  }
  return true;
}

setInterval(function () {
  if (!shouldPoll()) return;
  if ($("logAuto").checked) refreshLogs();
}, 10000);

setInterval(function () {
  if (!shouldPoll()) return;
  loaders.ops();
}, 30000);

// ---------------------------------------------------------------------------
// GAME
// ---------------------------------------------------------------------------

loaders.game = function () {
  api("/game").then(function (s) {
    $("gameTiles").innerHTML = [
      tile("Registered", num(s.players.registered)),
      tile("Online now", num(s.players.online)),
      tile("Avg level", s.players.avgLevel),
      tile("Max level", s.players.maxLevel),
      tile("Worlds", num(s.worlds.total), num(s.worlds.published) + " published"),
      tile("World visits", num(s.worlds.visits))
    ].join("");

    if (s.retention) {
      var r = s.retention;
      $("retention").innerHTML = "<pre class=\"mono small\">" + esc(JSON.stringify(r, null, 2)) + "</pre>";
    } else {
      $("retention").textContent = "No retention data.";
    }

    $("econTiles").innerHTML = [
      tile("Circulating gold", num(s.players.circulatingGold)),
      tile("Treasury", num(s.treasury.total)),
      tile("Gold market trades", num(s.goldMarket.trades)),
      tile("Asset listings", num(s.assetMarket.listings)),
      tile("Open jobs", num(s.jobs != null ? s.jobs : 0))
    ].join("");

    $("baseTiles").innerHTML = [
      tile("Burned", num(s.baseToken.burned) + " $BASE"),
      tile("Held by players", num(s.baseToken.heldByPlayers) + " $BASE"),
      tile("Holders", num(s.baseToken.holders)),
      tile("Ad revenue", num(s.ads ? s.ads.totalRevenue : 0) + " $BASE")
    ].join("");
  }).catch(function (e) {
    $("gameTiles").innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>";
  });
};

// ---------------------------------------------------------------------------
// X GROWTH
// ---------------------------------------------------------------------------

var xState = { posts: [], targets: [], snapshots: [], statuses: [], slotKinds: [], evaluation: null };

var SLOT_LABEL = {
  mon_economy: "Mon · economy",
  wed_build: "Wed · build",
  fri_game: "Fri · game",
  extra: "Bank"
};

var STATUS_TONE = { idea: "", drafted: "info", scheduled: "warn", posted: "good", skipped: "" };

loaders.x = function () {
  // Returns the promise so callers that create a post and then want to open it
  // (the thread follow-up) can wait for state to refresh first.
  return Promise.all([
    api("/x"), api("/x/evaluation"), api("/x/trades"), api("/x/crossposts"), api("/x/replies")
  ]).then(function (results) {
    var data = results[0];
    xState.posts = data.posts;
    xState.targets = data.targets;
    xState.templates = data.templates || [];
    xState.snapshots = data.snapshots;
    xState.statuses = data.statuses;
    xState.slotKinds = data.slotKinds;
    xState.evaluation = results[1];
    xState.trades = results[2].trades || [];
    xState.tradeStats = results[2].stats || null;
    xState.tradeMeta = results[2];
    xState.crossposts = results[3].crossposts || [];
    xState.crossStats = results[3].stats || null;
    xState.replies = results[4].replies || [];
    renderX();
  }).catch(function (e) {
    $("xBoard").innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>";
  });
};

// Progress toward Original Content Rewards eligibility.
//
// The coverage line is not decoration. This total is a sum of hand-entered
// figures, so it is only as true as the number of posts that actually have one.
// A big total drawn from three of twenty posts reads as progress and is really
// a sampling artefact — say so on the tile rather than let the bar imply it.
function renderCreatorProgram(cp) {
  if (!cp) return;
  var pct = Math.round(cp.progress * 100);
  var measured = cp.recorded + cp.missing;

  $("xCreator").innerHTML = [
    tile("Verified impressions", num(cp.total), "last 90 days, replies excluded",
      cp.eligible ? "good" : ""),
    tile("Threshold", num(cp.threshold), "Original Content Rewards"),
    tile("Progress", pct + "%", cp.eligible ? "eligible" : num(cp.threshold - cp.total) + " to go",
      cp.eligible ? "good" : ""),
    tile("Coverage", cp.recorded + " / " + measured, "posts with a figure entered",
      cp.missing === 0 && measured > 0 ? "good" : "bad")
  ].join("");

  var note;
  if (measured === 0) {
    note = "No posts in the last 90 days yet.";
  } else if (cp.recorded === 0) {
    note = "No verified-impression figures entered yet, so this total is 0 because nothing was measured — " +
      "not because reach is zero. Enter the figure from X analytics per post; it is NOT the impressions column.";
  } else if (cp.missing > 0) {
    note = cp.missing + " of " + measured + " posts in the window have no figure entered, so the real total is " +
      "higher than " + num(cp.total) + ". Treat this as a floor, not a measurement.";
  } else {
    note = "Every post in the window has a figure. This total is trustworthy.";
  }
  $("xCreatorNote").textContent = note;
}

function renderX() {
  var ev = xState.evaluation;

  $("xTotals").innerHTML = [
    tile("Posts measured", num(ev.totals.posts)),
    tile("Impressions", num(ev.totals.impressions)),
    tile("Signups attributed", num(ev.totals.signups), "within " + ev.attributionHours + "h of posting"),
    tile("Signups / 10k impressions", ev.totals.signupsPer10k, "the conversion number",
      ev.totals.signupsPer10k > 0 ? "good" : "bad")
  ].join("");

  $("xThin").textContent = ev.thin
    ? "Fewer than 6 posts have results entered — the breakdowns below are noise until more land."
    : "";

  renderCreatorProgram(ev.creatorProgram);
  renderEval();
  renderBoard();
  renderTrades();
  renderCrossposts();
  renderReplies();
  renderSnapshots();

  rowsInto($("targetTable"), ["Handle", "Room", "Who", "Last engaged", ""],
    xState.targets.map(function (t) {
      return "<tr><td><a href=\"https://x.com/" + esc(t.handle) + "\" target=\"_blank\" rel=\"noopener\">@" +
        esc(t.handle) + "</a></td>" +
        '<td class="muted small">' + esc(t.cadence) + "</td>" +
        '<td class="small">' + esc(t.why) + "</td>" +
        '<td class="muted small">' + esc(t.lastEngagedAt ? ago(t.lastEngagedAt) : "never") + "</td>" +
        '<td><button class="btn tiny" data-engage="' + esc(t.handle) + '">Mark engaged</button></td></tr>';
    }), "No targets imported yet.");

  Array.prototype.forEach.call($("targetTable").querySelectorAll("[data-engage]"), function (b) {
    b.addEventListener("click", function () {
      api("/x/targets/" + encodeURIComponent(b.dataset.engage) + "/engaged", { method: "POST" })
        .then(function (d) { xState.targets = d.targets; renderX(); });
    });
  });
}

function renderEval() {
  var key = $("evalGroup").value;
  var groups = xState.evaluation[key] || [];
  rowsInto($("evalTable"), ["Group", "Posts", "Median impressions", "Median engagement", "Signups", "Per 10k"],
    groups.map(function (g) {
      return "<tr><td><strong>" + esc(g.key) + "</strong></td>" +
        "<td>" + g.posts + "</td>" +
        "<td>" + num(g.medianImpressions) + "</td>" +
        "<td>" + (g.medianEngagementRate * 100).toFixed(2) + "%</td>" +
        "<td>" + num(g.totalSignups) + "</td>" +
        "<td><strong>" + g.signupsPer10k + "</strong></td></tr>";
    }), "No posts with results entered yet.");
}

$("evalGroup").addEventListener("change", renderEval);

function renderBoard() {
  var filter = $("xFilter").value;
  // "Due this week" is the default working view: unposted posts slotted from
  // today through the next 7 days, so the board opens on what actually needs
  // writing rather than the whole backlog.
  var today = new Date().toISOString().slice(0, 10);
  var weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  var posts = xState.posts.filter(function (p) {
    if (filter === "all") return true;
    if (filter === "due") {
      return p.status !== "posted" && p.status !== "skipped" &&
        p.slotDate && p.slotDate >= today && p.slotDate <= weekEnd;
    }
    if (filter === "pipeline") return p.status !== "posted" && p.status !== "skipped";
    return p.status === filter;
  });

  // Group a thread under its parent: a post with threadOf sorts immediately
  // after its parent and is marked, so a multi-tweet thread reads in order.
  var byId = {};
  for (var k = 0; k < posts.length; k += 1) byId[posts[k].id] = posts[k];
  posts = posts.slice().sort(function (a, b) {
    var ak = a.threadOf && byId[a.threadOf] ? a.threadOf : a.id;
    var bk = b.threadOf && byId[b.threadOf] ? b.threadOf : b.id;
    if (ak !== bk) return ak - bk;
    return (a.threadOf ? 1 : 0) - (b.threadOf ? 1 : 0);
  });

  $("xBoard").innerHTML = posts.length ? posts.map(function (p) {
    var m = p.metrics;
    var isChild = p.threadOf && byId[p.threadOf];
    return '<div class="card" data-post="' + p.id + '"' + (isChild ? ' style="margin-left:16px;border-left:3px solid var(--line);"' : "") + ">" +
      '<div class="when">' + (isChild ? "↳ " : "") + esc(p.slotDate || "unscheduled") + " · " + esc(SLOT_LABEL[p.slotKind] || p.slotKind) + "</div>" +
      '<div class="title">' + esc(p.ref ? p.ref + " " : "") + esc(p.title || "(untitled)") + "</div>" +
      '<div class="meta">' +
        badge(p.status, STATUS_TONE[p.status]) +
        (p.format ? badge(p.format) : "") +
        (isChild ? badge("🧵 thread") : "") +
        (p.imagePrompt ? badge("🖼️ prompt") : badge("no image", "warn")) +
        (m ? badge(num(m.impressions) + " impr", "info") : "") +
        (p.verifiedHandle ? badge("✓ @" + p.verifiedHandle, "good") : "") +
      "</div></div>";
  }).join("") : '<p class="muted">Nothing matches that filter.</p>';

  Array.prototype.forEach.call($("xBoard").querySelectorAll("[data-post]"), function (card) {
    card.addEventListener("click", function () { openPost(Number(card.dataset.post)); });
  });
}

$("xFilter").addEventListener("change", renderBoard);

function renderSnapshots() {
  var snaps = xState.snapshots;
  if (!snaps.length) { $("snapChart").innerHTML = '<p class="muted small">No snapshots recorded yet.</p>'; return; }

  var w = 720, h = 160, pad = 28;
  var values = snaps.map(function (s) { return s.followers; });
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  var span = Math.max(1, max - min);
  var points = snaps.map(function (s, i) {
    var x = pad + (i / Math.max(1, snaps.length - 1)) * (w - pad * 2);
    var y = h - pad - ((s.followers - min) / span) * (h - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");

  $("snapChart").innerHTML =
    '<svg viewBox="0 0 ' + w + " " + h + '" style="width:100%;height:auto;">' +
      '<polyline fill="none" stroke="#3fae74" stroke-width="2.5" points="' + points + '" />' +
      '<text x="' + pad + '" y="14" font-size="11" fill="#9c8a6d">' + num(min) + " → " + num(max) + " followers</text>" +
      '<text x="' + pad + '" y="' + (h - 6) + '" font-size="11" fill="#9c8a6d">' + esc(snaps[0].day) + "</text>" +
      '<text x="' + (w - pad) + '" y="' + (h - 6) + '" font-size="11" fill="#9c8a6d" text-anchor="end">' +
        esc(snaps[snaps.length - 1].day) + "</text>" +
    "</svg>";
}

$("snapSave").addEventListener("click", function () {
  api("/x/snapshots", { method: "POST", body: {
    day: $("snapDay").value,
    followers: $("snapFollowers").value,
    following: $("snapFollowing").value,
    posts: $("snapPosts").value
  }}).then(function (d) { xState.snapshots = d.snapshots; renderSnapshots(); })
    .catch(function (e) { alert(e.message); });
});

$("xCapture").addEventListener("click", function () {
  api("/x/capture", { method: "POST" }).then(function (d) {
    alert(d.created ? ("Captured " + d.created + " shipped stor" + (d.created === 1 ? "y" : "ies") + ".")
                    : "Nothing new — every shipped version already has a post.");
    loaders.x();
  }).catch(function (e) { alert(e.message); });
});

// ---------------------------------------------------------------------------
// Trading ledger
// ---------------------------------------------------------------------------

var editingTrade = null;

function rfmt(r) {
  // R shown to one decimal with an explicit sign, so +2.0R and -1.0R read as a
  // record at a glance. Blank when R can't be computed yet (no exit/stop).
  if (r == null) return "—";
  return (r >= 0 ? "+" : "") + r.toFixed(1) + "R";
}

function renderTrades() {
  var st = xState.tradeStats;
  if (st) {
    var ratio = Math.round(st.closeRatio * 100);
    $("tradeStats").innerHTML = [
      // The headline: closed vs opened calls. Anything under 100% with open
      // calls sitting unclosed is the failure the ledger exists to prevent.
      tile("Calls closed / opened", st.closed + " / " + st.opened,
        st.open ? (st.open + " still open") : "all closed",
        st.open === 0 && st.opened > 0 ? "good" : (st.open > 0 ? "warn" : "")),
      tile("Close rate", ratio + "%", "posted closes", ratio >= 100 ? "good" : (st.opened ? "warn" : "")),
      tile("Win rate", st.winRate == null ? "—" : Math.round(st.winRate * 100) + "%",
        st.wins + "W / " + st.losses + "L"),
      tile("Total R", st.totalR == null ? "—" : rfmt(st.totalR),
        st.avgR == null ? "no closed calls" : ("avg " + rfmt(st.avgR)),
        st.totalR == null ? "" : (st.totalR >= 0 ? "good" : "bad"))
    ].join("");
  } else {
    $("tradeStats").innerHTML = "";
  }

  var filter = $("tradeFilter").value;
  var trades = (xState.trades || []).filter(function (t) {
    return filter === "all" ? true : t.status === filter;
  });

  rowsInto($("tradeTable"),
    ["Opened", "Instrument", "Dir", "Entry", "Stop", "Exit", "R", "Status", ""],
    trades.map(function (t) {
      var rTone = t.r == null ? "" : (t.r >= 0 ? "good" : "bad");
      return "<tr>" +
        '<td class="small">' + esc(t.openedAt) + (t.kind === "postmortem" ? ' <span class="muted">pm</span>' : "") + "</td>" +
        "<td>" + esc(t.instrument) + "</td>" +
        '<td class="small">' + esc(t.direction) + "</td>" +
        '<td class="small">' + esc(t.entry) + "</td>" +
        '<td class="small">' + esc(t.stop == null ? "—" : t.stop) + "</td>" +
        '<td class="small">' + esc(t.exit == null ? "—" : t.exit) + "</td>" +
        "<td>" + badge(rfmt(t.r), rTone) + "</td>" +
        "<td>" + badge(t.status, t.status === "closed" ? "good" : (t.status === "open" ? "warn" : "")) + "</td>" +
        '<td><button class="btn tiny" data-trade="' + t.id + '">Edit</button></td></tr>';
    }), "No trades logged yet.");

  Array.prototype.forEach.call($("tradeTable").querySelectorAll("[data-trade]"), function (b) {
    b.addEventListener("click", function () { openTrade(Number(b.dataset.trade)); });
  });
}

$("tradeFilter").addEventListener("change", renderTrades);

function openTrade(id) {
  var t = null, all = xState.trades || [];
  for (var i = 0; i < all.length; i += 1) if (all[i].id === id) t = all[i];
  if (t) openTradeData(t);
}

function openTradeData(t) {
  editingTrade = t;
  $("tradeHeading").textContent = t.id ? ("Trade — " + t.instrument) : "New trade";
  $("tInstrument").value = t.instrument || "";
  $("tDirection").value = t.direction || "long";
  $("tKind").value = t.kind || "call";
  $("tStatus").value = t.status || "open";
  $("tOpened").value = t.openedAt || new Date().toISOString().slice(0, 10);
  $("tEntry").value = t.entry == null ? "" : t.entry;
  $("tStop").value = t.stop == null ? "" : t.stop;
  $("tExit").value = t.exit == null ? "" : t.exit;
  $("tClosed").value = t.closedAt || "";
  $("tThesis").value = t.thesis || "";
  $("tInvalidation").value = t.invalidation || "";
  $("tNote").value = t.note || "";
  $("tradeErr").textContent = "";
  updateRHint();
  $("tradeOverlay").classList.remove("hidden");
}

// Live R preview as entry/stop/exit are typed, so the operator sees a long
// stopped out read −1.0R before saving.
function updateRHint() {
  var entry = parseFloat($("tEntry").value), stop = parseFloat($("tStop").value), exit = parseFloat($("tExit").value);
  var dir = $("tDirection").value;
  var out = "R is computed from entry, stop and exit. No currency — percentages and R only.";
  if (isFinite(entry) && isFinite(stop) && isFinite(exit) && Math.abs(entry - stop) > 0) {
    var reward = dir === "short" ? entry - exit : exit - entry;
    var r = reward / Math.abs(entry - stop);
    out = "This trade: " + rfmt(r) + ".";
  }
  $("tRHint").textContent = out;
}
["tEntry", "tStop", "tExit", "tDirection"].forEach(function (id) {
  $(id).addEventListener("input", updateRHint);
  $(id).addEventListener("change", updateRHint);
});

function closeTrade() { $("tradeOverlay").classList.add("hidden"); editingTrade = null; }
$("tradeCloseBtn").addEventListener("click", closeTrade);
$("tradeOverlay").addEventListener("click", function (e) { if (e.target === $("tradeOverlay")) closeTrade(); });

$("tradeNew").addEventListener("click", function () {
  openTradeData({ id: 0, status: "open", direction: "long", kind: "call",
    openedAt: new Date().toISOString().slice(0, 10) });
});

function tradeBody() {
  return {
    instrument: $("tInstrument").value.trim(),
    direction: $("tDirection").value,
    kind: $("tKind").value,
    status: $("tStatus").value,
    openedAt: $("tOpened").value,
    closedAt: $("tClosed").value || null,
    entry: $("tEntry").value,
    stop: $("tStop").value,
    exit: $("tExit").value,
    thesis: $("tThesis").value,
    invalidation: $("tInvalidation").value,
    note: $("tNote").value
  };
}

$("tSave").addEventListener("click", function () {
  $("tradeErr").textContent = "";
  var isNew = !editingTrade || !editingTrade.id;
  var path = isNew ? "/x/trades" : "/x/trades/" + editingTrade.id;
  api(path, { method: isNew ? "POST" : "PATCH", body: tradeBody() })
    .then(function () { closeTrade(); loaders.x(); })
    .catch(function (e) { $("tradeErr").textContent = e.message; });
});

$("tDelete").addEventListener("click", function () {
  if (!editingTrade || !editingTrade.id) { closeTrade(); return; }
  if (!confirm("Delete this trade permanently?")) return;
  api("/x/trades/" + editingTrade.id, { method: "DELETE" })
    .then(function () { closeTrade(); loaders.x(); })
    .catch(function (e) { $("tradeErr").textContent = e.message; });
});

// ---------------------------------------------------------------------------
// Cross-platform
// ---------------------------------------------------------------------------

var PLATFORM_LABEL = { tiktok: "TikTok", instagram: "Instagram", x: "X" };

function renderCrossposts() {
  var s = xState.crossStats;
  if (s) {
    $("crossStats").innerHTML = [
      // The one that matters. Views are shown as a sub, deliberately smaller —
      // TikTok reach is large and converts poorly, so it isn't the scoreboard.
      tile("TikTok → profile visits", num(s.tiktokProfileVisits),
        num(s.tiktokViews) + " views · judge on this", s.tiktokProfileVisits > 0 ? "good" : ""),
      tile("TikTok posts", num(s.tiktokPosts)),
      tile("Instagram posts", num(s.igPosts))
    ].join("");
  } else {
    $("crossStats").innerHTML = "";
  }

  rowsInto($("crossTable"),
    ["Published", "Platform", "URL", "Views", "Profile visits", ""],
    (xState.crossposts || []).map(function (c) {
      var link = c.url
        ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener" class="small">link</a>'
        : '<span class="muted small">—</span>';
      return "<tr>" +
        '<td class="small">' + esc(c.publishedAt || "—") + "</td>" +
        "<td>" + esc(PLATFORM_LABEL[c.platform] || c.platform) + "</td>" +
        "<td>" + link + "</td>" +
        '<td class="small">' + esc(c.views == null ? "—" : num(c.views)) + "</td>" +
        '<td class="small">' + esc(c.profileVisits == null ? "—" : num(c.profileVisits)) + "</td>" +
        '<td><button class="btn tiny" data-cross="' + c.id + '">Delete</button></td></tr>';
    }), "No cross-posts logged yet.");

  Array.prototype.forEach.call($("crossTable").querySelectorAll("[data-cross]"), function (b) {
    b.addEventListener("click", function () {
      if (!confirm("Delete this cross-post row?")) return;
      api("/x/crossposts/" + b.dataset.cross, { method: "DELETE" })
        .then(function (d) { xState.crossposts = d.crossposts; xState.crossStats = d.stats; renderCrossposts(); })
        .catch(function (e) { alert(e.message); });
    });
  });
}

$("crossAdd").addEventListener("click", function () {
  var url = $("crossUrl").value.trim();
  if (!url) { alert("A URL is required."); return; }
  api("/x/crossposts", { method: "POST", body: {
    platform: $("crossPlatform").value,
    url: url,
    publishedAt: $("crossPublished").value || null,
    views: $("crossViews").value,
    profileVisits: $("crossVisits").value
  }}).then(function (d) {
    xState.crossposts = d.crossposts; xState.crossStats = d.stats;
    $("crossUrl").value = ""; $("crossViews").value = ""; $("crossVisits").value = "";
    renderCrossposts();
  }).catch(function (e) { alert(e.message); });
});

// ---------------------------------------------------------------------------
// Reply log
// ---------------------------------------------------------------------------

function renderReplies() {
  var log = xState.replies || [];
  var today = new Date().toISOString().slice(0, 10);
  var todayRow = null;
  for (var i = 0; i < log.length; i += 1) if (log[i].day === today) todayRow = log[i];
  var n = todayRow ? todayRow.count : 0;
  // Cap is 8-10/day: under 8 is green (room to spare), 8-10 is on target, over
  // 10 is amber — replies are the investment and shouldn't eat the posting hour.
  var tone = n > 10 ? "#e09b2d" : "#3fae74";
  $("replyTodayHint").innerHTML = 'today: <b style="color:' + tone + '">' + n + "</b> / 8–10 cap";

  var box = $("replyChart");
  if (!log.length) { box.innerHTML = '<p class="muted small">No replies logged yet.</p>'; return; }

  // 14-day bar sparkline, same spartan inline-SVG house style as the snapshot
  // chart. The cap band (8-10) is drawn so a day over it reads at a glance.
  var recent = log.slice(-14);
  var w = 720, h = 130, pad = 24, bw = (w - pad * 2) / recent.length;
  var maxC = Math.max(10, Math.max.apply(null, recent.map(function (r) { return r.count; })));
  var capY = h - pad - (10 / maxC) * (h - pad * 2);
  var bars = recent.map(function (r, i) {
    var bh = (r.count / maxC) * (h - pad * 2);
    var x = pad + i * bw + 2;
    var col = r.count > 10 ? "#e09b2d" : "#3fae74";
    return '<rect x="' + x.toFixed(1) + '" y="' + (h - pad - bh).toFixed(1) + '" width="' + (bw - 4).toFixed(1) +
      '" height="' + bh.toFixed(1) + '" fill="' + col + '" />';
  }).join("");
  box.innerHTML =
    '<svg viewBox="0 0 ' + w + " " + h + '" style="width:100%;height:auto;">' +
      '<line x1="' + pad + '" y1="' + capY.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + capY.toFixed(1) +
        '" stroke="#9c8a6d" stroke-dasharray="4 4" stroke-width="1" />' +
      '<text x="' + (w - pad) + '" y="' + (capY - 4).toFixed(1) + '" font-size="10" fill="#9c8a6d" text-anchor="end">cap 10</text>' +
      bars +
      '<text x="' + pad + '" y="' + (h - 6) + '" font-size="11" fill="#9c8a6d">' + esc(recent[0].day) + "</text>" +
      '<text x="' + (w - pad) + '" y="' + (h - 6) + '" font-size="11" fill="#9c8a6d" text-anchor="end">' +
        esc(recent[recent.length - 1].day) + "</text>" +
    "</svg>";
}

$("replySave").addEventListener("click", function () {
  var day = $("replyDay").value || new Date().toISOString().slice(0, 10);
  api("/x/replies", { method: "POST", body: {
    day: day, count: $("replyCount").value, rooms: $("replyRooms").value
  }}).then(function (d) { xState.replies = d.replies; renderReplies(); })
    .catch(function (e) { alert(e.message); });
});

$("xNew").addEventListener("click", function () {
  api("/x/posts", { method: "POST", body: { title: "New post", status: "idea", slotKind: "extra" } })
    .then(function (d) { loaders.x(); openPostData(d.post); })
    .catch(function (e) { alert(e.message); });
});

// ---- post editor ----

var editing = null;

function openPost(id) {
  var post = null;
  for (var i = 0; i < xState.posts.length; i += 1) if (xState.posts[i].id === id) post = xState.posts[i];
  if (post) openPostData(post);
}

function fillSelect(el, values, labels) {
  el.innerHTML = values.map(function (v) {
    return '<option value="' + esc(v) + '">' + esc(labels ? (labels[v] || v) : v) + "</option>";
  }).join("");
}

function openPostData(post) {
  editing = post;
  fillSelect($("pSlot"), xState.slotKinds.length ? xState.slotKinds : ["extra"], SLOT_LABEL);
  fillSelect($("pStatus"), xState.statuses.length ? xState.statuses : ["idea"]);

  $("postTitle").textContent = (post.ref ? post.ref + " · " : "") + (post.title || "Post");
  $("pTitle").value = post.title || "";
  $("pDate").value = post.slotDate || "";
  $("pSlot").value = post.slotKind;
  $("pStatus").value = post.status;
  $("pFormat").value = post.format || "";
  $("pBody").value = post.body || "";
  $("pPrompt").value = post.imagePrompt || "";
  $("pUrl").value = post.tweetUrl || "";

  var m = post.metrics || {};
  $("mImpr").value = m.impressions || "";
  $("mLikes").value = m.likes || "";
  $("mReplies").value = m.replies || "";
  $("mReposts").value = m.reposts || "";
  $("mBook").value = m.bookmarks || "";
  $("mProfile").value = m.profileClicks || "";
  $("mLink").value = m.linkClicks || "";
  // A recorded 0 must render as 0, not blank. Blank means "never looked up",
  // and the 90-day rollup counts the two differently.
  $("mVerif").value = m.verifiedImpressions == null ? "" : m.verifiedImpressions;

  // Template picker: one option per saved template, plus the empty default.
  var tpls = xState.templates || [];
  var opts = '<option value="">—</option>';
  for (var t = 0; t < tpls.length; t += 1) {
    opts += '<option value="' + esc(tpls[t].id) + '">' + esc(tpls[t].name) + "</option>";
  }
  $("pTemplate").innerHTML = opts;
  $("pTemplate").value = "";

  $("postErr").textContent = "";
  $("verifyOut").textContent = "";
  $("copyWarn").innerHTML = "";
  updateCount();
  $("postOverlay").classList.remove("hidden");
  checkCopy();
}

// Live character count. X's single-post limit is 280; past it the copy needs to
// be a thread, which the copy-guard also flags. Amber is a nudge, not a block.
function updateCount() {
  var len = $("pBody").value.length;
  var el = $("pCount");
  el.textContent = len + " / 280";
  el.style.color = len > 280 ? "#e09b2d" : "var(--mut)";
  el.style.fontWeight = len > 280 ? "800" : "400";
}

function closePost() { $("postOverlay").classList.add("hidden"); editing = null; }
$("postClose").addEventListener("click", closePost);
$("postOverlay").addEventListener("click", function (e) { if (e.target === $("postOverlay")) closePost(); });

function checkCopy() {
  api("/x/check", { method: "POST", body: { text: $("pBody").value } }).then(function (d) {
    $("copyWarn").innerHTML = d.warnings.length
      ? d.warnings.map(function (w) {
          return '<div class="banner ' + (w.severity === "block" ? "bad" : "warn") + '" style="margin-top:8px;">' +
            (w.severity === "block" ? "⛔ " : "⚠️ ") + esc(w.message) + "</div>";
        }).join("")
      : '<div class="small" style="color:#3fae74;font-weight:800;margin-top:6px;">Copy checks pass.</div>';
  }).catch(function () {});
}

$("pCheck").addEventListener("click", checkCopy);
$("pBody").addEventListener("blur", checkCopy);

// Live counter + a debounced copy-check as you type, so the 280 / gambling /
// stock-vs-flow warnings surface while writing rather than only on blur.
var copyTimer = null;
$("pBody").addEventListener("input", function () {
  updateCount();
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(checkCopy, 500);
});

// Insert the chosen template's skeleton. Appends when there is already copy, so
// a template can seed a thread mid-write without wiping what's there.
$("pInsert").addEventListener("click", function () {
  var id = $("pTemplate").value;
  if (!id) return;
  var tpl = null, tpls = xState.templates || [];
  for (var i = 0; i < tpls.length; i += 1) if (tpls[i].id === id) tpl = tpls[i];
  if (!tpl) return;
  var box = $("pBody"), cur = box.value;
  box.value = cur ? (cur.replace(/\s*$/, "") + "\n\n" + tpl.skeleton) : tpl.skeleton;
  updateCount();
  checkCopy();
});

// Save the current copy as a reusable template.
$("pAsTemplate").addEventListener("click", function () {
  var body = $("pBody").value.trim();
  if (!body) { $("postErr").textContent = "Nothing to save — the copy is empty."; return; }
  var name = prompt("Template name:", $("pTitle").value || "");
  if (!name) return;
  api("/x/templates", { method: "POST", body: {
    name: name, format: $("pFormat").value || "", skeleton: body,
  } }).then(function (d) {
    xState.templates = d.templates || [];
    $("postErr").textContent = "";
    alert("Template saved.");
  }).catch(function (e) { $("postErr").textContent = e.message; });
});

// Create a linked follow-up post (thread_of = this post) and open it, so a
// thread is built one tweet at a time. Saves the current post first so the
// parent's edits aren't lost on the reload.
$("pFollow").addEventListener("click", function () {
  if (!editing) return;
  var parent = editing;
  savePost().then(function () {
    return api("/x/posts", { method: "POST", body: {
      title: (parent.title || "Post") + " — follow-up",
      status: parent.status, slotKind: parent.slotKind,
      slotDate: parent.slotDate || null, threadOf: parent.id,
    } });
  }).then(function (d) {
    return loaders.x().then(function () { openPost(d.post.id); });
  }).catch(function (e) { if ($("postErr")) $("postErr").textContent = e.message; });
});

// Accept a row pasted straight out of X analytics.
$("pBulk").addEventListener("input", function () {
  var parts = $("pBulk").value.split(/[\t,]+/).map(function (s) { return s.replace(/[^0-9]/g, ""); });
  // mVerif is deliberately absent: verified impressions are not a column in
  // the X analytics export, so mapping a pasted value onto it would invent a
  // measurement. It stays hand-entered.
  var fields = ["mImpr", "mLikes", "mReplies", "mReposts", "mBook", "mProfile", "mLink"];
  for (var i = 0; i < fields.length; i += 1) if (parts[i]) $(fields[i]).value = parts[i];
});

$("pVerify").addEventListener("click", function () {
  if (!editing) return;
  $("verifyOut").textContent = "Checking…";
  api("/x/posts/" + editing.id + "/verify", { method: "POST", body: { tweetUrl: $("pUrl").value } })
    .then(function (d) {
      $("verifyOut").innerHTML = '<div class="banner good" style="margin-top:8px;">Verified as @' + esc(d.handle) +
        '.</div><p class="muted small">Live text: ' + esc(d.liveText.slice(0, 400)) + "</p>";
      editing = d.post;
      $("pStatus").value = d.post.status;
      loaders.x();
    })
    .catch(function (e) { $("verifyOut").innerHTML = '<div class="banner bad" style="margin-top:8px;">' + esc(e.message) + "</div>"; });
});

// Persist the open post (copy + metrics). Returns a promise and does NOT close
// or reload, so it can be reused mid-flow — the thread follow-up saves the
// parent before spawning the child.
function savePost() {
  if (!editing) return Promise.resolve();
  var id = editing.id;
  $("postErr").textContent = "";
  return api("/x/posts/" + id, { method: "PATCH", body: {
    title: $("pTitle").value,
    slotDate: $("pDate").value || null,
    slotKind: $("pSlot").value,
    status: $("pStatus").value,
    format: $("pFormat").value || null,
    body: $("pBody").value,
    hook: ($("pBody").value.split("\n")[0] || "").trim(),
    imagePrompt: $("pPrompt").value || null,
    tweetUrl: $("pUrl").value || null
  }}).then(function () {
    return api("/x/posts/" + id + "/metrics", { method: "POST", body: {
      impressions: $("mImpr").value, likes: $("mLikes").value, replies: $("mReplies").value,
      reposts: $("mReposts").value, bookmarks: $("mBook").value,
      profileClicks: $("mProfile").value, linkClicks: $("mLink").value,
      verifiedImpressions: $("mVerif").value
    }});
  });
}

$("pSave").addEventListener("click", function () {
  savePost().then(function () { closePost(); loaders.x(); })
    .catch(function (e) { $("postErr").textContent = e.message; });
});

$("pDelete").addEventListener("click", function () {
  if (!editing) return;
  if (!confirm("Delete this post permanently?")) return;
  api("/x/posts/" + editing.id, { method: "DELETE" })
    .then(function () { closePost(); loaders.x(); })
    .catch(function (e) { $("postErr").textContent = e.message; });
});

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------

loaders.admin = function () {
  api("/bans").then(function (d) {
    rowsInto($("banTable"), ["Name", "Wallet", "Reason", "When", ""],
      d.bans.map(function (b) {
        return "<tr><td>" + esc(b.name || "—") + "</td>" +
          '<td class="mono small">' + esc(b.wallet.slice(0, 10)) + "…</td>" +
          '<td class="small">' + esc(b.reason) + "</td>" +
          '<td class="muted small">' + esc(ago(b.bannedAt)) + "</td>" +
          '<td><button class="btn tiny" data-unban="' + esc(b.wallet) + '">Unban</button></td></tr>';
      }), "Nobody is banned.");
    Array.prototype.forEach.call($("banTable").querySelectorAll("[data-unban]"), function (btn) {
      btn.addEventListener("click", function () {
        api("/bans/" + encodeURIComponent(btn.dataset.unban), { method: "DELETE" }).then(loaders.admin);
      });
    });
  }).catch(function () {});

  api("/xtasks").then(function (d) {
    rowsInto($("taskTable"), ["Title", "Type", "Points", "Active", ""],
      d.tasks.map(function (t) {
        return "<tr><td>" + esc(t.title) + '<br><a class="small" href="' + esc(t.targetUrl) +
          '" target="_blank" rel="noopener">tweet</a></td>' +
          "<td>" + esc(t.type) + "</td><td>" + t.points + "</td>" +
          "<td>" + badge(t.active ? "active" : "off", t.active ? "good" : "") + "</td>" +
          '<td><button class="btn tiny" data-task="' + esc(t.id) + '" data-next="' + (t.active ? "0" : "1") + '">' +
          (t.active ? "Disable" : "Enable") + "</button></td></tr>";
      }), "No X tasks yet.");
    Array.prototype.forEach.call($("taskTable").querySelectorAll("[data-task]"), function (btn) {
      btn.addEventListener("click", function () {
        api("/xtasks/" + encodeURIComponent(btn.dataset.task) + "/active",
          { method: "POST", body: { active: btn.dataset.next === "1" } }).then(loaders.admin);
      });
    });
  }).catch(function () {});

  api("/audit?limit=80").then(function (d) {
    rowsInto($("auditTable"), ["When", "Who", "Action", "Detail"],
      d.entries.map(function (a) {
        return '<tr><td class="muted small">' + esc(ago(a.at)) + "</td>" +
          '<td class="small">' + esc(a.email) + "</td>" +
          "<td>" + badge(a.action) + "</td>" +
          '<td class="mono small">' + esc(JSON.stringify(a.detail)) + "</td></tr>";
      }), "No actions recorded.");
  }).catch(function () {});
};

$("banGo").addEventListener("click", function () {
  $("banMsg").textContent = "";
  api("/bans", { method: "POST", body: {
    target: $("banTarget").value,
    reason: $("banReason").value,
    deleteCharacter: $("banDelete").checked
  }}).then(function (d) {
    $("banMsg").innerHTML = '<span style="color:#3fae74;font-weight:800;">' + esc(d.message) + "</span>";
    $("banTarget").value = ""; $("banReason").value = ""; $("banDelete").checked = false;
    loaders.admin();
  }).catch(function (e) {
    $("banMsg").innerHTML = '<span style="color:#d85f97;font-weight:800;">' + esc(e.message) + "</span>";
  });
});

function runPayout(execute) {
  var season = $("payoutSeason").value;
  var body = { execute: execute };
  if (season) body.seasonNumber = Number(season);
  if (execute) {
    var n = season || "";
    var typed = prompt("This pays real $BASE and cannot be undone.\n\nType: PAY SEASON " + n);
    if (!typed) return;
    body.confirm = typed;
  }
  $("payoutOut").textContent = "Running…";
  api("/season/payout", { method: "POST", body: body })
    .then(function (d) { $("payoutOut").textContent = JSON.stringify(d.report, null, 2); })
    .catch(function (e) { $("payoutOut").textContent = "Error: " + e.message; });
}

$("payoutDry").addEventListener("click", function () { runPayout(false); });
$("payoutExec").addEventListener("click", function () { runPayout(true); });

$("taskCreate").addEventListener("click", function () {
  api("/xtasks", { method: "POST", body: {
    targetUrl: $("taskUrl").value,
    title: $("taskTitle").value,
    hashtag: $("taskHashtag").value,
    points: $("taskPoints").value,
    type: $("taskType").value
  }}).then(function () { $("taskUrl").value = ""; $("taskTitle").value = ""; loaders.admin(); })
    .catch(function (e) { alert(e.message); });
});

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------

$("logout").addEventListener("click", function () {
  api("/logout", { method: "POST" }).then(function () { window.location.href = "/mission/login"; });
});

$("changePw").addEventListener("click", function () { $("pwGate").classList.remove("hidden"); });

$("pwForm").addEventListener("submit", function (e) {
  e.preventDefault();
  $("pwErr").textContent = "";
  api("/password", { method: "POST", body: { current: $("pwCurrent").value, next: $("pwNext").value } })
    .then(function () {
      $("pwGate").classList.add("hidden");
      $("pwCurrent").value = ""; $("pwNext").value = "";
      boot();
    })
    .catch(function (err) { $("pwErr").textContent = err.message; });
});

function boot() {
  return api("/me").then(function (me) {
    $("whoami").textContent = me.email;
    $("verBadge").textContent = "v" + me.version;
    if (me.mustChangePassword) {
      $("pwGate").classList.remove("hidden");
      return;
    }
    $("pwGate").classList.add("hidden");
    var initial = (window.location.hash || "#ops").slice(1);
    showTab(["ops", "game", "x", "admin"].indexOf(initial) >= 0 ? initial : "ops");
  }).catch(function (e) {
    // 403 password_change_required: /me is blocked too, so show the gate on faith.
    if (String(e.message).indexOf("password_change_required") >= 0) {
      $("pwGate").classList.remove("hidden");
      return;
    }
    console.error(e);
  });
}

// ---------------------------------------------------------------------------
// TABLES (District Deeds)
// ---------------------------------------------------------------------------

function fmtAgo(ms) {
  if (!ms) return "-";
  var mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m";
  return Math.floor(mins / 60) + "h " + (mins % 60) + "m";
}

loaders.tables = function () {
  api("/board-tables").then(function (d) {
    var live = d.liveMoneyTables || 0;
    $("boardBanner").innerHTML = live > 0
      ? '<div class="banner bad">' + live + ' stake table(s) in flight &mdash; a deploy restarts them. '
        + 'They survive it, but everyone sits through a 10 minute amnesty. Deploy in a quiet window if you can.</div>'
      : '<div class="banner good">No stake tables in flight. Safe to deploy.</div>';

    rowsInto($("boardTables"), ["Table", "Currency", "Stake", "Seats", "Status", "Turn", "Pot", "Risk", "Started", ""],
      (d.tables || []).map(function (t) {
        var actions = '<button class="btn small" data-pause="' + esc(t.id) + '">'
          + (t.status === "paused" ? "Resume" : "Pause") + "</button> "
          + '<button class="btn small bad" data-void="' + esc(t.id) + '">Void + refund</button>';
        return "<tr><td class=\"mono small\">" + esc(t.id.slice(0, 12)) + "</td><td>" + esc(t.currencyId)
          + "</td><td>" + t.stake + "</td><td>" + t.seats + "</td><td>" + esc(t.status)
          + "</td><td>" + (t.turnSeat === null ? "-" : t.turnSeat) + "</td><td>" + t.pot
          + "</td><td>" + (t.risk > 50 ? '<span class="bad">' + t.risk + "</span>" : t.risk)
          + "</td><td>" + fmtAgo(t.startedAt) + "</td><td>" + actions + "</td></tr>";
      }), "No tables open.");

    rowsInto($("boardPending"), ["Ledger id", "Player", "Currency", "Amount", "Waiting"],
      (d.pendingCashouts || []).map(function (c) {
        return "<tr><td>" + c.id + "</td><td class=\"mono small\">" + esc(String(c.pid).slice(0, 12))
          + "</td><td>" + esc(c.currencyId) + "</td><td>" + Math.abs(c.delta)
          + "</td><td>" + fmtAgo(c.createdAt) + "</td></tr>";
      }), "Nothing stuck.");

    Array.prototype.forEach.call($("boardTables").querySelectorAll("[data-pause]"), function (b) {
      b.addEventListener("click", function () {
        api("/board-tables/" + encodeURIComponent(b.dataset.pause) + "/pause",
          { method: "POST", body: { paused: b.textContent.trim() === "Pause" } })
          .then(function () { loaders.tables(); });
      });
    });
    Array.prototype.forEach.call($("boardTables").querySelectorAll("[data-void]"), function (b) {
      b.addEventListener("click", function () {
        if (!window.confirm("Void this table? Every stake is refunded and the dice seed is revealed. This cannot be undone.")) return;
        api("/board-tables/" + encodeURIComponent(b.dataset.void) + "/void",
          { method: "POST", body: { reason: "ops" } })
          .then(function () { loaders.tables(); });
      });
    });
  });
};

boot();
`;
