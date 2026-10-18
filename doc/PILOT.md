# Pilot và dữ liệu nghiên cứu SignEmo

## Tuyển người và đồng ý

Hiện chưa có đối tác pilot. Chủ dự án tự liên hệ hội/CLB/tổ chức, không gửi thông điệp thay họ khi chưa được yêu cầu. Mục tiêu thử thăm dò 5–10 người khiếm thính trưởng thành; có hỗ trợ ngôn ngữ ký hiệu nếu họ cần. Tham gia tự nguyện, không ảnh hưởng học tập/công việc; có thể dừng và rút lại. Người đối diện cũng đồng ý camera. Không tuyển trẻ vị thành niên cho MVP này.

## Kịch bản so sánh

Chuẩn bị tình huống hội thoại tương đương, tránh chỉ diễn nét mặt cực đoan. A: phụ đề đơn thuần; B: phụ đề+mặt/text; C: phụ đề+mặt/text/tone. Đảo thứ tự ABC/BCA/CAB, giữ tương đương người đối thoại, ánh sáng, nội dung và có nghỉ giữa phiên. Chỉ chạy C khi tone đã qua cổng kỹ thuật/chất lượng; nếu chưa thì thử A/B, không dùng kết quả giả. Sau mỗi phiên đo hiểu nội dung, hiểu sắc thái, nhịp sai/phân tâm, mức tự tin và mong muốn dùng lại. Không tự suy diễn rằng người khiếm thính thiếu khả năng nhìn biểu cảm; quan sát không AI có thể dùng làm bài đầu vào riêng.

Ghi riêng tỷ lệ nhận đúng sáu nhịp (Vui, Buồn, Giận, Ngạc nhiên, Sợ hãi, Khó chịu) trong bài 8 lượt, số gợi ý không mong muốn, số lần người dùng chủ động hỏi lại. Trung tính và Chưa xác định không rung. Người tham gia quyết định gợi ý có ích không; nhãn AI không phải chân lý về cảm xúc. Pilot nhỏ không đủ để công bố giảm hiểu lầm 40–60%, cải thiện năng suất hoặc tác động lâm sàng.

## Buổi thu clip riêng

App bình thường không có chức năng ghi hình. Buổi nghiên cứu dùng công cụ ghi hình **offline riêng**, trên PC kiểm soát, sau khi có đồng ý riêng cho ghi/lưu/xử lý dữ liệu. Không bật cloud backup, không dùng tài khoản đồng bộ thư mục ảnh; không ghi audio nếu không có mục tiêu/đồng ý tương ứng.

Mẫu đồng ý cần có: mã người tham gia, mục đích nghiên cứu biểu cảm, loại dữ liệu/độ dài, quyền truy cập, ngày xóa (mặc định 30 ngày), quyền rút lại, đầu mối liên hệ và chữ ký/đồng ý có thể tiếp cận được. Lưu bảng định danh tách khỏi clip. Không đưa tên, số điện thoại hoặc chữ ký vào source/model dataset công khai.

Lưu clip trong vùng **đã mã hóa** trên PC (ví dụ BitLocker hoặc container mã hóa), không chỉ dựa vào `.gitignore`. Quyền truy cập chỉ chủ nghiên cứu. Thư mục `research-data/` nếu dùng phải nằm trong volume/container mã hóa; script không tự bật mã hóa ổ đĩa. Kiểm tra backup không giữ bản ngoài kiểm soát; xóa clip/bản sao khi hết hạn hoặc được rút lại, ghi nhật ký xóa theo mã giả danh.

## Đánh giá model và nhánh MLP

Đặt danh sách participant ID cho train/validation/test **trước** khi hiệu chỉnh. Không tách frame của cùng người sang nhiều split. Tách biểu cảm theo hướng dẫn với hội thoại tự nhiên. Cần thêm người đối thoại trưởng thành đa dạng cho dữ liệu biểu cảm; pilot người dùng và tập đánh giá model có thể khác nhau.

Dùng `python scripts/evaluate_predictions.py predictions.csv --out output/evaluation.json` sau khi thu các dự đoán được gán nhãn. CSV: `participant_id,split,true_label,predicted_label`; label gồm happy,sad,angry,surprised,fear,disgust,neutral; predicted có thể là uncertain. Script từ chối rò rỉ người giữa split, báo macro-F1, precision/recall từng lớp và coverage; không đo lợi ích giao tiếp. Báo cả support từng lớp; thiếu lớp thì chưa đủ bằng chứng chọn model. Công cụ fusion dùng cùng bảy nhãn, giữ dữ liệu test tách khỏi chọn ngưỡng.

Nếu baseline không đủ: trích 52 blendshape offline, huấn luyện MLP phụ neutral/sad 52→64→32→2 bằng CPU, chọn threshold trên validation và kiểm tra trên người chưa thấy. Đây là nhánh có điều kiện, chưa train vì chưa có dữ liệu được đồng ý. Tối đa hai vòng cải thiện rồi xem lại dữ liệu/phạm vi. Không dùng rule-based mapping để tự nhận là model đã được hiệu chuẩn.

## Benchmark thiết bị và buổi demo

Ghi tên máy/OS/trình duyệt, phiên bản model, settings, điều kiện sáng và thời gian. Chạy 20–30 phút; xuất số đo từ cuối phiên camera. P50/P95 hiện là thời gian xử lý/transfer/scheduling mỗi frame, **không** phải trễ từ lúc biểu cảm xuất hiện tới motor rung; đo end-to-end riêng bằng quay kiểm thử với đồng ý. Ghi nhiệt/pin bằng phương pháp nhất quán, không suy ra tiết kiệm pin từ số frame giảm.

Demo 2 phút: giới thiệu giới hạn → đồng ý → thử nhịp → camera thật → dừng và phản hồi → bật chế độ máy bay sau tải offline và thử lại. Chuẩn bị video dự phòng quay thử thật có đồng ý, ghi rõ là video dự phòng. Không dùng kết quả giả làm inference trực tiếp.

Công cụ thu đặc trưng, huấn luyện CPU/ONNX và nghiệm thu nhánh neutral–sad đã triển khai; cách dùng và giới hạn tại AI_LAB.md. Toolchain không thay thế đồng ý riêng, mã hóa và held-out data.
