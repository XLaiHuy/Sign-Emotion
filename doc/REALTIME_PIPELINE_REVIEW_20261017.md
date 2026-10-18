# Rà soát realtime — 17/10/2026

## Phạm vi và hiện trạng

Đọc source hiện tại, không suy trạng thái container/PWA từ tài liệu triển khai. `conversationProfile` phân biệt baseline (PhoWhisper/B2) và pc-candidate (Gipformer/B0). PROJECT_STATUS ghi v23 nhưng compose.public-trial còn v22; lượt này chưa đối chiếu image public hoặc cache người dùng. Không thay trọng số model, ngưỡng nhận diện, preprocessing hoặc API.

## Ràng buộc gây trễ hoặc từ chối

- MediaPipe chạy CPU, IMAGE, tối đa hai mặt, detection/presence 0,6. WebGPU của candidate chỉ áp dụng classifier B0. Detection tối đa 640×480; mặt phải rộng/cao ít nhất 90 px trên ảnh detection, nằm trong ảnh, pose yaw ±30°, pitch ±28°, roll ±25°.
- Mean ảnh 35–235, contrast ≥14. Sharpness <3 bị loại; 3–10 là cảnh báo nhòe nhẹ. Mất/nhiều mặt hoặc chất lượng không hợp lệ xóa state lọc. Không tìm thấy mặt, chất lượng bị loại và classifier đoán sai là ba vấn đề riêng.
- Threshold mặc định 0,55; EMA 150 ms; dwell thích ứng 120/200/320 ms tại setting 200 ms. Dwell được kiểm tra khi có frame tiếp theo, nên cadence 1 Hz làm nhãn chờ thêm khoảng một chu kỳ, chưa kể chuyển nhãn/EMA/capture/inference. Không coi dwell là latency toàn ứng dụng.
- Một frame đang xử lý; mục tiêu 5/2/1 Hz. Bản hiện tại loại kết quả quá 750 ms cho GPU hoặc 1200 ms cho WASM. Ngưỡng WASM này không chứng minh đạt mục tiêu nhãn 700 ms.
- Audio mono 16 kHz, VAD mỗi 512 mẫu/32 ms, ngưỡng tiếng nói 0,5, có pre-roll. Hội thoại chuẩn bị VAD với fastEndpointing=true: 13 frame im lặng =416 ms; mặc định builder/lab có thể 17 frame =544 ms. Hard-cut 94 frame khoảng 3 giây không nhất thiết là câu hoàn chỉnh.
- Gipformer dùng OfflineRecognizer CPU, một luồng, greedy_search. Mỗi partial/final tạo stream mới và giải mã cửa sổ lại; không phải streaming có state. Partial khoảng 800 ms/lượt, chỉ một inference; final ưu tiên lượt kế tiếp nhưng không ngắt được partial đang chạy. RTF tích lũy >0,8 ngừng partial; queue final tối đa ba đoạn. Điểm này cần profile tải gần đây để phục hồi tốt hơn sau một đợt chậm.
- Nhãn mặt độc lập text. Fusion chờ final, cần ít nhất hai nguồn hợp lệ đồng thuận; FaceWindow đòi ≥2 quan sát, span ≥500 ms, coverage ≥60%, IoU ≥0,4. Đây là lý do gợi ý tổng hợp có thể chưa hiện dù camera vẫn có nhãn.

## Hai tối ưu đã sửa trong lượt này

1. VAD kiểm tra deadline partial trước `snapshot()`, tránh sao chép buffer lời nói đang lớn lên mỗi 32 ms rồi bỏ bản sao. Giữ nội dung PCM, nhịp partial 800 ms, final và state Silero. Regression worker thật với ORT giả kiểm 94 frame lời nói: ba snapshot/partial ở 0,8/1,6/2,4 giây và final đầy đủ 94×512 mẫu.
2. FaceInferenceBudget yêu cầu áp lực thường kéo dài ≥1 giây trước khi giảm cadence; với timer Hội thoại 5 giây thì quyết định ở lượt kiểm kế tiếp. Queue ≥2, RTF ≥1 hoặc face p95 >1,25×interval vẫn giảm ngay. Hồi phục từng mức sau 10 giây khỏe như cũ. Regression bao gồm queue spike ngắn, quá tải kéo dài và backlog khẩn.

## Ưu tiên tiếp theo

Đo capture/detection/crop/classifier/dwell riêng; giữ mục tiêu 5 Hz khi có ngân sách, không đánh đổi bằng hiển thị frame quá cũ. Thử VIDEO với detection định kỳ và regression người thứ hai trước khi đổi IMAGE. So endpointing 416/544 ms cùng audio để tránh mất âm cuối tiếng Việt. Thử RTF cửa sổ gần đây có phục hồi partial; benchmark streaming adapter cùng dữ liệu trước khi đổi ASR. Hoãn tone/PhoBERT khi ASR bận, không âm thầm mất final. Không hạ threshold chung hoặc thêm model nặng trước khi đo.

Chưa đo lại latency, WER/F1, 30 phút hoặc Android trong lượt này. Regression cơ chế không chứng minh Angry/Fear/Disgust chính xác hơn. Source cần rebuild Docker và cập nhật PWA trước khi người dùng thấy hai tối ưu.

Regression liên quan 16/16 qua; toàn bộ Vitest 235 tests/63 files qua, lint/boundaries 102 modules, TypeScript và checksum 13 face +25 conversation qua. `npm run format:check` qua. Production build có cảnh báo module Node của Moonshine bị externalize; không dùng build thay kiểm thử adapter Moonshine trong browser.
