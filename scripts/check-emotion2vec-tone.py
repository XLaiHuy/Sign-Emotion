"""Numeric compatibility on synthetic tones, not Vietnamese emotion accuracy."""
import json
import time
import sys
from pathlib import Path
import numpy as np
import onnxruntime as ort

target = Path(__file__).resolve().parent.parent / "output/research-assets/emotion2vec-tone"
settings = ort.SessionOptions()
settings.intra_op_num_threads = 1
fp32 = "--fp32" in sys.argv
session = ort.InferenceSession(str(target / ("tone.fp32.onnx" if fp32 else "tone.int8-reduced.onnx")), settings, providers=["CPUExecutionProvider"])
rows = []
public_speech = "--public-speech" in sys.argv
pcm = np.fromfile(target.parent / "evaluation/0.f32", dtype=np.float32) if public_speech else None
prefix = "public" if public_speech else "synthetic"
for count in [12800, 25600, 48000]:
    samples = pcm[32000:32000+count].copy() if public_speech else (0.05 * np.sin(2*np.pi*170*np.arange(count)/16000)).astype(np.float32)
    if len(samples) != count:
        raise ValueError("Insufficient PCM fixture")
    samples.tofile(target / f"{prefix}-{count}.f32")
    started = time.perf_counter()
    output = session.run(None, {"input": samples[None]})[0]
    if output.shape != (1,9) or not np.isfinite(output).all():
        raise ValueError("Invalid tone output")
    rows.append({"samples":count,"processingMs":(time.perf_counter()-started)*1000,"logits":output[0].tolist()})
(target / f"{prefix}{'-fp32' if fp32 else ''}-reference.json").write_text(json.dumps({"scope":"Public FLEURS Vietnamese, no emotion ground truth" if public_speech else "Synthetic, no human media","rows":rows},indent=2)+"\n",encoding="utf8")
# Historical browser probe path, now always explicitly labeled by scope.
if not public_speech and not fp32:
    (target / "reference.json").write_text(json.dumps({"scope":"Synthetic, no human media","rows":rows},indent=2)+"\n",encoding="utf8")
print(json.dumps({"rows":[{"samples":row["samples"],"processingMs":row["processingMs"]} for row in rows]}))
