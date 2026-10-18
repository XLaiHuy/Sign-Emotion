# Thiết kế SignEmo

## Hội thoại và sân khấu ký hiệu — 18/10/2026

Cột trái camera/điều khiển và phụ đề; cột phải nét mặt/nhịp gọn ở trên, ký hiệu theo câu ở dưới. Player độc lập vùng cuộn chữ, toàn bộ thân/tay trong khung, nút ngoài hình và phóng to giữ một player. Cột phải khoảng 40% khi đủ rộng; màn hẹp xếp một cột, không remount camera. Khám phá câu mẫu tách transcript, ghi số asset phát được thực tế. Lưu và trạng thái lưu đặt cạnh điều khiển phiên, mở kho tại chỗ. Copy ngắn, lỗi có cách thử lại; chẩn đoán kỹ thuật ở localhost `?diagnostics=1`. Các mục lịch sử bên dưới được thay khi mâu thuẫn với bố cục này.

## Tăng diện tích màu — 18/10/2026

Nền vùng avatar dùng 7 pastel riêng, nhãn đặc màu semantic/chữ trắng 18px, viền vùng 2px và swatch chú giải 20px. Badge câu đủ điều kiện dùng nền semantic/chữ trắng 16px; phụ đề vẫn chữ tối. Tắt màu và chưa rõ giữ nền thường, không flash. Không đổi hue mapping hoặc nguồn quyết định. Màu phải đi kèm tên/icon và tương phản >=4,5:1.

## Đầu 3D và màu — 18/10/2026

Panel mặt có một đầu 3D cách điệu và nhãn “Nét mặt: …”, không có avatar thứ hai ở kết quả câu. Chuyển 450 ms một lần, tối đa 30 FPS, không idle loop, không thêm tay hoặc lip-sync. Giảm chuyển động dùng pose tĩnh; mất nguồn/lỗi/quá tải dùng chưa rõ/SVG. Màu ở nhãn/viền/vùng avatar theo mặt; nhãn/viền câu theo fusion riêng, chữ tối. Chú giải 7 màu thu gọn, giải thích dài trong Giới thiệu. Nguồn mặt vui/câu buồn phải đọc được độc lập, không màu cảnh báo nguy hiểm. Đây là quyết định mới thay phần “avatar chỉ theo fusion/mặc định tắt” ở lịch sử bên dưới.

## Minh họa khi thiếu video ký hiệu — 18/10/2026

Ô thiếu asset chuyển thành “Minh họa biểu cảm”: khuôn mặt SVG hình học, tên tiếng Việt, giải thích không phải ngôn ngữ ký hiệu. Chuyển miệng/lông mày 450 ms, một lần theo cue, không loop hoặc cử chỉ tay; xem lại chủ động. Giảm chuyển động giữ hình tĩnh; mất mặt/chuyển nền về chưa rõ. Minh họa không là kết quả model mới và không ảnh hưởng nhịp/phụ đề. Giữ player ký hiệu đã xác minh khi có asset.

## Video và phản hồi mặt — 18/10/2026

Ô nhịp có tên/icon riêng cạnh thông tin nét mặt, chỉ viền ô thay đổi theo pattern. Camera/phụ đề đứng yên; giảm chuyển động bỏ nhấp nháy/biến đổi ô nhịp. Nhịp chỉ theo mặt ổn định, không theo fusion. Video ký hiệu TP.HCM là tùy chọn riêng; thiếu asset có quyền dùng thì giữ chữ/icon. Clip giới thiệu HTML5 local bấm mới tải, link YouTube dự phòng, lưu offline chủ động; WebVTT hiện là bản nháp. Chi tiết ở INTRO_FACE_CUES_20261018.md, thay các mô tả nguồn nhịp cũ bên dưới.

## Cập nhật 15/10/2026

Thay tô màu cả câu bằng chữ phụ đề tối `#24322C`, badge có icon/tên và viền trái theo fusion của đúng đoạn. Partial/chưa rõ dùng chữ thường; tắt màu giữ tên/icon. Bảng màu bên dưới dùng cho accent/badge, không cho foreground phụ đề. Không flash khẩn cấp cho Anger/Fear, không thêm cử chỉ tay avatar. Chẩn đoán và công cụ so model nằm thu gọn; không nạp asset nghiên cứu ở Hội thoại thường.

Giới thiệu mở mặc định: tiêu đề “Theo dõi hội thoại bằng phụ đề tiếng Việt.”, poster/player clip sau thao tác phát, một CTA Vào hội thoại, một dòng chuẩn bị và ba bước đồng ý/hướng camera/đọc và hỏi lại. Không auto xin quyền. Khi thiếu clip giữ poster/chữ; không chặn ứng dụng. Prompt/SRT ở DEMO_45S_STORYBOARD.md.

7 nhãn gồm Fear/Disgust. Màu câu final chỉ theo fusion đúng segment: Vui #7A5700, Buồn #245C8B, Giận #9C3428, Ngạc nhiên #9B3E73, Sợ hãi #684293, Khó chịu #4F651F, neutral/unknown #24322C. Partial dùng màu thường. Màu đi cùng icon/tên và có setting tắt. Trên nền ivory #F7F6F1, tương phản tính được tối thiểu ~5,83:1. Fear không là cảnh báo nguy hiểm, không flash toàn màn. Hai nhịp mới chưa xác minh motor thật.

Avatar 3D mặc định tắt, chỉ minh họa fusion final, chưa rõ dùng neutral. GLB do dự án tạo, 7 preset tĩnh; lazy Three.js/asset, render khi đổi trạng thái, giải phóng GPU khi ẩn/quá tải/rời màn; không animation liên tục, ký hiệu tay hoặc lip-sync. Clip minh họa AI không là bằng chứng model chạy chính xác.

Phụ đề là nội dung chính; camera giúp quan sát, sắc thái chỉ là gợi ý phụ. Hội thoại, Lịch sử và Luyện nhịp là ba mục chính. Settings, feedback, lab và admin là công cụ phụ.

Be Vietnam Pro tự phục vụ với glyph tiếng Việt, weights 400/500/600. Nền #F7F6F1, xanh rêu #426854, chữ #24322C, màu phụ #65736B, viền #DDE3DA. Body 16–18 px, nhãn >=14 px, captions 20–36 px, nút cao >=44 px. Không dùng màu/âm thanh làm thông tin duy nhất.

Caption list không tự cuộn. Có live region riêng chỉ đọc câu mới, không đọc lại toàn bộ lịch sử. Điều chỉnh cỡ chữ ngay ở panel phụ đề. Motion nhẹ 140–180 ms và reduced-motion. PC mô phỏng nhịp bằng vòng tròn/thanh nhịp; không gọi đó là motor đã rung.

Kiểm tra bàn phím, focus, 200% chữ và viewport 390 px trong browser trước nghiệm thu. Model diagnostics nằm sau disclosure. Nội dung phải nêu đúng trạng thái listening/processing/overload/unknown, không khẳng định cảm xúc hoặc ý định thật.

Sidebar desktop cuộn riêng theo chiều cao khả dụng, thẻ riêng tư nằm trong luồng. Dưới 1024px dùng menu thu gọn có Escape/giữ focus; không dành vùng cố định cho bottom navigation. Ô đồng ý đặt cạnh nút bắt đầu, kể cả trên mobile. Các panel tự xếp một cột khi thiếu chiều rộng; không truyền thông tin chỉ bằng âm thanh. Nhịp Tự động trên desktop dùng âm nhẹ cùng hình ảnh; mobile có API phù hợp ưu tiên yêu cầu rung, không khẳng định motor đã hoạt động. “Thử âm” là thao tác kiểm tra loa riêng.
