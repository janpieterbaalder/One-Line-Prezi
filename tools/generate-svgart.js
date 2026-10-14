#!/usr/bin/env node
/*
 * generate-svgart.js
 * ──────────────────
 * Tekent ruimtelijke one-line-art voor de bibliotheek en schrijft die als SVG
 * naar assets/svglibrary/. Elke tekening is een klein 3D-model; de motor
 * (tools/svgart-engine.js) berekent de zichtbare lijnen en maakt er één
 * doorlopende lijn van, van links buiten beeld naar rechts buiten beeld,
 * net als de rest van de bibliotheek. Losse delen (zoals de zwevende blaadjes
 * bij de boom) zijn verbonden met onzichtbare paden (data-invisible="true"):
 * daar gaat de pen zonder te tekenen naartoe.
 *
 *   npm run gen:svgart                         alle tekeningen
 *   npm run gen:svgart -- zandloper            alleen deze (bestandsnaam zonder .svg)
 *
 * Daarna: npm run build:svglib (of update-bibliotheek.bat).
 *
 * LET OP: dit overschrijft de SVG van de gekozen tekeningen.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const G=require('./svgart-engine');
const{camera,revolve,Sketch,smooth,toPath,d2}=G;

// profiel r(y) uit punten [[y,r],...] (lineair geïnterpoleerd, daarna licht afgerond)
function profile(pts,soft=0){
  const lin=y=>{if(y<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(y<=pts[i][0]){const[a,ra]=pts[i-1],[b,rb]=pts[i];return ra+(rb-ra)*(y-a)/(b-a);}return pts[pts.length-1][1];};
  if(!soft)return lin;
  return y=>{let s=0,w=0;for(let k=-4;k<=4;k++){const g=Math.exp(-k*k/8);s+=lin(y+k*soft/4)*g;w+=g;}return s/w;};
}
const rev=a=>a.slice().reverse();

const ART={};

// ── Zandloper — eindigheid, tijd ──────────────────────────────────
ART['zandloper']=()=>{
  const cam=camera({yaw:12,pitch:18,scale:1.04,ox:960,oy:712});
  const S=new Sketch();
  // platen: zijkant r=166, afgeschuinde bovenrand naar r=154
  const plate=(y0)=>revolve(cam,0,0,profile([[y0,166],[y0+22,166],[y0+34,154]]),y0,y0+34);
  const PB=plate(0),PT=plate(466);
  for(const[P,y0,tag]of[[PB,0,'plateB'],[PT,466,'plateT']]){
    S.add(P.sil(-1,y0,y0+34),tag).add(P.sil(1,y0,y0+34),tag);
    S.add(P.section(y0).front,tag);            // onderrand
    S.add(P.section(y0+11).front,tag);         // groef
    S.add(P.section(y0+22).front,tag);         // begin afschuining
    S.add(P.section(y0+34).front,tag);         // bovenvlak voor
    S.add(P.section(y0+34).back,tag+'back');   // bovenvlak achter
  }
  // draaigroef in het bovenvlak van de bovenplaat, met een draaispoor (spiraal) vanaf de rand
  {const g=revolve(cam,0,0,()=>116,499,501).section(500);S.add(g.front,'plateT').add(g.back,'plateT');
   S.add(G.curve3(cam,t=>{const a=G.rad(cam.yaw+200+70*t),r=154-38*t;return[r*Math.cos(a),500,r*Math.sin(a)];},40),'plateT');}
  // gedraaide spijlen: voet, ring, slanke schacht, dubbele kraal in het midden
  const postR=profile([[34,18],[44,18],[48,15],[54,12.5],[62,12],[70,14.5],[80,14.5],[88,11.5],[180,11],[204,13],[218,19],[232,19],[242,14],
    [250,16],[258,14],[268,19],[282,19],[296,13],[320,11],[412,11.5],[420,14.5],[430,14.5],[438,12],[446,12.5],[452,15],[456,18],[466,18]],3);
  const rings=[44,48,70,80,218,232,250,268,282,420,430,452];
  const posts=[150,30].map(a=>{const x=128*Math.cos(G.rad(a)),z=128*Math.sin(G.rad(a));return revolve(cam,x,z,postR,34,466,320);});
  posts.forEach((P,i)=>{
    const tag='post'+i;
    S.add(P.sil(-1,34,466),tag).add(P.sil(1,34,466),tag);
    for(const y of[34,...rings])S.add(P.section(y).front,tag);
  });
  // glas: twee bollen met een smalle taille
  const half=[[34,58],[44,72],[64,90],[96,99],[130,96],[160,82],[190,58],[214,30],[232,13],[244,8],[250,7.5]];
  const glassR=profile([...half,...rev(half).slice(1).map(([y,r])=>[500-y,r])],4);
  const GL=revolve(cam,0,0,glassR,34,466,260);
  S.add(GL.sil(-1,34,466),'glass').add(GL.sil(1,34,466),'glass');
  S.add(GL.section(34).front,'glass');
  const waist=GL.section(250);S.add(waist.front,'glass').add(waist.back,'glass');
  // zand onder: oppervlak tegen het glas + zandheuvel (hol omwentelingsprofiel)
  const ys=88,yA=152,rB=glassR(ys);
  const MD=revolve(cam,0,0,y=>y>=yA?0:rB*Math.pow((yA-y)/(yA-ys),1.35),ys,yA,90);
  const A=cam.p([0,yA,0]);
  const base=GL.section(ys),mb=MD.section(ys);
  // zichtbaar deel van de basisrand: van het linkersilhouet van de heuvel via
  // de voorkant naar het rechtersilhouet (het achterste stuk zit achter de heuvel)
  const bk=base.back;
  const iL=bk.reduce((b,p,i)=>d2(p,mb.left)<d2(bk[b],mb.left)?i:b,0),iR=bk.reduce((b,p,i)=>d2(p,mb.right)<d2(bk[b],mb.right)?i:b,0);
  const backL=bk.slice(0,iL+1),backR=bk.slice(iR);
  S.add(backL,'sand').add(base.front,'sand').add(backR,'sand');
  S.add([...MD.sil(-1,ys,yA-0.5),A],'sand').add([...MD.sil(1,ys,yA-0.5),A],'sand');
  S.add(MD.section(ys+(yA-ys)*0.38).front,'sand');   // hoogtelijn
  // zand boven: vlak oppervlak
  const top=GL.section(322);S.add(top.front,'sand').add(top.back,'sand');
  // zandstraal van de taille naar de top van de heuvel
  S.add([cam.p([0,250,7]),A],'sand');
  // grond: in van links, uit naar rechts
  const bl=PB.section(0).left,br=PB.section(0).right;
  S.add(smooth([[-60,610],[180,575],[420,640],[600,690],[700,700],[bl[0]-40,bl[1]-2],bl]),'ground');
  S.add(G.flowLine([br,[br[0]+50,br[1]-4],[1240,696],[1420,660],{w:36,h:15,adv:10,tilt:-9},[1640,628],[1800,622],[1980,630]]),'ground');
  // zichtbaarheid
  const topPoly=[...PT.sil(-1,466,500),...PT.section(500).back,...rev(PT.sil(1,466,500)),...rev(PT.section(466).front)];
  S.hide(topPoly,['post0','post1','glass']);
  const postPoly=P=>[...P.sil(-1,34,466),...rev(P.sil(1,34,466))];
  // linker spijl staat vóór het glas; beide spijlen staan vóór de achterrand van de voetplaat
  S.hide(postPoly(posts[0]),['glass','sand','plateBback']);
  S.hide(postPoly(posts[1]),['plateBback']);
  // zand is ondoorzichtig: de achterrand van de voetplaat verdwijnt erachter
  const sandPoly=[...GL.sil(-1,34,ys),...backL,...MD.sil(-1,ys,yA),...rev(MD.sil(1,ys,yA)),...backR,...rev(GL.sil(1,34,ys)),...rev(GL.section(34).front)];
  S.hide(sandPoly,['plateBback']);
  S.connect();
  return{S,from:[-60,610],to:[1980,630]};
};

// ── Kompas — moreel kompas, richting ──────────────────────────────
// Een zakkompas dat aan het koord hangt (zoals het anker aan zijn touw),
// voorover gekanteld en naar links gedraaid zodat de kastrand rechtsboven
// zichtbaar is. Lokaal: x rechts, y omhoog (naar de kroon), z = voorkant.
ART['kompas']=()=>{
  const cam=camera({yaw:0,pitch:0,scale:1.24,ox:972,oy:598});
  const F=G.frame(cam,{rx:16,ry:-34,rz:7});
  const S=new Sketch();
  const R=182,Rb=182,D=46,X=[1,0,0],Y=[0,1,0],Z=[0,0,1];
  const ring=(z,r,a0=0,a1=360)=>F.circle([0,0,z],X,Y,r,a0,a1);
  // kast: zichtbare zijband tussen de silhouethoeken
  const s0=F.silAngle(X,Y);
  const mid=s0+90,vis=F.facing([Math.cos(G.rad(mid)),Math.sin(G.rad(mid)),0])>0?[s0,s0+180]:[s0+180,s0+360];
  const at=(r,z,a)=>[r*Math.cos(G.rad(a)),r*Math.sin(G.rad(a)),z];
  S.add(ring(0,R),'rim');                                       // voorrand
  S.add(ring(-D,Rb,vis[0],vis[1]),'back');                      // achterrand (zichtbaar deel)
  S.add(ring(-D*0.5,(R+Rb)/2,vis[0],vis[1]),'back');            // groef in de zijband
  S.add(F.line(at(R,0,vis[0]),at(Rb,-D,vis[0])),'back').add(F.line(at(R,0,vis[1]),at(Rb,-D,vis[1])),'back');
  // rand (bezel) met noordmarkering, en de verzonken wijzerplaat (de bezel
  // overlapt de plaat aan de verre kant: zo is de verdieping zichtbaar)
  S.add(ring(0,R*0.87),'bezel');
  S.add(F.line(at(R,0,96),at(R*0.87,0,90)),'bezel').add(F.line(at(R*0.87,0,90),at(R,0,84)),'bezel');
  S.add(ring(-9,R*0.852),'dial');
  // maatstreepjes: kort (10°), langer (45°), lang tot de windroosring (90°)
  for(let a=0;a<360;a+=10){
    const r1=a%90===0?R*0.62:a%45===0?R*0.70:R*0.77;
    S.add(F.line(at(R*0.852,-9,a),at(r1,-9,a)),'dial');
  }
  S.add(ring(-9,R*0.62),'dial');
  // windroos: vier slanke lange punten en vier korte
  const star=[];
  for(let k=0;k<16;k++){const a=90-k*22.5,r=k%4===0?R*0.62:k%2===0?R*0.30:R*0.085;star.push(at(r,-9,a));}
  star.push(star[0]);
  for(let k=0;k<16;k++)S.add(F.line(star[k],star[k+1]),'rose');
  // naald: ruitvorm met een verhoogde rug (lichte 3D-knik), wijst naar het noordoosten
  const na=90-40,nL=R*0.72,nW=R*0.115;
  const nN=at(nL,-2,na),nS=at(nL,-2,na+180),nA=at(nW,-2,na+90),nB=at(nW,-2,na-90),nC=[0,0,6];
  for(const[p,q]of[[nN,nA],[nA,nS],[nS,nB],[nB,nN],[nN,nC],[nC,nS]])S.add(F.line(p,q),'needle');
  // noordhelft dubbel omlijnd (in plaats van ingekleurd)
  const nN2=at(nL*0.78,-1,na),nA2=at(nW*0.55,-1,na+90),nB2=at(nW*0.55,-1,na-90);
  S.add(F.line(nA2,nN2),'needle').add(F.line(nN2,nB2),'needle').add(F.line(nB2,nA2),'needle');
  // naafdopje: cilindertje op de as
  const cr=R*0.075,cs=F.silAngle(X,Y);
  S.add(ring(14,cr),'cap');
  S.add(ring(5,cr,cs+180,cs+360),'cap');
  S.add(F.line(at(cr,14,cs+180),at(cr,5,cs+180)),'cap').add(F.line(at(cr,14,cs+360),at(cr,5,cs+360)),'cap');
  // kroon bovenop de kast: hals, gekartelde kroon en knop (as = lokaal y).
  // Elk deel levert zijn lijnen én zijn omtrek (opgebouwd uit precies die
  // lijnen), zodat lijnen erachter netjes op een getekende rand eindigen.
  const zc=-D*0.5;
  const vcyl=(y0,y1,r,tag)=>{
    const sa=F.silAngle(X,Z);
    const P=(y,a)=>[r*Math.cos(G.rad(a)),y,zc+r*Math.sin(G.rad(a))];
    const mid=F.facing([Math.cos(G.rad(sa+90)),0,Math.sin(G.rad(sa+90))])>0?sa+90:sa+270;  // midden voorkant
    const aA=mid-90,aB=mid+90,leftIsA=F.p(P(y0,aA))[0]<F.p(P(y0,aB))[0];
    const aL=leftIsA?aA:aB,aR=leftIsA?aB:aA;
    const frontArc=y=>F.circle([0,y,zc],X,Z,r,aL,aR);                       // links → voor → rechts
    const backArc=y=>F.circle([0,y,zc],X,Z,r,aR,aR+(leftIsA?180:-180));     // rechts → achter → links
    const left=F.line(P(y1,aL),P(y0,aL)),right=F.line(P(y0,aR),P(y1,aR));
    const bot=frontArc(y0),topF=frontArc(y1),topB=backArc(y1);
    const topUp=F.facing(Y)>0;
    S.add(left,tag).add(right,tag).add(bot,tag).add(topF,tag);
    if(topUp)S.add(topB,tag);
    const poly=[...bot,...right,...(topUp?topB:rev(topF)),...left].map(p=>[p[0],p[1]]);
    return{P,fr:[aL,aR],poly,topB,topF};
  };
  const neck=vcyl(R-3,R+14,11,'neck');
  const K=vcyl(R+14,R+44,21,'crown');
  const knob=vcyl(R+44,R+55,10,'knob');
  // kartel: zigzag over de zichtbare voorkant van de kroon, met de punten
  // precies op de boven- en onderrand (zo sluit elke tand aan)
  {const[a0,a1]=K.fr,n=14,pts=[];
   for(let i=0;i<=n;i++){const a=a0+(a1-a0)*(i+0.5)/(n+1);pts.push(K.P(i%2?R+14:R+44,a));}
   for(let i=0;i<n;i++)S.add(F.line(pts[i],pts[i+1],2),'knurl');}
  // beugelring (draad met dikte): twee cirkels in het vlak van de wijzerplaat,
  // het onderste deel loopt door de knop
  const by=R+55+15,bc=[0,by,zc];
  S.add(F.circle(bc,X,Y,33),'bow').add(F.circle(bc,X,Y,21),'bow');
  // koord: komt van links, slaat drie ruime slagen om de draad van de ring
  // (zoals het touw bij het anker) en sluit erop aan
  const cord=[];
  {const wrapA=150,turns=3;
   // schroeflijn om de ringdraad: draait 3 keer rond terwijl hij langs de ring opschuift
   const coil=F.curve(t=>{const ang=G.rad(wrapA-46*t),c=[27*Math.cos(ang),by+27*Math.sin(ang),zc],o=G.rad(360*turns*t+200),rr=19-4*t;
     return[c[0]+rr*Math.cos(o)*Math.cos(ang),c[1]+rr*Math.cos(o)*Math.sin(ang),c[2]+rr*Math.sin(o)];},150);
   const c0=coil[0];
   const lp=G.flowLine([[-60,312],[200,276],[430,300],{w:36,h:15,adv:9,tilt:-9,up:true},[640,250],[760,208],[c0[0]-60,c0[1]-34],c0]);
   cord.push(...lp,...coil.slice(1));
   cord.push(F.p([33*Math.cos(G.rad(wrapA-58)),by+33*Math.sin(G.rad(wrapA-58)),zc]));
  }
  S.add(cord,'cord');
  // uitloop: van de rechterkant van de kast naar rechts buiten beeld
  const ex=F.p(at(Rb,-D,vis[0]+ (vis[0]<0?0:0) ));
  const exitPt=F.p(at(Rb,-D,(vis[0]+vis[1])/2-62));
  const exitLine=G.flowLine([exitPt,[exitPt[0]+56,exitPt[1]+34],[1330,744],[1500,720],{w:38,h:16,adv:10,tilt:-7},[1720,690],[1980,688]]);
  S.add(exitLine,'exit');
  // zichtbaarheid
  const rimPoly=ring(0,R);
  const bezelIn=ring(0,R*0.87);
  S.keep(bezelIn,['dial','rose','needle','cap']);
  const needlePoly=[nN,nA,nS,nB].map(F.p);
  S.hide(needlePoly,['dial','rose']);
  const capPoly=[...ring(14,cr,cs,cs+180),...ring(5,cr,cs+180,cs+360)];
  S.hide(capPoly,['needle','rose','dial']);
  // kroononderdelen: wat hoger zit staat vóór het onderste einde van wat lager zit
  S.hide(K.poly,['neck','bow']);
  S.hide(knob.poly,['crown','bow']);
  S.hide(neck.poly,['back']);
  S.hide(K.poly,['back']);
  S.connect();
  return{S,from:cord[0],to:exitLine[exitLine.length-1]};
};

// ── Wegwijzer — dilemma, keuzes maken ─────────────────────────────
// Vierkante houten paal met piramidekap; drie planken met dikte en pijlpunt:
// twee op de voorkant (naar rechts en naar links) en één op de zijkant die
// van de kijker af wijst. Zichtbare vlakken worden per vlak berekend.
ART['wegwijzer']=()=>{
  const cam=camera({yaw:-22,pitch:10,scale:1.18,ox:928,oy:752});
  const S=new Sketch(),v=G.v3;
  const P=p=>cam.p(p),L3=(a,b,step=4)=>G.line3(cam,a,b,step);
  const facing=n=>v.dot(n,cam.view)>0;
  const hw=27,HP=520,CAP=34;                        // halve paaldikte, paalhoogte, kaphoogte
  // paal: zichtbaar zijn de voorkant (z+) en de rechterkant (x+)
  const c=(x,y,z)=>[x,y,z];
  const FL=y=>c(-hw,y,hw),FR=y=>c(hw,y,hw),BR=y=>c(hw,y,-hw);
  S.add(L3(FL(0),FL(HP)),'post').add(L3(FR(0),FR(HP)),'post').add(L3(BR(0),BR(HP)),'post');
  S.add(L3(FL(0),FR(0)),'post').add(L3(FR(0),BR(0)),'post');          // voet
  S.add(L3(FL(HP),FR(HP)),'post').add(L3(FR(HP),BR(HP)),'post');      // bovenrand
  // piramidekap
  const apex=c(0,HP+CAP,0);
  S.add(L3(FL(HP),apex),'post').add(L3(FR(HP),apex),'post').add(L3(BR(HP),apex),'post');
  // houtnerf: op de voorkant een golvende lijn die rond een kwast buigt (met
  // een lusje als kwast), op de zijkant een rustige lijn
  {const knotY=170,kx=-9;
   const f=t=>{const y=HP*t,d=Math.exp(-Math.pow((y-knotY)/34,2));return[kx+2.4*Math.sin(t*11+0.4)+13*d,y,hw];};
   const pre=G.curve3(cam,t=>f(t*(knotY-18)/HP),60),post=G.curve3(cam,t=>f((knotY+18+t*(HP-knotY-18))/HP),140);
   const kc=cam.p([kx+13,knotY,hw]);
   const loop=G.oval(pre[pre.length-1][0],pre[pre.length-1][1],{w:7,h:10,adv:1.2,tilt:-80,up:true,n:30});
   S.add([...pre,...loop.slice(1),post[0]],'grain').add(post,'grain');
   S.add(G.curve3(cam,t=>[hw,HP*t,6+2.6*Math.sin(t*8+1.2)],140),'grain');}
  // planken: oorsprong o op de paal, u = wijsrichting, w = van de paal af
  const planks=[];
  const plank=(o,u,w,{Lp=300,ov=44,H=60,T=42,t=14,tag})=>{
    const V=[0,1,0];
    const out=[[-ov,H/2],[Lp-T,H/2],[Lp,0],[Lp-T,-H/2],[-ov,-H/2]];
    const at=([a,b],cc)=>v.add(o,v.add(v.mul(u,a),v.add(v.mul(V,b),v.mul(w,cc))));
    const Fv=out.map(q=>at(q,t)),Bv=out.map(q=>at(q,0));
    const cen=[(Lp-ov)/2,0];
    const sideN=i=>{const a=out[i],b=out[(i+1)%5],e=[b[0]-a[0],b[1]-a[1]];let n=[e[1],-e[0]];const m=[(a[0]+b[0])/2-cen[0],(a[1]+b[1])/2-cen[1]];if(n[0]*m[0]+n[1]*m[1]<0)n=[-n[0],-n[1]];return v.add(v.mul(u,n[0]),v.mul(V,n[1]));};
    const frontVis=facing(w),sideVis=[0,1,2,3,4].map(i=>facing(sideN(i)));
    for(let i=0;i<5;i++){
      const j=(i+1)%5;
      if(frontVis||sideVis[i])S.add(L3(Fv[i],Fv[j]),tag);
      if(sideVis[i])S.add(L3(Bv[i],Bv[j]),tag);
      if(sideVis[i]||sideVis[(i+4)%5])S.add(L3(Fv[i],Bv[i]),tag);
    }
    // nerf in de plank: golvende lijn van achterkant naar de punt, met een kwast
    if(frontVis){
      const g1=G.curve3(cam,s=>{const a=-ov+(Lp-T-6+ov)*s;return at([a,H*0.12+3*Math.sin(s*7.5)+(s>0.55&&s<0.75?7*Math.sin((s-0.55)/0.2*Math.PI):0)],t);},140);
      S.add(g1,tag);
    }
    const poly=[...Fv,...Bv].map(P);
    planks.push({poly,tag});
  };
  plank(c(0,452,hw),[1,0,0],[0,0,1],{tag:'plankA',Lp:318});
  plank(c(0,360,hw),[-1,0,0],[0,0,1],{tag:'plankB',Lp:300});
  plank(c(hw,270,0),[0,0,-1],[1,0,0],{tag:'plankC',Lp:300});
  // gras aan de voet: licht gebogen sprieten met scherpe punten
  const tuft=(x0,z0,n,hgt,lean,seed)=>{
    let prev=P(c(x0,0,z0));
    for(let i=0;i<n;i++){
      const h=hgt*(0.5+0.5*Math.abs(Math.sin(i*2.3+seed))),lx=lean*(1.6*Math.sin(i*1.7+seed*3));
      const base=x0+i*9,tip=P(c(base+4.5+lx,h,z0)),nxt=P(c(base+9,0,z0));
      const m1=P(c(base+1+lx*0.2,h*0.55,z0)),m2=P(c(base+8+lx*0.35,h*0.5,z0));
      S.add(smooth([prev,m1,tip],3),'grass').add(smooth([tip,m2,nxt],3),'grass');prev=nxt;
    }
    return prev;
  };
  // steen bij de voet: afgeplatte ellipsoïde, omtrek boven de grond
  const stone=(x0,z0,rx,ry,rz)=>{
    const pts=[];for(let a=0;a<360;a+=4)for(let b=0;b<=90;b+=6)pts.push(P(c(x0+rx*Math.cos(G.rad(b))*Math.cos(G.rad(a)),ry*Math.sin(G.rad(b)),z0+rz*Math.cos(G.rad(b))*Math.sin(G.rad(a)))));
    const h=G.hull(pts),il=h.reduce((b,p,i)=>p[0]<h[b][0]?i:b,0),ir=h.reduce((b,p,i)=>p[0]>h[b][0]?i:b,0);
    // bovenste deel van de omtrek, van links naar rechts
    const top=[];for(let i=il;;i=(i+h.length-1)%h.length){top.push(h[i]);if(i===ir)break;}
    const up=top.some(p=>p[1]<Math.min(h[il][1],h[ir][1])-2)?top:(()=>{const t=[];for(let i=il;;i=(i+1)%h.length){t.push(h[i]);if(i===ir)break;}return t;})();
    return G.densify(up,6);
  };
  // grond: van links naar de paal (met een graspol), en van de paal naar rechts (steen, graspol)
  const gl0=P(c(-128,0,hw+30)),gl1=tuft(-128,hw+30,6,38,6,1.3);
  const entry=G.flowLine([[-60,724],[240,700],[470,716],{w:38,h:16,adv:10,tilt:-5},[690,734],[gl0[0]-50,gl0[1]-1],gl0]);
  S.add(entry,'ground');
  S.add(smooth([gl1,[gl1[0]+16,gl1[1]-1],P(FL(0))]),'ground');
  const st=stone(hw+62,0,36,25,24);
  S.add([P(BR(0)),st[0]],'ground').add(smooth(st,4),'ground');
  const gr0=P(c(hw+128,0,0)),gr1=tuft(hw+128,0,7,44,7,0.4);
  S.add(smooth([st[st.length-1],[(st[st.length-1][0]+gr0[0])/2,(st[st.length-1][1]+gr0[1])/2+3],gr0]),'ground');
  const exitLine=G.flowLine([gr1,[gr1[0]+44,gr1[1]-2],[1320,740],[1500,722],{w:38,h:16,adv:10,tilt:-7},[1730,700],[1980,708]]);
  S.add(exitLine,'ground');
  // zichtbaarheid: planken staan vóór de paal
  for(const pl of planks)S.hide(G.hull(pl.poly),['post','grain']);
  S.connect();
  return{S,from:entry[0],to:exitLine[exitLine.length-1]};
};

// ── Boom die zijn blad loslaat — loslaten, afscheid ───────────────
// Stam en takken zijn taps toelopende buizen. De zichtbare lijn is de
// buitenrand van grond + boom samen (elke rand wordt weggeknipt binnen de
// andere buizen en onder de grond). De stamvoet waaiert vloeiend uit, zodat de
// grondlijn zonder hoek de stam op loopt, rond de kroon gaat en weer de grond
// in. Twee blaadjes zweven los in de lucht: vanaf de grond gaat de pen
// onzichtbaar ('air') naar het eerste blad, dan naar het tweede, en weer
// terug naar hetzelfde punt op de grond.
ART['boom-loslaten']=()=>{
  const S=new Sketch();
  let seed=11;const rnd=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  const R=(a,b)=>a+(b-a)*rnd();
  const bez=(p,t)=>{const m=1-t;return[0,1].map(i=>m*m*m*p[0][i]+3*m*m*t*p[1][i]+3*m*t*t*p[2][i]+t*t*t*p[3][i]);};
  const tan=(p,t)=>{const a=bez(p,Math.max(0,t-0.002)),b=bez(p,Math.min(1,t+0.002)),l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return[(b[0]-a[0])/l,(b[1]-a[1])/l];};
  const tubes=[];
  // buis: spine = 4 Bézier-punten, rf(t,kant) = straal (kant +1/-1, zodat een
  // stamvoet links en rechts anders kan uitwaaieren); cap = afgeronde punt.
  // Waar de rand snel van richting verandert wordt extra bemonsterd.
  const tube=(spine,rf,{n=110,cap=true}={})=>{
    const side=(t,s)=>{const p=bez(spine,t),d=tan(spine,t),r=rf(t,s);return s>0?[p[0]-d[1]*r,p[1]+d[0]*r]:[p[0]+d[1]*r,p[1]-d[0]*r];};
    const ts=[0];
    for(let i=1;i<=n;i++){
      const t0=ts[ts.length-1],t1=i/n,k=Math.ceil(Math.max(d2(side(t0,1),side(t1,1)),d2(side(t0,-1),side(t1,-1)))/2.5);
      for(let j=1;j<=k;j++)ts.push(t0+(t1-t0)*j/k);
    }
    const L=ts.map(t=>side(t,1)),Rr=ts.map(t=>side(t,-1));
    const e=bez(spine,1),d=tan(spine,1),r1=rf(1,1),c=[];
    if(cap)for(let k=1;k<12;k++){const a=Math.PI*k/12,ca=Math.cos(a),sa=Math.sin(a);c.push([e[0]+(-d[1]*ca+d[0]*sa)*r1,e[1]+(d[0]*ca+d[1]*sa)*r1]);}
    const b={spine,rf,tag:'t'+tubes.length,stroke:[...L,...c,...rev(Rr)],at:t=>bez(spine,t),tan:t=>tan(spine,t),tip:[e[0]+d[0]*r1,e[1]+d[1]*r1]};
    b.poly=b.stroke.slice();tubes.push(b);return b;
  };
  const dir=a=>[Math.cos(a),Math.sin(a)];
  const twigs=[];
  const GY=718;
  // stam met lichte S-bocht; de voet waaiert uit als een parabool die de stam
  // en de grond allebei raakt (links breder dan rechts) en loopt net onder de
  // grond door, zodat grond en stam vloeiend in elkaar overgaan
  const tSpine=[[896,GY+60],[904,640],[874,560],[906,470]];
  const trunk=tube(tSpine,(t,s)=>{
    const base=23+14*(1-t),h=GY+1-bez(tSpine,t)[1];
    const F=s>0?40:52,H=s>0?50:64,u=Math.max(0,Math.min(1,(h+1.2)/(H+1.2)));
    return base+F*Math.pow(1-Math.sqrt(u),2);
  },{cap:true,n:160});
  // Gevorkte groei: elke tak buigt vloeiend naar het licht en splitst aan zijn
  // eind in twee (een sterke en een zwakkere); dikte volgens Leonardo.
  const fork=(p,ang,len,r,depth)=>{
    const lean=(-Math.PI/2-ang)*0.16+R(-0.1,0.1);
    const pts=[p];let a=ang;
    for(let k=0;k<3;k++){a+=lean/3*(k===1?1.3:0.85);const q=pts[pts.length-1];pts.push([q[0]+Math.cos(a)*len/3,q[1]+Math.sin(a)*len/3]);}
    const last=depth===0;
    const r1=last?1.0:r*0.8;
    const b=tube(pts,t=>r1+(r-r1)*Math.pow(1-t,last?0.8:1));
    if(last){twigs.push(b);return b;}
    const e=b.tan(1),ea=Math.atan2(e[1],e[0]),spread=R(0.6,0.82),bias=R(-0.15,0.15);
    const strong=rnd()<0.5?1:-1;
    fork(b.at(1),ea+strong*spread*(0.45+bias),len*R(0.68,0.78),r1*0.8,depth-1);
    fork(b.at(1),ea-strong*spread*(0.55-bias),len*R(0.52,0.62),r1*0.62,depth-1);
    // af en toe een zijtwijg halverwege
    if(depth>=2&&rnd()<0.7){const t=R(0.4,0.65),d=b.tan(t),da=Math.atan2(d[1],d[0])+(rnd()<0.5?-1:1)*R(0.55,0.8);fork(b.at(t),da,len*R(0.32,0.42),b.rf(t)*0.55,0);}
    return b;
  };
  const top=trunk.at(1);
  // vier gesteltakken in een brede waaier, plus twee lagere zijtakken
  fork(top,-2.62,182,15,2);
  fork(top,-1.98,172,17,2);
  fork(top,-1.22,172,17,2);
  fork(top,-0.6,182,15,2);
  fork(trunk.at(0.6),-2.92,132,10,1);
  fork(trunk.at(0.78),-0.22,132,10,1);
  for(const b of tubes)S.add(b.stroke,b.tag);
  // schors: twee lange lijnen die net boven de voet uit de stamrand komen en
  // de vorm van de stam volgen
  const along=(off0,off1,t0,t1,ph)=>{const o=[];for(let i=0;i<=80;i++){const s=i/80,t=t0+(t1-t0)*s,p=trunk.at(t),d=trunk.tan(t),off=off0+(off1-off0)*Math.min(1,s*2.2),r=trunk.rf(t,Math.sign(off)||1)*off+1.2*Math.sin(t*26+ph)*s;o.push([p[0]-d[1]*r,p[1]+d[0]*r]);}return o;};
  S.add(along(-1,-0.4,0.36,0.57,0.4),'bark');
  S.add(along(1,0.42,0.33,0.66,1.7),'bark');
  // blaadjes aan een paar twijgen
  const leafShape=(base,ang,len,wid,curl=0)=>{
    const u=dir(ang),nv=[-u[1],u[0]];
    const mid=s=>[base[0]+u[0]*len*s+nv[0]*curl*Math.sin(Math.PI*s)*len*0.12,base[1]+u[1]*len*s+nv[1]*curl*Math.sin(Math.PI*s)*len*0.12];
    const side=sg=>{const o=[];for(let i=0;i<=24;i++){const s=i/24,m=mid(s),w=Math.sin(Math.PI*Math.pow(s,0.8))*wid*(sg>0?1:0.85);o.push([m[0]+nv[0]*w*sg,m[1]+nv[1]*w*sg]);}return o;};
    const rib=[];for(let i=0;i<=20;i++)rib.push(mid(i/20*0.84));
    return{a:side(1),b:side(-1),rib,tip:mid(1)};
  };
  const ends=twigs.slice().sort((a,b)=>a.tip[0]-b.tip[0]);
  const step=Math.max(1,Math.floor(ends.length/6));
  for(let k=1;k<ends.length;k+=step){const tw=ends[k],d=tw.tan(1),ang=Math.atan2(d[1],d[0])+(k%2?0.6:-0.6);const L=leafShape(tw.tip,ang,44,13,k%2?1:-1);S.add(L.a,'leaf').add(L.b,'leaf').add(L.rib,'leaf');}
  // grond: links zacht aflopend met een lus, midden vloeiend (loopt onder de
  // boom door), rechts met een lus
  const gMid=smooth([[600,GY+8],[700,GY+3],[820,GY+1],[930,GY+1],[1040,GY+1],[1150,GY+4],[1240,GY+8]],3);
  const gLeft=G.flowLine([[-60,702],[160,709],[330,721],{w:38,h:16,adv:10,tilt:-1},[500,GY+7],gMid[0]]);
  const gRight=G.flowLine([gMid[gMid.length-1],[1330,GY+6],[1440,GY-6],{w:38,h:16,adv:10,tilt:-6},[1700,GY-26],[1980,GY-20]]);
  S.add(gLeft,'ground').add(gMid,'ground').add(gRight,'ground');
  // zwevend blad: steeltje, twee bladhelften en een middennerf (lichte boog);
  // de pen komt binnen bij het steeltje en gaat weg bij het eind van de nerf
  const floating=(base,ang,len,wid,curl)=>{
    const u=dir(ang),nv=[-u[1],u[0]];
    const mid=s=>{const off=curl*Math.sin(Math.PI*s)*len*0.07;return[base[0]+u[0]*len*s+nv[0]*off,base[1]+u[1]*len*s+nv[1]*off];};
    const half=sg=>{const o=[];for(let i=0;i<=30;i++){const s=i/30,m=mid(s),w=Math.sin(Math.PI*Math.pow(s,0.78))*wid*(1-0.18*s*s)*(sg>0?1:0.88);o.push([m[0]+nv[0]*w*sg,m[1]+nv[1]*w*sg]);}return o;};
    const rib=[];for(let i=0;i<=24;i++)rib.push(mid(i/24*0.84));
    const stem=smooth([[base[0]-u[0]*18-nv[0]*curl*4,base[1]-u[1]*18-nv[1]*curl*4],[base[0]-u[0]*8,base[1]-u[1]*8],base],3);
    S.add(stem,'leafF').add(half(1),'leafF').add(half(-1),'leafF').add(rib,'leafF');
    return{start:stem[0],end:rib[rib.length-1]};
  };
  const onGround=x=>gMid.concat(gRight).reduce((b,p)=>Math.abs(p[0]-x)<Math.abs(b[0]-x)?p:b);
  const X=onGround(1270);
  const A=floating([1322,402],0.55,92,28,1),B=floating([1462,566],-0.38,70,21,-1);
  // onzichtbaar: grond → blad 1 → blad 2 → terug naar hetzelfde punt op de grond
  S.add(smooth([X,[X[0]-10,X[1]-150],[A.start[0]-30,A.start[1]+60],A.start],4),'air');
  S.add(smooth([A.end,[(A.end[0]+B.start[0])/2+10,(A.end[1]+B.start[1])/2-20],B.start],4),'air');
  S.add(smooth([B.end,[B.end[0]+30,(B.end[1]+X[1])/2],[X[0]+40,X[1]-60],X],4),'air');
  // zichtbaarheid: vereniging van grond en buizen
  const groundPoly=[[-200,gMid[0][1]],...gMid,[2200,gMid[gMid.length-1][1]],[2200,1400],[-200,1400]];
  const tTags=tubes.map(b=>b.tag);
  S.hide(groundPoly,[...tTags,'bark']);
  for(const b of tubes)S.hide(b.poly,tTags.filter(t=>t!==b.tag).concat(['ground']));
  S.keep(trunk.poly,['bark']);
  S.connect();
  S.dropIslands(gLeft[0],40);       // piepkleine gaatjes tussen takken: dichttekenen
  S.bridgeIslands(gLeft[0]);        // grotere ingesloten ruimtes: onzichtbaar erheen en terug
  return{S,from:gLeft[0],to:gRight[gRight.length-1]};
};

module.exports={ART};

// ── schrijven ──
// Onzichtbare paden (data-invisible, zonder lijn) zijn verbindingen waarover
// de pen niet tekent; de app slaat ze over bij het tekenen en toont ze in de
// editor gestippeld.
function svgFile(paths){
  const air=paths.some(p=>!p.visible);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Laag_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1920 1080">
  <!-- Gegenereerd door tools/generate-svgart.js -->
  <defs>
    <style>
      .st0 {
        fill: none;
        stroke: #000;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 4px;
      }${air?`

      .st1 {
        fill: none;
        stroke: none;
      }`:''}
    </style>
  </defs>
${paths.map(p=>p.visible?`  <path class="st0" d="${p.d}"/>`:`  <path class="st1" data-invisible="true" d="${p.d}"/>`).join('\n')}
</svg>
`;
}
function render(name){
  const{S,from,to,opts}=ART[name]();
  const order=S.route(from,to);
  const paths=toPath(order,opts);
  return{paths,d:paths.filter(p=>p.visible).map(p=>p.d).join(''),retrace:S.retrace,order};
}
module.exports.render=render;
if(require.main===module){
  const DIR=path.resolve(__dirname,'..','assets','svglibrary');
  const want=process.argv.slice(2);
  const names=want.length?want:Object.keys(ART);
  for(const n of names){
    if(!ART[n]){console.error('Onbekende tekening:',n);process.exit(1);}
    const{paths,retrace}=render(n);
    fs.writeFileSync(path.join(DIR,n+'.svg'),svgFile(paths),'utf8');
    console.log(`  • ${n}.svg  (${Math.round(retrace)} px dubbel getrokken)`);
  }
  console.log(`${names.length} tekening(en) geschreven naar assets/svglibrary/. Draai nu: npm run build:svglib`);
}
