# Giới thiệu YouTube, phụ đề tạm ổn định và candidate bỏ B2

## Thay đổi

- Trang Giới thiệu dùng clip người dùng cung cấp: https://www.youtube.com/watch?v=g6lhRElRiWs. Poster nằm trên thiết bị; iframe và mọi kết nối YouTube chỉ xuất hiện sau thao tác xem. Dùng youtube-nocookie, controls/playsinline, ưu tiên phụ đề Việt nếu video có track tương ứng. Không tự tạo bản dịch hoặc cam kết video có phụ đề. Khi offline hiện hướng dẫn và giữ đường vào Hội thoại. Có liên kết mở YouTube nếu chủ video chặn embed hoặc trình duyệt không phát được. Không tải/copy clip, không đưa YouTube qua AI hoặc service worker cache.
- Candidate B0 không chuẩn bị/cache B2, và bước build xóa đúng file B2 khỏi `dist` cùng entry trong core manifest. Source baseline và image v10 cũ vẫn giữ để rollback; không đổi model mặc định của bản thường hoặc link public. Không có fallback âm thầm sang B2. Lab dùng đúng profile candidate, các lựa chọn B2 không khả dụng trong image này.
- Bộ ổn định partial dùng LCP theo từ NFC qua hai revision liên tiếp, trừ từ cuối có thể đang dang dở. Prefix đã đồng thuận được giữ khi cửa sổ sau chỉ trả về đoạn đầu ngắn hơn. Casing prefix ổn định, dấu câu mới và suffix vẫn cập nhật. Nếu có từ mâu thuẫn, mở lại từ vị trí đó ngay: không giấu số/phủ định ASR vừa sửa để bảo vệ một prefix cũ. Đây là **khóa mềm**, không phải văn bản đã xác nhận đúng.
- Partial đầu tiên vẫn hiện ngay, không đợi thêm một cửa sổ. Bản final thay toàn câu và đi vào lịch sử/fusion như trước; partial không thành nguồn vote, không lưu vault/audit. Reset khi đổi đoạn, final, output nghi lỗi, seek/đổi epoch hoặc kết thúc phiên. Giới hạn bộ nhớ agreement 256 token; không xóa transcript dài để làm đẹp chỉ số.

## Dung lượng

B2 là **30.779.724 byte ≈29,35 MiB**. Đây là lượng giảm riêng checkpoint; mức **+19,88 MiB** của v10 là chênh lệch ròng cả profile, không phải kích thước B2. Kiểm tra SHA-256 mới cho candidate: **28 asset, 314,54 MiB** model/runtime, giảm từ 343,90 MiB. Chưa gồm bundle ứng dụng hoặc tone tùy chọn, không đại diện RAM/VRAM. Trình duyệt nâng cấp chỉ xóa entry B2 trong cache lõi do ứng dụng quản lý; không đụng cài đặt, feedback hay vault. Nghiên cứu riêng có cache/asset khác không bị quét xóa hàng loạt.

## Thuật toán nên ưu tiên tiếp

1. **Đo clock bằng micro thật trước khi kết luận latency:** v10 còn chênh đồng hồ trên fixture ảo. LCP không sửa mất audio, timestamp hay model đoán sai. Cần mốc âm thanh tham chiếu và theo dõi capture → VAD → queue → decode → paint, tách thời gian chờ khỏi thời gian model chạy.
2. **Ngân sách partial theo tải:** giữ một inference, final ưu tiên lượt kế tiếp, latest-only partial. So tần suất 800/1.200 ms trên cùng clip; chỉ giảm tần suất nếu giảm tổng RTF mà vẫn đạt thời gian chữ đầu. Không ngắt ONNX giả định hoặc bỏ final để đạt điểm tốc độ.
3. **Đo độ giật chữ:** thêm normalized edit distance giữa các revision, tỷ lệ rollback prefix, thời gian chữ đầu/final và lỗi số/phủ định. So LCP bật/tắt trên cùng đầu ra ASR; không dùng việc ít sửa chữ hơn như bằng chứng WER thấp hơn. Hai cửa sổ chồng lấp là bằng chứng tương quan, không phải hai phiếu độc lập.
4. **Lọc tải có hysteresis và độ mới:** giữ frame mới, một inference, bỏ stale; so FPS thực tế và p95 trước khi thay sampling/dwell. Tách detection/crop/classifier khỏi temporal gate; đừng nới góc hoặc hạ threshold để che lỗi phân loại.
5. **Hiệu chỉnh quality/fusion bằng dữ liệu:** phân lớp theo góc/kích thước/ánh sáng và Sad/Angry/Fear/Disgust; hiệu chỉnh trên validation tách người. Không thêm vote từ partial, revision hoặc pitch heuristics, không nhân softmax như xác suất độc lập. Chưa có dữ liệu thì giữ quyền từ chối kết luận.

Đợt này không thêm model denoise, không đổi threshold/fusion/PCM/VAD boundaries hoặc nạp thêm ASR. Những thay đổi đó phải có đối chứng WER/CER, RTF và RAM riêng. Video minh họa không là dữ liệu đánh giá accuracy.

## Kiểm chứng

Bản local mới **http://127.0.0.1:8087/**, build `demo-20261016-intro-lcp-v12`, container `signemo-intro-lcp-20261016-v12`; khởi động lại bằng `docker start signemo-intro-lcp-20261016-v12` khi Docker Desktop đang chạy. V10/v11 dừng nhưng được giữ để rollback, public 8080 chưa đổi.

190 tests/54 files và check/format qua; 6 model-comparison regression sau sửa bộ chọn candidate, lint/typecheck/format qua. Browser xác nhận video bắt đầu phát, không kết nối YouTube trước thao tác; không tải/cache B2. Đã sửa và xác nhận overflow vùng cuộn con mobile; offline cache ấm khởi tạo được B0/Gipformer. Chi tiết và phạm vi phép đo tại [VERIFICATION.md](VERIFICATION.md). Chưa có nghiệm thu người dùng, Android, chất lượng 7 biểu cảm hoặc 30 phút sau thay đổi mới; không tự promote profile thử.

Tham khảo cách nhúng/tham số/caption của [YouTube Embedded Players](https://developers.google.com/youtube/player_parameters); yêu cầu bật caption không tạo track phụ đề khi video chưa có.
