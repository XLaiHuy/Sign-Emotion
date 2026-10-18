# SignEmo — hồ sơ giới thiệu SVOUSTARTUP 2026

Cập nhật 15/10/2026. MVP nghiên cứu; chưa nghiệm thu production hoặc pilot thật. Nguồn: [kiểm chứng](VERIFICATION.md), [so sánh model](MODEL_COMPARISON.md), [pilot](PILOT.md).

## Giá trị và giới hạn

SignEmo hỗ trợ theo dõi hội thoại tiếng Việt bằng phụ đề trên thiết bị. Icon, màu và nhịp là gợi ý sắc thái thử nghiệm, có thể sai; người dùng có thể hỏi lại. Không giả định người khiếm thính không đọc được nét mặt. Không thay thế thiết bị trợ thính, phiên dịch ký hiệu hoặc cảnh báo an toàn.

Chưa có khảo sát xác nhận quy mô nhu cầu, mức sẵn lòng trả tiền hoặc hiệu quả hỗ trợ. Không dùng số liệu “mất 70% thông điệp” thiếu nguồn. Pilot cần so với phụ đề đơn thuần.

## Bằng chứng hiện có

| Hạng mục | Đã đo | Chưa chứng minh |
| --- | --- | --- |
| ASR | 5 tệp FLEURS, 52,62 giây / 150 token: Gipformer WER 6%, PhoWhisper 16%; RTF toàn tệp 0,323 và 0,987 | WER hội thoại, validation tách người nói, độ trễ partial/final toàn pipeline |
| Classifier mặt | B0/WebGPU warm p95 41,7 ms trên tensor tổng hợp; B2/WebGPU 89,3 ms | Capture-to-label, chất lượng Sad/Angry/Fear/Disgust |
| UI | Chữ #24322c tương phản khoảng 12,38:1 trên ivory #f7f6f1 | Toàn bộ WCAG AAA, tốc độ đọc, mức phân tâm |
| Test | Bộ test/build được ghi theo từng phiên bản trong VERIFICATION | Độ chính xác model, Android, pilot hoặc độ bền thiết bị |

Không gọi thử nhỏ là SOTA. Đọc đúng build/profile: bản đối chứng PhoWhisper/B2 khác bản thử Gipformer/B0-WebGPU. 41,7 ms không phải thời gian phụ đề hoặc rung. Phụ đề ASR có thể sai số, tên và phủ định.

## Kịch bản khoảng ba phút

**0:00–0:45.** “Có người cần hỗ trợ tiếp cận lời nói trong hội thoại. Nhóm xây dựng SignEmo để chuyển tiếng Việt thành phụ đề ngay trên thiết bị. Chúng tôi muốn kiểm tra liệu gợi ý sắc thái có giúp ích thêm so với phụ đề đơn thuần hay không.”

**0:45–2:00.** “Sau khi chuẩn bị AI và cả hai người đồng ý, ứng dụng mới mở camera/micro. Chữ tạm có thể thay đổi khi câu chốt. Nét mặt hiện tại hiển thị riêng; gợi ý cạnh câu cần các nguồn đủ chất lượng và đồng thuận. Thiếu bằng chứng ghi ‘Chưa xác định’, không ép thành Trung tính. Chỉ tổng hợp đủ điều kiện mới phát nhịp. Thiết kế không gửi media/transcript lên server. Các số đo trên vài clip công khai là kiểm tra kỹ thuật, chưa phải độ chính xác chung.”

Demo đúng build đã thử. Có thể dùng bản ghi dự phòng, ghi rõ là bản ghi; không giả inference trực tiếp. Không hứa rung trên thiết bị chưa kiểm tra.

**2:00–3:00.** “Bước kế tiếp là thử với người trưởng thành tự nguyện, so sánh phụ đề với gợi ý bổ sung và đo lỗi/mức phân tâm. Nhóm tìm cố vấn về tiếp cận, đánh giá AI tiếng Việt và kết nối một nhóm thử phù hợp. Bản cá nhân miễn phí và dịch vụ tổ chức là giả thuyết kinh doanh cần kiểm chứng, chưa có doanh thu hoặc cam kết khách hàng.”

## Phản biện

- AI không xác định nội tâm. Đồng thuận nhiều nguồn vẫn có thể sai; Chưa xác định khác Trung tính.
- Local giảm truyền media và phụ thuộc mạng sau khi cache. Vẫn phải bảo vệ thiết bị, kiểm tra network/storage; không tuyên bố bảo mật tuyệt đối.
- Chọn model bằng chất lượng và độ trễ toàn pipeline. Benchmark upstream khác dữ liệu/thiết bị không giải thích nguyên nhân hơn kém; chưa đo thì không kết luận nhiệt/battery.
- Không có phí API suy luận không có nghĩa chi phí bằng 0. Có hosting/băng thông, điện, thiết bị, nghiên cứu, bảo trì và hỗ trợ. Không cam kết miễn phí vĩnh viễn.
- B2B/B2G/kiosk/ESG là hướng nghiên cứu; chưa coi là sản phẩm, đối tác hoặc doanh thu có thật.
- Test tự động qua chỉ chứng minh các trường hợp đã test; không thay validation, chạy dài hoặc pilot.
