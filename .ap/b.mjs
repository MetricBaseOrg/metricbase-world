import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e;
function house(){
  const W=64,H=72,cx=W/2,baseY=H-18,hw=24,hh=12,wallH=22,roofH=16;
  const fE=[cx+hw,baseY],fS=[cx,baseY+hh],fW=[cx-hw,baseY];
  const tN=[cx,baseY-hh-wallH],tE=[cx+hw,baseY-wallH],tS=[cx,baseY+hh-wallH],tW=[cx-hw,baseY-wallH];
  const apex=[cx,baseY-wallH-roofH];const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
  const poly=(pts,fill)=>{g.fillStyle(fill,1);g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();g.fillPath();};
  const outline=(pts,close=true)=>{g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);if(close)g.closePath();g.strokePath();};
  g.fillStyle(0x2a1d12,0.22).fillEllipse(cx,baseY+hh+2,hw*2,10);
  poly([fW,fS,tS,tW],0xcdb791);poly([fS,fE,tE,tS],0xead9b8);outline([fW,fS,tS,tW]);outline([fS,fE,tE,tS]);
  poly([tN,tW,apex],0x3a6fd0);poly([tN,tE,apex],0x4f8cff);poly([tW,tS,apex],0x3a6fd0);poly([tS,tE,apex],0x4f8cff);
  outline([tW,apex,tE]);outline([tS,apex],false);outline([tW,tS,tE],false);
  const dbl=lerp(fS,fE,0.34),dbr=lerp(fS,fE,0.62);const door=[dbl,dbr,[dbr[0],dbr[1]-14],[dbl[0],dbl[1]-14]];poly(door,0x7a5236);outline(door);
  const wbl=lerp(fW,fS,0.4),wbr=lerp(fW,fS,0.62);const win=[[wbl[0],wbl[1]-7],[wbr[0],wbr[1]-7],[wbr[0],wbr[1]-14],[wbl[0],wbl[1]-14]];poly(win,0xbfe3ff);outline(win);
  return s;
}
const cv=createCanvas(120,90);const ctx=cv.getContext("2d");ctx.fillStyle="#8ed666";ctx.fillRect(0,0,120,90);
ctx.drawImage(house(),28,8);
writeFileSync("b.png",cv.toBuffer("image/png"));console.log("ok");
