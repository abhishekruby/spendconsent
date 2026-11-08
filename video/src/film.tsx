import {AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import timelineSource from './timeline.json';
import editSource from './edit.json';
import {AnimatedTerminal, Caption, Captions, ChapterProgress, Chip, ClipData, DeviceFrame, FlowDiagram, Footage, HighlightRing, KineticTitle, Paper, StatCounter, ease, mono} from './components';
import {theme as t} from './theme';

type Scene = {id: number; startFrame: number; durationFrames: number; voicePath: string; text: string; captions: Caption[]};
type Timeline = {fps: number; totalFrames: number; scenes: Scene[]};
type Edit = {clips: Record<string, ClipData>; mcpLines: string[]; mcpWaitSeconds?: number | null; realAIWaitSeconds: number | null; expiryMinutes: number | null; ready: boolean};
export const timeline = timelineSource as Timeline;
const edit = editSource as Edit;
const requiredClips = ['C1-describe','C2-offers','C3-review','C3b-ask','C4-owner','C5-paypal','C6-refund','C7-price','C4-montage','C5-montage'];
const chapters = ['The question','The trust gap','AI shops','The exact cart','You decide','PayPal verifies','The boundary','Try it'];

export const validateFilm = () => {
  if (timeline.fps !== 30 || timeline.totalFrames <= 0 || timeline.totalFrames > 5250) throw new Error('Film must be 30 fps and no longer than 2:55.');
  if (timeline.scenes.length !== 8 || timeline.scenes.some((s,i) => s.id !== i+1 || s.startFrame !== (i ? timeline.scenes[i-1].startFrame+timeline.scenes[i-1].durationFrames : 0) || s.durationFrames <= 0)) throw new Error('Timeline needs eight contiguous numbered scenes.');
  if (timeline.scenes[7].startFrame+timeline.scenes[7].durationFrames !== timeline.totalFrames) throw new Error('Timeline total does not match scenes.');
  if (timeline.scenes[7].durationFrames < 300) throw new Error('Proof scene needs time for a five-second end card.');
  for (const s of timeline.scenes) for (const c of s.captions) if (c.startFrame < 0 || c.endFrame > s.durationFrames || c.startFrame >= c.endFrame || c.text.split('\n').length > 2 || c.text.length > 132 || (c.text.includes('\n') && c.text.split('\n').some(line => line.length > 76))) throw new Error(`Scene ${s.id}: captions must be local, at most two lines, and brief enough to read.`);
  if (edit.ready) {
    const missing = requiredClips.filter(key => !edit.clips[key]?.src || edit.clips[key].duration <= 0);
    if (missing.length || !edit.mcpLines.length) throw new Error(`Ready export missing real evidence: ${[...missing,...(!edit.mcpLines.length ? ['MCP transcript'] : [])].join(', ')}`);
    if (timeline.scenes.some(s => !s.voicePath || !s.captions.length)) throw new Error('Ready export requires narration and captions in every scene.');
  }
  for (const [name, clip] of Object.entries(edit.clips)) {
    if (!Number.isInteger(clip.from) || clip.from < 0 || !Number.isInteger(clip.duration) || clip.duration <= 0 || !Number.isFinite(clip.speed ?? 1) || (clip.speed ?? 1) <= 0 || (clip.approvalFrame !== undefined && (!Number.isInteger(clip.approvalFrame) || clip.approvalFrame < 0))) throw new Error(`Invalid source-frame metadata: ${name}`);
    const c = clip.crop;
    if (c && (!Object.values(c).every(Number.isFinite) || c.x < 0 || c.y < 0 || c.width <= 0 || c.height <= 0 || c.x+c.width > 1920 || c.y+c.height > 1080)) throw new Error(`Crop must fit the 1920×1080 source: ${name}`);
  }
};
const Stage = ({children}: {children: React.ReactNode}) => <div style={{position: 'absolute', top: 260, left: t.safe, right: t.safe, bottom: 268}}>{children}</div>;
const Heading = ({eyebrow, title}: {eyebrow: string; title: string}) => <div style={{position: 'absolute', top: 164, left: t.safe, right: t.safe, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 28}}><KineticTitle size={64}>{title}</KineticTitle><div style={{...mono, color: t.persimmon}}>{eyebrow}</div></div>;
const Clip = ({name, label, zoom = 1.035}: {name: string; label: string; zoom?: number}) => <DeviceFrame><Footage clip={edit.clips[name]} label={label} zoom={zoom}/></DeviceFrame>;
const ClipBeat = ({from, duration, name, label, zoom}: {from: number; duration: number; name: string; label: string; zoom?: number}) => <Sequence from={from} durationInFrames={duration}><Clip name={name} label={label} zoom={zoom}/></Sequence>;
const Hook = ({duration}: {duration: number}) => {
  const f = useCurrentFrame();
  return <>{f<120 ? <><Heading eyebrow="THE HUMAN STAYS IN CONTROL" title="AI can shop. Who gets to pay?"/><Stage><Sequence durationInFrames={45}><Clip name="C4-montage" label="Owner approves the exact cart"/></Sequence><Sequence from={45} durationInFrames={45}><Clip name="C5-montage" label="PayPal verifies the purchase"/></Sequence><Sequence from={90} durationInFrames={30}><AnimatedTerminal lines={[edit.mcpLines.at(-1)?.split(';')[0] || '']} duration={30}/></Sequence></Stage><div style={{position:'absolute',right:96,bottom:180}}><Chip accent>Sandbox · test money</Chip></div></> : <div style={{position:'absolute',left:96,right:96,top:240}}><div style={{...mono,color:t.persimmon,marginBottom:36}}>THE QUESTION</div><Sequence from={120} layout="none"><KineticTitle size={116}>AI agents can<br/>shop for you.</KineticTitle></Sequence><div style={{marginTop:48,opacity:ease(f,Math.min(duration-75,195))}}><KineticTitle size={86}>Would you give one your card?</KineticTitle></div></div>}</>;
};
const Problem = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const change=timeline.scenes[1].captions[2].startFrame;
  return f<change ? <><Heading eyebrow="THE TRUST GAP" title="Shopping is easy. Trust is earned."/><div style={{position:'absolute',left:96,right:96,top:276,display:'flex',gap:80}}><StatCounter value={19} label="trust AI to make everyday purchases"/><StatCounter value={60} label="would quit an AI shopping agent after one mistake" start={10}/></div><div style={{position:'absolute',left:96,right:96,bottom:252,...mono,color:t.muted}}>ACI Worldwide / YouGov · 2,080 UK adults · June 2026</div></> : <div style={{position:'absolute',left:96,right:96,top:200}}><div style={{...mono,color:t.persimmon,marginBottom:36}}>FOR SMALL TEAMS · CAFÉ / OFFICE / HOME</div><KineticTitle size={78}>One person orders.<br/>Someone else pays.</KineticTitle><div style={{marginTop:66,borderTop:`3px solid ${t.ink}`,paddingTop:30}}><KineticTitle size={112}>SpendConsent</KineticTitle><div style={{fontSize:50,marginTop:24}}>AI shops. You decide. PayPal verifies.</div></div></div>;
};
const Shopping = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const ask=315; const offers=450;
  return <><Heading eyebrow="01 · DESCRIBE → COMPARE" title="Your words. Real constraints."/><Stage><ClipBeat from={0} duration={ask} name="C1-describe" label="Describe a real request"/><ClipBeat from={ask} duration={offers-ask} name="C3b-ask" label="AI asks for the missing detail"/><ClipBeat from={offers} duration={duration-offers} name="C2-offers" label="Real AI result and retail comparison"/></Stage><div style={{position:'absolute',left:96,right:96,bottom:180,display:'flex',justifyContent:'space-between',gap:16}}><Chip>{f>=ask && f<offers ? 'Missing detail? It asks.' : 'Qwen3-4B · self-hosted · 1 tool call'}</Chip><Chip accent>Code does every number</Chip></div></>;
};
const ExactCart = () => <><Heading eyebrow="02 · IMMUTABLE APPROVAL" title="Exact cart. Every cent."/><Stage><Clip name="C3-review" label="Real exact-cart receipt"/></Stage><div style={{position:'absolute',left:96,bottom:180,display:'flex',gap:18}}><Chip>Merchant · packs · tax · delivery · total</Chip>{edit.expiryMinutes !== null && <div style={{position:"relative"}}><Chip accent>Expires in {edit.expiryMinutes} minutes</Chip><HighlightRing start={20} style={{inset:-8,borderRadius:14}}/></div>}</div></>;
const Owner = () => <><Heading eyebrow="03 · OWNER APPROVES" title="One exact cart. One human decision."/><Stage><Clip name="C4-owner" label="Owner phone → live requester update" zoom={1}/></Stage><div style={{position:'absolute',left:96,right:96,bottom:180,display:'flex',justifyContent:'space-between'}}><Chip>Private owner link</Chip><Chip accent>Phone → requester · live, no refresh</Chip></div></>;
const PayPal = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const diagram=Math.floor(duration*.53); const refund=Math.floor(duration*.75);
  return <><Heading eyebrow="04 · SERVER VERIFIED" title={f>=refund ? 'Changed your mind? Full refund.' : 'Paid means verified.'}/><Stage>{f<diagram ? <ClipBeat from={0} duration={diagram} name="C5-paypal" label="PayPal checkout and verified receipt"/> : f<refund ? <Sequence from={diagram} durationInFrames={refund-diagram}><div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',gap:66}}><KineticTitle size={80}>Server → PayPal capture → read-back</KineticTitle><div style={{display:'flex',gap:28}}>{['✓ amount','✓ payee','✓ order'].map((v,i)=><div key={v} style={{flex:1,fontSize:64,color:t.persimmon,borderTop:`3px solid ${t.persimmon}`,paddingTop:30,opacity:ease(f,diagram+10+i*7)}}>{v}</div>)}</div><div style={{fontSize:44,color:t.muted}}>All three must match before we call it paid.</div></div></Sequence> : <ClipBeat from={refund} duration={duration-refund} name="C6-refund" label="Owner refund and PayPal read-back"/>}</Stage><div style={{position:'absolute',right:96,bottom:180}}><Chip accent>Sandbox · test money</Chip></div></>;
};
const Safety = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const terminal=Math.floor(duration*.4);
  return <><Heading eyebrow="05 · AUTHORITY BOUNDARY" title={f<terminal ? 'Change one cent. Approval is void.' : 'Agents can shop. People decide.'}/><Stage><ClipBeat from={0} duration={terminal} name="C7-price" label="Real one-cent price change revokes approval"/><Sequence from={terminal} durationInFrames={duration-terminal}><AnimatedTerminal lines={edit.mcpLines} duration={duration-terminal}/></Sequence></Stage><div style={{position:'absolute',left:96,right:96,bottom:180,display:'flex',justifyContent:'space-between',gap:16}}><Chip accent>{f<terminal ? 'Pack price +$0.01 → approval void' : 'No MCP tool can approve or pay'}</Chip>{f>=terminal && edit.mcpWaitSeconds != null && <Chip>MCP wait shortened · real: {edit.mcpWaitSeconds} s</Chip>}</div></>;
};
const Proof = ({duration}: {duration: number}) => {
  const f=useCurrentFrame(); const end=Math.max(150,duration-195);
  return f<end ? <><Heading eyebrow="BUILT. TESTED. RUNNING." title="Proof behind the promise."/><div style={{position:'absolute',left:96,right:96,top:245}}><div style={{display:'flex',gap:70}}><StatCounter value={160} suffix="/160" label="AI cases · 8 suites · 6 written blind"/><StatCounter value={100} suffix="+" label="automated backend tests" start={10}/></div><div style={{marginTop:48}}><FlowDiagram start={160}/></div><div style={{display:'flex',gap:20,marginTop:20}}><Chip accent>Sandbox only</Chip></div></div></> : <Sequence from={end} layout="none"><div style={{position:'absolute',left:96,right:96,top:175,display:'flex',gap:76,alignItems:'center'}}><div style={{flex:1}}><div style={{...mono,color:t.persimmon,marginBottom:30}}>LIVE DEMO · SANDBOX ONLY</div><KineticTitle size={112}>SpendConsent</KineticTitle><div style={{fontSize:54,lineHeight:1.18,marginTop:28}}>AI shops. You decide.<br/>PayPal verifies.</div><div style={{fontSize:44,marginTop:52,fontWeight:600,color:t.persimmon}}>spendconsent.ullagecloud.com</div></div><div style={{width:360,flexShrink:0}}><Img src={staticFile('end-qr.png')} style={{width:360,height:360}}/><div style={{...mono,textAlign:'center',marginTop:20}}>SCAN TO TRY</div></div></div><div style={{position:'absolute',left:96,right:96,bottom:252,...mono,fontSize:36,borderTop:`2px solid ${t.line}`,paddingTop:28}}>github.com/abhishekruby/paypal-ai-hackathon-2026</div></Sequence>;
};
const SceneContent = ({scene}: {scene: Scene}) => {
  const props={duration:scene.durationFrames};
  switch(scene.id) {case 1:return <Hook {...props}/>;case 2:return <Problem {...props}/>;case 3:return <Shopping {...props}/>;case 4:return <ExactCart/>;case 5:return <Owner/>;case 6:return <PayPal {...props}/>;case 7:return <Safety {...props}/>;case 8:return <Proof {...props}/>;default:return null;}
};
export const SpendConsent = () => {
  validateFilm(); const f=useCurrentFrame();
  return <Paper>{timeline.scenes.map(scene=><Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationFrames}><SceneContent scene={scene}/>{scene.voicePath && <Audio src={staticFile(scene.voicePath)}/>}<Captions captions={scene.captions}/><ChapterProgress index={scene.id} title={chapters[scene.id-1]} globalFrame={f} totalFrames={timeline.totalFrames}/></Sequence>)}{!edit.ready && <div style={{position:'absolute',top:0,left:0,right:0,textAlign:'center',background:t.persimmon,color:t.surface,fontFamily:t.mono,fontSize:36,lineHeight:'44px'}}>DEVELOPMENT PREVIEW · REAL RECORDINGS / EVIDENCE REQUIRED</div>}</Paper>;
};
