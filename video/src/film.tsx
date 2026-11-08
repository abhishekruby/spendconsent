import type {ReactNode} from 'react';
import {AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import timelineSource from './timeline.json';
import editSource from './edit.json';
import {AnimatedTerminal, Caption, Captions, ChapterProgress, ClipData, Footage, KineticTitle, PanelFrame, Paper, Stamp, StatCounter, assertPanels, ease, footageCard, mono, ownerPanels} from './components';
import {theme as t} from './theme';

type Scene = {id: number; startFrame: number; durationFrames: number; voicePath: string; text: string; captions: Caption[]};
type Timeline = {fps: number; totalFrames: number; scenes: Scene[]};
type Edit = {clips: Record<string, ClipData>; mcpLines: string[]; mcpWaitSeconds?: number | null; realAIWaitSeconds: number | null; expiryMinutes: number | null; ready: boolean};
export const timeline = timelineSource as Timeline;
const edit = editSource as Edit;
const requiredClips = ['C1-typing','C1-wait','C1-understood','C2-offers','C2-market','C2-market-more','C2-rejections','C3-review','C3b-ask','C4-requester','C4-phone','C5-paypal','C5-thanks','C5-confirmed','C6-refund','C7-price','C4-montage','C5-montage'];
const viewportKinds: Record<string, ClipData['kind']> = {'C4-requester':'requester','C4-phone':'phone','C4-montage':'phone','C5-paypal':'paypal','C5-thanks':'paypal'};
const chapters = ['Trust','People','Shop','Cart','Approve','PayPal','Boundary','Try'];
export const shoppingShots = [
  {from:0,duration:90,name:'C1-typing'}, {from:90,duration:90,name:'C1-wait'},
  {from:180,duration:120,name:'C1-understood'}, {from:300,duration:120,name:'C3b-ask'},
  {from:420,duration:120,name:'C2-offers'}, {from:540,duration:120,name:'C2-market'},
  {from:660,duration:120,name:'C2-market-more'}, {from:780,duration:120,name:'C2-rejections'},
];
export const validateFilm = () => {
  if (timeline.fps !== 30 || timeline.totalFrames <= 0 || timeline.totalFrames > 5250) throw new Error('Film must be 30 fps and no longer than 2:55.');
  if (timeline.scenes.length !== 8 || timeline.scenes.some((s,i) => s.id !== i+1 || s.startFrame !== (i ? timeline.scenes[i-1].startFrame+timeline.scenes[i-1].durationFrames : 0) || s.durationFrames <= 0)) throw new Error('Timeline needs eight contiguous numbered scenes.');
  if (timeline.scenes[7].startFrame+timeline.scenes[7].durationFrames !== timeline.totalFrames) throw new Error('Timeline total does not match scenes.');
  if (timeline.scenes[2].durationFrames < 900 || timeline.scenes[7].durationFrames < 300) throw new Error('Shopping needs eight complete shots; proof needs a five-second end card.');
  for (const s of timeline.scenes) for (const c of s.captions) if (c.startFrame < 0 || c.endFrame > s.durationFrames || c.startFrame >= c.endFrame || c.text.split('\n').length > 2 || c.text.length > 118 || (c.text.includes('\n') && c.text.split('\n').some(line => line.length > 64))) throw new Error(`Scene ${s.id}: captions must be local, at most two lines, and brief enough to read.`);
  assertPanels([footageCard]); assertPanels(ownerPanels);
  if (ownerPanels[1].x-ownerPanels[0].x-ownerPanels[0].width < 40) throw new Error('Owner panels require a 40px gap.');
  if (edit.ready) {
    const missing = requiredClips.filter(key => !edit.clips[key]?.src || edit.clips[key].duration <= 0);
    if (missing.length || !edit.mcpLines.length || edit.mcpLines.some(line => !line.trim())) throw new Error(`Ready export missing real evidence: ${[...missing,...(!edit.mcpLines.length || edit.mcpLines.some(line => !line.trim()) ? ['MCP transcript'] : [])].join(', ')}`);
    if (timeline.scenes.some(s => !s.voicePath || !s.captions.length)) throw new Error('Ready export requires narration and captions in every scene.');
    if (!edit.realAIWaitSeconds || !Number.isFinite(edit.realAIWaitSeconds) || edit.realAIWaitSeconds <= 0) throw new Error('Hosted comparison latency must be measured.');
    const owner = edit.clips['C4-requester'];
    if (!Number.isInteger(owner.approvalFrame) || owner.approvalFrame! < owner.from || owner.approvalFrame! >= owner.from+owner.duration) throw new Error('Owner approval must have a measured source frame.');
    if (Math.abs(owner.duration/(owner.speed ?? 1)-edit.clips['C4-phone'].duration/(edit.clips['C4-phone'].speed ?? 1)) > 1) throw new Error('Owner and requester footage must stay synchronized.');
  }
  for (const [name, clip] of Object.entries(edit.clips)) {
    if (!Number.isInteger(clip.from) || clip.from < 0 || !Number.isInteger(clip.duration) || clip.duration <= 0 || !Number.isFinite(clip.speed ?? 1) || (clip.speed ?? 1) <= 0) throw new Error(`Invalid source-frame metadata: ${name}`);
    const c = clip.crop;
    if (edit.ready && !c) throw new Error(`Ready footage needs its measured source viewport: ${name}`);
    if ((clip.kind ?? 'desktop') !== (viewportKinds[name] ?? 'desktop')) throw new Error(`Unexpected viewport kind: ${name}`);
    if (c && (!Object.values(c).every(Number.isFinite) || c.x < 0 || c.y < 0 || c.width <= 0 || c.height <= 0)) throw new Error(`Invalid source crop: ${name}`);
    // crop is provenance for an already prepared full viewport, never a CSS crop.
    if (c && (clip.kind ?? 'desktop') === 'desktop' && (c.width < 1000 || Math.abs(c.width/c.height-16/9) > .002)) throw new Error(`Desktop crop must be 16:9 and at least 1000px wide: ${name}`);
    if (clip.waitLabel && !/wait shortened/i.test(clip.waitLabel)) throw new Error(`Only a compressed wait gets a label: ${name}`);
    for (const ring of clip.rings ?? []) if (![ring.startFrame,ring.endFrame,ring.x,ring.y,ring.width,ring.height].every(Number.isFinite) || ring.startFrame < 0 || ring.endFrame <= ring.startFrame || ring.x < 0 || ring.y < 0 || ring.width <= 0 || ring.height <= 0 || ring.x+ring.width > 1 || ring.y+ring.height > 1) throw new Error(`Invalid measured ring bounds: ${name}`);
  }
};
const Card = ({name}: {name: string}) => <PanelFrame><Footage clip={edit.clips[name]} label={name}/></PanelFrame>;
const Beat = ({from, duration, name, crossfade = true}: {from: number; duration: number; name: string; crossfade?: boolean}) => <Sequence from={from} durationInFrames={duration+8}><Fade enabled={crossfade}><Card name={name}/></Fade></Sequence>;
const Fade = ({children, enabled = true}: {children: ReactNode; enabled?: boolean}) => <AbsoluteFill style={{background:t.paper,opacity:enabled ? ease(useCurrentFrame(),0,8) : 1}}>{children}</AbsoluteFill>;
const Graphic = ({children}: {children: ReactNode}) => <div style={{position:'absolute',left:160,right:160,top:100,bottom:180}}>{children}</div>;
const Hook = ({duration}: {duration: number}) => {
  const f = useCurrentFrame();
  return f<117 ? <><Sequence durationInFrames={39}><PanelFrame><div style={{position:'absolute',left:592,top:12,width:416,height:876}}><Footage clip={edit.clips['C4-montage']} label="Owner phone tap"/></div></PanelFrame></Sequence><Beat from={39} duration={39} name="C5-montage" crossfade={false}/><Sequence from={78} durationInFrames={39}><PanelFrame><AnimatedTerminal lines={[edit.mcpLines.at(-1) ?? '']} /></PanelFrame></Sequence></> : <Graphic><Sequence from={117} layout="none"><KineticTitle size={118}>AI agents can<br/>shop for you.</KineticTitle></Sequence><div style={{marginTop:60,opacity:ease(f,Math.min(duration-90,210))}}><KineticTitle size={88}>Would you give one your card?</KineticTitle></div></Graphic>;
};
const Problem = ({scene}: {scene: Scene}) => {
  const f=useCurrentFrame(); const audience=scene.captions[2].startFrame;
  const cues = ['The AI does','A person approves','PayPal verifies'].map(text => scene.captions.find(c => c.text.startsWith(text))?.startFrame ?? scene.durationFrames);
  return f<audience ? <Graphic><KineticTitle size={72}>Shopping is easy. Trust is earned.</KineticTitle><div style={{display:'flex',gap:80,marginTop:64}}><StatCounter value={19} label="trust AI to make everyday purchases"/><StatCounter value={60} label="would quit an AI shopping agent after one mistake" start={10}/></div><div style={{...mono,fontSize:27,color:t.muted,marginTop:40}}>ACI Worldwide / YouGov · 2,080 UK adults · June 2026</div></Graphic> : <Graphic><div style={{...mono,color:t.persimmon,marginBottom:30}}>FOR SMALL TEAMS · CAFÉ / OFFICE / HOME</div><KineticTitle size={78}>One person orders.<br/>Someone else pays.</KineticTitle><div style={{fontSize:88,fontWeight:650,letterSpacing:'-.04em',marginTop:40}}>SpendConsent</div><div style={{display:'flex',gap:28,marginTop:48}}>{['AI shops','You decide','PayPal verifies'].map((label,i) => <div key={label} style={{flex:1,borderTop:`4px solid ${f>=cues[i] ? t.persimmon : t.line}`,paddingTop:24,color:f>=cues[i] ? t.persimmon : t.muted,opacity:f>=cues[i] ? 1 : .4,fontSize:54,fontWeight:600,transform:`translateY(${8*(1-ease(f,cues[i]))}px)`}}>{label}</div>)}</div></Graphic>;
};
const Shopping = ({duration}: {duration: number}) => <>{shoppingShots.map((shot,i) => <Beat key={shot.name} {...shot} duration={i===shoppingShots.length-1 ? duration-shot.from : shot.duration} crossfade={i>0}/>)}</>;
const ExactCart = () => <Card name="C3-review"/>;
const Owner = () => {
  const f=useCurrentFrame(); const clip=edit.clips['C4-requester']; const approved=clip?.approvalFrame === undefined ? Number.POSITIVE_INFINITY : Math.ceil((clip.approvalFrame-clip.from)/(clip.speed ?? 1));
  return <><PanelFrame panel={ownerPanels[0]}><Footage clip={clip} label="Requester complete viewport"/></PanelFrame><PanelFrame panel={ownerPanels[1]} phone><Footage clip={edit.clips['C4-phone']} label="Owner complete viewport"/></PanelFrame>{f>=approved && <div style={{position:'absolute',left:965,top:906,display:'flex',gap:24,alignItems:'center'}}><Stamp start={approved}>APPROVED</Stamp><span style={{...mono,fontSize:22,color:t.persimmon}}>live, no refresh</span></div>}</>;
};
const PayPal = ({duration}: {duration: number}) => <>
  <Sequence durationInFrames={158}><PanelFrame panel={{x:552,y:28,width:816,height:850}}><Footage clip={edit.clips['C5-paypal']} label="Real PayPal checkout"/></PanelFrame></Sequence>
  <Sequence from={150} durationInFrames={128}><Fade><PanelFrame panel={{x:552,y:28,width:816,height:850}}><Footage clip={edit.clips['C5-thanks']} label="Thanks for using PayPal"/></PanelFrame></Fade></Sequence>
  <Beat from={270} duration={150} name="C5-confirmed"/>
  <Sequence from={420} durationInFrames={188}><Fade><Graphic><KineticTitle size={100}>Paid means verified.</KineticTitle><div style={{...mono,fontSize:36,marginTop:36}}>Server → PayPal capture → independent read-back</div><div style={{display:'flex',gap:40,marginTop:100}}>{['Amount','Payee','Order'].map((label,i) => <ReadBack key={label} label={label} start={i*30}/>)}</div><div style={{fontSize:44,marginTop:80,color:t.muted}}>Every check must match.</div></Graphic></Fade></Sequence>
  <Beat from={600} duration={duration-600} name="C6-refund"/>
</>;
const ReadBack = ({label,start}: {label: string; start: number}) => <div style={{flex:1,opacity:ease(useCurrentFrame(),start),borderTop:`4px solid ${t.persimmon}`,paddingTop:30,fontSize:70,color:t.persimmon}}>✓ {label}</div>;
const Safety = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const terminal=252;
  return <><Sequence durationInFrames={terminal+8}><Card name="C7-price"/><div style={{position:'absolute',left:220,top:735,width:390,...mono,fontSize:36,lineHeight:1.4,color:t.persimmon}}>+$0.01 →<br/>approval revoked</div></Sequence><Sequence from={terminal} durationInFrames={duration-terminal}><Fade><div style={{position:'absolute',left:160,top:44,width:620,height:850}}><KineticTitle size={72}>Agents can shop.</KineticTitle><div style={{...mono,fontSize:32,marginTop:48}}>{['find_offers','prepare_cart','request_owner_approval','purchase_status'].map((tool,i) => <div key={tool} style={{padding:'20px 0',borderBottom:`1px solid ${t.line}`,opacity:ease(f,terminal+i*12)}}>{tool}</div>)}</div><div style={{marginTop:44,fontSize:40,fontWeight:600,color:t.persimmon}}>approve / pay<br/>— no such tool</div></div><PanelFrame panel={{x:820,y:28,width:940,height:900}}><AnimatedTerminal lines={edit.mcpLines}/></PanelFrame></Fade></Sequence></>;
};
const Proof = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const end=Math.max(150,duration-195);
  return f<end ? <Graphic><KineticTitle size={88}>Proof behind the promise.</KineticTitle><div style={{display:'flex',gap:70,marginTop:60}}><StatCounter value={160} suffix="/160" label="AI cases · 8 suites · 6 written blind"/><StatCounter value={150} suffix="+" label="automated tests" start={10}/></div><div style={{marginTop:60,fontSize:46,color:t.persimmon}}>~{Math.round(edit.realAIWaitSeconds ?? 0)} s per comparison, hosted</div><div style={{...mono,marginTop:24,color:t.muted}}>Sandbox only · test money</div><div style={{...mono,fontSize:36,marginTop:28,opacity:ease(f,60)}}>Agent → Exact cart → Owner → PayPal → Verified</div></Graphic> : <Sequence from={end} layout="none"><div style={{position:'absolute',left:160,right:160,top:170,display:'flex',gap:76,alignItems:'center'}}><div style={{flex:1}}><div style={{...mono,color:t.persimmon,marginBottom:30}}>LIVE DEMO · SANDBOX ONLY</div><KineticTitle size={112}>SpendConsent</KineticTitle><div style={{fontSize:54,lineHeight:1.18,marginTop:28}}>AI shops. You decide.<br/>PayPal verifies.</div><div style={{fontSize:40,marginTop:52,fontWeight:600,color:t.persimmon}}>spendconsent.ullagecloud.com</div></div><div style={{width:360,flexShrink:0}}><Img src={staticFile('end-qr.png')} style={{width:360,height:360}}/><div style={{...mono,textAlign:'center',marginTop:20}}>SCAN TO TRY</div></div></div><div style={{position:'absolute',left:160,right:160,top:800,...mono,fontSize:32,borderTop:`2px solid ${t.line}`,paddingTop:28}}>github.com/abhishekruby/paypal-ai-hackathon-2026</div></Sequence>;
};
const SceneContent = ({scene}: {scene: Scene}) => {
  const props={duration:scene.durationFrames};
  switch(scene.id) {case 1:return <Hook {...props}/>;case 2:return <Problem scene={scene}/>;case 3:return <Shopping {...props}/>;case 4:return <ExactCart/>;case 5:return <Owner/>;case 6:return <PayPal {...props}/>;case 7:return <Safety {...props}/>;case 8:return <Proof {...props}/>;default:return null;}
};
const sceneWaitLabel = (scene: Scene, frame: number) => {
  const name = scene.id === 3 ? shoppingShots.find(shot => frame>=shot.from && frame<shot.from+(shot.name==='C2-rejections' ? scene.durationFrames-shot.from : shot.duration))?.name : scene.id === 7 && frame<252 ? 'C7-price' : scene.id === 5 ? 'C4-requester' : scene.id === 6 ? frame<270 ? 'C5-paypal' : frame>=600 ? 'C6-refund' : undefined : undefined;
  const label = name ? edit.clips[name]?.waitLabel : undefined;
  return label && /wait shortened/i.test(label) ? label : undefined;
};
const SceneFrame = ({scene,globalFrame}: {scene: Scene; globalFrame: number}) => {
  const f=useCurrentFrame();
  return <><SceneContent scene={scene}/>{scene.voicePath && <Audio src={staticFile(scene.voicePath)}/>}<Captions captions={scene.captions}/><ChapterProgress title={chapters[scene.id-1]} globalFrame={globalFrame} totalFrames={timeline.totalFrames} waitLabel={sceneWaitLabel(scene,f)}/></>;
};
export const SpendConsent = () => {
  validateFilm(); const f=useCurrentFrame();
  return <Paper>{timeline.scenes.map(scene=><Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}><SceneFrame scene={scene} globalFrame={f}/></Sequence>)}{!edit.ready && <div style={{position:'absolute',top:0,left:0,right:0,textAlign:'center',background:t.persimmon,color:t.surface,fontFamily:t.mono,fontSize:24,lineHeight:'28px'}}>DEVELOPMENT PREVIEW · REAL RECORDINGS / EVIDENCE REQUIRED</div>}</Paper>;
};
