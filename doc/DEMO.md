# Trình diễn SignEmo

## Chuẩn bị

Chạy `npm ci`, `npm run assets:prepare`, `npm run build`, `npm run preview`. Trên PC mở localhost; Android cần bản HTTPS theo DEPLOYMENT.md. Chọn Chuẩn bị dùng ngoại tuyến, đợi hoàn tất. Đóng/mở lại khi ngắt mạng trước buổi demo. Để mặc định 0,65 / 500 ms / 3 giây; chọn phòng đủ sáng. Người trình diễn và người đối diện đều từ 18 tuổi và đồng ý. Không quay lại cuộc trò chuyện khi chưa có đồng ý riêng.

## Kịch bản 3–5 phút

1. Tổng quan: giải thích icon/rung là gợi ý biểu cảm quan sát được; chưa chứng minh cảm xúc hay ý định.
2. Luyện tập: thử bốn nhịp, nêu trung tính/không rõ không rung. Trên PC dùng vòng tròn mô phỏng; trên Android hỏi người dùng có cảm nhận motor thực sự không.
3. Camera: đánh dấu đồng ý rồi bắt đầu. Giữ mặt thẳng, thử biểu cảm theo khả năng tự nhiên, chờ ổn định. Giữ nguyên để cho thấy không rung lặp.
4. Ra khỏi khung rồi đưa hai mặt vào: ứng dụng phải bỏ gợi ý khi detector nhận điều kiện không hợp lệ. Không cam kết detector nhận ra mọi mặt bị che hoặc ở rìa ảnh.
5. Kết thúc phiên, xuất số đo JSON. Gửi phản hồi chỉ khi đồng ý; bản chưa cấu hình Supabase ghi rõ lưu cục bộ. Thử rút lại phản hồi.
6. Sau khi đã chuẩn bị offline: ngắt mạng, đóng/mở lại và chạy camera. Nêu lần đầu vẫn cần mạng.

## Nếu có lỗi

Không hỗ trợ rung: trình diễn mô phỏng và ghi giới hạn thiết bị. Camera từ chối/bận: xem thông báo, cấp lại quyền hoặc đóng ứng dụng đang dùng camera. Model lỗi/cache thiếu: khôi phục mạng, tải lại tài nguyên; không dùng kết quả cũ thay thế AI đang lỗi. Backend lỗi: giữ phản hồi trong hàng đợi, demo camera tiếp tục cục bộ.

## Video dự phòng và mốc còn lại

Chưa quay video người thật trong phiên triển khai. Trước buổi thi, ghi một video 60–90 giây trên chính Android kiểm thử, có đồng ý riêng và không chứa thông tin cá nhân. Chú thích thiết bị, model, điều kiện sáng và ngày đo; không cắt ghép để che lỗi hoặc biến fixture thành pilot. Lưu video ngoài Git, trong vùng lưu trữ được bảo vệ theo PILOT.md. Ảnh giao diện QA tại `output/playwright/` chỉ minh họa giao diện.

Mốc 0 đã chuẩn hóa; mốc 1 đã chạy model thật trong Chromium nhưng chờ Android; mốc 2 đã có PWA/offline; mốc 3 đã có code, migration và kiểm thử nhưng chờ hosted Supabase; mốc 4 mới qua kiểm thử tự động và fixture; mốc 5 cần tuyển người; mốc 6 có kịch bản, còn video thật và diễn tập trên thiết bị.
