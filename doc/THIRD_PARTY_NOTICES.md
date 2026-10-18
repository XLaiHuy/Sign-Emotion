# Model and runtime provenance

Exact artifacts, source URLs, versions, bytes and SHA-256 values are recorded in `public/models/manifest.json`. Model binary hashes are pinned in `scripts/prepare-assets.mjs`. Dependency versions and integrity are pinned in `package-lock.json`; Edge Function dependencies have a separate `supabase/functions/deno.lock`.

- EmotiEffLib `enet_b0_8_best_afew.onnx`: Apache-2.0, exact source revision `c018fcf96c79c3bd9184f1c9438fe2095c9f1943`; license text is retained at [`public/licenses/emotiefflib-Apache-2.0.txt`](../public/licenses/emotiefflib-Apache-2.0.txt). The ONNX artifact SHA-256 is `7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f`. It replaces FER+ as the packaged face classifier; the old FERPlus license text is retained for historical provenance. Model licensing is not participant consent or a grant to collect new facial data.
- MediaPipe Tasks Vision 1.1.0 and Face Landmarker task v1: [Apache-2.0 license text](../public/licenses/mediapipe-Apache-2.0.txt), [upstream repository](https://github.com/google-ai-edge/mediapipe). The generated `.mjs` loader adds an ESM export and changes the debug function declaration to a function-scoped variable for strict-module compatibility. Original `.js` files are preserved; both originals and generated copies have checksums in the manifest.
- ONNX Runtime Web 1.30.0: [MIT license text](../public/licenses/onnxruntime-MIT.txt), [upstream repository](https://github.com/microsoft/onnxruntime). Runtime binaries are copied without modification.

Other npm packages retain their licenses in their package distributions. Review dependencies and notices when changing artifacts or preparing a public release. No research data or participant image is bundled with the application. The astronaut fixture is downloaded only by browser QA from scikit-image's repository; it is not a production asset or a validation dataset.

## Conversation and typography

Exact revisions and SHA-256 values: `scripts/conversation-assets.lock.json`. Prepared runtime hashes: `public/models/conversation-manifest.json`.

- Whisper tiny/base: OpenAI MIT; retained at `public/licenses/whisper-MIT.txt`. ONNX conversions by onnx-community, revisions pinned.
- Silero VAD: MIT; `public/licenses/silero-vad-MIT.txt`, pinned commit.
- PhoBERT emotion social: the retained `public/licenses/phobert-model-card.md` declares MIT. Preserve upstream attribution. Social-media training does not establish conversation validity or authorize new data collection.
- Speech Emotion Classification: retained upstream card `public/licenses/speech-emotion-model-card.md` declares Apache-2.0, license text `public/licenses/transformers-js-Apache-2.0.txt`. Upstream prithivMLmods, conversion onnx-community. English training does not validate Vietnamese emotion.
- Transformers.js 3.8.1: Apache-2.0 (`public/licenses/transformers-js-Apache-2.0.txt`). Its matching ORT binary is MIT, separate from the face runtime.
- Moonshine Streaming Tiny Vietnamese: model assets from `moonshine-ai/moonshine` revision pinned in `scripts/moonshine-streaming-vi.lock.json` (model revision `quantized_26_08_24`), MIT; retained license at [`public/licenses/moonshine-MIT.txt`](../public/licenses/moonshine-MIT.txt). Runtime `@moonshine-ai/moonshine-wasm@0.1.5`, MIT, pinned in `package-lock.json`; its ESM/WASM files are verified against the same lock file. This is an optional local research profile, not the default ASR. Upstream model metadata is not a SignEmo benchmark.
- Be Vietnam Pro: SIL Open Font License (`public/licenses/be-vietnam-pro-OFL.txt`), self-hosted via pinned Fontsource package.
- QA only: Google/FLEURS contributors, [FLEURS vi_vn](https://huggingface.co/datasets/google/fleurs), CC BY 4.0. IDs/digests in ignored output/evaluation. Audio is not bundled in production.
