"""Explicit offline extraction into the caller's encrypted research directory."""
import argparse
import json
from pathlib import Path
import subprocess
import wave
import numpy as np
from prosody_research import FEATURES, FEATURE_VERSION, validate_data

parser=argparse.ArgumentParser()
parser.add_argument('--data',required=True)
parser.add_argument('--out',required=True)
args=parser.parse_args()
file=Path(args.data).resolve()
data=json.loads(file.read_text(encoding='utf-8-sig'))
data.update(featureVersion=FEATURE_VERSION,features=FEATURES)
for row in data['rows']: row['values']=[0.]*len(FEATURES)
validate_data(data,{'train','validation','test'})  # Verify consent/expiry/rights/splits before reading any recording.
extractor=Path(__file__).resolve().parent/'extract-prosody.mjs'
for row in data['rows']:
    clip=(file.parent/row['wavPath']).resolve()
    if clip.stat().st_size>10*1048576: raise ValueError('Research clip exceeds 10 MiB')
    with wave.open(str(clip),'rb') as audio:
        channels=audio.getnchannels()
        if audio.getframerate()!=16000 or channels not in (1,2) or audio.getsampwidth()!=2:
            raise ValueError('Requires real 16-kHz PCM16 WAV; resample offline first, never relabel')
        samples=np.frombuffer(audio.readframes(audio.getnframes()),dtype='<i2').reshape(-1,channels).mean(1).astype('<f4')/32768
    if not .8<=len(samples)/16000<=9.5: raise ValueError('Tone research utterance must be 0.8–9.5 seconds')
    result=subprocess.run(['node',str(extractor)],input=samples.astype('<f4').tobytes(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
    summary=json.loads(result.stdout)
    if summary['featureNames']!=FEATURES or summary['version']!=FEATURE_VERSION: raise ValueError('Feature parity mismatch')
    row['values']=summary['features']
    del row['wavPath']
validate_data(data,{'train','validation','test'})
target=Path(args.out)
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Offline features exported after consent/expiry/split checks. No recordings or transcripts logged.')
