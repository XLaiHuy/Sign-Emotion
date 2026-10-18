"""Synthetic tensor parity only: no expression labels or accuracy claims."""
from pathlib import Path
import hashlib
import json
import time
import numpy as np
import onnxruntime as ort

root = Path(__file__).resolve().parents[1]
output = root / 'output/research-assets/face-parity'
output.mkdir(parents=True, exist_ok=True)
profiles = [
    ('b0', root/'output/research-assets/emotieff-b0/enet_b0_8_best_afew.onnx', 224, '/research/emotieff-b0/enet_b0_8_best_afew.onnx'),
    ('b2', root/'output/research-assets/emotieff-b2/enet_b2_8.onnx', 260, '/research/emotieff-b2/enet_b2_8.onnx'),
]
rows = []
for name, path, size, url in profiles:
    y, x = np.indices((size,size))
    rgba = np.stack([(x*3+y)%256,(y*5+20)%256,(x+y*7)%256,np.full_like(x,255)],axis=-1).astype(np.uint8)
    (output/f'{name}.rgba').write_bytes(rgba.tobytes())
    image = rgba[:,:,:3].astype(np.float32)/255
    image = (image-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)
    tensor = image.transpose(2,0,1)[None].copy()
    options = ort.SessionOptions(); options.intra_op_num_threads = 1
    session = ort.InferenceSession(str(path),options,providers=['CPUExecutionProvider'])
    assert session.get_inputs()[0].shape[1:] == [3,size,size]
    logits = session.run(None,{session.get_inputs()[0].name:tensor})[0].flatten().tolist()
    timings=[]
    for _ in range(30):
        start=time.perf_counter(); session.run(None,{session.get_inputs()[0].name:tensor}); timings.append((time.perf_counter()-start)*1000)
    rows.append(dict(profile=name,url=url,size=size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),rgba=f'/research/face-parity/{name}.rgba',logits=logits,pythonP50Ms=float(np.percentile(timings,50)),pythonP95Ms=float(np.percentile(timings,95))))
    del session
(output/'manifest.json').write_text(json.dumps({'scope':'Synthetic RGB tensor parity and isolated classifier latency, not face quality/accuracy or whole pipeline','profiles':rows},indent=2),encoding='utf-8')
print('Prepared B0/B2 synthetic RGB parity; no media or accuracy evidence.')
