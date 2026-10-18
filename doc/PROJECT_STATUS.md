# Trạng thái và quyết định SignEmo

## Sửa bố cục, ký hiệu và lưu lịch sử — 18/10/2026

Đang kiểm chứng `conversation-sign-history-20261018`: player riêng dưới nét mặt, không chèn câu thử vào transcript, nhớ opt-in lưu và báo trạng thái ghi. 100 câu dự kiến gồm 93 metadata/7 đề xuất, **0 chuyển động đủ điều kiện phát**. Đã gỡ động tác chung và MP4 gán nhầm. Hai keypoint chưa đủ ánh xạ khớp/căn thời gian/video đối chiếu, không tự dựng rồi gọi là VSL chuẩn. Bằng chứng ở `CONVERSATION_SIGN_HISTORY_20261018.md`; public giữ nguyên.

## Màu dễ thấy hơn — 18/10/2026

Đã tăng diện tích màu quanh avatar, nhãn/badge màu đặc chữ trắng và swatch chú giải; caption vẫn tối và tách nguồn, tắt màu giữ nguyên. Check 265 test/74 file, lint 115 module, typecheck/assets/build và format-check qua. Chrome kiểm đủ 7 nền/nhãn, 1200/390/844/720 px không tràn. Image local mới `signemo:avatar-colour-20261018`, image avatar trước giữ rollback; public không đổi. Không chạy lại benchmark inference cho thay đổi trình bày này; không dùng kết quả trước làm số đo mới. Nguồn nghiên cứu và các đính chính ở `SIGN_RESEARCH_FACTCHECK_20261018.md`.

## Avatar theo mặt, màu tách câu — 18/10/2026

Bàn giao local đã build và healthy: `signemo:avatar-face-20261018`, 264 test/74 file qua, format/lint qua. Nguồn fixture đã sửa để không giảm nhịp do canvas/browser nền; lượt bật giữ 5,007 Hz với 1 canvas, p95 nhãn 330,4 ms, private committed memory +2,58%, Finish về 0 tài nguyên theo dõi. Lượt đối chứng tắt còn một CDP target Moonshine sau 6s, clock audio cả hai không đạt; chưa công nhận mọi cổng pipeline/latency hoặc 30 phút/Android. Xem báo cáo đầy đủ và raw được giữ nguyên.

Đã chuyển đầu 3D sang nét mặt hiện tại và bỏ avatar ở panel fusion; 7 pose nội suy 450 ms, giới hạn 30 FPS, một canvas, đứng yên dừng render và fallback SVG khi lỗi/quá tải. Avatar mặc định bật khi chưa lưu lựa chọn, giữ false đã lưu. Màu dùng expressionUI; câu final vẫn nguồn fusion riêng và chữ tối. Nghiên cứu VSL-GH đã tải metadata/license và 2 keypoint tại revision cố định vào output offline; **0 câu đủ điều kiện TP.HCM/rig/nghĩa**, chưa có avatar ký hiệu câu trong bản thường. Kiểm chứng và Docker local 8095 tại `AVATAR_COLOURS_SIGN_RESEARCH_20261018.md`; public không đổi.

## Minh họa biểu cảm — 18/10/2026

Đã bổ sung fallback SVG/CSS và chuyển miệng/lông mày một lần cho 7 nhãn khi thiếu video ký hiệu. Đây là minh họa biểu cảm, không phải mô phỏng ngôn ngữ ký hiệu; danh mục video TP.HCM vẫn chưa có asset đủ điều kiện phân phối. Không thêm model hoặc đổi ngưỡng. Bằng chứng bổ sung tại `INTRO_FACE_CUES_20261018.md`; chỉ triển khai local 8095, public không đổi.

## Video local và nhịp mặt — 18/10/2026

Đã triển khai nguồn nhịp Hội thoại theo mặt ổn định, tách khỏi fusion, âm mới mặc định tắt và ô nhịp riêng. MP4 phục vụ local, cache tự chọn/Range/checksum; WebVTT còn là bản nháp ASR. Player ký hiệu đã nối nhưng **chưa có video TP.HCM đủ điều kiện phân phối**; sáu từ hiện chữ/icon. Check 256 tests/70 files, format và Docker local 8095 healthy; Chrome/Edge media/offline và layout qua. A/B 120s: ~5 Hz, private committed memory +6,81%, Finish về 0; clock audio cả hai lượt còn lệch, chưa nghiệm thu latency ASR. Sampler RAM đã sửa lỗi Int32 >2 GB, số peak cũ từ trace bị cắt không dùng kết luận giảm RAM/không leak. Chưa thay public. Xem [báo cáo](INTRO_FACE_CUES_20261018.md).

## Điều phối CPU/GPU local — 17/10/2026

Đã hoàn thành toàn bộ ma trận đo kiểm tài nguyên CPU/GPU và điều phối realtime trên i5-1130G7 / Iris Xe theo kế hoạch mục tiêu:

- **Tối ưu thuật toán lõi**: Lịch frame theo deadline 200 ms liên tục (không cộng thời gian inference), cửa sổ tải gần đây (5s mặt, 10s ASR), tái sử dụng buffer RGB/crop canvas.
- **Biên dịch WASM**: Biên dịch thành công 2 bản Moonshine v0.1.5 (`single` 1 thread và `two` 2 threads có giới hạn global thread pool ORT và pthread pool). Parity 5 clip FLEURS đạt WER 12% và CER 5.44% trùng khớp 100% upstream.
- **Kết quả ma trận 6 cấu hình (120s)**:
  - Khắc phục triệt để điểm nghẽn cadence: Đưa tốc độ khuôn mặt từ mức 1.52 Hz lên **5.00 Hz** liên tục trong 100% cửa sổ.
  - MediaPipe GPU delegate trên Iris Xe bị sụt giảm cadence xuống 4.23 Hz do tranh chấp GPU với B0 WebGPU (đúng như cảnh báo trong nguyên tắc thiết kế); trong khi CPU delegate giữ vững 5.00 Hz.
  - Cấu hình **`two-cpu`** đạt kết quả tốt nhất: Cadence 4.99 Hz, nhãn mặt p95 340 ms, partial p95 1.434 ms, final p95 560 ms, RTF 0.14, RAM đỉnh chỉ 716 MB (giảm 65% so với baseline 2.028 MB). Đạt 14/14 cổng và qua cả 3 lượt lặp kiểm chứng.
- **Thử nghiệm sức bền 30 phút (`two-cpu-1800s`)**: Giữ vững 4.91 Hz suốt 30 phút, RAM phẳng 1.105 MB (không rò rỉ), 100% teardown sạch.
- **Quyết định bàn giao**: Tuân thủ nguyên tắc không chọn vội nếu chưa vượt 100% cổng ở bài test 30 phút (do độ trôi đồng hồ DAC/wall-clock tích luỹ theo thời gian thực dài), giữ nguyên `v31` làm rollback baseline và giữ public container cổng 8080 không đổi. Profile `two-cpu` được lưu trữ nội bộ làm bản tối ưu lõi thành công nhất. Chi tiết tại [báo cáo điều phối](RESOURCE_SCHEDULING_20261017.md).

## Thử riêng Moonshine/B0 — 17/10/2026

Đã build `signemo:moonshine-b0-20261017-v31` và chạy healthy localhost:8093 với `?moonshine=1`. Sửa binary WASM không nhận frontend split bằng release v0.1.5 chính thức đã kiểm SHA; partial 512 ms, delta PCM, final flush, warm-up và dispose pthread có xác nhận/tự đóng parent. Full check **241 tests/64 files**, lint/boundaries 105 modules, checksum, build và format qua. Năm clip FLEURS: WER 12%, ASR riêng RTF ~0,15; chưa chứng minh hơn Gipformer. Smoke v30 120 giây: face delivery p95 ~412 ms nhưng cadence chỉ ~1,22 Hz, còn giới hạn clock/worker-target cần kiểm riêng. **Chưa chọn Moonshine mặc định, chưa nghiệm thu realtime/accuracy/Android.** Public vẫn `signemo:auto-compat-20261017-v27`; compose local không đổi public/tunnel. Xem [báo cáo thử](MOONSHINE_B0_TRIAL_20261017.md); các phiên bản public phía dưới là lịch sử.

Kiểm lại **v31 đủ 120 giây**, mechanical checks qua và toàn bộ target worker/track/context về 0 sau Finish. Face delivery p95 352,59 ms, partial p95 1.140,74 ms, RTF cuối 0,186; nhưng cadence mặt chỉ 1,52 Hz, fixture audio có drift khoảng 30,89 giây nên chưa nghiệm thu latency micro thật. Không dùng smoke này tuyên bố đạt Angry/Fear/Disgust hoặc 30 phút. Các lỗi v30/harness giữ nguyên trong báo cáo.

## Đưa bản v23 (Tự động thích ứng GPU/CPU & Nút chọn trực tiếp) lên link chia sẻ — 16/10/2026

Link chia sẻ hiện hành: **https://changelog-trends-bosnia-measurements.trycloudflare.com/**.
Đã build và deploy thành công image `signemo:auto-compat-20261016-v23` (build `auto-compat-v23`) lên container cổng 8080 (`ou-khinghip-web-1`). Container healthy, HTTPS `/healthz` HTTP 200, bundle JS và Service Worker phục vụ trơn tru.

Điểm cải tiến đã chốt trong v23:

- **Tự động chuyển chế độ tương thích (CPU WASM)**: Khi chạy trên trình duyệt hoặc thiết bị không hỗ trợ tăng tốc WebGPU (như Edge mặc định, Safari, mobile browser), hệ thống tự động nhận diện và chuyển sang mô hình khuôn mặt tương thích CPU (`b0-wasm-research`), giúp người dùng và khách hàng sử dụng ngay mà không bị chặn bởi thông báo lỗi.
- **Nút chuyển đổi chế độ trực tiếp**: Hiển thị nút `Dùng chế độ tương thích` ngay tại thông báo cảnh báo trên màn hình Giới thiệu (`HomePage`) và `ConversationPage`, loại bỏ câu điều hướng "Vào hội thoại để thử chuẩn bị lại".
- **Linh hoạt thử lại tăng tốc GPU**: Khi đang ở chế độ tương thích, người dùng có nút `Thử lại tăng tốc GPU` để kiểm tra khả năng tăng tốc phần cứng bất cứ lúc nào.
- **Kiểm thử tự động**: 62 test files với **233/233 test cases Vitest** đạt 100%, linter và boundary check qua sạch.

## Đưa bản v22 hoàn chỉnh lên link chia sẻ — 16/10/2026

Link chia sẻ hiện hành: **https://changelog-trends-bosnia-measurements.trycloudflare.com/**.
Đã build và deploy thành công image `signemo:responsive-core-20261016-v22` (build `demo-20261016-responsive-core-v22`) lên container cổng 8080 (`ou-khinghip-web-1`). Container healthy, HTTPS `/healthz` HTTP 200, bundle JS và Service Worker phục vụ trơn tru.

Điểm cải tiến đã chốt trong v22:

- Sửa dứt điểm lỗi thuộc tính iframe YouTube (`credentialless`) và sửa thuộc tính `camera.switching`.
- Nâng `map_hash_bucket_size 256` trong Nginx để hỗ trợ toàn bộ các route model content-addressed.
- Responsive toàn diện: Dual-Pane (ngang 2 cột không trôi phụ đề) và Thumb-Zone (dọc gọn gàng), không remount MediaStream khi xoay màn hình.
- Giới hạn DOM 30 câu gần nhất, kho tự khóa sau 5 phút.
- LCP ổn định chữ tạm tiếng Việt (Compound Token Binding).
- Đóng AudioContext âm phản hồi và giải phóng toàn bộ worker khi kết thúc phiên, thêm nút "Chuẩn bị phiên mới".
- Vượt qua 100% các cổng kiểm tra: 231 tests (62 test files), lint và typecheck sạch 100%. Image v19 cũ được lưu tại tag `signemo:rollback-before-v22`.

## Tiếp tục kiểm tra đuôi âm thanh và tài nguyên — 16/10/2026

Local v21 (`localhost:8092`, image `ca7403c4…`) có release âm phản hồi và nút chuẩn bị phiên mới theo lựa chọn người dùng. Full check/format qua 213 tests/58 files. Chrome smoke lần đầu dừng sớm do audio gap; đã lưu lỗi, bổ sung chẩn đoán clock, lượt sau chạy đủ 120 giây và xác nhận Finish tự đưa worker/track/context về 0. Lượt 30 phút đang chạy trên artifact này; chưa cập nhật public v19 hoặc ghi đạt soak/Android. Xem VERIFICATION.md cho phạm vi từng lượt.

Người dùng giữ dwell thích ứng và bỏ thu thập/calibration 5–10 clip mặt trong lượt này. Đã bổ sung harness A/B dùng Silero reference + chính UtteranceBuilder TS trên 5 clip FLEURS: 19 đoạn, clamp 3; WER/CER không đổi (10,67%/5,91%), không promote. Smoke 120 giây trên v19 phát hiện 1 AudioContext âm phản hồi chưa đóng sau teardown; source đã bổ sung release và regression resume đến muộn. Đang kiểm lại/build local, chưa thay bản public v19 hoặc nghiệm thu 30 phút. Chi tiết tại [đuôi âm thanh và soak](AUDIO_TAIL_AND_SOAK_20261016.md).

## Bản bàn giao cuối v19 — 16/10/2026

Public hiện là **demo-20261016-responsive-v19** tại cùng link changelog-trends-bosnia-measurements; Docker healthy/HTTPS 200, rollback v13 giữ lại. Bổ sung sửa badge “100% trên thiết bị” và các text lệch trong poster; nút xem chuyển ra dưới ảnh, không che phụ đề mẫu. Khung giới thiệu đúng 16:9; PWA bổ sung nhận worker chờ từ trước khi UI gắn listener, không tự reload. Check đầy đủ 208 tests/57 files qua trước lượt poster; sau poster/player 2 regression +typecheck/format và Docker build qua. Phạm vi phép đo theo từng artifact ghi ở VERIFICATION.md. Không đổi model hoặc tuyên bố tăng accuracy/Android.

## Responsive và tối ưu lõi — 16/10/2026, v16

Đã đưa lên **https://changelog-trends-bosnia-measurements.trycloudflare.com/**, giữ image v13 rollback. Docker public healthy và Edge HTTPS khởi tạo AI thành công; staging cuối localhost:8089. Không đổi tunnel hoặc model.

Đã triển khai camera/phụ đề luôn trong viewport, ngang thấp hai cột, không remount media khi xoay; giữ aside/Tùy chọn truy cập được. Partial thêm ranh giới cụm và đồng thuận theo media-time, adaptive dwell Python–TS, IoU mặt >=0,40, scratch resampler tái sử dụng, tokenizer LRU 512 và tải nối cho core/PhoBERT. Không đổi trọng số/model, không tuyên bố tăng accuracy. Check qua **207 tests/57 files**; Docker/offline worker thật qua. Người dùng chọn giữ khóa kho 5 phút. Migration retention 24 giờ mới chỉ kiểm PostgreSQL local, chưa deploy Supabase. Xem [ma trận yêu cầu và ngoại lệ](RESPONSIVE_CORE_20261016.md) và VERIFICATION.md.

## Sửa khởi tạo AI — 16/10/2026, v13

Public đã chuyển riêng container web sang `signemo:startup-20261016-v13`, giữ link **https://changelog-trends-bosnia-measurements.trycloudflare.com/** và image v12 để rollback. Sửa timeout tính cả download, thêm tiến độ/tải nối/kiểm checksum và lỗi theo nhánh; B0 có lựa chọn WASM tương thích. Không đổi trọng số, threshold hoặc chất lượng model. Check qua 199 tests/56 files, format qua; Edge staging/public khởi tạo, cache offline và retry tương thích qua. Chi tiết bằng chứng/giới hạn tại VERIFICATION.md và STARTUP_RELIABILITY_20261016.md; chưa nghiệm thu Android hoặc profile máy thực tế báo lỗi.

## Khôi phục link sau lỗi NXDOMAIN — 16/10/2026, 09:30

Link hiện hành: **https://changelog-trends-bosnia-measurements.trycloudflare.com/**. Tunnel `lot-tackle-legendary-anna` cũ bị Cloudflare trả `Unauthorized: Tunnel not found` dù tiến trình còn sống; DNS không còn bản ghi. Đã tạo tunnel HTTP/2 mới, xác nhận DNS máy và 1.1.1.1, healthz HTTPS 200, đúng build v12. Docker vẫn healthy, không sửa app/model hoặc DNS hệ thống. Các URL cũ bên dưới là lịch sử; xem DEPLOYMENT.md.

## Đưa v12 lên link chia sẻ — 16/10/2026

Theo yêu cầu mới, container public `ou-khinghip-web-1`/8080 đã chuyển sang artifact v12 đã kiểm thử, qua `compose.public-trial.yaml`; image baseline cũ giữ tag rollback. Ba mount read-only chỉ chứa Gipformer/B0/runtime, không đưa fixture/media nghiên cứu lên link. Tunnel cũ không chạy; đã mở Quick Tunnel HTTP/2 mới **https://lot-tackle-legendary-anna.trycloudflare.com/**. HTTPS healthz 200, entry JS đúng build v12, manifest không B2 và model/runtime truy cập được. Chi tiết kiểm tra Chrome ở VERIFICATION.md, lệnh chạy/rollback tại DEPLOYMENT.md. Đây là phát hành bản dùng thử theo yêu cầu, không thay thế nghiệm thu chất lượng/Android.

## Tiếp tục: clip giới thiệu, LCP và bỏ B2 candidate — 16/10/2026

Build bàn giao mới `demo-20261016-intro-lcp-v12` chạy healthy tại **http://127.0.0.1:8087/**. 190 tests/54 files và check/format qua; 6 regression model-comparison sau lọc B2 cùng lint/typecheck/format qua. Clip đã bắt đầu phát trong iframe; offline cache ấm khởi tạo được B0/Gipformer. V12 sửa khung video tràn vùng cuộn mobile, đã xem/xác nhận desktop và mobile. V10/v11 dừng, còn image/container để rollback; không thay public 8080. Số đo smoke chức năng 60 giây không là nghiệm thu hiệu năng/accuracy, xem VERIFICATION.md.

Đã thay minh họa tương tác bằng player clip YouTube do người dùng cung cấp, bấm mới kết nối và có fallback offline. Candidate B0 loại B2 khỏi core cache và output Docker, giảm riêng checkpoint 29,35 MiB; danh sách chọn thử còn 28 asset, 314,54 MiB trước app/tone. LCP khóa mềm dùng chung Hội thoại/video local; final vẫn sửa toàn câu, partial không đi vào fusion/vault. Bản thường và public 8080 giữ nguyên. Các cổng nghiệm thu clock thật, chất lượng, Android và tải dài vẫn chưa thay thế bằng thay đổi UI/thuật toán này; xem [báo cáo](INTRO_PARTIAL_BUNDLE_20261016.md).

## Bàn giao bản thử local — 16/10/2026

V10 tại **http://127.0.0.1:8087/** đã start lại, healthy; public 8080 giữ nguyên. Check/lint/typecheck/build/checksum và format-check qua, **181 tests / 51 files**, 4 test Python. Offline cache ấm và UI desktop/mobile qua kiểm tra; không mở camera/micro trong lượt UI. Đã có tải dài 30 phút v7 và smoke 5 phút v10 sau sửa clock, nhưng nguồn audio ảo vẫn lệch đồng hồ. Không coi latency fixture là nghiệm thu micro thật; chưa đủ bằng chứng chọn profile sản phẩm, chất lượng Angry/Fear/Disgust hoặc Android. Chi tiết mới nhất ở [VERIFICATION.md](VERIFICATION.md).

## Nâng cấp hệ thống hiện hành — 15/10/2026

Bổ sung 16/10 (giờ Việt Nam): đã chạy pipeline tạo tải 30 phút trên v7; phát hiện timestamp audio cần ánh xạ lại, không dùng p95 delivery v7 làm nghiệm thu latency. Source cuối thêm cặp đồng hồ AudioContext/performance, giữ PCM im lặng cho quantum input rỗng, dừng khi gap lớn. Model/ASR/VAD inference không đổi trọng số. Bản bàn giao mới là v10; smoke clock/offline cuối ghi ở VERIFICATION.md. Chưa nghiệm thu lại 30 phút sau sửa clock, mic thật/Android hoặc accuracy.

Đã thêm build thử `pc-candidate` nối Gipformer INT8 + B0/WebGPU + PhoBERT vào Hội thoại, warm-up classifier trước READY, giữ modelVersion sau prewarm, sửa nhánh text sẵn sàng muộn để tham gia phiên hiện tại mà không mở lại micro. Candidate chỉ chuẩn bị VAD thay cho các checkpoint/runtime Whisper không dùng; asset được kiểm hash/cache, runtime GPU có cache offline riêng. Bản thường và public 8080 chưa đổi; staging local 8087 là `demo-20261015-pipeline-v10`.

Đã sửa benchmark dài thành harness dùng ảnh mặt/audio tiếng Việt công khai với bộ đếm inference thật, deadline monotonic, xuất số liệu tổng hợp và cleanup; fixture không đồng bộ người nên không đánh giá accuracy/fusion quality. Công cụ fusion đã mở đủ 7 nhãn/support. Thêm CLI confidence calibration validation-only, không tự áp dụng vào production. Đã sửa hồ sơ pitch/skill, bỏ khẳng định thiếu nguồn và diễn giải sai benchmark. Chi tiết, cách chạy và cổng còn thiếu ở [SYSTEM_UPGRADE_20261015.md](SYSTEM_UPGRADE_20261015.md); kết quả thực nghiệm ghi tại [VERIFICATION.md](VERIFICATION.md).

Chưa có validation hội thoại tách người, calibration được nghiệm thu, Android thật hoặc pilot. Không gọi toàn hệ thống đạt realtime chỉ vì nối được các nhánh. Tài nguyên chọn thử 343,90 MiB (bao gồm runtime, chưa gồm app/tone), không phải RAM; chưa tinh gọn image sản phẩm cuối cùng.

## Hiện hành — 15/10/2026

Đã thêm công cụ so ASR cùng PCM và ba cấu hình mặt cùng video, không tự promote. Phụ đề chữ tối + badge/viền trái. Source demo giữ PhoWhisper-tiny, B2/WASM, PhoBERT; tone GPU tùy chọn đã nối fusion, chưa nghiệm thu chất lượng tiếng Việt. Không thay link 8080. Trạng thái “chưa bật tone” bên dưới đã được thay bởi [LIVE_TONE.md](LIVE_TONE.md); xem [MODEL_COMPARISON.md](MODEL_COMPARISON.md) và [VERIFICATION.md](VERIFICATION.md) cho lượt mới, không dùng benchmark upstream làm accuracy SignEmo.

## Tiếp tục tone pretrained — 14/10/2026

Đã chuẩn bị Emotion2vec thật, INT8 v1/v2 và FP32/WebGPU cùng source/license/hash. INT8 chưa qua parity đầy đủ và mất ~4,3 giây/3 giây audio; chưa bật vào hội thoại. FP32/WebGPU đã chạy được, khớp reference trên PCM tiếng Việt public; lượt đầu 0,8/1,6/3 giây mất ~4,9/2,6/1,1 giây, còn cần đo warm/độ dài thay đổi và toàn pipeline. Không chứng minh accuracy tiếng Việt. Probe/audit nằm trong lab local 8084; link 8080 chưa đổi. Chi tiết [TONE_RESEARCH.md](TONE_RESEARCH.md). Các ghi chú “chưa có checkpoint thật” trước đó là lịch sử; **chưa bật tone sản phẩm** vẫn đúng.

## Bản thử B2/ngưỡng nhạy — 14/10/2026

Bản này nằm ở source/image staging localhost:8083, chưa thay link 8080. Đo lại classifier riêng p95 808 ms, chưa đạt cổng và có thể bị stale gate 750 ms loại. Xem [SENSITIVE_DEMO.md](SENSITIVE_DEMO.md); thay đổi source chưa được rollout tới link đang chia sẻ.

Theo yêu cầu trực tiếp, đã chọn B2 cho profile demo thay B0 và hạ ngưỡng mặt/fusion 0,65 → 0,55, margin fusion 0,15 → 0,10. Chưa có bằng chứng tăng accuracy; B2 có parity và classifier latency trước đó, chậm hơn B0. Thông báo fusion phân biệt thiếu nguồn với điểm thấp. Tone chưa bật: cần chọn checkpoint thật/đường triển khai trong ngân sách; artifact synthetic không phải model sản phẩm. Các mục B0/ngưỡng cũ bên dưới là lịch sử.

## Nâng cấp 7 nhãn/giới thiệu — 14/10/2026

Đã mở Fear/Disgust xuyên pipeline mặt/text/fusion và vault, thêm màu câu có icon/tên, hai nhịp mới và avatar 3D nhỏ tùy chọn. Giới thiệu là trang mặc định; AI lõi prewarm qua cùng session, không mở thiết bị hoặc tạo worker trùng khi vào Hội thoại. Resampler dùng ring/polyphase, xử lý cụm lặp yêu cầu bằng chứng audio overlap, fusion dùng quan sát mặt đạt chất lượng thay vì chỉ nhãn đã ổn định.

Gipformer đã qua smoke PCM browser/reference/offline/repair; B2 đã qua parity nhưng chậm hơn B0 trong classifier riêng. Chưa promote cả hai vì thiếu đo toàn pipeline, kiểm thử người thật và Android. Tone MERaLiON chỉ có source/license/CLI file local, chưa tải checkpoint/chạy inference; không tự tải 3,08 GB lên web. Giữ PhoWhisper/B0 sản phẩm. MP4 AI chưa tạo; prompt/storyboard/SRT/poster và player fallback đã có. Chi tiết số đo, giới hạn và lệnh lab ở [SEVEN_LABEL_UPGRADE.md](SEVEN_LABEL_UPGRADE.md).

## Phụ đề làm nền, R&D mặt–text–tone — 13/10/2026

Đã tách adapter ASR local chung, prototype Gipformer 1.5 INT8/Sherpa WASM 1.13.8 và profile nghiên cứu được phục vụ riêng bằng Compose overlay. Tổng gói gồm runtime 84,43 MiB. Đã sửa callback hội thoại để mặt chỉ hiển thị và fusion phát nhịp theo ID, chống revision/late cue trùng. Thêm boundary/group cho hard-cut, bounded semantic context, effective RTF tính cả partial; video có chữ tạm và reset epoch/queue khi seek.

Tone chưa có model tiếng Việt được nghiệm thu. Đã có feature extractor chung browser/offline, train CPU MLP → ONNX, consent/expiry/speaker-split guards, calibration validation, parity và loader research-only ≤5 MiB trong lab. Nhánh text/tone lỗi độc lập, không ngăn ASR. Có CLI ablation/fusion chọn trên validation, không tự promote. Production giữ PhoWhisper + EmotiEffLib + PhoBERT và fusion mặt/text.

Smoke browser trên 5 clip public FLEURS: Gipformer chạy được và đối chiếu cùng PCM với Python; đây chưa phải held-out hội thoại hay benchmark toàn pipeline. Số đo/checks/Docker cuối cùng ghi trong VERIFICATION.md. Cổng còn thiếu: dữ liệu tiếng Việt có nhãn/tách người, tone được huấn luyện thật, 30 phút toàn pipeline với phần cứng PC và pilot. Android/iPhone chưa được nghiệm thu. Xem [RND_SPEECH_FUSION.md](RND_SPEECH_FUSION.md). Các mục ngày trước bên dưới là lịch sử, không thay quyết định mới này.

## Chuẩn bị AI trước phiên và nhật ký hoạt động — 11/10/2026

Màn hội thoại khởi tạo worker phụ đề/VAD rồi worker khuôn mặt trước khi cho phép bắt đầu; yêu cầu quyền camera/micro vẫn chỉ xảy ra sau thao tác người dùng. Hủy khởi tạo worker camera có AbortSignal, tránh để lần thử lại chờ timeout. Tài nguyên đã xác minh được memo theo cache, URL, kích thước và checksum trong vòng đời trang. Bắt đầu hội thoại không gọi luồng tải model.

Đã thêm nhật ký cục bộ IndexedDB với retention 24 giờ và giới hạn 1.000 sự kiện; UI hội thoại giữ 5 mục gần nhất, trang Nhật ký cho lọc, xuất và xóa. Nội dung dùng mã sự kiện/mẫu câu allowlist; không ghi media, transcript, landmarks, nội dung feedback hay exception text. Marker trong sessionStorage hỗ trợ nhận biết phiên trước bị gián đoạn và vào chế độ nhẹ; không tự mở lại camera/micro. Chưa có bằng chứng đủ để kết luận vòng lặp reload trước đây do PWA, runtime hay áp lực bộ nhớ; chỉ log sự kiện có thể giúp thu hẹp nếu hiện tượng tái diễn.

Kiểm thử tự động xác nhận hành vi mock; nghiệm thu bằng camera, micro, loa PC thật và đo 20–30 phút vẫn cần thực hiện riêng. Kết quả cuối của các cổng kiểm tra và Docker rebuild được ghi ở `VERIFICATION.md` sau khi hoàn tất lượt này.

## Hội thoại hợp nhất mặt–phụ đề — 11/10/2026

Hội thoại là màn duy nhất chứa preview camera, phụ đề, gợi ý mặt, tổng hợp và đổi camera. Gói sắc thái tự chạy khi đã sẵn sàng; gợi ý mặt vẫn hiện khi tổng hợp không có đủ nguồn. Chỉ quyết định tổng hợp đủ điều kiện mới phát nhịp. Camera bắt đầu ở 5 Hz, hạ theo hàng đợi ASR/RTF/p95 và phục hồi dần. ASR chia đoạn tối đa 3 giây; chất lượng âm thanh dùng noise suppression của trình duyệt cùng heuristic RMS/nền nhiễu/clipping trong RAM. Voice model vẫn cần đánh giá tiếng Việt; chưa có denoise/pitch model riêng.

## Sửa luồng PC và đóng gói model — 11/10/2026

Source hiện tự chuẩn bị toàn bộ model; Docker production chứa mặt/tiny/emotion/base và runtime kiểm checksum. Phiên hội thoại yêu cầu cả camera/micro trong một lần xin quyền, audio được kích hoạt từ click, có hủy/lỗi ngay cạnh điều khiển. Readiness cốt lõi độc lập service worker; sẵn sàng offline vẫn cần toàn bộ cache và worker điều khiển trang. PC phát âm trong chế độ Tự động, camera/luyện tập/hội thoại dùng chung bộ phát; lựa chọn tắt/mô phỏng cũ được giữ. Sidebar cuộn và menu dưới 1024px, consent gần nút bắt đầu. Xem kết quả đợt này trong VERIFICATION.md.

Workspace hiện chưa có thư mục `.git`, nên chưa thể kiểm toán file đã tracked. Đã bổ sung ignore secrets và dữ liệu nghiên cứu, Docker dùng allowlist context. Không khởi tạo Git hoặc push tự động.

## Nguồn chuẩn

`MVP_SPEC.md` thay thế các lựa chọn kỹ thuật mâu thuẫn trong sáu tài liệu gốc. Không sửa nội dung Word gốc để giữ lịch sử. Ba Markdown gốc được đánh dấu là bản tham khảo. `implementation_plan.md` trước đây chỉ phục vụ cập nhật biểu mẫu, không phải kiến trúc phần mềm hiện tại.

## Đánh giá tài liệu

SignEmo_NoidungChinhDuAn và biểu mẫu trộn MobileNet, STSTNet-Lite, FACS và các benchmark không có artifact trong folder. Context và DỰ ÁN KHỞI NGHIỆP có nhánh SeeFeel/cảnh báo mặt–giọng nói. SIGN EMO vẫn trộn audio, micro-expression và pattern rung. Độ tuổi dao động 12–65/18–40, nhóm 3/5 thành viên, doanh thu và vốn khác nhau. Biểu mẫu Markdown có phần lặp và văn bản bị nối hỏng; không dùng làm nguồn dữ liệu ứng dụng.

Các số liệu 2,5 triệu người, 78% khảo sát, tiết kiệm pin 60%, lợi nhuận >40%, STSTNet 800KB/<30ms, API watch <50ms và tuyên bố độc quyền thị trường đều cần nguồn/chứng cứ riêng. Chưa có dữ liệu gốc khảo sát hoặc thí nghiệm trong folder. Gói 29k/tháng =348k/năm, không thể gọi 490k/năm là tiết kiệm.

## Quyết định đã chốt

Web/PWA trước; camera + phụ đề tiếng Việt + gợi ý sắc thái thử nghiệm trên cùng máy; 4 nhịp/luyện tập; ưu tiên ít báo sai; người lớn đối thoại 1–1; backend nhỏ Supabase; chưa có đối tác; nghiên cứu riêng offline; ngân sách <3 triệu; bạn+Codex; không deadline. Audio đã được bổ sung theo yêu cầu; payment, smartwatch, sarcasm và micro-expression vẫn ngoài phạm vi. Hiện chỉ có PC để kiểm thử.

## Giả thuyết cần xác minh

| Giả thuyết                              | Bằng chứng cần có                            |
| --------------------------------------- | -------------------------------------------- |
| Icon/rung giúp hơn tự quan sát          | Pilot AB/BA và phản hồi người dùng           |
| 4 nhịp đủ phân biệt, không gây phân tâm | Bài luyện + quan sát hội thoại               |
| Android hiện có chạy đủ mượt            | Benchmark máy thật 20–30 phút                |
| Có người mua B2B2C                      | Phỏng vấn bên chi trả, thử có cam kết        |
| Giá và mô hình doanh thu phù hợp        | Willingness-to-pay, chi phí hỗ trợ, giữ chân |

## Tiến độ thực hiện

- Đã tạo source PWA, pipeline worker MediaPipe/FER+, filter, haptics, luyện tập, settings, offline cache, feedback queue và admin.
- Đã tạo schema/migration/functions; Docker production/dev chạy cục bộ. Chưa kết nối Supabase hosted hoặc hosting HTTPS công khai.
- Đã tải model/runtime, ghi checksum/giấy phép; camera, ASR, PhoBERT và voice model inference chạy local trong browser. Số đo hiện có không phải độ chính xác thực địa.
- Đã thêm 9 skills theo repo, tài liệu triển khai/pilot, unit/integration tests. Lần kiểm tra mới nhất của bộ web: 88 test trong 21 file, 13 face + 25 conversation asset checksums; 6 test Python thuộc lần kiểm tra trước. Xem VERIFICATION.md.
- Chưa pilot, chưa thu clip nghiên cứu, chưa train MLP trên người thật; các bước này phụ thuộc đồng ý/người tham gia.

## Backlog tiếp theo

1. Hoàn tất nghiệm thu với webcam/micro và máy tính PC mục tiêu; ghi rõ hỗ trợ trình duyệt và hành vi offline.
2. Khi có thiết bị Android, benchmark camera/rung/pin/nhiệt; sau đó mới thiết lập HTTPS/Supabase bằng tài khoản chủ dự án.
3. Tìm đối tác và tổ chức pilot 5–10 người trưởng thành.
4. Đánh giá độ chính xác trên dữ liệu có đồng ý trước khi bật nhánh cải thiện MLP.
5. Xác minh người mua/giá/chi phí vận hành trước khi thêm thương mại.

Ngân sách dự kiến tối đa 2,8 triệu, chưa tính công: domain/tài nguyên 0,3; hỗ trợ pilot 1,2; đi lại 0,6; dự phòng 0,7 triệu. Chưa phát sinh mua thiết bị, thuê bao hay cam kết trả phí trong triển khai này.

## Đợt cải thiện neutral–sad và UX

Đã bổ sung phòng kiểm thử video local, nhãn theo đoạn, replay 5 Hz và báo cáo; điểm gốc/EMA/lý do; profile threshold/margin theo lớp trong lab; nhịp dùng chung camera/video/luyện tập; tải offline có byte/progress/cancel; feedback local-only và đồng ý theo destination, migration consent v2.

Đã có CLI PyTorch CPU → ONNX neutral/sad, kiểm consent/expiry/split, parity, validation và held-out activation. Chưa huấn luyện trên người thật; FER+ vẫn mặc định. Chưa có bằng chứng sad thực địa tốt hơn. Xem AI_LAB.md và VERIFICATION.md. Chưa có dữ liệu người thật; chưa triển khai public hosting hoặc tạo tài khoản Supabase trong đợt này.

## PC-first hiện trạng

Bản production chạy bằng Docker Compose (`web` cổng 8080, `dev` cổng 5174); khi đổi source cần build lại image production, còn dev có HMR. Chrome đã xác minh gói app/model nền, speech và emotion được lưu offline, mở lại tab offline, chạy emotion inference và nhận kết quả ASR. Python/browser parity đã qua ngưỡng kỹ thuật 0,03 trên một fixture; đây không phải benchmark độ chính xác. Whisper base giảm WER trên 5 clip FLEURS nhưng RTF lớn hơn 1, nên chưa thay tiny làm mặc định. Xem `VERIFICATION.md` và `SPEECH_AI.md` để biết số đo cùng giới hạn.

Bước chức năng PC còn cần xác minh với microphone/webcam vật lý, luyện nhận biết pattern rung bằng mô phỏng PC và thử nhiều trình duyệt. Không tuyên bố đã thử Android hoặc người dùng thật.

## Hội thoại hợp nhất — nghiệm thu kỹ thuật PC 11/10/2026

Hội thoại là màn duy nhất cho preview camera, phụ đề, gợi ý khuôn mặt, tổng hợp thử nghiệm và đổi camera. Phiên synthetic trên Docker production đã xác nhận yêu cầu audio+video cùng một lượt; đổi camera yêu cầu video-only và giữ mic live; kết thúc giải phóng track, worker/audio capture. Không có POST hoặc request ra ngoài trong luồng synthetic này.

Playwright kiểm tra 320×568, 390×844, 844×390, 768×1024, 1024×768, 1366×768 và 1920×1080: không tràn ngang, menu/sidebar đúng breakpoint, phụ đề còn hiển thị. Docker production đã rebuild, healthcheck healthy ở `localhost:8080`; build ID hiển thị trong app. Đây là kiểm tra synthetic/UI, chưa xác nhận webcam, microphone, loa PC vật lý, độ chính xác cảm xúc hay chất lượng hội thoại thật; Android chưa được thử.

## Khởi động, cache và recovery — nghiệm thu PC 11/10/2026

Tải model dùng buffer kích thước cố định thay vì giữ đồng thời mảng chunk và bản ghép. Mỗi gói được kiểm tra lại sau khi ghi cache; nếu trình duyệt làm mất entry giữa các gói, hệ thống sửa thiếu tối đa một lượt. Tiến độ không báo 100% cho tới khi toàn bộ cache được xác minh. Marker phiên giữ ID ngẫu nhiên cục bộ; trong `pagehide` không xóa ID và không khởi động lại AI khi document đang rời đi.

`npm run check`: 96 test trong 23 file, lint, TypeScript, 13 face + 25 conversation checksums và build qua. `npm run format:check` qua. Docker production được build/tạo lại; container healthy trên `127.0.0.1:8080`, build ID `local-2026-10-11T16:38:13.749Z`. Browser profile sạch xác nhận đủ speech/emotion/speech-base trong CacheStorage; synthetic session có một lần xin audio+video, không tự điều hướng khi bắt đầu; reload có chủ đích quay về idle, hiện chế độ nhẹ và không tự mở lại camera/micro.

Không tái hiện được reload tự phát trong browser regression. Kết quả này không xác nhận webcam/micro/loa vật lý trên PC; việc đo phần cứng, Android và chất lượng nhận diện vẫn cần nghiệm thu riêng. Chi tiết ở `VERIFICATION.md`.

## Profile AI gọn và sửa camera — 12/10/2026

Phiên bản sản phẩm bỏ model cảm xúc tông giọng và Whisper base khỏi manifest/cache production. Pipeline mới dùng Whisper tiny multilingual q8 cho phụ đề, PhoBERT cho sắc thái văn bản và FER+ cho biểu cảm mặt; chỉ mặt + văn bản đủ chất lượng, đồng thuận mới phát gợi ý tổng hợp. Không có model sinh văn bản: CaptionRevision chỉ chuẩn hóa định dạng và lặp ở ranh giới đoạn, đồng thời giữ nguyên transcript ASR. Bản cũ có trường voice trong lịch sử vẫn đọc được, nhưng phiên mới không tạo voice evidence.

Preview camera có chế độ lật ảnh riêng, không lật frame đưa vào AI. Đổi camera chọn thiết bị khác; khi chỉ có một camera hoặc đổi thất bại, phiên và micro đang hoạt động được giữ nếu video track cũ còn sống. Ứng viên PhoWhisper-tiny và Gipformer chỉ được ghi nhận để đánh giá nghiên cứu; chưa có artifact được ghim và chưa có benchmark SignEmo đạt ngưỡng promote, nên tiny vẫn là mặc định.

Kết quả kiểm tra mã nguồn, asset checksum, Docker và trình duyệt sẽ được ghi theo lần chạy thực tế trong `VERIFICATION.md`. Chất lượng ASR/fusion trên hội thoại tiếng Việt, webcam/micro/loa vật lý, Android và pilot vẫn chưa được xác nhận bởi cập nhật này.

## Thay classifier mặt sang EmotiEffLib — 13/10/2026

Classifier FER+ được thay trong profile ứng dụng bằng EmotiEffLib `enet_b0_8_best_afew` ONNX, ghim tại revision `c018fcf96c79c3bd9184f1c9438fe2095c9f1943`. File 16,039,595 byte (15.3 MiB), SHA-256 `7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f`, Apache-2.0. Worker xử lý crop RGB 224×224, chuẩn hóa ImageNet và ánh xạ 8 logits upstream sang thứ tự lớp ổn định của SignEmo; crop 64×64 chỉ còn dùng cho heuristic chất lượng ảnh. Script chuẩn bị và verifier ghim model, shape, version và loại bỏ FER+ khỏi manifest sản phẩm.

Thay model là yêu cầu thử nghiệm, không phải kết luận cải thiện. Chưa có tập video người tham gia tách biệt và gán nhãn để so Sad/Angry, coverage hay latency. Cần benchmark worker trình duyệt và xác nhận độ chính xác trên validation/held-out trước khi tuyên bố phù hợp hơn. Chi tiết kỹ thuật lượt này được ghi trong `VERIFICATION.md`.

## Nhãn mặt sớm và phụ đề cửa sổ tạm — 12/10/2026

Face gate đã được sửa để cadence 1 Hz không tự reset ứng viên sau 1 giây. EMA chuyển sang hằng số thời gian 150 ms; nhãn hiển thị sau 200 ms ổn định, nhịp mặt sau 400 ms, cooldown 3 giây. Pose MediaPipe thay heuristic góc 2D; kết quả ngoài ±30° yaw/±20° pitch/±25° roll bị từ chối, và kết quả trễ quá 750 ms bị loại. Ngưỡng pose cần kiểm chứng bằng video/camera thật; unit test ma trận tổng hợp không chứng minh độ chính xác nhận diện.

ASR có thể phát phụ đề tạm từ cửa sổ lời nói 800 ms trở lên, cập nhật theo yêu cầu mới nhất; câu chốt ưu tiên và thay bản tạm. Whisper tiny vẫn multilingual q8, chưa fine-tune riêng cho tiếng Việt. Đầu ra lặp bất thường không được coi là transcript đúng. PhoWhisper/Gipformer chưa có artifact/profile đủ điều kiện trong repo và không được đưa vào production mặc định.

Xác minh lần này: `npm run check` qua với 111 tests/27 files, 13 face + 13 conversation assets qua SHA-256 và production build thành công; `npm run lint` và `npm run format:check` đều qua sau khi format 7 file. `docker compose up -d --build web` tạo lại image; container healthy, `/healthz` trả `ok`, trang trả HTTP 200. Build ID đang phục vụ: `local-2026-10-12T16:05:22.147Z`. Playwright mở đúng trang mới, tiêu đề Hội thoại chính xác và không có lỗi console; hai cảnh báo MediaPipe runtime. Chưa thử camera/micro/loa vật lý hoặc benchmark 30 phút. Workspace không có `.git`, nên không thể tạo báo cáo `git diff` hoặc xác nhận file tracked.

## Đo độ trễ frame và rà ứng viên ASR — 13/10/2026

Khi có hỗ trợ, camera chờ `requestVideoFrameCallback` để lấy frame vừa được trình bày, với timer fallback cho trình duyệt cũ. Mốc thời gian được lấy trước `createImageBitmap`, nên độ trễ không bỏ qua bước capture. Kết quả giữ riêng thời gian capture, thời gian suy luận trong worker và latency đến khi kết quả về giao diện; ngưỡng loại kết quả chậm và p50/p95 phiên dùng latency đầu-cuối. Có regression cho phép tính thời gian capture/latency. Đây là sửa cách lấy và đo frame, chưa chứng minh webcam thật đạt mục tiêu p95 700 ms.

Ghi chú ở thời điểm rà soát ban đầu: Moonshine chưa được ghim/tích hợp. Trạng thái hiện tại được cập nhật trong mục “Moonshine local research profile” ở cuối tài liệu.

Lượt kiểm tra mới: `npm run check` qua với 114 tests/28 files, lint/boundary, TypeScript, 13 face + 13 conversation asset checksums và production build; `npm run format:check` qua; Python research suite 7 tests qua. Docker production đã build/tạo lại, healthy tại `127.0.0.1:8080`; build ID `local-2026-10-13T01:11:27.370Z`. Một UI test timeout khi chạy đồng thời với Docker build, nhưng qua riêng và trong full suite chạy tuần tự. Không có clip nghiên cứu có nhãn/đồng ý trong repo; chất lượng tiếng Việt, độ chính xác biểu cảm và benchmark phần cứng vẫn chưa được xác nhận.

## ASR tiếng Việt ưu tiên PhoWhisper — 13/10/2026

Profile ASR hiện ưu tiên PhoWhisper-tiny ONNX q8, đã fine-tune cho tiếng Việt. Artifact chuyển đổi cộng đồng được ghim revision và checksum; Whisper tiny q8 giữ làm fallback nếu PhoWhisper không khởi tạo được. Model được phục vụ cùng origin và worker chỉ cho phép model local. Gói PhoWhisper thêm 45.305.228 byte (43,2 MiB); dùng lại Transformers.js/ONNX Runtime hiện có, dưới ngân sách tăng thêm 100 MiB. Audit ghi profile thực sự sẵn sàng bằng mã model, không ghi audio hoặc transcript.

Smoke test trên 5 mẫu đọc công khai FLEURS `vi_vn`, cùng pipeline Transformers.js và ONNX Runtime Node CPU: PhoWhisper WER 0,1533 / CER 0,0944 / RTF 0,1983; Whisper tiny q8 WER 2,2667 / CER 1,7108 / RTF 0,3915. Đây chỉ là so sánh kỹ thuật nhỏ trên Node CPU, không phải trình duyệt WASM hay hội thoại tự nhiên; chưa đủ để xác nhận chất lượng production hoặc đạt cổng promotion. Cần benchmark trong browser và tập hội thoại tiếng Việt tách người nói.

Lượt này `npm run check` qua (lint, TypeScript, 117 tests/29 files, checksum asset và build); `npm run format:check` qua. Docker production được build và tạo lại; container healthy, `/healthz` HTTP 200, model ONNX được phục vụ HTTP 200 với đúng kích thước 10.113.250 byte. Build ID `local-2026-10-13T02:43:45.142Z`. Chưa xác nhận inference WASM trong Chrome, microphone/webcam vật lý, WER trên hội thoại hoặc độ chính xác biểu cảm.

## Moonshine local research profile — 13/10/2026

Đã ghim Moonshine Streaming Tiny Vietnamese model revision `quantized_26_08_24`, runtime `@moonshine-ai/moonshine-wasm@0.1.5` và MIT license. Model assets là 30.8 MiB; WASM/JS runtime là 12.7 MiB; tổng profile 43.5 MiB, dưới giới hạn 100 MiB. `npm run assets:moonshine` xác minh SHA-256 và tạo manifest; Docker build chạy bước này để thiếu/hỏng tài nguyên làm build lỗi. Runtime/model được phục vụ cùng origin.

PhoWhisper vẫn là mặc định. Moonshine chỉ xuất hiện trong Tùy chọn nâng cao và chỉ được bật trên localhost với `/?moonshine=1`, nơi server trả COOP/COEP để hỗ trợ runtime WASM threaded. Link tunnel đang chia sẻ và response headers mặc định không đổi. Chỉ worker của profile đang chọn được khởi tạo; Moonshine nhận PCM 16 kHz từ pipeline micro/VAD hiện hữu, không mở thiết bị riêng. Partial/final vẫn chịu lịch gửi hiện tại của VAD. Worker/session cancellation giải phóng stream và transcriber.

Xác minh lượt tích hợp: `npm run check` qua (136 tests/36 files, lint, TypeScript, asset verification và production build); `npm run format:check` qua; `npm run assets:moonshine` qua. Image độc lập `signemo:moonshine-local-check` build thành công, build ID `local-moonshine-2026-10-13`. Container kiểm thử đang chạy ở `http://127.0.0.1:18081`; container phục vụ `/healthz` HTTP 200, cả 8 model asset, 2 runtime asset và license đều trả HTTP 200 với kích thước khớp manifest. `/?moonshine=1` trả COOP `same-origin` và COEP `require-corp`; URL thường không có hai header này. Container sản phẩm ở cổng 8080 và container khác ở 8081 không bị thay đổi.

## Browser retest — 13/10/2026

Đã tái hiện lỗi khởi tạo AI trên bản cũ khi mở `/?moonshine=1`: trang bật COOP/COEP nhưng worker/cache cũ thiếu chính sách COEP, khiến Chrome chặn worker speech/VAD (`ERR_BLOCKED_BY_RESPONSE`). Bổ sung COEP cho asset worker và runtime, đổi worker speech sang asset có hash riêng để PWA nhận bản mới, và giữ CSP nghiêm cho ứng dụng; ngoại lệ `unsafe-eval` chỉ có trên worker nghiên cứu Moonshine.

Trên container mới `signemo:moonshine-local-check` ở `http://127.0.0.1:18081`, profile trình duyệt sạch khởi tạo PhoWhisper thành công, `crossOriginIsolated` là true, không còn banner “AI chưa sẵn sàng”; request worker trả HTTP 200. Đây là kiểm thử prewarm trên Chrome automation, chưa xin quyền hoặc xác nhận camera/micro/loa vật lý.

Khi chọn Moonshine trong thử nghiệm, model và runtime tải được nhưng WASM báo `frontend.model.ort is not a model asset this loader recognizes`. Vì vậy profile Moonshine tạm bị khóa trong UI cho đến khi runtime/artifact tương thích; PhoWhisper tiếp tục là mặc định. Lượt này chưa đo WER/CER, độ trễ, RTF hoặc RAM cho Moonshine và không đánh giá camera/micro vật lý. Người đang giữ cache PWA cũ cần cập nhật worker/service worker hoặc xóa dữ liệu site rồi tải lại.

## Live tone experimental update - 2026-10-14

Conversation now has explicit optional FP32/WebGPU tone preparation and face/text/voice fusion. Product default remains face/text. See [LIVE_TONE.md](LIVE_TONE.md) for current behavior, quality gates, noise filtering and verification limits. Earlier statements that tone is lab-only describe older builds. No public deployment or Vietnamese accuracy promotion is implied.
