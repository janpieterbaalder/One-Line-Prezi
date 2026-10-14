'use strict';
/*
 * svgart-engine.js
 * ────────────────
 * Gereedschap voor one-line-art (gebruikt door tools/generate-svgart.js):
 *
 *  1. 3D: een eenvoudige camera (draaien om de verticale as + van bovenaf
 *     kijken, orthografisch) en vormen als cirkels, cilinders en
 *     omwentelingslichamen (silhouetten worden berekend).
 *  2. Zichtbaarheid: lijnen achter een voorwerp worden weggeknipt; waar een
 *     lijn tegen een rand stopt ontstaat een aansluiting (T-knoop).
 *  3. Route: alle zichtbare lijnen vormen een graaf. Die wordt met zo weinig
 *     mogelijk dubbel getrokken stukken (Chinese-postbodeprobleem) omgezet in
 *     één doorlopende lijn van links buiten beeld naar rechts buiten beeld
 *     (Fleury, met voorkeur voor vloeiend doorlopen).
 *  4. Uitvoer: een licht golvende (handgetekende) lijn, vereenvoudigd en
 *     omgezet naar kubische Béziers voor het SVG-pad.
 *
 * Coördinaten: wereld x rechts, y omhoog, z naar de kijker; scherm 1920x1080
 * met y omlaag.
 */

const rad=a=>a*Math.PI/180;
const deg=a=>a*180/Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ── 3D ──────────────────────────────────────────────────────────────
function camera({yaw=0,pitch=0,scale=1,ox=960,oy=690}){
  const cy=Math.cos(rad(yaw)),sy=Math.sin(rad(yaw)),cp=Math.cos(rad(pitch)),sp=Math.sin(rad(pitch));
  return{
    yaw,pitch,scale,
    view:[-sy*cp,sp,cy*cp],                     // richting naar de kijker (wereld)
    p([x,y,z]){                                  // wereld → [schermx, schermy, diepte]
      const x1=x*cy+z*sy,z1=-x*sy+z*cy;
      const y2=y*cp-z1*sp,z2=y*sp+z1*cp;
      return[ox+x1*scale,oy-y2*scale,z2];
    }
  };
}
const v3={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  unit:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l];}
};
// rotatiematrix (kolommen = beelden van de assen) uit draaiingen om x, y, z (graden)
function rotation(rx=0,ry=0,rz=0){
  const a=rad(rx),b=rad(ry),c=rad(rz);
  const Rx=[[1,0,0],[0,Math.cos(a),-Math.sin(a)],[0,Math.sin(a),Math.cos(a)]];
  const Ry=[[Math.cos(b),0,Math.sin(b)],[0,1,0],[-Math.sin(b),0,Math.cos(b)]];
  const Rz=[[Math.cos(c),-Math.sin(c),0],[Math.sin(c),Math.cos(c),0],[0,0,1]];
  const mm=(A,B)=>A.map((r,i)=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
  const M=mm(Rz,mm(Ry,Rx));
  return p=>[M[0][0]*p[0]+M[0][1]*p[1]+M[0][2]*p[2],M[1][0]*p[0]+M[1][1]*p[1]+M[1][2]*p[2],M[2][0]*p[0]+M[2][1]*p[1]+M[2][2]*p[2]];
}
// Voorwerp met eigen assenstelsel: draaiing (graden om x, y, z) + plaats in de wereld.
// Geeft hulpfuncties voor punten, cirkels en zichtbaarheid in lokale coördinaten.
function frame(cam,{rx=0,ry=0,rz=0,at=[0,0,0]}={}){
  const R=rotation(rx,ry,rz);
  const P=p=>v3.add(R(p),at);
  const self={
    R,P,
    p:p=>cam.p(P(p)),                                         // lokaal punt → scherm
    dir:d=>R(d),                                              // lokale richting → wereld
    facing:n=>v3.dot(R(n),cam.view),                          // >0: vlak met normaal n is zichtbaar
    // cirkel met middelpunt c, as n (lokaal), straal r, hoeken in graden
    circle(c,u,v,r,a0=0,a1=360){return circle3(cam,P(c),R(u),R(v),r,a0,a1);},
    // silhouethoek van een cilinder met omtrek in het vlak (u,v)
    silAngle(u,v){return silhouetteAngle(cam,R(u),R(v));},
    line(a,b,step=4){return line3(cam,P(a),P(b),step);},
    curve(f,n=80){return curve3(cam,t=>P(f(t)),n);}
  };
  return self;
}
// cirkel(boog) in 3D: middelpunt c, eenheidsassen u en v in het vlak, straal r
function circle3(cam,c,u,v,r,a0=0,a1=360){
  const n=Math.max(8,Math.ceil(Math.abs(a1-a0)*Math.max(r*cam.scale,4)*Math.PI/180/3));
  const out=[];
  for(let i=0;i<=n;i++){const a=rad(a0+(a1-a0)*i/n);out.push(cam.p(v3.add(c,v3.add(v3.mul(u,r*Math.cos(a)),v3.mul(v,r*Math.sin(a))))));}
  return out;
}
// hoek waar de omtrek van een cilinder (as = u×v) het silhouet raakt
function silhouetteAngle(cam,u,v){
  return deg(Math.atan2(-v3.dot(u,cam.view),v3.dot(v,cam.view)));
}
// lijn in 3D (dicht bemonsterd)
function line3(cam,a,b,step=4){
  const A=cam.p(a),B=cam.p(b),n=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[1]-A[1])/step)),out=[];
  for(let i=0;i<=n;i++)out.push(cam.p(v3.add(a,v3.mul(v3.sub(b,a),i/n))));
  return out;
}
// kromme in 3D via een functie t∈[0,1] → punt
function curve3(cam,f,n=80){const out=[];for(let i=0;i<=n;i++)out.push(cam.p(f(i/n)));return out;}

// Omwentelingslichaam om een verticale as door (cx,cz): profiel r(y).
// Geeft het linker- en rechtersilhouet (dicht bemonsterd, van y0 naar y1)
// en het raakpunt van een doorsnede-ellips met het silhouet.
function revolve(cam,cx,cz,rf,y0,y1,n=160){
  const tp=Math.tan(rad(cam.pitch)),yaw=cam.yaw;
  const pt=(y,th)=>{const r=rf(y);return cam.p([cx+r*Math.cos(rad(th)),y,cz+r*Math.sin(rad(th))]);};
  const dr=y=>(rf(y+0.5)-rf(y-0.5));
  const silTh=(y,side)=>{const k=clamp(dr(y)*tp,-1,1),a=deg(Math.asin(k));return side>0?yaw+a:yaw+180-a;};
  const sil=(side,ya=y0,yb=y1)=>{const out=[];const m=Math.max(2,Math.round(n*Math.abs(yb-ya)/Math.abs(y1-y0)));for(let i=0;i<=m;i++){const y=ya+(yb-ya)*i/m;out.push(pt(y,silTh(y,side)));}return out;};
  // doorsnede op hoogte y, gesplitst in voorste en achterste boog (beide van links naar rechts)
  const section=y=>{
    const tl=silTh(y,-1),tr=silTh(y,1),r=rf(y);
    const arc=(a0,a1)=>{const m=Math.max(8,Math.ceil(Math.abs(a1-a0)*Math.max(r,2)*Math.PI/180/3)),out=[];for(let i=0;i<=m;i++)out.push(pt(y,a0+(a1-a0)*i/m));return out;};
    // voor: van links (tl) via yaw+90 (z>0) naar rechts (tr); achter: via yaw+270
    let tr2=tr;while(tr2>tl)tr2-=360;           // dalend van tl naar tr via de voorkant
    let tr3=tr;while(tr3<tl)tr3+=360;           // stijgend van tl naar tr via de achterkant
    return{front:arc(tl,tr2),back:arc(tl,tr3),left:pt(y,tl),right:pt(y,tr)};
  };
  return{sil,section,silAt:(y,side)=>pt(y,silTh(y,side))};
}

// ── 2D ──────────────────────────────────────────────────────────────
const d2=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function polyLen(P){let l=0;for(let i=1;i<P.length;i++)l+=d2(P[i-1],P[i]);return l;}
function densify(P,step=3){
  const out=[[P[0][0],P[0][1]]];
  for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],n=Math.max(1,Math.ceil(d2(a,b)/step));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  return out;
}
// Catmull-Rom door stuurpunten, dicht bemonsterd (voor golvende lijnen)
function smooth(ctrl,step=4){
  const P=ctrl,out=[];
  for(let i=0;i<P.length-1;i++){
    const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
    const n=Math.max(2,Math.ceil(d2(p1,p2)/step));
    for(let k=(i?1:0);k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;
      out.push([0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)));}
  }
  return out;
}
// Vloeiende ovale lus in een lijn die naar rechts loopt (zoals een geschreven
// l of e), bewust niet perfect: de lus is iets gekanteld en de terugweg is
// wat ruimer dan de heenweg. x0,y0 = punt waar de lijn de lus in gaat.
// w = halve breedte, h = halve hoogte, adv = hoeveel de lijn opschuift,
// up = lus boven de lijn (anders eronder), tilt in graden.
function oval(x0,y0,{w=34,h=14,adv=9,up=false,tilt=-7,skew=0.14,n=48}={}){
  const out=[],s=up?-1:1,ca=Math.cos(rad(tilt)),sa=Math.sin(rad(tilt));
  for(let i=0;i<=n;i++){
    const t=-Math.PI+2*Math.PI*i/n;
    const k=1+skew*Math.sin(t/2);                  // terugweg iets ruimer
    const x=adv*(t+Math.PI)-w*k*Math.sin(t)*0.92,y=s*h*k*(1+Math.cos(t));
    out.push([x0+x*ca-y*sa,y0+x*sa+y*ca]);
  }
  return out;
}
// Golvende lijn door stuurpunten met ovale lussen ertussen: items zijn
// punten [x,y] of lus-opties {w,h,...} (de lus begint bij het vorige punt).
// De lijn komt de lus vloeiend in en gaat er vloeiend weer uit.
function flowLine(items){
  const out=[];let ctrl=[];
  const flush=()=>{if(ctrl.length>=2){const s=smooth(ctrl);if(out.length)s.shift();out.push(...s);}ctrl=[];};
  for(const it of items){
    if(Array.isArray(it)){ctrl.push(it);continue;}
    const at=ctrl[ctrl.length-1],ta=rad(it.tilt===undefined?-7:it.tilt),L=it.lead||46;
    ctrl.splice(ctrl.length-1,0,[at[0]-L*Math.cos(ta),at[1]-L*Math.sin(ta)]);
    flush();
    const o=oval(at[0],at[1],it);
    if(out.length)o.shift();
    out.push(...o);
    const e=o[o.length-1];
    ctrl=[e,[e[0]+L*Math.cos(ta),e[1]+L*Math.sin(ta)]];
  }
  flush();
  return out;
}
// convex omhulsel (monotone chain); voor het silhouet van een convex blok
function hull(pts){
  const P=pts.map(p=>[p[0],p[1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];
  for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  return lo.slice(0,-1).concat(up.slice(0,-1));
}
function inPoly(pt,poly){
  let ins=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))ins=!ins;
  }
  return ins;
}
function segInter(a,b,c,d){
  const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];
  if(Math.abs(den)<1e-9)return null;
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;
  return(t>=0&&t<=1&&u>=0&&u<=1)?t:null;
}
// snijpunt van segment ab met de rand van polygoon Q
function crossPt(a,b,Q){
  let best=null;
  for(let i=0,j=Q.length-1;i<Q.length;j=i++){const t=segInter(a,b,Q[j],Q[i]);if(t!==null&&(best===null||Math.abs(t-0.5)<Math.abs(best-0.5)))best=t;}
  if(best===null)best=0.5;
  return[a[0]+(b[0]-a[0])*best,a[1]+(b[1]-a[1])*best];
}
// delen van P buiten polygoon Q (P dicht bemonsterd); snijpunten exact
function clipOutside(P,Q){
  const parts=[];let cur=null;
  const ins=P.map(p=>inPoly(p,Q));
  const cut=(a,b)=>crossPt(a,b,Q);
  for(let i=0;i<P.length;i++){
    if(!ins[i]){
      if(!cur){cur=[];if(i>0)cur.push(cut(P[i-1],P[i]));}
      cur.push(P[i]);
    }else if(cur){cur.push(cut(P[i-1],P[i]));if(polyLen(cur)>1.5)parts.push(cur);cur=null;}
  }
  if(cur&&polyLen(cur)>1.5)parts.push(cur);
  return parts;
}

// ── schets: lijnen, verbergen, aansluitingen, route ─────────────────
class Sketch{
  constructor(){this.strokes=[];}
  // P: [[x,y,(diepte)],...]; tag: label om later groepen te kunnen verbergen
  add(P,tag=''){if(P&&P.length>=2&&polyLen(P)>0.8)this.strokes.push({P:densify(P,3),tag});return this;}
  // knip alle lijnen (of die met een tag uit 'tags') weg binnen polygoon Q
  hide(Q,tags=null,except=null){
    const out=[];
    for(const s of this.strokes){
      const hit=(!tags||tags.includes(s.tag))&&!(except&&except.includes(s.tag));
      if(!hit){out.push(s);continue;}
      for(const part of clipOutside(s.P,Q))out.push({P:part,tag:s.tag});
    }
    this.strokes=out;return this;
  }
  // het omgekeerde van hide: alleen de delen binnen Q houden
  keep(Q,tags){
    const out=[];
    for(const s of this.strokes){
      if(!tags.includes(s.tag)){out.push(s);continue;}
      // binnen Q = buiten het complement: knip met een groot kader rond Q
      const ins=s.P.map(p=>inPoly(p,Q));
      let cur=null;
      for(let i=0;i<s.P.length;i++){
        if(ins[i]){if(!cur){cur=[];if(i>0)cur.push(crossPt(s.P[i-1],s.P[i],Q));}cur.push(s.P[i]);}
        else if(cur){cur.push(crossPt(s.P[i-1],s.P[i],Q));if(polyLen(cur)>1.5)out.push({P:cur,tag:s.tag});cur=null;}
      }
      if(cur&&polyLen(cur)>1.5)out.push({P:cur,tag:s.tag});
    }
    this.strokes=out;return this;
  }
  // Eindpunten die op (of vlak bij) een andere lijn liggen worden daarmee
  // verbonden: de andere lijn wordt daar gesplitst. Ook eindpunten die vlak
  // bij elkaar liggen worden samengevoegd.
  connect(eps=1.2,epsShared=0.3){
    const bbox=P=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of P){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];}return[x0-eps,y0-eps,x1+eps,y1+eps];};
    this.strokes.forEach(s=>{s.bb=bbox(s.P);});
    // eindpunten die vlak bij elkaar liggen samenvoegen
    const ends=[];this.strokes.forEach(s=>{ends.push(s.P[0]);ends.push(s.P[s.P.length-1]);});
    for(let a=0;a<ends.length;a++)for(let b=a+1;b<ends.length;b++){
      const pa=ends[a],pb=ends[b];
      if(pa!==pb&&Math.abs(pa[0]-pb[0])<eps&&Math.abs(pa[1]-pb[1])<eps&&d2(pa,pb)<eps){pb[0]=pa[0];pb[1]=pa[1];}
    }
    // hoeveel lijnen eindigen in elk punt? (losse uiteinden mogen zich aan een
    // lijn vastmaken; bestaande knooppunten alleen bij een exacte aansluiting)
    const key=p=>p[0].toFixed(3)+','+p[1].toFixed(3);
    const deg=new Map();for(const p of ends)deg.set(key(p),(deg.get(key(p))||0)+1);
    // eindpunt op het midden van een andere lijn → die lijn daar splitsen
    for(let pass=0;pass<4;pass++){
      let changed=false;
      for(const pe of ends){
        const lim=(deg.get(key(pe))||1)>1?epsShared:eps;
        for(let j=0;j<this.strokes.length;j++){
          const st=this.strokes[j],bb=st.bb;
          if(pe[0]<bb[0]||pe[0]>bb[2]||pe[1]<bb[1]||pe[1]>bb[3])continue;
          const S=st.P;let best=null;
          for(let m=0;m<S.length-1;m++){
            const a=S[m],b=S[m+1],vx=b[0]-a[0],vy=b[1]-a[1],L2=vx*vx+vy*vy||1;
            const t=clamp(((pe[0]-a[0])*vx+(pe[1]-a[1])*vy)/L2,0,1),q=[a[0]+vx*t,a[1]+vy*t],dd=d2(q,pe);
            if(dd<lim&&(!best||dd<best.dd))best={m,t,q,dd};
          }
          if(!best)continue;
          const sp=best.m+best.t,last=S.length-1;
          if(sp<0.6||sp>last-0.6)continue;          // ligt al op een eindpunt
          pe[0]=best.q[0];pe[1]=best.q[1];
          const A=S.slice(0,best.m+1).concat([pe]),B=[pe].concat(S.slice(best.m+1));
          this.strokes.splice(j,1,{P:A,tag:st.tag,bb:bbox(A)},{P:B,tag:st.tag,bb:bbox(B)});
          changed=true;break;
        }
      }
      if(!changed)break;
    }
    // gedeelde eindpunten als losse kopieën bewaren
    this.strokes.forEach(s=>{s.P=s.P.map(p=>[p[0],p[1]]);delete s.bb;});
    return this;
  }
  // Losse stukjes (niet verbonden met 'from') met een omvang kleiner dan
  // maxSize weglaten: bijv. een piepklein ingesloten gaatje tussen takken.
  dropIslands(from,maxSize){
    const V=[],E=[];
    const vid=p=>{for(let i=0;i<V.length;i++)if(d2(V[i],p)<0.6)return i;V.push([p[0],p[1]]);return V.length-1;};
    this.strokes.forEach((s,i)=>E.push({a:vid(s.P[0]),b:vid(s.P[s.P.length-1]),i}));
    const par=V.map((_,i)=>i),f=x=>par[x]===x?x:(par[x]=f(par[x]));
    E.forEach(e=>{par[f(e.a)]=f(e.b);});
    const root=f(vid(from)),groups={};
    E.forEach(e=>{const r=f(e.a);(groups[r]=groups[r]||[]).push(e.i);});
    const drop=new Set();
    for(const[r,ids]of Object.entries(groups)){
      if(+r===root)continue;
      const pts=ids.flatMap(i=>this.strokes[i].P),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
      if(Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<maxSize)ids.forEach(i=>drop.add(i));
    }
    this.strokes=this.strokes.filter((s,i)=>!drop.has(i));
    this.dropped=drop.size;
    return this;
  }
  // Losse delen (bijv. de binnenrand van een ruimte die door takken wordt
  // ingesloten) verbinden met een kort onzichtbaar lijntje ('air') naar het
  // dichtstbijzijnde punt van de rest; de pen springt erheen en weer terug.
  bridgeIslands(from){
    for(let guard=0;guard<40;guard++){
      const V=[],E=[];
      const vid=p=>{for(let i=0;i<V.length;i++)if(d2(V[i],p)<0.6)return i;V.push([p[0],p[1]]);return V.length-1;};
      this.strokes.forEach((s,i)=>E.push({a:vid(s.P[0]),b:vid(s.P[s.P.length-1]),i}));
      const par=V.map((_,i)=>i),f=x=>par[x]===x?x:(par[x]=f(par[x]));
      E.forEach(e=>{par[f(e.a)]=f(e.b);});
      const root=f(vid(from)),main=[],rest={};
      E.forEach(e=>{const r=f(e.a);if(r===root)main.push(e.i);else(rest[r]=rest[r]||[]).push(e.i);});
      const islands=Object.values(rest);
      if(!islands.length)return this;
      // het eiland dat het dichtst bij de hoofdtekening ligt eerst
      let best=null;
      for(const ids of islands)for(const i of ids)for(const pi of this.strokes[i].P)for(const m of main)for(const pm of this.strokes[m].P){
        const dd=(pi[0]-pm[0])**2+(pi[1]-pm[1])**2;
        if(!best||dd<best.dd)best={dd,i,pi,m,pm};
      }
      const split=(si,pt)=>{const s=this.strokes[si],k=s.P.indexOf(pt);if(k<=0||k>=s.P.length-1)return;this.strokes.splice(si,1,{P:s.P.slice(0,k+1),tag:s.tag},{P:s.P.slice(k),tag:s.tag});};
      const a=[best.pm[0],best.pm[1]],b=[best.pi[0],best.pi[1]];
      // eerst de verste index splitsen zodat de andere index klopt
      if(best.i>best.m){split(best.i,best.pi);split(best.m,best.pm);}else{split(best.m,best.pm);split(best.i,best.pi);}
      this.strokes.push({P:[a,b],tag:'air'});
    }
    return this;
  }
  // graaf bouwen en route plannen van punt 'from' (links buiten beeld) naar 'to'
  route(from,to){
    const V=[],E=[];
    const vid=p=>{for(let i=0;i<V.length;i++)if(d2(V[i],p)<0.6)return i;V.push([p[0],p[1]]);return V.length-1;};
    for(const s of this.strokes){const a=vid(s.P[0]),b=vid(s.P[s.P.length-1]);E.push({a,b,P:s.P,len:polyLen(s.P),tag:s.tag});}
    const S=vid(from),T=vid(to);
    const adj=V.map(()=>[]);E.forEach((e,i)=>{adj[e.a].push(i);adj[e.b].push(i);});
    // samenhang controleren
    {const seen=new Set([S]),st=[S];while(st.length){const v=st.pop();for(const ei of adj[v]){const e=E[ei],w=e.a===v?e.b:e.a;if(!seen.has(w)){seen.add(w);st.push(w);}}}
     const lost=V.map((p,i)=>i).filter(i=>!seen.has(i));
     if(lost.length){
       const tags={};E.forEach(e=>{if(!seen.has(e.a))tags[e.tag]=(tags[e.tag]||0)+1;});
       const err=new Error('Losse delen in de tekening (niet verbonden): '+Object.entries(tags).map(([t,n])=>t+'×'+n).join(', ')+' bij '+lost.slice(0,4).map(i=>V[i].map(Math.round).join(',')).join(' | '));
       err.lost=E.filter(e=>!seen.has(e.a)).map(e=>e.P);throw err;
     }}
    // oneven knopen koppelen via kortste paden (dubbel trekken)
    const odd=[];adj.forEach((l,i)=>{if(l.length%2&&i!==S&&i!==T)odd.push(i);});
    if(adj[S].length%2===0||adj[T].length%2===0)throw new Error('Begin/eind moeten eindpunten van één lijn zijn');
    const dij=src=>{const dist=V.map(()=>Infinity),prev=V.map(()=>-1);dist[src]=0;const done=new Set();
      for(;;){let v=-1,b=Infinity;for(let i=0;i<V.length;i++)if(!done.has(i)&&dist[i]<b){b=dist[i];v=i;}if(v<0)break;done.add(v);
        for(const ei of adj[v]){const e=E[ei],w=e.a===v?e.b:e.a,nd=dist[v]+e.len;if(nd<dist[w]){dist[w]=nd;prev[w]=ei;}}}
      return{dist,prev};};
    const D={};odd.forEach(o=>{D[o]=dij(o);});
    // minimale koppeling (DP over deelverzamelingen; bij veel knopen gretig)
    let pairs=[];
    if(odd.length<=22){
      const memo=new Map(),n=odd.length,full=(1<<n)-1;
      const best=mask=>{if(mask===full)return[0,[]];if(memo.has(mask))return memo.get(mask);
        let i=0;while(mask&(1<<i))i++;let r=[Infinity,null];
        for(let j=i+1;j<n;j++)if(!(mask&(1<<j))){const sub=best(mask|(1<<i)|(1<<j)),c=D[odd[i]].dist[odd[j]]+sub[0];if(c<r[0])r=[c,[[odd[i],odd[j]],...sub[1]]];}
        memo.set(mask,r);return r;};
      pairs=best(0)[1];
    }else{
      // gretig (kortste paren eerst), daarna 2-opt: paren omwisselen zolang het korter wordt
      const left=new Set(odd),cand=[];
      for(let i=0;i<odd.length;i++)for(let j=i+1;j<odd.length;j++)cand.push([D[odd[i]].dist[odd[j]],odd[i],odd[j]]);
      cand.sort((x,y)=>x[0]-y[0]);
      for(const[,a,b]of cand)if(left.has(a)&&left.has(b)){left.delete(a);left.delete(b);pairs.push([a,b]);}
      const c=(a,b)=>D[a].dist[b];
      for(let it=0,better=true;better&&it<50;it++){
        better=false;
        for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
          const[a,b]=pairs[i],[x,y]=pairs[j],cur=c(a,b)+c(x,y);
          if(c(a,x)+c(b,y)<cur-1e-6){pairs[i]=[a,x];pairs[j]=[b,y];better=true;}
          else if(c(a,y)+c(b,x)<cur-1e-6){pairs[i]=[a,y];pairs[j]=[b,x];better=true;}
        }
      }
    }
    for(const[a,b]of pairs){let v=b;while(v!==a){const ei=D[a].prev[v],e=E[ei];E.push({...e,dup:true});const ni=E.length-1;adj[e.a].push(ni);adj[e.b].push(ni);v=e.a===v?e.b:e.a;}}
    this.retrace=pairs.reduce((s,[a,b])=>s+D[a].dist[b],0);
    // Fleury: geen brug nemen als het anders kan; verder zo recht mogelijk doorlopen
    const used=new Array(E.length).fill(false);
    const reach=(v,skip)=>{const seen=new Set([v]),st=[v];while(st.length){const x=st.pop();for(const ei of adj[x]){if(used[ei]||ei===skip)continue;const e=E[ei],w=e.a===x?e.b:e.a;if(!seen.has(w)){seen.add(w);st.push(w);}}}return seen.size;};
    const dirOut=(ei,v)=>{const e=E[ei],P=e.a===v?e.P:e.P.slice().reverse();const k=Math.min(P.length-1,4);return[P[k][0]-P[0][0],P[k][1]-P[0][1]];};
    const order=[];let v=S,din=null;
    for(let step=0;step<E.length;step++){
      const cand=adj[v].filter(ei=>!used[ei]);
      if(!cand.length)break;
      const score=ei=>{if(!din)return 0;const d=dirOut(ei,v),l=Math.hypot(...d)||1;return-(d[0]*din[0]+d[1]*din[1])/l;};
      cand.sort((x,y)=>score(x)-score(y));
      let pick=cand[0];
      // brug = na weglaten zijn er minder knopen bereikbaar vanaf v
      if(cand.length>1){const before=reach(v,-1);for(const ei of cand){if(reach(v,ei)===before){pick=ei;break;}}}
      used[pick]=true;const e=E[pick],fw=e.a===v;
      const P=fw?e.P:e.P.slice().reverse();order.push({P,dup:!!e.dup,air:e.tag==='air'});
      const k=Math.max(0,P.length-5);const dl=[P[P.length-1][0]-P[k][0],P[P.length-1][1]-P[k][1]],ll=Math.hypot(...dl)||1;din=[dl[0]/ll,dl[1]/ll];
      v=fw?e.b:e.a;
    }
    if(used.some(u=>!u))throw new Error('Route niet volledig ('+used.filter(u=>!u).length+' lijnen over)');
    if(v!==T)throw new Error('Route eindigt niet bij de uitgang');
    return order;
  }
}

// ── uitvoer ─────────────────────────────────────────────────────────
// lichte, ruimtelijk vloeiende golving: dubbel getrokken stukken krijgen
// dezelfde verschuiving en blijven dus precies over elkaar liggen
function wobble(x,y,amp){
  return[x+amp*(Math.sin(x*0.011+y*0.007+1.7)+0.55*Math.sin(x*0.027-y*0.021+0.3)+0.25*Math.sin(x*0.061+y*0.047)),
         y+amp*(Math.cos(x*0.009-y*0.013+0.5)+0.55*Math.sin(-x*0.019+y*0.025+2.1)+0.25*Math.cos(x*0.053-y*0.067))];
}
// afstand tot het lijnstuk a-b (niet de oneindige lijn): zo blijft ook een
// gesloten of bijna gesloten stuk (a≈b, bijv. een ringetje) heel
function rdp(P,eps,i0=0,i1=P.length-1,keep=new Set([0,P.length-1])){
  let md=0,mi=-1;const a=P[i0],b=P[i1],vx=b[0]-a[0],vy=b[1]-a[1],L2=vx*vx+vy*vy;
  for(let i=i0+1;i<i1;i++){
    const t=L2?clamp(((P[i][0]-a[0])*vx+(P[i][1]-a[1])*vy)/L2,0,1):0;
    const d=Math.hypot(P[i][0]-a[0]-t*vx,P[i][1]-a[1]-t*vy);if(d>md){md=d;mi=i;}}
  if(md>eps&&mi>0){keep.add(mi);rdp(P,eps,i0,mi,keep);rdp(P,eps,mi,i1,keep);}
  return keep;
}
// route → SVG-paden. Opeenvolgende stukken met dezelfde zichtbaarheid worden
// één pad; lucht-stukken (tag 'air') worden onzichtbare paden waarover de pen
// zonder te tekenen naar een volgend deel gaat (bijv. een zwevend blaadje).
function toPath(order,opts={}){
  const groups=[];
  for(const seg of order){
    const vis=!seg.air;
    if(!groups.length||groups[groups.length-1].visible!==vis)groups.push({visible:vis,segs:[]});
    groups[groups.length-1].segs.push(seg);
  }
  return groups.map(g=>({visible:g.visible,d:runPath(g.segs,g.visible?opts:{...opts,amp:0})}));
}
// Hoeken (scherpe bochten op knooppunten) blijven scherp.
function runPath(order,{amp=1.4,cornerDeg=28,eps=0.45}={}){
  const R=[];const corner=new Set();
  order.forEach((seg,si)=>{
    const P=seg.P;
    if(si===0)R.push(P[0]);
    else{
      // bocht op het knooppunt
      const a=R[Math.max(0,R.length-5)],b=R[R.length-1],c=P[Math.min(P.length-1,4)];
      const u=[b[0]-a[0],b[1]-a[1]],w=[c[0]-b[0],c[1]-b[1]];
      const cos=(u[0]*w[0]+u[1]*w[1])/((Math.hypot(...u)||1)*(Math.hypot(...w)||1));
      if(deg(Math.acos(clamp(cos,-1,1)))>cornerDeg)corner.add(R.length-1);
    }
    for(let i=1;i<P.length;i++)R.push(P[i]);
  });
  const W=R.map((p,i)=>(i===0||i===R.length-1)?[p[0],p[1]]:wobble(p[0],p[1],amp));
  // opdelen in vloeiende stukken
  const cuts=[0,...[...corner].sort((a,b)=>a-b),W.length-1];
  const f=v=>(+v.toFixed(2)).toString();
  let d=`M${f(W[0][0])},${f(W[0][1])}`;
  for(let c=0;c<cuts.length-1;c++){
    const i0=cuts[c],i1=cuts[c+1];if(i1<=i0)continue;
    const run=W.slice(i0,i1+1);
    const keep=[...rdp(run,eps)].sort((a,b)=>a-b);
    const tan=k=>{const lo=Math.max(0,k-2),hi=Math.min(run.length-1,k+2);const t=[run[hi][0]-run[lo][0],run[hi][1]-run[lo][1]],l=Math.hypot(...t)||1;return[t[0]/l,t[1]/l];};
    for(let q=0;q<keep.length-1;q++){
      const a=keep[q],b=keep[q+1],A=run[a],B=run[b],L=d2(A,B)/3,ta=tan(a),tb=tan(b);
      d+=`C${f(A[0]+ta[0]*L)},${f(A[1]+ta[1]*L)},${f(B[0]-tb[0]*L)},${f(B[1]-tb[1]*L)},${f(B[0])},${f(B[1])}`;
    }
  }
  return d;
}

module.exports={rad,deg,clamp,camera,v3,rotation,frame,circle3,silhouetteAngle,line3,curve3,revolve,
  d2,polyLen,densify,smooth,oval,flowLine,hull,inPoly,clipOutside,Sketch,wobble,toPath};
