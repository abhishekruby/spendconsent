"""Validate the rendered review package, not just the source composition."""
import argparse
import json
from pathlib import Path
import subprocess
from voice_samples import ROOT, measure_audio


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--version',type=int,default=1)
    version=parser.parse_args().version
    movie=ROOT/f'out/spendconsent-demo-v{version}.mp4'
    data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(movie)]))
    video=next(s for s in data['streams'] if s['codec_type']=='video')
    audio=next(s for s in data['streams'] if s['codec_type']=='audio')
    assert (video['width'],video['height'],video['avg_frame_rate'])==(1920,1080,'30/1')
    assert (video['codec_name'],video['profile'],video['pix_fmt'])==('h264','High','yuv420p')
    assert (audio['codec_name'],audio['sample_rate'])==('aac','48000')
    timeline=json.loads((ROOT/f'out/timeline-v{version}.json').read_text())
    assert len(timeline['scenes'])==8 and 0 < timeline['duration'] <= 175
    assert abs(float(data['format']['duration'])-timeline['duration'])<.1
    assert int(video['nb_frames'])==round(timeline['duration']*30)
    # Full-size boundary frames complement the required two-second contact sheet.
    inspection=ROOT/f'out/v{version}-scene-boundaries';inspection.mkdir(exist_ok=True)
    source_timeline=json.loads((ROOT/'src/timeline.json').read_text())
    frames=[f for scene in source_timeline['scenes'] for f in [scene['startFrame'],scene['startFrame']+18]]
    expression='+'.join(f'eq(n,{frame})' for frame in frames)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(movie),
        '-vf',f"select='{expression}'",'-fps_mode','vfr',str(inspection/'boundary-%02d.png')],check=True)
    assert len(list(inspection.glob('boundary-*.png')))==16
    (inspection/'frames.json').write_text(json.dumps([{'file':f'boundary-{i+1:02}.png','frame':frame,'seconds':frame/30} for i,frame in enumerate(frames)],indent=2)+'\n')
    levels=measure_audio(movie)
    assert -14.5<=float(levels['input_i'])<=-13.5, levels['input_i']
    assert float(levels['input_tp'])<=-1.0, levels['input_tp']
    cues=(ROOT/'out/captions.srt').read_text().strip().split('\n\n')
    source=json.loads((ROOT/'src/timeline.json').read_text())
    assert len(cues)==sum(len(scene['captions']) for scene in source['scenes'])
    assert all(1<=len(cue.splitlines()[2:])<=2 for cue in cues)
    assert (ROOT/f'out/contact-sheet-v{version}.jpg').stat().st_size>10000
    assert (ROOT/'src/edit.json').exists() and json.loads((ROOT/'src/edit.json').read_text())['ready']
    report={'duration_seconds':float(data['format']['duration']),'frames':int(video['nb_frames']),
        'video':'1920x1080 30fps H.264 High yuv420p CRF18','audio':'AAC 48kHz',
        'integrated_lufs':float(levels['input_i']),'true_peak_dbtp':float(levels['input_tp']),
        'caption_cues':len(cues),'visual_review':'See REVIEW.md; automated checks do not replace privacy/frame review.'}
    (ROOT/f'out/qa-v{version}.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS:',json.dumps(report))


if __name__=='__main__':main()
