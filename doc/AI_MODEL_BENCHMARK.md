# SignEmo AI benchmark and promotion protocol

## Purpose

This document records the evidence required before promoting SignEmo's on-device Vietnamese ASR or face-expression model as validated. Model-card results are candidate-selection evidence only; they are not SignEmo accuracy or latency results. The current face profile is EmotiEffLib `enet_b0_8_best_afew`, pinned and bundled for PC testing; this is a model replacement, not evidence that its accuracy or performance is better on SignEmo. The ASR test profile tries PhoWhisper-tiny q8 first and falls back to multilingual Whisper tiny q8 if it cannot initialize. Neither branch has passed all participant-separated promotion gates. MediaPipe Face Landmarker remains unchanged.

All audio, video, frames, landmarks and transcripts remain on the device. Research recordings require separate informed consent, pseudonymous participant IDs, an expiry date, encrypted offline storage and participant-level train/validation/test separation. Never put recordings or identifying metadata in Git, cloud sync, audit logs or feedback reports.

## Current pipeline facts to preserve during experiments

- The selected ASR is Vietnamese-finetuned PhoWhisper-tiny q8. Multilingual Whisper tiny q8 remains packaged as a load fallback; selecting Vietnamese during its decoding does not make it Vietnamese fine-tuned.
- Interim captions re-decode a bounded audio window; only one inference is active and a finalized utterance has priority. Measure the repeated decode cost instead of describing this as stateful streaming.
- Audio is downmixed and resampled to mono 16 kHz, then segmented by Silero VAD and the utterance builder. Compare browser PCM against a reference implementation before blaming the model.
- Face detection runs MediaPipe in `IMAGE` mode with two-face detection, followed by crop quality checks on 64×64 luminance and EmotiEffLib on a roll-aligned RGB 224×224 crop. Its ImageNet-normalized NCHW input and upstream class order are explicitly mapped to SignEmo's stable class order. Keep the two-person regression if evaluating `VIDEO` mode.
- The live TypeScript prediction gate uses elapsed-time EMA (150 ms), display dwell and separate haptic dwell. The Python research gate had diverged: fixed per-frame smoothing and a hard reset after a 1-second gap. It now uses the same time-constant EMA and preserves state across sparse samples; a 1 Hz/jitter regression was added. Run that test before relying on research replay results.
- Small or poorly aligned faces can be rejected before classification. Report detection coverage, quality rejection and classifier errors separately; “no result” is not a classifier prediction.

## Candidate register

| Branch | Candidate                           | What is known                                                                                                                                                                             | What must be verified locally                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ASR    | Moonshine Streaming Tiny Vietnamese | Official catalogue lists a 34M-parameter Vietnamese streaming model, MIT, with 9.4% WER/CER score on its stated 400-clip evaluation panel. This does not establish SignEmo performance.   | Pin the exact checkpoint/runtime versions; confirm the JavaScript/WASM adapter accepts PCM from SignEmo's existing capture instead of opening a second microphone; verify offline loading, streaming state, artifact plus runtime size, memory, RTF, Vietnamese dialect/noise WER and cancellation. |
| ASR    | PhoWhisper-tiny q8                  | Integrated as the PC test default from a pinned community Transformers.js ONNX conversion of VinAI PhoWhisper-tiny; model source declares WTFPL and upstream weights BSD-3-Clause.        | Confirm browser output parity and local Vietnamese WER/CER, partial re-decode cost, latency and memory on participant-separated data. The full model/tokenizer package is included in the 100 MiB incremental budget; no SignEmo quality gate has passed yet.                                       |
| ASR    | Gipformer 1.5 68M INT8              | Vietnamese-focused ONNX candidate, MIT per model card; reference implementation uses an offline recognizer.                                                                               | Pin all ONNX/tokenizer/runtime assets; prove browser/WASM execution and offline operation; verify total incremental package size; do not call it stateful streaming unless implemented and measured as such.                                                                                        |
| Face   | EmotiEffLib `enet_b0_8_best_afew`   | Bundled ONNX is 16,039,595 bytes, Apache-2.0, SHA-256 `7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f`. Graph/CPU smoke and adapter unit tests pass; upstream results are not SignEmo results. | Browser worker execution, CPU/WASM latency and Sad/Angry quality on participant-separated SignEmo data remain unverified. Comparing against FER+ requires restoring its pinned artifact in a research-only profile.                                                                               |

Primary references:

- Moonshine model catalogue and licenses: <https://moonshine-voice.readthedocs.io/en/latest/models/available-models/>
- Moonshine JavaScript/WASM package: <https://www.npmjs.com/package/@moonshine-ai/moonshine-wasm>
- PhoWhisper-tiny: <https://huggingface.co/vinai/PhoWhisper-tiny>
- Gipformer 1.5: <https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt>
- Gipformer reference implementation: <https://github.com/ggroup-ai-lab/gipformer/blob/main/infer_onnx.py>
- EmotiEffLib model and reported measurements: <https://github.com/sb-ai-lab/EmotiEffLib>
- ONNX Runtime Web performance diagnosis: <https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html>
- MediaPipe Face Landmarker modes: <https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js>

## Benchmark protocol

### Speech

1. Freeze the baseline commit, model manifest, decoding settings and browser/device details.
2. Use exactly the same mono 16 kHz PCM for each candidate. Include clear conversational Vietnamese, northern/central/southern speakers, quiet speech, fan/noise, clipping, names, numbers, negation, long utterances and pause-boundary cases.
3. Split by speaker/participant. Do not tune on held-out test. Keep human-checked reference transcripts; public datasets can validate mechanics but do not replace conversational SignEmo data.
4. Report WER, CER, deletion/repetition counts, time to first partial from speech onset, final-caption delay after speech end, RTF including all partial re-decodes, p50/p95 latency, peak memory, bundle size and queue depth. Separate clean and moderate-noise results.
5. Preserve the current 3-second/544-ms VAD baseline. Test 4-second windows and short overlap separately; promote only if boundary errors improve without violating latency.

Promotion requires at least a 10% relative WER reduction from the corrected baseline, no CER regression, WER ≤20% on clear speech and ≤35% on moderate noise, first partial p95 ≤1.5 seconds, final p95 ≤1.5 seconds after speech ends, effective RTF ≤0.6, peak memory no more than 10% above baseline, no growing queue and ≤100 MiB incremental package including runtime. Confirm once on held-out speakers. If evidence is insufficient or a gate fails, keep Whisper tiny.

### Face

1. Recheck source orientation, crop, grayscale/RGB contract, normalization, output-label ordering and Python/browser parity with deterministic asymmetric fixtures.
2. Evaluate front-facing and measured yaw/pitch/roll groups; face widths below/above 90 px and around 120 px; lighting, blur and occlusion. Keep detection, quality rejection and expression classification as separate outcomes.
3. Compare the prior FER+ reference and EmotiEffLib using the same participant-separated validation/test clips. Report per-class precision/recall, Sad/Angry macro-F1, coverage/abstention, false haptic cues per minute and capture-to-display p50/p95. Do not infer internal feeling or intent from a face label.
4. Test MediaPipe `VIDEO` only as a research profile. A second face entering, face loss, seeking and camera switching must remain correct before any promotion.

Promotion requires Sad and Angry precision ≥0.80, recall ≥0.65, macro-F1 no worse than baseline, coverage ≥60% inside the explicitly supported range and face-label p95 ≤700 ms. A model that emits more labels by increasing false cues does not pass.

## Runtime and bottleneck work

- Keep one active face inference and one active finalized ASR task. Drop stale face frames; do not silently discard finalized speech.
- Measure capture, resampling/VAD, ASR, face detect, crop, classifier, temporal gate and UI separately, plus end-to-end time. Put the source timestamp before capture so capture delay is included.
- Keep face sampling adaptive at 5/2/1 Hz and record when the device has degraded. Compare 640×480 with 720p crops only on the target PC; avoid larger capture if it slows the whole pipeline without improving coverage/quality.
- PhoBERT runs only on finalized text and only when the ASR queue has budget. It must not delay captions or the independent current-face label.
- Compare WASM and WebGPU on the complete concurrent pipeline. WASM multithreading requires cross-origin isolation; do not enable it globally without checking application integrations and offline behavior.
- Record only allowlisted technical events and aggregate timings in audit logs. Never include media, transcripts, landmarks, per-utterance labels or arbitrary exception strings.

## Status

The Python research gate is in line with the live TypeScript time-based EMA; the sparse-sampling/jitter regression passes as part of the current seven-test Python suite. Camera sampling now waits for `requestVideoFrameCallback` when available, with a timer fallback. Timing starts before `createImageBitmap`: `captureMs` measures frame capture, `processingMs` remains worker inference time, and `latencyMs` measures capture-to-result delivery. The 750 ms stale-result gate and camera session percentiles now use end-to-end latency instead of starting after bitmap capture.

### Moonshine browser artifact inspection — 13/10/2026

The official `@moonshine-ai/moonshine-wasm` 0.1.5 package is MIT and 13,734,259 bytes unpacked. Its README says the WASM embeds VAD, while speech models are downloaded from `download.moonshine.ai` by default. The API supports `Transcriber.loadFromUrls()` with canonical model files, so an offline prototype can self-host pinned files and feed SignEmo's existing PCM; it must use the lower-level transcriber rather than `MicTranscriber`, which owns microphone access. No Moonshine model weights are currently bundled, cached by SignEmo, or executed in the browser.

The official model catalogue lists Vietnamese Tiny Streaming at 34M parameters, MIT, with a 9.4% score on its stated 400-clip panel. This is publisher evaluation evidence, not SignEmo WER or a device latency result. A third-party five-graph ONNX export reports 12.54% int8 WER on a small 20–41 utterance FLEURS check and a separate Rust CPU RTF result; that is a feasibility clue only. Its exact Vietnamese artifact revision, selected quantized-file checksums, WASM execution path, package size including runtime, and output parity still need to be pinned and tested before it can enter the candidate benchmark. The default Whisper tiny profile remains unchanged.

Primary artifact references:

- Moonshine WASM package and its self-hosting instructions: <https://www.npmjs.com/package/@moonshine-ai/moonshine-wasm>
- Official Vietnamese streaming model catalogue: <https://moonshine-voice.readthedocs.io/en/latest/models/available-models/>
- Official Vietnamese model card: <https://huggingface.co/moonshine-ai/moonshine-streaming-tiny-vi>
- Research ONNX export and its limited regression data: <https://huggingface.co/Masterx/moonshine-streaming-tiny-vi-ONNX>

PhoWhisper-tiny is now tried first for PC testing, with Whisper tiny retained as load fallback. No ASR or face candidate has passed SignEmo's validation/held-out quality gates. Replacement as a validated production profile still requires suitable speaker-separated Vietnamese references and face clips with consent.

### PhoWhisper local smoke — 13/10/2026

The pinned PhoWhisper-tiny q8 conversion was loaded and transcribed with Transformers.js on ONNX Runtime Node CPU using five public FLEURS `vi_vn` validation clips. It produced WER 0.1533, CER 0.0944, and RTF 0.1983; Whisper tiny q8 on the same clips and Node CPU path produced WER 2.2667, CER 1.7108, and RTF 0.3915. Treat this only as a small read-speech smoke comparison: it does not exercise browser WASM, streaming microphone capture, spontaneous conversation, dialect/noise coverage, or emotion. It is not sufficient to pass the held-out promotion gate. The app currently tries PhoWhisper first and records the actual loaded profile; Whisper tiny remains the initialization fallback.
