import * as L from "./l1.mjs";
const sh=(t,d,pt,pids,ev,K,o2={})=>{const ms=pids.map(p=>L.params(d,pt,p,{events:ev,...o2}));const r=L.optimum(ms,K);console.log(t,"λ="+L.fmt(r.lam,2),r.rows.map(x=>`${x.pid}:${L.fmt(x.P,2)}/${L.fmt(x.Q,1)}`).join(" "),"маржа",L.fmt(r.profit,0));return r;};
const C3=["lemonade","croissant","coffee"],C2=["lemonade","croissant"];
const bl=[{pid:"croissant",aMult:1.3,bMult:0.75}];
sh("D19 блогер пт парк кофе пом",19,"main",C3,bl,220);
sh("D19 блогер пт парк кофе пом вывеска",19,"main",C3,bl,220,{sign:true});
sh("D18 блогер чт парк кофе пом вывеска",18,"main",C3,bl,220,{sign:true});
sh("D10 кофе без помощника будни",10,"main",C3,[],120);
sh("D10 кофе пом будни",10,"main",C3,[],220);
sh("D20 жара сб пом без кофе вывеска",20,"main",C2,[{pid:"lemonade",aMult:1.5}],220,{sign:true});
sh("D20 жара сб пом кофе вывеска",20,"main",C3,[{pid:"lemonade",aMult:1.5},{pid:"coffee",aMult:0.85}],220,{sign:true});
sh("D20 жара офис сб пом кофе",20,"office",C3,[{pid:"lemonade",aMult:1.5},{pid:"coffee",aMult:0.85}],220,{sign:true});
sh("D15 офис пом кофе",15,"office",C3,[],220,{sign:true});
sh("D15 парк пом кофе вывеска",15,"main",C3,[],220,{sign:true});
sh("D13 сб вывеска пом кофе потолок",13,"main",C3,[{pid:"lemonade",cap:37}],220,{sign:true});
sh("D13 сб вывеска пом без кофе потолок",13,"main",C2,[{pid:"lemonade",cap:37}],220,{sign:true});
sh("D9 дуэль вт пом (Pк 45)",9,"main",C2,[{pid:"lemonade",comp:45}],220);
// duel payoffs
for(const [P,Pk] of [[50,45],[43,45],[20,45],[43,43],[42.67,42.67]]){const Q=88-2*P+Pk; console.log(`дуэль P=${P} Pк=${Pk}: Q=${Q.toFixed(2)} маржа=${((P-20)*Q).toFixed(0)}`);}
// Semyon payoff symmetric
for(const [P,Pk] of [[43,43],[50,45]]){const Qk=88-2*Pk+P;console.log(`Семён P=${Pk} при твоей ${P}: Q=${Qk} маржа ${(Pk-20)*Qk}`);}
// newsvendor with fridge
for (const [n,P,c] of [["лимонад",50,20],["круассан",55,30]]) {const cu=P-c, co=0.2*c; const cr=cu/(cu+co); console.log("холодильник",n,"CR",cr.toFixed(3),"заказ/E",(0.92+0.16*cr).toFixed(4)); const cr0=cu/(cu+c); console.log(" без",cr0.toFixed(3),(0.92+0.16*cr0).toFixed(4));}
// discrimination elasticities
for(const [n,A,B,P] of [["парк лим",160,2,50],["офис лим",142.8,1.155,71.82],["парк кр",200,2.5,55],["офис кр",178.5,1.444,76.82]]){const Q=A-B*P;console.log(n,"Q",Q.toFixed(1),"|E|",(B*P/Q).toFixed(3),"Лернер",((P-(n.includes("лим")?20:30))/P).toFixed(3));}
