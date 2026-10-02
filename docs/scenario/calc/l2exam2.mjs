import { P2, br, price } from "./l2.mjs";
const f=(x,d=1)=>(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const c=20,F=3000,EF=P2.pFine*P2.fine;
const days=[{others:[400,400],t:"Семён 400, Илья 400"},{others:[400,400,300],t:"Семён 400, Илья 400, новичок 300"},{others:[320,200,200],t:"Семён 320, Илья 200, новичок 200 (Илья и новичок в сговоре)"}];
const prof=(x,o,fine=0)=>{const P=price(x+o.reduce((s,v)=>s+v,0));return {P,pi:(P-c)*x-F-fine};};
let bot=0; console.log("ЭТАЛОН:");
for(const d of days){const S=d.others.reduce((s,v)=>s+v,0);const x=br(S,c);const r=prof(x,d.others);bot+=r.pi;console.log(` ${d.t}: x*=${f(x)} P=${f(r.P,2)} π=${f(r.pi,0)}`);}
console.log(" итого",f(bot,0));
const test=(name,xs,fines=[0,0,0])=>{let t=0;const det=xs.map((x,i)=>{const r=prof(x,days[i].others,fines[i]);t+=r.pi;return `${x}→P ${f(r.P,1)}, π ${f(r.pi,0)}`;});console.log(name,det.join(" | "),"итого",f(t,0),"e=",f(100*t/bot,1)+"%");};
test("Всегда 400:",[400,400,400]);
test("Курно по n (400/320/320):",[400,320,320]);
test("Вступил в сговор д3 (400/250/200):",[400,250,200],[0,0,EF]);
test("Вступил и обманул д3 (400/250/440):",[400,250,440],[0,0,EF]);
test("Монополист-мышление (800/800/800):",[800,800,800]);
test("Ошибка д2 (400/400/440):",[400,400,440]);
