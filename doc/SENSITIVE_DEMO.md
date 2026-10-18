# Bản thử B2 và ngưỡng nhạy — 14/10/2026

Source demo chọn EmotiEffLib B2 thay B0, RGB 260×260/ImageNet, source/license/checksum được pin. Mặt mặc định 0,55; fusion mặt/text 0,55, margin 0,10. Giữ chất lượng ảnh, generation, hai nguồn đồng thuận và stale/cooldown. Ngưỡng cũ 0,65 đổi một lần, giữ ngưỡng tùy chỉnh khác, dữ liệu feedback/vault và lựa chọn âm/rung. UI phân biệt thiếu nguồn với điểm thấp.

## Kiểm tra

- Check qua: 148 tests/40 files, lint, TypeScript, checksum, build; format-check qua.
- Docker `signemo:b2-sensitive-20261014`, build `demo-20261014-b2-sensitive-v1`, localhost:8083. Chrome 155/Windows: worker product ready B2, canvas trống no-face, prewarm Giới thiệu hoàn tất, 0 lỗi console và 2 warning MediaPipe. Không thử webcam/micro vật lý.
- RGB tensor parity Python–browser sai khác logits tối đa 5,96e-6. Classifier riêng 30 lượt: p50/p95 457/925 ms; đo lại sau build 442/808 ms. Chưa gồm detection/crop, không là accuracy. Không đạt cổng mặt p95 700 ms; pipeline vẫn loại kết quả >750 ms.
- Tài nguyên tăng 14.740.129 byte (~14,06 MiB), trong +100 MiB. Image B2 không chứa binary B0 dư.

## Triển khai và giới hạn

B2 giữ ở localhost:8083 để thử, **chưa thay container/link 8080 đang chia sẻ**, vì latency chưa đạt. Bản link vẫn build trước, B0/ngưỡng cũ. Mở đúng cổng staging để thử ngưỡng mới; preferences theo từng origin. Chưa có bằng chứng B2 cải thiện Angry/Fear/Disgust. Báo cáo `output/research-evaluation/b2-sensitive-smoke.json`. Staging mount fixture tensor research, production không mount research.

Tone chưa bật vào hội thoại: đã có probe pretrained Emotion2vec thật, xem [TONE_RESEARCH.md](TONE_RESEARCH.md). INT8 không qua parity đầy đủ/chậm; FP32/WebGPU chạy được trên public PCM, chưa có dữ liệu để nghiệm thu accuracy/toàn pipeline. Không dùng artifact synthetic làm nhận diện thật. MERaLiON khoảng 3,08 GB vẫn nghiên cứu PC. Bản distill 9,7 MB giới hạn mostly-English/avatar nên không dùng làm vote tiếng Việt.

Nguồn: [Emotion2vec ONNX](https://huggingface.co/ziyu12345/emotion2vec_plus_base_onnx), [distill và giới hạn](https://huggingface.co/thomashallock/emotion2vec-web-distill), [MERaLiON](https://huggingface.co/MERaLiON/MERaLiON-SER-v1).
