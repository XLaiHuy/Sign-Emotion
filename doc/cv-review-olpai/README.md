# Đánh giá bài CV OLP AI và framework tối ưu

- [Notebook Kaggle ngắn — 11 cell, import rồi Run All](kaggle_cv_short.ipynb).
- [Xem/copy code từng cell](KAGGLE_CELLS.md), [Python source](kaggle_cv_short.py).
- [01 — Đánh giá notebook, train 100%, lỗi lớp ít mẫu, SOTA và recipe đề xuất](01_DANH_GIA_NOTEBOOK.md).
- [02 — Framework chọn dữ liệu, preprocessing, model, loss và strategy; có bảng quyết định và ví dụ GTSRB](02_FRAMEWORK_TU_DUY_CV.md).
- [Thống kê train/validation từ ZIP ảnh gốc](dataset_audit.json).
- [Bằng chứng output đã lưu trong notebook](notebook_evidence.json).

Ngày cập nhật: 17/10/2026. Đã đọc notebook, thống kê ZIP và xem ảnh train/validation trực tiếp trong `dataset_cv` cạnh notebook. Các cải tiến là đề xuất chưa huấn luyện xác nhận. Điểm 0,9757947189 là validation Macro-F1 đã lưu, không phải điểm public/private test.

Có thể tái tạo hai file bằng chứng bằng Python standard library:

```powershell
python doc/cv-review-olpai/audit_sources.py
```

Script chỉ đọc notebook và ảnh train/validation trong ZIP ở đường dẫn gốc; không đọc answer keys và không train model.

Để tạo lại contact sheets và đo luma trên 600 ảnh lớp 16/34 bằng Windows PowerShell + System.Drawing:

```powershell
& ./doc/cv-review-olpai/audit_image_quality.ps1
```

- [Contact sheet lớp 16](class_16_train_validation.png), [lớp 34](class_34_train_validation.png): 16 ảnh train lấy mẫu + toàn bộ 60 validation mỗi lớp; không gán dự đoán model.
- [Chất lượng theo sample ID](class16_34_image_quality.csv), [tóm tắt](image_quality_summary.json).

## Chạy notebook ngắn trên Kaggle

1. Import `kaggle_cv_short.ipynb`, thêm dataset, bật GPU, sửa `ROOT` nếu khác đường dẫn.
2. Run All với `SIZE=64`, `GAMMA=False`: chạy CE64 trước. Không cần cài package hay Internet trong notebook Kaggle chuẩn.
3. Lượt sau thử `GAMMA=True`; sau đó mới đổi LR hoặc `BLOCKS`, từng biến. Tên run tự tách size, gamma, blocks, LR, seed và AMP.
4. Nếu có `A_ce48_best.pt` từ notebook cũ, thêm nó vào Input và đặt `BASELINE_CKPT`. Code so model mới / model cũ / ensemble 50/50 trên validation rồi chọn candidate F1 cao nhất.
5. Tải `submission_public.csv` và `submission_private.csv` trong `/kaggle/working/cv_short/`. Đúng cột **sample_id,label**, lần lượt 4.290 và 4.140 dòng; code đọc lại để kiểm tra ID, thứ tự và nhãn.

Code giữ tên layers để tương thích checkpoint MiniResNet cũ. Ảnh cache uint8; nhãn truy cập qua array; loader có pinned memory/persistent workers trên CUDA. AMP mặc định bật khi CUDA compute capability >=7; đây là lựa chọn khởi đầu, cần profile trên GPU thật. Muốn so riêng input 48/64 sát recipe FP32 cũ, đặt `AMP=False` cho cả hai lượt hoặc train cả hai bằng cùng code/mode.

Notebook mới chưa train đầy đủ trên Kaggle và không kèm điểm mới. Smoke check CPU đã xác minh forward khớp model cũ ở 48/64, số tham số, normalization, backward/update, checkpoint và ensemble khác resolution. Pipeline DataLoader/torchvision/pandas đầy đủ và nhánh CUDA AMP cần chạy trên Kaggle để xác nhận.

Muốn tạo lại notebook/Markdown sau khi sửa Python source:

```powershell
python doc/cv-review-olpai/build_kaggle_notebook.py
```
