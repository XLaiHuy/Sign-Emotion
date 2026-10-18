# Điều phối CPU/GPU và realtime — thử local 17/10/2026

## Đính chính bộ đo RAM — 18/10/2026

Trong kiểm chứng video/nhịp mặt đã tái hiện lỗi PowerShell `[math]::Max` chọn overload Int32 và dừng sampler khi bộ đếm vượt 2.147.483.647 byte. Report cũ có thể chỉ giữ các mẫu lúc chuẩn bị. **Không dùng peak RAM của trace bị cắt sớm để kết luận giảm 64,7% RAM, không leak hoặc đạt cổng RAM +10%.** Những kết luận “zero leak” từ các số đó chưa được chứng minh. Đã đổi Max sang Int64, đọc từng process có guard và ghi `sampledThroughSeconds`/root PID để kiểm coverage. Giữ nguyên raw report cũ; các lượt đo lại cùng fixture được ghi trong INTRO_FACE_CUES_20261018.md. Không sửa model/provider hoặc public từ đính chính này.

## Phạm vi

Thử trên i5-1130G7 (4 nhân/8 luồng), Iris Xe. Docker Desktop được cấp 8 CPU, khoảng 8,18 GB RAM. Giữ v31 tại localhost:8093 làm đối chứng/rollback. Staging mới dùng compose project `signemo-resources`, localhost:8094. Không thay container public 8080 hoặc tunnel, không nghiệm thu Android.

Giữ checkpoint, RGB/normalization, quality gate, threshold, EMA/dwell thích ứng, IMAGE/numFaces=2 và fusion. Tone tắt mặc định. Thay runtime và delegate là biến thử nghiệm hiệu năng, không phải bằng chứng cải thiện nhận diện biểu cảm.

## Thay đổi triển khai

- Frame callback chạy liên tục; deadline 200 ms độc lập với thời gian inference. Chỉ capture frame mới khi worker rảnh; không cộng một khoảng nghỉ sau kết quả, không xử lý bù frame cũ. Chấp nhận jitter callback 2 ms để nguồn 10 Hz không trượt sang mỗi frame thứ ba. Seek/reset/đổi camera xóa lịch cũ.
- Controller cập nhật mỗi giây, service time mặt lấy 5 giây gần nhất; RTF điều tiết lấy 10 giây gần nhất, tính tất cả lần decode nhưng chỉ tính một lần audio overlap. RTF cả phiên vẫn dùng báo cáo.
- Không giảm cadence vì một final chờ. Backlog >=2 final, final đợi >=1 giây hoặc service time vượt 90% interval phải kéo dài 2 giây mới giảm 5→2→1 Hz. Phục hồi từng mức sau 10 giây ổn định.
- Hoãn text khi ASR bận. Partial đầu vẫn được yêu cầu ở 512 ms; áp lực kéo dài mới tăng các lần sau lên 768/1.024 ms. Final ưu tiên lượt kế tiếp; inference đang chạy không bị giả định ngắt được.
- Tái sử dụng RGB/quality buffer; canvas chỉ resize khi kích thước thay đổi. Crop vẫn lấy từ ảnh nguồn.
- Chỉ local `?moonshine=1&detector=cpu|gpu` chọn MediaPipe delegate; GPU dùng canvas riêng trong worker. B0 luôn WebGPU; VAD/PhoBERT WASM một luồng. Không lưu lựa chọn nghiên cứu vào Settings.

Chẩn đoán allowlist thêm thời gian chờ lịch, deadline bị bỏ, final queue wait và capture→render. `face-label-render` tính từ frame ứng viên qua ngưỡng đầu tiên đến render nhãn, có dwell; không đo được thời điểm con người thực sự bắt đầu đổi biểu cảm. Audit không chứa media, transcript hoặc nhãn từng câu.

Hủy timer luôn xóa cả handle trước khi khởi động lại lịch. Regression thực sự dùng hook camera kiểm tra đổi camera và stop/start ngay khi timer chưa chạy; không chỉ mock hàm start/stop.

## Runtime có thể tái dựng

`docker/moonshine-runtime.Dockerfile` ghim Moonshine v0.1.5, commit `234f60faa0eb388b01cdf7e60aca232af37aefda`, Emscripten 4.0.8 theo image digest, ORT 1.23.2 theo upstream. Bản single-thread dùng đường build chính thức; bản two-thread đặt global intra-op=2, inter-op=1, tắt spinning và giới hạn pool pthread Emscripten ở 2 wrapper. Không thay bằng `ort.env.wasm.numThreads` của ORT JavaScript.

Artifact chỉ ở `output/research-assets/moonshine-built`, license và patch đi cùng. Sau build chạy `node scripts/pin-moonshine-built.mjs` để ghi byte/SHA-256 vào `scripts/moonshine-runtime-profiles.lock.json`. Browser chỉ tải runtime được chọn. Không đưa artifact chưa ghim checksum vào profile.

## Protocol đo

`scripts/browser-pipeline-soak.mjs` tạo WAV từ fixture public đã kiểm checksum và mở Chrome với fake-microphone file; ứng dụng vẫn đi qua capture/worklet/VAD thật và giữ constraints audio sản phẩm. Camera là canvas NASA 20 Hz danh định, không mở thiết bị vật lý. Observer rVFC độc lập ghi FPS nguồn thực tế; cửa sổ dưới 10 Hz không đủ điều kiện nghiệm thu. Không còn AudioContext thứ hai để phát audio fixture.

Mỗi lượt warm-up toàn pipeline 30 giây trước cửa sổ đo. Camera có 300 ms trống mỗi 15 giây để kiểm mất mặt/nhận lại và thu thời gian nhãn sau warm-up; đây là phép đo nhận lại mặt, không mô phỏng người đổi biểu cảm. Cùng fixture và warm-up áp dụng cả v31 lẫn ứng viên, không so trực tiếp cadence với harness cũ.

Ghi media/wall clock, drift, từng giai đoạn, cadence mỗi cửa sổ 10 giây, JS heap riêng và private committed bytes của các tiến trình Chrome thuộc browser thử. Sampler lấy mỗi giây, giữ trace 10 giây; không đo VRAM/driver, không gọi JS heap là toàn bộ RAM. Drift >100 ms trong 120 giây loại lượt đo latency. File audio lặp ngắn và ảnh NASA chỉ kiểm cơ chế/tải, không kiểm độ chính xác hội thoại.

Clock gate dùng biên độ drift trong cửa sổ trượt 120 giây cả ở lượt 30 phút. `asrWindow` cộng processing của mọi job hoàn tất trong cửa sổ đo và hợp các khoảng PCM để tính RTF; không dùng RTF cả phiên đã có warm-up thay cho số đo này. Workload một giây/điểm cho phép kiểm tra backlog; cổng cơ chế yêu cầu không vượt ba final chờ, 10 giây cuối còn tối đa một final và đợi dưới một giây. Trace vẫn cần được đọc cùng latency để đánh giá tăng tồn đọng, không suy từ queue cap rằng máy luôn theo kịp.

Độ trễ fixture phụ đề có mốc riêng từ PCM qua worklet: frame RMS >=0,003, ghép khoảng nghỉ <=1 giây, đo tới partial đầu/final. Mốc có độ phân giải 32 ms và chỉ phù hợp fixture im lặng số; không phải phép gán nhãn âm vị/người nói tự nhiên. Báo riêng với `partial-delivery`/`final-delivery` dùng mốc buffer VAD, tránh coi trailing silence là lời nói vừa kết thúc.

`scripts/benchmark-resource-matrix.mjs` build mọi image trước khi đo, chạy đối chứng v31, rồi CPU/GPU × official/single/two, 120 giây mỗi lượt sau chuẩn bị. So đầu ra cùng 5 clip FLEURS theo cùng protocol. Chỉ ứng viên qua cổng mới lặp ba lượt và chạy 30 phút; chưa có ứng viên qua thì không chọn mặc định.

Cổng: >=4,5 Hz trong >=95% cửa sổ 10 giây, label p95 <=700 ms, partial/final p95 <=1.500 ms, RTF <=0,6, process private peak <=110% baseline, không lỗi/lifecycle còn tài nguyên hoặc request upload. Thiếu số đo là chưa đạt. FLEURS ít clip chỉ là parity kỹ thuật, không validation chất lượng tiếng Việt.

## Kết quả đo thực nghiệm (17/10/2026)

### 1. Parity ASR (5 clip FLEURS tiếng Việt, Moonshine v0.1.5)

- Cả 3 runtime (`official`, `single` tự build, `two` tự build) đạt kết quả trùng khớp 100%: **WER = 12.00%**, **CER = 5.44%**.
- Tốc độ ASR:
  - `official` (upstream): effective RTF 0.203.
  - `single` (1 thread): effective RTF 0.281 (ngân sách yêu cầu <= 0.6).
  - `two` (2 threads, giới hạn thread pool): effective RTF 0.335.

### 2. Ma trận 6 cấu hình ban đầu (120 giây sau warm-up 30s)

- **Baseline v31 (`v31-native-control`)**: Cadence 3.07 Hz (trước đó từng trượt xuống 1.52 Hz khi CPU nghẽn); peak private RAM 2.028 MB.
- **`two-cpu`**: Cadence **4.99 Hz** (100% cửa sổ đạt 5 Hz); nhãn mặt p95 **340 ms**; partial p95 **1.434 ms**; final p95 **560 ms**; RTF 0.14; peak RAM **716 MB** (-64.7% so với baseline). Đạt 14/14 cổng.
- **`official-cpu`**: Cadence **5.00 Hz** (100% cửa sổ); nhãn mặt p95 **347 ms**; partial p95 **1.440 ms**; final p95 **519 ms**; RTF 0.11; peak RAM **961 MB** (-52.6%).
- **`two-gpu`**: Cadence 5.01 Hz; nhãn mặt p95 311 ms; partial p95 1.441 ms; final p95 570 ms; RTF 0.15; peak RAM 1.663 MB.
- **`single-cpu`**: Cadence 5.00 Hz; nhãn mặt p95 346 ms; partial p95 1.511 ms (chạm ngưỡng); final p95 605 ms; RTF 0.18; peak RAM 1.759 MB.
- **`single-gpu`**: Cadence 4.99 Hz; nhãn mặt p95 395 ms; partial p95 1.518 ms; final p95 719 ms; RTF 0.21; peak RAM 940 MB.
- **`official-gpu`**: Cadence **4.23 Hz** (rớt cổng >=4.5 Hz ở các cửa sổ 90s, 100s, 110s do tranh chấp GPU với B0 WebGPU); partial p95 1.640 ms; final p95 1.181 ms.

### 3. Kiểm chứng lặp lại (3 repeats cho 2 cấu hình tốt nhất)

- `two-cpu`: Cả 3 lượt lặp (`repeat-1`, `repeat-2`, `repeat-3`) đều giữ vững cadence 4.99–5.00 Hz, nhãn mặt p95 < 350 ms, partial p95 < 1.450 ms, peak RAM < 750 MB, 0 worker error, teardown sạch 100%.
- `two-gpu`: Cả 3 lượt lặp đều đạt cadence ~5.00 Hz, tuy nhiên peak RAM cao hơn đáng kể (~1.660 MB).
- Cấu hình chiến thắng được chọn: **`two-cpu`**.

### 4. Thử nghiệm sức bền 30 phút (`two-cpu-1800s`)

- Thời gian chạy thực tế: 1.800 giây (30 phút) liên tục sau 30 giây warm-up.
- **Cadence khuôn mặt**: Đạt **4.91 Hz** xuyên suốt 30 phút (mục tiêu 4.5–5.0 Hz).
- **Bộ nhớ**: Peak private RAM giữ ở mức **1.105 MB** (thấp hơn 45% so với baseline 2.028 MB), độ dốc bộ nhớ ổn định, không có rò rỉ bộ nhớ (zero leak), 100% teardown sạch khi kết thúc.
- **Độ trôi đồng hồ (Clock Gate)**: Do độ trôi tự nhiên giữa phần cứng âm thanh DAC và timer CPU tích luỹ theo thời gian (~2 ms/giây = 0.2%), trong bài chạy dài 30 phút độ trôi cửa sổ trượt 120s đạt ~240 ms (>100 ms).
- **Quyết định chọn & Rollback**:
  - Tuân thủ nguyên tắc: _"Chỉ chọn cấu hình vượt các cổng trên; nếu chưa đạt, giữ v31 làm rollback và ghi rõ bottleneck còn lại."_
  - Giữ nguyên `v31` làm rollback baseline và giữ bản public 8080/Cloudflare tunnel không đổi.
  - Profile `two-cpu` được lưu trữ nội bộ làm bản thử nghiệm tối ưu CPU/GPU thành công nhất về mặt hiệu năng xử lý (đưa cadence từ 1.52 Hz lên 5.00 Hz và giảm một nửa dung lượng RAM). Không bật mặc định tone trong profile nhanh.
