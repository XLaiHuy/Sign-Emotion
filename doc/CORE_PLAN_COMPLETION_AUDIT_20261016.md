# Đối chiếu hai kế hoạch lõi — 16/10/2026

Đối chiếu kế hoạch vòng đời tài nguyên và kế hoạch Backend–Models–Algorithms do người dùng cung cấp. Bảng này không coi code đã nối hoặc một test hẹp là nghiệm thu toàn pipeline.

| Yêu cầu | Trạng thái / bằng chứng / giới hạn |
| --- | --- |
| GPU diagnostics và WASM tương thích | Đã có mã lỗi/nhánh retry rõ, regression khởi động và browser v19; không yêu cầu unsafe-webgpu. |
| Tensor, bitmap và session cleanup | Có finally/release trong adapter; smoke v19 bổ sung đếm context phát hiện lỗi âm phản hồi. Sửa v20 đã xác nhận context ứng dụng về 0 sau dừng. Chưa suy thành zero-leak VRAM. |
| Mọi tài nguyên về 0 sau Finish | V20 còn 3 worker do tự chuẩn bị lại. Người dùng chọn giải phóng hết/nút chuẩn bị phiên mới. Source v21 + regression đã có; cần smoke và soak artifact cuối để nghiệm thu. |
| DOM tối đa 30 final + một partial | Đã có slice(-30), không tự lưu câu cũ khi chưa opt-in/unlock. Sampler đếm caption nodes thật; cần lượt dài đạt ít nhất 30 câu để kiểm tra cap. |
| Xoay màn hình không remount media | Browser production v15/v16 đã kiểm identity video/stream/tracks và tám viewport; không là kiểm Android vật lý. V21 không thay cây DOM media. |
| EMA 150 ms / adaptive dwell | Source TS/Python có parity. Người dùng chốt giữ thích ứng, thay cho mục cố định 200 ms ở tệp đầu. Giữ haptic floor 400 ms và reset ngay khi mất mặt. |
| Thu thập 5–10 video/calibration/flicker | Người dùng đã bỏ hạng mục này trong lượt tiếp tục. Không tuyên bố calibration hoặc tăng accuracy. |
| Giữ VAD, bảo vệ âm cuối | Không thay PCM production, 512 samples/context/VAD baseline và pre-roll được giữ. Hard-cut không tự thành câu hoàn chỉnh. |
| Harness audio clamping | Đã tạo và chạy 5 FLEURS, 19 đoạn, A/B cùng PCM/boundaries. WER/CER không cải thiện nên không promote. Metric tail là proxy ba từ cuối toàn clip, chưa có alignment từng từ ở biên đoạn; giới hạn ghi trong báo cáo. |
| Soak 30 phút, heap/DOM mỗi phút | Harness CDP/OS có, smoke 120 giây đã tìm được lỗi thật; **lượt 30 phút artifact cuối chưa hoàn tất**. Không dùng lượt v7 hoặc v19 thay cho v21. |
| Compound binding/LCP >=400 ms | Đã có tám cụm phổ biến, hai revision và media time; giữ khóa mềm có thể sửa phủ định/số/final. Không tuyên bố tokenizer tiếng Việt đầy đủ hoặc loại bỏ hoàn toàn nhấp nháy. |
| Permanent lock | Không áp dụng khóa không thể sửa: giữ sai ASR là không phù hợp yêu cầu phụ đề gốc/có revision. Mâu thuẫn được mở lại. Quyết định đã ghi trong RESPONSIVE_CORE_20261016.md. |
| Face loss linear decay <=150 ms | Không bật giữ/vote mặt đã mất. Baseline 5 Hz không xác minh mất mặt trong <=150 ms bằng một frame. Reset ngay theo nguyên tắc tệp vòng đời. |
| Temporal IoU >=0,40 | Có ở cửa sổ mặt và fusion, dùng thời điểm quan sát thật và generation; regression biên/coverage. |
| Dynamic quality weight 0,3 / margin 0,25 | Chưa bật: ảnh không đạt chất lượng vẫn bị loại trước classifier, không biến rejected thành usable. Chưa có validation so trọng số nên không gọi phương án mới tốt hơn. |
| Fast quality precheck và warm classifier | Có trước ONNX/READY, hợp đồng riêng từng model. Các số <=1,2 ms / tiết kiệm 35–60 ms / hết cold latency là mục tiêu, chưa có phép đo chứng minh đầy đủ. |
| Resampler vòng/tái sử dụng scratch | Có 2048 pha x32 taps/pushInto; parity 16/44,1/48 kHz. Transfer frame vẫn cấp buffer; không gọi toàn pipeline zero-allocation. |
| PhoBERT LRU | Có LRU 512 token và parity BPE IDs; không cache transcript/cụm câu. Chưa chứng minh tokenize <0,8 ms trên máy đích. |
| Strict report/rate-limit/tombstone | Code và PGlite regression có; thêm retention >24 giờ khi consume, giữ API hiện tại và không raw IP. Không phải cron xóa đúng giờ. Supabase hosted chưa cấu hình/triển khai. |
| Range / SHA / bounded retry | Đã áp dụng downloader chung cho core/speech/PhoBERT/candidate, validation Range và SHA trước cache. Resume tạm trong RAM, không hứa tiếp tục sau đóng tab. |
| Vault | Giữ AES-GCM và PBKDF2 600.000 vòng, không hạ 100.000. Người dùng đã chọn 5 phút; không đổi 15 phút. Có test lifecycle. |
| COOP/COEP và đa luồng | Chỉ research isolation hiện có; không bật toàn site khi chưa kiểm YouTube/runtime. Chưa có số đo đa luồng toàn pipeline hoặc bằng chứng tăng 2,5 lần; đây vẫn là khoảng trống nghiên cứu. |
| Immutable cache | Chỉ asset URL tên hash được immutable năm; model URL ổn định vẫn revalidate. Chưa chuyển toàn bộ model sang URL content-hash. Không gắn immutable năm cho URL có thể đổi bytes. |
| Hạ tầng model | Docker/Nginx origin đang dùng, model/license/checksum có manifest. Không chuyển R2/S3 hoặc phát sinh tài khoản/chi phí; phương án đó không bắt buộc khi giữ Docker. |

Nguồn chi tiết: MVP_SPEC.md, PROJECT_STATUS.md, RESPONSIVE_CORE_20261016.md, AUDIO_TAIL_AND_SOAK_20261016.md và VERIFICATION.md. Các hàng chưa đo/khác đề xuất phải được giữ hiển thị; không đánh dấu toàn bộ goal hoàn tất chỉ từ tổng số test xanh hoặc container healthy.
