import { P3, prodCost, optimum3 } from "./l3.mjs";
const f=(x,d=1)=>x==null?'-':(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const S={aMult:{N:0.8},bMult:{N:1.1}};
const run=(t,day,o)=>{const b=optimum3(day,{step:0.5,...o}); const m=Math.max(b.pc.mc1,b.pc.mc2);
 const mrN=b.dem.N?(b.dem.N.A-2*b.qn)/b.dem.N.B:null, mrT=b.dem.T?(b.dem.T.A-2*b.qt)/b.dem.T.B:null;
 console.log(`${t}: N ${f(b.qn)}×${f(b.PN)} (λN ${f(mrN!=null?mrN-m:null)}), T ${f(b.qt)}×${f(b.PT)} | к1 ${f(b.pc.q1)} к2 ${f(b.pc.q2)} Зоя ${f(b.pc.z)} MC ${f(m)} скидка ${b.pc.cut} | маржа ${f(b.pi,0)}`); return b;};
console.log("Экзамен 1 (пн, д22, с Семёном):"); const e1=run(" обе",22,S);
console.log("Экзамен 2 (сб? — нет, вт д23, фестиваль на Набережной: N k×1,3):"); const e2=run(" обе",23,{...S,kMult:{N:1.3}});
console.log("Экзамен 3 (ср д24, практика: T A×0,4):"); const e3a=run(" обе открыты",24,{aMult:{N:0.8,T:0.4},bMult:{N:1.1}}); const e3b=run(" T закрыта",24,{...S,cafes:["N"]});
console.log(" вклад T за день =",f(e3a.pi-e3b.pi,0),"против бариста 1500 → ",e3a.pi-e3b.pi>1500?"открыть":"не открывать");
const e1b=run(" (сравн.) д22 T закрыта",22,{...S,cafes:["N"]}); console.log(" вклад T в обычный день =",f(e1.pi-e1b.pi,0));
// поровну vs оптимум в день 1
{const Q=e1.qn+e1.qt; const k=P3.kitchens, cut=e1.pc.cut, h=Q/2; const cost=(k.k1.c-cut)*h+k.k1.d*h*h/2+(k.k2.c-cut)*h+k.k2.d*h*h/2; console.log(`Поровну при Q=${f(Q)}: ${f(cost,0)} vs ${f(e1.pc.cost,0)} → переплата ${f(cost-e1.pc.cost,0)}`);}
// T accounting
{const b=e1; const T=b.qt*b.PT; const avc=b.pc.cost/(b.qn+b.qt); const share=b.qt/(b.qn+b.qt)*5000; console.log(`T на бумаге: выручка ${f(T,0)}, перем. (по средней ${f(avc,2)}) ${f(b.qt*avc,0)}, аренда 2000, бариста 1500, доля кухонь ${f(share,0)}, ремонт 40000/20 = 2000 → ${f(T-b.qt*avc-2000-1500-share-2000,0)}`);}
