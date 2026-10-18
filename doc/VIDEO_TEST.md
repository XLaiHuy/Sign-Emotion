# Kiểm thử video đồng bộ

Phòng kiểm thử phát video local ở tốc độ 1×. YouTube chỉ là video tham khảo: nội dung trong iframe không được đọc, thu lại hoặc đưa vào AI. Người kiểm thử cần chọn tệp local tương ứng; video, audio, phụ đề và kết quả tạm chỉ tồn tại trong phiên trình duyệt.

## Luồng xử lý

- Video preview chạy độc lập với face inference. Khi được trình duyệt hỗ trợ, `requestVideoFrameCallback` cấp mốc media; bộ điều phối chỉ chạy một lượt nhận diện mặt cùng lúc và giảm sampling từ 5 xuống 2 hoặc 1 lần/giây khi thiết bị bận.
- Audio đi từ `HTMLMediaElement` qua Web Audio và AudioWorklet, được đổi thành mono 16 kHz, chia đoạn bằng Silero VAD rồi nhận dạng bằng Whisper tiny q8. Mốc sample được ánh xạ về đồng hồ media của video.
- PhoBERT chỉ phân tích câu đã chốt. Fusion yêu cầu bằng chứng văn bản và khuôn mặt cùng đủ điều kiện, cùng ủng hộ một nhãn; kết quả chưa đủ rõ vẫn là “Chưa xác định”. Không tự phát nhịp trong Phòng kiểm thử.
- Tua làm tăng epoch media; các đoạn ASR và face evidence ở epoch khác nhau không được ghép. Khi dừng hoặc rời trang, worker, audio capture và URL tạm được giải phóng.
- Nhật ký chỉ lưu mã thao tác, thời gian và metadata allowlist. Không lưu URL tham khảo, tên tệp, media, transcript, landmarks hay nhãn theo câu.

## Giới hạn và cách đánh giá

Timestamps audio được quy đổi từ đồng hồ sample 16 kHz với điểm neo lúc phát/seek. Đây là baseline cần đo trên trình duyệt thực, nhất là khi clip có seek liên tục hoặc audio/video lệch đồng bộ. Một kết quả tổng hợp là gợi ý quan sát, không phải xác suất thật về cảm xúc hay ý định.

Trước khi thay model hoặc đổi cấu hình VAD, chạy cùng video có transcript tham chiếu và ghi riêng WER/CER, RTF, p50/p95 độ trễ, FPS khuôn mặt, độ dài hàng đợi và RAM. Không có nhãn tham chiếu thì chỉ báo hiệu năng, không kết luận độ chính xác.
