import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, Easing, Freeze, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme as t} from './theme';

export const ease = (frame: number, start = 0, frames = 18) => interpolate(frame, [start, start + frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
export const mono: CSSProperties = {fontFamily: t.mono, fontSize: 32, lineHeight: 1.35};
export const Paper = ({children}: {children: ReactNode}) => <AbsoluteFill style={{background: t.paper, color: t.ink, fontFamily: t.font}}>{children}</AbsoluteFill>;
export const KineticTitle = ({children, start = 0, size = 96, style}: {children: ReactNode; start?: number; size?: number; style?: CSSProperties}) => {
  const p = ease(useCurrentFrame(), start);
  return <div style={{fontSize: size, lineHeight: 1.04, fontWeight: 650, letterSpacing: '-0.045em', opacity: p, transform: `translateY(${(1-p)*28}px)`, ...style}}>{children}</div>;
};
export const StatCounter = ({value, suffix = '%', label, start = 0}: {value: number; suffix?: string; label: string; start?: number}) => <div style={{flex: 1, borderTop: `3px solid ${t.ink}`, paddingTop: 20}}><div style={{fontSize: 168, lineHeight: 1, fontWeight: 650, letterSpacing: '-0.06em', color: t.persimmon}}>{Math.round(value * ease(useCurrentFrame(), start))}{suffix}</div><div style={{fontSize: 44, lineHeight: 1.16, maxWidth: 700, marginTop: 24}}>{label}</div></div>;
export const HighlightRing = ({style, start = 0}: {style?: CSSProperties; start?: number}) => {
  const f = useCurrentFrame();
  return <div style={{position: 'absolute', outline: `4px solid ${t.persimmon}`, outlineOffset: 8, borderRadius: 18, opacity: ease(f, start, 18), transform: `scale(${1 + .012*Math.sin(Math.max(0,f-start)/10)})`, pointerEvents: 'none', ...style}}/>;
};
export const Stamp = ({children, start = 0}: {children: ReactNode; start?: number}) => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  const p = spring({frame: f-start, fps, config: {damping: 16, stiffness: 190, mass: .7}});
  return <div style={{...mono, fontSize: 24, lineHeight: 1, fontWeight: 600, border: `2px solid ${t.persimmon}`, color: t.persimmon, padding: '3px 12px', transform: `scale(${p})`, opacity: f < start ? 0 : 1}}>{children}</div>;
};
export type Panel = {x: number; y: number; width: number; height: number};
export const footageCard: Panel = {x: 160, y: 28, width: 1600, height: 900};
export const ownerPanels: Panel[] = [{x: 117.5, y: 28, width: 1240, height: 875}, {x: 1397.5, y: 28, width: 405, height: 875}];
export const assertPanels = (panels: Panel[]) => {
  for (const [i,a] of panels.entries()) {
    if (![a.x,a.y,a.width,a.height].every(Number.isFinite) || a.x < 0 || a.y < 0 || a.width <= 0 || a.height <= 0 || a.x+a.width > 1920 || a.y+a.height > 940) throw new Error('Footage panel must fit above the caption strip.');
    for (const b of panels.slice(i+1)) if (a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y) throw new Error('Footage panels must never intersect.');
  }
};
export const PanelFrame = ({children, panel = footageCard, phone = false}: {children: ReactNode; panel?: Panel; phone?: boolean}) => {
  assertPanels([panel]);
  return <div style={{position: 'absolute', left: panel.x, top: panel.y, width: panel.width, height: panel.height, borderRadius: phone ? 44 : 16, background: phone ? t.ink : t.paper, boxShadow: '0 12px 40px #1a171414', outline: `1px solid ${t.line}`, overflow: 'hidden', padding: phone ? 10 : 0, boxSizing: 'border-box'}}><div style={{position: 'relative', width: '100%', height: '100%', borderRadius: phone ? 34 : 16, overflow: 'hidden'}}>{children}</div></div>;
};
export type ClipData = {src: string; from: number; duration: number; speed?: number; waitLabel?: string; kind?: 'desktop' | 'requester' | 'phone' | 'paypal'; crop?: {x: number; y: number; width: number; height: number}; approvalFrame?: number; rings?: {startFrame: number; endFrame: number; x: number; y: number; width: number; height: number}[]};
export const Footage = ({clip, label}: {clip?: ClipData; label: string}) => {
  const f = useCurrentFrame();
  if (!clip?.src) return <AbsoluteFill style={{background: t.paper, justifyContent: 'center', alignItems: 'center', ...mono, color: t.persimmon}}>Missing real footage: {label}</AbsoluteFill>;
  const last = Math.max(0, Math.ceil(clip.duration/(clip.speed ?? 1))-1);
  return <AbsoluteFill style={{background: t.paper, overflow: 'hidden'}}><Freeze frame={Math.min(f,last)}><OffthreadVideo src={staticFile(clip.src)} startFrom={clip.from} endAt={clip.from+clip.duration} playbackRate={clip.speed ?? 1} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Freeze>{clip.rings?.map((ring,i) => f >= ring.startFrame && f < ring.endFrame ? <HighlightRing key={i} start={ring.startFrame} style={{left:`${ring.x*100}%`,top:`${ring.y*100}%`,width:`${ring.width*100}%`,height:`${ring.height*100}%`}}/> : null)}</AbsoluteFill>;
};
export type Caption = {startFrame: number; endFrame: number; text: string};
export const Captions = ({captions}: {captions: Caption[]}) => {
  const f = useCurrentFrame(); const current = captions.find(c => f >= c.startFrame && f < c.endFrame);
  return current ? <div style={{position: 'absolute', left: 320, width: 1260, top: 944, height: 120, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}><div style={{fontSize: 40, fontWeight: 500, lineHeight: 1.2, textAlign: 'center', color: t.ink, whiteSpace: 'pre-line', maxHeight: 96, overflow: 'hidden'}}>{current.text}</div></div> : null;
};
export const ChapterProgress = ({title, globalFrame, totalFrames, waitLabel}: {title: string; globalFrame: number; totalFrames: number; waitLabel?: string}) => <><div style={{position: 'absolute', left: 42, top: 978, width: 242, ...mono, fontSize: 27, color: t.muted}}>{title}</div><div style={{position:'absolute',left:42,top:1020,width:242,...mono,fontSize:20,whiteSpace:'nowrap',color:t.muted}}>Sandbox · test money</div>{waitLabel && <div style={{position: 'absolute', right: 36, top: 950, width: 275, height: 110, display: 'flex', alignItems: 'center', textAlign: 'right', justifyContent: 'flex-end', ...mono, fontSize: 22, color: t.muted}}>{waitLabel}</div>}<div style={{position: 'absolute', left: 0, right: 0, bottom: 2, height: 3, background: t.line}}><div style={{width: `${Math.min(100,100*globalFrame/totalFrames)}%`, height: '100%', background: t.persimmon}}/></div></>;
export const AnimatedTerminal = ({lines}: {lines: string[]}) => {
  const f=useCurrentFrame();
  return <AbsoluteFill style={{background: t.ink, color: t.paper, padding: 48, borderRadius: 16, justifyContent: 'center'}}><div style={{...mono, fontSize: 24, color: '#eaa68f', marginBottom: 36}}>real MCP session · excerpts</div>{lines.map((line,i) => <div key={i} style={{...mono, fontSize: 31, marginBottom: 24, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',opacity:i===0 ? 1 : ease(f,i*21,6),color: /cannot|no tool|never|not.*pay/i.test(line) ? '#eaa68f' : t.paper}}>{line}</div>)}</AbsoluteFill>;
};
