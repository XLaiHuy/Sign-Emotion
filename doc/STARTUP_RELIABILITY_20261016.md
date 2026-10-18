# Khởi tạo AI trên đường truyền chậm và Edge

## Bằng chứng và phạm vi

Ảnh người dùng cho thấy trang tải được nhưng khởi tạo AI thất bại; không đủ thông tin để kết luận là GPU, bộ nhớ hay download của đúng máy đó. Edge profile sạch trên PC có WebGPU/adapter và cuối cùng khởi tạo được v12, nên không coi mọi Edge là không tương thích. Một request Face Landmarker 3,58 MiB mất khoảng 29,4 giây trong lượt quan sát. Log tunnel có `http2: stream closed` gần thời điểm báo lỗi; ngắt stream có thể do mạng hoặc client hủy, chưa chứng minh quan hệ nhân quả với ảnh.

Source v12 có lỗi thiết kế xác định được: Gipformer gần 85 MiB tải/hash ngay trong `adapter.prepare()` của worker, trong khi `makeWorkerReady` tính cả quá trình đó vào timeout 120 giây. B0 cũng có checkpoint tải trong init. Lỗi bị các lớp catch chuyển thành thông báo chung, làm người dùng không biết phải xử lý gì.

## Sửa

- Candidate tải và xác minh Gipformer/B0/runtime GPU **trước** khi mở worker. UI hiện tổng MiB, phần đang tải và tiến độ; gói PhoBERT vẫn chuẩn bị sau lõi. Thời gian tải không bị gộp vào timeout khởi tạo worker. Bước này chưa mở camera/micro.
- Dùng cùng các cache có sẵn, không xóa vault/feedback/settings. File đã đủ và đúng checksum được giữ. Model/runtime vẫn là bộ 28 asset khoảng 314,54 MiB trước app/tone; không đổi trọng số hoặc tăng gói model để chữa lỗi khởi động.
- Tải candidate có tối đa ba lần thử mỗi file, tiếp tục bằng Range khi máy chủ hỗ trợ. Kiểm Content-Range/giới hạn bytes và SHA-256 toàn file; nếu server trả 200 thì ghi lại từ đầu, không nối trùng. Không ghi cache file dở hoặc sai hash; dừng hữu hạn và hiện lỗi mạng. Tiến độ byte cập nhật tối đa khoảng 10 lần/giây để tránh render dồn dập.
- Ghim bảy artifact Gipformer vào contract cùng revision/checksum đang phục vụ; manifest đã xác minh ưu tiên cache. Worker khởi tạo từ file đã chuẩn bị, thay vì tải thêm một gói giấu trong trạng thái “đang khởi tạo”.
- Mã lỗi worker được chiếu sang allowlist: timeout, network, storage, integrity, GPU, WebAssembly, memory, worker. Trang Giới thiệu và Hội thoại hiển thị thông báo cố định theo nhánh; audit chỉ ghi branch/reason an toàn, không exception text, audio, frame hoặc phụ đề.
- Nếu nhánh mặt tăng tốc lỗi, người dùng có thể bấm **Dùng chế độ tương thích**. B0 giữ nguyên, đổi sang WASM có thông báo rõ; không chuyển âm thầm, không tải B2, không tự xin quyền thiết bị. Lựa chọn áp dụng trong phiên trang hiện tại; không đổi schema cài đặt hoặc API feedback.

## Kiểm chứng

`npm run check` qua 199 tests/56 files, lint/boundaries 98 modules, typecheck, checksum 13 core face + 25 conversation assets và production build; format-check qua. Contract Gipformer đối chiếu đủ bảy entry với manifest artifact đang chuẩn bị. Regression kiểm stream tiến triển vượt 120 giây bằng fake clock, tải nối Range và checksum, retry hữu hạn, hủy/corrupt, thứ tự chuẩn bị trước worker, thông báo không lọt exception, và retry B0/WASM không mở thiết bị.

Một test lifecycle cũ chờ dòng “đã sẵn sàng” trong năm log gần nhất bị ảnh hưởng bởi việc gộp log; đã đổi sang kiểm nút Bắt đầu enabled sau consent, giữ nguyên kiểm dừng worker khi ẩn trang. Không nới timeout hoặc bỏ kiểm thử lifecycle.

Các kết quả Docker/Edge/public được ghi ở VERIFICATION.md. Không dùng các kiểm tra startup này để khẳng định chất lượng ASR, Fear/Disgust/Sad/Angry, latency hội thoại hoặc Android. Khả năng lỗi khác trên profile thật của máy báo lỗi vẫn cần phân biệt bằng thông báo/audit mới.
