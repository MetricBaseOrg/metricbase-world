import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e;
function house(wallH,roofH,backFaces){
  const W=176,H=124,cx=W/2,baseY=78,hw=84,hh=42;
  const fE=[cx+hw,baseY],fS=[cx,baseY+hh],fW=[cx-hw,baseY];
  const tN=[cx,baseY-hh-wallH],tE=[cx+hw,baseY-wallH],tS=[cx,baseY+hh-wallH],tW=[cx-hw,baseY-wallH];
  const apex=[cx,baseY-wallH-roofH];
  const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
  const poly=(p,f)=>{g.fillStyle(f,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fillPath();};
  const ol=(p,c=true)=>{g.lineStyle(2,OUTLINE,1);g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);if(c)g.closePath();g.strokePath();};
  poly([fW,fS,tS,tW],0xcdb791);poly([fS,fE,tE,tS],0xead9b8);ol([fW,fS,tS,tW]);ol([fS,fE,tE,tS]);
  if(backFaces){poly([tN,tW,apex],0x3a6fd0);poly([tN,tE,apex],0x4f8cff);}
  poly([tW,tS,apex],0x3a6fd0);poly([tS,tE,apex],0x4f8cff);
  ol([tW,apex,tE]);ol([tS,apex],false);ol([tW,tS,tE],false);
  return s;
}
const cv=createCanvas(380,150);const c=cv.getContext("2d");c.fillStyle="#8ed666";c.fillRect(0,0,380,150);
c.drawImage(house(40,32,true),10,12);   // current
c.drawImage(house(40,32,false),200,12);  // front-only tent
writeFileSync("r.png",cv.toBuffer("image/png"));console.log("ok");
