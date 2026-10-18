# Nâng cấp 7 nhãn — 14/10/2026

## Profile và giới hạn

Sản phẩm giữ PhoWhisper-tiny q8 + Whisper tiny dự phòng, EmotiEffLib B0, MediaPipe, Silero và PhoBERT INT8. Profile này dùng chung PC/Android; Android thật chưa nghiệm thu. Không tự chọn model lớn hơn dựa vào dung lượng RAM trình duyệt khai báo.

Gipformer và B2 đã có adapter/đường thử local. Chưa promote mặc định vì chưa có kiểm tra camera/micro PC thật, tốc độ toàn pipeline 30 phút, Android 4–6 GB hoặc clip biểu cảm có nhãn. Đặc biệt B2 chậm hơn B0 trong phép đo classifier dưới đây; chưa có bằng chứng nó cải thiện Sad/Angry/Fear/Disgust. PhoWhisper-base chưa cần thử tiếp vì Gipformer chạy được trong browser và không bị loại ở bước tương thích/tốc độ riêng.

Tổng model/runtime duy nhất theo manifest hiện tại: **325.013.728 byte = 309,96 MiB**. Cổng build trong `scripts/verify-assets.mjs` giữ baseline này + tối đa 100 MiB. Đây là kích thước tài nguyên, không phải RAM. Bản Docker thường không đóng gói model nghiên cứu hoặc tự tải Moonshine; mã profile lab vẫn có để thử bằng overlay riêng.

| Ứng viên | Asset | Hợp đồng | Trạng thái |
| --- | --- | --- | --- |
| Gipformer 1.5 INT8 | 84,43 MiB cả Sherpa WASM/loader | PCM mono 16 kHz, feature 80, greedy, OfflineRecognizer; partial bằng cửa sổ, không có streaming state | Browser/PCM/offline/cache repair đã thử; chưa nghiệm thu toàn pipeline/Android |
| EmotiEffLib B2 | 30.779.724 byte (~29,35 MiB), thêm ~14,06 MiB so B0 | RGB 260×260, ImageNet mean/std, NCHW; thứ tự upstream anger/contempt/disgust/fear/happiness/neutral/sadness/surprise | Python–browser parity đạt; chỉ chọn rõ ràng trong lab |
| MERaLiON-SER-v1 | 3.080.143.412 byte checkpoint, chưa tính runtime | 7 nhãn; mono 16 kHz, reference Whisper medium/ECAPA; nguồn ghi hỗ trợ tiếng Việt hạn chế | PC file-research CLI; không đưa vào browser/production, chưa chạy inference |

Tên ONNX B2 thực tế ở revision upstream được pin là **`enet_b2_8.onnx`**, không có file tên `enet_b2_8_best.onnx` ở revision đó. Không tráo preprocessing 224×224 của B0. Các hash/source được pin ở `face-model-profile.ts`, `prepare-b2.mjs`, `prepare-gipformer.mjs`, `meralion-ser.lock.json`.

## Thay đổi đã thực hiện

1. Mở Fear/Disgust trong contract, classifier, PhoBERT mapping, cửa sổ mặt, fusion, vault và kiểm thử. Contempt/Other vẫn không hỗ trợ; không biến thành neutral. Legacy 5 nhãn/voice vẫn đọc được.
2. Fusion lấy các quan sát mặt đạt chất lượng trong đúng đoạn, không chỉ những frame đã qua thời gian ổn định để hiển thị. Giữ unsupported mass, kiểm tra số hữu hạn/model generation và chống kết quả cũ.
3. Giữ EMA 150 ms, dwell nhãn 200 ms và haptic 400 ms trong bộ lọc; Python nghiên cứu đồng bộ lại. Hội thoại không dùng trigger mặt, chỉ fusion phát nhịp. Cooldown ≥3 giây, một ID chỉ một nhịp, revision không lặp.
4. Resampler dùng ring buffer và bảng hệ số sinc/polyphase tính trước; capture tái sử dụng mono buffer. Test 48 kHz kiểm tra aliasing/block parity; 44,1 kHz đối chiếu sinc reference tại phase phân số.
5. Mặc định không xóa cụm giống câu trước. Chỉ dedup khi caller có bằng chứng cùng utterance và audio thật sự chồng thời gian; pipeline hiện chưa tạo overlap nên giữ nguyên từ lặp.
6. Crop classifier lấy từ bitmap nguồn thay vì canvas detection đã giảm kích thước; detection vẫn giới hạn 640×480 giữ tỷ lệ. Capture sản phẩm vẫn 640; chưa bật 720p vì chưa có phép đo lợi ích/chi phí. Bổ sung thời gian detection/crop/classifier nội bộ.
7. Giới thiệu mở mặc định, dùng cùng một session owner được App giữ qua Giới thiệu → Hội thoại. Owner prewarm ASR/VAD rồi mặt, không mở thiết bị; vào Hội thoại không tạo worker thứ hai. Tải/hash text đợi core khởi tạo xong. Idle chuyển nền cũng giải phóng prewarm worker nhưng không hiện hủy sai. Rời luồng hoặc trở về Giới thiệu từ phiên đang chạy dừng thiết bị. Text vẫn là nhánh tùy chọn, không chặn phụ đề.
8. Màu câu final chỉ theo fusion agreement của đúng segment, có icon/tên; partial/unknown giữ màu thường. Có lựa chọn tắt màu lưu cục bộ.
9. Sáu pattern luyện nhịp; thêm Fear `[70,100,70,180,240]`, Disgust `[240,180,80]`. Chưa xác nhận khả năng phân biệt bằng motor Android.
10. Avatar GLB tự tạo 110.744 byte, 7 preset tĩnh, mặc định tắt. Lazy import Three.js; chỉ render khi trạng thái thay đổi, giải phóng GPU khi ẩn/quá tải/rời màn. Unknown dùng neutral pose nhưng chữ vẫn “Chưa xác định”. Có error boundary/fallback riêng nếu chunk chưa có offline; không mất phụ đề. Không ký hiệu tay/lip-sync/model AI.
11. Audit có câu cố định cho thay đổi màu/avatar. Không thêm nhãn/câu/audio/frame vào audit; TTL 24 giờ và kho dữ liệu hiện có giữ nguyên.
12. Storyboard/prompt 45 giây, SRT và poster đã có. Chưa có MP4 AI; manifest demo để null. Player chỉ nhận hai đường local được allowlist và tải clip sau thao tác phát; thiếu clip không chặn phiên. Manifest model được lưu ngay sau xác minh metadata, trước SW control, và freeze trong mỗi boot; không tải/mix lại giữa gói.

Các hàng đợi, VAD 512 mẫu/544 ms/3 giây, ASR final priority, partial latest-only, adaptive 5/2/1 Hz và bỏ kết quả >750 ms vẫn được giữ. Không gọi hard-cut là câu đầy đủ; `SpeechContext` tiếp tục hoãn văn bản còn thiếu ngữ cảnh.

## Phép đo quan sát được trên PC

Chrome 155/Windows, WASM một luồng. CPU mục tiêu i5-1130G7; các số dưới đây là phép thử riêng và có tải nền, chưa phải thermal/battery hoặc benchmark toàn hệ thống.

| Đo | B0/PhoWhisper | B2/Gipformer |
| --- | ---: | ---: |
| Classifier mặt p50, 30 lượt tensor tổng hợp | B0 148,1 ms | B2 313,4 ms |
| Classifier mặt p95 | B0 204,8 ms | B2 371,9 ms |
| Sai khác logits tối đa Python–browser | B0 1,43e-6 | B2 5,96e-6 |
| ASR RTF trung bình, 5 PCM public FLEURS | PhoWhisper 0,694 | Gipformer 0,310 |
| Effective RTF giải mã cửa sổ 0,8/1,6/3 giây trên một clip | PhoWhisper 4,656 | Gipformer 0,364 |
| Giải mã cửa sổ final 3 giây | PhoWhisper 4.996 ms | Gipformer 588 ms |

Gipformer khớp text Python trên 5/5 PCM smoke đã đọc, khởi tạo worker mới offline và sửa tokens cache hỏng thành công. Benchmark ghi 0 request ngoài origin hoặc ghi mạng. Năm clip đọc không phải validation hội thoại; không dùng chúng để công bố WER/F1 hay chọn model Android. Tensor tổng hợp không kiểm tra khả năng tìm mặt/crop hoặc độ chính xác Sad/Angry.

Báo cáo local: `output/research-evaluation/asr-browser-smoke.json`, `face-profile-browser.json`. Không đưa clip nghiên cứu cá nhân vào Git/cloud.

## Chạy lab và tone PC

```powershell
npm run research:gipformer
npm run research:face-b2
.venv/Scripts/python.exe scripts/prepare-face-parity.py
```

Dùng `compose.research.yaml` với một cổng/project riêng. Trong Phòng kiểm thử video, mở “Model nghiên cứu”, chọn một ASR và một classifier; file video vẫn là local. Nút “Đo classifier đã chọn” chỉ đo tensor/latency, không công bố accuracy. Không tự nạp cả B0/B2 hoặc hai ASR trong cùng phiên.

MERaLiON: đã đọc giấy phép pin (MIT annex và các điều kiện upstream về attribution/disclaimer/modification), xem custom reference code. Code upstream khởi tạo Whisper từ config và exporter có đường checkpoint nội bộ tác giả; chưa có exporter ONNX browser dùng sẵn. Đã khóa config Whisper riêng để tránh tải thêm model khi inference offline. Model card và checkpoint kích thước thực tế phải được phân biệt.

```powershell
# Mặc định chỉ in trạng thái, không download:
npm run research:meralion
# Tải riêng 3,08 GB sau khi người chạy đã đọc các điều kiện upstream:
npm run research:meralion -- --download
# Trong venv nghiên cứu riêng có requirements-meralion.txt; không sửa venv sản phẩm:
python scripts/meralion-reference.py --audio <mono-16khz-1-to-15s.wav> --out <local-research-result.json>
```

Reference CLI kiểm checksum tất cả custom code/trọng số, safetensors và thứ tự nhãn; đặt HF offline, không mở mic, không gửi file. `--out` là xuất nghiên cứu rõ ràng; không tự đính kèm feedback/audit. Chưa tải checkpoint và chưa chạy inference/ONNX export trong lượt này, nên chưa có kết quả tone hoặc số đo tài nguyên; không đưa tone vào bản thường.

## Nghiệm thu còn cần thiết

Camera/micro/loa PC thật; 30 phút đồng thời mặt+ASR+text; Android 4–6 GB thật và sáu motor pattern; 720p/source crop; góc/kích thước/ánh sáng; clip có nhãn/đồng ý; MP4 AI được dựng và kiểm phụ đề. Không có thiết bị Android được kết nối nên không thể chọn model sản phẩm mới theo điều kiện “đạt trên PC và Android”. Mặc định đối chứng giữ nguyên cho đến khi có các phép đo này.

Nguồn: [Gipformer](https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt), [EmotiEffLib](https://github.com/sb-ai-lab/EmotiEffLib), [MERaLiON model card và giấy phép](https://huggingface.co/MERaLiON/MERaLiON-SER-v1), [prompt/storyboard](DEMO_45S_STORYBOARD.md).
