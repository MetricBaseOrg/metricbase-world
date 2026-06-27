import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e, R=0x4f8cff, RD=0x3a6fd0;
function base(g,lerp,fW,fS,fE,tW,tS,tE){
  const poly=(p,f)=>{g.fillStyle(f,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fillPath();};
  const ol=(p,c=true)=>{g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);if(c)g.closePath();g.strokePath();};
  poly([fW,fS,tS,tW],0xcdb791);poly([fS,fE,tE,tS],0xead9b8);ol([fW,fS,tS,tW]);ol([fS,fE,tE,tS]);
  const dbl=lerp(fS,fE,0.38),dbr=lerp(fS,fE,0.6);const door=[dbl,dbr,[dbr[0],dbr[1]-28],[dbl[0],dbl[1]-28]];poly(door,0x7a5236);ol(door);
  return {poly,ol};
}
function house(kind){
  const W=176,H=148,cx=W/2,baseY=98,hw=84,hh=42,wallH=40;
  const fE=[cx+hw,baseY],fS=[cx,baseY+hh],fW=[cx-hw,baseY];
  const tE=[cx+hw,baseY-wallH],tS=[cx,baseY+hh-wallH],tW=[cx-hw,baseY-wallH],tN=[cx,baseY-hh-wallH];
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
  const {poly,ol}=base(g,lerp,fW,fS,fE,tW,tS,tE);
  if(kind==="A"){const apex=[cx,baseY-wallH-32];poly([tW,tS,apex],RD);poly([tS,tE,apex],R);ol([tW,apex,tE]);ol([tS,apex],false);ol([tW,tS,tE],false);}
  if(kind==="B"){const apex=[cx,baseY-wallH-58];poly([tW,tS,apex],RD);poly([tS,tE,apex],R);ol([tW,apex,tE]);ol([tS,apex],false);ol([tW,tS,tE],false);}
  if(kind==="C"){ // gable, ridge along NW-SE; big slope faces SE (down-right) + left gable
    const rh=40; const m1=[(tW[0]+tS[0])/2,(tW[1]+tS[1])/2-rh]; const m3=[(tE[0]+tN[0])/2,(tE[1]+tN[1])/2-rh];
    poly([tW,tN,m3,m1],RD); // NW slope (back, darker) partially
    poly([tS,tE,m3,m1],R);  // SE slope (front, lighter)
    poly([tW,tS,m1],RD);    // SW gable triangle
    ol([tS,tE,m3,m1]); ol([tW,tS,m1]); ol([m1,m3],false);
  }
  if(kind==="D"){ // gable, ridge along SW-NE; big slope faces SW (down-left) + right gable
    const rh=40; const m1=[(tS[0]+tE[0])/2,(tS[1]+tE[1])/2-rh]; const m3=[(tW[0]+tN[0])/2,(tW[1]+tN[1])/2-rh];
    poly([tN,tE,m1,m3],RD);
    poly([tW,tS,m1,m3],R);
    poly([tS,tE,m1],RD);
    ol([tW,tS,m1,m3]); ol([tS,tE,m1]); ol([m1,m3],false);
  }
  return s;
}
const labels={A:"A: current hip",B:"B: tall hip",C:"C: gable / SE slope",D:"D: gable / SW slope"};
const cv=createCanvas(384,320);const c=cv.getContext("2d");c.fillStyle="#8ed666";c.fillRect(0,0,384,320);
c.font="bold 13px sans-serif";c.fillStyle="#234";c.textAlign="center";
[["A",0,0],["B",1,0],["C",0,1],["D",1,1]].forEach(([k,col,row])=>{c.drawImage(house(k),col*192+8,row*150+6);c.fillText(labels[k],col*192+96,row*150+150);});
writeFileSync("opt.png",cv.toBuffer("image/png"));console.log("ok");
