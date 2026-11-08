import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/ibm-plex-mono/latin-400.css';
import {SpendConsent, timeline, validateFilm} from './film';
import {theme} from './theme';
import {SpendConsentV3, v3, validateV3} from './v3/film';

const SetupSlate = () => <AbsoluteFill style={{background: theme.paper, color: theme.ink, padding: theme.safe, justifyContent: 'center', fontFamily: theme.font}}><div style={{fontFamily: theme.mono, color: theme.persimmon, fontSize: 36, marginBottom: 32}}>DEVELOPMENT · VOICE: KOKORO AF_HEART</div><div style={{fontSize: 128, fontWeight: 650, letterSpacing: '-0.04em'}}>SpendConsent</div><div style={{fontSize: 56, marginTop: 32}}>AI shops. You decide. PayPal verifies.</div></AbsoluteFill>;
registerRoot(() => <><Composition id="SpendConsent" component={SpendConsent} width={1920} height={1080} fps={30} durationInFrames={timeline.totalFrames} calculateMetadata={() => {validateFilm(); return {durationInFrames: timeline.totalFrames};}}/><Composition id="SpendConsentV3" component={SpendConsentV3} width={1920} height={1080} fps={30} durationInFrames={v3.totalFrames} calculateMetadata={() => {validateV3();return {durationInFrames:v3.totalFrames};}}/><Composition id="SetupSlate" component={SetupSlate} width={1920} height={1080} fps={30} durationInFrames={150}/></>);
