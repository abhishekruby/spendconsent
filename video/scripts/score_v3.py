"""Original v3 pulse, pad, ticks and accents. No samples, stock music or hosted service."""
import json,wave,math,subprocess
import numpy as np
from voice_samples import ROOT,normalize,measure_audio

RATE=48000
def read(path):
    with wave.open(str(path),'rb') as w:
        assert w.getframerate()==RATE and w.getnchannels()==1 and w.getsampwidth()==2
        return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
def write(path,a):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE)
        w.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
def mean_window(a,n):
    sums=np.concatenate(([0.],np.cumsum(a,dtype=np.float64)))
    return ((sums[n:]-sums[:-n])/n).astype(np.float32)
def main():
    timeline=json.loads((ROOT/'src/v3/timeline.json').read_text())
    version=timeline.get('version',3);tag=f'v{version}';duration=timeline['totalFrames']/30
    size=timeline['totalFrames']*1600
    scene6=timeline['scenes'][5]['startFrame']/30;scene7=timeline['scenes'][6]['startFrame']/30;proof=timeline['scenes'][7]['startFrame']/30
    dare=timeline['events']['dare']/30;error=timeline['events']['error']/30
    voice=np.zeros(size,np.float32)
    for s in timeline['scenes']:
        a=read(ROOT/'public'/s['voicePath']);start=s['voiceStartFrame']*1600
        voice[start:start+len(a)]+=a
    raw=ROOT/f'out/{tag}/.voice-raw.wav';leveled=ROOT/f'out/{tag}/voice.wav'
    write(raw,voice);normalize(raw,leveled,pad=False);voice=read(leveled)[:size]
    assert len(voice)==size
    bed=np.zeros(size,np.float32);fx=np.zeros(size,np.float32);rng=np.random.default_rng(2026)
    def add(dest,at,sound):
        start=round(at*RATE);end=min(size,start+len(sound))
        assert start>=0
        dest[start:end]+=sound[:end-start]
    def tone(freq,seconds,amp=.1,decay=.3):
        t=np.arange(round(seconds*RATE))/RATE
        return (amp*(np.sin(2*np.pi*freq*t)+.12*np.sin(2*np.pi*freq*3*t))*np.minimum(1,t/.015)*np.exp(-t/decay)).astype(np.float32)
    # Original harmonic pulse motif: C / G / B-flat / G. Warm major release for the dare.
    for beat,at in enumerate(np.arange(0,duration,60/86)):
        tension=at<9 or 33<=at<46 or 67<=at<75 or scene7<=at<timeline['events']['zero']/30+.5
        pitches=[65.406,98,116.541,98] if tension else [65.406,82.407,98,130.813]
        add(bed,float(at),tone(pitches[beat%4],.72,.3 if tension else .19,.22))
        if beat%2==0:add(bed,float(at),tone(pitches[beat%4]*4,.85,.028,.34))
    # Low original sustained chord, with slow attack/release and independent oscillator phases.
    time=np.arange(size,dtype=np.float32)/RATE
    for f in [130.813,155.563,195.998]:
        bed+=.016*np.sin(2*np.pi*f*time+.25*np.sin(time*.19))
    bed*=np.minimum(1,time/1.5)*np.minimum(1,(duration-time)/.8)
    power=np.pad(voice*voice,(2400,0))
    env=np.sqrt(np.maximum(0,mean_window(power,2401)))[:size]
    active=env>.01
    duck=1-.5*np.clip(env/.035,0,1)
    bed*=duck
    voice_rms=float(np.sqrt(np.mean(voice[active]**2)))
    bed*=voice_rms/(10**(18/20)*float(np.sqrt(np.mean(bed[active]**2))))
    measured_bed_db=20*math.log10(float(np.sqrt(np.mean(bed[active]**2)))/voice_rms)
    assert -18.05<measured_bed_db<-17.95
    def tick(at):
        t=np.arange(round(.045*RATE))/RATE
        sound=.011*(np.sin(2*np.pi*2200*t)+.25*rng.normal(size=len(t)))*np.exp(-t/.009)
        add(fx,at,sound.astype(np.float32))
    for a,b in [(35.5,37),(67,69.5),(scene7+5.5,scene7+7.5),(scene7+16,error-.4)]:
        for at in np.arange(a,b,.5):tick(float(at))
    def thud(at,amp):
        t=np.arange(round(.38*RATE))/RATE
        phase=2*np.pi*(84*t-32*t*t)
        sound=amp*np.sin(phase)*np.exp(-t/.085)+amp*.16*rng.normal(size=len(t))*np.exp(-t/.012)
        sound*=np.minimum(1,t/.003)
        add(fx,at,sound.astype(np.float32))
    e=timeline['events']
    thud(e['block1']/30,.11)
    thud(e['approved']/30,.29)
    thud(e['revoked']/30,.33)
    thud(e['error']/30,.34)
    thud(e['zero']/30,.36)
    for at,freq in [(scene6+9.5,523.251),(scene6+11.5,659.255),(scene6+13.5,783.991)]:
        t=np.arange(round(.85*RATE))/RATE
        sound=.085*(np.sin(2*np.pi*freq*t)+.24*np.sin(2*np.pi*freq*2.41*t))*np.exp(-t/.20)*np.minimum(1,t/.008)
        add(fx,at,sound.astype(np.float32))
    # Final invitation lift: an original rising voicing, then room for the QR.
    for i,f in enumerate([261.626,329.628,391.995,523.251]):
        add(fx,dare+i*.18,tone(f,1.4,.035,.46))
    for at,f in [(proof,392),(proof+2.4,440),(proof+3.9,523.251)]:add(fx,at,tone(f,.22,.035,.075))
    for a,b in e['silences']:
        assert np.max(np.abs(voice[a*1600:b*1600]))<.0001
        bed[a*1600:b*1600]=0;fx[a*1600:b*1600]=0
    write(ROOT/f'out/{tag}/original-score.wav',bed+fx)
    mix=voice+bed+fx
    mix[-round(.7*RATE):]*=np.linspace(1,0,round(.7*RATE))
    raw=ROOT/f'out/{tag}/.mix-raw.wav';master=ROOT/f'out/master-{tag}.wav'
    write(raw,mix);normalize(raw,master,pad=False)
    final=read(master)[:size]
    for a,b in e['silences']:final[a*1600:b*1600]=0
    write(master,final)
    levels=measure_audio(master)
    for _ in range(3):
        gain=-14-float(levels['input_i'])
        if abs(gain)<=.1:break
        target=ROOT/f'out/{tag}/.level-final.wav'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(master),'-af',f'aresample=192000,volume={gain}dB,alimiter=limit=0.841395:level=false:latency=true,aresample=48000','-c:a','pcm_s16le',str(target)],check=True)
        a=read(target)[:size]
        for lo,hi in e['silences']:a[lo*1600:hi*1600]=0
        write(master,a);levels=measure_audio(master)
    assert abs(float(levels['input_i'])+14)<=.2,levels
    (ROOT/f'public/soundtrack-{tag}.wav').write_bytes(master.read_bytes())
    report={'voice':'Heart af_heart, local Kokoro1.05','source':'original sine/partial/noise synthesis only','bed_db_below_active_voice':round(measured_bed_db,2),'silence_ranges_frames':e['silences'],'integrated_lufs':float(levels['input_i']),'true_peak_dbtp':float(levels['input_tp'])}
    (ROOT/f'out/audio-qa-{tag}.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS: original score; bed18dB below voice; pre-slam400ms silences;',report,flush=True)
if __name__=='__main__':main()
