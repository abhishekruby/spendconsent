"""One runnable artifact check: python scripts/check_voice_samples.py."""
import hashlib
import json
from pathlib import Path
import wave

from voice_samples import VOICES, TEXT, SPEED

output = Path(__file__).resolve().parents[1] / 'out' / 'voice-samples'
manifest = json.loads((output / 'manifest.json').read_text())
assert manifest['text'] == TEXT and manifest['speed'] == SPEED
assert len(manifest['samples']) == 4
for sample, expected in zip(manifest['samples'], VOICES, strict=True):
    assert (sample['choice'], sample['voice'], sample['name'], sample['gender'],
            sample['locale']) == expected
    path = output / sample['file']
    with path.open('rb') as handle:
        assert hashlib.file_digest(handle, 'sha256').hexdigest() == sample['sha256']
    with wave.open(str(path), 'rb') as handle:
        assert handle.getnchannels() == 1 and handle.getsampwidth() == 2
        assert handle.getframerate() == 48000
        duration = handle.getnframes() / handle.getframerate()
        assert 5 < duration < 30
        assert abs(duration - sample['duration_seconds']) < 0.001
    assert -14.5 <= sample['integrated_lufs'] <= -13.5
    assert sample['true_peak_dbtp'] <= -1.0
print('PASS: four matching auditions; 48 kHz PCM; −14 LUFS; no clipped true peaks.')
