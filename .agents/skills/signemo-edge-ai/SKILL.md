---
name: signemo-edge-ai
description: Evaluate, integrate or optimize SignEmo face-expression models and on-device inference. Use for model preprocessing, metrics, datasets and benchmarks, not general AI chat or unrelated ML.
---

Read the AI/data sections of `doc/MVP_SPEC.md` and `doc/PILOT.md`. FER+ INT8 baseline uses grayscale float32 NCHW 64x64 with values 0–255. Preserve original label order; unsupported winning classes become uncertain. MediaPipe blendshapes are features, not emotion probabilities.

For speech/text/voice changes also load signemo-speech-on-device and signemo-multimodal-evaluation. Conversation assets are pinned in `scripts/conversation-assets.lock.json`. Keep model adapters under infrastructure, calibration/fusion under pure domain. Runtime compatibility and preprocessing parity are required before interpreting accuracy; never multiply correlated modality scores as independent probabilities.

Check exact model source/license/checksum in `public/models/manifest.json` before modifying runtime or weights. Baseline is CPU/WASM worker with one frame in flight. Measure transfer/scheduling and model processing separately from dwell/cooldown and actual haptic latency. Never equate benchmark on high-FPS laboratory micro-expression datasets with phone performance.

Split datasets by participant before tuning. Report per-class precision/recall, macro-F1, coverage and false triggers; document missing class support. Keep research clips offline with separate consent and expiry. Local MLP is a conditional branch only after baseline evidence and consented data exist; do not fabricate training or validation results. After two unsuccessful improvement rounds revisit data/scope.
