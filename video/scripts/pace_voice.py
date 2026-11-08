"""Place the approved voice phrases against the real actions, without speeding speech."""
import hashlib
import json
from pathlib import Path
import wave

ROOT=Path(__file__).resolve().parents[1]
STARTS={
    1:[4.3,8.0], 2:[.4,3.9,6.5,12.9,14.8,17.0],
    3:[.4,2.8,8.1,10.7,15.5,23.0], 4:[.6,3.2,10.4],
    5:[.5,5.0,14.3,18.4], 6:[.4,5.0,14.8,20.0,22.0],
    7:[2.7,9.0,12.7,17.2], 8:[.4,8.3,10.7,12.0,15.0],
}


def main():
    source=ROOT/'out/voice/timeline-unpaced.json'
    timeline=json.loads(source.read_text())
    output=ROOT/'out/voice-paced';output.mkdir(exist_ok=True)
    manifest=[]
    for scene in timeline['scenes']:
        with wave.open(str(ROOT/f'out/voice/scene-{scene["id"]}.wav'),'rb') as wav:
            assert (wav.getnchannels(),wav.getsampwidth(),wav.getframerate())==(1,2,48000)
            audio=wav.readframes(wav.getnframes())
        paced=bytearray(round(scene['durationFrames']/30*48000)*2)
        previous_end=0
        for cue,start in zip(scene['captions'],STARTS[scene['id']],strict=True):
            start_frame=round(start*30)
            length=cue['endFrame']-cue['startFrame']
            assert start_frame>=previous_end and start_frame+length<=scene['durationFrames']
            a=cue['startFrame']*1600*2;b=cue['endFrame']*1600*2
            chunk=audio[a:b]
            dest=start_frame*1600*2
            paced[dest:dest+len(chunk)]=chunk
            cue.update(startFrame=start_frame,endFrame=start_frame+length)
            previous_end=start_frame+length
        target=output/f'scene-{scene["id"]}.wav'
        with wave.open(str(target),'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(48000);wav.writeframes(paced)
        (ROOT/'public'/scene['voicePath']).write_bytes(target.read_bytes())
        readable=[]
        for cue in scene['captions']:
            if len(cue['text'])<=72:
                readable.append(cue);continue
            words=cue['text'].split();middle=len(words)//2
            first=' '.join(words[:middle]);second=' '.join(words[middle:])
            split=cue['startFrame']+round((cue['endFrame']-cue['startFrame'])*middle/len(words))
            readable.extend([{'startFrame':cue['startFrame'],'endFrame':split,'text':first},
                {'startFrame':split,'endFrame':cue['endFrame'],'text':second}])
        scene['captions']=readable
        manifest.append({'scene':scene['id'],'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
                         'phrase_start_seconds':STARTS[scene['id']]})
    (ROOT/'src/timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Paced 35 phrases to real actions; speech speed unchanged; film remains165 seconds.')


if __name__=='__main__':main()
