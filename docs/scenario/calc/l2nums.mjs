import { P2, cournotX, cournotP, br, price, dayRules, kOf } from "./l2.mjs";
const f=(x,d=1)=>(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const {a,b}=P2;
console.log("== Статика");
for (const [n,c] of [[2,30],[2,20],[3,20],[4,20],[5,20],[6,20],[10,20]]) {const x=cournotX(n,c),P=cournotP(n,c);console.log(`n=${n} c=${c}: x=${f(x)} P=${f(P,2)} π=${f((P-c)*x,0)} (−плата 3000 = ${f((P-c)*x-3000,0)})`);}
for (const c of [30,20]) {const X=(a-c)/(2*b),P=price(X);console.log(`монополия/картель c=${c}: X=${f(X)} P=${f(P)} каждому x=${f(X/2)} π=${f((P-c)*X/2,0)}`);
 const xc=X/2, xd=br(xc,c), Pd=price(xc+xd); console.log(`  обман: x=${f(xd)} P=${f(Pd)} π_обм=${f((Pd-c)*xd,0)} π_Семёна=${f((Pd-c)*xc,0)}`);
 const xs=br(xd,c); const Pp=price(xc+xs); console.log(`  наказание на след. день (герой вернулся к ${f(xc)}, Семён BR(${f(xd)})=${f(xs)}): P=${f(Pp)} π=${f((Pp-c)*xc,0)}`);
 const xl=(a-c)/(2*b), xf=br(xl,c), Pl=price(xl+xf); console.log(`  Штакельберг: лидер ${f(xl)} последователь ${f(xf)} P=${f(Pl)} π_L=${f((Pl-c)*xl,0)} π_F=${f((Pl-c)*xf,0)}`);}
// парадокс слияния: 2 из 3 в картеле (действуют как одна фирма) против Ильи
{const c=20; const xm=(a-c)/(3*b); const P=price(2*xm); console.log(`картель 2 против Ильи (дуополия Курно): каждому из картеля ${f((P-c)*xm/2,0)} vs Курно n=3 ${f((cournotP(3)-c)*cournotX(3),0)}; Илья ${f((P-c)*xm,0)}`);}
// ожидаемый штраф
console.log(`ожидаемый штраф за день сговора: ${P2.pFine}×${P2.fine} = ${P2.pFine*P2.fine}; выигрыш картеля в день (c=20) ${f(16000-14222.2,0)}, (c=30) ${f(12250-10888.9,0)}`);
// охладитель
for (const n of [2,3,5]) {const ci=16,c=20; const xi=(a-n*ci+(n-1)*c)/(b*(n+1)); const xo=(a-n*c+(n-2)*c+ci)/(b*(n+1)); const P=price(xi+(n-1)*xo); const base=(cournotP(n)-c)*cournotX(n);
 console.log(`охладитель n=${n}: x=${f(xi)} (у других ${f(xo)}) P=${f(P,2)} π=${f((P-ci)*xi,0)} vs ${f(base,0)} → +${f((P-ci)*xi-base,0)}/норм.день`);}
// ставка
const ann=(r,N)=>(1-Math.pow(1+r,-N))/r; console.log("a(2%,14)=",f(ann(0.02,14),3),"a(2%,96)=",f(ann(.02,96),3), "a(2%,72)=",f(ann(.02,72),3));
