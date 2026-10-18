# Đối chiếu nghiên cứu ký hiệu và màu — 18/10/2026

## Kết luận dùng cho SignEmo

Bài toán tạo ký hiệu có ngữ pháp nét mặt và sắc thái là hướng nghiên cứu khó. Tuy nhiên đoạn tư vấn được gửi có nhiều khẳng định không đủ căn cứ hoặc nhầm chiều tác vụ. Chưa thể dùng nó để tuyên bố SignEmo tiên phong/độc quyền hoặc chọn model sản phẩm.

| Nội dung được gửi | Đối chiếu nguồn gốc |
|---|---|
| “95% mô hình chỉ dịch từ cơ học”, chỉ bắt đầu NMM vào 2024–2025 | Chưa xác minh được thống kê hoặc tổng quan hỗ trợ. Bỏ con số và mốc tuyệt đối này. |
| EmoSign ra tháng 2/2025, là dữ liệu sinh avatar cảm xúc | [Bài gốc](https://arxiv.org/abs/2505.17090) nộp 20/05/2025: 200 video ASL có nhãn cảm xúc/sentiment và mô tả mở do ba người Điếc có kinh nghiệm phiên dịch gán nhãn. Là benchmark nhận diện, không phải checkpoint text→avatar. Không thấy hợp đồng nhãn quỹ đạo/lực tay định lượng như mô tả. |
| EmoSign tải là có tất cả video | [Dataset card](https://huggingface.co/datasets/catfang/emosign) phát hành bảng nhãn CC-BY-SA; video gốc/caption lấy từ ASLLRP, cần kiểm điều kiện nguồn đó riêng. |
| SignAvatars có 70K chuỗi/8,3M frame | Đúng gần đúng: [ECCV 2024](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/00653.pdf) ghi 70K video/8,34M frame/153 người, mesh thân–tay–mặt. Không phải dữ liệu ký hiệu TP.HCM hoặc bằng chứng điều khiển cảm xúc đã hiệu chỉnh. |
| Dataset/model SignAvatars có thể tải và đóng gói ngay | [Repo chính thức](https://github.com/ZhengdiYu/SignAvatars) yêu cầu form cho annotations để nghiên cứu phi thương mại; RGB gốc không được phân phối lại bởi repo. License website không phải license toàn dữ liệu. |
| SignDiff nhận emotion/speed rồi sinh quỹ đạo 3D mạnh hơn | [Trang dự án](https://signdiff.github.io/) mô tả pose→hình/video người ký và pipeline ASL text→pose; không xác minh được API điều kiện `emotion: angry, speed: fast` hay điều khiển lực tay như lời tư vấn. Dự án còn ghi code là tài sản công ty. `DiffuSign` theo đúng mô tả này chưa xác minh được. |
| VSL400 là 2023–2024, dữ liệu trung tính có thể lấy dùng ngay | [Preprint](https://doi.org/10.22541/au.177075292.21810740/v1) tìm được đăng 10/02/2026, ghi 74.259 clip/400 gloss/28 người, phục vụ nhận diện từ đơn. [DUA của tác giả](https://zenodo.org/records/21366957) quy định controlled access cho video và dữ liệu từ người; không xem public record là quyền đóng gói. Không suy tất cả mẫu neutral nếu không có nhãn kiểm chứng. |
| VOYA_VSL là model sinh động tác | [Dataset card/code](https://huggingface.co/datasets/Kateht/VOYA_VSL) mô tả keypoint MediaPipe cho recognition. Không phải checkpoint text→rig 3D; card ghi khoảng 161 và file theo class, không lấy đó làm số ví dụ đã kiểm đếm. |
| VSL-GH chỉ ghép video từ vựng | Sai với [repo đã khảo sát](https://github.com/nguyentheanh822/Vietnamese-Sign-Language-Translation): có metadata nguyên câu, gloss và keypoint. SignEmo đã tải hai mẫu tham khảo, nhưng chưa duyệt vùng/nghĩa/rig. Xem AVATAR_COLOURS_SIGN_RESEARCH_20261018.md. |
| Việt Nam hoàn toàn chưa có bất kỳ model/dataset phù hợp | Không có bằng chứng đủ để chứng minh phủ định tuyệt đối. Cách viết đúng phạm vi: “Trong các nguồn đã khảo sát, chưa xác minh được gói pretrained text tiếng Việt→avatar ký hiệu TP.HCM có NMM/sắc thái, quyền phân phối và hiệu năng đáp ứng SignEmo.” |
| SignEmo là dự án đầu tiên, 10 câu thành tài sản độc quyền | Chưa có khảo sát/kiểm chứng để tuyên bố đầu tiên hoặc độc quyền. Chỉ mô tả mục tiêu và phần đã thực sự tạo, nguồn và giấy phép. Hiện 0 câu đủ điều kiện, không ghi đã chuẩn hóa 10 câu. |

## Phân biệt cần giữ

- NMM gồm các thành phần phi thủ ngữ có thể phục vụ ngữ pháp và cảm xúc; nhãn 7 cảm xúc không thay thế toàn bộ NMM. Không áp mặt giận từ camera lên một câu đang ký.
- Keypoint/quỹ đạo/tốc độ không tự cung cấp lực cơ học đo được. Giữ mô tả về nhịp, biên độ và sự nhấn mạnh, không tuyên bố lực Newton từ dữ liệu không có phép đo lực.
- Nhận diện video→nhãn/chữ, text→gloss, gloss/text→pose và pose→người/avatar là các hợp đồng khác nhau. Kết quả benchmark ở một bước không nghiệm thu cả chuỗi hoặc ngôn ngữ khác.
- Không diễn giải “52 cơ mặt” như một bảo đảm từ SMPL-X/SignAvatars: cần kiểm đúng các tham số biểu cảm, rig và mapping của artifact; số lượng hệ số điều khiển không đồng nghĩa số cơ hoặc nghĩa ký hiệu đã đúng.
- Giữ lộ trình: phụ đề + avatar biểu cảm + màu; nghiên cứu retarget nguyên câu có mẫu TP.HCM được phép dùng và kiểm chứng; sau đó mới nghiên cứu biến đổi sắc thái mà vẫn giữ ngữ pháp. Không tự nối động tác thiếu hoặc huấn luyện thêm trong bản thường hiện tại.

## Màu rõ hơn trong bản local

Màu cũ chỉ nằm ở viền mảnh/chữ nhỏ trên ivory, khó nhận biết nhanh. Đã tăng vùng nền quanh avatar theo 7 sắc thái, nhãn màu đặc chữ trắng 18px, badge câu màu đặc 16px, chú giải swatch 20px. Chữ phụ đề vẫn #24322C, màu chỉ theo đúng nguồn/câu; tắt màu hoặc chưa rõ không dùng vùng màu biểu cảm. Không đổi model, inference, fusion, renderer hay nhịp. Không làm flash.

Kiểm tra tương phản 7 màu đặc/chữ trắng và nền nhạt/chữ tối >=4,5:1; kiểm browser và Docker local được ghi trong VERIFICATION.md. Public chưa đổi. Chưa có thử nghiệm với người dùng để kết luận màu được nhận biết chính xác hơn; đây là chỉnh khả năng nhìn thấy.
