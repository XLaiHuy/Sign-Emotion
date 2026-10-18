"""Pinned ONNX conversion only: no training, microphone, transcripts or dataset access."""
import hashlib
import json
import shutil
import tempfile
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "output/research-assets/emotion2vec-tone"
PINNED = {
    "emotion2vec_plus_base.onnx": "a9ddcc2f4254c3da1dc2a51ea5e38df32e2a84724519e343499f05f0ea2b3506",
    "emotion2vec_head.json": "69666ff0d2873f016f5a8187b685e32a2c419130876bf97b069c981c44cfe02c",
    "LICENSE": "7dba975a2069691db4992b0592d70828b330d2f8a30a71450f4e152a554e84f8",
}
for name, expected in PINNED.items():
    if hashlib.file_digest((TARGET / name).open("rb"), "sha256").hexdigest() != expected:
        raise ValueError(f"Pinned artifact mismatch: {name}")
head = json.loads((TARGET / "emotion2vec_head.json").read_text(encoding="utf8"))
labels = ["angry", "disgusted", "fearful", "happy", "neutral", "other", "sad", "surprised", "unknown"]
if head["labels"] != labels:
    raise ValueError("Unexpected label order")
weight, bias = np.asarray(head["weight"], np.float32), np.asarray(head["bias"], np.float32)
if weight.shape != (9, 768) or bias.shape != (9,):
    raise ValueError("Unexpected head shape")
model = onnx.load(TARGET / "emotion2vec_plus_base.onnx")
if len(model.graph.input) != 1 or len(model.graph.output) != 1:
    raise ValueError("Unexpected backbone I/O")
feature = model.graph.output[0].name
opset = next(item.version for item in model.opset_import if item.domain == "")
model.graph.initializer.extend([
    numpy_helper.from_array(weight.T.copy(), "signemo_tone_weight"),
    numpy_helper.from_array(bias, "signemo_tone_bias"),
])
if opset >= 18:
    model.graph.initializer.append(numpy_helper.from_array(np.asarray([1], np.int64), "signemo_tone_axes"))
    pool = helper.make_node("ReduceMean", [feature, "signemo_tone_axes"], ["signemo_tone_pooled"], keepdims=0)
else:
    pool = helper.make_node("ReduceMean", [feature], ["signemo_tone_pooled"], axes=[1], keepdims=0)
model.graph.node.extend([
    pool,
    helper.make_node("MatMul", ["signemo_tone_pooled", "signemo_tone_weight"], ["signemo_tone_linear"]),
    helper.make_node("Add", ["signemo_tone_linear", "signemo_tone_bias"], ["signemo_tone_logits"]),
])
del model.graph.output[:]
model.graph.output.append(helper.make_tensor_value_info("signemo_tone_logits", TensorProto.FLOAT, [1, 9]))
model.metadata_props.add(key="signemo.source", value="emotion2vec/emotion2vec_plus_base; ONNX export by ziyu12345/pankotaro")
model.metadata_props.add(key="signemo.modification", value="Mean pool + published linear head; dynamic INT8 MatMul/Gemm, no retraining")
onnx.checker.check_model(model)
floating = TARGET / "tone.fp32.onnx"
quantized = TARGET / "tone.int8-reduced.onnx"
input_name = model.graph.input[0].name
onnx.save(model, floating)
del model
# ORT's Windows shape-inference writer cannot handle this workspace's Unicode
# path. Only conversion intermediates use a verified ASCII temporary directory.
temporary = Path(tempfile.mkdtemp(prefix="signemo-tone-"))
if temporary.resolve().parent != Path(tempfile.gettempdir()).resolve():
    raise ValueError("Unexpected temporary directory")
try:
    temporary_input = temporary / "tone.fp32.onnx"
    temporary_output = temporary / "tone.int8.onnx"
    shutil.copyfile(floating, temporary_input)
    quantize_dynamic(str(temporary_input), str(temporary_output), weight_type=QuantType.QInt8,
                     per_channel=True, reduce_range=True, op_types_to_quantize=["MatMul", "Gemm"])
    shutil.copyfile(temporary_output, quantized)
finally:
    for intermediate in temporary.iterdir():
        if intermediate.is_file():
            intermediate.unlink()
    temporary.rmdir()
manifest = {
    "version": "emotion2vec-plus-base-int8-reduced-demo-v2",
    "source": "https://huggingface.co/pankotaro/emotion2vec-plus-base-onnx/tree/334d4376993c381f059cc36d2c6ed05cbfec5ca1",
    "upstream": "https://huggingface.co/emotion2vec/emotion2vec_plus_base",
    "license": "FunASR Model Open Source License 1.1",
    "modification": "Published linear head fused; dynamic INT8 MatMul/Gemm, reduced 7-bit weight range, no training",
    "sha256": hashlib.file_digest(quantized.open("rb"), "sha256").hexdigest(),
    "bytes": quantized.stat().st_size,
    "inputName": input_name,
    "outputName": "signemo_tone_logits",
    "labels": labels,
    "sampleRate": 16000,
    "minimumSamples": 12800,
    "maximumSamples": 48000,
    "preprocessing": "Raw mono float32 PCM [-1,1]; no ASR embedding or generated text",
    "precision": "dynamic-int8-reduced-matmul-gemm",
    "runtime": "onnxruntime-web-wasm",
    "vietnameseValidated": False,
    "experimental": True,
}
(TARGET / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
print(json.dumps({"bytes": manifest["bytes"], "sha256": manifest["sha256"], "input": input_name, "opset": opset}))
