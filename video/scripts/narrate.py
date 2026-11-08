"""Synthesize scene WAVs and phrase-timed captions using selected Heart voice."""
import json
import math
import wave
from pathlib import Path

import numpy as np
from voice_samples import ROOT, SPEED, digest, load_engine, normalize


def main():
    scenes = json.loads((ROOT / 'scene-script.json').read_text())
    engine = load_engine()
    output = ROOT / 'out' / 'voice'
    output.mkdir(parents=True, exist_ok=True)
    public = ROOT / 'public' / 'voice'
    public.mkdir(parents=True, exist_ok=True)
    timeline = {'fps': 30, 'totalFrames': 0, 'scenes': []}
    manifest = {'voice': 'af_heart', 'locale': 'en-us', 'speed': SPEED, 'scenes': []}
    for scene in scenes:
        print(f'Scene {scene["id"]}: synthesizing Heart', flush=True)
        chunks, captions = [], []
        rate, cursor = 24000, 0.4
        chunks.append(np.zeros(round(cursor * rate), dtype=np.float32))
        for phrase in scene['phrases']:
            audio, actual_rate = engine.create(phrase, voice='af_heart', speed=SPEED, lang='en-us')
            assert actual_rate == rate
            audio = np.asarray(audio, dtype=np.float32)
            assert np.isfinite(audio).all() and audio.size > 0
            start = cursor
            cursor += len(audio) / rate
            captions.append({'startFrame': round(start * 30), 'endFrame': round(cursor * 30), 'text': phrase})
            chunks += [audio, np.zeros(round(0.10 * rate), dtype=np.float32)]
            cursor += 0.10
        chunks.append(np.zeros(round(0.25 * rate), dtype=np.float32))
        raw = output / f'.scene-{scene["id"]}-raw.wav'
        with wave.open(str(raw), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            wav.writeframes((np.clip(np.concatenate(chunks), -1, 1) * 32767).astype('<i2').tobytes())
        path = output / f'scene-{scene["id"]}.wav'
        levels = normalize(raw, path, pad=False)
        raw.unlink()
        public_path = public / path.name
        public_path.write_bytes(path.read_bytes())
        with wave.open(str(path), 'rb') as wav:
            seconds = wav.getnframes() / wav.getframerate()
        frames = max(round(scene['minimumSeconds'] * 30), math.ceil((seconds + 1.0) * 30))
        timeline['scenes'].append({
            'id': scene['id'], 'startFrame': timeline['totalFrames'], 'durationFrames': frames,
            'voicePath': 'voice/' + path.name, 'text': ' '.join(scene['phrases']), 'captions': captions,
        })
        timeline['totalFrames'] += frames
        manifest['scenes'].append({'id': scene['id'], 'seconds': seconds,
            'integrated_lufs': float(levels['input_i']), 'true_peak_dbtp': float(levels['input_tp']),
            'sha256': digest(path)})
        print(f'  Voice {seconds:.1f}s; scene {frames / 30:.1f}s', flush=True)
    # Breathing room follows voice duration; original 165s is a floor, 175s a hard cap.
    if timeline['totalFrames'] > 175 * 30:
        raise RuntimeError('Narration exceeds the 2:55 ceiling; shorten copy, never silently speed it up')
    (output / 'timeline-unpaced.json').write_text(json.dumps(timeline, indent=2) + '\n')
    (ROOT / 'src' / 'timeline.json').write_text(json.dumps(timeline, indent=2) + '\n')
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Timeline: {timeline["totalFrames"] / 30:.2f}s', flush=True)


if __name__ == '__main__':
    main()
