import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/ibm-plex-mono/latin-400.css';
import {theme} from './theme';

// Setup slate only. The film's timing will follow the chosen voice.
const SetupSlate = () => (
  <AbsoluteFill style={{background: theme.paper, color: theme.ink,
    padding: theme.safe, justifyContent: 'center', fontFamily: theme.font}}>
    <div style={{fontFamily: theme.mono, color: theme.persimmon, fontSize: 36,
      marginBottom: 32}}>VOICE SELECTION · SETUP PREVIEW</div>
    <div style={{fontSize: 128, fontWeight: 650, letterSpacing: '-0.04em'}}>
      SpendConsent
    </div>
    <div style={{fontSize: 56, marginTop: 32}}>
      AI shops. You decide. PayPal verifies.
    </div>
  </AbsoluteFill>
);

registerRoot(() => <Composition id="SetupSlate" component={SetupSlate}
  width={1920} height={1080} fps={30} durationInFrames={150}/>);
