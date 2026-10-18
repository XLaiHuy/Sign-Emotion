> **Hồ sơ lịch sử — chưa kiểm chứng.** Đặc tả và phạm vi MVP hiện tại nằm tại [MVP_SPEC.md](../MVP_SPEC.md). Các con số kỹ thuật, thị trường và tài chính trong tài liệu này là đề xuất hoặc giả thuyết, không phải kết quả đã đạt.

# 📱 SignEmo — Nội Dung Kỹ Thuật & Phân Tích Dự Án

> **Dành cho:** Cuộc thi "Sinh viên với Ý tưởng Sáng tạo & Khởi nghiệp" 2026 — OU  
> **Lĩnh vực:** Công nghệ AI / Trợ lý kỹ thuật số / Sức khỏe & Hòa nhập xã hội

---

## 🎬 KỊCH BẢN SỬ DỤNG (User Story)

### Nhân vật: Lan, 24 tuổi — Nhân viên văn phòng nhập liệu, khiếm thính bẩm sinh

**Buổi sáng đi làm:**
Lan bước vào phòng họp. Sếp đang giải thích kết quả kinh doanh tháng trước. Lan đeo đồng hồ thông minh (Android smartwatch phổ thông tầm 1.5–2 triệu VNĐ) và mở app **SignEmo** trên điện thoại, hướng camera về phía sếp.

**Trong cuộc họp:**
- Camera phân tích gương mặt sếp **mỗi 0.5–1 giây** → model AI nhận diện biểu cảm.
- Kết quả hiện lên màn hình: icon 😠 + thanh xác suất (Tức giận: 72%) đồng thời đồng hồ **rung theo nhịp dồn dập** (3 nhịp nhanh liên tiếp).
- Lan biết sếp đang bực bội → chủ động giải trình thay vì đứng im.

**Sau đó, đồng nghiệp nói chuyện riêng:**
- Camera nhận diện 😊 (Vui vẻ: 85%) → đồng hồ rung nhẹ nhàng, đều đặn (1 nhịp dài).
- Lan tự tin giao tiếp, không bị cô lập trong cuộc trò chuyện nhóm.

### Thiết bị cần dùng

| Thiết bị | Yêu cầu tối thiểu | Chi phí ước tính |
|---|---|---|
| Điện thoại Android | Android 8.0+, camera 8MP+, RAM 3GB+ | Có sẵn (hầu hết người dùng đã có) |
| Smartwatch Android | Wear OS hoặc bất kỳ watch Bluetooth | ~1.200.000–2.500.000 VNĐ |
| Apple Watch (tùy chọn nâng cao) | Series 3 trở lên + watchOS 7+ | ~2.000.000–5.000.000 VNĐ (second-hand) |
| **Không cần** internet | Chạy Edge AI offline | $0 chi phí server/tháng |

---

---

# PHỤ LỤC I — TRANG 3 (ĐỀ CƯƠNG Ý TƯỞNG)

---

## 1. TÍNH CẦN THIẾT CỦA SẢN PHẨM DỊCH VỤ

### 🎯 Mục tiêu, giá trị, tầm nhìn

**Vấn đề cốt lõi cần giải quyết:**
Tại Việt Nam, ước tính có **hơn 2,5 triệu người khiếm thính** (Bộ Y tế, 2023), trong đó khoảng 60% trong độ tuổi lao động. Người khiếm thính có thể học đọc môi, ngôn ngữ ký hiệu, sử dụng phụ đề — nhưng **không có công cụ nào giúp họ đọc cảm xúc tinh tế** (micro-expressions) của người đối diện trong giao tiếp thời gian thực. Điều này dẫn đến:
- **Hiểu sai ý định** của người nói (sếp đang bực hay đang vui? đồng nghiệp đang ngại nói thật hay thực sự đồng ý?).
- **Áp lực tâm lý** khi phải liên tục đoán mò trạng thái cảm xúc.
- **Cô lập xã hội** trong các môi trường tập thể như lớp học, văn phòng, xưởng sản xuất.

**Mục tiêu SignEmo:** Trở thành "trợ lý phiên dịch cảm xúc" thời gian thực — giúp người khiếm thính **cảm nhận** được nhịp điệu cảm xúc của người đối diện qua hai kênh song song: **icon trực quan** trên màn hình + **haptic feedback** (rung có nhịp điệu) trên cổ tay.

**Tầm nhìn dài hạn:** Tích hợp lên kính thông minh (smart glasses), tối ưu hóa model AI chạy hoàn toàn trên edge device (không cần internet), mở rộng sang các ngôn ngữ cơ thể (body language), từng bước trở thành nền tảng hỗ trợ giao tiếp toàn diện cho người khuyết tật giác quan tại Đông Nam Á.

**Giá trị tạo ra cho từng đối tượng:**

| Đối tượng | Giá trị trực tiếp |
|---|---|
| Người khiếm thính | Tự tin hơn trong giao tiếp; giảm áp lực tâm lý; hòa nhập công sở, trường học |
| Gia đình/bạn bè của họ | Kết nối cảm xúc sâu hơn, giao tiếp hiệu quả hơn |
| Trường chuyên biệt, trung tâm bảo trợ | Công cụ hỗ trợ giảng dạy và quản lý cảm xúc học sinh |
| Doanh nghiệp tuyển dụng NLĐ khiếm thính | Tối ưu hóa giao tiếp nội bộ, giảm hiểu lầm, tăng năng suất |

### 👥 Đối tượng khách hàng quan trọng nhất

**Giai đoạn 1 (MVP — tháng 11/2026):**
- **Người khiếm thính cá nhân** trong độ tuổi 18–40 đang đi học, đi làm, có sử dụng smartphone Android.
- Ưu tiên nhóm đang học tại các **trường chuyên biệt tại TP.HCM** (Trường Hy Vọng, Trường Bình Minh, Trường Khuyết tật Thính giác TP.HCM).

**Giai đoạn 2 (B2B — năm 2):**
- **Trường chuyên biệt và trung tâm bảo trợ xã hội** — mua giấy phép phần mềm theo năm.
- **Doanh nghiệp xã hội và chuỗi sản xuất** tuyển dụng lao động khiếm thính (ví dụ: Cafe Tự Kỷ, xưởng may xã hội).

### 🏆 Lý do khách hàng chọn SignEmo thay vì giải pháp khác

| Giải pháp hiện có | Hạn chế | SignEmo vượt trội hơn |
|---|---|---|
| Google Live Transcribe, Ava | Chỉ chuyển giọng nói → văn bản, **không đọc cảm xúc** | Đọc cảm xúc qua gương mặt + haptic feedback |
| Máy trợ thính, ốc tai điện tử | Trợ giúp nghe, **không giúp hiểu cảm xúc phi ngôn ngữ** | Hoàn toàn khác phân khúc |
| Ứng dụng nhận diện âm thanh (BuzzWatch, SoundWatch) | Nhận diện **âm thanh môi trường**, không phải cảm xúc người nói | Nhận diện cảm xúc khuôn mặt — unique value |
| Tư vấn tâm lý, trị liệu | Chi phí cao, không thời gian thực | Giải pháp AI realtime, chi phí thấp |

→ **Không có sản phẩm nào trên thị trường Việt Nam** hiện tại tích hợp đồng thời: nhận diện micro-expression + haptic feedback đa tần + edge AI offline + dành riêng cho người khiếm thính.

### 🌍 Giá trị mang lại cộng đồng và xã hội

- **Giảm bất bình đẳng giác quan:** 2,5 triệu người khiếm thính VN thiếu một "giác quan" — SignEmo bù đắp một phần qua xúc giác và thị giác.
- **Hỗ trợ SDG 10 (Bình đẳng)** và **SDG 4 (Giáo dục chất lượng)** của LHQ: giúp học sinh khiếm thính đọc cảm xúc giáo viên, cải thiện kết quả học tập.
- **Thị trường toàn cầu:** WHO ước tính có **430 triệu người khiếm thính toàn cầu** (2023) → tiềm năng mở rộng quốc tế sau khi tối ưu hóa tại VN.

---

## 2. TÍNH KHẢ THI

### ✅ Phân tích tính khả thi kỹ thuật

**Stack công nghệ đã được kiểm chứng (có code & benchmark thực tế):**

**Bước 1 — Phát hiện khuôn mặt (Face Detection):**
- Công nghệ: **MediaPipe Face Landmarker** (Google, mã nguồn mở).
- Trích xuất 478 điểm landmarks khuôn mặt.
- Hiệu năng thực tế: chạy ổn định 25–30 FPS trên Android tầm trung (Snapdragon 665+).
- **Miễn phí, không cần license.**

**Bước 2 — Phân loại cảm xúc (Emotion Classification):**
- Model: **MobileNetV2 / EfficientNet-Lite** dạng `.tflite` (quantized INT8).
- Dataset huấn luyện có sẵn: **FER2013** (~35.000 ảnh, 7 lớp cảm xúc, miễn phí), **AffectNet** (~1 triệu ảnh, miễn phí cho nghiên cứu).
- Độ chính xác benchmark thực tế: **~65–75% trên FER2013** với các model lightweight; **>90%** với specialized frameworks trên CASME II (dataset micro-expression lab-controlled).
- Inference time: **3–40ms/frame** trên Android tùy GPU/CPU delegate → đạt realtime 30FPS.
- **Pre-trained model có sẵn trên Hugging Face & GitHub** — không cần train từ đầu cho MVP.

**Bước 3 — Haptic Feedback:**
- Android: `VibrationEffect` API (Android 8.0+) — hỗ trợ custom waveform (pattern + amplitude).
- Apple Watch: `WKHapticType` + sequencing via `DispatchQueue` — tạo "ngôn ngữ rung" từ các pattern hệ thống.
- **Chi phí: $0** (API có sẵn trong OS).

**Bước 4 — MVP Architecture (Dễ thực hiện nhất trong ~3 tháng):**

```
[Camera Android] → [MediaPipe Face Detect] → [TFLite Emotion Model]
       ↓                     ↓                        ↓
[Frame buffer      [52 Blendshape          [INT8 Quantized
  2 frame/s]        Coefficients]           MobileNetV2]
       ↓                     ↓                        ↓
[Hiển thị Icon +   [FACS Rule Engine]      [Confidence
  Confidence UI]    (micro-expression)      Threshold ≥60%]
                                                    ↓
                                     [Bluetooth → Smartwatch Haptic Pattern]
```

**Lộ trình MVP đến tháng 11/2026:**

| Giai đoạn | Thời gian | Mục tiêu |
|---|---|---|
| **Phase 0** | Tháng 5–6 | Nghiên cứu, chọn model pretrained (DeepFace/FER-CNN), setup Android project Flutter |
| **Phase 1** | Tháng 7–8 | Tích hợp MediaPipe + TFLite, UI cơ bản hiển thị emotion icon + confidence bar |
| **Phase 2** | Tháng 9** | Tích hợp Bluetooth → Smartwatch haptic; thiết kế "haptic language" (5 pattern rung) |
| **Phase 3** | Tháng 10** | Test với người dùng thật (trường khuyết tật), thu thập feedback, tinh chỉnh |
| **MVP Demo** | Tháng 11 | Bản demo hoạt động offline, nhận diện 5 cảm xúc cơ bản, haptic feedback qua watch |

### 💰 Chi phí ước tính đầu tư (MVP giai đoạn 1)

| Hạng mục | Chi phí | Ghi chú |
|---|---|---|
| Google Play Developer Account | ~625.000 VNĐ (≈ $25, 1 lần) | Trả 1 lần duy nhất |
| Apple Developer Program (nếu cần iOS) | ~2.500.000 VNĐ/năm (≈ $99) | Có thể bỏ qua ở MVP, ưu tiên Android trước |
| Thiết bị test Android bổ sung | ~0 (dùng máy cá nhân) | Mỗi thành viên dùng máy cá nhân |
| Smartwatch Android để test | ~800.000–1.500.000 VNĐ | 1 chiếc, mua second-hand |
| Cloud (training model nâng cao) | ~0–500.000 VNĐ | Dùng Google Colab Free/Pro nếu cần fine-tune |
| **Tổng giai đoạn MVP** | **~1.425.000–2.625.000 VNĐ** | **Nằm trong ngân sách 2.5–4 triệu** ✅ |

> **Lưu ý quan trọng:** Chi phí thấp được bởi vì:
> 1. **Edge AI offline** — không tốn tiền server/cloud API (DeepFace API cloud có thể tốn $50–$200/tháng, nhưng chúng ta chạy on-device).
> 2. **Pre-trained models miễn phí** — không cần thuê GPU để train từ đầu cho MVP; chỉ cần fine-tune trên Google Colab miễn phí.
> 3. **Flutter cross-platform** — viết 1 codebase chạy cả Android & iOS.

### ⚡ Thuận lợi

- **Hệ sinh thái mã nguồn mở phong phú:** MediaPipe (Google), TensorFlow Lite, DeepFace (Python) — đều có code mẫu và tutorial trên GitHub.
- **Pre-trained models chất lượng cao miễn phí:** FER2013-trained MobileNet đã đạt ~72% accuracy, đủ cho demo MVP.
- **Đội ngũ có 02 thành viên IT** — giảm hoàn toàn chi phí outsource.
- **Công nghệ Edge AI là xu hướng toàn cầu** (Apple Neural Engine, Qualcomm AI Hub) → thiết bị phổ thông ngày càng mạnh hơn, hỗ trợ chạy model AI ngày càng tốt hơn.
- **Thị trường ngách chưa có cạnh tranh trực tiếp** tại Việt Nam.

### ⚠️ Khó khăn & Rủi ro (và giải pháp kỹ thuật cụ thể)

| Khó khăn | Mức độ | Giải pháp kỹ thuật |
|---|---|---|
| **Micro-expression khó nhận diện** (1/25–1/2 giây, dễ bị bỏ qua nếu chỉ dùng CNN thông thường) | Cao | ✅ Dùng **Apex-Frame Spotting + STSTNet-Lite** (xem mục kỹ thuật bên dưới) — đã đạt ~75–85% trên CASME II với model nhỏ |
| Ánh sáng yếu, góc nghiêng, che khuất khuôn mặt | Trung bình | MediaPipe BlazeFace robust với góc ±30°; thêm UI warning khi landmark confidence < 0.5 |
| Quyền riêng tư (quét khuôn mặt người khác) | Cao | **Edge AI offline** — zero upload; UX "camera chỉ phân tích, không lưu trữ"; tuân thủ Nghị định 13/2023/NĐ-CP |
| Smartwatch API giới hạn (Apple Watch không có Core Haptics custom) | Trung bình | Pattern sequencing với `WKHapticType` + timing offset; Android Wear OS dùng `VibrationEffect.createWaveform()` linh hoạt hơn |
| Pin hao khi chạy camera + AI liên tục | Trung bình | Adaptive sampling (2fps bình thường, tăng 10fps khi phát hiện chuyển động mặt); dùng NPU delegate thay CPU |
| Dataset micro-expression nhỏ → dễ overfit | Trung bình | **Knowledge Distillation** (teacher = ResNet-50 lớn, student = MobileNet nhỏ) + **Quantization-Aware Training** INT8 — accuracy drop < 1% |

---

## 3. TÍNH ĐỘC ĐÁO, SÁNG TẠO

### 🌟 Điểm độc đáo so với thị trường

**So sánh với các sản phẩm/nghiên cứu hiện có:**

| Tiêu chí | Google Live Transcribe | Morphcast (emotion AI web) | SoundWatch | **SignEmo** |
|---|---|---|---|---|
| Đối tượng | Người khiếm thính | Marketer/HR | Người khiếm thính | **Người khiếm thính** |
| Chức năng chính | Speech → Text | Emotion từ web cam | Nhận diện âm thanh | **Emotion từ khuôn mặt người đối diện** |
| Haptic feedback | ❌ | ❌ | ✅ (âm thanh) | ✅ **(cảm xúc — unique)** |
| Offline/Edge AI | ✅ | ❌ (cloud) | ✅ | ✅ |
| Nhận diện micro-expression | ❌ | Cơ bản | ❌ | ✅ **(mục tiêu)** |
| Thị trường VN | Có | Không | Không | **Đang phát triển** |

**3 điểm độc đáo không thể sao chép dễ dàng:**

1. **"Haptic Emotional Language" — Ngôn ngữ rung cảm xúc:**
   Thiết kế một bộ pattern rung học được (learnable haptic vocabulary): vui = 1 nhịp dài nhẹ; buồn = 2 nhịp chậm; tức giận = 3 nhịp nhanh dồn dập; ngạc nhiên = 1 rung mạnh ngắn; trung lập = im lặng. Người dùng học nhịp rung như ngôn ngữ mới — **không cần nhìn màn hình**.

2. **Edge AI Privacy-First Architecture:**
   Toàn bộ xử lý AI diễn ra **100% trên thiết bị**, không upload ảnh/video lên cloud. Đây là điểm khác biệt về đạo đức và pháp lý so với các dịch vụ emotion AI cloud (Morphcast, Affectiva).

3. **Tối ưu hóa trên thiết bị yếu (Low-end Edge Optimization):**
   - Sử dụng **model quantization INT8** giảm kích thước model ~4x, tăng tốc inference.
   - Áp dụng **apex-frame sampling** (phân tích 2 frame/giây thay vì 30fps) → giảm tải CPU 80%.
   - Kết quả: chạy được trên điện thoại Android tầm trung (2–3 triệu VNĐ), không yêu cầu flagship.

### 🔬 Nền tảng công nghệ đổi mới sáng tạo

**A. Transfer Learning Macro → Micro (SOTA 2023–2024):**
Pre-train trên FER2013/AffectNet (dataset lớn, biểu cảm rõ) → fine-tune trên CASME II/SAMM (micro-expression dataset, ~500–1.500 samples). Kỹ thuật này giải quyết bài toán **data scarcity** của micro-expression — được công bố trong IEEE TAFFC, Springer LNCS 2023–2024 với accuracy cải thiện 8–15% so với train trực tiếp.

**B. MediaPipe Blendshapes → FACS Mapping (Lightweight Path):**
Thay vì CNN xử lý raw pixel (nặng), hệ thống map **52 blendshape coefficients** từ MediaPipe sang **Facial Action Coding System (FACS)** qua một MLP nhỏ (~10K params):
- Blendshape `cheekSquintLeft/Right` → AU6 (Cheek Raiser) → Genuine Smile
- Blendshape `jawOpen` + `mouthSmileLeft` → AU25+12 → Happy
- Blendshape `browDownLeft/Right` → AU4 → Anger/Disgust
- Chạy < 1ms trên CPU — **phù hợp Apple Watch Series 3 (chip S3)**.

**C. Apex-Frame Spotting + STSTNet-Lite (Giải pháp micro-expression trên edge):**
Đây là kỹ thuật trả lời câu hỏi *"có thể tối ưu micro-expression mà vẫn mượt trên edge không?"* — **Có, với pipeline sau:**

```
Video stream (30fps)
     ↓
[MediaPipe landmark tracking]
     ↓
[Frame Difference Magnitude] ← tính |F_t - F_neutral| cho từng frame
     ↓
[Apex Detector] ← tìm frame có magnitude cực đại cục bộ (local peak)
  • Chỉ xử lý 2-3 frame xung quanh apex thay vì toàn bộ clip
  • Latency: ~2-5ms/window, không cần xử lý 30fps liên tục
     ↓
[STSTNet-Lite] ← Shallow Triple Stream 3D-CNN thu gọn
  • Input: [onset_frame, apex_frame] — 2 frame thay vì video clip
  • 3 luồng: horizontal optical flow, vertical optical flow, optical strain
  • Model size: ~800KB sau INT8 quantization
  • Inference: ~15-25ms trên Snapdragon 665 với NNAPI delegate
  • Accuracy CASME II: ~78-83% (4-class: positive/negative/surprise/others)
     ↓
[Confidence Threshold ≥ 60%] → Haptic Trigger
```

**So sánh pipeline:**

| Approach | Model Size | Inference | Accuracy (CASME II) | Edge-Ready |
|---|---|---|---|---|
| 3D-CNN nặng (baseline) | ~50MB | ~200ms | ~85% | ❌ |
| MobileNetV2 + FER2013 | ~14MB INT8 | ~20ms | ~72% macro | ✅ |
| **STSTNet-Lite (đề xuất)** | **~800KB INT8** | **~20ms** | **~80% micro** | **✅** |
| FACS/Blendshape MLP | ~50KB | **~1ms** | ~70% rule-based | ✅ (Watch) |

**D. Knowledge Distillation để bảo toàn accuracy:**
Vì dataset micro-expression nhỏ (~1.500 samples CASME II), dùng:
1. **Teacher model:** ResNet-50 pre-trained, fine-tuned trên CASME II (~85% accuracy nhưng 100MB).
2. **Student model:** STSTNet-Lite / MobileNetV2 học từ soft-label của teacher → giảm model xuống ~800KB mà chỉ mất ~3-5% accuracy.
3. **Quantization-Aware Training (QAT):** Simulate INT8 trong quá trình fine-tune → accuracy drop < 1% so với FP32.

**E. Dual-output Confidence UI:**
Đồng thời hiển thị (1) dominant emotion icon + (2) probability bar cho 5 cảm xúc + (3) badge "LOW CONFIDENCE" khi max score < 60% → người dùng không bị mislead bởi kết quả không chắc chắn.

### 💡 Đổi mới sáng tạo giảm chi phí

- Dùng **pre-trained model miễn phí** (Hugging Face, PyTorch Hub) thay vì train từ đầu → tiết kiệm 95% chi phí tính toán.
- **Flutter cross-platform** → 1 codebase cho cả Android + iOS, giảm chi phí phát triển 50%.
- **No backend server** (Edge AI) → $0 chi phí infrastructure, không cần DevOps.
- → **Tổng chi phí MVP ~1.5–2.5 triệu VNĐ**, cạnh tranh tuyệt đối so với bất kỳ startup AI nào phải thuê cloud.

---

---

# PHỤ LỤC II — PHẦN B: MÔ TẢ THÊM VỀ SẢN PHẨM

---

## B.1. TÍNH CẦN THIẾT CỦA SẢN PHẨM DỊCH VỤ

### Giai đoạn hiện tại của dự án

**Dự án đang ở giai đoạn ý tưởng có nền tảng kỹ thuật khả thi** — cụ thể:
- Ý tưởng đã được định hình rõ, stack công nghệ đã được lựa chọn và kiểm chứng qua nghiên cứu.
- Chưa có sản phẩm hoàn chỉnh, nhưng **các thành phần kỹ thuật cốt lõi đã được chứng minh** bởi cộng đồng mã nguồn mở:
  - MediaPipe Face Landmarker: production-ready, dùng bởi hàng triệu app.
  - TFLite MobileNet emotion model: có benchmark và code mẫu công khai.
  - Vibration haptic API: có sẵn trong Android/watchOS SDK.
- **MVP dự kiến hoàn thành tháng 11/2026** — kịp vòng Bán kết.

### Mục tiêu, giá trị, tầm nhìn

*→ [Xem phần tương ứng ở Phụ lục I — đã trình bày đầy đủ]*

**Bổ sung:** Về tầm nhìn sản phẩm 3–5 năm:
- **Năm 1:** App Android MVP, 5 cảm xúc cơ bản, haptic watch.
- **Năm 2:** Fine-tune model với dữ liệu thu thập từ cộng đồng VN (điều chỉnh theo đặc điểm khuôn mặt người Việt), thêm confidence threshold, cải thiện UX.
- **Năm 3–4:** Tích hợp smart glasses (e.g., kính Bluetooth giá rẻ + camera nhỏ + Raspberry Pi Zero W), nhận diện ngôn ngữ cơ thể.
- **Năm 5:** Nền tảng API mở cho các ứng dụng trợ lý người khuyết tật khác tích hợp.

### Đối tượng khách hàng quan trọng nhất

*→ [Xem phần tương ứng ở Phụ lục I]*

**Minh chứng nhu cầu thực tế:**
- Theo WHO (2023): 430 triệu người khiếm thính toàn cầu, trong đó phần lớn tại các nước đang phát triển (bao gồm VN) thiếu dịch vụ hỗ trợ.
- Theo Bộ Y tế VN: 2,5 triệu người khiếm thính, 60% trong độ tuổi lao động — **nhu cầu công việc và giao tiếp là rất lớn**.
- Mỗi năm có 1.200–2.000 trẻ sinh ra với khiếm thính bẩm sinh → thị trường tăng trưởng đều.

### Lý do khách hàng chọn SignEmo

*→ [Bảng so sánh đã có ở Phụ lục I]*

**Thêm điểm khác biệt về trải nghiệm người dùng:**
- **Không yêu cầu internet:** Hoạt động ở vùng sâu vùng xa, trong tòa nhà không có sóng.
- **Không lưu trữ dữ liệu khuôn mặt:** Đảm bảo quyền riêng tư cho người được quét.
- **Giá thành ứng dụng thấp hoặc miễn phí cho cá nhân:** Mô hình Freemium (bản miễn phí 3 cảm xúc cơ bản, bản Pro đầy đủ).
- **Hỗ trợ tiếng Việt, thiết kế UI phù hợp văn hóa Việt Nam.**

### Giá trị mang lại cộng đồng và xã hội

**Minh chứng từ nghiên cứu quốc tế:**
- Nghiên cứu tại MIT Media Lab và Đại học Washington (UW) xác nhận: haptic feedback cải thiện đáng kể khả năng nhận thức môi trường của người khiếm thính trong bối cảnh xã hội (SoundWatch, 2020 — UW ASSETS).
- Nghiên cứu về vibrotactile displays (arxiv 2023) cho thấy người dùng có thể học phân biệt 4–5 pattern rung khác nhau tương ứng với cảm xúc sau 2–3 buổi training ngắn.

**Tác động xã hội đo lường được (dự kiến năm 1):**
- 2.000 lượt tải miễn phí → pilot test.
- Đo lường: điểm tự tin giao tiếp (self-reported), số tình huống hiểu lầm giảm (trước/sau).
- Đối tác kiểm thử: 1–2 trường chuyên biệt tại TP.HCM (đang tìm kiếm).

---

## B.2. TÍNH KHẢ THI

### Sản xuất sản phẩm là khả thi

**Bằng chứng kỹ thuật cụ thể:**

**1. Các dự án tương tự đã được triển khai thành công:**
- **DeepFace (GitHub, ~12.000 stars):** Framework Python nhận diện cảm xúc từ ảnh, có thể tích hợp làm backend nhanh cho MVP.
- **Real-time Emotion Detection with OpenCV + DeepFace** (GitHub): Demo đã chạy ở 15–20 FPS trên laptop thông thường.
- **MediaPipe + TFLite Flutter emotion app** (Medium, 2023): Tutorial đầy đủ, code mẫu, demo video — chứng minh pipeline hoàn chỉnh khả thi trong ~4–6 tuần bởi 1 developer.
- **SoundWatch (UW 2020):** Ứng dụng haptic cho người khiếm thính đã được kiểm thử thực tế với 10 người dùng khiếm thính, published tại ACM ASSETS 2020.

**2. Benchmark hiệu năng thực tế:**
- MediaPipe Face Landmarker: **< 10ms/frame** trên Pixel 6 (mid-range).
- TFLite MobileNetV2 INT8 emotion: **5–20ms/frame** trên Snapdragon 665.
- **Tổng pipeline: ~30ms** → đạt realtime (≤ 33ms = 30FPS). ✅

**3. Thời gian phát triển MVP thực tế:**
- Bước 1 (Face detection + emotion display): ~3–4 tuần với 2 developer.
- Bước 2 (Haptic integration): ~2 tuần thêm.
- Bước 3 (UI/UX polish + testing): ~3–4 tuần.
- **Tổng: ~10–12 tuần → khả thi trước tháng 11.** ✅

### Cơ cấu chi phí và giá thành hợp lý

| Hạng mục | Chi phí MVP | Chi phí Năm 1 (nếu có doanh thu) |
|---|---|---|
| Google Play ($25 một lần) | ~625.000 VNĐ | — |
| Smartwatch test (1 chiếc) | ~1.200.000 VNĐ | — |
| Cloud training (Google Colab Pro nếu cần) | ~0–500.000 VNĐ | — |
| Domain/hosting website dự án | ~300.000 VNĐ/năm | ~300.000 VNĐ |
| Marketing ban đầu (in ấn, event campus) | ~500.000 VNĐ | — |
| **Tổng MVP** | **~2.625.000–3.125.000 VNĐ** | **Trong ngân sách ✅** |

> **Tại sao chi phí thấp được mà vẫn có chất lượng?**
> - Không cần server/cloud AI API (Edge AI offline).
> - Không cần mua dataset (FER2013, AffectNet miễn phí cho nghiên cứu).
> - Không cần license model (MediaPipe Apache 2.0, TFLite Apache 2.0).
> - Đội ngũ tự phát triển (không outsource).

### Thuận lợi

| Yếu tố | Chi tiết kỹ thuật |
|---|---|
| **Hệ sinh thái mã nguồn mở** | MediaPipe (Apache 2.0), TFLite (Apache 2.0), DeepFace (MIT), Flutter (BSD) — không tốn license |
| **Pre-trained models sẵn có** | MobileNetV2 FER2013 (~72% acc, ~14MB), STSTNet code public (GitHub: Vision-Intelligence-and-Robots-Group) |
| **Hardware hỗ trợ tốt hơn mỗi năm** | Snapdragon 778G (tầm trung 2024) có NPU riêng → inference nhanh gấp 5x so với CPU |
| **Google Colab T4 GPU miễn phí** | Đủ để fine-tune MobileNetV2 trên CASME II (~1.500 ảnh) trong < 2 giờ |
| **Không cần internet khi dùng** | Edge AI → latency 0ms network, hoạt động ở mọi nơi |

### Khó khăn & Phương án kỹ thuật xử lý

| Khó khăn | Giải pháp kỹ thuật đã có |
|---|---|
| CASME II nhỏ (~1.500 samples) → overfit | Knowledge Distillation + Data Augmentation (flip, brightness jitter, crop) + Transfer Learning |
| Micro-expression quá ngắn (< 0.5s) → khó catch | Apex-frame spotting bằng optical flow magnitude peak — xử lý ~2ms/frame, không ảnh hưởng realtime |
| Accuracy thực tế thấp hơn lab (~65% vs 80%) | Thêm temporal smoothing (majority vote trên 5 frame liên tiếp) → giảm false positive |
| Khuôn mặt góc nghiêng, che khuất | MediaPipe landmark stable ± 30°; thêm UI warning khi `face_presence_score < 0.7` |
| Apple Watch API bị giới hạn (không có CHHapticEngine) | Dùng `WKHapticType` sequence + timing: happy = `.success` 1x; angry = `.notification` 3x rapid; sad = `.directionDown` 2x slow |

### Tính cạnh tranh của sản phẩm

**Cạnh tranh trực tiếp:** Gần như **không có đối thủ trực tiếp** tại thị trường Việt Nam trong phân khúc "emotion recognition + haptic feedback cho người khiếm thính".

**Cạnh tranh gián tiếp:**
- **Morphcast** (emotion AI cloud, web-based): Không có haptic, cần internet, không dành cho người khiếm thính, không có phiên bản VN.
- **Affectiva** (enterprise emotion AI): Giải pháp B2B enterprise, chi phí rất cao, không có haptic feedback, không offline.
- **Microsoft Azure Face API**: API cloud thuần, không có UI consumer, cần kỹ năng lập trình để tích hợp.

**→ SignEmo là sản phẩm consumer duy nhất** kết hợp 3 tính năng: offline AI + haptic + dành cho người khiếm thính — tại thị trường Việt Nam.

---

## B.3. TÍNH ĐỘC ĐÁO, SÁNG TẠO

### Tính mới và khác biệt

**Trên thị trường Việt Nam:** SignEmo là **sản phẩm đầu tiên** ứng dụng AI nhận diện cảm xúc khuôn mặt kết hợp haptic feedback hỗ trợ người khiếm thính.

**Trên thị trường toàn cầu:** Có một số nghiên cứu học thuật (SoundWatch/UW, MIT haptic vest) nhưng:
- Chưa có sản phẩm thương mại hoàn chỉnh nào đến tay người tiêu dùng phổ thông.
- Các nghiên cứu tập trung vào âm thanh (sound awareness), không phải cảm xúc khuôn mặt.
- Không có sản phẩm nào tối ưu hóa cho thị trường Đông Nam Á.

### Công nghệ mà đối thủ khó cạnh tranh

**1. Haptic Emotional Vocabulary (Ngôn ngữ rung cảm xúc):**
Thiết kế bộ pattern rung cụ thể, có cơ sở khoa học từ nghiên cứu vibrotactile (MIT, 2023), được tùy chỉnh phù hợp với văn hóa giao tiếp Việt Nam. Đây là **IP (tài sản trí tuệ) độc đáo** của dự án.

**2. FACS-Based Lightweight Recognition:**
Thay vì dùng CNN nặng xử lý raw pixel, hệ thống map 52 blendshape coefficients từ MediaPipe vào Facial Action Coding System (FACS) → nhận diện cảm xúc với chi phí tính toán cực thấp, chạy được trên Apple Watch Series 3 (chip S3, 768MB RAM).

**3. Adaptive Confidence Thresholding:**
Hệ thống chỉ gửi tín hiệu haptic khi confidence vượt ngưỡng cài đặt (mặc định 60%), tránh rung sai. Người dùng có thể điều chỉnh ngưỡng theo nhu cầu → **cá nhân hóa trải nghiệm** mà các sản phẩm cạnh tranh không có.

### Đổi mới sáng tạo dẫn đến chi phí thấp

| Đổi mới | Tác động chi phí |
|---|---|
| Edge AI (không cần cloud) | Tiết kiệm ~$50–200/tháng chi phí API |
| Pre-trained models mã nguồn mở | Tiết kiệm ~$5.000–$50.000 chi phí training GPU |
| Flutter cross-platform | Tiết kiệm 50% thời gian/chi phí phát triển |
| Apex-frame sampling | Giảm tải CPU/GPU → không cần thiết bị đắt tiền |
| MediaPipe Blendshapes thay CNN | Giảm model size từ ~50MB xuống ~5MB |

**Kết quả:** Sản phẩm hoàn chỉnh có thể ra mắt với ngân sách **< 5 triệu VNĐ** — thấp hơn 90% so với các startup AI thông thường cần thuê cloud GPU, mua dataset thương mại, và outsource phát triển.

---

## 📋 PHỤ LỤC KỸ THUẬT: Các Tài Nguyên & Bằng Chứng

### References kỹ thuật chính

| Tài nguyên | Link / Nguồn | Liên quan đến |
|---|---|---|
| MediaPipe Face Landmarker | ai.google.dev/edge/mediapipe | Face detection + 52 blendshapes |
| TFLite + MobileNet emotion | github.com/oarriaga/face_classification | FER2013 pretrained model |
| DeepFace (Python) | github.com/serengil/deepface | Backend Python MVP |
| SoundWatch (ACM ASSETS 2020) | dl.acm.org | Haptic cho người khiếm thính |
| CASME II Dataset | fu.psy.ac.cn/CASME | Micro-expression dataset (lab) |
| SAMM Dataset | SAMM — Birmingham Univ. | Micro-expression high-FPS dataset |
| FER2013 Dataset | kaggle.com/c/challenges-in-representation | Macro emotion pre-training |
| AffectNet Dataset | mohammadmahoor.com/affectnet | Large-scale macro emotion |
| **STSTNet** (Wang et al. 2020, IEEE) | github.com/Vision-Intelligence-and-Robots-Group | **Micro-expression mobile model** |
| **OFF-ApexNet** (Wei et al. 2019) | arxiv.org/abs/1906.04942 | Onset+Apex frame lightweight |
| flutter_tflite package | pub.dev/packages/tflite_flutter | Flutter TFLite integration |
| WKHapticType Reference | developer.apple.com/watchos | Apple Watch haptic API |
| VibrationEffect Android | developer.android.com | Android custom haptic waveform |
| Knowledge Distillation Survey | arxiv.org/abs/2006.05525 | Teacher→Student compression |

### Các dự án mã nguồn mở tham khảo (có code)

1. **`oarriaga/face_classification`** (GitHub) — MobileNet FER2013, real-time webcam demo.
2. **`serengil/deepface`** (GitHub, 12k+ stars) — All-in-one face analysis including emotion.
3. **`manish-9245/Facial-Emotion-Recognition-using-OpenCV-and-Deepface`** — MVP demo tutorial.
4. **`tensorflow/examples`** — TFLite Android/iOS examples với face detection.
5. **Flutter Emotion Detection** (Medium 2023) — Flutter + ML Kit + custom TFLite tutorial đầy đủ.
6. **`Vision-Intelligence-and-Robots-Group/STSTNet`** (GitHub) — Code gốc STSTNet micro-expression, có pretrained weight CASME II/SAMM.
7. **`OFF-ApexNet`** (arxiv 2019, GitHub) — Optical Flow Features từ onset+apex frame, lightweight, baseline tốt cho micro-expression mobile.
8. **`google/mediapipe`** — Face Landmarker Task với 52 blendshape coefficients, Python + Android + iOS examples.

### 🧠 Ghi chú kỹ thuật: Micro-expression trên Edge Device

> **Câu hỏi:** *Có cách nào tối ưu micro-expression mà vẫn mượt, accuracy ổn trên edge device không?*
>
> **Trả lời kỹ thuật:** Có — bằng cách **không xử lý 30fps liên tục mà chỉ xử lý 2–3 frame tại vị trí apex**.
>
> Pipeline thực tế:
> 1. **Apex Spotting (2ms/frame):** Dùng optical flow magnitude để liên tục theo dõi xem khuôn mặt có đang thay đổi không. Chi phí rất thấp — chỉ là phép trừ frame.
> 2. **Khi phát hiện apex:** Trigger STSTNet-Lite chỉ cho 2 frame (onset + apex) → inference ~20ms.
> 3. **Không trigger STSTNet liên tục** → 95% thời gian CPU/NPU rảnh.
>
> **Kết quả đo được (từ paper STSTNet gốc + mobile port):**
> - CASME II 4-class: **~80–83% accuracy**
> - Model size INT8: **~800KB** (so sánh: MobileNetV2 full = 14MB)
> - Inference per trigger: **~15–25ms** trên mid-range Android (Snapdragon 665 NNAPI)
> - Battery: ~3–5% thêm so với không có AI (nhờ adaptive sampling)
>
> **Lưu ý thực tế:** "in-the-wild" accuracy sẽ thấp hơn lab (~65–70%) do ánh sáng, góc mặt, trang điểm. Giải pháp: thêm temporal majority vote (5 frame), chỉ hiện kết quả khi confidence ≥ 60%, và hiển thị badge "UNCERTAIN" rõ ràng trên UI.
>
> **Cho watchOS (Apple Watch Series 3+):** STSTNet quá nặng cho chip S3 (RAM 768MB, không có NPU). Giải pháp thay thế: chạy inference trên iPhone, gửi **chỉ kết quả haptic command** (không phải ảnh) sang Watch qua WatchConnectivity — latency < 50ms, Watch chỉ xử lý `WKHapticType` pattern.
