import { P3, prodCost, optimum3 } from "./l3.mjs";
const f=(x,d=1)=>x==null?'-':(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const S={aMult:{N:0.8},bMult:{N:1.1}};
const run=(t,day,o)=>{const b=optimum3(day,{step:0.5,...o}); const m=Math.max(b.pc.mc1,b.pc.mc2);
 const mrN=b.dem.N?(b.dem.N.A-2*b.qn)/b.dem.N.B:null;
 console.log(`${t} [д${day}]: N ${f(b.qn)}×${f(b.PN)} (λN ${f(mrN!=null?mrN-m:null)}), T ${f(b.qt)}×${f(b.PT)} | к1 ${f(b.pc.q1)} к2 ${f(b.pc.q2)} Зоя ${f(b.pc.z)} MC ${f(m)} | маржа ${f(b.pi,0)}`); return b;};
run("Зоя 38, с Семёном, обе кухни",17,{...S,zoya:38});
run("Зоя 38, кухня1 закрыта",17,{...S,zoya:38,kitchens:{k1:{...P3.kitchens.k1,max:0},k2:P3.kitchens.k2}});
run("Зоя 34, кухня1 закрыта",17,{...S,kitchens:{k1:{...P3.kitchens.k1,max:0},k2:P3.kitchens.k2}});
run("Зоя 34, обе",17,S);
run("Кира: N A×0,88 (с Семёном) сб",13,{aMult:{N:0.88},bMult:{N:1.1}});
run("Кира вс",14,{aMult:{N:0.88},bMult:{N:1.1}});
run("сб без Киры",13,S);
run("вс без Киры",14,S);
run("пн д15 с Семёном",15,S);
run("сб д20 с Семёном",20,S);
run("пт д19",19,S);
// A/B эксперимент: в T скидка 10% на один день — какой отклик Q? при P=80 Q=100 (огранич K=100!) — используем Набережную? 
{const A=300,B=2.5; for (const P of [80,72]) console.log("T: P",P,"Q",A-B*P,"|E|",f(B*P/(A-B*P),3));}
{const A=320,B=2.2; for (const P of [89.8,80.8]) console.log("N(Семён): P",P,"Q",f(A-B*P),"|E|",f(B*P/(A-B*P),3));}
