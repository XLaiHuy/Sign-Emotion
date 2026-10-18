# Thử B0/WebGPU + Moonshine tiếng Việt — 17/10/2026

## Cách mở bản thử local

`docker compose -p signemo-moonshine -f compose.moonshine-local.yaml up -d --build`

Mở **http://127.0.0.1:8093/?moonshine=1** trên Chrome PC. Build `local-moonshine-b0-20261017-v31`, image `signemo:moonshine-b0-20261017-v31`, digest `sha256:671a3f5e94c7ac28999cfe7225a9850f2b4d9a0a50e1478a24ba496a3bf6e8ea`. Container chỉ bind localhost; fixture NASA/FLEURS chỉ được mount ở container này. Không đổi container public 8080 hoặc tunnel. Các image thăm dò trước được giữ để đối chiếu.

Profile build vẫn `pc-candidate`, thêm `VITE_STREAMING_ASR=moonshine` để chọn ASR thử; không đổi mặc định baseline hay candidate Gipformer. Trong bản thử, chỉ Moonshine và B0 được chuẩn bị cho ASR/mặt; không nạp Gipformer/PhoWhisper cùng lúc. PhoBERT vẫn là nhánh tùy chọn sau lõi. Tone chưa bật trong lượt đo ban đầu.

## Lỗi tương thích được tái hiện và sửa

Binary WASM của npm SDK 0.1.5 đã ghim trước đây từ chối `frontend.model.ort`: loader chỉ nhận frontend gộp. Binary trong **release GitHub v0.1.5** nhận đúng hai graph frontend tiếng Việt. Giữ SDK npm 0.1.5, thay runtime bằng gói chính thức đã kiểm SHA; không sửa node_modules, không tự ghép graph/preprocessing.

- Archive: [moonshine-voice-wasm.tar.gz v0.1.5](https://github.com/moonshine-ai/moonshine/releases/download/v0.1.5/moonshine-voice-wasm.tar.gz), 6.558.286 bytes, SHA-256 `c515bf7691e12048f70a92cc82b3b0894c16c3773ffcacb7d48944fb150e4837`.
- MJS: 156.477 bytes, SHA-256 `5290b40b974a1ae2dec94ab8b212aef98350a64856726c7bb03de266963915a4`.
- WASM: 13.189.013 bytes, SHA-256 `22fca4a5b2dc50fe36dc68e4d25fab73b0250b71f744d9fea511c3a308b2420a`.
- Model giữ revision `quantized_26_08_24`, MIT; model/runtime khoảng 43,5 MiB, không phải RAM. SDK JS đã bundle là chi phí nhỏ bổ sung ngoài hai runtime file.

`scripts/moonshine-streaming-vi.lock.json` là nguồn pin chung cho script chuẩn bị và adapter browser. Script chỉ đọc hai member tên cố định từ archive sau khi kiểm digest, không giải nén đường dẫn tùy ý. Docker chỉ chuẩn bị Moonshine khi chọn rõ profile thử. Runtime/model phục vụ cùng origin; không có CDN inference.

## Thuật toán thay đổi

1. VAD gửi partial 8192 mẫu/512 ms riêng cho Moonshine; Gipformer giữ 12800 mẫu/800 ms. Partial sớm cần ít nhất 16 frame lời nói; giữ PCM/pre-roll/final và chính sách chốt hiện tại. Không cắt thêm âm cuối để giảm latency.
2. Adapter giữ stream trong mỗi đoạn VAD, nạp **phần PCM mới** dựa trên số mẫu đã nạp. Partial còn chờ chỉ giữ bản mới nhất; snapshot tích lũy/final chứa đủ audio để bù phần chưa nạp, không mất lời khi bỏ yêu cầu partial. Cửa sổ lùi bị từ chối.
3. Final gọi `stream.stop()` để flush lookahead và hoàn tất dòng; đọc snapshot không force lần hai để tránh decode trùng. Warm-up trước quyền thiết bị; tín hiệu tổng hợp bị bỏ, không thành caption/vote/history.
4. Khi chưa có token ở partial, tiếp tục nghe; không chớp “Chưa nghe rõ” hoặc xóa partial cùng đoạn. Final lỗi/đầu ra lặp vẫn theo guard cũ. ID/revision và quyền sửa câu final giữ nguyên.
5. Một ASR inference, tối đa ba final chờ và một partial mới nhất, final ưu tiên lượt tiếp theo. Mặt độc lập, một frame đang chạy và lấy frame mới. Không giảm threshold mặt/fusion hoặc coi điểm model là xác suất cảm xúc thật.
6. Cache runtime riêng có checksum; Service Worker giữ policy cho worker/module khi offline. Chỉ URL local `?moonshine=1` thêm COEP ở document; trang thường không bật COEP toàn site. Không mở CSP eval toàn ứng dụng.
7. Worker Moonshine sở hữu cả pthread con. Dispose đóng stream/transcriber và worker con, xác nhận trước khi parent bị terminate; parent có fallback hữu hạn 5 giây. v31 thêm `self.close()` sau xác nhận ở event loop worker. Track/audio dừng ngay. CDP có thể còn hiển thị target sau `terminate()`; báo cáo phải đo đến khi target biến mất, không chỉ đếm wrapper trên Window.

Đây vẫn là **streaming trong đoạn VAD hữu hạn**, chưa thay toàn bộ session thành một stream audio không giới hạn: hard-cut khoảng 3 giây còn reset state giữa các đoạn. Partial 512 ms là lịch yêu cầu, không cam kết chữ xuất hiện trong 512 ms; native engine có lịch/backpressure riêng.

## Kiểm tra và giới hạn

`npm run check` source v31 qua **241 tests/64 files**, lint/boundaries 105 modules, TypeScript, checksum 13 face +25 conversation, build; `npm run format:check` qua. Lượt v29 chạy check cùng lúc Docker build có một test GPU retry timeout 5 giây; chạy riêng test 7/7 và chạy lại full 237/237 đều qua, không tăng timeout để che lỗi. Build có cảnh báo externalize Node module của SDK; browser thật là kiểm tra quyết định tương thích.

Đã nạp model thật bằng Node và Chrome. v29 warm-up bắt được lỗi CSP ở pthread: runtime chính thức dùng embind `new Function`. Nginx chỉ cho `unsafe-eval` trên route runtime MJS và worker Moonshine; CSP document giữ nguyên. Lượt lỗi `moonshine-v29-csp-failure.json` không được tính là benchmark hoàn tất.

### Smoke tải 120 giây v30

Artifact `output/research-evaluation/moonshine-b0-v30-120s.json`: Chrome 155, Windows, 8 logical processors, browser báo deviceMemory 16, crossOriginIsolated=true. NASA face pan và FLEURS loop là hai nguồn khác người, chỉ dùng tải cơ chế; không đánh giá fusion chính xác.

| Chỉ số | Kết quả |
| --- | --- |
| Face capture → delivery p50/p95 | 158,47 / 411,92 ms |
| Detection p95 / classifier p95 | 258,58 / 143,41 ms |
| Frame mặt quan sát | 146; khoảng 1,22 Hz, **chưa giữ 5 Hz** |
| First-partial delivery p50/p95 | 757,69 / 1.379,58 ms |
| Final delivery p50/p95 | 112,32 / 1.100,52 ms |
| ASR RTF hiệu dụng cuối, gồm partial | 0,252 |
| POST/non-GET, external request, worker/page error | 0 |

Capture→delivery chưa tính đủ dwell nhãn. Final tính từ cuối buffer VAD gồm silence, không phải âm vị cuối được gán nhãn. Audio fixture chạy khoảng 90 giây media trong 120 giây wall, mapped clock drift khoảng 30 giây; do đó các latency trên **chưa nghiệm thu mục tiêu micro thật**. Heap lớn nhất 8,13 MiB chỉ của main renderer, không bao gồm worker/WASM/VRAM. Lượt này không qua gate worker target: Window workers/tracks/application contexts về 0 nhưng CDP còn 7 targets ở lần chụp sau 1 giây. Giữ nguyên báo cáo thất bại; không coi đây là đã giải phóng tất cả.

Đo ASR riêng sau đó với dispose ack đúng loại và chờ 6 giây: CDP không còn worker target (`moonshine-public-evaluation.json`). Harness tải được bổ sung ghi chuỗi số target tối đa 6 giây, vẫn yêu cầu về 0; lượt tải kiểm lại được lưu riêng, không sửa số liệu cũ.

Lượt 30 giây tiếp theo trên v30 xác định pthread con về 0 nhưng parent `/assets/speech-moonshine.worker-BdyLbbBm.js` còn lại sau 6 giây; không gọi đây là teardown đạt. v31 bổ sung tự đóng parent, kiểm thử thứ tự child cleanup → ack → self.close. Probe offline v30 khởi tạo lại được Moonshine/VAD/B0 thật, không mở thiết bị; text chưa cache đủ ở lượt đó nên chưa tính offline toàn bộ nhánh tùy chọn. Script offline bổ sung đợi text chuẩn bị xong trước khi rời trang.

### Kiểm lại v31 — cơ chế qua, realtime chưa nghiệm thu

`output/research-evaluation/moonshine-b0-v31-120s.json`: chạy đủ 120,04 giây, mechanicalChecksPassed=true. Sau Finish, Window worker/track/application AudioContext =0; CDP ghi 7→0 target sau 1,19 giây từ lần chụp đầu (lần đầu chụp sau khoảng nghỉ 1 giây). Không dựa vào pagehide để che tài nguyên còn sống. Không lỗi page/worker, không non-GET/external request hay tải Whisper không dùng.

- 182 frame/120 giây, khoảng **1,52 Hz**; face delivery p50/p95 **150,74/352,59 ms**, detection p95 166,39 ms, classifier p95 105,45 ms. Chưa giữ 5 Hz và chưa đo latency chuyển nhãn gồm dwell.
- First-partial delivery p95 **1.140,74 ms**, final-delivery p95 **706,93 ms**; RTF ASR hiệu dụng cuối **0,186** gồm partial. Fusion p95 990,95 ms chỉ đo thời gian, không có nhãn fusion đủ điều kiện trên fixture khác người.
- Clock fixture vẫn lệch media/wall khoảng **30,89 giây**; raw origin/gap gần 0, output-pair skew tối đa khoảng 53,28 ms. Các latency không được dùng nghiệm thu micro thật. Main-renderer heap tối đa khoảng **7,82 MiB**, không đại diện tổng RAM/VRAM hay chứng minh không rò rỉ.

Chưa chạy 30 phút trên v31. Chưa chứng minh cải thiện chất lượng nhận diện người hoặc đạt mục tiêu PC/Android. Kết quả v30 lỗi và lượt harness incomplete giữ riêng để đối chiếu.

`scripts/browser-moonshine-offline.js` trên v31: rời trang, tắt mạng rồi mở trang mới; Service Worker kiểm soát, isolation giữ nguyên; worker Moonshine/VAD/B0 thật đều ready, lỗi worker=0, captureCalls=0. Đã đợi tùy chọn text khả dụng trước khi rời trang; điều này xác nhận asset text, **chưa chạy inference PhoBERT offline** (worker text chỉ mở khi bắt đầu phiên). `moonshine-offline.json` scope ban đầu ghi “including optional text”; phải đọc trong giới hạn asset trên, không suy thành đã khởi tạo worker text. Screenshot `output/playwright/moonshine-offline.png`. Không xóa kho/cài đặt hoặc cache người dùng.

### Năm clip public, ASR riêng

`scripts/browser-moonshine-evaluation.js` dùng đúng 5 FLEURS ID 1594/1573/1628/1578/1564, CC-BY-4.0, cùng PCM local. Giải mã incremental mỗi 8192 mẫu trong cả clip, không VAD/hard-cut, không realtime pacing và không mặt/text. Báo cáo chỉ chứa số đếm/lỗi, không transcript.

- 18 lỗi /150 từ: **WER 12%**. CER 35/643 =5,44%, ở đây có khoảng trắng; không so trực tiếp CER cũ loại khoảng trắng.
- RTF gồm partial ~0,150. Chữ đầu xuất hiện sau 1,024–2,560 giây **audio đã nạp**, chưa cộng đầy đủ wall latency; chưa đạt mục tiêu ≤1,5 giây ở mọi clip.
- Báo cáo Gipformer cũ trên cùng 5 clip ghi WER 6% (`asr-summary.json`), nhưng là full-clip decode khác protocol. Moonshine chưa chứng minh thắng về chất lượng; không chọn mặc định từ mẫu nhỏ này.

Probe single-thread nghiên cứu dùng bản MJS dẫn xuất ngoài sản phẩm để truyền biến môi trường được upstream hỗ trợ: cùng một file, RTF 0,170 so với 0,138 của runtime gốc khi chạy riêng. Hash final text giống nhau. Chưa áp dụng bản vá đó; phép thử riêng không quyết định cấu hình toàn pipeline. Cần đo thêm giới hạn thread khi chạy cùng detection trước khi chọn, vì Moonshine đang dùng nhiều CPU thread.

**Chưa đổi model mặc định/public.** Phép thử fixture không nghiệm thu micro thật, Angry/Fear/Disgust, Android, bộ nhớ toàn trình duyệt hoặc 30 phút. Tone chưa bật/không nằm trong mount bản thử. Ưu tiên tiếp theo là giữ cadence mặt, kiểm tra clock/micro thật và so hai ASR trên cùng protocol; không giảm threshold hoặc bật tone nặng để che kết quả chưa đạt.
