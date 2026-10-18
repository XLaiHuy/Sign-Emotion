# Nâng cấp hệ thống SignEmo — 15/10/2026

## Bàn giao ngày 16/10/2026

Bản thử local đang dùng **v10** tại **http://127.0.0.1:8087/**, Gipformer INT8 + B0/WebGPU + PhoBERT. Đã start lại container và kiểm tra healthy/Nginx; public 8080 không đổi. `npm run check` qua **181 tests / 51 files**, lint/boundaries, TypeScript, checksum/build; format-check và 4 test Python qua. UI desktop/mobile không tràn ngang, focus bàn phím và selector profile đúng; offline cache ấm chuẩn bị được cả mặt và ASR.

Đã có lượt tạo tải **30 phút trên v7**. Sau đó sửa ánh xạ đồng hồ audio, giữ quantum im lặng khi worklet thiếu input và chạy lại **5 phút trên v10**. Lượt cuối không lỗi worker/page, teardown về 0 worker/track, RTF hiệu dụng 0,215; vẫn phát hiện chênh lệch đồng hồ đáng kể trên nguồn audio ảo. **Chưa chạy lại 30 phút trên v10, chưa xác nhận latency micro thật hoặc hết drift.** Số đo/nguồn/cảnh báo đầy đủ tại [VERIFICATION.md](VERIFICATION.md). Không dùng p95 xử lý classifier hoặc delivery fixture để quảng bá tốc độ nhận biết cảm xúc của toàn ứng dụng.

Phần triển khai đã hoàn tất gồm profile thử, prewarm/cache, nối text sẵn sàng muộn, chữ tạm sớm trong profile Gipformer, đo từng giai đoạn, công cụ benchmark/calibration và chỉnh tài liệu theo bằng chứng. Chưa hoàn tất cổng chọn model sản phẩm, chất lượng tiếng Việt/biểu cảm có nhãn, Android và pilot. Tone giữ tùy chọn nghiên cứu, không được chứng nhận tiếng Việt; không tạo MP4 hoặc dữ liệu nghiên cứu giả để lấp các cổng đó.

## Phạm vi và trạng thái

Đợt này sửa pipeline, công cụ kiểm chứng và tính chính xác của tài liệu. Không tự thay profile mặc định trên link công khai. Không thêm backend inference hoặc gửi media/transcript. Nghiệm thu chất lượng model, Android và pilot thật còn cần dữ liệu/thiết bị/người tham gia tương ứng.

| Hạng mục | Thực hiện | Giới hạn nghiệm thu |
| --- | --- | --- |
| Hội thoại thử PC | Build `VITE_AI_PROFILE=pc-candidate`: Gipformer INT8/Sherpa 1.13.8, B0/WebGPU/ORT 1.30.0, PhoBERT | Chưa promote; không fallback GPU âm thầm hoặc gọi OfflineRecognizer là streaming có state |
| Chuẩn bị AI | Classifier warm-up trước READY; giữ đúng modelVersion khi dùng worker đã chuẩn bị | Không mở camera/micro khi warm-up; cold startup vẫn có chi phí |
| Text đến muộn | Khi gói text sẵn sàng trong phiên và người dùng bật fusion, nối text một lần, không mở lại micro | Chỉ các đoạn tiếp theo; không sửa nhãn mặt hiện tại bằng kết quả câu cũ |
| Tài nguyên | Candidate bỏ tải các checkpoint/runtime Whisper không dùng; checkpoint B0 và runtime GPU kiểm tra hash/cache trước phiên | B2 còn trong cache lõi của image thử để giữ hợp đồng baseline; image chưa phải gói sản phẩm tinh gọn cuối cùng |
| Đo pipeline | Kênh số liệu opt-in local `?benchmark=1`: capture, detection, crop, classifier, delivery, ASR partial/final, text và fusion | Không xuất nội dung, ID đoạn, nhãn cảm xúc hoặc exception text tùy ý; không tự gửi/persist kênh đo |
| Benchmark dài | Harness dùng frame có mặt và audio tiếng Việt; yêu cầu classifier/ASR/text thực sự chạy; deadline monotonic; cleanup trong finally | Fixture tạo tải không có nhãn cảm xúc, không cùng người; không chứng minh quality, webcam/motor thật, nhiệt, pin hoặc Android |
| Đánh giá fusion | Cả 7 nhãn và support từng lớp; participant split/held-out guard vẫn giữ | Chưa có validation riêng đủ để chọn ngưỡng mới |
| Confidence | CLI temperature scaling offline, chọn T trên validation; test không tác động lựa chọn | Không tự áp dụng vào production; T không đổi argmax hoặc biến score thành xác suất cảm xúc thật |
| Pitch/skill | Bỏ số liệu thị trường thiếu nguồn, bảo mật tuyệt đối, chi phí 0 vĩnh viễn; phân biệt từng loại latency | Chưa có đối tác, doanh thu, pilot hoặc số đo accuracy tổng quát |

## Profile và dung lượng

Bản thường giữ PhoWhisper-tiny q8 + B2/WASM + PhoBERT. Tone Emotion2vec vẫn là tùy chọn thử nghiệm, mặc định tắt, không được coi là đã nghiệm thu tiếng Việt.

Bản thử PC chạy một ASR và một classifier được chọn. Không đổi cài đặt ASR lưu lâu dài của người dùng. Khi GPU không khả dụng, báo lỗi chuẩn bị thay vì ghi rằng WebGPU đã chạy. Mở bản thường để đối chứng.

V7 thử partial trong Hội thoại Gipformer: cần cửa sổ đủ 25 frame (800 ms), ít nhất 16 frame có tiếng nói (512 ms), bỏ tạo partial mới khi đuôi im lặng đã ≥128 ms. Cách cũ cần đủ 25 frame tiếng nói nên các khoảng ngừng có thể kéo dài thời gian chờ. Chu kỳ yêu cầu partial 800 ms, queue latest-only và ưu tiên final vẫn giữ. Không gọi giải mã cửa sổ này là streaming có state; chữ tạm có thể sai và được sửa bởi final. VAD/chốt final 3 giây/544 ms và PCM final giữ nguyên trong regression. Bản thường không bật chính sách sớm này.

`node scripts/verify-candidate-profile.mjs` đối chiếu 29 asset và hash thực: **343,90 MiB**, gồm runtime mới và B2 lõi còn giữ. Manifest hiện tại là **324,01 MiB**; tăng **19,88 MiB**. So với budget baseline 309,96 MiB ngày 14/10 vẫn trong mức +100 MiB. Đây là danh sách URL model/runtime được chuẩn bị, không phải RAM/VRAM, băng thông toàn bộ app hoặc dung lượng image Docker. Không tính tone tùy chọn vào profile này; bật tone sẽ tải thêm riêng.

Metadata/checksum nằm ở manifest baseline và `output/research-assets/gipformer/manifest.json`, `face-comparison-manifest.json`; báo cáo đối chiếu ở `output/research-evaluation/candidate-profile.json`. Không đưa checkpoint hoặc media nghiên cứu vào Git.

## Chạy staging và quay lại

```powershell
npm run research:gipformer
npm run research:face-comparison
npm run research:pipeline-fixtures
node scripts/verify-candidate-profile.mjs
docker build --build-arg VITE_BUILD_ID=demo-20261015-pipeline-v10 --build-arg VITE_AI_PROFILE=pc-candidate -t signemo:pipeline-upgrade-20261015-v10 .
docker run -d --name signemo-pipeline-upgrade-20261015-v10 -p 127.0.0.1:8087:8080 --mount "type=bind,source=D:\Documents\OU-Khởi Nghiệp\output\research-assets,target=/usr/share/nginx/html/research,readonly" signemo:pipeline-upgrade-20261015-v10
```

Mở `http://127.0.0.1:8087/`. Nếu tên container đã tồn tại, start container đó hoặc chọn tên/cổng mới; không xóa container khác. Giữ public 8080 và các image trước. Đây là bản staging local, chưa thay tunnel.

Thư mục mount `output/research-assets` chỉ dành cho checkpoint và fixture công khai có quyền phù hợp. Không đặt clip riêng, dữ liệu nghiên cứu người tham gia hoặc transcript riêng vào thư mục được Nginx phục vụ. Dữ liệu riêng giữ ở vùng offline mã hóa theo PILOT.md.

## Benchmark và cách đọc

Harness `scripts/browser-pipeline-30min-benchmark.js` là biểu thức hàm cho Playwright CLI, không chạy bằng `node file.js`. Giữ không có dấu `;` sau dấu `}` cuối vì CLI bọc biểu thức trong ngoặc. Chỉ chạy trên origin localhost, trong browser riêng, không dùng tab người dùng.

Chuẩn bị fixture `output/research-assets/benchmark/manifest.json`: ảnh astronaut scikit-image v0.25.2, SHA256 `88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5`; [nguồn công bố public domain NASA](https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut). Audio từ `google/fleurs`, vi-VN, CC-BY-4.0, sample 1594 đã chuẩn bị ở `/research/evaluation/0.f32`. Harness lặp 2 giây đầu và 2 giây im lặng; không đánh giá WER trên đoạn bị cắt này. Ảnh và giọng khác người nên không dùng tỷ lệ đồng thuận làm accuracy.

```powershell
npx --offline --package @playwright/cli playwright-cli -s=pipeline-endurance open "http://127.0.0.1:8087/?benchmark=1&durationSeconds=1800" --headed
npx --offline --package @playwright/cli playwright-cli -s=pipeline-endurance run-code --filename scripts/browser-pipeline-30min-benchmark.js
npx --offline --package @playwright/cli playwright-cli -s=pipeline-endurance close
```

CLI cần được cài/cache trước; không có cache thì bỏ `--offline` để cài rõ ràng. Smoke dùng `durationSeconds=60`; không gọi smoke là 30 phút. Báo cáo xuất theo thao tác harness vào `output/research-evaluation/pipeline-benchmark.json`; lưu tên riêng từng lượt để không mất đối chiếu.

Report ghi thời gian thực, số inference, p50/p95, queue peak, effective RTF đã tính partial, mẫu JS heap và cleanup. JS heap không bao gồm toàn bộ worker/WASM/GPU; không được kết luận không rò RAM toàn hệ thống chỉ vì heap ổn. Mốc final được tính từ `endMs` đoạn VAD, có thể gồm trailing silence; chưa phải phép đo độc lập từ âm vị cuối. Partial chỉ tính lần đầu có chữ không bị guard loại; vẫn cần WER để biết chữ đúng hay sai.

Windows có thêm `powershell -NoProfile -File scripts/sample-browser-memory.ps1 -Session pipeline-final -Seconds 1200`: lấy PID qua CDP của Chrome tự động rồi chỉ xuất tổng private committed bytes/working set, không ghi PID hoặc nội dung tab. Đây là mẫu sau chuẩn bị, có thể gồm tài nguyên dùng chung giữa các context tự động; không phải RAM vật lý hoặc VRAM. Không so được mức tăng 10% nếu chưa đo baseline cùng phương pháp. Thư mục output phải tồn tại. CLI cần đã cache trước khi chạy. Không chạy thêm build/test nặng hoặc browser inference khác trong lượt đo.

Nếu nhánh text không chạy trong hai phút đầu hoặc thiếu classifier/ASR/text, báo chưa đầy đủ. Không gán 0 cho bộ nhớ không được API hỗ trợ. Tác vụ còn sống sau khi dừng phải phân biệt với tài nguyên harness cưỡng chế dọn.

## Hiệu chỉnh có dữ liệu

`python scripts/calibrate-confidence.py dataset.json --out output/confidence.json` dùng logits có thứ tự nhãn chính xác, `modelVersion`, `preprocessingVersion`, quyền nghiên cứu/hạn lưu và xác nhận offline mã hóa. Mỗi row có `participantId`, `split` (validation/test), `logits`, `reference`, `consentedAt`, `expiresAt`, `rightsVerified`.

Tách người trước khi lấy mẫu. Script chọn nhiệt độ dương bằng NLL validation, báo NLL/ECE10 trước–sau và support; test chỉ báo một lần. Từ chối ghi đè báo cáo. Đổi tên file không phải cách hợp lệ để liên tục xem lại test. Chưa có dữ liệu thì không xuất profile được quảng bá là đã calibrated. Không dùng dữ liệu tiếng nói đọc để xác nhận tone hoặc biểu cảm.

Chưa thay EMA/dwell/threshold, chưa bật tracking VIDEO, dual-ASR, SharedArrayBuffer hoặc GPU preprocessing: các thay đổi đó cần bottleneck và regression riêng. Thứ tự kế tiếp là hoàn tất số đo dài → dữ liệu tách người → hiệu chỉnh → xác nhận held-out → Android thật → pilot A/B với người trưởng thành.

## Cổng chưa được thay bằng phép thử tạo tải

| Cổng | Điều kiện dự kiến | Bằng chứng cần thêm |
| --- | --- | --- |
| Phụ đề | WER giảm ≥10% tương đối; CER không tăng; WER ≤20% lời rõ / ≤35% nhiễu vừa | Validation tách người, vùng miền và test độc lập; số, tên, phủ định, biên câu |
| Mặt | Sad/Angry precision ≥0,80, recall ≥0,65; macro-F1 không giảm; coverage ≥60% | Ghi support/precision/recall từng lớp Fear/Disgust, góc/kích thước/ánh sáng; không bỏ uncertain khi tính recall |
| Latency | Nhãn mặt p95 ≤700 ms; partial đầu ≤1,5 s; final ≤1,5 s sau ngừng; fusion ≤2 s | Đo end-to-end trên media có mốc tham chiếu; frame-delivery không bao gồm toàn bộ dwell |
| Tải dài | RTF hiệu dụng ≤0,6; RAM đỉnh không tăng >10% baseline; queue không tăng dần | Cùng workload, máy và phương pháp đo; JS heap chưa đủ đại diện RAM toàn pipeline |
| Người dùng | So phụ đề với gợi ý, đo hiểu nội dung/sắc thái và phân tâm | Người trưởng thành đồng ý, đảo thứ tự tình huống; tone chỉ tham gia khi đủ cổng riêng |

`evaluate_predictions.py` bổ sung khoảng Wilson 95% cho precision/recall; thiếu mẫu ghi null và support. Đây là khoảng tham khảo theo từng quan sát, không xử lý đầy đủ tương quan frame cùng người; cần báo theo người/clip và thiết kế nghiên cứu phù hợp, không dùng hàng nghìn frame của một người để tạo cảm giác chắc chắn.
