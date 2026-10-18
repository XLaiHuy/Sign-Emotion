# Avatar nét mặt, màu và nghiên cứu ký hiệu câu — 18/10/2026

## Triển khai

- Một avatar đầu 3D theo mặt hợp lệ/ổn định, 7 pose minh họa mắt/mày/miệng từ GLB do dự án tạo (110.744 byte). Không đổi trọng số, preprocessing, ngưỡng, fusion hoặc nhịp. Không làm avatar tay giả.
- Chuyển 450 ms, render tối đa 30 FPS trong chuyển động; dừng khi tĩnh. Dùng lại buffer miệng, không tạo geometry mỗi frame. Mất nguồn/chuyển camera/nền/Finish giải phóng renderer. GPU/context lỗi hoặc cadence thấp/RTF >0,8 dùng SVG.
- Mặc định bật 3D khi chưa có setting, giữ lựa chọn false đã lưu. Nhãn/viền/vùng minh họa dùng bảng màu hiện có; caption tối, badge/viền chỉ theo fusion cùng câu. Chú giải thu gọn, có tắt màu; Fear không là cảnh báo nguy hiểm.
- `SignPhrase` và bộ khớp nguyên câu giữ nguyên số/phủ định/tên/dấu tiếng Việt; chỉ NFC, hoa/thường, khoảng trắng và dấu câu được chuẩn hóa. Catalogue production rỗng; không hiện nút phát khi chưa có động tác được duyệt. Không đổi API feedback, vault hoặc ghi thêm hội thoại.

## Nghiên cứu nguồn ký hiệu

[VSL-GH](https://github.com/nguyentheanh822/Vietnamese-Sign-Language-Translation) tại revision `6c351e63c0b2cf1b5e2e8056bb3bf2d6f31dc90a`: đã đọc nguồn thực tế, tải README/LICENSE/metadata và 2 mẫu keypoint bằng `scripts/research-sign-phrases.mjs`. Tổng tải 4.548.135 byte trong `output/research-assets/vsl-gh`, ngoài bundle; từng file có checksum/nguồn ở `inspection.json`. Upstream cung cấp MIT; chưa xác minh tuyên bố vùng TP.HCM, sự đầy đủ của chuyển động hoặc nghĩa khi retarget.

| Mẫu | Nội dung upstream | Dữ liệu | Trạng thái |
|---|---|---|---|
| SENT064_S01_R01_F | Xin viết ra giấy giúp tôi. | float32 (100,411) | Ứng viên hội thoại, chưa duyệt vùng/nghĩa/rig |
| SENT091_S01_R01_F | Bác sĩ đo lại giúp tôi được không? | float32 (132,411) | Khác chủ đề cơ bản, chưa duyệt |

Các file là keypoint ảnh (137×3/frame), chưa phải rotation/rig hoạt họa thân–tay–ngón. Không thể gọi “đủ keypoint” là bằng chứng giữ đúng hình bàn tay hoặc ngữ pháp nét mặt. Không tải cả bộ hoặc nạp dữ liệu này vào browser sản phẩm. **0 câu được duyệt**.

[SignAvatar](https://github.com/dongludeeplearning/SignAvatar) tạo động tác mức từ từ ASL3DWord; checkpoint/dataset cần yêu cầu riêng, repo ghi CC BY-NC 4.0. Chỉ tham khảo phương pháp, không thay bằng ký hiệu Việt, không phát thư xin dữ liệu tự động. Chưa có checkpoint tiếng Việt nguyên câu phù hợp được xác minh trong lượt này.

## Bằng chứng và giới hạn

Regression GLB thực tế kiểm tra 7 pose khác nhau, buffer dùng lại và hữu hạn; UI kiểm tách nguồn/màu tắt/mất nguồn/GPU lỗi/quá tải; matcher kiểm số/phủ định/tên và chặn dữ liệu chưa duyệt. Chrome harness local `output/playwright/avatar-preview-qa.js` đã hiện đủ 7 pose trên một canvas; đứng yên không tăng draw, face Vui vàng/caption Buồn xanh lam độc lập, giảm chuyển động và mất context về 2D, dừng còn 0 canvas. Ảnh `avatar-*.png`/`avatar-layout-*.png` trong output/playwright. Đây là kiểm trình bày bằng fixture, không là accuracy hoặc kiểm motor thật.

`npm run check` qua **264 test/74 file**, lint 114 module, typecheck, checksum và production build; log `output/research-evaluation/avatar-3d-check.log`. Lint/format-check cuối qua. Docker mới `signemo:avatar-face-20261018` healthy, `/healthz` 200, local 8095. Image cũ `signemo:media-face-20261018` giữ để rollback, public không đổi.

### A/B 120 giây trên Docker, cùng fixture

Mỗi lượt có warm-up 30 giây, B0/WebGPU + MediaPipe CPU + Moonshine two-thread + text; tone tắt. Avatar dùng đúng một canvas trong lượt bật.

| Số đo | Tắt 3D | Bật 3D |
|---|---:|---:|
| Cadence mặt | 4,998 Hz | 5,007 Hz |
| Nguồn thấp nhất/cửa sổ 10s | 20 Hz | 19,9 Hz |
| Cửa sổ đạt >=4,5 Hz và nguồn >=10 Hz | 12/12 | 12/12 |
| p95 nhãn fixture, gồm dwell/render | 355,9 ms | 330,4 ms |
| RTF hiệu dụng, gồm partial | 0,164 | 0,129 |
| Final queue peak | 0 | 0 |
| Peak process private committed | 2.759.319.552 B | 2.830.442.496 B |
| Coverage bộ đo memory | 178,41 s | 184,61 s |
| Canvas sau Finish | 0 | 0 |
| CDP inference target sau mốc chờ 6s | 1 | 0 |

Bộ nhớ private +**2,58%**; không là physical RAM/VRAM, không chứng minh không leak. Lượt bật đạt mechanical checks: Finish có 0 worker Window/CDP/pthread, 0 track, 0 AudioContext và 0 avatar canvas; 0 page error, 0 request ngoài origin/non-GET. **Lượt tắt chưa qua toàn bộ lifecycle** vì một target speech-moonshine còn được CDP báo sau 6s; Window workers/track/context đã 0. Giữ nguyên lỗi và raw report, không đánh dấu mọi cổng A/B đều đạt. Không sửa adapter/model trong lượt này. Chênh lệch tốc độ một lượt mỗi cấu hình không chứng minh 3D làm inference nhanh hơn.

Raw hợp lệ về nguồn: `avatar-off-source-fixed-120s.json`, `avatar-on-source-fixed-120s.json` trong output/research-evaluation. Cả hai vẫn có clock audio lệch, **không nghiệm thu latency partial/final**. Chưa chạy 30 phút bản mới hoặc Android thật.

Lượt trước (`avatar-off-120s.json`/`avatar-on-120s.json`) giữ làm chẩn đoán: lượt bật có nguồn video cũng tụt xuống 1 Hz, không đủ điều kiện đo mục tiêu mặt 5 Hz; không kết luận avatar gây giảm tốc chỉ từ lượt đó. Harness đã đổi canvas sang `captureStream(0)`/`requestFrame()` ở 20 Hz và ghim browser benchmark tránh background/occlusion throttling; không đổi chính sách trình duyệt sản phẩm. Đo lại cả bật/tắt theo cùng harness như bảng trên.

### Cache và trình bày production

Chrome trên Docker: GLB 110.744 byte và chunk avatar 613.003 byte tải được từ cache khi offline (HTTP 200), chú giải mở bằng bàn phím Enter, không tràn 390 px. Script `output/playwright/avatar-production-cache.js`, ảnh `avatar-production-idle-mobile.png`. Đây là kiểm asset cache và UI; không coi là lượt nghiệm thu cold-start toàn bộ ASR offline mới. Chưa xác minh motor, cảm xúc người thật hoặc ngôn ngữ ký hiệu.

GLB giữ nguyên SHA256 `dc8ff88613ea7380eae6d4f878907547e0af13689888d48fda71fed721ed650e`; không thêm model AI. Bật 3D trong Tùy chọn nếu thiết bị đã lưu false từ bản cũ. Không tự ghi đè lựa chọn này.
