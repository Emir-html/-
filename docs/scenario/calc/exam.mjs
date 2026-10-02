import * as L from "./l1.mjs";
import { eventsOf } from "./sim1.mjs";
function day(d,st,label){const ev=eventsOf(d,{});let tot=0;const K=st.helper?220:120;
 console.log(`\n${label} день ${d} (${L.WD[L.wd(d)]})`);
 for(const pt of st.points){const o={rep:st.rep,sign:st.sign,events:ev};const ms=st.pids.map(p=>L.params(d,pt,p,o));const r=L.optimum(ms,K);
  const fixed=L.PT[pt].rent+(st.helper?500:0); tot+=r.profit-fixed;
  console.log(` ${pt}: λ=${L.fmt(r.lam,2)} ` + r.rows.map(x=>`${x.pid} P=${L.fmt(x.P,2)} Q=${L.fmt(x.Q,1)}`).join("; ")+` | маржа ${L.fmt(r.profit,0)} − пост. ${fixed}`);}
 console.log(` ожидаемая прибыль бота ≈ ${L.fmt(tot,0)}`); return tot;}
const full={points:["main","office"],pids:["lemonade","croissant","coffee"],helper:true,sign:true,rep:{main:1.09,office:1.09}};
const mid={points:["main"],pids:["lemonade","croissant","coffee"],helper:true,sign:false,rep:{main:1.06,office:1}};
const min={points:["main"],pids:["lemonade","croissant"],helper:false,sign:false,rep:{main:1,office:1}};
for(const [n,s] of [["ПОЛНЫЙ",full],["СРЕДНИЙ",mid],["МИНИМУМ",min]]){let t=0;for(const d of [22,23,24]) t+=day(d,s,n); console.log(` ИТОГО 3 дня: ${L.fmt(t,0)}; в среднем в день ${L.fmt(t/3,0)}`);}
