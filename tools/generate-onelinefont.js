#!/usr/bin/env node
/*
 * generate-onelinefont.js
 * ───────────────────────
 * Tekent de hoofdletters, cijfers en leestekens van het one-line-font uit de
 * puntdefinities hieronder en schrijft ze als SVG naar assets/onelinefont/.
 * (De kleine letters zijn met de hand getekend en worden hier niet aangeraakt.)
 *
 *   node tools/generate-onelinefont.js            alle tekens uit deze lijst
 *   node tools/generate-onelinefont.js A B 9 ?    alleen deze tekens
 *
 * Daarna: npm run build:font (of update-font.bat) om het font in te sluiten.
 *
 * LET OP: dit overschrijft de SVG van de gekozen tekens, ook als je die in
 * Illustrator hebt bijgewerkt. Pas je een teken liever met de hand aan, laat
 * het dan buiten de aanroep (of verwijder het uit de lijst).
 *
 * Werking: punten staan in rechtopstaande coördinaten (y omlaag, basislijn
 * y=200, verbindingshoogte y=140, hoofdletterhoogte y=60). Ze worden schuin
 * gezet (K) en via een spline met lengte-afhankelijke handvatten omgezet naar
 * kubische Béziers. 'c' achter een punt = scherpe hoek. Instap en uitstap
 * liggen op y=140, net als bij de kleine letters, zodat tekens aansluiten.
 * Leestekens bestaan uit losse lijnen (strokes); de verbindingen daartussen
 * worden onzichtbare paden (class cls-2, stroke none): de pen gaat dan even
 * omhoog, zoals bij de punt op de i.
 */
'use strict';
const fs=require('fs');
const path=require('path');

const K=0.24,H=0.36,EXIT=[0.5,-0.866];
const norm=(x,y)=>{const l=Math.hypot(x,y)||1;return[x/l,y/l];};
const f2=v=>(+v.toFixed(2)).toString();
function spline(P,sd,ed){
  const n=P.length;if(n===2)return `M${f2(P[0].x)},${f2(P[0].y)}L${f2(P[1].x)},${f2(P[1].y)}`;
  const tin=[],tout=[];
  for(let i=0;i<n;i++){
    const a=i>0?norm(P[i].x-P[i-1].x,P[i].y-P[i-1].y):null;
    const b=i<n-1?norm(P[i+1].x-P[i].x,P[i+1].y-P[i].y):null;
    if(!a){tout[i]=sd?norm(...sd):b;continue;}
    if(!b){tin[i]=ed?norm(...ed):a;continue;}
    if(P[i].c){tin[i]=a;tout[i]=b;}else{const t=norm(a[0]+b[0],a[1]+b[1]);tin[i]=t;tout[i]=t;}
  }
  let d=`M${f2(P[0].x)},${f2(P[0].y)}`;
  for(let i=0;i<n-1;i++){
    const L=Math.hypot(P[i+1].x-P[i].x,P[i+1].y-P[i].y);
    const h1=P[i].c?L*0.3:L*H,h2=P[i+1].c?L*0.3:L*H;
    const c1=[P[i].x+tout[i][0]*h1,P[i].y+tout[i][1]*h1];
    const c2=[P[i+1].x-tin[i+1][0]*h2,P[i+1].y-tin[i+1][1]*h2];
    d+=`C${f2(c1[0])},${f2(c1[1])},${f2(c2[0])},${f2(c2[1])},${f2(P[i+1].x)},${f2(P[i+1].y)}`;
  }
  return d;
}
const shear=([x,y,c])=>({x:x+K*(200-y),y,c:c==='c'});
function build(spec){
  const multi=!!spec.strokes;
  const strokes=multi?spec.strokes.map(s=>s.map(shear)):[spec.p.map(shear)];
  const entry=shear(multi?spec.entry:spec.p[0]),exit=shear(multi?spec.exit:spec.p[spec.p.length-1]);
  const all=[entry,exit,...strokes.flat()];
  const sh=2-Math.min(...all.map(p=>p.x));all.forEach(p=>p.x+=sh);
  entry.x=Math.round(entry.x);entry.y=140;exit.x=Math.round(exit.x);exit.y=140;
  const paths=[];// {d,vis}
  if(!multi){
    const P=strokes[0];P[0].x=entry.x;P[0].y=140;P[P.length-1].x=exit.x;P[P.length-1].y=140;
    paths.push({d:spline(P,spec.sd,spec.ed||EXIT),vis:true});
  }else{
    if(spec.entryVisible){strokes[0][0].x=entry.x;strokes[0][0].y=140;}
    if(spec.exitVisible){const l=strokes[strokes.length-1];l[l.length-1].x=exit.x;l[l.length-1].y=140;}
    const line=(a,b)=>({d:`M${f2(a.x)},${f2(a.y)}L${f2(b.x)},${f2(b.y)}`,vis:false});
    if(!spec.entryVisible)paths.push(line(entry,strokes[0][0]));
    strokes.forEach((P,k)=>{
      if(k>0){const prev=strokes[k-1];paths.push(line(prev[prev.length-1],P[0]));}
      const isLast=k===strokes.length-1;
      paths.push({d:spline(P,null,isLast&&spec.exitVisible?(spec.ed||EXIT):null),vis:true});
    });
    if(!spec.exitVisible){const l=strokes[strokes.length-1];paths.push(line(l[l.length-1],exit));}
  }
  const W=exit.x,sx=entry.x,desc=!!spec.desc,vh=desc?260:200,lo=desc?-60:0;
  const label=spec.kind==='leesteken'?spec.name:spec.ch;
  const name=`one line font_${spec.kind} ${label} (lo=0,${lo}; ro=${W},${lo}; s=${sx},60; f=${W},60).svg`;
  const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg id="Laag_1" data-name="Laag 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${vh}">
  <defs>
    <style>
      .cls-1 {
        fill: none;
        stroke: #000;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 8px;
      }${multi?`

      .cls-2 {
        fill: none;
        stroke: none;
      }`:''}
    </style>
  </defs>
${paths.map(p=>`  <path class="${p.vis?'cls-1':'cls-2'}" d="${p.d}"/>`).join('\n')}
</svg>
`;
  return{name,svg};
}

// ── Hoofdletters en cijfers: één doorlopende lijn van instap naar uitstap ──
const U=(ch,p,o={})=>({kind:'hoofdletter',ch,p,...o});
const D=(ch,p,o={})=>({kind:'cijfer',ch,p,...o});
const XB=[0.86,-0.5]; // vlakkere uitstap (dwarsstreep loopt door naar de volgende letter)
// ── Leestekens: naam in de bestandsnaam (Windows staat : ? / " niet toe) ──
const L=(name,ch,o)=>({kind:'leesteken',name,ch,...o});
const DOT=(x,y)=>[[x,y],[x+1,y-11,'c'],[x+1.5,y]]; // puntje, zelfde vorm als de punt op de i

const GLYPHS=[
U('A',[[6,140],[12,178],[18,200,'c'],[60,60,'c'],[98,200,'c'],[80,170],[50,152],[28,147],[24,140],[42,136],[95,138],[140,140]],{ed:XB}),
U('B',[[6,140],[20,98],[36,60,'c'],[24,200,'c'],[36,60,'c'],[70,58],[92,74],[90,102],[66,122],[40,128,'c'],[80,132],[100,155],[95,185],[65,201],[35,198],[22,188],[30,180],[50,192],[90,200],[120,180],[150,140]]),
U('C',[[6,140],[24,96],[55,66],[84,62],[96,72,'c'],[80,64],[50,66],[24,88],[12,130],[18,175],[45,200],[80,198],[110,175],[140,140]]),
U('D',[[6,140],[20,98],[34,60,'c'],[22,200,'c'],[34,60,'c'],[75,62],[100,95],[100,150],[75,192],[40,200],[20,196],[12,186],[22,180],[45,192],[80,200],[115,180],[145,140]]),
U('E',[[6,140],[25,95],[55,64],[85,64],[92,76,'c'],[70,62],[42,68],[32,92],[45,118],[66,128],[72,124],[66,132],[40,136],[20,160],[22,188],[45,201],[85,198],[115,175],[145,140]]),
U('F',[[6,140],[25,96],[50,68],[76,61],[104,58,'c'],[84,64],[70,74],[62,100],[52,150],[42,200,'c'],[44,172],[36,150],[26,143],[34,137],[70,138],[112,140]],{ed:XB}),
U('G',[[6,140],[24,96],[55,66],[84,62],[96,72,'c'],[80,64],[50,66],[24,88],[12,130],[18,175],[45,200],[78,198],[98,172],[100,140,'c'],[82,138],[76,145],[88,150],[110,146],[135,140]],{ed:XB}),
U('H',[[6,140],[22,98],[38,60,'c'],[22,200,'c'],[28,165],[36,142],[60,138],[94.4,136,'c'],[102,60,'c'],[88,200,'c'],[118,185],[150,140]]),
U('I',[[6,140],[22,96],[40,66],[62,58],[84,60,'c'],[62,64],[54,100],[48,160],[44,200,'c'],[22,198,'c'],[60,201],[90,190],[125,140]]),
U('J',[[6,140],[24,96],[42,66],[64,58],[86,60,'c'],[66,64],[60,120],[52,200],[40,240],[20,256],[6,248],[18,228],[60,200],[100,170],[135,140]],{desc:true}),
U('K',[[6,140],[22,98],[38,60,'c'],[22,200,'c'],[30,150],[40,130],[64,98],[98,62,'c'],[78,96],[54,122],[36,136,'c'],[70,168],[95,200],[125,185],[150,140]]),
U('L',[[6,140],[24,98],[42,62,'c'],[30,140],[24,185],[14,200],[6,192],[20,184],[50,196],[95,200],[125,180],[145,140]]),
U('M',[[6,140],[10,175],[16,200,'c'],[34,60,'c'],[62,160,'c'],[92,60,'c'],[102,200,'c'],[128,185],[155,140]]),
U('N',[[6,140],[10,175],[16,200,'c'],[30,60,'c'],[86,200,'c'],[94,130],[100,62],[92,64],[84,90],[86,140],[100,172],[125,170],[148,140]]),
U('O',[[6,140],[24,96],[56,60,'c'],[26,72],[12,130],[20,185],[50,200],[82,186],[96,132],[90,80],[66,60],[52,66],[54,84],[78,128],[110,150],[148,140]]),
U('P',[[6,140],[22,98],[36,60,'c'],[22,200,'c'],[36,60,'c'],[75,58],[96,78],[92,108],[65,128],[34,132,'c'],[80,138],[130,140]],{ed:XB}),
U('Q',[[6,140],[12,95],[40,62],[75,64],[96,100],[94,160],[70,198],[38,198],[16,178],[14,156],[30,160],[60,186],[95,208],[122,204],[142,175],[155,140]]),
U('R',[[6,140],[22,98],[36,60,'c'],[22,200,'c'],[36,60,'c'],[75,58],[96,78],[92,108],[65,128],[34,132,'c'],[70,165],[95,200],[125,185],[150,140]]),
U('S',[[6,140],[35,95],[70,60,'c'],[40,66],[28,92],[45,118],[78,138],[92,168],[75,196],[42,201],[18,190],[28,178],[70,195],[110,185],[140,140]]),
U('T',[[6,140],[14,95],[28,68],[60,60],[104,58,'c'],[66,63,'c'],[56,110],[48,160],[46,190],[60,201],[90,192],[125,140]]),
U('U',[[6,140],[14,96],[24,62,'c'],[16,150],[25,190],[50,200],[80,185],[92,130],[98,62,'c'],[90,200,'c'],[118,185],[148,140]]),
U('V',[[6,140],[16,98],[24,62,'c'],[56,200,'c'],[84,120],[98,72],[100,60],[88,66],[76,96],[78,140],[98,166],[126,164],[148,140]]),
U('W',[[6,140],[14,98],[20,62,'c'],[40,200,'c'],[64,90,'c'],[86,200,'c'],[108,120],[120,72],[122,60],[110,66],[100,96],[102,140],[120,166],[146,164],[168,140]]),
U('X',[[6,140],[18,100],[28,62,'c'],[44,110],[58,135,'c'],[100,62,'c'],[14,200,'c'],[48,150,'c'],[70,185],[96,200],[125,185],[150,140]]),
U('Y',[[6,140],[16,100],[26,62,'c'],[34,110],[58,130],[102,62,'c'],[70,150],[50,210],[30,250],[12,252],[8,238],[40,215],[90,180],[150,140]],{desc:true}),
U('Z',[[6,140],[16,95],[22,64,'c'],[95,62,'c'],[14,198,'c'],[60,200],[95,200],[125,180],[150,140]]),
D('0',[[6,140],[10,100],[28,68],[52,60],[76,72],[88,120],[82,175],[56,200],[28,196],[14,172],[12,150,'c'],[22,186],[50,203],[95,192],[136,140]]),
D('1',[[6,140],[30,100],[62,60,'c'],[50,200,'c'],[28,200,'c'],[60,201],[90,195],[115,170],[130,140]]),
D('2',[[6,140],[14,100],[30,72],[58,60],[86,72],[88,102],[68,135],[18,198,'c'],[60,200],[100,200],[125,180],[145,140]]),
D('3',[[6,140],[18,95],[30,70],[60,60],[88,72],[86,100],[55,125,'c'],[92,145],[95,185],[60,201],[25,195],[12,185],[22,178],[45,192],[90,198],[125,180],[150,140]]),
D('4',[[6,140],[64,60,'c'],[56,200,'c'],[58,150,'c'],[8,150,'c'],[60,150],[100,148],[130,140]],{ed:XB}),
D('5',[[6,140],[20,98],[34,62,'c'],[92,58,'c'],[36,62,'c'],[30,118,'c'],[60,105],[92,130],[92,175],[60,200],[25,192],[12,182],[24,176],[50,192],[95,196],[125,175],[145,140]]),
D('6',[[6,140],[24,92],[55,63],[82,66],[88,76,'c'],[64,62],[36,72],[18,115],[16,165],[36,198],[65,200],[90,178],[88,145],[62,128],[32,140],[28,172],[60,182],[100,165],[130,140]]),
D('7',[[6,140],[14,95],[26,64,'c'],[95,60,'c'],[70,130],[50,185],[58,200],[85,195],[115,165],[130,140]]),
D('8',[[6,140],[12,175],[40,200],[80,190],[88,160],[55,130],[30,105],[34,70],[60,60],[84,78],[78,108],[55,130],[25,160],[30,192],[55,201],[100,190],[140,140]]),
D('9',[[6,140],[14,110],[26,80],[48,62],[70,62],[84,76,'c'],[64,63],[42,65],[20,84],[13,110],[26,130],[52,133],[74,117],[84,92],[87,62,'c'],[82,120],[72,182],[78,200],[102,194],[125,165],[140,140]]),
L('punt','.',{entry:[0,140],strokes:[DOT(12,199)],exit:[36,140]}),
L('komma',',',{entry:[0,140],strokes:[[[14,189],[16,196],[13,206],[6,214]]],exit:[34,140],desc:true}),
L('uitroepteken','!',{entry:[0,140],entryVisible:true,strokes:[[[0,140],[10,100],[22,62,'c'],[15,170]],DOT(12,199)],exit:[40,140]}),
L('vraagteken','?',{entry:[0,140],entryVisible:true,strokes:[[[0,140],[6,105],[18,74],[40,60],[62,68],[66,92],[50,114],[38,132],[36,168]],DOT(34,199)],exit:[68,140]}),
L('streepje','-',{entry:[0,140],strokes:[[[10,152],[46,148]]],exit:[56,140]}),
L('dubbelepunt',':',{entry:[0,140],strokes:[DOT(16,126),DOT(12,199)],exit:[36,140]}),
L('puntkomma',';',{entry:[0,140],strokes:[DOT(18,126),[[14,189],[16,196],[13,206],[6,214]]],exit:[36,140],desc:true}),
L('apostrof',"'",{entry:[0,140],strokes:[[[22,60],[21,70],[17,86]]],exit:[34,140]}),
L('aanhalingsteken','"',{entry:[0,140],strokes:[[[16,60],[11,86]],[[30,60],[25,86]]],exit:[42,140]}),
L('haakje-openen','(',{entry:[0,140],strokes:[[[44,52],[24,90],[16,140],[22,190],[38,226]]],exit:[48,140],desc:true}),
L('haakje-sluiten',')',{entry:[0,140],strokes:[[[10,52],[28,90],[34,140],[28,190],[10,226]]],exit:[46,140],desc:true}),
L('en-teken','&',{entry:[0,140],strokes:[[[88,200],[64,162],[44,124],[33,94],[37,68],[52,58],[64,70],[57,94],[38,116],[18,146],[14,180],[30,200],[58,196],[78,172],[96,140]]],exit:[96,140],exitVisible:true}),
L('schuine-streep','/',{entry:[0,140],strokes:[[[48,60],[12,200]]],exit:[56,140]}),
L('plus','+',{entry:[0,140],strokes:[[[8,150],[56,150]],[[32,126],[32,174]]],exit:[66,140]}),
L('is','=',{entry:[0,140],strokes:[[[8,137],[54,137]],[[8,162],[54,162]]],exit:[64,140]}),
];

const DIR=path.resolve(__dirname,'..','assets','onelinefont');
const want=process.argv.slice(2);
const chosen=want.length?GLYPHS.filter(g=>want.includes(g.ch)||want.includes(g.name)):GLYPHS;
if(!chosen.length){console.error('Geen tekens gevonden voor:',want.join(' '));process.exit(1);}
const label=g=>g.kind==='leesteken'?g.name:g.ch;
for(const g of chosen){
  // Oude versie van dit teken weghalen (de breedte zit in de bestandsnaam)
  const prefix=`one line font_${g.kind} ${label(g)} (`;
  for(const f of fs.readdirSync(DIR))if(f.startsWith(prefix))fs.unlinkSync(path.join(DIR,f));
  const {name,svg}=build(g);
  fs.writeFileSync(path.join(DIR,name),svg,'utf8');
}
console.log(`${chosen.length} teken(s) geschreven naar assets/onelinefont/. Draai nu: npm run build:font`);
