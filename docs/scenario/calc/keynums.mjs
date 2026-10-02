import * as L from "./l1.mjs";
const K0=120, KH=220;
const show=(title,day,point,pids,o,K)=>{const ms=pids.map(p=>L.params(day,point,p,o));const r=L.optimum(ms,K);
 console.log(`\n${title} [день ${day} ${L.WD[L.wd(day)]}, ${point}, K=${K}] λ=${L.fmt(r.lam,2)} (формула ${L.fmt(L.lamFormula(ms,K),2)}) прибыль(до аренды)=${L.fmt(r.profit,0)}`);
 for(const x of r.rows) console.log(`  ${x.pid}: A=${L.fmt(x.A,2)} B=${L.fmt(x.B,3)} MC=${x.mc} P*=${L.fmt(x.P,2)} Q*=${L.fmt(x.Q,2)} |E|=${x.E?L.fmt(x.E,3):'-'} MR=${L.fmt(2*x.P-x.choke,2)} маржа=${L.fmt(x.profit,0)}`);};
const LC=["lemonade","croissant"];
show("Будни парк",1,"main",LC,{},K0);
show("Пятница",5,"main",LC,{},K0);
show("Суббота",6,"main",LC,{},K0);
show("Воскресенье",7,"main",LC,{},K0);
show("Суббота с помощником",6,"main",LC,{},KH);
show("Мука +12 чт",4,"main",LC,{events:[{pid:"croissant",cAdd:12}]},K0);
show("Мука +12 пт",5,"main",LC,{events:[{pid:"croissant",cAdd:12}]},K0);
show("Жара будни без помощника",3,"main",LC,{events:[{pid:"lemonade",aMult:1.5}]},K0);
show("Жара сб с помощником",20,"main",LC,{events:[{pid:"lemonade",aMult:1.5}]},KH);
show("Потолок лимонад 37 сб с помощником",13,"main",LC,{events:[{pid:"lemonade",cap:37}]},KH);
show("Потолок лимонад 37 сб без помощника",13,"main",LC,{events:[{pid:"lemonade",cap:37}]},K0);
show("Монополия сб с помощником (сравнение)",13,"main",LC,{},KH);
show("Акциз лимонад 10 вт пом",16,"main",LC,{events:[{pid:"lemonade",tax:10}]},KH);
show("Блогер чт пом",18,"main",LC,{events:[{pid:"croissant",aMult:1.3,bMult:0.75}]},KH);
show("Блогер пт пом",19,"main",LC,{events:[{pid:"croissant",aMult:1.3,bMult:0.75}]},KH);
show("Кофе+2 будни пом",15,"main",["lemonade","croissant","coffee"],{},KH);
show("Кофе+2 сб пом",13,"main",["lemonade","croissant","coffee"],{},KH);
show("Офис пн",15,"office",LC,{},K0);
show("Офис пн пом",15,"office",LC,{},KH);
show("Офис сб",20,"office",LC,{},K0);
show("Фестиваль вт (экзамен) пом",23,"main",LC,{events:[{kMult:1.3}]},KH);
show("Фестиваль вт без пом",23,"main",LC,{events:[{kMult:1.3}]},K0);
show("Потолок круассан 44 ср пом",24,"main",LC,{events:[{pid:"croissant",cap:44}]},KH);
show("Будни пом",22,"main",LC,{},KH);
// Семён
const m=L.params(9,"main","lemonade",{});
console.log("\nСемён: BR(50)=",L.fmt(L.compBR(m.A,m.B,20,50),2),"BR(51)=",L.fmt(L.compBR(m.A,m.B,20,51),2),"BR(20)=",L.fmt(L.compBR(m.A,m.B,20,20),2),"Nash=",L.fmt(L.nash(m.A,m.B,20),2));
const ms=L.params(13,"main","lemonade",{}); console.log("BR(50) в сб =",L.fmt(L.compBR(ms.A,ms.B,20,50),2));
// сходимость
let P=51; for(let d=0;d<6;d++){const pk=Math.round(L.compBR(m.A,m.B,20,P)); const pmy=L.compBR(m.A,m.B,20,pk); console.log(` шаг ${d}: игрок ${P} → Семён ${pk}; лучший ответ игрока на ${pk} = ${L.fmt(pmy,2)}`); P=Math.round(pmy);}
// прибыль дуэли в Нэше vs монополия
const n=L.nash(m.A,m.B,20); const q=0.55*m.A-m.B*n+0.5*m.B*n; console.log("Нэш: P=",L.fmt(n,2),"Q=",L.fmt(q,2),"маржа=",L.fmt((n-20)*q,0),"; монополия лимонад маржа=",L.fmt(30*60,0));
// ceiling formula
for (const [pid,c,p] of [["lemonade",20,50],["croissant",30,55]]) console.log("потолок",pid, c+0.55*(p-c), Math.round(c+0.55*(p-c)));
// newsvendor
for (const [n,P,c] of [["лимонад",50.56,20],["круассан",55.56,30],["лимонад 51",51,20],["круассан 56",56,30]]) {const cr=(P-c)/(P-c+c); console.log("газетчик",n,"CR=",L.fmt(cr,3),"заказ/E[Q]=",L.fmt(0.92+0.16*cr,4));}
