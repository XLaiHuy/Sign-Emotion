# Video local và phản hồi theo nét mặt — 18/10/2026

## Bổ sung minh họa theo yêu cầu

Đã thêm `ExpressionMotion` khi không có video ký hiệu hoặc video lỗi: 7 hình SVG riêng, chuyển miệng/lông mày từ neutral trong 450 ms, một lần theo cue còn hạn; nút xem lại thủ công. Không có động tác tay giả, model mới, tải media hoặc âm thanh. UI ghi rõ “Minh họa biểu cảm · không phải ngôn ngữ ký hiệu”. Chưa rõ/mất nguồn/chuyển nền dùng mặt trung tính và bỏ chuyển động; reduced motion giữ hình tĩnh. Cài đặt hiện tên “Minh họa biểu cảm / video ký hiệu khi có”, giữ key đã lưu.

Kiểm tra: `npm run check` đạt 259 test/71 file, lint 111 module, typecheck/assets/build qua (`output/research-evaluation/expression-motion-check.log`). Sau bổ sung morph SVG chạy lại typecheck, 5 test liên quan và format-check đều qua. Chrome local harness `output/playwright/expression-motion-qa.js` qua ở 1200/390 px, đủ 7 hình, không tràn ngang; 3 SVG animate có thời hạn, CSS một lần, reduced motion gỡ animate/nút phát. Ảnh `expression-motion-1200.png`/`expression-motion-390.png`; harness chỉ kiểm trình bày, không bằng chứng accuracy hay motor Android. Docker local 8095 rebuild, public không đổi. Danh mục video ký hiệu thật vẫn rỗng do chưa xác minh đủ quyền/nghĩa/vùng.

## Hành vi triển khai

Hội thoại phát nhịp từ trigger mặt hiện có (dwell nhịp 400 ms, cooldown cài đặt tối thiểu 3 giây). Bỏ đường phát từ fusion; text, final và revision không phát thêm nhịp. Không đổi model, threshold, preprocessing, gate chất lượng hoặc scheduler CPU/GPU.

Ô nhịp riêng có icon/tên, viền theo pattern; camera/phụ đề đứng yên. Giảm chuyển động bỏ hiệu ứng nhịp. Âm mặc định tắt cho cài đặt mới; giá trị đã lưu được giữ. Không tạo AudioContext phản hồi khi tắt âm (nút Thử âm là thao tác chủ động riêng). API rung được chấp nhận chỉ nghĩa là đã gửi yêu cầu, không xác nhận motor.

Clip người dùng cung cấp `Demo-SignEmo.mp4`: 3.904.770 byte, 25,642 giây, 1280×720, H.264/AAC, SHA-256 `024f4ba8af16b8c3941e29774b8d2d42020e5e5a8e40dc93e89c24881528d4ce`. Bản phục vụ có tên chứa checksum, bấm mới nạp video; không iframe. Giữ link YouTube `g6lhRElRiWs` dự phòng. Đã xem các frame 5/14/22 giây, không thấy phụ đề dễ đọc. WebVTT là **bản nháp từ ASR local**, đã ghi rõ trên player; chưa có người nghe đối chiếu lời/timecode. Không gọi đây là bản phụ đề đã được người soát duyệt.

Cache `signemo-optional-media-v1` chỉ ghi khi bấm Lưu offline, kiểm bytes/SHA/quota; không thuộc cache AI hoặc precache. SW phục vụ Range 206/416 cho tua offline. Lỗi lưu/phát không chặn chuẩn bị AI. Không nới CSP/COEP, không cập nhật public.

## Ký hiệu TP.HCM

Player sẵn sàng cho sáu từ, chỉ dùng video người thật từ danh mục asset có vùng, nguồn, giấy phép, ghi công, SHA và bytes. Có toggle độc lập với nhịp, tự phát một lần cùng sự kiện mặt, một video đang phát và tối đa một yêu cầu mới nhất. Bỏ yêu cầu cũ quá 3 giây/sai nhãn; dừng khi mất nguồn/đổi camera/ẩn/kết thúc. Giảm chuyển động chỉ cho xem thủ công. Có xem lại/lưu offline riêng.

**Danh mục hiện có 0 video đủ điều kiện.** Không có động tác tự chế hoặc checkpoint sinh ký hiệu được coi là nội dung đã xác minh. Giao diện dùng chữ/icon cho các từ còn thiếu như người dùng đã chọn. Chưa thể đo chi phí decode video ký hiệu thực tế hoặc công nhận sáu ký hiệu đã hoàn tất.

Đã rà nguồn ngày 18/10/2026:

- [Asian SignBank](https://www.cslds.org/asb/): catalogue tìm kiếm có mục TP.HCM, truy cập trực tiếp qua công cụ bị redirect loop/không truy cập được; chưa xác minh sáu mục từ và quyền phân phối.
- [QIPEDC/Bộ GDĐT](https://qipedc.moet.gov.vn/slang1): mô tả các ngôn ngữ ký hiệu vùng, chưa cung cấp bằng chứng đủ sáu video TP.HCM với giấy phép phân phối.
- [VSL400](https://www.nature.com/articles/s41597-026-08040-2): video người thuộc controlled access/Data Usage Agreement, không dùng thay asset có quyền phân phối công khai.

Chỉ thêm asset khi đủ điều kiện trên; không thu thập clip riêng hoặc gửi yêu cầu cho bên khác trong lượt này. Video test là fixture cơ chế, không là ký hiệu chuẩn.

## Kiểm chứng

`npm run check`: **256 tests/70 files**, lint 110 modules, TypeScript, checksum 13 face +25 conversation và build qua. Format-check qua; lint/format chạy lại sau sửa sampler. Regression gồm nguồn mặt thay fusion, revision không rung, cache hash/abort/quota/Range, mặc định âm tắt và giữ lựa chọn cũ, latest-only video/giảm chuyển động/mất nguồn. Log tại `output/research-evaluation/intro-face-check-clean.log`.

Docker `signemo:media-face-20261018`, digest `sha256:63abcb34c024f3de26b484e463b480aec8dd514c153117513075ef73e48ed6b0`; container `signemo-media-web-1` healthy, `/healthz` 200. Mở **http://127.0.0.1:8095/?moonshine=1**. Chạy lại bằng `docker compose -p signemo-media -f compose.media-local.yaml up -d --build`. Public v27/8080, rollback v31/8093 và staging 8094 vẫn healthy/giữ nguyên image. Chưa sửa tunnel.

Chrome/Edge kiểm cả thường và isolated: video bấm mới nạp, phát/seek, 4 cue phụ đề, lưu video+VTT, reload/tua offline (Range 206/100 byte), không tràn ngang 390 px, không iframe/request ngoài origin/non-GET/pageerror. Edge MP4 404/quota thiếu vẫn vào được Hội thoại. Layout dọc 390×844, ngang 844×390, focus Tab tới “Đến nội dung chính”, reduced-motion và proxy page zoom 200% (720 CSS px/DPR2 trên màn 1440 px) qua; không tương đương kiểm OS text-only scaling hoặc điện thoại thật. Logs `intro-face-*-media.log`, `intro-face-media-failures.log`, `intro-face-layout.log`.

### A/B lõi cùng fixture, sau sửa sampler

Mỗi bản 120 giây sau warm-up 30 giây, chạy tuần tự, không build/test song song; NASA portrait + WAV FLEURS public qua capture sản phẩm, tone/3D tắt. Model/delegate/runtime đều B0-WebGPU/MediaPipe CPU/Moonshine two-thread. File gốc: `output/research-evaluation/intro-face-baseline-fixed-memory.json` và `intro-face-new-fixed-memory.json`.

| Số đo | Đối chứng 8094 | Bản mới 8095 |
|---|---:|---:|
| Cadence quan sát | 4,997 Hz | 4,998 Hz |
| Cửa sổ 10s đạt >=4,5 Hz, nguồn >=10 Hz | 12/12 | 12/12 |
| Nhãn mặt fixture p95, gồm dwell/render | 401,6 ms | 390,8 ms |
| ASR RTF hiệu dụng | 0,250 | 0,236 |
| Peak private committed bytes của browser | 2.725.986.304 | 2.911.674.368 |
| Thời gian sampler bao phủ | 179,84 s /18 mẫu trace | 187,66 s /19 mẫu trace |
| Final chờ tối đa | 0 | 0 |
| Finish: worker/track/AudioContext/inference targets | 0/0/0/0 | 0/0/0/0 |

Private committed memory tăng **6,81%**, trong giới hạn 10% của lượt A/B này. Đây là một cặp lượt ngắn, không chứng minh xu hướng thống kê, RAM vật lý/VRAM/driver hoặc không leak. Sampler cũ đã dừng do Max(Int32) tràn trên 2 GB; trace bị cắt sớm không là peak hợp lệ. Đã sửa Int64 và thêm thời gian coverage/root PID, xem đính chính RESOURCE_SCHEDULING_20261017.md.

**Chưa nghiệm thu latency ASR:** cả đối chứng và bản mới đều lệch clock media/wall khoảng 31 giây/120s. Partial fixture p95 lần lượt 1.808/1.720 ms, final 970/878 ms là số thô không dùng nghiệm thu; không gọi đạt mục tiêu partial <=1,5 giây. Không có external/non-GET/unused-Whisper/page/worker error trong hai lượt; teardown cơ chế qua.

Chưa đo decode ký hiệu thật vì danh mục rỗng; không công nhận cổng hiệu năng của video ký hiệu. Chưa kiểm motor Android/iPhone, micro/cảm xúc người thật, accuracy hoặc 30 phút trên image mới. Public chưa cập nhật.
