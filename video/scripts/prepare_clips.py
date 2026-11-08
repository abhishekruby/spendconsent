"""Prepare only the approved C1–C4 / C7 recordings. No browser, desktop, or API access.

Run: python3 scripts/prepare_clips.py
Add verified Channel3 footage: --market-start SEC --market-crop X Y W H
The exact source cuts/crops are written to edit-excerpts.json. Raw files stay intact.
"""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
FPS, WIDTH, HEIGHT = 30, 1920, 600
PAPER = '0xf3efe7'

# Crops refer to the original 1920×1080 recording. No recreated product pixels.
# Every C4 crop is strictly inside the app viewports, excluding browser/chat.
PLANS = {
    'C1-describe': [
        (2, 8.5, 6.5, (772, 310, 700, 240)),
        (8.5, 66.5, 2, (788, 330, 660, 210)),
        (69, 71, 2, (785, 300, 650, 180)),
    ],
    'C2-offers': [
        (3, 6, 3, (775, 230, 690, 220)),
        (9, 12, 3, (790, 485, 650, 230)),
        (24, 26, 2, (775, 780, 690, 220)),
        (18, 21.4, 3.4, (790, 485, 650, 230)),
    ],
    'C3-review': [
        (5, 9, 4, (790, 698, 650, 115)),
        (9, 13, 4, (790, 824, 650, 175)),
        (13, 16, 3, (786, 610, 650, 80)),
        (16, 18, 2, (1295, 592, 160, 75)),
    ],
    'C3b-ask': [
        (8, 70, .9, (790, 330, 650, 190)),
        (75, 77, 2, (785, 365, 650, 100)),
        (89.8, 95, 5.2, (780, 748, 650, 220)),
    ],
    'C4-owner': [
        (12, 16, 4, ((980, 325, 200, 180), (1454, 225, 310, 180))),
        (69, 77, 8, ((535, 600, 300, 180), (1454, 615, 300, 180))),
        (77, 84.9, 7.9, ((535, 600, 300, 180), (1454, 615, 300, 180))),
    ],
    'C7-price': [
        (4, 10.2, 6.2, (785, 620, 650, 200)),
        (63, 65.2, 2.2, (785, 600, 650, 210)),
    ],
    'C4-montage': [
        (80.4, 83.4, 1.5, ((535, 600, 300, 180), (1454, 615, 300, 180))),
    ],
    'C5-paypal': [
        (0, 1.5, 1.5, (910, 0, 330, 65)),
        (1.5, 4.5, 3, (700, 415, 530, 80)),
        (0.2, 3.7, 3.5, (790, 365, 650, 170)),
        (0.2, 3.5, 3.3, (790, 445, 650, 90)),
        (72.5, 75.5, 3, (900, 915, 210, 65)),
    ],
    'C5-montage': [(0.2, 1.7, 1.5, (790, 365, 650, 170))],
    'C6-refund': [
        (0.2, 1.7, 1.5, (790, 810, 650, 130)),
        (1.7, 3.2, 1.5, (790, 810, 650, 130)),
        (101.6, 104.4, 2.8, (765, 120, 700, 170)),
    ],
}
LABELS = {
    'C1-describe': 'AI wait shortened · real: 57.7 s',
    'C2-offers': 'CUT · real offers and prices',
    'C3-review': 'CUT · exact receipt details',
    'C3b-ask': 'AI wait shortened · real: 62.0 s',
    'C4-owner': 'Approval wait shortened · left: requester · right: owner phone',
    'C7-price': 'Price change · status reloaded · cut wait',
    'C4-montage': 'SPEED ×2 · real approval tap / live update',
    'C5-paypal': 'PayPal wait shortened · real checkout / server result',
    'C5-montage': 'CUT · real verified payment',
    'C6-refund': 'Refund wait shortened · real server result',
}


def crop_filter(crop, width=WIDTH):
    x, y, w, h = crop
    return f'crop={w}:{h}:{x}:{y},scale={width}:{HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,pad={width}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color={PAPER},setsar=1'


def graph(parts, avatar_mask=False):
    filters, evidence, output_start = [], [], 0
    for i, (source, start, end, seconds, crop) in enumerate(parts):
        count = round(seconds * FPS)
        privacy = 'drawbox=x=680:y=0:w=100:h=60:color=white:t=fill,' if avatar_mask else ''
        prefix = f'[{source}:v]{privacy}trim=start={start}:end={end},setpts=(PTS-STARTPTS)*{seconds}/{end-start},fps={FPS},tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame={count},setpts=PTS-STARTPTS'
        if isinstance(crop[0], tuple):
            filters.append(prefix + f',split=2[left{i}][right{i}]')
            filters.append(f'[left{i}]' + crop_filter(crop[0], 928) + f'[l{i}]')
            filters.append(f'[right{i}]' + crop_filter(crop[1], 928) + f'[r{i}]')
            filters.append(f'[l{i}][r{i}]hstack=inputs=2,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:0:color={PAPER}[p{i}]')
        else:
            filters.append(prefix + ',' + crop_filter(crop) + f'[p{i}]')
        evidence.append({'inputIndex': source, 'sourceStartSeconds': start, 'sourceEndSeconds': end,
                         'outputStartFrame': output_start, 'durationFrames': count, 'crop': crop})
        output_start += count
    filters.append(''.join(f'[p{i}]' for i in range(len(parts))) + f'concat=n={len(parts)}:v=1:a=0,format=yuv420p[out]')
    return ';'.join(filters), evidence, output_start


def check_plan():
    for key, segments in PLANS.items():
        for start, end, seconds, crop in segments:
            assert 0 <= start < end and seconds > 0, key
            if key == 'C7-price':
                assert end <= 13 or start >= 63, 'Exclude the non-product middle of C7'
            for x, y, w, h in (crop if isinstance(crop[0], tuple) else [crop]):
                assert min(x, y) >= 0 and w > 0 and h > 0 and x+w <= 1920 and y+h <= 1080, key
                if key.startswith('C4'):
                    assert ((22 <= x and 106 <= y and x+w <= 1352 and y+h <= 1054)
                            or (1436 <= x and 106 <= y and x+w <= 1810 and y+h <= 950)), 'C4 may contain only app pixels'
    _, _, frames = graph([(0, *part) for part in PLANS['C1-describe']])
    assert frames == 315
    assert round((4+8+83-77)*FPS) == 540  # Stamp waits for both real views to be approved.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check cut math and safe crops without reading video.')
    parser.add_argument('--only', nargs='+', choices=list(PLANS), help='Prepare selected clips only.')
    parser.add_argument('--market-start', type=float, default=0)
    parser.add_argument('--market-crop', type=int, nargs=4, metavar=('X', 'Y', 'W', 'H'))
    args = parser.parse_args()
    check_plan()
    if args.check:
        print('Cut math, durations, and C4 app-only crops: PASS')
        return
    destination = ROOT / 'public/clips'
    destination.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / 'edit-excerpts.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    updates = {}
    for key in args.only or PLANS:
        name = 'C4-owner' if key == 'C4-montage' else 'C6-refund' if key == 'C5-montage' else key
        sources = [ROOT / 'raw' / f'{name}.mp4']
        parts = [(0, *part) for part in PLANS[key]]
        if key == 'C5-paypal':
            sources.append(ROOT / 'raw/C6-refund.mp4')
            parts = [part if index in (0,1,4) else (1, *part[1:]) for index, part in enumerate(parts)]
        if key == 'C2-offers' and args.market_crop:
            x, y, w, h = args.market_crop
            if min(x, y, args.market_start) < 0 or min(w, h) <= 0 or x+w > 1920 or y+h > 1080:
                raise ValueError('Invalid market crop/start')
            sources.append(ROOT / 'raw/C2-market.mp4')
            parts[-1] = (1, args.market_start, args.market_start+3.4, 3.4, tuple(args.market_crop))
        if any(not source.is_file() for source in sources):
            raise FileNotFoundError('A requested approved source recording is missing')
        filters, cuts, count = graph(parts)
        output = destination / f'{key}.mp4'
        # Encode one excerpt at a time: parallel trim branches retain full-HD
        # frames while concat waits, exceeding this 7.4 GB recording machine.
        cache = ROOT / '.cache/prepared'
        cache.mkdir(parents=True, exist_ok=True)
        fragments = []
        for index, (source, start, end, seconds, crop) in enumerate(parts):
            fragment = cache / f'{key}-{index}.mp4'
            one_filter, _, _ = graph([(0, 0, end-start, seconds, crop)], avatar_mask=key=='C5-paypal' and source==0)
            command = ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'warning', '-y',
                       '-threads', '2', '-filter_complex_threads', '1', '-ss', str(start),
                       '-i', str(sources[source]), '-filter_complex', one_filter, '-map', '[out]',
                       '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '16',
                       '-movflags', '+faststart', str(fragment)]
            subprocess.run(command, check=True, start_new_session=True)
            fragments.append(fragment)
            print(f'{key}: excerpt {index+1}/{len(parts)}', flush=True)
        listing = cache / f'{key}.ffconcat'
        listing.write_text(''.join(f"file '{fragment.name}'\n" for fragment in fragments))
        subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'warning', '-y',
                        '-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy',
                        '-movflags', '+faststart', str(output)], check=True, start_new_session=True)
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,width,height', '-of', 'json', str(output)]))['streams'][0]
        if int(probe['nb_frames']) != count or (probe['width'], probe['height']) != (WIDTH, HEIGHT):
            raise ValueError(f'{key}: encoded frame count or dimensions differ from the cut map')
        metadata = {'src': f'clips/{key}.mp4', 'from': 0, 'duration': count, 'waitLabel': LABELS[key]}
        if key == 'C3b-ask': metadata['speed'] = 1.8
        if key == 'C4-owner': metadata['approvalFrame'] = 540
        if key == 'C4-montage': metadata['approvalFrame'] = 39
        updates[key] = metadata
        manifest[key] = {'sources': [str(source.relative_to(ROOT)) for source in sources], 'width': WIDTH, 'height': HEIGHT, 'cuts': cuts, 'channel3Included': key == 'C2-offers' and bool(args.market_crop), 'privacy': 'buyer avatar masked; payment/account references excluded by crops' if key.startswith('C5') else 'app-only crops'}
        print(f'{key}: {count} frames / {count/FPS:.2f}s')
    edit_path = ROOT / 'src/edit.json'
    edit = json.loads(edit_path.read_text())
    edit['clips'].update(updates)
    edit['ready'] = False
    edit_path.write_text(json.dumps(edit, indent=2) + '\n')
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
