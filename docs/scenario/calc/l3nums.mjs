import { P3, prodCost, optimum3 } from "./l3.mjs";
const f=(x,d=1)=>x==null?'-':(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const show=(t,day,o={})=>{const b=optimum3(day,{step:0.5,...o});const pc=b.pc;
 const fixedK=P3.kitchens.k1.F+P3.kitchens.k2.F; const cafesFC=(o.cafes||["N","T"]).reduce((s,id)=>s+P3.cafes[id].rent+P3.cafes[id].barista,0);
 const mrN=b.dem.N?(b.dem.N.A-2*b.qn)/b.dem.N.B:null, mrT=b.dem.T?(b.dem.T.A-2*b.qt)/b.dem.T.B:null;
 console.log(`${t} [д${day}]: N ${f(b.qn)} по ${f(b.PN,1)} (MR ${f(mrN,1)}), T ${f(b.qt)} по ${f(b.PT,1)} (MR ${f(mrT,1)}) | кухня1 ${f(pc.q1)} (MC ${f(pc.mc1,1)}), кухня2 ${f(pc.q2)} (MC ${f(pc.mc2,1)}), Зоя ${f(pc.z)}, скидка ${pc.cut} | выручка ${f(b.R,0)} перем ${f(pc.cost,0)} маржа ${f(b.pi,0)} − FC ${fixedK+cafesFC} = ${f(b.pi-fixedK-cafesFC,0)}`); return b;};
show("Будни, база",1);
show("Будни без Зои",1,{zoya:null});
show("Будни без скидок",1,{tiers:false});
show("Суббота",6);
show("Воскресенье",7);
show("Пятница",5);
show("Будни, N без ограничения мест",1,{K:{N:999,T:999}});
show("Сб, N без ограничения",6,{K:{N:999,T:999}});
show("Будни, кофейня Семёна (N: A×0,8, B×1,1)",9,{aMult:{N:0.8},bMult:{N:1.1}});
show("Сб, кофейня Семёна",13,{aMult:{N:0.8},bMult:{N:1.1}});
show("Будни Семён, только N",9,{aMult:{N:0.8},bMult:{N:1.1},cafes:["N"]});
show("Будни, только N",1,{cafes:["N"]});
// «поровну»
for (const Q of [270,280]) {const half=Q/2; const k=P3.kitchens; const c=(q,kk,cut)=> (kk.c-cut)*q+kk.d*q*q/2; const cut=2; const eq=c(half,k.k1,cut)+c(half,k.k2,cut); const opt=prodCost(Q,{zoya:null}); console.log(`Q=${Q}: поровну ${f(eq,0)} (MC1 ${f(k.k1.c-cut+k.k1.d*half,1)}, MC2 ${f(k.k2.c-cut+k.k2.d*half,1)}) vs оптимум без Зои ${f(opt.cost,0)} (q1 ${f(opt.q1)} q2 ${f(opt.q2)})`);}
// AC kitchens
for (const kk of [P3.kitchens.k1,P3.kitchens.k2]) {const qmin=Math.sqrt(2*kk.F/kk.d); console.log(kk.name,"min AC при q=",f(qmin),"AC=",f(kk.F/qmin+kk.c+kk.d*qmin/2,2), "AVC min =", kk.c);}
