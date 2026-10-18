"""Public FLEURS Vietnamese smoke samples + Python tokenizer parity.
No private recordings. Dataset: google/fleurs, CC BY 4.0.
"""
from pathlib import Path
import argparse, hashlib, json, urllib.request
import numpy as np
import soundfile as sf
from transformers import PhobertTokenizer

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--samples',type=int,default=5);args=parser.parse_args()
out=root/'output/evaluation';out.mkdir(parents=True,exist_ok=True)
tokenizer=PhobertTokenizer.from_pretrained(str(root/'public/models/local/huyleit/phobert-emotion-social'),local_files_only=True)
texts=['Hôm nay tôi rất vui.', 'Mình thấy buồn vì chuyện đó.', 'Tôi không đồng ý!', 'Bạn có khỏe không?', 'Thật bất ngờ quá!', 'Tôi đang học ở trường đại_học.', 'Xin chào 😊', '  nhiều   khoảng trắng\nở đây ']
fixture=[{'text':text,'ids':tokenizer.encode(text,truncation=True,max_length=128)} for text in texts]
(root/'tests/phobert-parity.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
url=f'https://datasets-server.huggingface.co/rows?dataset=google%2Ffleurs&config=vi_vn&split=validation&offset=0&length={min(max(args.samples,1),20)}'
rows=json.load(urllib.request.urlopen(url))['rows'];samples=[]
for entry in rows:
 row=entry['row'];source=row['audio'][0]['src'];data=urllib.request.urlopen(source).read();path=out/f'fleurs-vi-validation-{entry["row_idx"]}.wav'
 import io
 audio,sr=sf.read(io.BytesIO(data),dtype='float32');sf.write(path,audio,sr,subtype='PCM_16')
 samples.append({'id':row['id'],'row':entry['row_idx'],'path':str(path.relative_to(root)).replace('\\','/'),'reference':row['transcription'],'sampleRate':sr,'seconds':len(audio)/sr,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(out/'fleurs-samples.json').write_text(json.dumps({'dataset':'google/fleurs','config':'vi_vn','split':'validation','license':'CC-BY-4.0','source':'https://huggingface.co/datasets/google/fleurs','purpose':'ASR smoke test, not emotion or dialect coverage','samples':samples},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Prepared {len(samples)} public Vietnamese samples and {len(fixture)} tokenizer fixtures')
