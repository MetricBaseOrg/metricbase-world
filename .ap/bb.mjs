import { createRequire } from "module"; import { writeFileSync } from "fs"; import { mk } from "./shim.mjs";
const { createCanvas } = createRequire(import.meta.url)("@napi-rs/canvas");
const OUTLINE=0x3a2a1e,W=150,H=124,cx=W/2;
const s=createCanvas(W,H);const g=mk(s.getContext("2d"));
g.fillStyle(0x2a1d12,0.2).fillEllipse(cx,H-4,96,12);
for(const px of[cx-42,cx+34]){g.fillStyle(0x8a5a33,1).fillRoundedRect(px,56,8,62,2);g.lineStyle(2,OUTLINE,1).strokeRoundedRect(px,56,8,62,2);}
g.fillStyle(0xf6ecd6,1).fillRoundedRect(8,6,W-16,86,9);g.lineStyle(3,OUTLINE,1).strokeRoundedRect(8,6,W-16,86,9);
g.fillStyle(0x4f8cff,1).fillRoundedRect(14,12,W-28,24,6);g.lineStyle(2,OUTLINE,1).strokeRoundedRect(14,12,W-28,24,6);
g.lineStyle(1.5,0xd8c39a,1);g.beginPath();g.moveTo(18,64);g.lineTo(W-18,64);g.strokePath();
// overlay text approximating in-scene placement (top of board = y6, anchor offsets relative to board top)
const ctx=s.getContext("2d");ctx.textAlign="center";ctx.textBaseline="middle";
const t=(str,y,size,color,bold=true)=>{ctx.font=`${bold?"bold ":""}${size}px sans-serif`;ctx.fillStyle=color;ctx.fillText(str,cx,y);};
// in-scene: top=y-114; header top+24 => board y = 6+24-... approximate: header at 24, holdersLabel 44, holdersValue 56, onlineLabel 72, onlineValue 84 (relative to board top which is ~y10)
t("METRICBASE WORLD",24,11,"#ffffff");
t("$BASE HOLDERS",44,9,"#8a6d3b");
t("1,284",56,15,"#2a1d12");
t("PLAYERS ONLINE",72,9,"#3f7a4a");
t("7",84,15,"#2a1d12");
const cv=createCanvas(200,150);const c=cv.getContext("2d");c.fillStyle="#8ed666";c.fillRect(0,0,200,150);c.drawImage(s,25,14);
writeFileSync("bb.png",cv.toBuffer("image/png"));console.log("ok");
