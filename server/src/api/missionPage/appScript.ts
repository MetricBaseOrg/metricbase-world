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
  Promise.all([api("/x"), api("/x/evaluation")]).then(function (results) {
    var data = results[0];
    xState.posts = data.posts;
    xState.targets = data.targets;
    xState.snapshots = data.snapshots;
    xState.statuses = data.statuses;
    xState.slotKinds = data.slotKinds;
    xState.evaluation = results[1];
    renderX();
  }).catch(function (e) {
    $("xBoard").innerHTML = '<div class="banner bad">' + esc(e.message) + "</div>";
  });
};

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

  renderEval();
  renderBoard();
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
  var posts = xState.posts.filter(function (p) {
    if (filter === "all") return true;
    if (filter === "pipeline") return p.status !== "posted" && p.status !== "skipped";
    return p.status === filter;
  });

  $("xBoard").innerHTML = posts.length ? posts.map(function (p) {
    var m = p.metrics;
    return '<div class="card" data-post="' + p.id + '">' +
      '<div class="when">' + esc(p.slotDate || "unscheduled") + " · " + esc(SLOT_LABEL[p.slotKind] || p.slotKind) + "</div>" +
      '<div class="title">' + esc(p.ref ? p.ref + " " : "") + esc(p.title || "(untitled)") + "</div>" +
      '<div class="meta">' +
        badge(p.status, STATUS_TONE[p.status]) +
        (p.format ? badge(p.format) : "") +
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

  $("postErr").textContent = "";
  $("verifyOut").textContent = "";
  $("copyWarn").innerHTML = "";
  $("postOverlay").classList.remove("hidden");
  checkCopy();
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

// Accept a row pasted straight out of X analytics.
$("pBulk").addEventListener("input", function () {
  var parts = $("pBulk").value.split(/[\t,]+/).map(function (s) { return s.replace(/[^0-9]/g, ""); });
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

$("pSave").addEventListener("click", function () {
  if (!editing) return;
  var id = editing.id;
  $("postErr").textContent = "";
  api("/x/posts/" + id, { method: "PATCH", body: {
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
      profileClicks: $("mProfile").value, linkClicks: $("mLink").value
    }});
  }).then(function () { closePost(); loaders.x(); })
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

boot();
`;
