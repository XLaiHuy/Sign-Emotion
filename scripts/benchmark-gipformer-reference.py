"""Public/licensed 16-kHz PCM smoke reference; no recording or hosted inference."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time
import wave
import numpy as np
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument('--samples',default='output/evaluation/fleurs-samples.json')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
metadata = json.loads((root/args.samples).read_text(encoding='utf-8'))
if metadata.get('license') != 'CC-BY-4.0' or metadata.get('dataset') != 'google/fleurs':
    raise ValueError('This smoke helper accepts the verified public FLEURS fixture only')
out = root/'output/research-assets/evaluation'
out.mkdir(parents=True,exist_ok=True)
model = root/'output/research-assets/gipformer'
os.chdir(model)  # Relative ASCII file names also work with Windows native file APIs.
recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder='encoder.int8.onnx',decoder='decoder.int8.onnx',joiner='joiner.int8.onnx',
    tokens='tokens.txt',num_threads=1,sample_rate=16000,feature_dim=80,decoding_method='greedy_search')
rows=[]
for index,item in enumerate(metadata['samples']):
    file=root/item['path']
    if hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:
        raise ValueError('Public fixture checksum mismatch')
    with wave.open(str(file),'rb') as audio:
        if audio.getframerate()!=16000 or audio.getnchannels()!=1 or audio.getsampwidth()!=2:
            raise ValueError('Expected actual mono 16-kHz PCM16; never relabel another rate')
        samples=np.frombuffer(audio.readframes(audio.getnframes()),dtype='<i2').astype(np.float32)/32768
    (out/f'{index}.f32').write_bytes(samples.astype('<f4').tobytes())
    stream=recognizer.create_stream()
    stream.accept_waveform(16000,samples)
    start=time.perf_counter()
    recognizer.decode_stream(stream)
    rows.append(dict(id=item['id'],url=f'/research/evaluation/{index}.f32',reference=item['reference'],
                     seconds=len(samples)/16000,pythonText=stream.result.text.strip(),pythonMs=(time.perf_counter()-start)*1000))
(out/'manifest.json').write_text(json.dumps(dict(dataset=metadata['dataset'],license=metadata['license'],source=metadata['source'],samples=rows),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Prepared exact PCM and Python reference for {len(rows)} public smoke samples; not a promotion dataset.')
