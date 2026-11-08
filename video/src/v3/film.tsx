import React from 'react';
import {AbsoluteFill, Audio, Easing, Freeze, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import timelineData from './timeline.json';
import assetData from './assets.json';
import evidence from '../../evidence-v3.json';
import {theme as t} from '../theme';

type Rect=number[];
type Ring={rect:Rect;at:number};
type Camera={overview:boolean;base:Rect;start:Rect;end:Rect};
type Asset={src:string;kind:string;width:number;height:number;durationFrames:number;sidebar:Rect|null};
type Shot={id:number;scene:number;from:number;duration:number;kind:string;asset?:string;camera?:Camera;text?:string;size?:number;kicker?:string;sub?:string;source?:string;value?:string;label?:string;offset?:number;holdAtFrame?:number;changeFrame?:number;splice?:boolean;focus?:string;overview?:boolean;close?:boolean;rings?:Ring[];tags?:boolean;live?:boolean;shields?:boolean;wordRate?:number;wait?:string;note?:string};
export const v3=timelineData;
const shots=v3.shots as Shot[];
const assets=assetData as Record<string,Asset>;
const mono={fontFamily:t.mono};
const clamp=(f:number,a:number,b:number)=>Math.min(b,Math.max(a,f));
const progress=(f:number,a=0,n=18)=>interpolate(f,[a,a+n],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.out(Easing.cubic)});
const mix=(a:Rect,b:Rect,p:number)=>a.map((n,i)=>n+(b[i]-n)*p);
const full:Rect=[160,28,1600,900];
const sourceQuote='are considered transactions\nauthorized by you.';

export function validCrop(r:Rect,asset:Asset,portrait=false){
  const [x,y,w,h]=r;
  if(r.length!==4||!r.every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>asset.width+.01||y+h>asset.height+.01)throw Error('V3 camera outside source: '+r);
  const native=x===0&&y===0&&w===asset.width&&h===asset.height;
  if(!portrait&&!(asset.kind==='requester'&&native)&&(w<760||h<427.5||Math.abs(w/h-16/9)>.002))throw Error('V3 desktop needs16:9 and760px minimum.');
  if(asset.sidebar){
    const [sx,sy,sw,sh]=asset.sidebar;
    const intersects=x<sx+sw&&x+w>sx;
    if(intersects&&!(x<=sx&&x+w>=sx+sw&&y<=sy&&y+h>=sy+sh))throw Error('Sliced sidebar forbidden: '+r);
  }
}
export function validateV3(){
  for(const bad of [[500,260,1104,621],[728,260,650,80],[728,260,700,393.75]]){let rejected=false;try{validCrop(bad,assets.understood);}catch{rejected=true;}if(!rejected)throw Error('Crop regression: sliced/sidebar/narrow accepted');}
  if(v3.totalFrames<=0||v3.totalFrames>5250||v3.fps!==30)throw Error('Unexpected duration/fps');
  if(evidence.transcript[2].response.result.content![0].text!=='Unknown tool pay.'||!evidence.transcript[2].response.result.isError||evidence.money_moved_cents!==0)throw Error('Real rejection evidence required');
  for(const [i,s]of shots.entries()){
    if(s.duration<=0||(s.duration>150&&s.kind!=='dare')||(i&&shots[i-1].from+shots[i-1].duration!==s.from))throw Error('Gap, long hold or invalid shot');
    if(s.asset&&!assets[s.asset])throw Error('Missing actual take '+s.asset);
    if(s.camera&&s.asset){
      const a=assets[s.asset];validCrop(s.camera.base,a);validCrop(s.camera.start,a);validCrop(s.camera.end,a);
      for(let f=0;f<s.duration;f++)validCrop(mix(s.camera.start,s.camera.end,progress(f,s.camera.overview?30:0,Math.max(1,s.duration-30))),a);
    }
    if(s.wait&&s.wait.length>27)throw Error('Wait label must remain a single readable line');
  }
  const live=shots.find(s=>s.kind==='approval-live')!;
  if(live.from+live.changeFrame! !==v3.events.approved||v3.events.block3!==v3.events.error)throw Error('V4 change/stamp/tracker must land together');
  if(shots.at(-1)!.from+shots.at(-1)!.duration!==v3.totalFrames)throw Error('Bad end card');
}
const Paper=({children}:{children:React.ReactNode})=><AbsoluteFill style={{background:t.paper,color:t.ink,fontFamily:t.font}}>{children}</AbsoluteFill>;
const centred:React.CSSProperties={position:'absolute',left:96,right:96,top:60,height:820,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center'};
const Shield=({on,size=42,opacity=1}:{on:boolean;size?:number;opacity?:number})=><svg width={size*.88} height={size} viewBox="0 0 38 44" style={{opacity,flexShrink:0}}><path d="M19 2L35 8V23C35 31 28 38 19 42C10 38 3 31 3 23V8Z" fill={on?t.persimmon:'none'} stroke={on?t.persimmon:t.ink} strokeWidth="2.4"/>{on&&<path d="M10 21L16 27L28 14" fill="none" stroke={t.surface} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}</svg>;
const Source=({children}:{children:React.ReactNode})=><div style={{position:'absolute',left:110,right:110,bottom:136,textAlign:'center',...mono,fontSize:36,lineHeight:1.3,color:t.muted}}>{children}</div>;

function Words({shot}:{shot:Shot}){
  const f=useCurrentFrame(),split=(shot.text??'').split('|');
  const text=split[Math.min(split.length-1,Math.floor(f/30))];
  const words=text.split(' ');
  return <><div style={{...centred,transform:'scale('+(1+.012*progress(f,0,shot.duration))+')'}}>
    {shot.kicker&&<div style={{...mono,fontSize:40,color:t.persimmon,marginBottom:30}}>{shot.kicker}</div>}
    <div style={{fontSize:shot.size??176,fontWeight:680,lineHeight:1.02,letterSpacing:'-.04em',whiteSpace:'pre-line',transform:'translateY('+(12*(1-progress(f,0,10)))+'px)'}}>
      {shot.wordRate&&split.length===1?words.map((w,i)=><React.Fragment key={i}><span style={{color:f>=i*5?t.ink:t.muted,opacity:f>=i*5?1:.25}}>{w}</span>{i<words.length-1?' ':''}</React.Fragment>):text}
    </div>
    {shot.sub&&<div style={{fontSize:54,marginTop:42,color:t.muted}}>{shot.sub}</div>}
    {shot.shields&&<div style={{display:'flex',gap:70,marginTop:54}}>{[0,1,2].map(i=><Shield key={i} on={false} size={92} opacity={.25+.75*progress(f,i*8,12)}/>)}</div>}
  </div>{shot.source&&<Source>{shot.source}</Source>}</>;
}
function Tracker(){
  const f=useCurrentFrame();const events=[v3.events.block1,v3.events.block2,v3.events.block3];const n=events.filter(x=>f>=x).length;
  return <><div style={{position:'absolute',left:96,top:962,display:'flex',alignItems:'center',gap:12}}>
    {events.map((x,i)=><div key={i} style={{transform:'translateY('+(f>=x?-4*(1-progress(f,x,10)):0)+'px)'}}><Shield on={f>=x}/></div>)}
    <div style={{...mono,fontSize:36,fontWeight:500,marginLeft:8,whiteSpace:'nowrap'}}>BLOCKED {n}/3</div>
  </div><div style={{position:'absolute',left:96,top:1034,...mono,fontSize:26,color:t.muted}}>Sandbox · test money</div>
  <div style={{position:'absolute',left:0,right:0,bottom:2,height:3,background:t.line}}><div style={{height:'100%',width:(100*f/v3.totalFrames)+'%',background:t.persimmon}}/></div></>;
}
function Captions(){
  const f=useCurrentFrame();
  const caption=v3.scenes.flatMap(s=>s.captions.map(c=>({...c,start:c.startFrame+s.startFrame,end:c.endFrame+s.startFrame}))).find(c=>f>=c.start&&f<c.end);
  if(!caption)return null;
  const key=/pay|paid|paypal|wrong|money|guess|asks|size|yes|cart|revoked|nothing|refund|14|160|cent|without|exist|mistake|authorized/i;
  const bits=caption.text.split(/(\s+)/);
  return <div style={{position:'absolute',left:530,width:860,top:942,height:126,display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',pointerEvents:'none'}}><div data-caption style={{fontSize:44,lineHeight:1.18,fontWeight:530,maxWidth:860,maxHeight:108,overflow:'hidden'}}>{bits.map((w,i)=><span key={i} style={{color:key.test(w)?t.persimmon:t.ink}}>{w}</span>)}</div></div>;
}
function Frame({children,rect=full,whip=false}:{children:React.ReactNode;rect?:Rect;whip?:boolean}){
  const f=useCurrentFrame();const [x,y,w,h]=rect;
  if(x<0||y<0||x+w>1920||y+h>940)throw Error('Frame invades captions/canvas');
  return <div style={{position:'absolute',left:x,top:y,width:w,height:h,background:t.paper,borderRadius:16,outline:'1px solid '+t.line,boxShadow:'0 12px 40px #1a171412',overflow:'hidden',transform:whip?'translateX('+(64*(1-progress(f,0,8)))+'px)':'none'}}>{children}</div>;
}
function VideoLayer({asset,crop,offset=0,opacity=1,rings=[],tags=false,at=0,panel=full}:{asset:Asset;crop:Rect;offset?:number;opacity?:number;rings?:Ring[];tags?:boolean;at?:number;panel?:Rect}){
  const f=useCurrentFrame(),w=panel[2],h=panel[3];
  const scale=Math.min(w/crop[2],h/crop[3]),dx=(w-crop[2]*scale)/2,dy=(h-crop[3]*scale)/2;
  const allRings=tags?[...rings,...[[848,366,55,48],[1056,366,92,48],[1156,366,84,48]].map((r,i)=>({rect:r,at:1.8+i*.35}))]:rings;
  return <AbsoluteFill style={{opacity,overflow:'hidden',background:t.paper}}><Freeze frame={Math.min(offset+f,asset.durationFrames-1)}><OffthreadVideo src={staticFile(asset.src)} muted style={{position:'absolute',width:asset.width*scale,height:asset.height*scale,maxWidth:'none',left:dx-crop[0]*scale,top:dy-crop[1]*scale}}/></Freeze>
    {allRings.map((ring,i)=>{const [x,y,rw,rh]=ring.rect;const begin=Math.round(ring.at*30);return f>=begin?<div key={i} style={{position:'absolute',left:dx+(x-crop[0])*scale,top:dy+(y-crop[1])*scale,width:rw*scale,height:rh*scale,borderRadius:14,outline:'4px solid '+t.persimmon,outlineOffset:7,opacity:progress(f,begin,8),transform:'scale('+(1+.006*Math.sin((f-begin)/10))+')'}}/>:null;})}</AbsoluteFill>;
}
function CameraClip({shot,rect=full}:{shot:Shot;rect?:Rect}){
  const f=useCurrentFrame(),a=assets[shot.asset!],cam=shot.camera!;
  const begin=cam.overview?30:0;
  const p=progress(f,begin,Math.max(21,shot.duration-begin));
  const crop=mix(cam.start,cam.end,p);
  const cross=cam.overview?progress(f,30,8):1;
  return <Frame rect={rect} whip={shot.live}>
    {cam.overview&&f<38&&<VideoLayer asset={a} crop={cam.base} panel={rect} offset={shot.offset} opacity={1}/>}
    {(f>=30||!cam.overview)&&<VideoLayer asset={a} crop={crop} panel={rect} offset={shot.offset} opacity={cross} rings={shot.rings} tags={shot.tags}/>}
  </Frame>;
}
function Viewport({asset,rect}:{asset:string;rect:Rect}){
  const a=assets[asset];return <Frame rect={rect}><VideoLayer asset={a} crop={[0,0,a.width,a.height]} panel={rect}/></Frame>;
}
function OwnerSplit(){
  const panels=[[117.5,28,1240,875],[1397.5,28,405,875]];
  if(panels[1][0]-panels[0][0]-panels[0][2]<40)throw Error('Owner panels overlap');
  return <><Viewport asset="waiting-requester" rect={panels[0]}/><Viewport asset="waiting-phone" rect={panels[1]}/></>;
}
function Phone({shot}:{shot:Shot}){
  const f=useCurrentFrame(),a=assets[shot.asset!],rect=[285,28,1350,900];
  const detail=[5,490,380,253.333333];
  // V4: show the real checkbox and tap at1x; cut only their intervening wait.
  const sourceFrame=shot.splice?(f<12?15+f:63+Math.min(f-12,23)):f;
  return <Frame rect={rect}><Freeze frame={sourceFrame}><VideoLayer asset={a} crop={detail} panel={rect}/></Freeze></Frame>;
}
function ApprovalLive({shot}:{shot:Shot}){
  const f=useCurrentFrame(),a=assets[shot.asset!],change=shot.changeFrame!;
  return <><Frame><VideoLayer asset={a} crop={shot.camera!.end} offset={shot.offset}/>
    {f>=change&&f<change+21&&<AbsoluteFill style={{background:'#1a171466'}}/>}
  </Frame><Sequence from={change} durationInFrames={21}><Stamp text="APPROVED"/></Sequence></>;
}
function Beside({shot}:{shot:Shot}){
  const a=assets[shot.asset!];
  let rect=[96,140,1152,648],crop:Rect,hold=false;
  if(shot.focus==='offers'){
    rect=full;crop=[704,140,1216,684];
  }else if(shot.focus==='phone'){
    rect=[96,76,1120,746.666667];crop=[5,490,380,253.333333];
  }else if(shot.focus==='mandate'){
    crop=[430,418,768,432];hold=true;
  }else{crop=[728,270,768,432];hold=true;}
  validCrop(crop,a,a.kind==='phone');
  return <><Frame rect={rect}><VideoLayer asset={a} crop={crop} panel={rect} offset={hold?a.durationFrames-1:0}/></Frame>
    <div style={{position:'absolute',left:shot.focus==='offers'?1240:1320,width:shot.focus==='offers'?500:504,top:235,height:430,display:'flex',alignItems:'center',fontSize:shot.focus==='confirmed'?100:112,fontWeight:680,lineHeight:1.04,letterSpacing:'-.04em',whiteSpace:'pre-line'}}>{shot.text}</div></>;
}
function Verification({shot}:{shot:Shot}){
  const f=useCurrentFrame(),a=assets.confirmed,rect=[96,140,1152,648];
  const labels=['AMOUNT','PAYEE','ORDER','VERIFIED'],index=labels.indexOf(shot.focus!);
  return <><Frame rect={rect}><VideoLayer asset={a} crop={[728,270,768,432]} panel={rect} offset={a.durationFrames-1}/></Frame>
    <div style={{position:'absolute',left:1320,top:200,width:504,display:'flex',flexDirection:'column',gap:48,fontSize:68,fontWeight:650}}>{labels.map((label,i)=><div key={label} style={{opacity:i<index?1:i===index?progress(f,0,8):0,color:i===3?t.persimmon:t.ink}}>{i<3?'✓ ':''}{label}</div>)}</div></>;
}

function Paypal({shot}:{shot:Shot}){
  const f=useCurrentFrame(),a=assets[shot.asset!];
  if(shot.focus==='button'){
    const crop=mix([0,545,1190,669.375],[0,565,1190,669.375],progress(f,0,shot.duration));
    return <Frame><Freeze frame={Math.min(f,(shot.holdAtFrame??a.durationFrames-1)-(shot.offset??0))}><VideoLayer asset={a} crop={crop} offset={shot.offset} rings={[{rect:[64,868,1072,94],at:0}]}/></Freeze></Frame>;
  }
  const rect=[528,28,864,900],crop=[0,0,1190,1240];
  return <Frame rect={rect}><Freeze frame={Math.min(f,shot.holdAtFrame??f)}><VideoLayer asset={a} crop={crop} panel={rect} offset={shot.offset} rings={shot.focus==='amount'?[{rect:[1010,22,160,70],at:0}]:[]}/></Freeze></Frame>;
}
function Stamp({text}:{text:string}){
  const f=useCurrentFrame(),s=spring({frame:f,fps:30,config:{damping:18,stiffness:240,mass:.6}});
  return <div style={{...centred,transform:'scale('+(1.13-.13*s)+')',opacity:1}}><div style={{fontSize:220,fontWeight:700,letterSpacing:'-.045em',lineHeight:1.05,color:t.persimmon,border:'7px solid '+t.persimmon,padding:'40px 70px',transform:'rotate(-2deg)'}}>{text}</div></div>;
}
function Terminal({kind}:{kind:string}){
  const f=useCurrentFrame(),rpc=evidence.transcript[2].request;
  const request=kind==='cold-terminal'?'agent > pay($41.80)':'tools/call\n'+JSON.stringify(rpc.params,null,2);
  const typed=kind==='cold-terminal'?request.slice(0,Math.min(request.length,7+Math.floor(f/3))):request.slice(0,Math.max(12,Math.floor(f*1.4)));
  const result=kind==='rpc-result';
  return <><AbsoluteFill style={{height:940,background:t.ink,color:t.paper,padding:120,justifyContent:'center'}}>
    <div style={{...mono,fontSize:32,color:'#eaa68f',marginBottom:46}}>{kind==='cold-terminal'?'REAL MCP CALL · request shorthand':'real MCP session · controlled rejection test'}</div>
    {result?<><div style={{...mono,fontSize:38,color:t.paper,marginBottom:40}}>tools/call · name: pay</div><div style={{...mono,fontSize:128,color:'#f27a52',letterSpacing:'-.04em',transform:'scale('+(1+.03*progress(f,0,shotLength(kind)))+')',transformOrigin:'left center'}}>{evidence.transcript[2].response.result.content![0].text}</div><div style={{...mono,fontSize:36,marginTop:42,color:'#eaa68f'}}>isError: true</div></>:<div style={{...mono,fontSize:kind==='cold-terminal'?96:52,whiteSpace:'pre-wrap',lineHeight:1.35}}>{typed}<span style={{opacity:Math.floor(f/15)%2?0:1}}>▍</span></div>}
  </AbsoluteFill></>;
}
const shotLength=(_:string)=>90;
function Tools(){
  const f=useCurrentFrame();const names=evidence.transcript[1].response.result.tools!.map(x=>x.name);
  return <><div style={{...centred,justifyContent:'center',gap:55}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'32px 100px',width:1500,...mono,fontSize:50}}>{names.map((name,i)=><div key={name} style={{borderBottom:'2px solid '+t.line,paddingBottom:20,opacity:.35+.65*progress(f,i*8,10)}}>{name}</div>)}</div><div style={{fontSize:120,fontWeight:650,lineHeight:1.03,color:t.persimmon}}>approve / pay:<br/>no such tool.</div></div></>;
}
function Stat({shot}:{shot:Shot}){
  const f=useCurrentFrame();
  return <><div style={centred}><div style={{fontSize:shot.value==='160/160'?260:300,fontWeight:680,lineHeight:.95,letterSpacing:'-.055em',color:t.persimmon,transform:'scale('+(1+.015*progress(f,0,shot.duration))+')'}}>{shot.value}</div><div style={{fontSize:58,lineHeight:1.15,marginTop:42,maxWidth:1500}}>{shot.label}</div><div style={{height:4,width:1050*progress(f,0,shot.duration),background:t.ink,marginTop:48}}/></div>{shot.source&&<Source>{shot.source}</Source>}</>;
}
function Quote(){
  const f=useCurrentFrame();return <><div style={{...centred,gap:35,transform:'scale('+(1+.015*progress(f,0,96))+')'}}><div style={{fontSize:44}}>Purchases by an AI agent you approved</div><div style={{fontSize:120,lineHeight:1.05,fontWeight:650,letterSpacing:'-.035em',whiteSpace:'pre-line'}}>“{sourceQuote}”</div></div><Source>A major US retailer’s terms · updated Sept 2026</Source></>;
}
function Zero(){
  const f=useCurrentFrame();return <><div style={{...centred,transform:'scale('+(1+.02*progress(f,0,105))+')'}}><div style={{fontSize:220,fontWeight:680,lineHeight:1,letterSpacing:'-.05em'}}>$0.00<br/><span style={{color:t.persimmon}}>moved.</span></div><div style={{fontSize:44,marginTop:36}}>By these three unauthorized attempts.</div></div><Source>Unauthorized attempts only · approved checkout shown separately</Source></>;
}
function Dare(){
  const f=useCurrentFrame();return <><div style={{position:'absolute',left:160,top:90,fontSize:64,fontWeight:650}}>SpendConsent</div><div style={{position:'absolute',left:160,top:235,width:1070,fontSize:120,fontWeight:650,lineHeight:1.02,letterSpacing:'-.04em',transform:'translateY('+(12*(1-progress(f,0,12)))+'px)'}}>Try to make it<br/>pay without you.</div>
    <div style={{position:'absolute',right:160,top:205,width:390}}><Img src={staticFile('end-qr.png')} style={{width:390,height:390}}/><div style={{...mono,textAlign:'center',fontSize:36,marginTop:25}}>SCAN TO TRY</div></div>
    <div style={{position:'absolute',left:160,top:650,fontSize:36,color:t.muted}}>Test money · one-minute challenge</div>
    <div style={{position:'absolute',left:160,top:715,fontSize:42,color:t.persimmon,fontWeight:600}}>spendconsent.ullagecloud.com</div>
    <div style={{position:'absolute',left:160,top:800,fontSize:38}}>AI shops. A person decides. PayPal verifies.</div>
    <div style={{position:'absolute',left:160,top:875,...mono,fontSize:36}}>github.com/abhishekruby/paypal-ai-hackathon-2026</div>
  </>;
}
function Content({shot}:{shot:Shot}){
  switch(shot.kind){
    case 'words':return <Words shot={shot}/>;
    case 'quote':return <Quote/>;
    case 'stat':return <Stat shot={shot}/>;
    case 'clip':case 'requester':return <CameraClip shot={shot}/>;
    case 'owner-split':return <OwnerSplit/>;
    case 'phone':return <Phone shot={shot}/>;
    case 'approval-live':return <ApprovalLive shot={shot}/>;
    case 'beside':return <Beside shot={shot}/>;
    case 'verification':return <Verification shot={shot}/>;
    case 'paypal':return <Paypal shot={shot}/>;
    case 'stamp':return <Stamp text={shot.text!}/>;
    case 'cold-terminal':case 'rpc-request':case 'rpc-result':return <Terminal kind={shot.kind}/>;
    case 'tools':return <Tools/>;
    case 'zero':return <Zero/>;
    case 'check':return <Words shot={{...shot,text:'✓ '+shot.text,size:178}}/>;
    case 'dare':return <Dare/>;
    default:throw Error('Unknown shot '+shot.kind);
  }
}
export function SpendConsentV3(){
  const f=useCurrentFrame(),active=shots.find(s=>f>=s.from&&f<s.from+s.duration)!;
  const local=f-active.from;
  const note=active.live&&local>=(active.changeFrame??39)?'live, no refresh':active.wait??active.note;
  return <Paper>{shots.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}><Content shot={s}/></Sequence>)}<Audio src={staticFile('soundtrack-v'+v3.version+'.wav')}/><Tracker/><Captions/>{note&&<div style={{position:'absolute',right:96,top:990,width:420,textAlign:'right',...mono,fontSize:26,whiteSpace:'nowrap',color:active.live?t.persimmon:t.muted}}>{note}</div>}</Paper>;
}
