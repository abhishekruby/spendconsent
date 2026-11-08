"""Prepare v2 real whole-page recordings; no browser/API access. --check validates cuts."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
FPS=30
DESKTOP=(280,0,1360,765)
REQUESTER=(23,106,1336,948)
PHONE=(1420,106,390,844)
PAYPAL=(660,0,595,620)
FADE=8


def validate_crop(crop,kind='desktop'):
    x,y,w,h=crop
    assert min(x,y)>=0 and min(w,h)>0 and x+w<=1920 and y+h<=1080
    if kind=='desktop': assert w>=1000 and abs(w/h-16/9)<.002, 'No strips: desktop must be 16:9 and >=1000px wide'
    elif kind=='requester': assert crop==REQUESTER
    elif kind=='phone': assert crop==PHONE
    elif kind=='paypal': assert crop==PAYPAL
    else: raise ValueError('Unknown whole viewport')


def plans():
    manifest=json.loads((ROOT/'raw/v2/manifest.json').read_text())
    a=manifest['C1-describe']; b=manifest['C3b-ask-take2']
    marks=lambda data:{v['event']:v['seconds'] for v in data['events']}
    am,bm=marks(a),marks(b)
    # source, seconds, length of real source, output hold length, full-page source viewport
    p=lambda file,start,length,crop=DESKTOP,hold=None:(file,start,length,hold or length,crop)
    hosted='v2/C1-describe'; ask='v2/C3b-ask-take2'
    specs={
      'C1-typing': [p(hosted,am['typing-end']-3,3)],
      'C1-wait': [p(hosted,am['compare-start']+1,3)],
      'C1-understood':[p(hosted,am['compare-final']+1,4,(500,80,1104,621))],
      'C3b-ask':[p(ask,bm['ask-chip']-2.5,4,(280,200,1360,765))],
      'C2-offers':[p(hosted,am['offers']+1,4,(280,80,1360,765))],
      'C2-market':[p(hosted,am['offers-end'],4,(280,100,1360,765))],
      'C2-market-more':[p(hosted,am['market']+4,4,(500,250,1104,621))],
      'C2-rejections':[p(hosted,am['rejections-framed']+1,4,(280,200,1360,765))],
      'C3-review':[p(hosted,am['cart-top']+3,6),p(hosted,am['cart-receipt']-1.3,7+FADE/FPS,(200,85,1536,864))],
      'C4-requester':[p('C4-owner',10,5,REQUESTER),p('C4-owner',69,15.9,REQUESTER,20+FADE/FPS)],
      'C4-phone':[p('C4-owner',10,5,PHONE),p('C4-owner',69,15.9,PHONE,20+FADE/FPS)],
      'C4-montage':[p('C4-owner',80.5,1.3,PHONE)],
      'C5-paypal':[p('C5-paypal',0,5,PAYPAL)],
      'C5-thanks':[p('C5-paypal',6.5,4,PAYPAL)],
      'C5-confirmed':[p('C6-refund',10,5,DESKTOP)],
      'C5-montage':[p('C6-refund',10,1.3)],
      'C6-refund':[p('C6-refund',42,3,(190,216,1536,864)),p('C6-refund',47.5,4+FADE/FPS,(190,216,1536,864))],
      'C7-price':[p('C7-price',4,4.25,(400,450,1104,621)),p('C7-price',63.1,2.1,(400,450,1104,621),4+FADE/FPS)],
    }
    kinds={'C4-requester':'requester','C4-phone':'phone','C4-montage':'phone','C5-paypal':'paypal','C5-thanks':'paypal'}
    labels={'C1-wait':f'AI wait shortened · real: {a["waitSeconds"]:.1f} s',
            'C4-requester':'Approval wait shortened', 'C6-refund':'Refund wait shortened',
            'C5-paypal':'PayPal wait shortened', 'C7-price':'Price-change wait shortened · status reloaded'}
    return specs,kinds,labels,a,b


def privacy_filter(file):
    if file!='C5-paypal': return ''
    # Blur only buyer/avatar/address/card identifiers. Leave INR conversion amount and rate unchanged.
    return ('split[a][m];[m]crop=125:60:660:0,boxblur=12:2:6:2[b];[a][b]overlay=660:0[c];'
            '[c]split[d][n];[n]crop=485:47:710:76,boxblur=12:2:6:2[e];[d][e]overlay=710:76[f];'
            '[f]split[g][p];[p]crop=370:60:692:190,boxblur=12:2:6:2[h];[g][h]overlay=692:190,')


def run(args):
    subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y',*args],check=True)


def prepare(key,parts,kind,cache):
    fragments=[];cuts=[];output_frames=0
    dimensions=(1920,1080) if kind=='desktop' else (1190,1240) if kind=='paypal' else (1336,948) if kind=='requester' else (390,844)
    for i,(file,start,length,hold,crop) in enumerate(parts):
        source=ROOT/'raw'/f'{file}.mp4';assert source.is_file(),source
        validate_crop(crop,kind)
        # Speed is always 1. Real static states may breathe after their source ends.
        frames=round(hold*FPS);x,y,w,h=crop
        fragment=cache/f'{key}-{i}.mp4'
        filters=privacy_filter(file)+f'crop={w}:{h}:{x}:{y}:exact=1,scale={dimensions[0]}:{dimensions[1]}:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration={max(0,hold-length)+.2},trim=end_frame={frames},setpts=PTS-STARTPTS,format=yuv420p'
        run(['-threads','2','-ss',str(start),'-t',str(length),'-i',str(source),'-filter_complex_threads','1','-filter_complex',filters,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','16',str(fragment)])
        cuts.append({'source':str(source.relative_to(ROOT)),'sourceStartSeconds':start,'sourceEndSeconds':start+length,'outputStartFrame':max(0,output_frames-(FADE if i else 0)),'durationFrames':frames,'crop':crop,'speed':1,'crossfadeFrames':FADE if i else 0})
        if not fragments: output_frames=frames;fragments.append(fragment);continue
        joined=cache/f'{key}-joined-{i}.mp4'
        run(['-threads','2','-i',str(fragments[-1]),'-threads','2','-i',str(fragment),'-filter_complex_threads','1','-filter_complex',f'[0:v][1:v]xfade=transition=fade:duration={FADE/FPS}:offset={(output_frames-FADE)/FPS},format=yuv420p[out]','-map','[out]','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','16',str(joined)])
        output_frames+=frames-FADE;fragments.append(joined)
    dest=ROOT/'public/clips/v2'/f'{key}.mp4'
    # Remux includes exact frame trim to guard xfade endpoint rounding.
    run(['-i',str(fragments[-1]),'-c','copy','-frames:v',str(output_frames),'-movflags','+faststart',str(dest)])
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,width,height','-of','json',str(dest)]))['streams'][0]
    assert int(probe['nb_frames'])==output_frames,(key,probe,output_frames)
    assert (probe['width'],probe['height'])==dimensions
    return {'src':f'clips/v2/{key}.mp4','from':0,'duration':output_frames,'kind':kind,'crop':dict(zip(['x','y','width','height'],parts[0][4]))},cuts


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--only',nargs='+');args=parser.parse_args()
    # Runnable regression check rejects the former thin-strip approach.
    validate_crop(DESKTOP)
    for bad in [(0,0,650,80),(0,0,900,506),(0,0,1360,600)]:
        try:validate_crop(bad)
        except AssertionError:pass
        else:raise AssertionError('Thin/wrong-aspect crop accepted')
    specs,kinds,labels,a,b=plans()
    for key,parts in specs.items():
        for file,start,length,hold,crop in parts:
            validate_crop(crop,kinds.get(key,'desktop'));assert start>=0 and 0<length<=hold
            if file=='C5-paypal':assert start+length<=11, 'Exclude editor portion of C5'
            if file=='C7-price':assert start+length<=13 or start>=63,'Exclude editor portion of C7'
            if file=='C4-owner':assert start+length<=15 or start>=69,'Exclude C4 loading flash'
    if args.check:print('PASS: whole viewports, aspect/width guards, safe source ranges, no speed-up');return
    destination=ROOT/'public/clips/v2';destination.mkdir(parents=True,exist_ok=True)
    cache=ROOT/'.cache/prepared-v2';cache.mkdir(parents=True,exist_ok=True)
    ep=ROOT/'src/edit.json';edit=json.loads(ep.read_text());edit['ready']=False
    # No old v1 strip entry can survive the v2 ready guard.
    if not args.only:edit['clips']={}
    ep.write_text(json.dumps(edit,indent=2)+'\n')
    mp=ROOT/'edit-excerpts.json';manifest=json.loads(mp.read_text()) if args.only else {}
    for key in args.only or specs:
        meta,cuts=prepare(key,specs[key],kinds.get(key,'desktop'),cache)
        if key in labels:meta['waitLabel']=labels[key]
        if key=='C4-requester':meta['approvalFrame']=round((5-FADE/FPS+83.15-69)*FPS);meta['rings']=[{'startFrame':meta['approvalFrame'],'endFrame':750,'x':502/1336,'y':478/948,'width':642/1336,'height':150/948}]
        if key=='C4-montage':meta['approvalFrame']=30
        if key=='C5-paypal':meta['rings']=[{'startFrame':0,'endFrame':95,'x':.85,'y':.018,'width':.13,'height':.05},{'startFrame':45,'endFrame':120,'x':.055,'y':.70,'width':.90,'height':.08}]
        if key=='C2-offers':meta['rings']=[{'startFrame':8,'endFrame':120,'x':(1320-280)/1360,'y':(187-80)/765,'width':120/1360,'height':45/765}]
        if key=='C3-review':meta['rings']=[{'startFrame':240,'endFrame':390,'x':(1320-200)/1536,'y':(139-85)/864,'width':115/1536,'height':32/864}]
        if key=='C7-price':meta['rings']=[{'startFrame': 0, 'endFrame': 120, 'x': 0.8296875, 'y': 0.36203703703703705, 'width': 0.11041666666666666, 'height': 0.08148148148148149}, {'startFrame': 136, 'endFrame': 248, 'x': 0.8395833333333333, 'y': 0.3194444444444444, 'width': 0.1015625, 'height': 0.07962962962962963}]
        edit['clips'][key]=meta
        manifest[key]={'width':(1920 if meta['kind']=='desktop' else 1190 if meta['kind']=='paypal' else 1336 if meta['kind']=='requester' else 390),'height':(1080 if meta['kind']=='desktop' else 1240 if meta['kind']=='paypal' else 948 if meta['kind']=='requester' else 844),'cuts':cuts,'privacy':'Whole app viewports only; PayPal buyer identifiers blurred without touching INR conversion.'}
        ep.write_text(json.dumps(edit,indent=2)+'\n');mp.write_text(json.dumps(manifest,indent=2)+'\n')
        print(f'{key}: {meta["duration"]} frames, whole {meta["kind"]} viewport',flush=True)
    edit['realAIWaitSeconds']=round((a['waitSeconds']+b['waitSeconds'])/2,2)
    edit['hostedWaitsSeconds']={'describe':a['waitSeconds'],'missing_size':b['waitSeconds']}
    edit['ready']=len(edit['clips'])==len(specs)
    ep.write_text(json.dumps(edit,indent=2)+'\n')

if __name__=='__main__':main()
