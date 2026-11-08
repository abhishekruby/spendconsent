"""Lay the eight real scene WAVs on their measured timeline and normalize once."""
import argparse
import json
import subprocess
import wave
import numpy as np
from voice_samples import ROOT, normalize


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--version',type=int,required=True)
    version=parser.parse_args().version
    timeline=json.loads((ROOT/'src/timeline.json').read_text())
    inputs=[];filters=[]
    for index,scene in enumerate(timeline['scenes']):
        inputs+=['-i',str(ROOT/'public'/scene['voicePath'])]
        delay=round(scene['startFrame']/30*1000)
        filters.append(f'[{index}:a]adelay={delay}:all=1[a{index}]')
    duration=timeline['totalFrames']/30
    edit=json.loads((ROOT/'src/edit.json').read_text())
    effects=np.zeros(round(duration*48000),dtype=np.float32)
    def add(at,kind):
        length=.22 if kind=='thud' else .45
        t=np.arange(round(length*48000))/48000
        sound=(.045*np.sin(2*np.pi*65*t)*np.exp(-t/0.045) if kind=='thud' else
            .022*(np.sin(2*np.pi*1046.5*t)+.5*np.sin(2*np.pi*1568*t))*np.exp(-t/.14))
        sound*=np.minimum(1,t/.004)
        start=round(at*48000)
        effects[start:start+len(sound)]+=sound
    add(edit['clips']['C4-montage']['approvalFrame']/30,'thud')
    add(1.6,'chime')
    add(timeline['scenes'][4]['startFrame']/30+edit['clips']['C4-owner']['approvalFrame']/30,'thud')
    fx=ROOT/f'out/effects-v{version}.wav'
    with wave.open(str(fx),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(48000)
        wav.writeframes((effects*32767).astype('<i2').tobytes())
    inputs+=['-i',str(fx)]
    filters.append('[8:a]anull[fx]')
    filters.append(''.join(f'[a{i}]' for i in range(len(timeline['scenes'])))+
        f'[fx]amix=inputs=9:normalize=0:duration=longest,apad=whole_dur={duration},atrim=duration={duration}[master]')
    raw=ROOT/f'out/.master-raw-v{version}.wav'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*inputs,
        '-filter_complex',';'.join(filters),'-map','[master]','-ar','48000','-c:a','pcm_s24le',str(raw)],check=True)
    output=ROOT/f'out/master-v{version}.wav'
    levels=normalize(raw,output,pad=False)
    raw.unlink()
    (ROOT/f'out/audio-qa-v{version}.json').write_text(json.dumps(levels,indent=2)+'\n')
    print(f'Master audio: {duration:.2f}s, {levels["input_i"]} LUFS, {levels["input_tp"]} dBTP',flush=True)


if __name__=='__main__':main()
