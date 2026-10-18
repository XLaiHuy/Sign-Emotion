> **Hồ sơ lịch sử — chưa kiểm chứng.** Đặc tả và phạm vi MVP hiện tại nằm tại [MVP_SPEC.md](../MVP_SPEC.md). Các con số kỹ thuật, thị trường và tài chính trong tài liệu này là đề xuất hoặc giả thuyết, không phải kết quả đã đạt.

# Kế Hoạch Cập Nhật Biểu Mẫu — SignEmo SVOUSTARTUP 2026

## Mục tiêu
Cập nhật `4-BIEU MAU-SVOUSTARTUP 2026.md` để đồng bộ với nội dung kỹ thuật trong `SignEmo_NoidungChinhDuAn.md`.  
**Chỉ chỉnh các phần kỹ thuật (techniques)** — không đụng tới business, marketing, tài chính, nhân sự.

---

## Phân Tích So Sánh — Các Phần Kỹ Thuật

### 📋 PHỤ LỤC I — TRANG 3: Phần 2 "Tính khả thi" (dòng 72–87)

#### ✅ Đã có (giữ nguyên):
- Flutter, MediaPipe Face Landmarker, 52 blendshape coefficients
- Apex-Frame Spotting, STSTNet-Lite ~800KB INT8, 15-25ms
- Knowledge Distillation từ ResNet-50
- Giới hạn haptic API smartwatch

#### ❌ Thiếu (cần thêm từ NoidungChinhDuAn):
- **Dòng 77** — Chưa đề cập benchmark cụ thể của bộ dữ liệu: CASME II accuracy ~78-83%, battery chỉ tăng 3-5%
- **Dòng 85** — Giải pháp smartwatch Apple Watch cần thêm: Inference chạy trên iPhone, gửi haptic command qua WatchConnectivity latency <50ms; dùng `WKHapticType` sequence
- **Dòng 86** — Thiếu giải pháp Android cụ thể: `VibrationEffect.createWaveform()` với timing pattern
- **Dòng 76** — Thiếu giải thích Adaptive Confidence Thresholding: chỉ trigger haptic khi confidence ≥ 60%

---

### 📋 PHỤ LỤC I — TRANG 3: Phần 3 "Tính độc đáo, sáng tạo" (dòng 88–101)

#### ✅ Đã có (giữ nguyên):
- Haptic Emotional Vocabulary với 4 pattern rung
- FACS-Based Lightweight Mapping MLP ~10K params, <1ms
- Bảo mật Edge AI Nghị định 13/2023

#### ❌ Thiếu (cần thêm từ NoidungChinhDuAn):
- **Chưa có Adaptive Confidence Thresholding:** Hệ thống chỉ gửi haptic khi confidence > 60%, người dùng có thể tùy chỉnh ngưỡng → cá nhân hóa trải nghiệm
- **Chưa có bảng so sánh pipeline kỹ thuật** đầy đủ:
  | Approach | Model Size | Inference | Accuracy | Edge-Ready |
  - 3D-CNN nặng ~50MB, 200ms, 85%
  - MobileNetV2 ~14MB INT8, 20ms, 72% macro
  - **STSTNet-Lite ~800KB, ~20ms, ~80% micro ✅**
  - FACS/Blendshape MLP ~50KB, 1ms, ~70% rule-based ✅
- **Chưa có Transfer Learning Macro→Micro (SOTA 2023-2024):** Pre-train FER2013/AffectNet → fine-tune CASME II/SAMM, accuracy cải thiện 8-15% (IEEE TAFFC 2023-2024)

---

### 📋 PHỤ LỤC I — PHẦN B "Mô tả thêm": Phần 2 "Tính khả thi" (dòng 153–178)

#### ✅ Đã có (giữ nguyên):
- STSTNet-Lite ~800KB, <10ms landmarker, 15-25ms inference
- Knowledge Distillation ResNet-50 → STSTNet-Lite ~80% accuracy
- oarriaga/face_classification 12.000+ stars
- Temporal majority voting 5 frame liên tiếp
- Apple Watch WKHapticType (đề cập)

#### ❌ Thiếu (cần thêm từ NoidungChinhDuAn):
- **Bảng khó khăn & giải pháp kỹ thuật chi tiết** (từ B.2 NoidungChinhDuAn):
  | Vấn đề | Giải pháp kỹ thuật |
  | Accuracy in-the-wild ~65% vs lab 80% | Temporal smoothing majority vote 5 frame + hiển thị badge "UNCERTAIN" khi max score <60% |
  | Khuôn mặt góc nghiêng, che khuất | MediaPipe landmark stable ±30°; UI warning khi face_presence_score <0.7 |
  | Apple Watch API bị giới hạn | WKHapticType sequence: happy=.success 1x; angry=.notification 3x rapid; sad=.directionDown 2x slow |
- **Benchmark pin thực tế:** Battery chỉ tăng ~3-5% so với không có AI nhờ adaptive sampling
- **Giải pháp Apple Watch cụ thể hơn:** Inference trên iPhone → gửi haptic command qua WatchConnectivity, latency <50ms

---

### 📋 PHỤ LỤC I — PHẦN B "Mô tả thêm": Phần 3 "Tính độc đáo, sáng tạo" (dòng 179–189)

#### ✅ Đã có (giữ nguyên):
- Haptic Emotional Vocabulary pattern 4 cảm xúc
- FACS-Based MLP ~10K params, <1ms
- Apex Spotting + STSTNet-Lite tiết kiệm CPU/NPU 90%

#### ❌ Thiếu (cần thêm từ NoidungChinhDuAn):
- **Adaptive Confidence Thresholding** (điểm thứ 3 trong B.3 NoidungChinhDuAn):
  Hệ thống chỉ gửi tín hiệu haptic khi confidence vượt ngưỡng (mặc định 60%), tránh rung sai. Người dùng có thể điều chỉnh ngưỡng → cá nhân hóa trải nghiệm mà các sản phẩm cạnh tranh không có.
- **Bảng đổi mới sáng tạo dẫn đến chi phí thấp** (từ NoidungChinhDuAn B.3):
  | Đổi mới | Tác động chi phí |
  | Edge AI (không cần cloud) | Tiết kiệm ~$50–200/tháng chi phí API |
  | Pre-trained models mã nguồn mở | Tiết kiệm ~$5.000–$50.000 chi phí training GPU |
  | Flutter cross-platform | Tiết kiệm 50% thời gian/chi phí phát triển |
  | Apex-frame sampling | Giảm tải CPU/GPU → không cần thiết bị đắt tiền |
  | MediaPipe Blendshapes thay CNN | Giảm model size từ ~50MB xuống ~5MB |

---

## Tóm Tắt Các Thay Đổi Kỹ Thuật Cần Thực Hiện

| # | Vị trí (dòng) | Loại thay đổi | Mức độ |
|---|---|---|---|
| 1 | Dòng 76–77 (Trang 3, Phần 2) | Thêm Adaptive Confidence Thresholding 60% + benchmark battery 3-5% | Bổ sung |
| 2 | Dòng 85–86 (Trang 3, Phần 2) | Thêm giải pháp Apple Watch WKHapticType cụ thể + Android VibrationEffect | Cập nhật |
| 3 | Dòng 94–97 (Trang 3, Phần 3) | Thêm Adaptive Confidence Thresholding + bảng pipeline so sánh | Bổ sung |
| 4 | Dòng 154–159 (Phần B, Trang 3) | Thêm benchmark pin 3-5% + Apple Watch inference trên iPhone | Bổ sung |
| 5 | Dòng 166–173 (Phần B, Tính khả thi) | Thêm bảng khó khăn & giải pháp kỹ thuật đầy đủ 3 rủi ro + WKHapticType | Cập nhật |
| 6 | Dòng 179–188 (Phần B, Tính độc đáo) | Thêm Adaptive Confidence Thresholding + bảng đổi mới chi phí | Bổ sung |

---

## Phần KHÔNG thay đổi (Business)
- Tất cả nội dung về doanh thu, tài chính, nhân sự
- Kế hoạch marketing, truyền thông
- Business Model Canvas
- Phụ lục III (Báo cáo hoàn thành)
- Phụ lục IV (Video)
- Phụ lục V (Tiêu chí chấm điểm)
