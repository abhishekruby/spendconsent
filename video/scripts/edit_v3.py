"""Apply the v4 editorial patch to the approved v3 film; reuse every unchanged voice clause."""
import json,wave,subprocess
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
STARTS={
1:[.35,3.35],2:[0,2.36,6.01,9.23],3:[0,2.22,4.8,7.3,9.8],
4:[.3,2.6,7.15,10.55,12.05,14,19.1],
5:[.35,4.15,7,10.1,13,15.8,17.7],
6:[.3,5.8,10,15.7,17.1],
7:[.3,2.4,9.9,13.5,18.7,20.7,21.96,23.02,24.14],
8:[.1,4.1,5.6,8.3,11.7]}
# Full/sidebar-safe overview and clean main-column crops. No interpolation crosses the sidebar.
FULL=[0,0,1920,1080]
def camera(target,wide=None,overview=True):
    x,y,w,h=target
    # A very gentle, continuing push follows the first 700ms move.
    start=[x-24,min(y-18,1080-(w+64)*9/16),w+64,(w+64)*9/16]
    return {'overview':overview,'base':wide or FULL,'start':start,'end':target}

def main():
    script=json.loads((ROOT/'scene-script-v3.json').read_text())
    phrases=json.loads((ROOT/'out/voice-v3/phrases.json').read_text())
    for number,seconds in {2:11.7,3:12.3,5:20.4,7:28,8:20.1}.items():script[number-1]['seconds']=seconds
    changed=json.loads((ROOT/'out/voice-v4/patch-phrases.json').read_text())
    old=phrases['scenes'][6]['phrases']
    phrases['scenes'][6]['phrases']=[*old[:4],changed[0],*old[4:7],changed[1]]
    script[6]['phrases']=[p['text'] for p in phrases['scenes'][6]['phrases']]
    (ROOT/'public/voice/v4').mkdir(parents=True,exist_ok=True)
    scenes=[];start=0
    for spec,voice in zip(script,phrases['scenes'],strict=True):
        number=spec['id'];lead=0
        samples=np.zeros(round((spec['seconds']+lead)*24000),dtype=np.float32);captions=[]
        last=-lead
        for phrase,at in zip(voice['phrases'],STARTS[number],strict=True):
            with wave.open(str(ROOT/phrase['file']),'rb') as w:
                assert w.getframerate()==24000
                audio=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
            assert at+1/30>=last+(.1 if number==7 and len(captions)>=6 else .2) or not captions,(number,at,last)
            dest=round((at+lead)*24000);assert dest>=0 and dest+len(audio)<=len(samples)
            samples[dest:dest+len(audio)]=audio
            last=at+len(audio)/24000
            text=phrase['text'].replace('One hundred and sixty out of one hundred and sixty','160 out of 160').replace('fourteen seconds','14 seconds')
            captions.append({'startFrame':round(at*30),'endFrame':round(last*30),'text':text})
        raw=ROOT/f'out/voice-v4/.scene-{number}.wav'
        with wave.open(str(raw),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes((samples*32767).astype('<i2').tobytes())
        target=ROOT/f'out/voice-v4/scene-{number}.wav'
        subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-i',str(raw),'-ar','48000','-c:a','pcm_s16le',str(target)],check=True)
        (ROOT/f'public/voice/v4/scene-{number}.wav').write_bytes(target.read_bytes())
        scenes.append({'id':number,'name':spec['name'],'startFrame':round(start*30),'durationFrames':round(spec['seconds']*30),'voiceStartFrame':round((start-lead)*30),'voicePath':f'voice/v4/scene-{number}.wav','text':' '.join(spec['phrases']),'captions':captions})
        start+=spec['seconds']
    assert abs(start-147.5)<1e-6

    shots=[]
    def shot(scene,a,b,kind,**props):
        s=scenes[scene-1];shots.append({'id':len(shots)+1,'scene':scene,'from':s['startFrame']+round(a*30),'duration':round(b*30)-round(a*30),'kind':kind,**props})
    def word(scene,a,b,text,**props):shot(scene,a,b,'words',text=text,**props)
    def clip(scene,a,b,asset,target,**props):
        overview=props.pop('overview',True);wide=props.pop('wide',None)
        cam=camera(target,wide,overview)
        if asset=='offers':cam['start'][1]=50
        if asset=='receipt':cam['start'][1]=280
        if asset.startswith('refund'):cam['start']=target
        shot(scene,a,b,'clip',asset=asset,camera=cam,**props)

    shot(1,0,3,'cold-terminal')
    word(1,3,5,'THREE\nWAYS.',shields=True)
    word(1,5,7,'WRONG|THE WRONG\nMONEY.',wordRate=1)
    word(1,7,9,'CAN IT\nPAY?')
    shot(2,0,3.5,'quote')
    word(2,3.5,6,'AUTHORIZED\nBY YOU.',source='A major US retailer’s terms · updated Sept 2026')
    shot(2,6,9,'stat',value='19%',label='trust AI to buy for them',source='ACI Worldwide / YouGov · 2,080 UK adults · June 2026')
    shot(2,9,11.7,'stat',value='60%',label='would quit after one mistake',source='ACI Worldwide / YouGov · 2,080 UK adults · June 2026')
    word(3,0,2.2,'SpendConsent',size=174)
    word(3,2.2,4.8,'ONE PERSON ORDERS.\nSOMEONE ELSE PAYS.',size=122)
    shot(3,4.8,7.3,'beside',text='AI\nSHOPS.',asset='offers',focus='offers')
    shot(3,7.3,9.8,'beside',text='YOU\nDECIDE.',asset='phone-gesture',focus='phone')
    shot(3,9.8,12.3,'beside',text='PAYPAL\nVERIFIES.',asset='confirmed',focus='confirmed')

    clip(4,0,2.5,'typing',[728,280,768,432])
    clip(4,2.5,4,'wait',[728,250,768,432],overview=False,wait='AI wait cut · real 14.4 s')
    clip(4,4,7,'understood',[728,232,768,432],tags=True)
    word(4,7,9,'MAKE IT\nGUESS.',kicker='ATTEMPT 1')
    clip(4,9,13,'ask',[728,245,768,432],rings=[{'rect':[778,420,680,105],'at':1.8}])
    clip(4,13,17,'offers',[728,50,768,432],wide=[280,80,1360,765],rings=[{'rect':[1320,187,120,45],'at':1.85}])
    clip(4,17,20,'rejections',[728,590,768,432],overview=False)
    clip(4,20,23,'market',[728,250,768,432],overview=False)
    clip(4,23,26,'savings',[728,320,768,432],overview=False,rings=[{'rect':[780,425,660,78],'at':.2}])

    clip(5,0,4,'receipt',[728,290,768,432])
    clip(5,4,8,'expiry',[728,100,768,432],overview=False,rings=[{'rect':[1320,139,115,32],'at':.1}])
    shot(5,8,10.5,'owner-split',wait='Owner wait shortened')
    # 12 real checkbox frames, then24 real tap frames; only the intervening wait is cut.
    shot(5,10.5,12.1,'phone',asset='phone-gesture',overview=False,splice=True,wait='Tap wait shortened')
    # Native green panel first appears at source frame28. Offset4 gives24 grey frames.
    shot(5,12.1,15.4,'approval-live',asset='requester-live',offset=4,changeFrame=24,live=True,
      camera={'overview':False,'base':[400,478,800,450],'start':[400,478,800,450],'end':[400,478,800,450]})
    shot(5,15.4,17.6,'beside',text='THIS\nCART.',asset='mandate',focus='mandate')
    shot(5,17.6,20.4,'beside',text='NOTHING\nELSE.',asset='mandate',focus='mandate')

    shot(6,0,3.7,'paypal',asset='paypal',offset=0,holdAtFrame=74,focus='amount')
    shot(6,3.7,4.5,'paypal',asset='paypal',offset=75,holdAtFrame=97,focus='button')
    shot(6,4.5,5.5,'paypal',asset='thanks',focus='thanks',wait='PayPal wait shortened')
    clip(6,5.5,9.5,'confirmed',[728,270,768,432],wait='Capture wait shortened')
    shot(6,9.5,11.5,'verification',asset='confirmed',focus='AMOUNT')
    shot(6,11.5,13.5,'verification',asset='confirmed',focus='PAYEE')
    shot(6,13.5,15.5,'verification',asset='confirmed',focus='ORDER')
    shot(6,15.5,17,'verification',asset='confirmed',focus='VERIFIED')
    clip(6,17,19,'refund-click',[728,648,768,432],overview=False,wait='Refund wait shortened')
    clip(6,19,20,'refund-result',[728,648,768,432],overview=False)

    word(7,0,2,'CHANGE\nTHE PRICE.',kicker='ATTEMPT 2')
    clip(7,2,5.5,'approved',[728,620,768,432],rings=[{'rect':[1316,675,122,52],'at':1.8}])
    word(7,5.5,7.9,'+$0.01',size=200,sub='After approval.')
    clip(7,7.9,9.1,'revoked',[728,590,768,432],overview=False,rings=[{'rect':[1327,648,112,52],'at':.05}],wait='Price-change wait cut')
    shot(7,9.1,9.8,'stamp',text='REVOKED')
    clip(7,9.8,13.2,'revoked',[728,590,768,432],overview=False,offset=24,rings=[{'rect':[1327,648,112,52],'at':.05}],note='Status reloaded')
    word(7,13.2,16,'MAKE THE\nAGENT PAY.',kicker='ATTEMPT 3')
    shot(7,16,18.6,'rpc-request')
    shot(7,18.6,20.6,'rpc-result')
    shot(7,20.6,25.5,'tools')
    shot(7,25.5,28,'zero')

    shot(8,0,2.4,'stat',value='160/160',label='AI tests · 8 suites · 6 written blind')
    shot(8,2.4,3.9,'stat',value='151',label='automated tests · 127 backend + 24 frontend')
    shot(8,3.9,5.4,'stat',value='~14 s',label='per comparison · hosted',source='Recorded: 14.356 s and 12.930 s · mean 13.643 s')
    word(8,5.4,8.1,'AI AGENTS ARE ALREADY\nAT THE CHECKOUT.',size=126,wordRate=1)
    word(8,8.1,10.2,'THIS IS WHAT\nYES SHOULD LOOK LIKE.',size=126,wordRate=1)
    word(8,10.2,11.6,'YOUR\nTURN.',size=190)
    shot(8,11.6,20.1,'dare')

    events={'block1':scenes[3]['startFrame']+381,'approved':scenes[4]['startFrame']+387,
      'revoked':scenes[6]['startFrame']+273,'block2':scenes[6]['startFrame']+273,
      'error':scenes[6]['startFrame']+558,'block3':scenes[6]['startFrame']+558,
      'zero':scenes[6]['startFrame']+765,'dare':scenes[7]['startFrame']+348}
    events['silences']=[[scenes[2]['startFrame']-12,scenes[2]['startFrame']],
      [scenes[4]['startFrame']+351,scenes[4]['startFrame']+363],
      [events['approved']-12,events['approved']],[events['revoked']-12,events['revoked']],
      [events['error']-12,events['error']],[events['zero']-12,events['zero']]]
    timeline={'version':4,'fps':30,'totalFrames':4425,'voice':'af_heart','speed':1.05,'scenes':scenes,'shots':shots,'events':events}
    for a,b in zip(shots,shots[1:]):assert a['from']+a['duration']==b['from'],(a['id'],b['id'])
    assert shots[-1]['from']+shots[-1]['duration']==4425
    assert all(s['duration']<=150 or s['kind']=='dare' for s in shots)
    # Every silence is deliberate and contains no scheduled narration.
    for a,b in events['silences']:
        for scene in scenes:
            for c in scene['captions']:assert c['endFrame']+scene['startFrame']<=a or c['startFrame']+scene['startFrame']>=b,(a,b,c)
    (ROOT/'src/v3/timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
    print('PASS: 147.5 seconds; '+str(len(shots))+' shots; no non-end-card shot over5s; narration avoids every pre-slam silence.')
if __name__=='__main__':main()
