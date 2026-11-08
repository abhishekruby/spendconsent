"""A timestamped frame every two seconds, using our licensed IBM Plex font."""
import argparse
import json
import math
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    source=args.input.resolve()
    destination=args.output.resolve()
    if not source.is_relative_to(ROOT) or not destination.is_relative_to(ROOT):
        raise ValueError('Contact sheets stay inside video/')
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(source)]))
    duration=float(probe['format']['duration'])
    rows=math.ceil(math.ceil(duration/2)/8)
    font='node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'
    filters=("select='not(mod(n,60))',scale=320:180:flags=lanczos,pad=320:208:0:0:color=0xf3efe7,"
        "drawbox=x=0:y=180:w=320:h=28:color=0x1a1714:t=fill,"
        f"drawtext=fontfile={font}:text='%{{pts\\:hms}}':fontsize=18:fontcolor=0xfffcf6:x=10:y=185,"
        f'tile=8x{rows}:padding=8:margin=8:color=0xf3efe7')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),
        '-vf',filters,'-frames:v','1','-q:v','2',str(destination)],cwd=ROOT,check=True)
    print(destination.relative_to(ROOT))


if __name__=='__main__': main()
