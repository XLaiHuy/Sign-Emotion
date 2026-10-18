---
name: signemo-multimodal-evaluation
description: Evaluate or calibrate SignEmo face, transcript and voice evidence, time alignment and conservative emotion fusion.
---

Read `doc/SPEECH_AI.md` and `src/domain/conversation.ts`. Align face evidence to the captured utterance interval, not the ASR completion time. Voice and text are correlated; never multiply their softmax outputs as independent probabilities. Retain unsupported mass; Other, Calm, fear and disgust are not automatically neutral/sad.

Default fusion needs at least two distinct usable agreeing modalities; credible conflict abstains. Initial equal weights and thresholds are hypotheses, not calibrated confidence. Keep experiment flags and model/config versions visible. Revisions of the same utterance cannot emit another rhythm. Skip stale cues rather than suggesting they describe the current speaker.

Tune on validation only; split by participant/session before tuning. Compare single branches and fusion on aligned labeled audio/video. Report per-class precision/recall, macro-F1, coverage, false cues/minute and latency. Public read-speech ASR data cannot validate emotional tone or three-way fusion. Synthetic data checks mechanics only.

Respect dataset licenses and independent research consent/expiry. Do not upload research clips or send transcripts/feature traces in PilotReport. After two unsuccessful model improvement rounds revisit data or scope rather than manufacture certainty.
