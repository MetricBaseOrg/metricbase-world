import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e;
// iso building (mirrors BootScene)
function housing(fnName){
  const W=64,H=72,cx=W/2,baseY=H-18,hw=24,hh=12,wallH=22,roofH=16;
  const fE=[cx+hw,baseY],fS=[cx,baseY+hh],fW=[cx-hw,baseY];
  const tN=[cx,baseY-hh-wallH],tE=[cx+hw,baseY-wallH],tS=[cx,baseY+hh-wallH],tW=[cx-hw,baseY-wallH];
  const apex=[cx,baseY-wallH-roofH];
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const s=createCanvas(W,H); const g=mk(s.getContext("2d"));
  const poly=(pts,fill)=>{g.fillStyle(fill,1);g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();g.fillPath();};
  const outline=(pts,close=true)=>{g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);if(close)g.closePath();g.strokePath();};
  const build=(roof,roofD,accent)=>{g.fillStyle(0x2a1d12,0.22).fillEllipse(cx,baseY+hh+2,hw*2,10);poly([fW,fS,tS,tW],0xcdb791);poly([fS,fE,tE,tS],0xead9b8);outline([fW,fS,tS,tW]);outline([fS,fE,tE,tS]);poly([tN,tW,apex],roofD);poly([tN,tE,apex],roofD);poly([tW,tS,apex],roof);poly([tS,tE,apex],roofD);outline([tW,apex,tE]);outline([tS,apex],false);outline([tW,tS,tE],false);accent();};
  if(fnName==="house") build(0x4f8cff,0x3a6fd0,()=>{const dbl=lerp(fS,fE,0.34),dbr=lerp(fS,fE,0.62);const door=[dbl,dbr,[dbr[0],dbr[1]-14],[dbl[0],dbl[1]-14]];poly(door,0x7a5236);outline(door);const wbl=lerp(fW,fS,0.4),wbr=lerp(fW,fS,0.62);const win=[[wbl[0],wbl[1]-7],[wbr[0],wbr[1]-7],[wbr[0],wbr[1]-14],[wbl[0],wbl[1]-14]];poly(win,0xbfe3ff);outline(win);});
  if(fnName==="shop") build(0xe07a3c,0xb85f2a,()=>{const dbl=lerp(fS,fE,0.3),dbr=lerp(fS,fE,0.56);const door=[dbl,dbr,[dbr[0],dbr[1]-13],[dbl[0],dbl[1]-13]];poly(door,0x7a5236);outline(door);for(let i=0;i<5;i++){const a=lerp(fS,fE,i/5),b=lerp(fS,fE,(i+1)/5);poly([[a[0],a[1]-wallH+4],[b[0],b[1]-wallH+4],[b[0],b[1]-wallH-2],[a[0],a[1]-wallH-2]],i%2===0?0xe2483b:0xfff1e0);}g.fillStyle(0xf2c94c,1).fillCircle(tE[0]-2,tE[1]-4,4);g.lineStyle(1.5,OUTLINE,1).strokeCircle(tE[0]-2,tE[1]-4,4);});
  if(fnName==="marker"){g.fillStyle(0x2a1d12,0.16).fillEllipse(cx,baseY+hh+2,hw*2,9);poly([[cx,baseY-hh],fE,fS,fW],0x9b8a6a);outline([[cx,baseY-hh],fE,fS,fW]);g.fillStyle(0x8a5a33,1).fillRoundedRect(cx-2,baseY-26,4,24,1.5);g.lineStyle(1.5,OUTLINE,1).strokeRoundedRect(cx-2,baseY-26,4,24,1.5);g.fillStyle(0xf3ead2,1).fillRoundedRect(cx-13,baseY-32,26,13,2);g.lineStyle(2,OUTLINE,1).strokeRoundedRect(cx-13,baseY-32,26,13,2);g.fillStyle(0x4caf50,1).fillRoundedRect(cx-9,baseY-28,18,2.4,1);g.fillStyle(0x4caf50,1).fillRoundedRect(cx-9,baseY-24,12,2.4,1);}
  return s;
}
function farm(stage){
  const W=56,H=40,cx=W/2,cy=20,hw=24,hh=12;
  const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
  const dia=(c)=>{g.fillStyle(c,1);g.beginPath();g.moveTo(cx,cy-hh);g.lineTo(cx+hw,cy);g.lineTo(cx,cy+hh);g.lineTo(cx-hw,cy);g.closePath();g.fillPath();};
  const spot=(i,n)=>{const t=(i+0.5)/n-0.5;return{x:cx+t*hw*1.4,y:cy+t*hh*1.4};};
  dia(0x6b4a2f);g.lineStyle(1.5,0x573b25,1);for(const k of[-1,0,1]){const ox=k*-hw*0.3,oy=k*hh*0.3;g.beginPath();g.moveTo(cx-hw*0.55+ox,cy-hh*0.55+oy);g.lineTo(cx+hw*0.55+ox,cy+hh*0.55+oy);g.strokePath();}
  g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(cx,cy-hh);g.lineTo(cx+hw,cy);g.lineTo(cx,cy+hh);g.lineTo(cx-hw,cy);g.closePath();g.strokePath();
  if(stage==="growing")for(let i=0;i<3;i++){const p=spot(i,3);g.lineStyle(2,0x4caf50,1);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y-8);g.strokePath();g.fillStyle(0x66bb6a,1).fillCircle(p.x-2,p.y-8,2).fillCircle(p.x+2,p.y-9,2);}
  if(stage==="ready")for(let i=0;i<4;i++){const p=spot(i,4);g.lineStyle(2,0xc79a3a,1);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y-12);g.strokePath();g.fillStyle(0xf2c94c,1).fillEllipse(p.x,p.y-13,4,7);}
  return s;
}
const cv=createCanvas(460,130);const ctx=cv.getContext("2d");ctx.fillStyle="#8ed666";ctx.fillRect(0,0,460,130);
["house","shop","marker"].forEach((n,i)=>ctx.drawImage(housing(n),10+i*72,4));
["empty","growing","ready"].forEach((n,i)=>ctx.drawImage(farm(n),240+i*70,70));
writeFileSync("iso.png",cv.toBuffer("image/png"));console.log("ok");
