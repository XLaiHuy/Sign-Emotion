# Tone hội thoại thử nghiệm — 14/10/2026

Tone FP32/WebGPU Emotion2vec+ base được nối vào phiên hội thoại bằng worker riêng, dùng PCM từ micro hiện có. Không mở micro thứ hai, không gửi audio/backend và không bật mặc định. Model đa ngôn ngữ chưa được validation tiếng Việt; đây không phải xác nhận độ chính xác hoặc nghiệm thu Android.

Trong Hội thoại → Tùy chọn, bật **Thử tone giọng trong tổng hợp**. Chuẩn bị model trước khi xin quyền, kiểm tra SHA-256 rồi warm-up shape 3 giây. Khoảng 356 MiB trọng số, chưa gồm runtime/RAM. Không dùng bản INT8 đã thất bại parity. Giấy phép, nguồn và checksum trong TONE_RESEARCH.md giữ nguyên.

Một tác vụ ngữ cảnh chạy, một đoạn mới nhất chờ. ASR final ưu tiên; tone và text xử lý sau ASR. Tone dùng đúng PCM và thời gian của đoạn cuối, không giả rằng nó bao phủ các đoạn trước trong context text. Fusion dùng trọng số bằng nhau, điểm mặt/text 0,55 và tone 0,65, margin 0,10. Ít nhất hai nguồn đồng thuận; nguồn đủ điều kiện mâu thuẫn thì chưa kết luận. Text/tone có tương quan, điểm không phải xác suất cảm xúc thật.

Hard-cut có thể chạy tone+mặt trên đúng đoạn đã có phụ đề; không chạy phân tích ngữ nghĩa như thể câu đã hoàn chỉnh. Phụ đề không nghe rõ chưa được dùng để tạo vote text. Warm-up dùng sóng tổng hợp có phương sai khác 0, không đưa vào quyết định hoặc nhật ký. Cache đầy không chặn trọng số hợp lệ trong RAM; UI/audit báo rõ chưa lưu cache.

Ngữ cảnh muộn tối đa 30 giây có thể hiển thị cạnh câu cũ; gate nhịp vẫn bỏ kết quả quá 3 giây và chống trùng ID. Không thay nhãn mặt hiện tại bằng ngữ cảnh cũ. Các đoạn pending lỗi thời bị thay, không bỏ phụ đề. Tone lỗi/timeout trả thiếu bằng chứng, không dừng ASR. Kết thúc/chuyển nền/đổi trang giải phóng tone worker. Lượt sau phải chuẩn bị lại, dùng binary đã cache nếu hợp lệ. UI không tự nạp tone sau gián đoạn.

## Nhiễu

- Giữ yêu cầu browser noiseSuppression/echoCancellation và autoGainControl=false; giá trị thực tế lấy từ track settings. Không giả có audio nguyên bản khi browser đã lọc.
- Thêm high-pass Butterworth 20 Hz trước AudioWorklet để loại DC/subsonic rumble. Không phải bộ tách giọng khỏi tiếng quạt, nhạc hoặc người khác.
- Dùng RMS, clipping và nền nhiễu đo trong khoảng VAD im lặng để loại tone không đủ điều kiện: RMS dưới 0,005, clipping ≥5%, hoặc tỷ lệ RMS lời/nền <1,5 khi nền đã được đo. Đây là heuristic, không phải ngưỡng được validation. Không coi nền chưa đo là bằng chứng audio sạch.
- Không áp spectral gate mạnh, auto gain hay pitch rule để tạo nhãn cảm xúc. Chưa thêm model khử nhiễu nặng. Nếu tiếp tục thử spectral subtraction/Wiener/RNNoise, cần ablation WER và SER trên cùng audio, giữ timestamps, không triệt âm cuối/đầu câu hay làm méo prosody.

## Chạy riêng

Image thử nghiệm cần mount read-only `output/research-assets` vào `/usr/share/nginx/html/research`. Container bản thường không tự chứa hoặc tự tải model này. Không thay tunnel/public container trong lượt này.

Runtime tone dùng ORT 1.30 Asyncify riêng; CSP chỉ mở dynamic-function cho worker tone, không mở toàn app. Các runtime research hiện phục vụ cùng origin; cache weight không đồng nghĩa đã nghiệm thu cold restart offline toàn nhánh tone. Chưa đo 30 phút cùng pipeline hoặc mic vật lý. Không cam kết Android/iPhone.

## Smoke Chrome/PC

Build `demo-20261014-live-tone-v5`, image `signemo:live-tone-20261014`, container `signemo-live-tone-20261014` tại localhost:8085. Nginx syntax qua. Chuẩn bị tone thật thành công cùng core; Cache Storage trên máy thử trả QuotaExceededError, fallback RAM hoạt động. ORT báo hai warning node assignment/CPU fallback.

`output/playwright/live-tone-capture.js` đưa PCM public tiếng Việt qua MediaStream/WebAudio giả lập: một yêu cầu thiết bị kết hợp, một request/result tone, thời gian tone 1273,6 ms, có phụ đề và tất cả track ended sau kết thúc. Camera fixture đen không có mặt; không dùng bài này để chứng minh fusion nhận nhãn thật hoặc độ chính xác SER/ASR. Unit test kiểm tra text+voice đồng thuận, mâu thuẫn, hard-cut và kết quả đến muộn sau hủy. Không dùng micro/camera vật lý, không đo Android hoặc 30 phút.
