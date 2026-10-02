import { run, optimal } from "./sim1.mjs";
import * as L from "./l1.mjs";
const buy=["analyst","helper","fridge","coffee","sign","office"];
const student=(err)=>(st,day,pt,ms,opt)=>opt.rows.map(r=>({P:Math.round(r.P*(1+err)),orderMult:1}));
function rep(name,strategy,N=200){const agg={},buys={};let ex=0;
 for(let s=1;s<=N;s++){const {log}=run({seed:s,strategy,buy});
  for(const e of log){ if(e.buy){(buys[e.buy]??=[]).push(e.day);continue;} (agg[e.day]??={p:0,c:0,r:0}); agg[e.day].p+=e.profit/N; agg[e.day].c+=e.cash/N; agg[e.day].r+=e.rep/N; if(e.day>=22) ex+=e.profit/N;}}
 console.log("\n==",name); console.log(Object.entries(agg).map(([d,a])=>`${d}:${Math.round(a.p)}/${Math.round(a.c)}/${a.r.toFixed(2)}`).join("  "));
 for(const b in buys){const a=buys[b].sort((x,y)=>x-y); console.log(" ",b,(a.length/N).toFixed(2),'день≈',a[Math.floor(a.length/2)]);}
 console.log(" прибыль экзамена 22–24:",Math.round(ex));}
rep("оптимум",optimal);
rep("ученик +10% цена, закупка 100%",student(0.10));
rep("ученик −10%",student(-0.10));
