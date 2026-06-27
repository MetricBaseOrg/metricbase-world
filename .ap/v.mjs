import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e;
const W=176,H=124,cx=W/2,baseY=78,hw=84,hh=42,wallH=40,roofH=32;
const fE=[cx+hw,baseY],fS=[cx,baseY+hh],fW=[cx-hw,baseY];
const tN=[cx,baseY-hh-wallH],tE=[cx+hw,baseY-wallH],tS=[cx,baseY+hh-wallH],tW=[cx-hw,baseY-wallH];
const apex=[cx,baseY-wallH-roofH];const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function bldg(kind){const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
 const poly=(p,f)=>{g.fillStyle(f,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fillPath();};
 const ol=(p,c=true)=>{g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);if(c)g.closePath();g.strokePath();};
 const build=(roof,rd,acc)=>{g.fillStyle(0x2a1d12,0.22).fillEllipse(cx,baseY+hh+2,hw*2,10);poly([fW,fS,tS,tW],0xcdb791);poly([fS,fE,tE,tS],0xead9b8);ol([fW,fS,tS,tW]);ol([fS,fE,tE,tS]);poly([tN,tW,apex],rd);poly([tN,tE,apex],roof);poly([tW,tS,apex],rd);poly([tS,tE,apex],roof);ol([tW,apex,tE]);ol([tS,apex],false);ol([tW,tS,tE],false);acc();};
 if(kind==="house")build(0x4f8cff,0x3a6fd0,()=>{const dbl=lerp(fS,fE,0.38),dbr=lerp(fS,fE,0.6);const door=[dbl,dbr,[dbr[0],dbr[1]-28],[dbl[0],dbl[1]-28]];poly(door,0x7a5236);ol(door);g.fillStyle(0xf2c94c,1).fillCircle(dbr[0]-4,dbr[1]-13,1.8);const a=lerp(fS,fE,0.66),b=lerp(fS,fE,0.86);const sw=[[a[0],a[1]-16],[b[0],b[1]-16],[b[0],b[1]-30],[a[0],a[1]-30]];poly(sw,0xbfe3ff);ol(sw);const wbl=lerp(fW,fS,0.32),wbr=lerp(fW,fS,0.56);const win=[[wbl[0],wbl[1]-18],[wbr[0],wbr[1]-18],[wbr[0],wbr[1]-32],[wbl[0],wbl[1]-32]];poly(win,0xbfe3ff);ol(win);});
 if(kind==="shop")build(0xe07a3c,0xb85f2a,()=>{const dbl=lerp(fS,fE,0.34),dbr=lerp(fS,fE,0.56);const door=[dbl,dbr,[dbr[0],dbr[1]-28],[dbl[0],dbl[1]-28]];poly(door,0x7a5236);ol(door);for(let i=0;i<6;i++){const a=lerp(fS,fE,i/6),b=lerp(fS,fE,(i+1)/6);poly([[a[0],a[1]-wallH+12],[b[0],b[1]-wallH+12],[b[0],b[1]-wallH-3],[a[0],a[1]-wallH-3]],i%2===0?0xe2483b:0xfff1e0);}const a0=lerp(fS,fE,0),a1=lerp(fS,fE,1);ol([[a0[0],a0[1]-wallH+12],[a1[0],a1[1]-wallH+12],[a1[0],a1[1]-wallH-3],[a0[0],a0[1]-wallH-3]]);g.fillStyle(0xf2c94c,1).fillCircle(tE[0]-6,tE[1]-8,7);g.lineStyle(2,OUTLINE,1).strokeCircle(tE[0]-6,tE[1]-8,7);});
 if(kind==="marker"){g.fillStyle(0x2a1d12,0.16).fillEllipse(cx,baseY+hh+2,hw*2,9);poly([[cx,baseY-hh],fE,fS,fW],0x9b8a6a);ol([[cx,baseY-hh],fE,fS,fW]);g.fillStyle(0x8a5a33,1).fillRoundedRect(cx-3,baseY-46,6,44,2);g.lineStyle(1.5,OUTLINE,1).strokeRoundedRect(cx-3,baseY-46,6,44,2);g.fillStyle(0xf3ead2,1).fillRoundedRect(cx-21,baseY-58,42,21,3);g.lineStyle(2,OUTLINE,1).strokeRoundedRect(cx-21,baseY-58,42,21,3);g.fillStyle(0x4caf50,1).fillRoundedRect(cx-15,baseY-52,30,4,1.5);g.fillStyle(0x4caf50,1).fillRoundedRect(cx-15,baseY-45,20,4,1.5);}
 return s;}
function farm(stage){const W=128,H=76,cx=W/2,cy=40,hw=58,hh=29;const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
 const dia=(c)=>{g.fillStyle(c,1);g.beginPath();g.moveTo(cx,cy-hh);g.lineTo(cx+hw,cy);g.lineTo(cx,cy+hh);g.lineTo(cx-hw,cy);g.closePath();g.fillPath();};
 const crops=(per)=>{const o=[];for(const r of[-0.5,0.5]){const ox=r*-hw*0.34,oy=r*hh*0.34;for(let i=0;i<per;i++){const t=(i+0.5)/per-0.5;o.push({x:cx+t*hw*1.1+ox,y:cy+t*hh*1.1+oy});}}return o;};
 dia(0x6b4a2f);g.lineStyle(1.5,0x573b25,1);for(const k of[-1,0,1]){const ox=k*-hw*0.3,oy=k*hh*0.3;g.beginPath();g.moveTo(cx-hw*0.55+ox,cy-hh*0.55+oy);g.lineTo(cx+hw*0.55+ox,cy+hh*0.55+oy);g.strokePath();}
 g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(cx,cy-hh);g.lineTo(cx+hw,cy);g.lineTo(cx,cy+hh);g.lineTo(cx-hw,cy);g.closePath();g.strokePath();
 if(stage==="growing")for(const p of crops(3)){g.lineStyle(2,0x4caf50,1);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y-9);g.strokePath();g.fillStyle(0x66bb6a,1).fillCircle(p.x-2,p.y-9,2).fillCircle(p.x+2,p.y-10,2);}
 if(stage==="ready")for(const p of crops(3)){g.lineStyle(2,0xc79a3a,1);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y-13);g.strokePath();g.fillStyle(0xf2c94c,1).fillEllipse(p.x,p.y-14,4,7);}
 return s;}
const cv=createCanvas(560,320);const ctx=cv.getContext("2d");ctx.fillStyle="#8ed666";ctx.fillRect(0,0,560,320);
["house","shop","marker"].forEach((k,i)=>ctx.drawImage(bldg(k),8+i*184,6));
["empty","growing","ready"].forEach((k,i)=>ctx.drawImage(farm(k),20+i*180,200));
writeFileSync("v.png",cv.toBuffer("image/png"));console.log("ok");
