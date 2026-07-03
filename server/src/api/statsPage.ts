// A self-contained, public, no-login economy dashboard served at GET /stats.
// It fetches /api/stats (same origin) and renders live metrics for full
// transparency. Kept as one HTML string so it needs no build step or assets.
export const STATS_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MetricBase World — Economy</title>
<style>
  :root { --bg:#171326; --card:#221b38; --line:#372c57; --ink:#f3ecff; --mut:#a99fc9; --gold:#ffce4d; --mint:#6ad2a8; --pink:#ff8fb3; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:"Nunito",system-ui,sans-serif; background:radial-gradient(1200px 600px at 50% -10%,#2a2247,#171326); color:var(--ink); min-height:100vh; }
  header { text-align:center; padding:32px 16px 8px; }
  header h1 { margin:0; font-size:1.7rem; letter-spacing:.3px; }
  header p { margin:6px 0 0; color:var(--mut); font-size:.9rem; }
  .wrap { max-width:1000px; margin:0 auto; padding:16px; }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 18px; }
  .card h2 { margin:0 0 10px; font-size:.82rem; text-transform:uppercase; letter-spacing:.8px; color:var(--mut); font-weight:700; }
  .big { font-size:1.9rem; font-weight:800; }
  .sub { color:var(--mut); font-size:.82rem; margin-top:2px; }
  .row { display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:.9rem; }
  .row:first-of-type { border-top:0; }
  .row b { color:var(--gold); font-variant-numeric:tabular-nums; }
  .gold { color:var(--gold); } .mint { color:var(--mint); } .pink { color:var(--pink); }
  footer { text-align:center; color:var(--mut); font-size:.78rem; padding:24px 16px 40px; }
  .pill { display:inline-block; background:var(--line); border-radius:999px; padding:2px 10px; font-size:.72rem; color:var(--mut); }
</style>
</head>
<body>
<header>
  <h1>🌍 MetricBase World — Economy</h1>
  <p>Live, public transparency dashboard · <span class="pill" id="ver">…</span> · updates every 15s</p>
</header>
<div class="wrap">
  <div class="grid">
    <div class="card"><h2>Players</h2><div class="big" id="registered">—</div><div class="sub"><span id="online">—</span> online now</div></div>
    <div class="card"><h2>Circulating gold</h2><div class="big gold" id="circulating">—</div><div class="sub">held by all players</div></div>
    <div class="card"><h2>Player Worlds</h2><div class="big mint" id="worlds">—</div><div class="sub"><span id="worldsPub">—</span> published</div></div>
    <div class="card"><h2>Treasury gold</h2><div class="big" id="treasury">—</div><div class="sub">removed from circulation → treasury</div></div>
    <div class="card"><h2>$BASE gold market</h2><div class="big pink" id="gmVol">—</div><div class="sub"><span id="gmTrades">—</span> trades · gold traded</div></div>
    <div class="card"><h2>Asset market</h2><div class="big" id="alValue">—</div><div class="sub"><span id="alCount">—</span> listings · <span id="aiOwned">—</span> assets owned</div></div>
  </div>
  <div class="grid" style="margin-top:14px">
    <div class="card"><h2>Treasury by source</h2><div id="treasurySrc"></div></div>
    <div class="card"><h2>Top gold holders</h2><div id="holders"></div></div>
  </div>
</div>
<footer>Numbers are live from the game database. Gold enters circulation via gameplay (gathering, quests, mobs) and leaves it into the treasury via sinks (World slots, building, the shop).</footer>
<script>
  var fmt = function(n){ return (n||0).toLocaleString(); };
  function set(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }
  function rows(el, items, fn){ el.innerHTML = items.length ? items.map(fn).join("") : '<div class="sub">None yet.</div>'; }
  async function load(){
    try {
      var r = await fetch("/api/stats", { cache:"no-store" });
      var s = await r.json();
      set("ver", s.version);
      set("registered", fmt(s.players.registered));
      set("online", fmt(s.players.online));
      set("circulating", fmt(s.players.circulatingGold)+"g");
      set("worlds", fmt(s.worlds.total));
      set("worldsPub", fmt(s.worlds.published));
      set("treasury", fmt(s.treasury.total)+"g");
      set("gmVol", fmt(s.goldMarket.goldVolume)+"g");
      set("gmTrades", fmt(s.goldMarket.trades));
      set("alValue", fmt(s.assetMarket.askValue)+"g");
      set("alCount", fmt(s.assetMarket.listings));
      set("aiOwned", fmt(s.assetMarket.totalOwned));
      rows(document.getElementById("treasurySrc"), s.treasury.bySource, function(x){
        return '<div class="row"><span>'+x.source+'</span><b>'+fmt(x.gold)+'g</b></div>';
      });
      rows(document.getElementById("holders"), s.topHolders, function(x){
        return '<div class="row"><span>'+x.name+'</span><b>'+fmt(x.gold)+'g</b></div>';
      });
    } catch (e) { /* keep last values */ }
  }
  load(); setInterval(load, 15000);
</script>
</body>
</html>`;
