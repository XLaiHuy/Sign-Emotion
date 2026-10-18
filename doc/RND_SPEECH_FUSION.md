# R&D phụ đề và tổng hợp ba nguồn

Mục tiêu sản phẩm: hỗ trợ tiếp cận hội thoại tiếng Việt bằng phụ đề local và gợi ý sắc thái giao tiếp thử nghiệm. Không giả định người khiếm thính khó đọc nét mặt; cần đo giá trị thêm so với phụ đề đơn thuần.

## Bản sản phẩm và bản nghiên cứu

Sản phẩm hiện dùng PhoWhisper-tiny q8 (fallback Whisper tiny), EmotiEffLib và PhoBERT. Mặt chỉ hiển thị; chỉ fusion đủ điều kiện của đoạn mới nhất phát nhịp, tối đa một lần/ID, cooldown tối thiểu 3 giây, bỏ kết quả muộn quá 3 giây. Mặt và phụ đề tạm không tự phát nhịp. Camera/micro vẫn bắt buộc.

Gipformer và tone là profile nghiên cứu. Không tự tải vào app thông thường, không tự promote sau smoke test. Media, transcript, đặc trưng và nhãn từng đoạn không vào audit/feedback. Video local không phát nhịp. Nhật ký giữ nguyên 24 giờ.

## Thử Gipformer trên PC

Yêu cầu Node 24, Docker. Chạy từ root repo:

```powershell
npm run research:gipformer
$env:SIGNEMO_PORT='8081'
docker compose -p signemo-research -f compose.yaml -f compose.research.yaml up -d --build web
```

Mở `http://localhost:8081`, Cài đặt → Phòng kiểm thử → Model nghiên cứu. Chọn Gipformer **trước** khi chọn video. Phòng kiểm thử tiếng nói cũng có cùng lựa chọn; không còn nút Whisper base vốn không được worker hỗ trợ.

Profile `gipformer1.5-int8@sherpa-1.13.8` ghim HF revision `dd9227dcd8705c13f33bdbe59728d546ab94480f`, SHA-256 ba graph/tokenizer và npm integrity SHA-512. Tổng khoảng **84,43 MiB**, gồm WASM, dưới ngân sách 100 MiB. Model card MIT; runtime Apache-2.0. Loader npm được chuyển ESM, POSIX path và MEMFS thay cho NODERAWFS; binary WASM/trọng số không sửa. Manifest ghi checksum đầu ra của lớp tương thích. Đây không phải browser build upstream được chứng nhận.

Model là offline transducer; chữ tạm giải mã lại cửa sổ, không có state streaming. Một tác vụ ASR chạy, câu chốt ưu tiên lượt kế tiếp, một chữ tạm mới nhất chờ. Effective RTF tính cả partial, không đếm lặp audio và không lấy khoảng im lặng dài để làm RTF đẹp hơn. Seek reset clock/context/load; kết quả epoch cũ bị loại.

Đối chiếu public fixture có sẵn (không tự tải clip riêng):

```powershell
.venv/Scripts/python.exe -m pip install -r scripts/requirements-gipformer.txt
.venv/Scripts/python.exe scripts/benchmark-gipformer-reference.py
# Mở Playwright CLI session signemo-rnd tại localhost:8081 trước.
npm exec --offline --package @playwright/cli -- playwright-cli -s=signemo-rnd run-code --filename scripts/browser-asr-research-check.js
node scripts/summarize-asr-research.mjs
```

Đầu ra tại `output/research-evaluation/`, dữ liệu public PCM tại `output/research-assets/evaluation/`. Không đưa recording riêng vào đường dẫn được Docker phục vụ. Bản Docker production bình thường không có bind mount nghiên cứu. Kết thúc:

```powershell
docker compose -p signemo-research -f compose.yaml -f compose.research.yaml down
Remove-Item Env:SIGNEMO_PORT -ErrorAction SilentlyContinue
```

## Tone MLP local

Chưa có checkpoint tiếng Việt được huấn luyện/nghiệm thu. Toolchain là MLP 39→64→32→5, không phải model emotion đã đạt chất lượng. Feature contract `mel16-prosody-v1`: 16 log-mel means/std, biến thiên F0/độ hữu thanh, năng lượng và quiet ratio theo RMS. Không gán cảm xúc bằng cao độ hay âm lượng; quiet ratio chỉ là proxy, cần validation. F0 tuyệt đối không được đưa vào classifier. Chuẩn hóa theo train và temperature từ validation được nhúng vào ONNX.

Chuẩn bị dữ liệu trong vùng mã hóa offline, không Git/cloud. JSON đầu vào cho `prepare-prosody-data.py`:

```json
{
  "schemaVersion": 1,
  "trainingConsent": true,
  "encryptedStorageConfirmed": true,
  "rows": [{
    "participantId": "p001",
    "split": "train",
    "label": "sad",
    "wavPath": "clip.wav",
    "consentedAt": "2026-10-13T00:00:00Z",
    "expiresAt": "2026-11-10T00:00:00Z",
    "license": "Quyền sử dụng dữ liệu đã được xác minh",
    "rightsVerified": true
  }]
}
```

Mỗi WAV PCM16 thực sự 16 kHz, 1–2 kênh, 0,8–9,5 giây. Ngày mẫu phải thay bằng đồng ý thật; script không tạo đồng ý hay mã hóa ổ đĩa. Tách người train/validation/test, có đủ năm lớp trong train/validation. Trích feature dùng chính implementation TypeScript chạy browser để tránh hai preprocessing khác nhau.

Môi trường nghiên cứu: Python 3.11 và Node 24. Các phiên bản kiểm tra được ghim trong `scripts/requirements-prosody.txt`; cài PyTorch bản CPU khi không dùng GPU. Gipformer Python dùng `scripts/requirements-gipformer.txt`, cần cả hai package sherpa-onnx/sherpa-onnx-core đúng 1.13.8 để tránh lệch ABI. Các dependency Python không nằm trong Docker web.

```powershell
.venv/Scripts/python.exe scripts/prepare-prosody-data.py --data DATASET_JSON --out ENCRYPTED_FEATURE_JSON
.venv/Scripts/python.exe scripts/prosody_research.py train --data TRAIN_VALIDATION_JSON --out ENCRYPTED_ARTIFACT_DIR --version tone-vi-r1
.venv/Scripts/python.exe scripts/prosody_research.py evaluate --data HELD_OUT_JSON --artifact ENCRYPTED_ARTIFACT_DIR
```

Trích feature có thể kiểm tra catalogue cả ba split, nhưng lệnh train từ chối test: tạo catalogue train/validation riêng và held-out riêng. Expiry tối đa 30 ngày, quyền và rò rỉ người được kiểm tra trước đọc media/huấn luyện. Held-out chỉ dùng một lần với artifact đã đóng băng. Output gồm ONNX, manifest, báo cáo tổng hợp và parity fixture, đều phải giữ trong vùng mã hóa.

Nạp manifest+ONNX trong **Model nghiên cứu**. Loader kiểm checksum, feature order, precision/runtime, giới hạn 5 MiB và bắt buộc `researchOnly:true`. VAD dùng cùng micro/video PCM và chỉ trích prosody khi có artifact nghiên cứu. Lỗi tone/text tách riêng, không làm mất phụ đề. Tone không mặc định hoạt động trong hội thoại sản phẩm.

Trong SpeechLab chạy file riêng, nền nhiễu ước lượng bằng các cửa sổ RMS thấp; không tìm được khoảng yên hơn thì chất lượng noise là chưa biết và tone bị loại. Đây là heuristic, không thay thế đánh giá có nhãn hoặc VAD đồng bộ của video.

CNN nhỏ là vòng nghiên cứu thứ hai, chỉ triển khai nếu đã có dữ liệu và MLP không đạt; sau hai vòng không đạt phải xem lại dữ liệu/phạm vi.

## Fusion và cổng lựa chọn

So mặt, text, tone riêng; mặt+text; text+tone; ba nguồn với equal, 20/40/40, 20/50/30 và 20/30/50. Ngưỡng chọn trên validation, test không chọn profile. Hai nguồn đủ chất lượng cần đồng thuận; nguồn đáng tin mâu thuẫn thì abstain. Text/tone tương quan, không nhân softmax hoặc gọi điểm fusion là xác suất cảm xúc thật. Other/nhãn ngoài phạm vi không ép neutral.

Cặp mặt+tone cũng được đo để không bỏ sót cấu hình hai nguồn tốt hơn. Các cặp được hiệu chỉnh trên cùng grid validation như ba nguồn. Với luật đồng thuận nghiêm ngặt hiện tại, trọng số chỉ đổi điểm hiển thị, không đổi nhãn; các tỷ lệ có macro-F1 giống nhau không chứng minh 20/40/40 tối ưu. Báo cáo held-out đã tồn tại sẽ bị từ chối ghi đè, không được đổi tên báo cáo để tiếp tục hiệu chỉnh trên test.

`SpeechContext` giữ tối đa hai đoạn hard-cut trước đoạn cuối. Cắt 3 giây chưa phải kết thúc câu. Khi ngữ cảnh bị bỏ vì quá dài hoặc ASR nghi lỗi, không tự suy luận ý từ đoạn thiếu. Subtitles gốc vẫn hiện.

`npm run research:fusion -- INPUT_JSON OUTPUT_JSON` nhận dataset schemaVersion 1, researchConsent/encryptedStorageConfirmed/điều khoản license, và rows có participantId, sessionId, split, reference, segment {id,startMs,endMs}, decidedAtMs, evidence, consentedAt/expiresAt/rightsVerified. Evidence theo `ModalityEvidence`; không cần media/transcript. Báo cáo bỏ participant IDs, so ablation và chọn trên validation. Giấy phép chưa rõ không nhập. Không có tự động promotion.

ASR: WER giảm ≥10% tương đối, CER không tăng, mục tiêu WER ≤20% lời rõ/≤35% nhiễu vừa. Mặt/tone đo Sad/Angry, macro-F1, coverage, abstention. Tone chỉ xét mặc định nếu fusion tăng ≥3 điểm phần trăm macro-F1 so với cặp nguồn tốt nhất, không giảm precision Sad/Angry hoặc tăng nhịp sai/phút.

PC đầy đủ: p95 mặt ≤700 ms, chữ tạm ≤1,5 giây từ bắt đầu nói, chữ chốt ≤1,5 giây và fusion ≤2 giây sau ngừng nói; RTF hiệu dụng ≤0,6, RAM đỉnh ≤110% baseline, không tăng backlog, chạy 30 phút. Smoke 5 câu đọc/worker riêng không đạt cổng này. Android/iPhone và pilot là nghiệm thu riêng.
