# So sánh model và phụ đề dễ đọc — 15/10/2026

## Phạm vi hiện hành

Đã thêm công cụ so sánh trong Phòng kiểm thử, chưa tự chọn model thắng hoặc đổi model mặc định. Source bản demo vẫn dùng PhoWhisper-tiny q8, EmotiEffLib B2/WASM, PhoBERT; Emotion2vec FP32/WebGPU là tùy chọn riêng. Link/container cũ tại 8080 không tự cập nhật theo source.

Phụ đề luôn là chữ tối `#24322C`. Fusion của đúng đoạn final chỉ bổ sung badge có tên/icon và viền trái. Tắt màu vẫn giữ tên/icon; partial/chưa rõ không nhận màu hoặc nhãn từ đoạn khác. Không thêm flash cảnh báo, nhịp mới, cử chỉ tay hoặc ngôn ngữ ký hiệu cho avatar. Fear/Anger trong hội thoại không đồng nghĩa nguy hiểm.

## Chuẩn bị lab local

```powershell
npm run research:gipformer
npm run research:face-comparison
```

Asset nghiên cứu nằm ở `output/research-assets`, không thêm vào manifest/cache production. Khi chạy Docker lab, mount thư mục này read-only vào `/usr/share/nginx/html/research`. `scripts/prepare-face-parity.py` tạo fixture đối chiếu tensor bằng môi trường Python nghiên cứu đã cài; fixture này không đo accuracy.

### ASR

Trong SpeechLab, chọn audio tối đa 10 MiB/30 giây, nhập transcript tham chiếu nếu có rồi mở **So sánh ASR trên cùng audio**. Audio được decode/downmix/resample mono 16 kHz một lần. Worker chạy PhoWhisper không fallback rồi Gipformer, giải phóng adapter trước model kế tiếp. Không mở micro, không upload. Mỗi lượt có timeout 5 phút; hủy/chuyển nền/rời màn hủy worker và decode.

Bảng báo thời gian chuẩn bị, giải mã và RTF. WER/CER chỉ xuất hiện khi nhập tham chiếu. Đây là giải mã file nguyên đoạn, **không phải** benchmark VAD, partial hoặc độ trễ phụ đề realtime. Transcript chỉ nằm tạm trong UI; xuất JSON loại transcript/tham chiếu và media. Cùng một file không thể thay validation/test tách người nói.

### Khuôn mặt

Trong phần **Đánh giá theo nhãn và công cụ nghiên cứu**, chọn video và nhãn theo thời gian nếu có. **So sánh B0/WASM, B0/GPU, B2/GPU** chạy tuần tự ba worker, cùng tối đa 30 giây đầu, mốc 200 ms, cùng settings/calibration/bộ lọc. Mỗi lần chỉ có một frame đang xử lý. Hủy/chuyển nền/rời trang giải phóng worker; generation ngăn kết quả cũ ghi đè lượt mới. Đổi file/nhãn/settings xóa báo cáo cũ.

Đo capture → kết quả, detection, crop, classifier; tách lượt đầu khỏi p50/p95 capture các lượt sau. Stage bị bỏ qua không được tính thành inference 0 ms. Phép đo batch không gồm thời gian seek/decode trước capture, không chứng minh FPS/latency realtime hoặc hiệu năng khi ASR/tone cùng chạy. Khi có nhãn, báo precision/recall/F1 từng lớp, support, confusion và tỷ lệ chưa kết luận; lớp không có support không chứng minh chất lượng. Không có nhãn thì không báo accuracy/F1.

GPU không khả dụng hoặc model không chạy được sẽ báo không khả dụng; không âm thầm đổi sang profile WASM. ORT có thể phân công một số node sang CPU trong provider GPU; kiểm tra warning và báo đúng điều kiện. Probe tensor dùng profile đang chọn, 1 lượt đầu + 30 lượt warm, so logits với reference Python; không dùng ảnh tensor tổng hợp để kết luận accuracy.

## Nguồn, hợp đồng và tài nguyên

- B0 `enet_b0_8_best_afew.onnx`: RGB 224×224/ImageNet, 16.039.595 byte, SHA-256 `7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f`.
- B2 `enet_b2_8.onnx`: RGB 260×260/ImageNet, 30.779.724 byte, SHA-256 `180a9d4845b59393de4511598a0d1d34b705034691ea32959ce5009db7cf52b7`.
- Cùng nguồn [EmotiEffLib](https://github.com/sb-ai-lab/EmotiEffLib), revision `c018fcf96c79c3bd9184f1c9438fe2095c9f1943`, giấy phép Apache-2.0 được ghi trong manifest lab. ORT Web ghim `1.30.0`; runtime WebGPU Asyncify cùng phiên bản, hash/size được ghi khi chuẩn bị. Không dùng runtime speech khác phiên bản cho face.
- [Gipformer](https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt) và [PhoWhisper](https://github.com/VinAIResearch/PhoWhisper) giữ artifact/adapter đã ghim của repo; Gipformer là offline recognizer chạy cửa sổ, chưa phải streaming có state. PhoWhisper-base và Moonshine chưa được chọn mặc định hoặc tải thêm trong lượt này.
- PhoBERT giữ baseline. F0/RMS chỉ là đặc trưng/kiểm tra chất lượng âm thanh; không tạo thêm nguồn vote. Tone chưa được nghiệm thu chất lượng tiếng Việt.

Audit chỉ có mã sự kiện so sánh bắt đầu/hoàn tất/lỗi, nhánh, số lượng và lý do theo allowlist; không có tên file, reference, transcript, media, landmarks hoặc nhãn từng đoạn. Xuất số đo chỉ chạy theo thao tác người dùng, không tự đính kèm feedback.

## Tiêu chí và điều chưa được chứng minh

Giữ cổng nghiệm thu đã thống nhất: nhãn mặt p95 ≤700 ms, partial đầu p95 ≤1,5 giây, final p95 ≤1,5 giây sau ngừng nói; ASR RTF hiệu dụng tính cả partial ≤0,6 và không có queue tăng dần. Đổi ASR cần WER giảm ít nhất 10% tương đối/CER không tăng, cùng validation/test tách người và ngân sách tải/RAM. Chất lượng Sad/Angry/Fear/Disgust phải đo riêng. Chưa đủ dữ liệu thì không promote.

Không dùng các khẳng định sau làm kết quả của SignEmo: giới hạn RAM cố định cho mọi trình duyệt/điện thoại; model lớn luôn giải mã 1,5–3 giây; tất cả máy giảm xung một nửa sau 2–3 phút; AFEW thấp hơn chứng minh overfitting; model chuyên Việt luôn thắng model lớn đa ngữ. Đây là rủi ro hoặc giả thuyết cần đo trên cấu hình cụ thể. Số upstream Fold 3 không phải tốc độ trên PC/Android của dự án. Benchmark dài 30 phút, thiết bị Android thật và validation cảm xúc vẫn là nghiệm thu riêng.

Kết quả thực chạy, build và các giới hạn được ghi tại [VERIFICATION.md](VERIFICATION.md).

Bản thử local cuối: `http://localhost:8086`, build `demo-20261015-model-comparison-v4`; vào Cài đặt → phòng kiểm thử tiếng nói/video. Lượt 5 clip FLEURS có WER tổng PhoWhisper 16% / Gipformer 6%, nhưng chỉ là smoke. Classifier tensor warm p95 B0/WASM 244,7 ms, B0/WebGPU 41,7 ms, B2/WebGPU 89,3 ms; cold GPU 5,6–6,5 giây, cần chuẩn bị trước. Không suy các số này thành chất lượng Sad/Angry hoặc latency toàn hệ thống. Không cập nhật link đang chia sẻ tại 8080.
