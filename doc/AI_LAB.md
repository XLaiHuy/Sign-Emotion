# Kiểm thử video, nhịp PC và cải thiện neutral–sad

EmotiEffLib `enet_b0_8_best_afew` hiện là model mặt mặc định trong worker cục bộ. Chưa có clip người thật có nhãn/đồng ý để chứng minh recall sad/angry tốt hơn FER+. Đã có công cụ chẩn đoán, hiệu chỉnh và huấn luyện; không giảm ngưỡng mặc định để tạo cảm giác nhận được nhiều biểu cảm hơn.

## Cập nhật phản hồi mặt và phụ đề tạm — 12/10/2026

- Nhãn mặt và nhịp mặt có hai bộ ổn định: 200 ms để cập nhật nhãn; 400 ms trước khi phát nhịp. EMA dùng hằng số thời gian 150 ms thay vì trọng số cố định theo số frame. Khoảng lấy mẫu 1 Hz không reset ứng viên chỉ vì vượt một giây; mất mặt, nhiều mặt, đổi camera và chất lượng kém vẫn xóa ứng viên.
- Kết quả mặt cũ hơn 750 ms bị từ chối. Camera bắt đầu ở 5 Hz; nếu scheduler hạ còn 2/1 Hz thì không thể coi là đạt mục tiêu p95 700 ms. Chưa đo mục tiêu này trên webcam thật.
- Pose từ transformation matrix của MediaPipe dùng để kiểm tra yaw/pitch/roll ban đầu ±30°/±20°/±25° và hiệu chỉnh roll crop. Test dùng ma trận tổng hợp; cần đối chiếu quy ước và góc thực trên camera/video có nhãn.
- Phụ đề tạm có thể bắt đầu sau 800 ms tiếng nói và cập nhật theo cửa sổ mới nhất. Đây là giải mã cửa sổ lặp lại bằng Whisper tiny, không phải streaming decoder. Bản cuối ưu tiên; đầu ra lặp bất thường hiện “Chưa nghe rõ” và không lưu như transcript đáng tin.
- Whisper tiny là model đa ngôn ngữ, chưa được fine-tune riêng cho tiếng Việt. `language=vietnamese` chỉ điều khiển giải mã. PhoWhisper/Gipformer chưa được tích hợp hoặc benchmark đủ tiêu chí nên không thay mặc định.

Các thay đổi này giảm thời gian chờ UI và sửa bộ lọc bị kẹt ở cadence thưa; chúng không chứng minh sad/angry chính xác hơn. Cần benchmark webcam PC và tập tiếng Việt có nhãn, tách người tham gia.

## Thử nhịp trên PC

Mở **Cài đặt → Chế độ nhịp phản hồi → Mô phỏng — dành cho PC**, rồi vào **Luyện nhịp rung**. Vòng tròn bật/tắt và thanh thời gian thể hiện đúng rung/nghỉ. Camera, video và luyện tập dùng chung bộ phát. Tự động thử Vibration API và mô phỏng; Tắt ngăn cả hai. API chấp nhận không chứng minh motor rung. Trung tính/không rõ không phát nhịp; chuyển trang/nền hủy timer. Video chỉ phát nhịp khi xem ở 1x; đánh giá hàng loạt chỉ ghi sự kiện logic.

## Kiểm thử video

1. **Cài đặt → Mở phòng kiểm thử video**. Chọn MP4/WebM có codec trình duyệt đọc được và thời lượng hữu hạn; nên dùng clip ngắn.
2. Gán nhãn từng đoạn theo giây, dạng `[bắt đầu, kết thúc)`, không chồng lấn. Đoạn chưa gán nhãn hoặc Bỏ qua không tính metric. Nhãn mô tả biểu cảm quan sát được, không khẳng định cảm xúc bên trong.
3. Phát video xem điểm gốc/EMA, nhãn và lý do. Tua làm lại dwell; kết quả đang xử lý không được áp dụng sau đổi nguồn.
4. **Đánh giá tuần tự 5 mẫu/giây** tua đến 0, 200, 400…ms, chờ từng inference, không bỏ frame do máy chậm, không phát motor. Giới hạn clip 2 giờ để giới hạn bộ nhớ.
5. Xuất/nhập nhãn JSON; xuất CSV/JSON gồm điểm model, nhãn, lý do, sự kiện và confusion matrix. So sánh các phiên bản bằng cùng clip/nhãn/settings.

Video không upload/cache/IndexedDB. Nhãn/log ở RAM đến khi xuất thủ công; đổi file/rời trang giải phóng video. Mở lại cần chọn lại file. YouTube chỉ phát tham khảo sau bấm mở, cần mạng, không trích frame hoặc train từ iframe.

## Hiểu lỗi bỏ sót buồn

- Sad đứng đầu nhưng `low-score`: thử ngưỡng riêng trên validation.
- Neutral đứng đầu: giảm ngưỡng sad không đổi thứ tự; cần kiểm tra crop/ánh sáng và thử model phụ với dữ liệu thật.
- `stabilizing`: chưa đủ dwell; `cooldown`: đang nghỉ nhịp; `held-expression`: không lặp biểu cảm đang giữ.
- Chất lượng thấp có hướng dẫn gần mặt/nhìn thẳng/ánh sáng. Điểm EmotiEffLib và model phụ không phải xác suất cảm xúc đã hiệu chuẩn.

## Dataset nghiên cứu riêng

Chỉ bật **Xuất đặc trưng cho nghiên cứu riêng** khi có đồng ý riêng cho ghi/xử lý/huấn luyện và vùng mã hóa offline, không cloud backup. Mã giả danh không chứa tên/email. Hạn lưu tối đa 30 ngày. Chọn split trước hiệu chỉnh; cùng người chỉ thuộc một split. Chạy lại đánh giá sau khi bật.

Dataset gồm 52 blendshape theo thứ tự cố định, điểm classifier 8 lớp theo thứ tự nội bộ SignEmo, thời gian, nhãn và consent/split/model metadata; giữ cả frame không hợp lệ/ignore để replay bộ lọc đúng. Trường JSON cũ `ferScores` được giữ để tương thích nhưng giờ mang điểm đã ánh xạ từ EmotiEffLib. Không có ảnh, landmarks hoặc audio. Đặc trưng vẫn là dữ liệu nghiên cứu nhạy cảm. Script không tự mã hóa ổ đĩa. Rút lại/hết hạn phải xóa clip, dataset, parity file và bản sao; xem lại nhu cầu retrain model đã học từ dữ liệu được rút lại.

## Huấn luyện CPU → ONNX

Python 3.11, môi trường riêng `.venv`; thư viện ghim trong lock. Đường dẫn `E:\SignEmoResearch` bên dưới chỉ là ví dụ: thay bằng vùng nghiên cứu đã mã hóa thực của bạn.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r scripts/requirements-research-lock.txt

.venv\Scripts\python.exe scripts/research_model.py calibrate --data E:\SignEmoResearch\val1.json E:\SignEmoResearch\val2.json --out E:\SignEmoResearch\profile.json --encrypted-output-confirmed

.venv\Scripts\python.exe scripts/research_model.py train --data E:\SignEmoResearch\train1.json E:\SignEmoResearch\train2.json E:\SignEmoResearch\val1.json E:\SignEmoResearch\val2.json --out E:\SignEmoResearch\model-v1 --version neutral-sad-v1 --encrypted-output-confirmed

.venv\Scripts\python.exe scripts/research_model.py certify --model E:\SignEmoResearch\model-v1\neutral-sad.onnx --manifest E:\SignEmoResearch\model-v1\manifest.json --data E:\SignEmoResearch\test1.json E:\SignEmoResearch\test2.json --out E:\SignEmoResearch\model-v1\manifest-tested.json --encrypted-output-confirmed
```

MLP `52→64→32→2`, ReLU/Adam, CPU, seed17. Sampling cân bằng người/lớp; chuẩn hóa chỉ fit train và nằm trong ONNX. Validation chọn checkpoint/ngưỡng/margin. Xuất graph ONNX chuẩn Sub/Div/MatMul/Add/Relu/Softmax, không pickle/custom operator; kiểm parity PyTorch/ONNX. Parity file chứa đặc trưng validation, phải giữ cùng vùng mã hóa.

Train từ chối test data. Certify từ chối người đã có trong train/validation. Chỉ approve khi có ít nhất 2 người mỗi split, test đủ 8 lớp theo hợp đồng SignEmo làm đối chứng, validation đạt và test đạt đồng thời: recall sad tăng, precision sad không giảm, neutral bị gọi sad và nhịp sai/phút không tăng, macro-F1 không giảm. Báo coverage/support và kết quả từng người. Đây là tối thiểu cho thử nghiệm, không chứng minh khả năng khái quát hoặc lợi ích giao tiếp. Certify đánh dấu test đã tiêu thụ; không dùng test để chỉnh. Vòng mới cần test độc lập, tối đa hai vòng rồi xem lại dữ liệu/phạm vi.

Nạp manifest + ONNX trong lab để kiểm checksum/hợp đồng. Model phụ chưa approve chỉ chạy thử trong lab; gói đã approve có nút bật camera trong phiên hiện tại, mở app lại phải nạp lại. Model phụ chỉ quyết định neutral/sad khi EmotiEffLib đứng đầu thuộc cặp đó. Nhãn khác theo EmotiEffLib; lớp ngoài phạm vi bị từ chối, điểm model phụ chưa đủ → chưa xác định. Nút bỏ model phụ giữ EmotiEffLib hiện tại.

## Offline và feedback

Tải khoảng 74MiB, có byte/progress/hủy/thử lại; tài nguyên đã kiểm tra giữ để tiếp tục. Sẵn sàng cần cache app shell, model/runtime và service worker điều khiển trang. Thử bằng production build/preview. Gói model phụ ở RAM không tự cache.

Feedback mặc định local-only; muốn gửi phải chọn gửi, đọc đích Supabase và đồng ý riêng. Chỉ rating/nhận xét/thống kê tổng hợp đi lên server. V1 queued không chứng minh được quyền gửi chuyển local-only; cấu hình server sau này không tự gửi chúng. Sent giữ trạng thái; withdrawing xóa nội dung local, giữ mã/đích để thử lại. Đổi server không tự chuyển quyền gửi. Với bản cũ chưa xác minh đích, dùng mã xóa và đúng project cũ.

Xóa local-only xóa nội dung IndexedDB. Xóa bản trên máy của báo cáo đã gửi không xóa server; dùng Rút lại để xóa server. Offline lưu yêu cầu rút, chỉ hiện Đã rút lại khi server xác nhận. Xóa cache/trình duyệt có thể làm mất mã xóa, nên tải receipt của bản đã gửi.
