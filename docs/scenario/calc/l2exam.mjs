import { P2, br, price } from "./l2.mjs";
const f=(x,d=1)=>(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const c=20, F=3000;
// старт экзамена: накануне (Д21) на рынке 5 продавцов по 266,7 (включая героя)
const x5=80/(0.05*6);
// день 1: Семён и Илья — BR на вчерашнюю сумму остальных (4·x5); день 2: + новичок (BR на вчерашних троих); 
// день 3: Илья и новичок в сговоре по 200 каждый (если герой не вступил — тоже по 200), Семён — BR на вчерашних.
function play(xs, join3=false){ // xs — объёмы героя на 3 дня
  let prev={hero:x5,semyon:x5,ilya:x5,others:2*x5}; let tot=0; const rows=[];
  // день 1
  let s=br(prev.hero+prev.ilya+prev.others,c), i=br(prev.hero+prev.semyon+prev.others,c);
  let X=xs[0]+s+i, P=price(X); let pr=(P-c)*xs[0]-F; tot+=pr; rows.push({d:1,hero:xs[0],s,i,P,pr});
  prev={hero:xs[0],semyon:s,ilya:i};
  // день 2: новичок входит
  s=br(prev.hero+prev.ilya,c); i=br(prev.hero+prev.semyon,c); let nw=br(prev.hero+prev.semyon+prev.ilya,c);
  X=xs[1]+s+i+nw; P=price(X); pr=(P-c)*xs[1]-F; tot+=pr; rows.push({d:2,hero:xs[1],s,i,nw,P,pr});
  prev={hero:xs[1],semyon:s,ilya:i,nw};
  // день 3: Илья и новичок по 200; Семён BR
  s=br(prev.hero+prev.ilya+prev.nw,c); i=200; nw=200;
  X=xs[2]+s+i+nw; P=price(X); pr=(P-c)*xs[2]-F-(join3?P2.pFine*P2.fine:0); tot+=pr; rows.push({d:3,hero:xs[2],s,i,nw,P,pr});
  return {tot,rows};
}
let best={tot:-1e9};
for(let a=0;a<=1200;a+=5)for(let b=0;b<=1200;b+=5){ // день 3 — BR на известные объёмы
  const t=play([a,b,0]); const r3=t.rows[2]; const x3=br(r3.s+400,c); const t2=play([a,b,x3]); if(t2.tot>best.tot) best={...t2,xs:[a,b,x3]};}
console.log("ЭТАЛОН (оптимум на 3 дня):",best.xs.map(x=>f(x)).join(" / "),"итого",f(best.tot,0));
for(const r of best.rows) console.log(" ",JSON.stringify(Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='number'?Math.round(v*10)/10:v]))));
// близорукий BR каждый день
{let xs=[];let t=play([0,0,0]); xs[0]=br(t.rows[0].s+t.rows[0].i,c); t=play([xs[0],0,0]); xs[1]=br(t.rows[1].s+t.rows[1].i+t.rows[1].nw,c); t=play([xs[0],xs[1],0]); xs[2]=br(t.rows[2].s+400,c); t=play(xs);
 console.log("БЛИЗОРУКИЙ BR:",xs.map(x=>f(x)).join(" / "),"итого",f(t.tot,0),"e=",f(100*t.tot/best.tot,1)+"%"); for(const r of t.rows) console.log("  ",r.d,"P",f(r.P,2),"π",f(r.pr,0));}
// ученик: статический Курно по числу продавцов
{const xs=[400,320,320]; const t=play(xs); console.log("УЧЕНИК Курно n:",xs.join("/"),"итого",f(t.tot,0),"e=",f(100*t.tot/best.tot,1)+"%");for(const r of t.rows) console.log("  ",r.d,"P",f(r.P,2),"π",f(r.pr,0),"Семён",f(r.s),"Илья",f(r.i));}
// вступил в сговор в день 3 и держит 200
{const xs=[best.xs[0],best.xs[1],200]; const t=play(xs,true); console.log("Сговор в день 3 (по 200):","итого",f(t.tot,0),"e=",f(100*t.tot/best.tot,1)+"%", "день3 π",f(t.rows[2].pr,0));}
{const xs=[best.xs[0],best.xs[1],best.xs[2]]; const t=play(xs,true); console.log("Вступил и обманул:", "день3 π",f(t.rows[2].pr,0));}
