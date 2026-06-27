import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e, W=46,H=30;
function soil(g){g.fillStyle(0x2a1d12,0.18).fillEllipse(W/2,H-4,W-6,8);g.fillStyle(0x6b4a2f,1).fillRoundedRect(4,4,W-8,H-8,4);g.lineStyle(2,OUTLINE,1).strokeRoundedRect(4,4,W-8,H-8,4);g.fillStyle(0x573b25,1);for(const fy of [H/2-4,H/2+2])g.fillRoundedRect(8,fy,W-16,2,1);}
function growing(g){soil(g);for(const sx of [W/2-10,W/2,W/2+10]){g.lineStyle(2,0x4caf50,1);g.beginPath();g.moveTo(sx,H/2+3);g.lineTo(sx,H/2-4);g.strokePath();g.fillStyle(0x66bb6a,1).fillCircle(sx-2,H/2-4,2).fillCircle(sx+2,H/2-5,2);}}
function ready(g){soil(g);for(const sx of [W/2-12,W/2-4,W/2+4,W/2+12]){g.lineStyle(2,0xc79a3a,1);g.beginPath();g.moveTo(sx,H/2+4);g.lineTo(sx,H/2-8);g.strokePath();g.fillStyle(0xf2c94c,1).fillEllipse(sx,H/2-9,4,7);g.lineStyle(1,OUTLINE,0.7).strokeEllipse(sx,H/2-9,4,7);}}
const cv=createCanvas(170,40);const ctx=cv.getContext("2d");ctx.fillStyle="#8ed666";ctx.fillRect(0,0,170,40);
[soil,growing,ready].forEach((fn,i)=>{const s=createCanvas(W,H);fn(mk(s.getContext("2d")));ctx.drawImage(s,6+i*55,6);});
writeFileSync("plots.png",cv.toBuffer("image/png"));console.log("ok");
