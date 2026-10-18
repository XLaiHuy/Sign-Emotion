"""Maintainer-only lock refresh. Review licenses/revisions before running."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sources = [
    ('speech', 'onnx-community/whisper-tiny', 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7', 'MIT',
     ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx']),
    ('emotion', 'huyleit/phobert-emotion-social', '422ce9959c4e9138d76f6a97f51addbfbaca92a7', 'MIT (model card)',
     ['config.json', 'tokenizer_config.json', 'vocab.txt', 'bpe.codes', 'onnx/phobert_emotion_int8.onnx']),
]
assets = []
for pack, repo, revision, license_name, files in sources:
    metadata = json.load(urllib.request.urlopen(f'https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true'))
    indexed = {item['rfilename']: item for item in metadata['siblings']}
    for name in files:
        url = f'https://huggingface.co/{repo}/resolve/{revision}/{name}'
        meta = indexed[name]
        checksum = meta.get('lfs', {}).get('sha256')
        if not checksum:
            checksum = hashlib.sha256(urllib.request.urlopen(url).read()).hexdigest()
        assets.append({'pack': pack, 'url': f'/models/local/{repo}/{name}', 'source': url,
                       'bytes': meta['size'], 'sha256': checksum, 'license': license_name})
revision = '1e261b036686cd0017d500ee96acd1c4ba572a9d'
url = f'https://raw.githubusercontent.com/snakers4/silero-vad/{revision}/src/silero_vad/data/silero_vad.onnx'
data = urllib.request.urlopen(url).read()
assets.append({'pack':'speech', 'url':'/models/local/silero_vad.onnx', 'source':url,
               'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(), 'license':'MIT — Silero VAD'})
(ROOT / 'scripts/conversation-assets.lock.json').write_text(json.dumps({'version':'conversation-v2','assets':assets}, indent=2)+'\n', encoding='utf-8')
print(f'Pinned {len(assets)} files; model revision and SHA-256 are explicit')
