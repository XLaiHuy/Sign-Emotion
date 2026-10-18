---
name: signemo-speech-on-device
description: Implement or diagnose SignEmo local microphone, VAD and Vietnamese ASR pipelines, including audio lifecycle and hardware constraints.
---

Read `doc/MVP_SPEC.md`, `doc/SPEECH_AI.md` and the affected worker adapter. Microphone use is authorized for adult one-counterpart conversations. No browser/cloud SpeechRecognition fallback: inference and PCM stay on the current device.

AudioWorklet downmixes and low-pass resamples to 16 kHz. Keep VAD's 512-sample frames, recurrent state and context intact; do not relabel sample rate without resampling. ASR runs one task at a time. Audio queues are bounded; overload stops capture with an explicit notice, never silent frame loss. Flush pending speech on explicit finish; background/navigation abort immediately and report that only finalized captions remain.

Use pinned local assets and matching Transformers.js WASM binaries. Never interchange the speech ORT build with the face ORT build. Do not add GPU or larger models as a default without measuring real-time factor, tail latency and memory on the intended device. Preserve captions when optional emotion inference fails.

Regression-test permissions, cancellation during initialization, tail flush, queue backpressure, sample counts, resampling and silence. Measure Vietnamese WER/CER with dataset provenance. PC fixture audio cannot verify physical microphone intelligibility or Android performance.
