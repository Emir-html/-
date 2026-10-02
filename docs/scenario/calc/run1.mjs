import { run, optimal } from "./sim1.mjs";
const N=200; const agg={}; const buys={};
for(let s=1;s<=N;s++){const {log}=run({seed:s,strategy:optimal});
 for(const e of log){ if(e.buy){(buys[e.buy]??=[]).push(e.day);continue;} (agg[e.day]??={p:0,c:0,r:0}); agg[e.day].p+=e.profit/N; agg[e.day].c+=e.cash/N; agg[e.day].r+=e.rep/N;}}
for(const d in agg) console.log(d, Math.round(agg[d].p), Math.round(agg[d].c), agg[d].r.toFixed(3));
for(const b in buys){const a=buys[b].sort((x,y)=>x-y); console.log(b, 'доля купивших', (a.length/N).toFixed(2), 'медиана дня', a[Math.floor(a.length/2)]);}
