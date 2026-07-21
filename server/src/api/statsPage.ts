// Public, no-login economy dashboard served at GET /stats. Self-contained
// (no external assets) chibi-cozy themed page that fetches /api/stats and renders
// live metrics + hand-drawn SVG charts. Refreshes every 20s.
export const STATS_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MetricBase World — Solana MMO Economy</title>
<meta name="description" content="MetricBase World 🌎 in numbers — live, fully transparent economy dashboard for the Solana MMO powered by the $BASE token (mint DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump): players, gold flow, $BASE burned, player Worlds, companies & a player stock exchange, markets and ads." />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "MetricBase World live economy stats",
  "description": "Live transparency dashboard for MetricBase World, a browser-based Solana MMO powered by the $BASE token (mint DN2PNrZ8Jn65ioJw4QBwXv49j5JiBBL3wPLUDZcrpump). Players online, gold supply, $BASE burned, player-built Worlds, companies & a player stock exchange, markets, jobs and ad revenue.",
  "url": "https://world.metricbase.org/stats",
  "isBasedOn": "https://world.metricbase.org",
  "creator": { "@type": "Organization", "name": "MetricBase", "url": "https://world.metricbase.org" },
  "distribution": [{ "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://metricbaseserver-production.up.railway.app/api/stats" }]
}
</script>
<link rel="canonical" href="https://world.metricbase.org/stats" />
<!-- Share card (𝕏 / OpenGraph) -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="MetricBase World" />
<meta property="og:title" content="MetricBase World 🌎 in numbers" />
<meta property="og:description" content="Live, fully transparent economy dashboard — players, gold flow, $BASE burned, player-built Worlds, companies & a stock exchange, markets & ads. Updated every 20s." />
<meta property="og:url" content="https://world.metricbase.org/stats" />
<meta property="og:image" content="https://world.metricbase.org/metricbase-world.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="MetricBase World 🌎 in numbers" />
<meta name="twitter:description" content="Live, fully transparent economy dashboard — players, gold flow, $BASE burned, player-built Worlds, companies & a stock exchange, markets & ads." />
<meta name="twitter:image" content="https://world.metricbase.org/metricbase-world.png" />
<style>
  :root{
    --bg:#fdf3df; --panel:#fffdf6; --line:#e6d3aa; --ink:#4a3b2a; --mut:#9c8a6d;
    --shadow:#e4cf9f; --gather:#3fae74; --craft:#e09b2d; --sell:#5a97e0; --buy:#d85f97;
    --mint:#3fae74; --burn:#d85f97; --gold:#e0a92e; --sky:#5a97e0;
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{margin:0;font-family:"Nunito","Fredoka",system-ui,sans-serif;background:
    radial-gradient(1000px 520px at 50% -10%,#fff7e6,#fdf3df);color:var(--ink);min-height:100vh;}

  header{text-align:center;padding:28px 16px 4px;}
  header h1{margin:0;font-size:clamp(1.35rem,4vw,1.8rem);font-weight:800;letter-spacing:.2px;}
  header h1 .spark{display:inline-block;animation:bob 2.6s ease-in-out infinite;font-size:.8em;color:var(--gold);}
  header h1 .spark.r{animation-delay:1.3s;}
  header .globe{display:inline-block;animation:bob 3.2s ease-in-out infinite;}
  header p{margin:8px 0 0;color:var(--mut);font-size:.85rem;}
  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  .pill{display:inline-block;background:#fff;border:1.5px solid var(--line);border-radius:999px;padding:2px 10px;font-size:.72rem;color:var(--mut);vertical-align:middle;}
  .live{display:inline-flex;align-items:center;gap:5px;}
  .live .dotp{width:8px;height:8px;border-radius:50%;background:var(--mint);animation:pulse 1.8s ease-out infinite;}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(63,174,116,.5)}70%{box-shadow:0 0 0 7px rgba(63,174,116,0)}100%{box-shadow:0 0 0 0 rgba(63,174,116,0)}}

  .share-x{margin-top:12px;cursor:pointer;font-family:inherit;font-weight:800;font-size:.78rem;
    color:#fff7ea;background:#1a1a1a;border:2px solid #000;border-radius:999px;padding:7px 16px;
    box-shadow:0 3px 0 var(--shadow);transition:transform .12s,box-shadow .12s;}
  .share-x:hover{transform:translateY(-2px);box-shadow:0 5px 0 var(--shadow);}
  .share-x:active{transform:translateY(1px);box-shadow:0 2px 0 var(--shadow);}
  nav{position:sticky;top:0;z-index:10;display:flex;gap:8px;justify-content:flex-start;overflow-x:auto;
    padding:10px 14px;margin-top:14px;background:rgba(253,243,223,.92);backdrop-filter:blur(6px);
    border-bottom:2px solid var(--line);scrollbar-width:none;}
  nav::-webkit-scrollbar{display:none;}
  nav a{flex-shrink:0;text-decoration:none;color:var(--ink);font-weight:800;font-size:.78rem;
    background:var(--panel);border:2px solid var(--line);border-radius:999px;padding:6px 13px;
    box-shadow:0 3px 0 var(--shadow);transition:transform .12s,box-shadow .12s;}
  nav a:hover{transform:translateY(-2px);box-shadow:0 5px 0 var(--shadow);}
  nav a:active{transform:translateY(1px);box-shadow:0 2px 0 var(--shadow);}
  @media (min-width:760px){nav{justify-content:center;}}

  .wrap{max-width:1040px;margin:0 auto;padding:16px;}
  section{scroll-margin-top:64px;}
  .sec{display:flex;align-items:center;gap:10px;margin:26px 2px 12px;}
  .sec .em{font-size:1.25rem;}
  .sec h2{margin:0;font-size:1.05rem;font-weight:800;}
  .sec::after{content:"";flex:1;height:2px;border-radius:2px;
    background:repeating-linear-gradient(90deg,var(--line) 0 10px,transparent 10px 18px);}

  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));}
  .card{background:var(--panel);border:2px solid var(--line);border-radius:18px;
    box-shadow:0 4px 0 var(--shadow);padding:16px 18px;transition:transform .15s,box-shadow .15s;}
  .card:hover{transform:translateY(-2px);box-shadow:0 6px 0 var(--shadow);}
  .card h2{margin:0 0 8px;font-size:.75rem;text-transform:uppercase;letter-spacing:.7px;color:var(--mut);font-weight:800;display:flex;align-items:center;gap:6px;}
  .big{font-size:clamp(1.25rem,2.6vw,1.8rem);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15;overflow-wrap:anywhere;}
  .big.bump{animation:bump .45s ease;}
  @keyframes bump{0%{transform:scale(1)}35%{transform:scale(1.09)}100%{transform:scale(1)}}
  .sub{color:var(--mut);font-size:.78rem;margin-top:4px;line-height:1.35;}
  .row{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1.5px dashed var(--line);font-size:.88rem;align-items:baseline;}
  .row:first-of-type{border-top:0;}
  .row b{color:var(--gold);font-variant-numeric:tabular-nums;white-space:nowrap;}
  .row .rk{color:var(--mut);font-size:.75rem;margin-right:5px;}
  .gold{color:var(--gold);} .mint{color:var(--mint);} .burn{color:var(--burn);} .sky{color:var(--sky);}
  .wide{grid-column:1/-1;}
  .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:.78rem;color:var(--mut);margin-top:10px;}
  .dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle;}

  .tiles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));}
  .tile{background:#fffdf6;border:2px solid var(--line);border-radius:14px;padding:10px 12px;transition:transform .12s;}
  .tile:hover{transform:translateY(-2px);}
  .tile.zero{opacity:.5;}
  .tile .n{font-size:1.25rem;font-weight:800;font-variant-numeric:tabular-nums;}
  .tile .l{font-size:.68rem;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-top:2px;line-height:1.3;}
  .tile .e{font-size:.95rem;margin-right:4px;}

  .ptable{width:100%;border-collapse:collapse;font-size:.8rem;font-variant-numeric:tabular-nums;}
  .ptable th{text-align:right;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);
    padding:6px 8px;border-bottom:2px solid var(--line);white-space:nowrap;}
  .ptable th:first-child,.ptable td:first-child{text-align:left;}
  .ptable td{padding:6px 8px;text-align:right;border-bottom:1px dashed var(--line);white-space:nowrap;}
  .ptable tr:last-child td{border-bottom:none;}
  .ptable .up{color:#2f9e5e;font-weight:800;}
  .ptable .down{color:#d85f4f;font-weight:800;}
  .ptable .flat{color:var(--mut);font-weight:700;}
  .ptable .nm{font-weight:800;}
  .ptable .base{color:var(--mut);font-size:.7rem;}
  svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y;}
  .tip{position:fixed;pointer-events:none;background:#4a3b2a;color:#fff7ea;border-radius:12px;border:2px solid #6b5335;
    padding:7px 11px;font-size:.76rem;box-shadow:0 5px 14px rgba(74,59,42,.3);opacity:0;transition:opacity .1s;white-space:nowrap;z-index:30;line-height:1.5;}
  footer{text-align:center;color:var(--mut);font-size:.76rem;padding:26px 16px 44px;line-height:1.6;}
  .skel .big:empty::after,.skel .n:empty::after{content:"···";color:var(--line);}
</style>
</head>
<body>
<header>
  <h1><span class="spark">✦</span> <span class="globe">🌍</span> MetricBase World — Economy <span class="spark r">✦</span></h1>
  <p><span class="live"><span class="dotp"></span><span id="onlineTop">—</span> playing now</span> · <span class="pill" id="ver">…</span> · <span id="updated">loading…</span></p>
  <button type="button" class="share-x" id="shareX" title="Share these numbers on 𝕏">𝕏 Share the numbers</button>
</header>

<nav>
  <a href="#overview">🏠 Overview</a>
  <a href="#season">🏆 Season</a>
  <a href="#richest">👑 Richest</a>
  <a href="#token">🪙 $BASE</a>
  <a href="#economy">💰 Economy</a>
  <a href="#prices">🏷️ Prices</a>
  <a href="#activity">🛠️ Activity</a>
  <a href="#markets">⚖️ Markets</a>
  <a href="#ads">📣 Ads</a>
  <a href="https://world.metricbase.org/brands" style="background:#1a1a1a;color:#fff7ea;border-color:#000">🏢 Advertise</a>
</nav>

<div class="wrap">
  <section id="overview">
    <div class="sec"><span class="em">🏠</span><h2>Overview</h2></div>
    <div class="grid">
      <div class="card"><h2>👥 Players</h2><div class="big" id="registered">—</div><div class="sub"><span id="online">—</span> online · avg Lv <span id="avgLevel">—</span> · top Lv <span id="maxLevel">—</span></div></div>
      <div class="card"><h2>🪙 Circulating gold</h2><div class="big gold" id="circulating">—</div><div class="sub">held by all players</div></div>
      <div class="card"><h2>🌍 Player Worlds</h2><div class="big mint" id="worlds">—</div><div class="sub"><span id="worldsPub">—</span> published</div></div>
      <div class="card"><h2>🏛️ Treasury (burned)</h2><div class="big burn" id="treasury">—</div><div class="sub">gold removed from circulation</div></div>
    </div>
  </section>

  <section id="season">
    <div class="sec"><span class="em">🏆</span><h2>Season</h2></div>
    <div class="card wide">
      <h2>🏆 Season <span id="seasonNum">—</span> · <span id="seasonMeta">—</span></h2>
      <div style="overflow-x:auto"><table class="ptable" id="seasonTable"><thead><tr>
        <th>Player</th><th>Points</th><th>Est. $BASE</th>
      </tr></thead><tbody></tbody></table></div>
      <div class="legend" style="margin-top:10px"><span>Earn points by playing — gather, craft, trade, win PvP, refer friends, and top the Richest board. At season end the prize pool is split pro-rata by points. Season 1 is a fixed 1,000,000 $BASE funded from the dev wallet; later seasons' prizes are set by DAO vote. Points never mint $BASE — the pool is a pre-committed allocation.</span></div>
    </div>
  </section>

  <section id="richest">
    <div class="sec"><span class="em">👑</span><h2>Richest Players</h2></div>
    <div class="card wide">
      <h2>👑 Net-worth leaderboard · <span id="richMeta">—</span></h2>
      <div style="overflow-x:auto"><table class="ptable" id="richTable"><thead><tr>
        <th>Player</th><th>Net worth</th><th>Today</th>
      </tr></thead><tbody></tbody></table></div>
      <div class="legend" style="margin-top:10px"><span>Net worth = gold on hand + inventory items + build assets + player Worlds, houses &amp; shops, all at their gold value. <b>Today</b> = change since the previous daily snapshot. The board resets every 90-day season; days count from game launch.</span></div>
    </div>
  </section>

  <section id="token">
    <div class="sec"><span class="em">🪙</span><h2>$BASE Token</h2></div>
    <div class="grid">
      <div class="card"><h2>🔥 $BASE burned</h2><div class="big burn" id="baseBurned">—</div><div class="sub">tokens burned via in-game sinks</div></div>
      <div class="card"><h2>💎 $BASE held by players</h2><div class="big gold" id="baseHeld">—</div><div class="sub"><span id="baseHolders">—</span> bonded player wallets holding $BASE</div></div>
      <div class="card"><h2>🕳️ Burn sinks</h2><div id="burnSinks"></div></div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>🔥 $BASE burned per day (last 14 days)</h2>
      <svg id="burnChart" viewBox="0 0 720 220" role="img" aria-label="$BASE tokens burned per day"></svg>
      <div class="legend"><span><span class="dot" style="background:var(--burn)"></span>$BASE burned by in-game sinks (passes, World &amp; bag expansions)</span></div>
    </div>
  </section>

  <section id="economy">
    <div class="sec"><span class="em">💰</span><h2>Gold Economy</h2></div>
    <div class="grid" style="margin-bottom:14px">
      <div class="card"><h2>⚖️ Mint pressure (7d)</h2><div class="big" id="mintPressure">—</div><div class="sub">minted ÷ burned, last 7 days — fees adapt ±20% (now ×<span id="sinkMult">—</span>)</div></div>
      <div class="card"><h2>🌩️ Economic events</h2><div id="econEvents" style="font-size:.85rem">—</div><div class="sub">live world events perturbing yields &amp; prices</div></div>
      <div class="card"><h2>🌱 Gold minted (7d)</h2><div class="big mint" id="minted7">—</div><div class="sub">entered circulation this week</div></div>
      <div class="card"><h2>🔥 Gold burned (7d)</h2><div class="big burn" id="burned7">—</div><div class="sub">left circulation this week</div></div>
    </div>
    <div class="card wide">
      <h2>💰 Gold flow — minted vs burned (last 14 days)</h2>
      <svg id="goldChart" viewBox="0 0 720 240" role="img" aria-label="Gold minted and burned per day"></svg>
      <div class="legend">
        <span><span class="dot" style="background:var(--mint)"></span>Minted (gathered→sold, mobs, quests)</span>
        <span><span class="dot" style="background:var(--burn)"></span>Burned (shop, forge, Worlds, treasury)</span>
      </div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>🪙 Circulating gold supply (last 14 days)</h2>
      <svg id="supplyChart" viewBox="0 0 720 220" role="img" aria-label="Circulating gold supply per day"></svg>
      <div class="legend"><span><span class="dot" style="background:var(--gold)"></span>Total gold held by players (reconstructed from daily mint/burn flow)</span></div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>💹 $BASE gold-market volume (last 14 days)</h2>
      <svg id="mktChart" viewBox="0 0 720 220" role="img" aria-label="Gold-market volume per day"></svg>
      <div class="legend"><span><span class="dot" style="background:var(--sell)"></span>Gold traded for $BASE per day</span></div>
    </div>
  </section>

  <section id="prices">
    <div class="sec"><span class="em">🏷️</span><h2>Item Prices — Supply &amp; Demand</h2></div>
    <div class="grid" style="margin-bottom:14px">
      <div class="card"><h2>📈 Biggest gainers</h2><div id="priceUp"></div></div>
      <div class="card"><h2>📉 Biggest drops</h2><div id="priceDown"></div></div>
      <div class="card"><h2>🔥 Most produced (7d)</h2><div id="flowTop"></div></div>
    </div>
    <div class="card wide">
      <h2>🏷️ Live vendor prices — every tracked item</h2>
      <div style="overflow-x:auto"><table class="ptable" id="priceTable"><thead><tr>
        <th>Item</th><th>Vendor pays</th><th>vs base</th><th>Shop price</th><th>7d produced</th><th>7d used</th>
      </tr></thead><tbody></tbody></table></div>
      <div class="legend" style="margin-top:10px"><span>Prices drift with the 7-day <b>demand ÷ produced</b> ratio (0.5×–2× of base). Demand = items used (eaten, planted, crafted with, repairs) <b>plus shop purchases</b>; produced = gathered, crafted &amp; dropped. Oversupplied items get cheaper, in-demand items get more valuable; dumping a stack on a vendor also softens its price for a few minutes.</span></div>
    </div>
  </section>

  <section id="activity">
    <div class="sec"><span class="em">🛠️</span><h2>Player Activity</h2></div>
    <div class="grid" style="margin-bottom:14px">
      <div class="card"><h2>📅 Daily quests</h2><div class="big mint" id="dqActive">—</div><div class="sub"><span id="dqClaimed">—</span> tasks claimed · <span id="dqLogins">—</span> login bonuses · <span id="dqGold">—</span>g paid out</div></div>
      <div class="card"><h2>👣 World visits</h2><div class="big" id="wVisits">—</div><div class="sub"><span id="wExpanded">—</span> Worlds expanded · <span id="bagExp">—</span> bags expanded</div></div>
      <div class="card"><h2>🧑‍🌾 Player jobs</h2><div class="big gold" id="jobsOpen">—</div><div class="sub">open on the board · <span id="jobsCompleted">—</span> completed · <span id="jobsGold">—</span>g paid to workers</div></div>
    </div>
    <div class="card wide">
      <h2>🛠️ Activity — per day (last 14 days)</h2>
      <svg id="actChart" viewBox="0 0 720 240" role="img" aria-label="Economy activity per day"></svg>
      <div class="legend">
        <span><span class="dot" style="background:var(--gather)"></span>Gathered</span>
        <span><span class="dot" style="background:var(--craft)"></span>Crafted</span>
        <span><span class="dot" style="background:var(--sell)"></span>Sold to shop</span>
        <span><span class="dot" style="background:var(--buy)"></span>Bought</span>
      </div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>🎣 Fish catches by rarity — per day (last 14 days)</h2>
      <svg id="fishChart" viewBox="0 0 720 240" role="img" aria-label="Fish caught per day, split by rarity tier"></svg>
      <div class="legend">
        <span><span class="dot" style="background:#b1491c"></span>Common</span>
        <span><span class="dot" style="background:#2f9e5e"></span>Uncommon</span>
        <span><span class="dot" style="background:#2f74c0"></span>Rare</span>
        <span><span class="dot" style="background:#b03a9e"></span>Epic</span>
        <span><span class="dot" style="background:#b8860b"></span>Legendary</span>
      </div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>📦 Lifetime activity totals</h2>
      <div class="tiles" id="totals"></div>
    </div>
  </section>

  <section id="markets">
    <div class="sec"><span class="em">⚖️</span><h2>Markets &amp; Treasury</h2></div>
    <div class="grid">
      <div class="card"><h2>🏛️ Treasury by source</h2><div id="treasurySrc"></div></div>
      <div class="card"><h2>🧱 Asset market</h2><div id="assetMkt"></div></div>
      <div class="card"><h2>🌍 Worlds economy</h2><div id="worldsEco"></div></div>
      <div class="card"><h2>👑 Top gold holders</h2><div id="holders"></div></div>
    </div>
  </section>

  <section id="ads">
    <div class="sec"><span class="em">📣</span><h2>Ads Marketplace</h2></div>
    <div class="grid">
      <div class="card"><h2>💵 Ad revenue</h2><div class="big sky" id="adRevenue">—</div><div class="sub">brand $BASE spent on impressions</div></div>
      <div class="card"><h2>🤝 Paid to players</h2><div class="big mint" id="adPaid">—</div><div class="sub"><span id="adShare">—</span>% revenue share</div></div>
      <div class="card"><h2>👁️ Ad impressions</h2><div class="big" id="adImpr">—</div><div class="sub">creatives served</div></div>
      <div class="card"><h2>🎯 Active campaigns</h2><div class="big" id="adActive">—</div><div class="sub"><span id="adBrands">—</span> brands · <span id="adPending">—</span> pending · <a href="https://world.metricbase.org/brands" style="color:#5a97e0;font-weight:800">advertise →</a></div></div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>📣 Ad revenue vs player payouts (last 14 days)</h2>
      <svg id="adChart" viewBox="0 0 720 240" role="img" aria-label="Ad revenue and player payouts per day"></svg>
      <div class="legend">
        <span><span class="dot" style="background:#5a97e0"></span>Brand ad spend</span>
        <span><span class="dot" style="background:#3fae74"></span>Paid to players</span>
      </div>
    </div>
    <div class="card wide" style="margin-top:14px">
      <h2>📦 Ad marketplace totals</h2>
      <div class="tiles" id="adTotals"></div>
    </div>
  </section>
</div>
<footer>Numbers are live from the game database — nothing is hidden. ✨<br>
Gold is <b>minted</b> by gameplay (selling gathered goods, mob &amp; quest rewards) and <b>burned</b> by sinks (the shop, forge fees, founding &amp; building Worlds).</footer>
<div class="tip" id="tip"></div>
<script>
var fmt=function(n){return (Math.round(n)||0).toLocaleString();};
// Compact display for big numbers (2.5M, 58.4k); full value stays in tooltips.
function kfmt(n){n=Math.round(n)||0;var a=Math.abs(n);
  if(a>=1e9)return (n/1e9).toFixed(a>=1e10?0:1).replace(/\\.0$/,"")+"B";
  if(a>=1e6)return (n/1e6).toFixed(a>=1e7?0:1).replace(/\\.0$/,"")+"M";
  if(a>=1e4)return (n/1e3).toFixed(a>=1e5?0:1).replace(/\\.0$/,"")+"k";
  return n.toLocaleString();}
function el(id){return document.getElementById(id);}
// Set text; play a soft "bump" when the value actually changed.
function set(id,v){var e=el(id);if(!e)return;if(e.textContent!==String(v)){e.textContent=v;
  if(e.classList.contains("big")){e.classList.remove("bump");void e.offsetWidth;e.classList.add("bump");}}}
// Big-number card: compact display + exact value on hover.
function setBig(id,n,suffix){var e=el(id);if(!e)return;var v=kfmt(n)+(suffix||"");
  e.title=fmt(n)+(suffix||"");set(id,v);}
function rows(node,items,fn){node.innerHTML=items.length?items.map(fn).join(""):'<div class="sub">Nothing here yet 🌱</div>';}
var tip=el("tip");
function showTip(x,y,html){tip.innerHTML=html;
  var w=tip.offsetWidth||160;var left=x+14;if(left+w>window.innerWidth-8)left=x-w-14;
  tip.style.left=left+"px";tip.style.top=(y+14)+"px";tip.style.opacity=1;}
function hideTip(){tip.style.opacity=0;}

// Build the last N day labels (YYYY-MM-DD).
function lastDays(n){var out=[];var d=new Date();for(var i=n-1;i>=0;i--){var t=new Date(d);t.setDate(d.getDate()-i);out.push(t.toISOString().slice(0,10));}return out;}
// Turn the daily rows into aligned value arrays per metric.
function series(daily,days,metric){var m={};daily.forEach(function(r){if(r.metric===metric)m[r.day]=r.value;});return days.map(function(d){return m[d]||0;});}
// Align an ad {day,value}[] series onto the days axis.
function adSeries(points,days){var m={};(points||[]).forEach(function(p){m[p.day]=p.value;});return days.map(function(d){return m[d]||0;});}

// Draw a multi-series line chart into an <svg> (720x240 viewBox):
// soft area fills, dotted grid, hover crosshair with per-series markers.
var chartSeq=0;
function lineChart(svg,days,seriesArr){
  var W=720,H=Number(svg.getAttribute("viewBox").split(" ")[3])||240,padL=46,padR=16,padT=14,padB=26;
  var max=0;seriesArr.forEach(function(s){s.vals.forEach(function(v){if(v>max)max=v;});});
  var empty=max<=0;if(empty)max=1;
  var nice=Math.pow(10,Math.floor(Math.log10(max)));max=Math.ceil(max/nice)*nice;
  var n=days.length,cid="c"+(chartSeq++);
  var xx=function(i){return padL+(n<=1?0:i*(W-padL-padR)/(n-1));};
  var yy=function(v){return H-padB-(v/max)*(H-padT-padB);};
  var s='<defs>';
  seriesArr.forEach(function(ser,si){
    s+='<linearGradient id="'+cid+'g'+si+'" x1="0" y1="0" x2="0" y2="1">'
      +'<stop offset="0%" stop-color="'+ser.color+'" stop-opacity="0.16"/>'
      +'<stop offset="100%" stop-color="'+ser.color+'" stop-opacity="0.02"/></linearGradient>';});
  s+='</defs>';
  // grid + y labels (4 steps)
  for(var g=0;g<=4;g++){var yv=max*g/4;var y=yy(yv);
    s+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="#efe2c4" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/>';
    s+='<text x="'+(padL-8)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#9c8a6d">'+kfmt(yv)+'</text>';}
  // x labels (up to 5, evenly spread)
  var labs=n<=5?days.map(function(_,i){return i;}):[0,Math.floor((n-1)*0.25),Math.floor((n-1)*0.5),Math.floor((n-1)*0.75),n-1];
  labs.forEach(function(i){s+='<text x="'+xx(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#9c8a6d">'+days[i].slice(5).replace("-","/")+'</text>';});
  if(empty){
    s+='<text x="'+((padL+W-padR)/2)+'" y="'+((padT+H-padB)/2)+'" text-anchor="middle" font-size="13" font-weight="700" fill="#c9b088">Nothing yet — check back soon! 🌱</text>';
    svg.innerHTML=s;svg.onpointermove=null;svg.onpointerleave=null;return;
  }
  // area fills first (under all lines), then lines on top
  seriesArr.forEach(function(ser,si){
    var d='';ser.vals.forEach(function(v,i){d+=(i?'L':'M')+xx(i)+' '+yy(v)+' ';});
    s+='<path d="'+d+'L'+xx(n-1)+' '+(H-padB)+' L'+xx(0)+' '+(H-padB)+' Z" fill="url(#'+cid+'g'+si+')" stroke="none"/>';});
  seriesArr.forEach(function(ser){
    var d='';ser.vals.forEach(function(v,i){d+=(i?'L':'M')+xx(i)+' '+yy(v)+' ';});
    s+='<path d="'+d+'" fill="none" stroke="'+ser.color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    s+='<circle cx="'+xx(n-1)+'" cy="'+yy(ser.vals[n-1])+'" r="3.5" fill="'+ser.color+'" stroke="#fffdf6" stroke-width="1.5"/>';});
  // crosshair (hidden until hover): vertical line + one marker per series
  s+='<g id="'+cid+'x" style="display:none"><line y1="'+padT+'" y2="'+(H-padB)+'" stroke="#c9b088" stroke-width="1" stroke-dasharray="3 3"/>';
  seriesArr.forEach(function(ser,si){s+='<circle r="4" fill="'+ser.color+'" stroke="#fffdf6" stroke-width="1.5" data-i="'+si+'"/>';});
  s+='</g>';
  svg.innerHTML=s;
  var cross=svg.querySelector("#"+cid+"x");
  var xline=cross.querySelector("line");
  var marks=cross.querySelectorAll("circle");
  svg.onpointermove=function(ev){
    var r=svg.getBoundingClientRect();var px=(ev.clientX-r.left)/r.width*W;
    var i=Math.round((px-padL)/((W-padL-padR)/(Math.max(1,n-1))));i=Math.max(0,Math.min(n-1,i));
    cross.style.display="";
    var cx=xx(i);xline.setAttribute("x1",cx);xline.setAttribute("x2",cx);
    marks.forEach(function(c,si){c.setAttribute("cx",cx);c.setAttribute("cy",yy(seriesArr[si].vals[i]));});
    var html='<b>'+days[i]+'</b>';seriesArr.forEach(function(ser){html+='<br><span style="color:'+ser.color+'">●</span> '+ser.name+': <b>'+fmt(ser.vals[i])+'</b>';});
    showTip(ev.clientX,ev.clientY,html);
  };
  svg.onpointerleave=function(){cross.style.display="none";hideTip();};
}

function tileHtml(t){var v=t[2]||0;
  return '<div class="tile'+(v?'':' zero')+'" title="'+fmt(v)+'"><div class="n">'+kfmt(v)+'</div><div class="l"><span class="e">'+t[0]+'</span>'+t[1]+'</div></div>';}

var lastLoad=0,lastStats=null;
setInterval(function(){if(!lastLoad)return;var s=Math.round((Date.now()-lastLoad)/1000);
  set("updated","updated "+(s<3?"just now":s+"s ago"));},1000);

// 𝕏 share: compose a "World in numbers" post from the freshest stats.
// X's intent page hard-errors ("Something went wrong…") when the prefilled
// text runs past the post limit, so stat lines are only added while the
// whole post still fits. xLen mirrors X's counting (emoji/astral chars = 2;
// we count the URL raw, which over-counts vs t.co's 23 — safe direction).
function xLen(t){var n=0;for(var i=0;i<t.length;i++){var c=t.charCodeAt(i);if(c>=0xD800&&c<=0xDBFF){n+=2;i++;}else{n++;}}return n;}
el("shareX").onclick=function(){
  var s=lastStats;
  var head=["MetricBase World 🌎 in numbers",""];
  var tail=["","Live transparent dashboard 👇","https://world.metricbase.org/stats"];
  var stats=[];
  if(s){
    stats.push("👥 "+fmt(s.players.registered)+" adventurers · 🟢 "+fmt(s.players.online)+" online now");
    stats.push("🪙 "+kfmt(s.players.circulatingGold)+" gold in circulation");
    stats.push("🔥 "+kfmt((s.baseToken||{}).burned||0)+" $BASE burned");
    var w=s.worlds||{};
    stats.push("🌍 "+fmt(w.total||0)+" player-built Worlds · 👣 "+fmt(w.visits||0)+" visits");
    var ad=s.ads||{};
    if(ad.totalRevenue>0)stats.push("📣 "+kfmt(ad.totalRevenue)+" $BASE ad revenue — "+fmt(ad.sharePct||50)+"% paid to players");
  }
  var lines=head.slice();
  var budget=272-xLen(head.join("\\n")+"\\n"+tail.join("\\n"));
  for(var i=0;i<stats.length;i++){
    var cost=xLen(stats[i])+1;
    if(cost<=budget){lines.push(stats[i]);budget-=cost;}
  }
  var text=lines.concat(tail).join("\\n");
  window.open("https://x.com/intent/post?text="+encodeURIComponent(text),"_blank","noopener");
};

async function load(){
  try{
    var s=await (await fetch("/api/stats",{cache:"no-store"})).json();
    lastLoad=Date.now();lastStats=s;
    set("ver","v"+s.version);
    set("registered",fmt(s.players.registered));
    set("online",fmt(s.players.online));
    set("onlineTop",fmt(s.players.online));
    set("avgLevel",fmt(s.players.avgLevel||0));
    set("maxLevel",fmt(s.players.maxLevel||0));
    setBig("circulating",s.players.circulatingGold,"g");
    set("worlds",fmt(s.worlds.total));
    set("worldsPub",fmt(s.worlds.published));
    setBig("treasury",s.treasury.total,"g");
    var bt=s.baseToken||{burned:0,heldByPlayers:0,holders:0};
    setBig("baseBurned",bt.burned," $BASE");
    setBig("baseHeld",bt.heldByPlayers," $BASE");
    set("baseHolders",fmt(bt.holders));
    var bs=s.burnSinks||{};
    rows(el("burnSinks"),[
      {k:"⚫ Black Zone passes ("+fmt(bs.blackPasses||0)+")",v:kfmt(bs.blackPassBase||0)+" $BASE"},
      {k:"🗺️ World expansions ("+fmt(bs.worldExpands||0)+")",v:kfmt(bs.worldExpandBase||0)+" $BASE"},
      {k:"🎒 Bag expansions ("+fmt(bs.bagExpands||0)+")",v:kfmt(bs.bagExpandBase||0)+" $BASE"}
    ],function(x){return '<div class="row"><span>'+x.k+'</span><b>'+x.v+'</b></div>';});
    var dq=s.dailyQuests||{};
    set("dqActive",fmt(dq.activeToday||0));
    set("dqClaimed",fmt(dq.claimed||0));
    set("dqLogins",fmt(dq.logins||0));
    set("dqGold",kfmt(dq.gold||0));
    var jb=s.jobs||{};
    set("jobsOpen",fmt(jb.openNow||0));
    set("jobsCompleted",fmt(jb.completed||0));
    set("jobsGold",kfmt(jb.goldPaid||0));
    var w=s.worlds||{};
    setBig("wVisits",w.visits||0,"");
    set("wExpanded",fmt(w.expanded||0));
    set("bagExp",fmt(bs.bagExpands||0));
    var days=lastDays(14),a=s.activity||{},daily=s.daily||[];
    lineChart(el("goldChart"),days,[
      {name:"Minted",color:"#3fae74",vals:series(daily,days,"gold.minted")},
      {name:"Burned",color:"#d85f97",vals:series(daily,days,"gold.burned")}]);
    // Money-supply health: 7-day minted/burned ratio from the same honest series.
    (function(){
      var m7=0,b7=0,mv=series(daily,days,"gold.minted"),bv=series(daily,days,"gold.burned");
      for(var i=Math.max(0,days.length-7);i<days.length;i++){m7+=mv[i]||0;b7+=bv[i]||0;}
      var mp=el("mintPressure");
      if(mp){var r=m7/Math.max(1,b7);mp.textContent=r.toFixed(2)+"×";
        mp.className="big "+(r>1.15?"burn":r<0.9?"mint":"gold");}
      set("minted7",kfmt(m7));set("burned7",kfmt(b7));
      var ec=s.econ||{};
      set("sinkMult",(ec.sinkMultiplier!=null?ec.sinkMultiplier.toFixed(2):"1.00"));
      var evEl=el("econEvents");
      if(evEl){var evs=ec.events||[];
        evEl.innerHTML=evs.length===0?'<span style="opacity:.6">All calm — no active events.</span>'
          :evs.map(function(e){var mins=Math.max(0,Math.round((e.endsAt-Date.now())/60000));
            return "<div><b>"+e.icon+" "+e.label+"</b>"+(e.zoneLabel?" · "+e.zoneLabel:"")+" · "+(mins>=60?Math.floor(mins/60)+"h "+(mins%60)+"m":mins+"m")+" left</div>";}).join("");}
    })();
    lineChart(el("actChart"),days,[
      {name:"Gathered",color:"#3fae74",vals:series(daily,days,"gather.count")},
      {name:"Crafted",color:"#e09b2d",vals:series(daily,days,"craft.count")},
      {name:"Sold",color:"#5a97e0",vals:series(daily,days,"sell.count")},
      {name:"Bought",color:"#d85f97",vals:series(daily,days,"buy.count")}]);
    lineChart(el("mktChart"),days,[{name:"Gold volume",color:"#5a97e0",vals:series(daily,days,"market.gold")}]);
    lineChart(el("fishChart"),days,[
      {name:"Common",color:"#b1491c",vals:series(daily,days,"fish.common")},
      {name:"Uncommon",color:"#2f9e5e",vals:series(daily,days,"fish.uncommon")},
      {name:"Rare",color:"#2f74c0",vals:series(daily,days,"fish.rare")},
      {name:"Epic",color:"#b03a9e",vals:series(daily,days,"fish.epic")},
      {name:"Legendary",color:"#b8860b",vals:series(daily,days,"fish.legendary")}]);
    lineChart(el("burnChart"),days,[{name:"$BASE burned",color:"#d85f97",vals:series(daily,days,"base.burned")}]);
    // Circulating gold trend: walk back from today's live supply using each
    // day's net flow (minted - burned) — honest reconstruction, no fabrication.
    (function(){
      var minted=series(daily,days,"gold.minted"),burned=series(daily,days,"gold.burned");
      var supply=new Array(days.length);
      supply[days.length-1]=s.players.circulatingGold||0;
      for(var i=days.length-1;i>0;i--){supply[i-1]=Math.max(0,supply[i]-((minted[i]||0)-(burned[i]||0)));}
      lineChart(el("supplyChart"),days,[{name:"Circulating gold",color:"#e0a92e",vals:supply}]);
    })();
    var tiles=[["⚔️","Mobs defeated",a["mob.kills"]],["📜","Quests done",a["quest.completed"]],["🏆","PvP kills",a["pvp.kills"]],
      ["🧺","Gathered",a["gather.count"]],["🪵","Wood",a["gather.woodcutting"]],["⛏️","Ore",a["gather.mining"]],["🐟","Fish",a["gather.fishing"]],
      ["🎣","Uncommon+ fish",(a["fish.uncommon"]||0)+(a["fish.rare"]||0)+(a["fish.epic"]||0)+(a["fish.legendary"]||0)],
      ["✨","Rare fish",a["fish.rare"]],["💎","Epic fish",a["fish.epic"]],["🏆","Legendary fish",a["fish.legendary"]],
      ["🌾","Crops harvested",a["farm.harvest"]],["🔨","Crafted",a["craft.count"]],["💰","Sold to shop",a["sell.count"]],
      ["🛍️","Bought from shop",a["buy.count"]],["🧱","Assets placed",a["asset.placed"]],["📦","Assets bought",a["asset.bought"]],
      ["🔁","Assets traded",a["asset.sold"]],["🎟️","World passes sold",a["pass.sold"]],["🪙","Pass gold",a["pass.gold"]],
      ["🧾","Gather tax paid",a["gathertax.gold"]],["👹","Gold from mobs",a["mob.gold"]],["✨","Gold from quests",a["quest.gold"]],
      ["🗺️","World expansions",a["zone.expanded"]],["🎒","Bag expansions",a["bag.expanded"]],
      ["📅","Daily tasks claimed",a["daily.claimed"]],["🔥","Login bonuses",a["daily.login"]],["🪙","Daily gold paid",a["daily.gold"]],
      ["📋","Town orders filled",a["town.order.filled"]],["🏘️","Town-order gold",a["gold.faucet.townOrders"]],
      ["🚚","Caravan runs",a["caravan.completed"]],["🏴‍☠️","Cargo intercepted",a["caravan.intercepted"]],
      ["📦","Cargo lost",a["caravan.lost"]],["🪙","Freight gold",a["gold.faucet.caravan"]],
      ["✨","Fine crafts",a["craft.quality.fine"]],["🌟","Master crafts",a["craft.quality.master"]],
      ["🍞","Bonus-yield crafts",a["craft.bonusYield"]],["🎓","Respec gold burned",a["gold.sink.respec"]],
      ["🧑‍🌾","Jobs posted",a["jobs.posted"]],["🤝","Jobs completed",a["jobs.completed"]],["💵","Job wages paid",a["jobs.goldPaid"]]];
    el("totals").innerHTML=tiles.map(tileHtml).join("");
    rows(el("treasurySrc"),s.treasury.bySource,function(x){return '<div class="row"><span>'+x.source+'</span><b>'+fmt(x.gold)+'g</b></div>';});
    rows(el("assetMkt"),[{k:"Active listings",v:s.assetMarket.listings},{k:"Listed value",v:fmt(s.assetMarket.askValue)+"g"},{k:"Assets owned",v:s.assetMarket.totalOwned},{k:"$BASE trades",v:s.goldMarket.trades},{k:"Market gold vol.",v:fmt(s.goldMarket.goldVolume)+"g"}],function(x){return '<div class="row"><span>'+x.k+'</span><b>'+(typeof x.v==="number"?fmt(x.v):x.v)+'</b></div>';});
    rows(el("worldsEco"),[
      {k:"👣 Lifetime visits",v:fmt(w.visits||0)},
      {k:"🎟️ Passes sold",v:fmt(w.passesSold||0)},
      {k:"🪙 Pass gold to owners",v:fmt(w.passGold||0)+"g"},
      {k:"🌾 Gather tax to owners",v:fmt(w.taxGold||0)+"g"},
      {k:"🗺️ Expanded Worlds",v:fmt(w.expanded||0)+" / "+fmt(w.total||0)}
    ],function(x){return '<div class="row"><span>'+x.k+'</span><b>'+x.v+'</b></div>';});
    rows(el("holders"),s.topHolders,function(x,i){return '<div class="row"><span><span class="rk">'+(i<3?["🥇","🥈","🥉"][i]:"#"+(i+1))+'</span>'+x.name+'</span><b>'+fmt(x.gold)+'g</b></div>';});

    // ---- Season points leaderboard ----
    (function(){
      var q=s.season||{number:1,endsAt:0,rewardPool:0,players:0,totalPoints:0,top:[]};
      set("seasonNum",fmt(q.number));
      var ms=Math.max(0,q.endsAt-Date.now()),d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000);
      set("seasonMeta","ends in "+(d>0?d+"d "+h+"h":h+"h")+" · 💰 "+fmt(q.rewardPool)+" $BASE pool · "+fmt(q.players)+" competing");
      var tb=el("seasonTable").querySelector("tbody");
      tb.innerHTML=(q.top||[]).map(function(x,i){
        var rk=i<3?["🥇","🥈","🥉"][i]:"#"+(i+1);
        var est=q.totalPoints>0?Math.floor(x.points/q.totalPoints*q.rewardPool):0;
        return '<tr><td class="nm"><span class="rk">'+rk+'</span>'+x.name+'</td><td>'+fmt(x.points)+'</td><td class="gold">'+fmt(est)+'</td></tr>';
      }).join("")||'<tr><td colspan="3" class="base">Nothing here yet 🌱</td></tr>';
    })();

    // ---- Richest players (net worth + daily change, seasonal) ----
    (function(){
      var r=s.richest||{season:1,day:1,entries:[]};
      set("richMeta","Season "+fmt(r.season)+" · Day "+fmt(r.day));
      var tb=el("richTable").querySelector("tbody");
      tb.innerHTML=(r.entries||[]).map(function(x,i){
        var rk=i<3?["🥇","🥈","🥉"][i]:"#"+(i+1);
        var ch=x.change==null?'<span class="flat">— new</span>'
          :x.change>0?'<span class="up">▲ +'+kfmt(x.change)+'g</span>'
          :x.change<0?'<span class="down">▼ −'+kfmt(-x.change)+'g</span>'
          :'<span class="flat">＝</span>';
        return '<tr><td class="nm"><span class="rk">'+rk+'</span>'+x.name+'</td><td title="'+fmt(x.netWorth)+'g">'+fmt(x.netWorth)+'g</td><td>'+ch+'</td></tr>';
      }).join("")||'<tr><td colspan="3" class="base">Nothing here yet 🌱</td></tr>';
    })();

    // ---- Item prices (supply & demand) ----
    (function(){
      var items=s.itemPrices||[];
      var KINDS={material:"📦",consumable:"🍞",weapon:"⚔️",tool:"🪓",armor:"🛡️",mount:"🐴",pet:"🐾"};
      function pct(m){return Math.round((m-1)*100);}
      function trend(m){var p=pct(m);
        if(p>0)return '<span class="up">▲ +'+p+'%</span>';
        if(p<0)return '<span class="down">▼ '+p+'%</span>';
        return '<span class="flat">＝</span>';}
      var tb=el("priceTable").querySelector("tbody");
      tb.innerHTML=items.map(function(it){
        var vendor=it.price>0?fmt(it.price)+'g <span class="base">('+fmt(it.base)+')</span>':'<span class="base">—</span>';
        var shop=it.buyPrice>0?fmt(it.buyPrice)+'g <span class="base">('+fmt(it.buyBase)+')</span>':'<span class="base">—</span>';
        return '<tr><td class="nm">'+(it.emoji||KINDS[it.kind]||"📦")+' '+it.name+'</td><td>'+vendor+'</td><td>'+trend(it.mult)
          +'</td><td>'+shop+'</td><td>'+fmt(it.produced7d)+'</td><td>'+fmt(it.consumed7d)+'</td></tr>';
      }).join("")||'<tr><td colspan="6" class="base">Nothing traded yet 🌱</td></tr>';
      var priced=items.filter(function(it){return it.price>0||it.buyPrice>0;});
      var up=priced.filter(function(it){return it.mult>1;}).sort(function(a,b){return b.mult-a.mult;}).slice(0,5);
      var dn=priced.filter(function(it){return it.mult<1;}).sort(function(a,b){return a.mult-b.mult;}).slice(0,5);
      rows(el("priceUp"),up,function(it){return '<div class="row"><span>'+(it.emoji?it.emoji+' ':'')+it.name+'</span><b class="up" style="color:#2f9e5e">+'+pct(it.mult)+'% · '+fmt(it.price||it.buyPrice)+'g</b></div>';});
      rows(el("priceDown"),dn,function(it){return '<div class="row"><span>'+(it.emoji?it.emoji+' ':'')+it.name+'</span><b style="color:#d85f4f">'+pct(it.mult)+'% · '+fmt(it.price||it.buyPrice)+'g</b></div>';});
      var top=items.slice().sort(function(a,b){return b.produced7d-a.produced7d;}).filter(function(it){return it.produced7d>0;}).slice(0,5);
      rows(el("flowTop"),top,function(it){return '<div class="row"><span>'+(it.emoji?it.emoji+' ':'')+it.name+'</span><b>'+fmt(it.produced7d)+' made · '+fmt(it.consumed7d)+' used</b></div>';});
    })();

    var ad=s.ads||{daily:{}};var adDaily=ad.daily||{};
    setBig("adRevenue",ad.totalRevenue," $BASE");
    setBig("adPaid",ad.playerPaid," $BASE");
    set("adShare",fmt(ad.sharePct));
    setBig("adImpr",ad.totalImpressions,"");
    set("adActive",fmt(ad.activeCampaigns));
    set("adBrands",fmt(ad.brands));
    set("adPending",fmt(ad.pendingCampaigns));
    lineChart(el("adChart"),days,[
      {name:"Ad spend",color:"#5a97e0",vals:adSeries(adDaily.revenue,days)},
      {name:"Paid to players",color:"#3fae74",vals:adSeries(adDaily.playerPaid,days)}]);
    var adTiles=[["🏢","Brands",ad.brands],["🤝","Program members",ad.members],["📊","Player share %",ad.sharePct],
      ["🎯","Active campaigns",ad.activeCampaigns],["⏳","Pending review",ad.pendingCampaigns],["🗂️","Total campaigns",ad.totalCampaigns],
      ["👁️","Impressions",ad.totalImpressions],["🏦","Platform cut ($BASE)",ad.platformCut],
      ["💤","Unclaimed to players ($BASE)",ad.unclaimed],["💳","Brand deposits ($BASE)",ad.brandDeposits]];
    el("adTotals").innerHTML=adTiles.map(tileHtml).join("");
  }catch(e){/* keep last values */}
}
load();setInterval(load,20000);
</script>
</body>
</html>`;
