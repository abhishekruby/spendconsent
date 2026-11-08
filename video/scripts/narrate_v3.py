"""New Heart narration at 1.05. Each natural clause is independently timed, never cut mid-clause."""
import json,wave
from pathlib import Path
import numpy as np
from voice_samples import ROOT,load_engine

def main():
    scenes=json.loads((ROOT/'scene-script-v3.json').read_text());engine=load_engine()
    out=ROOT/'out/voice-v3';out.mkdir(exist_ok=True)
    prior=json.loads((out/'phrases.json').read_text()) if (out/'phrases.json').exists() else {'scenes':[]}
    cached={p['text']:(ROOT/p['file']).read_bytes() for s in prior['scenes'] for p in s['phrases']}
    manifest={'voice':'af_heart','speed':1.05,'phrase_sample_rate':24000,'scene_sample_rate':48000,'scenes':[]}
    for scene in scenes:
        phrases=[]
        for i,text in enumerate(scene['phrases']):
            target=out/f'{scene["id"]}-{i}.wav'
            if text in cached:
                target.write_bytes(cached[text])
                with wave.open(str(target),'rb') as w: seconds=w.getnframes()/w.getframerate()
                phrases.append({'text':text,'file':str(target.relative_to(ROOT)),'seconds':seconds})
                continue
            samples,rate=engine.create(text,voice='af_heart',speed=1.05,lang='en-us')
            assert rate==24000 and np.isfinite(samples).all()
            # Trim only synthesis silence, leave 45ms either side of real speech.
            samples=np.asarray(samples);active=np.flatnonzero(np.abs(samples)>.003)
            if active.size:samples=samples[max(0,active[0]-1080):min(len(samples),active[-1]+1080)]
            with wave.open(str(target),'wb') as w:
                w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(samples,-1,1)*32767).astype('<i2').tobytes())
            phrases.append({'text':text,'file':str(target.relative_to(ROOT)),'seconds':len(samples)/rate})
        manifest['scenes'].append({'id':scene['id'],'target_seconds':scene['seconds'],'speech_seconds':sum(p['seconds'] for p in phrases),'phrases':phrases})
        print(scene['id'],round(sum(p['seconds'] for p in phrases),2),'seconds speech',flush=True)
    (out/'phrases.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':main()
