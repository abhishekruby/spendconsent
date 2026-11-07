"""Four comparable, local-only auditions; no hosted inference or credentials."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import urllib.request
import wave

ROOT = Path(__file__).resolve().parents[1]
# Keep even phonemizer/ONNX cache writes inside the authorized video folder.
os.environ['XDG_CACHE_HOME'] = str(ROOT / '.cache')
temporary = ROOT / '.cache' / 'tmp'
temporary.mkdir(parents=True, exist_ok=True)
os.environ['TMPDIR'] = str(temporary)

TEXT = (
    'AI agents can already shop for you. But would you give one your card? '
    'With SpendConsent, a person approves the exact cart. '
    'PayPal verifies the payment.'
)
VOICES = [
    ('A', 'af_heart', 'Heart', 'female', 'en-us'),
    ('B', 'am_michael', 'Michael', 'male', 'en-us'),
    ('C', 'bf_emma', 'Emma', 'female', 'en-gb'),
    ('D', 'bm_george', 'George', 'male', 'en-gb'),
]
SPEED = 0.96


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def model_file(name, spec):
    target = ROOT / 'models' / name
    target.parent.mkdir(exist_ok=True)
    if not target.exists():
        partial = target.with_suffix(target.suffix + '.part')
        urllib.request.urlretrieve(spec['url'], partial)
        if partial.stat().st_size != spec['bytes'] or digest(partial) != spec['sha256']:
            raise RuntimeError(f'Checksum mismatch: {name}; refusing inference')
        partial.replace(target)
    if target.stat().st_size != spec['bytes'] or digest(target) != spec['sha256']:
        raise RuntimeError(f'Checksum mismatch: {name}; refusing inference')
    return target


def run_ffmpeg(arguments):
    result = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostdin', '-y', *arguments],
        capture_output=True, text=True, check=True,
    )
    return result.stderr


def loudness_report(stderr):
    start = stderr.rfind('{')
    end = stderr.rfind('}')
    return json.loads(stderr[start:end + 1])


def measure_audio(path):
    return loudness_report(run_ffmpeg([
        '-i', str(path), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json',
        '-f', 'null', '-',
    ]))


def main():
    import numpy as np
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    specs = json.loads((ROOT / 'models.json').read_text())
    paths = {name: model_file(name, spec) for name, spec in specs.items()}
    options = ort.SessionOptions()
    options.intra_op_num_threads = min(4, os.cpu_count() or 1)
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(paths['kokoro-v1.0.onnx']),
        sess_options=options, providers=['CPUExecutionProvider'])
    engine = Kokoro.from_session(session, str(paths['voices-v1.0.bin']))
    output = ROOT / 'out' / 'voice-samples'
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'text': TEXT, 'speed': SPEED, 'engine': 'kokoro-onnx==0.6.1',
                'model_release': 'model-files-v1.0',
                'normalization': 'two-pass loudnorm; level match with 4x oversampled peak limiter',
                'samples': []}

    for choice, voice, name, gender, locale in VOICES:
        print(f'Generating {choice}: {name} ({locale})', flush=True)
        samples, rate = engine.create(TEXT, voice=voice, speed=SPEED, lang=locale)
        samples = np.asarray(samples)
        if not np.isfinite(samples).all() or samples.size == 0:
            raise RuntimeError(f'Invalid audio from {voice}')
        raw = output / f'.{voice}-raw.wav'
        with wave.open(str(raw), 'wb') as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(rate)
            handle.writeframes((np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes())
        target = output / f'{choice}-{voice}.wav'
        # Two-pass loudnorm gives matching audition levels and limits true peaks.
        base = 'adelay=200:all=1,apad=pad_dur=0.45,loudnorm=I=-14:TP=-1.5:LRA=7'
        measure = loudness_report(run_ffmpeg([
            '-i', str(raw), '-af', base + ':print_format=json', '-f', 'null', '-',
        ]))
        normalizer = base + (
            f":measured_I={measure['input_i']}:measured_TP={measure['input_tp']}"
            f":measured_LRA={measure['input_lra']}:measured_thresh={measure['input_thresh']}"
            f":offset={measure['target_offset']}:linear=true"
        )
        run_ffmpeg(['-i', str(raw), '-af', normalizer,
                    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', str(target)])
        measured = measure_audio(target)
        # Loudnorm can undershoot on short, high-crest-factor speech. Match the
        # audition level after resampling; catch only the newly raised peaks.
        correction = -14 - float(measured['input_i'])
        if abs(correction) > 0.1:
            leveled = target.with_suffix('.level.wav')
            run_ffmpeg(['-i', str(target), '-af',
                f'aresample=192000,volume={correction:.3f}dB,'
                'alimiter=limit=0.841395:level=false:latency=true,aresample=48000',
                '-c:a', 'pcm_s16le', str(leveled)])
            leveled.replace(target)
            measured = measure_audio(target)
        with wave.open(str(target), 'rb') as handle:
            duration = handle.getnframes() / handle.getframerate()
        manifest['samples'].append({
            'choice': choice, 'voice': voice, 'name': name, 'gender': gender,
            'locale': locale, 'file': target.name, 'duration_seconds': round(duration, 3),
            'sample_rate': 48000, 'integrated_lufs': float(measured['input_i']),
            'true_peak_dbtp': float(measured['input_tp']), 'sha256': digest(target),
        })
        raw.unlink()
        print(f'  {duration:.2f}s; {measured["input_i"]} LUFS; '
              f'{measured["input_tp"]} dBTP', flush=True)

    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Four auditions ready. Stop here for the user to choose A/B/C/D.', flush=True)


if __name__ == '__main__':
    main()
