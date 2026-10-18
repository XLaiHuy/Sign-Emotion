"""Local reference subprocess for the paired clamping study. No network/logged text."""
import argparse
import json
import os
import platform
from pathlib import Path
import time
import wave
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=['vad', 'decode'])
parser.add_argument('manifest', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
job = json.loads(args.manifest.read_text(encoding='utf-8'))
if args.mode == 'vad':
    import onnxruntime as ort
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    vad = ort.InferenceSession(str(root/'public/models/local/silero_vad.onnx'),
                              sess_options=options, providers=['CPUExecutionProvider'])
    for item in job['samples']:
        with wave.open(item['path'], 'rb') as audio:
            if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) != (16000, 1, 2):
                raise ValueError('Expected mono 16-kHz PCM16')
            samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(np.float32)/32768
        samples.astype('<f4').tofile(item['pcm'])
        state = np.zeros((2, 1, 128), np.float32)
        context = np.zeros(64, np.float32)
        scores = []
        for offset in range(0, len(samples), 512):
            frame = np.zeros(512, np.float32)
            part = samples[offset:offset+512]
            frame[:len(part)] = part
            outputs = vad.run(['output', 'stateN'], {
                'input': np.concatenate([context, frame])[None, :],
                'state': state, 'sr': np.array(16000, dtype=np.int64)})
            state = outputs[1]
            context = frame[-64:].copy()
            scores.append(float(outputs[0].flat[0]))
        Path(item['scores']).write_text(json.dumps(scores), encoding='utf-8')
else:
    import sherpa_onnx
    os.chdir(root/'output/research-assets/gipformer')
    recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder='encoder.int8.onnx', decoder='decoder.int8.onnx', joiner='joiner.int8.onnx',
        tokens='tokens.txt', num_threads=1, sample_rate=16000, feature_dim=80,
        decoding_method='greedy_search')
    results = []
    for item in job['segments']:
        samples = np.fromfile(item['pcm'], dtype='<f4')
        stream = recognizer.create_stream()
        start = time.perf_counter()
        stream.accept_waveform(16000, samples)
        recognizer.decode_stream(stream)
        results.append(dict(id=item['id'], variant=item['variant'], index=item['index'],
                            text=stream.result.text.strip(), ms=(time.perf_counter()-start)*1000))
    import onnxruntime as ort
    Path(job['results']).write_text(json.dumps(dict(
        runtime=dict(python=platform.python_version(), sherpa=sherpa_onnx.__version__,
                     onnxruntime=ort.__version__, threads=1, provider='CPU'),
        segments=results), ensure_ascii=False), encoding='utf-8')
print('Local reference job completed; no transcript emitted to logs.')
