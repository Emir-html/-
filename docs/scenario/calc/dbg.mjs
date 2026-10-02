import * as L from "./l1.mjs";
const o={rep:{main:1.08,office:1.05},sign:true,supplier:false,events:[{pid:"croissant",aMult:1.3,bMult:0.75}]};
for(const pt of ["main","office"]){const ms=["lemonade","croissant","coffee","icecream"].map(p=>L.params(18,pt,p,o));const r=L.optimum(ms,220);
console.log(pt,"λ",r.lam.toFixed(2),"profit",Math.round(r.profit)); for(const x of r.rows) console.log(" ",x.pid,x.P.toFixed(1),x.Q.toFixed(1),Math.round(x.profit));}
