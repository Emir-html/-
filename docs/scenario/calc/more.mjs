import * as L from "./l1.mjs";
const sh=(t,d,pt,pids,ev,K,o2={})=>{const ms=pids.map(p=>L.params(d,pt,p,{events:ev,...o2}));const r=L.optimum(ms,K);console.log(t,"λ="+L.fmt(r.lam,2),r.rows.map(x=>`${x.pid}:${L.fmt(x.P,2)}/${L.fmt(x.Q,1)}`).join(" "),"маржа",L.fmt(r.profit,0));return r;};
const C3=["lemonade","croissant","coffee"],C2=["lemonade","croissant"];
sh("D13 потолок+кофе пом",13,"main",C3,[{pid:"lemonade",cap:37}],220);
sh("D13 без потолка+кофе пом",13,"main",C3,[],220);
sh("D20 жара сб кофе пом",20,"main",C3,[{pid:"lemonade",aMult:1.5},{pid:"coffee",aMult:0.85}],220);
sh("D16 акциз офис пом",16,"office",C2,[{pid:"lemonade",tax:10}],220);
sh("D16 акциз парк кофе пом",16,"main",C3,[{pid:"lemonade",tax:10}],220);
sh("D18 блогер офис пом",18,"office",C2,[{pid:"croissant",aMult:1.3,bMult:0.75}],220);
sh("D18 блогер парк кофе пом",18,"main",C3,[{pid:"croissant",aMult:1.3,bMult:0.75}],220);
sh("D12 вывеска пт пом",12,"main",C2,[],220,{sign:true});
sh("Duel D10 cro + lem comp43, no helper",10,"main",C2,[{pid:"lemonade",comp:43}],120);
// D1 at 60/65
const day1=(P1,P2)=>{const a=160-2*P1,b=200-2.5*P2;return {a,b,pr:(P1-20)*a+(P2-30)*b-400};};
console.log("D1 60/65",day1(60,65)); console.log("D1 51/56",day1(51,56)); console.log("D1 50/55",day1(50,55));
// ceiling welfare Saturday helper lemonade
const A=208,B=2.6,c=20,ch=A/B;const TS=S=>S*(ch-c)-S*S/(2*B);const CS=(S,P)=>S*(ch-P)-S*S/(2*B);
const qe=A-B*c; for(const [n,S,P] of [["монополия",78,50],["потолок 37",111.8,37]]) console.log(n,"CS",L.fmt(CS(S,P),0),"PS",L.fmt((P-c)*S,0),"TS",L.fmt(TS(S),0),"DWL",L.fmt(TS(qe)-TS(S),0));
// tax incidence weekday lemonade
{const A=160,B=2,ch=80;const TS=(S,c)=>S*(ch-c)-S*S/(2*B);const qe=A-B*20;
for(const [n,S,P,t] of [["без налога",60,50,0],["налог 10",50,55,10]]){console.log(n,"CS",L.fmt(S*(ch-P)-S*S/(2*B),0),"PS(после налога)",L.fmt((P-20-t)*S,0),"налог",t*S,"DWL",L.fmt(TS(qe,20)-TS(S,20),0));}}
// heat weekday lemonade Q
console.log("discount",(1-Math.pow(1.02,-96))/0.02, 1000/Math.pow(1.02,7));
