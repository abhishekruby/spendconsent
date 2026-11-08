import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing, Freeze, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme as t} from './theme';

export const ease = (frame: number, start = 0, frames = 15) => interpolate(frame, [start, start + frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
export const mono: CSSProperties = {fontFamily: t.mono, fontSize: 36, lineHeight: 1.35};
export const Paper = ({children}: {children: ReactNode}) => <AbsoluteFill style={{background: t.paper, color: t.ink, fontFamily: t.font}}>{children}</AbsoluteFill>;
export const Chip = ({children, accent = false}: {children: ReactNode; accent?: boolean}) => <div style={{...mono, padding: '10px 20px', border: `2px solid ${accent ? t.persimmon : t.line}`, background: accent ? t.persimmon : t.surface, color: accent ? t.surface : t.ink, borderRadius: 8, whiteSpace: 'nowrap'}}>{children}</div>;
export const KineticTitle = ({children, start = 0, size = 96, style}: {children: ReactNode; start?: number; size?: number; style?: CSSProperties}) => {
  const p = ease(useCurrentFrame(), start);
  return <div style={{fontSize: size, lineHeight: 1.04, fontWeight: 650, letterSpacing: '-0.045em', opacity: p, transform: `translateY(${(1-p)*28}px)`, ...style}}>{children}</div>;
};
export const StatCounter = ({value, suffix = '%', label, start = 0}: {value: number; suffix?: string; label: string; start?: number}) => {
  const n = Math.round(value * ease(useCurrentFrame(), start, 18));
  return <div style={{flex: 1, borderTop: `3px solid ${t.ink}`, paddingTop: 20}}><div style={{fontSize: 188, lineHeight: 1, fontWeight: 650, letterSpacing: '-0.06em', color: t.persimmon}}>{n}{suffix}</div><div style={{fontSize: 48, lineHeight: 1.16, maxWidth: 650, marginTop: 24}}>{label}</div></div>;
};
export const HighlightRing = ({style, start = 0}: {style?: CSSProperties; start?: number}) => {
  const p = ease(useCurrentFrame(), start, 12);
  return <div style={{position: 'absolute', border: `5px solid ${t.persimmon}`, borderRadius: 28, opacity: p, transform: `scale(${1.08 - .08*p})`, pointerEvents: 'none', ...style}}/>;
};
export const Stamp = ({children, start = 0}: {children: ReactNode; start?: number}) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const p = spring({frame: f-start, fps, config: {damping: 16, stiffness: 190, mass: .7}});
  return <div style={{...mono, fontSize: 64, fontWeight: 600, border: `5px solid ${t.persimmon}`, color: t.persimmon, padding: '12px 26px', transform: `rotate(-5deg) scale(${p})`, opacity: f < start ? 0 : 1}}>{children}</div>;
};
export const DeviceFrame = ({children, phone = false}: {children: ReactNode; phone?: boolean}) => <div style={{width: '100%', height: '100%', background: t.ink, padding: phone ? 12 : '12px 12px 20px', borderRadius: phone ? 56 : 18, boxShadow: '0 18px 48px #1a17141a', position: 'relative', overflow: 'hidden', boxSizing: 'border-box'}}><div style={{width: '100%', height: '100%', borderRadius: phone ? 46 : 8, overflow: 'hidden', position: 'relative'}}>{children}</div></div>;
export type ClipData = {src: string; from: number; duration: number; speed?: number; waitLabel?: string; crop?: {x: number; y: number; width: number; height: number}; approvalFrame?: number};
export const Footage = ({clip, label, zoom = 1.035, pan = 0}: {clip?: ClipData; label: string; zoom?: number; pan?: number}) => {
  const f = useCurrentFrame();
  if (!clip?.src) return <AbsoluteFill style={{background: t.surface, border: `2px dashed ${t.persimmon}`, justifyContent: 'center', alignItems: 'center', gap: 28}}><div style={{...mono, color: t.persimmon}}>DEVELOPMENT · MISSING FOOTAGE</div><div style={{fontSize: 64, fontWeight: 600}}>{label}</div><div style={{...mono, color: t.muted}}>Record the real application to complete this scene.</div></AbsoluteFill>;
  const speed = clip.speed ?? 1;
  const last = Math.max(0, Math.ceil(clip.duration / speed)-1);
  const progress = ease(f, 0, Math.max(15, last));
  const treatment = f > last ? 'HOLD · real footage' : (clip.waitLabel ? `${clip.waitLabel}${speed !== 1 ? ` · SPEED ×${speed}` : ''}` : (speed !== 1 ? `SPEED ×${speed} · real footage` : 'CUT · real footage'));
  const crop = clip.crop;
  const aspect = crop ? crop.width / crop.height : 1;
  const approvalStart = clip.approvalFrame === undefined ? null : Math.max(0, Math.ceil((clip.approvalFrame-clip.from)/speed));
  return <AbsoluteFill style={{background: t.surface, overflow: 'hidden', containerType: 'size'}}>
    <AbsoluteFill style={{top:84,height:'calc(100% - 84px)',containerType:'size',transform: `translateX(${pan*progress}px) scale(${1+(zoom-1)*progress})`}}>
      {crop ? <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', overflow: 'hidden', width: `min(100cqw, ${100*aspect}cqh)`, height: `min(100cqh, ${100/aspect}cqw)`}}>
        <Freeze frame={Math.min(f,last)}><OffthreadVideo src={staticFile(clip.src)} startFrom={clip.from} endAt={clip.from+clip.duration} playbackRate={speed} muted style={{position: 'absolute', left: `${-100*crop.x/crop.width}%`, top: `${-100*crop.y/crop.height}%`, width: `${192000/crop.width}%`, height: `${108000/crop.height}%`}}/></Freeze>
      </div> : <Freeze frame={Math.min(f,last)}><OffthreadVideo src={staticFile(clip.src)} startFrom={clip.from} endAt={clip.from+clip.duration} playbackRate={speed} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Freeze>}
    </AbsoluteFill>
    <div style={{position: 'absolute', left: 20, top: 18, ...mono, background: t.paper, padding: '6px 12px', color: t.ink, border: `1px solid ${t.line}`}}>{treatment}</div>
    {approvalStart !== null && Math.min(f,last) >= approvalStart && <div style={{position: 'absolute', right: 40, bottom: 112, background: t.paper}}><Stamp start={approvalStart}>APPROVED</Stamp></div>}
  </AbsoluteFill>;
};
export type Caption = {startFrame: number; endFrame: number; text: string};
export const Captions = ({captions}: {captions: Caption[]}) => {
  const f = useCurrentFrame(); const current = captions.find(c => f >= c.startFrame && f < c.endFrame);
  if (!current) return null;
  return <div style={{position: 'absolute', left: t.safe, right: t.safe, bottom: 96, display: 'flex', justifyContent: 'center', pointerEvents: 'none'}}><div style={{fontSize: 40, fontWeight: 500, lineHeight: 1.2, textAlign: 'center', color: t.surface, background: t.ink, padding: '14px 28px', borderRadius: 8, maxWidth: 1640, whiteSpace: 'pre-line'}}>{current.text}</div></div>;
};
export const ChapterProgress = ({index, title, globalFrame, totalFrames}: {index: number; title: string; globalFrame: number; totalFrames: number}) => <><div style={{position: 'absolute', left: t.safe, right: t.safe, top: 96, display: 'flex', justifyContent: 'space-between', color: t.muted, ...mono}}><span>SpendConsent</span><span>{String(index).padStart(2,'0')} / 08 · {title}</span></div><div style={{position: 'absolute', left: t.safe, right: t.safe, bottom: 96, height: 3, background: t.line}}><div style={{width: `${Math.min(100,100*globalFrame/totalFrames)}%`, height: '100%', background: t.persimmon}}/></div></>;
export const FlowDiagram = ({start = 0}: {start?: number}) => {
  const f = useCurrentFrame(); const labels = ['Agent', 'Exact cart', 'Owner', 'PayPal', 'Verified'];
  return <div style={{display: 'flex', alignItems: 'center', width: '100%', gap: 16}}>{labels.map((label,i) => <div key={label} style={{display: 'contents'}}><div style={{opacity: ease(f,start+i*5), flex: 1, padding: '26px 8px', borderTop: `3px solid ${i===2 ? t.persimmon : t.ink}`, fontSize: 40, fontWeight: 550, textAlign: 'center', color: i===2 ? t.persimmon : t.ink}}>{label}</div>{i<4 && <span style={{fontSize: 40, color: t.muted, opacity: ease(f,start+i*5)}}>→</span>}</div>)}</div>;
};
export const AnimatedTerminal = ({lines, duration}: {lines: string[]; duration: number}) => {
  const f = useCurrentFrame(); const pages = Math.max(1, Math.ceil(lines.length/3)); const pageFrames = Math.max(1,Math.floor(duration/pages)); const page = Math.min(pages-1,Math.floor(f/pageFrames)); const local = f-page*pageFrames; const visible = lines.slice(page*3,page*3+3);
  return <AbsoluteFill style={{background: t.ink, color: t.paper, padding: 40, borderRadius: 14}}><div style={{...mono, color: '#eaa68f', marginBottom: 26}}>real MCP session · excerpts{pages>1 ? ` · CUT ${page+1}/${pages}` : ' · CUT'}</div>{lines.length ? visible.map((line,i) => {const p = ease(local,i*12,10);return <div key={`${page}-${i}`} style={{...mono, fontSize: /cannot approve or pay/i.test(line) ? 64 : 38, marginBottom: 20, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', opacity: p, color: /cannot|no tool|never|not.*pay/i.test(line) ? '#eaa68f' : t.paper}}>{line}</div>;}) : <div style={{...mono, fontSize: 48, color: '#eaa68f'}}>MISSING MCP EVIDENCE<br/>Development preview only.</div>}</AbsoluteFill>;
};
