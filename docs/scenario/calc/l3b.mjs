import { P3, prodCost, optimum3 } from "./l3.mjs";
const f=(x,d=1)=>x==null?'-':(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const FC=13000;
const show=(t,day,o={})=>{const b=optimum3(day,{step:0.5,...o});const pc=b.pc;
 const mrN=b.dem.N?(b.dem.N.A-2*b.qn)/b.dem.N.B:null, mrT=b.dem.T?(b.dem.T.A-2*b.qt)/b.dem.T.B:null; const m=Math.max(pc.mc1,pc.mc2);
 console.log(`${t} [д${day}]: N ${f(b.qn)} по ${f(b.PN)} λN=${f(mrN!=null?mrN-m:null)} | T ${f(b.qt)} по ${f(b.PT)} λT=${f(mrT!=null?mrT-m:null)} | к1 ${f(b.pc.q1)} к2 ${f(b.pc.q2)} Зоя ${f(b.pc.z)} MC ${f(m)} скидка ${pc.cut} | маржа ${f(b.pi,0)} → прибыль ${f(b.pi-FC,0)}`); return b;};
const wk=(label,o)=>{let s=0;for(let d=1;d<=7;d++){const b=optimum3(d,{step:0.5,...o}); s+=b.pi;} return s;};
for (const d of [1,5,6,7]) show("база",d);
for (const d of [1,6]) show("терраса N+40",d,{K:{N:180,T:100}});
const w0=wk("",{}), w1=wk("",{K:{N:180,T:100}}); console.log("неделя маржа база",f(w0,0),"терраса",f(w1,0),"→ +",f(w1-w0,0),"в неделю, +",f((w1-w0)/7,0),"в день");
const ws0=wk("",{aMult:{N:0.8},bMult:{N:1.1}}), ws1=wk("",{aMult:{N:0.8},bMult:{N:1.1},K:{N:180,T:100}}); console.log("с Семёном неделя",f(ws0,0),"терраса",f(ws1,0),"→ +",f((ws1-ws0)/7,0),"в день");
for (const d of [9,13]) show("Семён",d,{aMult:{N:0.8},bMult:{N:1.1}});
show("Семён, только N",9,{aMult:{N:0.8},bMult:{N:1.1},cafes:["N"]});
show("Семён, только N сб",13,{aMult:{N:0.8},bMult:{N:1.1},cafes:["N"]});
// Эдуард занимает 10 оборотов N
show("Эдуард (N −10)",3,{K:{N:130,T:100}});
