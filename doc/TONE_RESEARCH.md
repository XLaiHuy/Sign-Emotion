# Tone local: Emotion2vec và WebGPU — 14/10/2026

## Kết luận hiện tại

Đã có model tone pretrained thật và adapter/probe local, không còn chỉ có checkpoint synthetic. Tuy nhiên **chưa bật tone trong hội thoại hoặc vote fusion**: INT8 không qua parity đầy đủ và quá chậm; FP32/WebGPU đã chạy được/khớp reference trên một PCM public, còn cần đo cold/warm và toàn pipeline. Không gọi model này là đã tối ưu hoặc kiểm chứng cảm xúc tiếng Việt. Chưa thay link 8080.

## Trọng số và runtime

- Backbone Emotion2vec+ base và linear head công bố, 9 nhãn: angry/disgusted/fearful/happy/neutral/other/sad/surprised/unknown. Other/unknown giữ unsupported mass, không gộp vào Trung tính.
- Export nguồn [pankotaro](https://huggingface.co/pankotaro/emotion2vec-plus-base-onnx/tree/334d4376993c381f059cc36d2c6ed05cbfec5ca1), upstream [Emotion2vec](https://huggingface.co/emotion2vec/emotion2vec_plus_base). License FunASR Model Open Source License 1.1, giữ attribution/model name; không gọi là MIT theo exporter khác.
- Original ONNX: 373.159.295 byte, SHA `a9ddcc2f4254c3da1dc2a51ea5e38df32e2a84724519e343499f05f0ea2b3506`.
- Ghép mean-pool + head, không train: FP32 373.187.428 byte (~355,90 MiB), SHA `0a69fa36b526befc0ab928ccee68b0386c9fa9fdb4fa7973cac53d0ae0fc7389`.
- INT8 reduced range: 117.827.333 byte (~112,37 MiB), SHA `60b12fff5e5bb6312747f5df4c8912eed051a9c19e8be6793981eecd1c25ac88`; quantizer ONNX Runtime Python 1.22.1, MatMul/Gemm per-channel/reduce_range. [ORT về bão hòa và reduce-range](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html).
- Browser ORT 1.30.0. GPU cần đúng cặp Asyncify của package này; không tráo cặp JSEP của speech runtime. Probe nghiên cứu có policy riêng cho embind, app/capture/model worker thường giữ policy strict.

Weights/runtime nằm dưới `output/research-assets/`, không tự đưa vào image/cache sản phẩm. Tải/capture/suy luận đều local. Probe cache INT8 chỉ chứa binary model đã hash, không có PCM/transcript. GPU large file chỉ fetch sau thao tác explicit probe, chưa cache/promote. Audit chỉ có thao tác/profiling/failure-code, không có audio/score từng đoạn.

## Phép thử đã thực hiện

PCM từ google/fleurs tiếng Việt, CC-BY-4.0, clip public đã có trong repo. Dùng đúng cùng float32 buffer cho Python/browser, windows 0,8/1,6/3 giây từ cùng clip. Không có nhãn cảm xúc; đây chỉ là numeric parity và tốc độ.

| Profile | Thời gian browser | Parity |
| --- | ---: | --- |
| INT8 v1/WASM | 4.268 ms | Không đạt đầy đủ |
| INT8 reduced v2/WASM | 4.328 ms | Max sai khác score 0,074 / ~2,8e-8 / 0,012 trên ba windows; không đạt đầy đủ |
| FP32/WebGPU, lượt đầu từng độ dài | 4.919 / 2.581 / 1.106 ms | Max sai khác score 1,76e-6 / 3,51e-11 / 3,72e-5; qua mốc kỹ thuật 1e-3 trên clip này |

Không coi 1.106 ms là p95; không loại lượt shader lạnh để gọi đây là realtime đã đạt. Reference Python FP32 một luồng tương ứng khoảng 189/346/648 ms. GPU dùng được sau khi tách map score/metadata khỏi import runtime và bổ sung đúng Asyncify; không kết luận một lỗi duy nhất trước đó là toàn bộ nguyên nhân.

Image cuối `signemo:tone-lab-20261014`, build `demo-20261014-tone-gpu-lab-v1`, container localhost:8084 healthy, healthz 200, nginx syntax qua. Lượt không có Docker build nền: chuẩn bị 8.802 ms; cold 0,8/1,6/3 giây lần lượt 3.344/2.431/1.115 ms. Năm lượt cùng cửa sổ 3 giây sau warm: 1.090/1.100/1.092/1.062/1.062 ms; hai độ dài mới 0,896/1,760 giây: 279/570 ms. Chỉ một clip và vài lượt; không là p95 toàn pipeline. SDK ghi hai warning node assignment qua stderr (Chrome gắn mức error): một số node chạy CPU. Vì vậy đây là execution provider WebGPU có CPU fallback, không khẳng định toàn graph thuần GPU. 150 tests/41 files, check/lint/TypeScript/checksum/build và format-check qua.

Báo cáo local: `output/research-evaluation/tone-browser-smoke.json`, `tone-public-browser-smoke.json`, `tone-gpu-browser-smoke.json`. Chưa có WER/F1/validation tone, Android hoặc 30 phút toàn pipeline.

## Chạy lại

Các file original ONNX/head/license cần được tải từ revision nguồn đã pin ở trên; script kiểm hash trước xử lý.

```powershell
.venv/Scripts/python.exe scripts/prepare-emotion2vec-tone.py
.venv/Scripts/python.exe scripts/check-emotion2vec-tone.py --public-speech
.venv/Scripts/python.exe scripts/check-emotion2vec-tone.py --public-speech --fp32
```

Browser lab tại localhost:8084, Phòng kiểm thử → Model nghiên cứu → nút kiểm tra tone. Container cần mount `output/research-assets` read-only vào `/usr/share/nginx/html/research`; ordinary product không có mount này. Runtime GPU copy đúng `node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.{mjs,wasm}` vào `output/research-assets/runtime-ort-gpu`. Không mở thêm microphone, không upload clip.

## Điều kiện còn thiếu

Cold/warm và hai độ dài thay đổi đã có smoke; còn numeric parity trên nhiều PCM tự nhiên, dữ liệu tone tiếng Việt có nhãn và chia người nói, bộ nhớ đỉnh/frame/ASR khi chạy đồng thời, optional-branch failure/lifecycle thực tế. Tone vẫn là **probe kỹ thuật trong lab**, chưa nối micro/video vào voice evidence hoặc fusion của hội thoại. Không coi nút kiểm tra model là đã bật tính năng tone realtime. Hai nhánh sản phẩm vẫn mặt/text.
