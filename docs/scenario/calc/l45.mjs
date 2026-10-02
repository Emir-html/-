const f=(x,d=1)=>(Math.round(x*10**d)/10**d).toLocaleString("ru-RU");
const ann=(r,N)=>(1-Math.pow(1+r,-N))/r;
console.log("=== УРОВЕНЬ 4");
const al=14,be=0.5,w0=600,g=50,FC=3000;
const Q=L=>al*L-be*L*L/2, MP=L=>al-be*L, w=L=>w0+g*L;
const prof=(L,p,wage=null,rent=8000)=>{const ww=wage??w(L);return p*Q(L)-ww*L-FC-rent;};
for (const p of [300,380]) {
 let best={L:0,pi:-1e9}; for(let L=0;L<=30;L++){const pi=prof(L,p); if(pi>best.pi) best={L,pi};}
 const Lm=(p*al-w0)/(p*be+2*g), Lc=(p*al-w0)/(p*be+g);
 console.log(`p=${p}: MRP=${p*al}−${p*be}L; монопсония непрерывно L=${f(Lm,2)} → целое лучшее L=${best.L} w=${w(best.L)} MRP=${f(p*MP(best.L))} MRC=${w0+2*g*best.L} π=${f(best.pi,0)}; конкурентно L=${f(Lc,2)} w=${f(w(Lc),0)}`);
 for(let L=12;L<=19;L++) console.log(`   L=${L}: Q=${f(Q(L))} w=${w(L)} MRP=${f(p*MP(L))} MRC(L)=${f(w(L)*L-w(L-1)*(L-1),0)} π=${f(prof(L,p),0)} ср.продукт в деньгах=${f(p*Q(L)/L,0)}`);
 for (const m of [1400]) {let b2={L:0,pi:-1e9}; for(let L=0;L<=30;L++){ if(w(L)>m && L>0) { /* нужно платить w(L) */ const pi=prof(L,p,w(L)); if(pi>b2.pi) b2={L,pi,wage:w(L)}; } else { const pi=prof(L,p,m); if(pi>b2.pi) b2={L,pi,wage:m}; } }
  console.log(`  МРОТ ${m}: предложение при ${m}: L_s=${(m-w0)/g}; лучший L=${b2.L} (зарплата ${b2.wage}) π=${f(b2.pi,0)}`);}
}
// аренда vs покупка котла
for (const r of [0.02,0.03]) {const N=48,a=ann(r,N); const rent=8000*a; const buy=280000+500*a-140000/Math.pow(1+r,N); console.log(`r=${r*100}%: a(${N})=${f(a,3)}; аренда PV=${f(rent,0)}; покупка PV=${f(buy,0)} → ${rent<buy?"аренда":"покупка"} дешевле на ${f(Math.abs(rent-buy),0)}`);}
console.log("=== УРОВЕНЬ 5");
const r=0.02,N=30,a30=ann(r,N); console.log("a(2%,30)=",f(a30,3));
const projects=[["P1 Кофейня на вокзале",200000,12000],["P2 Линия джема №2",300000,16000],["P3 Лавка Семёна",120000,7000],["P4 Холодильный склад",150000,8000],["P5 Терраса",60000,3500],["P6 Сайт и доставка",80000,3000]];
for(const [n,I,c] of projects){const npv=c*a30-I;console.log(`${n}: I=${I} CF=${c}/д NPV=${f(npv,0)} PI=${f((npv+I)/I,3)} окупаемость=${f(I/c,1)} дн.`);}
const B=500000; const sets=[]; const n=projects.length;
for(const withS of [true,false]){let best=null; for(let m=0;m<(1<<n);m++){let I=0,V=0,names=[];for(let i=0;i<n;i++) if(m&(1<<i)){ if(!withS&&i===2){I=1e12;break;} const [nm,ii,c]=projects[i]; I+=ii; V+=c*a30-ii; names.push(nm.split(" ")[0]);} if(I<=B&&(!best||V>best.V)) best={I,V,names};}
 console.log(`бюджет ${B}${withS?"":" без лавки Семёна"}: лучший набор ${best.names.join("+")} I=${best.I} NPV=${f(best.V,0)}`);}
// жадный по PI
{const arr=projects.map(([nm,I,c])=>({nm,I,npv:c*a30-I,pi:(c*a30)/I})).sort((a,b)=>b.pi-a.pi);let left=B,V=0,ch=[];for(const p of arr){if(p.npv>0&&p.I<=left){left-=p.I;V+=p.npv;ch.push(p.nm.split(" ")[0]);}}console.log("жадный по PI:",ch.join("+"),"NPV",f(V,0),"остаток",left);}
// кредит
{const P=300000,rr=0.02,n=10;const A=P*rr/(1-Math.pow(1+rr,-n));console.log(`аннуитет: платёж ${f(A,0)}, всего ${f(A*n,0)}, переплата ${f(A*n-P,0)}`);let bal=P,tot=0,pays=[];for(let i=0;i<n;i++){const pay=P/n+bal*rr;pays.push(pay);tot+=pay;bal-=P/n;}console.log(`дифф.: первый ${f(pays[0],0)}, последний ${f(pays[n-1],0)}, всего ${f(tot,0)}, переплата ${f(tot-P,0)}`);}
// УСН
for (const [n,R,E] of [["Лавка",300000,135000],["Кофейни",600000,420000],["Цех",900000,720000],["Холдинг (сумма)",1800000,1275000]]) {const t6=0.06*R,t15=Math.max(0.15*(R-E),0.01*R);console.log(`${n}: R=${R} E=${E} (E/R=${f(E/R,3)}): 6% → ${f(t6,0)}, 15% → ${f(t15,0)} → ${t6<t15?"6%":"15%"}`);}
// страхование
{const p=0.3,loss={kafe:150000,ceh:250000,kiosk:60000};const EL=p*(loss.kafe+loss.ceh);console.log(`паводок p=${p}: Набережная+Заречье ${loss.kafe+loss.ceh} → ожидаемый убыток ${EL}`);
 const ded=20000, prem=1.25*p*((loss.kafe-ded)+(loss.ceh-ded)); console.log(`полис с франшизой ${ded} на объект: премия ${f(prem,0)}; ожид. выплата ${f(p*((loss.kafe-ded)+(loss.ceh-ded)),0)}`);
 const prem0=1.25*p*(loss.kafe+loss.ceh); console.log(`полис без франшизы: премия ${f(prem0,0)}`);
 console.log(`независимые риски (по 0,3, два объекта): P(оба)=${f(p*p,3)} vs коррелированные P(оба)=${p}`);}
// валюта
{const e0=90, eUp=110,eDn=80; const Ee=(eUp+eDn)/2; console.log(`курс: сегодня ${e0}, через 10 дней 80 или 110 (по 0,5) → ожидание ${Ee}; форвард 96 → переплата за определённость ${96-Ee} ₽/у.е.`);}
