"""Short, real source takes for v3. Camera cropping is deferred to the composition."""
import json,subprocess,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='+');args=parser.parse_args()
    m=json.loads((ROOT/'raw/v2/manifest.json').read_text())
    a={p['event']:p['seconds'] for p in m['C1-describe']['events']}
    b={p['event']:p['seconds'] for p in m['C3b-ask-take2']['events']}
    h='v2/C1-describe'
    # name: original recording, first real second, real duration, output duration, complete viewport kind
    plans={
      'typing':(h,a['typing-end']-2.5,2.5,2.5,'desktop'),
      'wait':(h,a['compare-start']+1,1.5,1.5,'desktop'),
      'understood':(h,a['compare-final']+1,3,3,'desktop'),
      'ask':('v2/C3b-ask-take2',b['ask-chip']-2.5,4,4,'desktop'),
      'offers':(h,a['offers']+1,4,4,'desktop'),
      'savings':(h,a['cart-top']+3,3,3,'desktop'),
      'rejections':(h,a['rejections-framed']+1,3,3,'desktop'),
      'market':(h,a['market']+4,3,3,'desktop'),
      'receipt':(h,a['cart-receipt']+1,4,4,'desktop'),
      'expiry':(h,a['cart-receipt']+6,4,4,'desktop'),
      'waiting-requester':('C4-owner',69,2.5,2.5,'requester'),
      'waiting-phone':('C4-owner',69,2.5,2.5,'phone'),
      'phone-gesture':('C4-owner',78.7,3.5,3.5,'phone'),
      'phone-approved':('C4-owner',82.2,1.4,1.6,'phone'),
      'requester-live':('C4-owner',82,2.9,4,'requester'),
      'mandate':('C4-owner',83.5,1.4,4,'requester'),
      'paypal':('C5-paypal',0,4.5,4.5,'paypal'),
      'thanks':('C5-paypal',6.5,1,1,'paypal'),
      'confirmed':('C6-refund',10,4,4,'desktop'),
      'refund-click':('C6-refund',43,2,2,'desktop'),
      'refund-result':('C6-refund',48,1,1,'desktop'),
      'approved':('C7-price',9,3.5,3.5,'desktop'),
      'revoked':('C7-price',63.1,2.1,4,'desktop'),
    }
    out=ROOT/'public/clips/v3';out.mkdir(exist_ok=True)
    masks=json.loads((ROOT/'card-redactions-v3.json').read_text())
    manifest=json.loads((ROOT/'src/v3/assets.json').read_text()) if args.only else {}
    for name,(source,start,length,hold,kind) in plans.items():
        if args.only and name not in args.only:continue
        if source=='C5-paypal':assert start+length<=11
        if source=='C7-price':assert start+length<=13 or start>=63
        if source=='C4-owner':assert start>=69
        filters=[]
        if kind=='paypal':
            # Only avatar and detected card digits; fictional delivery address remains real and visible.
            regions=[masks['avatar'],*masks['card_digits']]
            label='0:v';graph=[]
            for i,(x,y,w,h) in enumerate(regions):
                radius=12 if i==0 else 5
                graph.extend([f'[{label}]split[b{i}][m{i}]',f'[m{i}]crop={w}:{h}:{x}:{y}:exact=1,boxblur={radius}:3:{min(2,radius)}:3[p{i}]',f'[b{i}][p{i}]overlay={x}:{y}[o{i}]'])
                label=f'o{i}'
            graph.append(f'[{label}]crop=595:620:660:0:exact=1,scale=1190:1240[v]')
            prefix=';'.join(graph)+';[v]'
            width,height=1190,1240
        else:
            prefix='[0:v]'
            if kind=='requester':filters.append('crop=1336:948:23:106:exact=1');width,height=1336,948
            elif kind=='phone':filters.append('crop=390:844:1420:106:exact=1');width,height=390,844
            else:width,height=1920,1080
        count=round(hold*30)
        filters.extend(['setsar=1','fps=30',f'tpad=stop_mode=clone:stop_duration={max(0,hold-length)+.1}',f'trim=end_frame={count}','setpts=PTS-STARTPTS','format=yuv420p'])
        output=out/f'{name}.mp4'
        subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','2','-ss',str(start),'-t',str(length),'-i',str(ROOT/'raw'/f'{source}.mp4'),'-filter_complex_threads','1','-filter_complex',prefix+','.join(filters)+'[out]','-map','[out]','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','16','-movflags','+faststart',str(output)],check=True)
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,width,height','-of','json',str(output)]))['streams'][0]
        assert int(probe['nb_frames'])==count and (probe['width'],probe['height'])==(width,height)
        manifest[name]={'src':f'clips/v3/{name}.mp4','kind':kind,'width':width,'height':height,'durationFrames':count,'source':f'raw/{source}.mp4','sourceStart':start,'sourceEnd':start+length,'speed':1,'holdSeconds':round(hold-length,3),'sidebar':([439,100,238,700] if kind=='desktop' else [154,100,238,800] if kind=='requester' else None)}
        print(name,count,'frames',kind,flush=True)
    (ROOT/'src/v3/assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':main()
