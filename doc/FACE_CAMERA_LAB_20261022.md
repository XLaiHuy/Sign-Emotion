# Chẩn đoán webcam và thử tiền xử lý B2 — 22/10/2026

## Phạm vi

Diagnostics cạnh camera giải thích không thấy mặt, nhiều mặt, chất lượng ảnh, góc mặt, điểm thấp, chờ ổn định và kết quả muộn. Hướng dẫn chỉ đổi khi một nguyên nhân giữ ít nhất 700 ms; số đo chi tiết cập nhật tối đa mỗi 250 ms theo khung mới. Timer được hủy khi dừng. Phần này chỉ đọc kết quả, không tạo nhịp hoặc thay PredictionGate.

Độ sáng/tương phản/Laplacian lấy từ crop chất lượng RGB 64×64 trước bù sáng; góc là ước lượng yaw/pitch/roll của MediaPipe. Độ trễ gồm capture → nhận kết quả ở main thread. Bộ đếm theo lý do và số đo chỉ ở RAM của phiên, không vào Settings, vault, audit hoặc API báo cáo. Crop/tensor/landmark không được lưu bởi diagnostics. Disclosure hiển thị kích thước input thực tế và phiên bản tiền xử lý, không ghi cứng 224.

## Lab localhost

Mở **Cài đặt → Mở phòng kiểm thử video → Đánh giá theo nhãn và công cụ nghiên cứu**, bật **Thử tiền xử lý B2 trên localhost**. Lựa chọn mặc định tắt, mất khi rời Lab, không lưu Settings. Chỉ các hostname `localhost`, `127.0.0.1`, `::1` được chấp nhận; worker tự kiểm hostname của chính nó, không tin hostname do UI gửi. Bản public không hiển thị lựa chọn này và worker từ chối các thử nghiệm.

| Lượt | Detector | Ngưỡng biểu cảm | Tiền xử lý |
| --- | --- | --- | --- |
| Baseline | 0,60 | 0,55 | `roll-crop-v1` |
| Crop hai mắt | 0,60 | 0,55 | `eye-crop-v2` |
| Bù sáng | 0,60 | 0,55 | `rgb-gamma-085-v1` |
| Detector | 0,50 | 0,55 | `roll-crop-v1` |
| Biểu cảm | 0,60 | 0,50 | `roll-crop-v1` |

Các lượt dùng B2 RGB 260×260/CPU-WASM, bỏ qua model phụ và hồ sơ hiệu chỉnh để không trộn yếu tố. EMA, dwell, cooldown và các Settings khác giữ giống nhau. Thay cấu hình dừng worker, xóa kết quả đánh giá cũ. JSON đánh giá local ghi cấu hình/ngưỡng thực sự dùng; API báo cáo máy chủ không đổi.

Crop thử nghiệm quay landmark về hệ tọa độ hai mắt, tính bounds rồi lấy hình vuông padding 8%; đảo mắt do ảnh gương không làm crop lộn ngược. Góc yaw/pitch/roll vẫn giới hạn 30°/28°/25°. Crop thử vượt biên bị loại, không dựng lại vùng thiếu. Baseline giữ nguyên công thức bounds và thao tác canvas cũ.

Gamma dùng LUT `255 * (v / 255)^0.85`, chỉ sửa RGB của buffer crop trong worker sau khi chất lượng gốc qua kiểm tra và brightness 35–80 (bao gồm biên). Alpha/preview giữ nguyên; ảnh tối nặng, cháy sáng, ít tương phản hoặc nhòe nặng vẫn bị loại. Không thêm CLAHE/OpenCV, dependency hoặc model. Luồng client vẫn chỉ cho một capture/inference đang chạy.

## Kiểm chứng tổng hợp

Harness production riêng, không đưa vào PWA:

```powershell
npx vite build --config scripts/face-benchmark.config.mjs
npx vite preview --config scripts/face-benchmark.config.mjs --host 127.0.0.1 --port 4187
# Mở /tests/browser/face-preprocessing.html
```

Chrome 155 / Windows, worker OffscreenCanvas, nguồn RGB tổng hợp 640×480, roll 0,2 rad, crop 260; 30 vòng warm-up +150 mẫu mỗi cấu hình, thứ tự xen kẽ, không build trong lúc đo. Pixel, tensor float32, quality statistics và quyết định baseline bằng chính xác công thức trước thay đổi trên fixture này. p95 (ms): trước thay đổi **14,1**, baseline diagnostics **14,6**, crop hai mắt **14,7**, gamma **16,1**. Mức tăng lớn nhất **2,0 ms**, dưới ngân sách +10 ms. Log: `output/face-preprocessing-browser.log`; đây là chi phí tiền xử lý tổng hợp, không phải tốc độ inference/webcam hoặc bằng chứng accuracy.

Regression kiểm cấu hình độc lập, worker từ chối forged init public, crop xoay/phản chiếu/biên/góc vượt giới hạn, gamma/quality/alpha, UI chống nhấp nháy, bộ đếm RAM và không phát nhịp từ khung bị loại. `npm run check` qua 311 test/89 file; thêm hai test Lab qua riêng, tổng 313 test/90 file. Format check qua. Production UI qua desktop/mobile với worker thật và camera/micro tổng hợp. Cả năm cấu hình B2/MediaPipe đã chạy offline, mỗi cấu hình ba khung NASA ghép công khai (một/hai/không mặt), lọc và metadata đúng. Không suy accuracy từ các khung này. Logs và các lượt bị loại ở `VERIFICATION.md`.

## Giới hạn nghiệm thu

Chỉ kiểm thử tự động, không dùng camera/micro người thật. Chưa có tập gán nhãn tách theo người/phiên để đo bỏ sót, gợi ý sai, precision/recall, coverage hoặc chọn ngưỡng production. Không tuyên bố tăng độ chính xác. Model/checksum/license giữ nguyên manifest; mọi thử nghiệm mặc định tắt. Chưa đo Android, pin, nhiệt hoặc motor vật lý.
