"""Explicit offline PC file evaluation; never loaded by the product/browser."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
parser = argparse.ArgumentParser()
parser.add_argument('--model', default='output/research-models/meralion-ser')
parser.add_argument('--audio', required=True)
parser.add_argument('--out', required=True, help='Explicit local research result export, never audit')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
model_path = Path(args.model).resolve()
lock = json.loads((root/'scripts/meralion-ser.lock.json').read_text(encoding='utf-8'))
def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4*1024*1024), b''): value.update(block)
    return value.hexdigest()
for name, expected in lock['files'].items():
    if digest(model_path/name) != expected: raise ValueError('Pinned research artifact mismatch')
if digest(model_path/'whisper-config/config.json') != lock['whisperConfig']['sha256']: raise ValueError('Whisper config mismatch')
import numpy as np
import soundfile as sf
import torch
from transformers import AutoConfig, AutoProcessor, AutoModelForAudioClassification
waveform, rate = sf.read(args.audio,dtype='float32')
if rate != 16000 or waveform.ndim != 1 or not np.isfinite(waveform).all() or not 16000 <= len(waveform) <= 15*16000:
    raise ValueError('Requires finite mono 16-kHz PCM, 1–15 seconds; no sample-rate relabelling')
config = AutoConfig.from_pretrained(str(model_path),trust_remote_code=True,local_files_only=True)
if [config.id2label[i] for i in range(7)] != lock['labels']: raise ValueError('SER label order mismatch')
# Upstream constructs WhisperModel from config; local config avoids an implicit network fetch.
config.whisper_name = str(model_path/'whisper-config')
processor = AutoProcessor.from_pretrained(str(model_path),local_files_only=True)
started = time.perf_counter()
model = AutoModelForAudioClassification.from_pretrained(str(model_path),config=config,trust_remote_code=True,local_files_only=True,use_safetensors=True).cpu().eval()
prepare_ms = (time.perf_counter()-started)*1000
inputs = processor(waveform,sampling_rate=16000,return_tensors='pt',return_attention_mask=True)
started = time.perf_counter()
with torch.inference_mode(): output = model(**{key:value for key,value in inputs.items() if key in ('input_features','attention_mask')})
inference_ms = (time.perf_counter()-started)*1000
logits = output['logits'].detach().cpu().numpy().reshape(-1).tolist()
if len(logits)!=7 or not np.isfinite(logits).all(): raise ValueError('Invalid SER output')
report = dict(profile=lock['profile'],revision=lock['revision'],researchOnly=True,validated=False,seconds=len(waveform)/16000,prepareMs=prepare_ms,inferenceMs=inference_ms,rtf=inference_ms/(len(waveform)/16),labels=lock['labels'],logits=logits,scope='Explicit local file reference export, not Vietnamese accuracy or browser/Android validation')
Path(args.out).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Completed local PC research export. No audio, transcript or per-clip label entered audit.')
