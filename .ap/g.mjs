import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e;
function build(kind){
  const W=176,H=156,cx=W/2,baseY=104,hw=84,hh=42,wallH=40,ridgeH=40;
  const fE=[cx+hw,baseY],fS=[cx,baseY+hh],fW=[cx-hw,baseY];
  const tE=[cx+hw,baseY-wallH],tS=[cx,baseY+hh-wallH],tW=[cx-hw,baseY-wallH],tN=[cx,baseY-hh-wallH];
  const ridgeS=[(tS[0]+tE[0])/2,(tS[1]+tE[1])/2-ridgeH],ridgeN=[(tW[0]+tN[0])/2,(tW[1]+tN[1])/2-ridgeH];
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
  const poly=(p,f)=>{g.fillStyle(f,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fillPath();};
  const ol=(p,c=true)=>{g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);if(c)g.closePath();g.strokePath();};
  const [roof,rd]= kind==="shop"?[0xe07a3c,0xb85f2a]:[0x4f8cff,0x3a6fd0];
  g.fillStyle(0x2a1d12,0.22).fillEllipse(cx,baseY+hh+2,hw*2,10);
  poly([fW,fS,tS,tW],0xcdb791);poly([fS,fE,tE,tS],0xead9b8);ol([fW,fS,tS,tW]);ol([fS,fE,tE,tS]);
  poly([tN,tE,ridgeS,ridgeN],rd);poly([tW,tS,ridgeS,ridgeN],roof);poly([tS,tE,ridgeS],rd);
  ol([tW,tS,ridgeS,ridgeN]);ol([tS,tE,ridgeS]);ol([ridgeN,ridgeS],false);
  if(kind==="house"){const dbl=lerp(fS,fE,0.38),dbr=lerp(fS,fE,0.6);const door=[dbl,dbr,[dbr[0],dbr[1]-28],[dbl[0],dbl[1]-28]];poly(door,0x7a5236);ol(door);
    const a=lerp(fS,fE,0.66),b=lerp(fS,fE,0.86);const sw=[[a[0],a[1]-16],[b[0],b[1]-16],[b[0],b[1]-30],[a[0],a[1]-30]];poly(sw,0xbfe3ff);ol(sw);
    const wbl=lerp(fW,fS,0.32),wbr=lerp(fW,fS,0.56);const win=[[wbl[0],wbl[1]-18],[wbr[0],wbr[1]-18],[wbr[0],wbr[1]-32],[wbl[0],wbl[1]-32]];poly(win,0xbfe3ff);ol(win);}
  if(kind==="shop"){const dbl=lerp(fS,fE,0.34),dbr=lerp(fS,fE,0.56);const door=[dbl,dbr,[dbr[0],dbr[1]-28],[dbl[0],dbl[1]-28]];poly(door,0x7a5236);ol(door);for(let i=0;i<6;i++){const a=lerp(fS,fE,i/6),b=lerp(fS,fE,(i+1)/6);poly([[a[0],a[1]-wallH+12],[b[0],b[1]-wallH+12],[b[0],b[1]-wallH-3],[a[0],a[1]-wallH-3]],i%2===0?0xe2483b:0xfff1e0);}const a0=lerp(fS,fE,0),a1=lerp(fS,fE,1);ol([[a0[0],a0[1]-wallH+12],[a1[0],a1[1]-wallH+12],[a1[0],a1[1]-wallH-3],[a0[0],a0[1]-wallH-3]]);}
  return s;
}
const cv=createCanvas(384,176);const c=cv.getContext("2d");c.fillStyle="#8ed666";c.fillRect(0,0,384,176);
c.drawImage(build("house"),8,8);c.drawImage(build("shop"),200,8);
writeFileSync("g.png",cv.toBuffer("image/png"));console.log("ok");
