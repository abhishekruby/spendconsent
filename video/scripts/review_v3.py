"""Export and verify v3 review files; reuse existing app tests, never call a payment API."""
import argparse,json,subprocess,wave,math
from pathlib import Path
from voice_samples import ROOT,measure_audio

def stamp(frame):
    ms=round(frame*1000/30);sec,m=divmod(ms,1000);minute,s=divmod(sec,60);h,mi=divmod(minute,60)
    return f'{h:02}:{mi:02}:{s:02},{m:03}'
def export():
    plan=json.loads((ROOT/'src/v3/timeline.json').read_text())
    assets=json.loads((ROOT/'src/v3/assets.json').read_text())
    cues=sorted([{'start':s['startFrame']+c['startFrame'],'end':s['startFrame']+c['endFrame'],'text':c['text']} for s in plan['scenes'] for c in s['captions']],key=lambda c:c['start'])
    for a,b in zip(cues,cues[1:]):assert a['end']<=b['start'],'Caption overlap'
    lines=[f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for i,c in enumerate(cues)]
    for name in ['captions.srt','captions-v3.srt']:(ROOT/'out'/name).write_text('\n\n'.join(lines)+'\n')
    scenes=[]
    for s in plan['scenes']:
        shots=[t for t in plan['shots'] if t['scene']==s['id']]
        names=set(t['asset'] for t in shots if 'asset'in t)
        if s['id']==5:names|={'waiting-requester','waiting-phone'}
        scenes.append({'scene':s['id'],'name':s['name'],'start':s['startFrame']/30,'end':(s['startFrame']+s['durationFrames'])/30,'voice_start':s['voiceStartFrame']/30,'voiceover':s['text'],'clips_used':[{'name':n,**assets[n]} for n in sorted(names)],'shots':shots})
    (ROOT/'out/timeline-v3.json').write_text(json.dumps({'fps':30,'width':1920,'height':1080,'duration':plan['totalFrames']/30,'voice':'af_heart','tts_speed':1.05,'events':plan['events'],'scenes':scenes},indent=2)+'\n')
    print(f'Exported {len(cues)} natural-clause captions,60 shots,8 scenes.',flush=True)
def check(mode):
    import numpy as np
    tag='v3-draft' if mode=='draft' else 'v3'
    movie=ROOT/f'out/spendconsent-demo-{tag}.mp4'
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)]))
    v=next(s for s in data['streams'] if s['codec_type']=='video');a=next(s for s in data['streams'] if s['codec_type']=='audio')
    assert (v['width'],v['height'])==((960,540) if mode=='draft' else (1920,1080))
    assert v['avg_frame_rate']=='30/1' and int(v['nb_frames'])==4950
    assert v['codec_name']=='h264' and v['profile']=='High' and v['pix_fmt']=='yuv420p'
    assert a['codec_name']=='aac' and a['sample_rate']=='48000'
    assert abs(float(data['format']['duration'])-165)<.1
    plan=json.loads((ROOT/'src/v3/timeline.json').read_text())
    assert len(plan['shots'])==60 and all(s['duration']<=150 or s['kind']=='dare' for s in plan['shots'])
    levels=measure_audio(movie)
    assert -14.5<=float(levels['input_i'])<=-13.5,levels
    assert float(levels['input_tp'])<=-1.0,levels
    # Check encoded silence away from AAC boundary ringing.
    silence_peaks=[]
    for lo,hi in plan['events']['silences']:
        raw=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(lo/30+.04),'-t','0.32','-i',str(movie),'-vn','-ar','48000','-ac','1','-f','f32le','-'])
        samples=np.frombuffer(raw,dtype='<f4');peak=float(np.max(np.abs(samples)))
        assert peak<.0032,('Pre-slam silence not silent',lo,peak)
        silence_peaks.append(20*math.log10(max(1e-9,peak)))
    folder=ROOT/f'out/{tag}-scene-boundaries';folder.mkdir(exist_ok=True)
    wanted=[f for s in plan['scenes'] for f in [s['startFrame'],s['startFrame']+18]]
    expr='+'.join(f'eq(n,{f})' for f in wanted)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(movie),'-vf',f"select='{expr}'",'-fps_mode','vfr',str(folder/'boundary-%02d.png')],check=True)
    report={'mode':mode,'duration_seconds':float(data['format']['duration']),'frames':int(v['nb_frames']),'width':v['width'],'height':v['height'],'fps':30,'video':'H.264 High yuv420p','audio':'AAC48kHz','integrated_lufs':float(levels['input_i']),'true_peak_dbtp':float(levels['input_tp']),'shots':60,'max_non_endcard_seconds':max(s['duration']/30 for s in plan['shots'] if s['kind']!='dare'),'pre_slam_encoded_silence_peaks_dbfs':silence_peaks,'app_tests':'Reused127backend+24frontend; no app edits or new payments'}
    (ROOT/f'out/qa-{tag}.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS',json.dumps(report),flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['export','check']);p.add_argument('--mode',choices=['draft','final'],default='draft');args=p.parse_args()
    export() if args.action=='export' else check(args.mode)

