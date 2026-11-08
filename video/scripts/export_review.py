"""Generate delivery SRT and scene timeline from the actual phrase-timed edit."""
import argparse
import json
from pathlib import Path
import textwrap

ROOT=Path(__file__).resolve().parents[1]


def stamp(frame,fps=30):
    milliseconds=round(frame*1000/fps)
    seconds,ms=divmod(milliseconds,1000)
    minutes,sec=divmod(seconds,60)
    hours,minute=divmod(minutes,60)
    return f'{hours:02}:{minute:02}:{sec:02},{ms:03}'


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--version',type=int,default=1)
    args=parser.parse_args();assert args.version>0
    timeline=json.loads((ROOT/'src/timeline.json').read_text())
    edit=json.loads((ROOT/'src/edit.json').read_text())
    clips={1:['C4-montage','C5-montage'],2:[],3:['C1-describe','C3b-ask','C2-offers'],
        4:['C3-review'],5:['C4-owner'],6:['C5-paypal','C6-refund'],7:['C7-price'],8:[]}
    captions=[];scenes=[]
    for scene in timeline['scenes']:
        for cue in scene['captions']:
            lines=textwrap.wrap(cue['text'],width=76,break_long_words=False,break_on_hyphens=False)
            assert len(lines)<=2
            captions.append(f'{len(captions)+1}\n{stamp(scene["startFrame"]+cue["startFrame"])} --> '
                f'{stamp(scene["startFrame"]+cue["endFrame"])}\n'+ '\n'.join(lines))
        used=[{'name':key,**edit['clips'][key]} for key in clips[scene['id']]] if edit['ready'] else clips[scene['id']]
        scenes.append({'scene':scene['id'],'start':scene['startFrame']/30,
            'end':(scene['startFrame']+scene['durationFrames'])/30,'voiceover':scene['text'],
            'clips_used':used})
    (ROOT/'out/captions.srt').write_text('\n\n'.join(captions)+'\n')
    (ROOT/f'out/timeline-v{args.version}.json').write_text(json.dumps({
        'fps':30,'width':1920,'height':1080,'duration':timeline['totalFrames']/30,
        'voice':'af_heart','scenes':scenes},indent=2)+'\n')
    print(f'Exported {len(captions)} captions and {len(scenes)} scene records.')


if __name__=='__main__':main()
