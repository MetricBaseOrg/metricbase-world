// Shared stylesheet for the Mission Center pages. Same palette as /stats so the
// two feel like one product, but denser: this is a console read at a glance, not
// a page read once.

export const MISSION_CSS = `
:root{
  --bg:#fdf3df; --panel:#fffdf6; --line:#e6d3aa; --ink:#4a3b2a; --mut:#9c8a6d;
  --shadow:#e4cf9f; --good:#3fae74; --bad:#d85f97; --warn:#e09b2d; --sky:#5a97e0;
  --ink-dim:#7a6852;
}
*{box-sizing:border-box;}
body{margin:0;font-family:"Nunito","Fredoka",system-ui,sans-serif;
  background:radial-gradient(1000px 520px at 50% -10%,#fff7e6,#fdf3df);
  color:var(--ink);min-height:100vh;font-size:14px;}
a{color:var(--sky);}
h1,h2,h3{margin:0;font-weight:800;}
code,pre,.mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}

/* ---- layout ---- */
.wrap{max-width:1180px;margin:0 auto;padding:18px 16px 64px;}
.topbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:14px 16px;background:var(--panel);border:2px solid var(--line);
  border-radius:16px;box-shadow:0 3px 0 var(--shadow);margin-bottom:14px;}
.topbar h1{font-size:1.05rem;}
.topbar .spacer{flex:1;}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
.tab{border:2px solid var(--line);background:var(--panel);color:var(--ink);
  border-radius:999px;padding:7px 16px;font:inherit;font-weight:800;cursor:pointer;}
.tab.active{background:var(--ink);color:#fff9ea;border-color:var(--ink);}
.panel{background:var(--panel);border:2px solid var(--line);border-radius:16px;
  box-shadow:0 3px 0 var(--shadow);padding:16px;margin-bottom:14px;}
.panel > h2{font-size:.95rem;margin-bottom:10px;}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.hidden{display:none !important;}
.muted{color:var(--mut);}
.small{font-size:.78rem;}

/* ---- tiles ---- */
.tile{background:#fff;border:2px solid var(--line);border-radius:14px;padding:12px 14px;}
.tile .label{font-size:.72rem;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;}
.tile .value{font-size:1.5rem;font-weight:800;margin-top:2px;line-height:1.1;}
.tile .sub{font-size:.75rem;color:var(--mut);margin-top:2px;}
.tile.good .value{color:var(--good);} .tile.bad .value{color:var(--bad);} .tile.warn .value{color:var(--warn);}

/* ---- controls ---- */
input,select,textarea,button{font:inherit;color:var(--ink);}
input,select,textarea{background:#fff;border:2px solid var(--line);border-radius:10px;padding:8px 10px;width:100%;}
textarea{resize:vertical;min-height:90px;}
label{display:block;font-size:.75rem;color:var(--mut);font-weight:800;margin:8px 0 3px;
  text-transform:uppercase;letter-spacing:.3px;}
.btn{border:2px solid var(--line);background:#fff;border-radius:10px;padding:8px 14px;
  font-weight:800;cursor:pointer;box-shadow:0 2px 0 var(--shadow);width:auto;}
.btn:hover{background:#fffaf0;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn.primary{background:var(--ink);color:#fff9ea;border-color:var(--ink);}
.btn.danger{background:var(--bad);color:#fff;border-color:var(--bad);}
.btn.tiny{padding:4px 9px;font-size:.75rem;box-shadow:none;}

/* ---- tables ---- */
table{width:100%;border-collapse:collapse;font-size:.82rem;}
th{text-align:left;color:var(--mut);font-size:.7rem;text-transform:uppercase;
  letter-spacing:.4px;padding:6px 8px;border-bottom:2px solid var(--line);}
td{padding:7px 8px;border-bottom:1px solid #f0e4c8;vertical-align:top;}
tr:last-child td{border-bottom:none;}
.scroll-x{overflow-x:auto;}

/* ---- badges + banners ---- */
.badge{display:inline-block;border-radius:999px;padding:2px 9px;font-size:.7rem;font-weight:800;
  border:1.5px solid var(--line);background:#fff;white-space:nowrap;}
.badge.good{background:#e7f7ef;color:#20724a;border-color:#b9e5cd;}
.badge.bad{background:#fdeaf3;color:#a02f63;border-color:#f4c2da;}
.badge.warn{background:#fdf1dc;color:#8a5d12;border-color:#f0d6a3;}
.badge.info{background:#e9f1fc;color:#2b5c96;border-color:#c3d9f3;}
.banner{border-radius:12px;padding:10px 14px;margin-bottom:12px;font-weight:700;border:2px solid;}
.banner.bad{background:#fdeaf3;border-color:#f4c2da;color:#a02f63;}
.banner.warn{background:#fdf1dc;border-color:#f0d6a3;color:#8a5d12;}
.banner.good{background:#e7f7ef;border-color:#b9e5cd;color:#20724a;}

/* ---- logs ---- */
.logbox{background:#2b2318;color:#f3e6cd;border-radius:12px;padding:10px 12px;
  max-height:460px;overflow:auto;font-size:.76rem;line-height:1.5;}
.logbox .line{white-space:pre-wrap;word-break:break-word;border-bottom:1px solid #3a3024;padding:2px 0;}
.logbox .line:last-child{border-bottom:none;}
.logbox .t{color:#9c8a6d;margin-right:8px;}
.logbox .lv-error{color:#ff9ec4;} .logbox .lv-warn{color:#f0c274;} .logbox .lv-info,.logbox .lv-log{color:#f3e6cd;}

/* ---- calendar board ---- */
.board{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}
.card{background:#fff;border:2px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;}
.card:hover{border-color:var(--ink-dim);}
.card .when{font-size:.7rem;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;}
.card .title{font-weight:800;margin:3px 0 5px;line-height:1.25;}
.card .meta{display:flex;gap:5px;flex-wrap:wrap;}

/* ---- modal ---- */
.overlay{position:fixed;inset:0;background:rgba(45,35,22,.55);display:flex;
  align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto;z-index:50;}
.modal{background:var(--panel);border:2px solid var(--line);border-radius:16px;
  box-shadow:0 6px 0 var(--shadow);padding:18px;max-width:720px;width:100%;}

/* ---- login ---- */
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.login-card{background:var(--panel);border:2px solid var(--line);border-radius:18px;
  box-shadow:0 4px 0 var(--shadow);padding:26px;max-width:400px;width:100%;}
.login-card h1{font-size:1.2rem;margin-bottom:4px;}
.err{color:var(--bad);font-weight:800;font-size:.82rem;margin-top:10px;min-height:1.1em;}
.ok{color:var(--good);font-weight:800;font-size:.82rem;margin-top:10px;min-height:1.1em;}
`;
