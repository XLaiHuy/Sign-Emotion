"""Reference inference for the pinned browser adapters, not accuracy validation."""
from pathlib import Path
import json
import numpy as np
import onnxruntime as ort
import soundfile as sf
from transformers import PhobertTokenizer

root = Path(__file__).resolve().parents[1]
out = root / 'output/evaluation'
base = root / 'public/models/local'
text_dir = base / 'huyleit/phobert-emotion-social'
samples, sr = sf.read(out / 'fleurs-vi-validation-4.wav', dtype='float32')
assert sr == 16000
samples = samples[:64000]
sf.write(out / 'parity.wav', samples, sr, subtype='PCM_16')
# Re-read the exact PCM representation the browser will decode.
samples, sr = sf.read(out / 'parity.wav', dtype='float32')
text = json.loads((root / 'tests/phobert-parity.json').read_text(encoding='utf-8'))[1]['text']
tokenizer = PhobertTokenizer.from_pretrained(str(text_dir), local_files_only=True)
ids = np.asarray([tokenizer.encode(text, truncation=True, max_length=128)], dtype=np.int64)
options = ort.SessionOptions()
options.intra_op_num_threads = 1
text_session = ort.InferenceSession(str(text_dir / 'onnx/phobert_emotion_int8.onnx'), options, providers=['CPUExecutionProvider'])
text_logits = text_session.run(None, {'input_ids': ids, 'attention_mask': np.ones_like(ids)})[0][0]
del text_session
def softmax(values):
    exp = np.exp(values - values.max())
    return (exp / exp.sum()).tolist()
report = {'text': text, 'samples': len(samples), 'textLabels': ['Enjoyment', 'Sadness', 'Disgust', 'Anger', 'Fear', 'Surprise', 'Other'], 'textProbabilities': softmax(text_logits), 'scope': 'Python vs browser text preprocessing/runtime parity only'}
(out / 'emotion-parity-reference.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('Prepared Python ONNX reference and exact PCM waveform')
