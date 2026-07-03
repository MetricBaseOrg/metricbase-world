// Public, no-login economy dashboard served at GET /stats. Self-contained
// (no external assets) chibi-cozy themed page that fetches /api/stats and renders
// live metrics + hand-drawn SVG charts. Refreshes every 20s.
export const STATS_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MetricBase World — Economy</title>
<style>
  :root{
    --bg:#fdf3df; --panel:#fffdf6; --line:#e6d3aa; --ink:#4a3b2a; --mut:#9c8a6d;
    --shadow:#e4cf9f; --gather:#3fae74; --craft:#e09b2d; --sell:#5a97e0; --buy:#d85f97;
    --mint:#3fae74; --burn:#d85f97; --gold:#e0a92e;
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:"Nunito","Fredoka",system-ui,sans-serif;background:
    radial-gradient(900px 500px at 50% -8%,#fff7e6,#fdf3df);color:var(--ink);min-height:100vh;}
  header{text-align:center;padding:30px 16px 6px;}
  header h1{margin:0;font-size:1.7rem;font-weight:800;}
  header p{margin:6px 0 0;color:var(--mut);font-size:.86rem;}
  .wrap{max-width:1040px;margin:0 auto;padding:16px;}
  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));}
  .card{background:var(--panel);border:2px solid var(--line);border-radius:18px;
    box-shadow:0 4px 0 var(--shadow);padding:16px 18px;}
  .card h2{margin:0 0 8px;font-size:.78rem;text-transform:uppercase;letter-spacing:.7px;color:var(--mut);font-weight:800;}
  .big{font-size:1.85rem;font-weight:800;}
  .sub{color:var(--mut);font-size:.8rem;margin-top:2px;}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--line);font-size:.9rem;}
  .row:first-of-type{border-top:0;}
  .row b{color:var(--gold);font-variant-numeric:tabular-nums;}
  .gold{color:var(--gold);} .mint{color:var(--mint);} .burn{color:var(--burn);}
  .wide{grid-column:1/-1;}
  .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:.8rem;color:var(--mut);margin-top:8px;}
  .dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle;}
  .tiles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));}
  .tile{background:#fffdf6;border:2px solid var(--line);border-radius:14px;padding:10px 12px;}
  .tile .n{font-size:1.3rem;font-weight:800;}
  .tile .l{font-size:.72rem;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;}
  svg{display:block;width:100%;height:auto;overflow:visible;}
  .tip{position:fixed;pointer-events:none;background:#4a3b2a;color:#fff7ea;border-radius:10px;
    padding:6px 10px;font-size:.76rem;box-shadow:0 4px 12px rgba(0,0,0,.25);opacity:0;transition:opacity .1s;white-space:nowrap;z-index:20;}
  footer{text-align:center;color:var(--mut);font-size:.76rem;padding:22px 16px 40px;}
  .pill{display:inline-block;background:#fff;border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:.72rem;color:var(--mut);}
</style>
</head>
<body>
<header>
  <h1>🌍 MetricBase World — Economy</h1>
  <p>Live, public transparency dashboard · <span class="pill" id="ver">…</span> · updates every 20s</p>
</header>
<div class="wrap">
  <div class="grid">
    <div class="card"><h2>Players</h2><div class="big" id="registered">—</div><div class="sub"><span id="online">—</span> online · avg Lv <span id="avgLevel">—</span> · top Lv <span id="maxLevel">—</span></div></div>
    <div class="card"><h2>Circulating gold</h2><div class="big gold" id="circulating">—</div><div class="sub">held by all players</div></div>
    <div class="card"><h2>Player Worlds</h2><div class="big mint" id="worlds">—</div><div class="sub"><span id="worldsPub">—</span> published</div></div>
    <div class="card"><h2>Treasury (burned)</h2><div class="big burn" id="treasury">—</div><div class="sub">gold removed from circulation</div></div>
  </div>

  <div class="card wide" style="margin-top:14px">
    <h2>💰 Gold flow — minted vs burned (last 14 days)</h2>
    <svg id="goldChart" viewBox="0 0 720 240" role="img" aria-label="Gold minted and burned per day"></svg>
    <div class="legend">
      <span><span class="dot" style="background:var(--mint)"></span>Minted (gathered→sold, mobs, quests)</span>
      <span><span class="dot" style="background:var(--burn)"></span>Burned (shop, forge, Worlds, treasury)</span>
    </div>
  </div>

  <div class="card wide" style="margin-top:14px">
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
    <h2>💹 $BASE gold-market volume (last 14 days)</h2>
    <svg id="mktChart" viewBox="0 0 720 220" role="img" aria-label="Gold-market volume per day"></svg>
    <div class="legend"><span><span class="dot" style="background:var(--sell)"></span>Gold traded for $BASE per day</span></div>
  </div>

  <div class="card wide" style="margin-top:14px">
    <h2>📦 Lifetime activity totals</h2>
    <div class="tiles" id="totals"></div>
  </div>

  <div class="grid" style="margin-top:14px">
    <div class="card"><h2>Treasury by source</h2><div id="treasurySrc"></div></div>
    <div class="card"><h2>Asset market</h2><div id="assetMkt"></div></div>
    <div class="card"><h2>Top gold holders</h2><div id="holders"></div></div>
  </div>
</div>
<footer>Numbers are live from the game database. Gold is <b>minted</b> by gameplay (selling gathered goods, mob & quest rewards) and <b>burned</b> by sinks (the shop, forge fees, founding &amp; building Worlds).</footer>
<div class="tip" id="tip"></div>
<script>
var fmt=function(n){return (Math.round(n)||0).toLocaleString();};
function el(id){return document.getElementById(id);}
function set(id,v){var e=el(id);if(e)e.textContent=v;}
function rows(node,items,fn){node.innerHTML=items.length?items.map(fn).join(""):'<div class="sub">None yet.</div>';}
var tip=el("tip");
function showTip(x,y,html){tip.innerHTML=html;tip.style.left=(x+12)+"px";tip.style.top=(y+12)+"px";tip.style.opacity=1;}
function hideTip(){tip.style.opacity=0;}

// Build the last N day labels (YYYY-MM-DD).
function lastDays(n){var out=[];var d=new Date();for(var i=n-1;i>=0;i--){var t=new Date(d);t.setDate(d.getDate()-i);out.push(t.toISOString().slice(0,10));}return out;}
// Turn the daily rows into aligned value arrays per metric.
function series(daily,days,metric){var m={};daily.forEach(function(r){if(r.metric===metric)m[r.day]=r.value;});return days.map(function(d){return m[d]||0;});}

// Draw a multi-series line chart into an <svg> (720x240 viewBox).
function lineChart(svg,days,seriesArr){
  var W=720,H=240,padL=44,padR=16,padT=12,padB=26;
  var max=1;seriesArr.forEach(function(s){s.vals.forEach(function(v){if(v>max)max=v;});});
  var nice=Math.pow(10,Math.floor(Math.log10(max)));max=Math.ceil(max/nice)*nice;
  var n=days.length;
  var xx=function(i){return padL+(n<=1?0:i*(W-padL-padR)/(n-1));};
  var yy=function(v){return H-padB-(v/max)*(H-padT-padB);};
  var s='';
  // grid + y labels (4 steps)
  for(var g=0;g<=4;g++){var yv=max*g/4;var y=yy(yv);
    s+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="#efe2c4" stroke-width="1"/>';
    s+='<text x="'+(padL-6)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#9c8a6d">'+fmt(yv)+'</text>';}
  // x labels (first, mid, last)
  [0,Math.floor(n/2),n-1].forEach(function(i){s+='<text x="'+xx(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#9c8a6d">'+days[i].slice(5)+'</text>';});
  // lines + end labels
  seriesArr.forEach(function(ser){
    var d='';ser.vals.forEach(function(v,i){d+=(i?'L':'M')+xx(i)+' '+yy(v)+' ';});
    s+='<path d="'+d+'" fill="none" stroke="'+ser.color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    var last=ser.vals[n-1];
    s+='<circle cx="'+xx(n-1)+'" cy="'+yy(last)+'" r="3.5" fill="'+ser.color+'" stroke="#fffdf6" stroke-width="1.5"/>';
  });
  svg.innerHTML=s;
  // hover crosshair
  svg.onpointermove=function(ev){
    var r=svg.getBoundingClientRect();var px=(ev.clientX-r.left)/r.width*W;
    var i=Math.round((px-padL)/((W-padL-padR)/(Math.max(1,n-1))));i=Math.max(0,Math.min(n-1,i));
    var html='<b>'+days[i]+'</b>';seriesArr.forEach(function(ser){html+='<br><span style="color:'+ser.color+'">■</span> '+ser.name+': '+fmt(ser.vals[i]);});
    showTip(ev.clientX,ev.clientY,html);
  };
  svg.onpointerleave=hideTip;
}

async function load(){
  try{
    var s=await (await fetch("/api/stats",{cache:"no-store"})).json();
    set("ver",s.version);
    set("registered",fmt(s.players.registered));
    set("online",fmt(s.players.online));
    set("avgLevel",fmt(s.players.avgLevel||0));
    set("maxLevel",fmt(s.players.maxLevel||0));
    set("circulating",fmt(s.players.circulatingGold)+"g");
    set("worlds",fmt(s.worlds.total));
    set("worldsPub",fmt(s.worlds.published));
    set("treasury",fmt(s.treasury.total)+"g");
    var days=lastDays(14),a=s.activity||{},daily=s.daily||[];
    lineChart(el("goldChart"),days,[
      {name:"Minted",color:"#3fae74",vals:series(daily,days,"gold.minted")},
      {name:"Burned",color:"#d85f97",vals:series(daily,days,"gold.burned")}]);
    lineChart(el("actChart"),days,[
      {name:"Gathered",color:"#3fae74",vals:series(daily,days,"gather.count")},
      {name:"Crafted",color:"#e09b2d",vals:series(daily,days,"craft.count")},
      {name:"Sold",color:"#5a97e0",vals:series(daily,days,"sell.count")},
      {name:"Bought",color:"#d85f97",vals:series(daily,days,"buy.count")}]);
    lineChart(el("mktChart"),days,[{name:"Gold volume",color:"#5a97e0",vals:series(daily,days,"market.gold")}]);
    var tiles=[["Mobs defeated",a["mob.kills"]],["Quests done",a["quest.completed"]],["PvP kills",a["pvp.kills"]],
      ["Gathered",a["gather.count"]],["Wood",a["gather.woodcutting"]],["Ore",a["gather.mining"]],["Fish",a["gather.fishing"]],
      ["Crops harvested",a["farm.harvest"]],["Crafted",a["craft.count"]],["Sold to shop",a["sell.count"]],
      ["Bought from shop",a["buy.count"]],["Assets placed",a["asset.placed"]],["Assets bought",a["asset.bought"]],
      ["Assets traded",a["asset.sold"]],["World passes sold",a["pass.sold"]],["Pass gold",a["pass.gold"]],
      ["Gather tax paid",a["gathertax.gold"]],["Gold from mobs",a["mob.gold"]],["Gold from quests",a["quest.gold"]]];
    el("totals").innerHTML=tiles.map(function(t){return '<div class="tile"><div class="n">'+fmt(t[1]||0)+'</div><div class="l">'+t[0]+'</div></div>';}).join("");
    rows(el("treasurySrc"),s.treasury.bySource,function(x){return '<div class="row"><span>'+x.source+'</span><b>'+fmt(x.gold)+'g</b></div>';});
    rows(el("assetMkt"),[{k:"Active listings",v:s.assetMarket.listings},{k:"Listed value",v:s.assetMarket.askValue+"g"},{k:"Assets owned",v:s.assetMarket.totalOwned},{k:"$BASE trades",v:s.goldMarket.trades},{k:"Market gold vol.",v:s.goldMarket.goldVolume+"g"}],function(x){return '<div class="row"><span>'+x.k+'</span><b>'+(typeof x.v==="number"?fmt(x.v):x.v)+'</b></div>';});
    rows(el("holders"),s.topHolders,function(x){return '<div class="row"><span>'+x.name+'</span><b>'+fmt(x.gold)+'g</b></div>';});
  }catch(e){/* keep last values */}
}
load();setInterval(load,20000);
</script>
</body>
</html>`;
