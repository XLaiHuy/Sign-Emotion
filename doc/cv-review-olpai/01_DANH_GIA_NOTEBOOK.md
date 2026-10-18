# Đánh giá notebook GTSRB và kế hoạch tối ưu

Ngày cập nhật: 17/10/2026. Phạm vi: notebook `D:\Documents\OLPAI\output\shareable\De_1_Lay_diem_chac\1-task-cv.ipynb`, đề mô phỏng, dataset card, train/validation trong ZIP và ảnh trực tiếp tại `dataset_cv` cạnh notebook. `dataset_cv` là liên kết tới `D:\Documents\OLPAI\practice\datasets\exam1_cv`. Kết quả huấn luyện dưới đây là output đã lưu trong notebook; chưa chạy lại training hay đo trên GPU Kaggle.

## 1. Kết luận chính

**Đây là baseline tốt cho bài phân loại biển báo nhỏ, train từ đầu và có giới hạn thời gian.** Pipeline có nhiều quyết định đúng: giữ split có sẵn, thống kê normalization chỉ từ train, augmentation có xét ý nghĩa biển báo, stem stride 1, residual connections, kiểm tra overfit batch nhỏ, chọn checkpoint bằng Macro-F1 và kiểm tra lại sau khi load.

**Ưu tiên tiếp theo là giải thích lỗi lớp 16 và 34, kiểm chứng preprocessing/resolution và độ ổn định training.** Chưa có bằng chứng rằng cần backbone lớn hơn. Cũng chưa thể khẳng định đây là cấu hình tối ưu: notebook mới so sánh hai loss tại một seed, cùng một kiến trúc và input 48.

Đọc nhanh theo thứ tự: **mục 2.4–2.5 giải thích train 100% và lớp thiểu số; mục 4.2 là bằng chứng mới từ ảnh thật; mục 11 trả lời SOTA; mục 12 chốt cấu hình và kế hoạch thử.**

Hai tài liệu đi kèm:

- [Framework chọn pipeline và model](02_FRAMEWORK_TU_DUY_CV.md).
- [Thống kê kiểm tra dữ liệu](dataset_audit.json), [output notebook trích xuất](notebook_evidence.json), [script kiểm tra chỉ dùng Python standard library](audit_sources.py).

## 2. Notebook thực sự đã làm gì?

### 2.1. Bài toán và giới hạn

Đề yêu cầu phân loại một ảnh biển báo đã crop vào một trong 43 lớp, metric là Macro-F1 trên 43 nhãn cố định. Theo `DE_BAI.md` và `DATASET_CARD.md`, dữ liệu mô phỏng chia theo class và track từ phần training chính thức của GTSRB; pretrained weights không được phép. Tổng thời gian 4 giờ còn phải xử lý task NLP.

Điều này khác với benchmark GTSRB nguyên bản dùng official test riêng. **Không so sánh trực tiếp điểm hiện tại với accuracy trong paper hoặc leaderboard GTSRB.** Nguồn chính thức phân biệt rõ archive training và test. [GTSRB official archive](https://sid.erda.dk/public/archives/daaeac0d7ce1152aea9b61d9f1e19370/published-archive.html).

### 2.2. Cấu hình đã chạy

| Thành phần | Cấu hình |
|---|---|
| Train / validation | 26.399 / 4.380 ảnh |
| Lớp | 43; train ít nhất 120, nhiều nhất 1.530 ảnh/lớp, tỷ lệ 12,75 lần |
| Input | RGB, resize trực tiếp ảnh gốc thành 48×48, PIL bilinear |
| Normalization | Mean/std theo kênh từ train, thang pixel 0–1 |
| Augmentation | Affine ±8°, translate 5%, scale 0,95–1,05; brightness/contrast 0,15, saturation 0,10 |
| Backbone | MiniResNet width 32, blocks `(1,1,1,1)`, khoảng 1,237 triệu tham số |
| Head | Global average pooling → dropout 0,1 → linear 43 logits |
| Optimizer | AdamW, LR 1e-3, weight decay 5e-4 |
| Schedule | Warmup 2 epoch; cosine đến 1% base LR; tối đa 30 epoch |
| Batch / seed | 128 / 2026 |
| Gradient | Clip norm 5; chưa dùng AMP |
| Experiment A | CE thường |
| Experiment B | Weighted CE, trọng số tỷ lệ nghịch căn bậc hai tần suất lớp |
| Chọn checkpoint | Validation Macro-F1 cao nhất |

### 2.3. Kết quả được lưu

| Run | Best Macro-F1 | Epoch tốt nhất |
|---|---:|---:|
| A — CE, 48 | **0,9757947189** | 25 |
| B — weighted CE, 48 | 0,975492, theo bảng output làm tròn | 26 |

Checkpoint A load lại cho:

- Macro-F1: **97,5795%**.
- Accuracy: **98,4247%**, tương ứng 4.311 đúng / 4.380, **69 sai**.
- Validation CE: **0,0702286**.
- F1 sau reload khớp checkpoint theo assertion trong notebook.

Chênh lệch A–B khoảng **0,000303 F1**, tức **0,0303 điểm phần trăm**. Đây là kết quả một seed; chưa có cơ sở kết luận weighted CE luôn kém. Cũng không có lý do để trả thêm độ phức tạp chỉ vì B có chữ “weighted”.

`RUN_RESOLUTION_64=False`: **64 chưa được thử trong run này**. Notebook có định nghĩa `predict_test`, nhưng không thấy cell gọi tạo hai CSV nộp bài hay điểm public/private test. Điểm xác minh được ở đây là validation, không phải điểm leaderboard.

### 2.4. Train accuracy 100% có phải chỉ nhờ đoán lớp đông?

**Không. Chỉ đoán một lớp đông không thể tạo train accuracy gần 100% trên dataset này.** Lớp train đông nhất có 1.530/26.399 ảnh: luôn đoán lớp ấy chỉ đạt khoảng **5,80% accuracy train**. Trên validation, lớp lớn nhất chiếm 240/4.380: baseline chỉ đoán một lớp đạt khoảng **5,48% accuracy**, Macro-F1 khoảng **0,242%**. Model hiện tại đạt 98,42% accuracy và 97,58% Macro-F1 validation, nên đã phân biệt được nhiều lớp.

Train accuracy gần 100% nói rằng model học rất tốt các mẫu train, kể cả phần lớn mẫu lớp ít ảnh. Đây là số tổng hợp; chưa có train-eval report từng lớp để khẳng định lớp nào hoàn hảo. Output in bốn chữ số thập phân: một lỗi trên 26.399 mẫu vẫn có thể được làm tròn thành `1.0000`.

Vấn đề thực tế là **khả năng nhận ra mẫu mới của một vài lớp**. Lớp 16/34 có nhiều ảnh validation bị bỏ sót, dù train overall đã gần 100%. Có thể liên quan đến ít nguồn độc lập, điều kiện chụp hoặc quyết định phân lớp; chưa đủ bằng chứng tách nguyên nhân.

Hai phép đo cần bổ sung: train-eval không augmentation bằng checkpoint cuối cùng, và validation P/R/F1 cho đủ 43 lớp. Train accuracy ghi trong vòng lặp hiện là trên ảnh augmented, dropout bật, tham số được cập nhật trong epoch; nó không tương đương một phép đánh giá checkpoint cố định trên train.

### 2.5. Accuracy cao có che lỗi lớp ít mẫu không?

**Có thể có.** Accuracy cho mỗi ảnh trọng số ngang nhau nên lớp đông ảnh đóng góp nhiều; Macro-F1 cho mỗi lớp trọng số ngang nhau. Vì thế cần đọc đồng thời accuracy, Macro-F1 và per-class report.

Tuy nhiên, **không phải mọi lớp ít ảnh đều kém**. Các lớp 0, 19, 37 chỉ có 120 ảnh train mỗi lớp, ít hơn 16/34 có 240, nhưng không nằm trong 10 lớp F1 thấp nhất được in. Không thể lấy riêng tần suất lớp để giải thích tất cả lỗi. Weighted CE gần bằng CE về F1 tổng thể cũng chưa cho biết nó có cứu lớp 16/34 rồi làm giảm lớp khác hay không: cần per-class report của B.

Khi một lớp recall thấp nhưng precision 1, model đang bỏ sót lớp ấy; tăng weight là một giả thuyết cần thử. Khi precision cũng thấp, tăng weight có thể làm nhận nhầm nhiều hơn. Chọn giải pháp theo lỗi thật và điều kiện ảnh, không chỉ theo nhãn “minority”.

## 3. Những quyết định nên giữ

**Split:** Dùng `validation.csv` có sẵn phù hợp đề. Assertion ID không giao nhau là kiểm tra hữu ích, nhưng chỉ chứng minh ID không trùng; không tự chứng minh track độc lập.

**Data pipeline:** Convert RGB rõ ràng; cache uint8 tiết kiệm RAM; resize từ ảnh gốc; mean/std không dùng validation. Cache có resolution trong key nên có thể so sánh 48 và 64 đúng cách.

**Augmentation:** Không flip biển báo hoặc xoay quá mạnh. Điều này bảo vệ nhãn các mũi tên, ký hiệu và chữ số. RandomAffine có ý nghĩa hơn việc dùng nguyên preset augmentation cho ảnh tự nhiên.

**Backbone:** Stem 3×3 stride 1 giúp giữ chi tiết ban đầu. Với 48×48, feature maps lần lượt 48 → 48 → 24 → 12 → 6. Receptive field lớn nhất theo nhánh convolution trước GAP lần lượt 3 → 7 → 13 → 25 → 49. Thiết kế đủ để kết hợp thông tin gần và xa; không cần suy ra “mạng càng sâu càng hợp ảnh nhỏ”.

**Debug và evaluation:** Batch 16 ảnh không augmentation giảm loss khoảng 3,803 → 0,000299 sau 120 update. Đây là bằng chứng tốt rằng luồng ảnh–nhãn–gradient hoạt động. Checkpoint lưu cấu hình, size và mean/std giúp inference tái hiện preprocessing.

## 4. Bằng chứng quan trọng nhất: lỗi tập trung ở đâu?

Từ classification report trong notebook:

| Class ID | Precision | Recall | F1 | Support | Suy ra TP / FN |
|---|---:|---:|---:|---:|---:|
| 16 | 1,0000 | 0,5167 | 0,6813 | 60 | 31 / **29** |
| 34 | 1,0000 | 0,6833 | 0,8119 | 60 | 41 / **19** |
| 36 | 0,8219 | 1,0000 | 0,9023 | 60 | 60 / 0 |
| 41 | 0,8571 | 1,0000 | 0,9231 | 30 | 30 / 0 |
| 30 | 1,0000 | 0,8667 | 0,9286 | 60 | 52 / 8 |
| 38 | 0,9170 | 1,0000 | 0,9567 | 210 | 210 / 0 |

**Hai lớp 16 và 34 chứa 48/69 lỗi, khoảng 69,6%.** Cả hai có precision 1 nhưng recall thấp: model ít chọn hai lớp đó và bỏ sót nhiều ảnh thật của chúng. Một số lớp khác có recall 1 nhưng precision thấp, tức đang nhận nhầm ảnh từ lớp khác. Chưa có confusion matrix dạng số hoặc prediction theo ảnh để khẳng định các cặp nhầm cụ thể.

Macro-F1 là trung bình F1 từng lớp. Riêng phần thiếu hụt so với F1=1 của hai lớp 16 và 34 đóng góp:

`[(1 − 0,681319) + (1 − 0,811881)] / 43 ≈ 0,011786`.

Tức khoảng **1,179 điểm phần trăm Macro-F1**, gần một nửa tổng khoảng cách tới 100%. Đây là phép phân rã metric, **không phải lời hứa cải thiện đạt được**; sửa dự đoán còn làm thay đổi precision của các lớp liên quan.

### 4.1. Kiểm tra độc lập trên ZIP ảnh gốc

Đã đọc PNG headers và SHA-256 file của toàn bộ 30.779 ảnh train/validation, không đọc answer keys.

| Thống kê | Train | Validation |
|---|---:|---:|
| Median width / height | 43 / 43 | 43 / 43 |
| P10–P90 width | 30–82 | 30–83 |
| Cạnh ngắn <32 | 16,84% | 15,62% |
| Cạnh ngắn <48 | 61,95% | 62,03% |
| Cạnh ngắn <64 | 82,56% | 82,69% |
| Median width / height lớp 16 | **41 / 42** | **65 / 65,5** |
| Median width / height lớp 34 | 39 / 43 | 42 / 42 |

Median width và height tính riêng từng chiều, không nhất thiết là kích thước của một ảnh thực tế. Không thấy file bytes trùng trong mỗi split hoặc giữa train và validation. Kiểm tra này chưa loại được ảnh gần trùng, pixel trùng nhưng encoding khác, hoặc cùng track. Participant CSV đã dùng ID ẩn danh; thông tin chia theo track lấy từ dataset card, chưa tái dựng độc lập.

**Suy luận:** 48 là điểm khởi đầu hợp lý. Thử 64 có thể giữ thêm chi tiết từ ảnh vốn lớn hơn 48, đặc biệt đáng kiểm tra với lớp 16. Tuy nhiên, median lớp 16 khác nhau không chứng minh resize là nguyên nhân 29 lỗi: cần nối `sample_id → ảnh → kích thước → prediction → margin` rồi xem lỗi có cùng điều kiện hay không.

### 4.2. Kiểm tra mới: ánh sáng và che khuất trên ảnh thật

Đã xem 16 ảnh train lấy đều theo thứ tự CSV và **toàn bộ 60 ảnh validation** của từng lớp 16/34. Hai contact sheet hiển thị nhãn ground truth; **không phải danh sách ảnh model dự đoán sai**:

- [Lớp 16 — train mẫu và toàn bộ validation](class_16_train_validation.png).
- [Lớp 34 — train mẫu và toàn bộ validation](class_34_train_validation.png).
- [Thống kê chất lượng ảnh 16/34 theo sample ID](class16_34_image_quality.csv).
- [Heatmap confusion matrix gốc từ notebook](notebook_confusion_matrix.png).

**Lớp 16:** validation có các cụm rất tối và rất sáng; nhiều ảnh nhìn gần như cùng biển trong một chuỗi. Định lượng trên toàn bộ 240 ảnh train + 60 validation:

| Chỉ báo ảnh gốc | Train lớp 16 | Validation lớp 16 |
|---|---:|---:|
| Mean luma <60/255 | 55/240 = 22,9% | 30/60 = 50,0% |
| Mean luma >150/255 | 18/240 = 7,5% | 28/60 = 46,7% |

Mean luma ở đây là trung bình `0,2126R + 0,7152G + 0,0722B` trên RGB mã hóa của toàn ảnh, thang 0–255; chỉ là chỉ báo mô tả, không phải đo phơi sáng vật lý. Ngưỡng 60 và 150 được chọn để mô tả, không phải ngưỡng inference đã tune. Nền cũng ảnh hưởng chỉ báo này.

**Lớp 34:** nhiều ảnh validation có nhãn dán/vật che trên mũi tên; contact sheet train lấy mẫu không cho thấy mức che tương tự rõ rệt. Đây là quan sát về mẫu đã xem, chưa chứng minh toàn bộ train thiếu che khuất hoặc các ảnh che chính là 19 ảnh sai.

**Ý nghĩa cho strategy:** thêm chẩn đoán theo brightness, kích thước và che khuất trước khi đổi backbone. Đáng thử gamma/exposure augmentation và giữ chi tiết, còn class weighting không tự tạo thêm biến thiên ánh sáng hoặc khôi phục mũi tên bị che. Con số 29 lỗi lớp 16 gần với 30 ảnh tối **không chứng minh** 29 lỗi nằm ở nhóm tối; cần logits/predictions từng sample để xác định.

Protocol đề gom theo track. Ảnh trực quan cho thấy tương quan cao, nhưng ID đã ẩn danh; chưa có track mapping hợp lệ để xác nhận số track hoặc tính confidence interval theo track. Không lấy các chuỗi giống nhau làm hàng chục bằng chứng độc lập.

## 5. Thứ tự tối ưu có khả năng đáng công nhất

### Ưu tiên 1 — Xuất hồ sơ lỗi trước khi train thêm

Với A và B, lưu cho từng ảnh validation: `sample_id`, nhãn thật, nhãn dự đoán, top-2 classes, top-2 logit margin, logits/probabilities, width/height gốc, loss. Dùng đúng thứ tự `valid_df` vì loader không shuffle.

Xem contact sheet của **toàn bộ 69 ảnh sai**, chia theo true class và predicted class. Đặt cạnh chúng một số ảnh train cùng lớp. Hỏi lần lượt:

1. Lỗi có tập trung vào ảnh mờ, tối, cháy sáng, góc xiên, crop thiếu hoặc méo hình không?
2. Có phải gần như cả một chuỗi ảnh cùng biển đều sai không?
3. Mẫu sai có chi tiết phân biệt nhỏ bị resize làm mất không?
4. Margin nhỏ hay model sai với margin rất lớn?
5. A và B có sửa được lỗi cho nhau không?

Margin thấp có thể phù hợp ensemble/TTA hoặc điều chỉnh decision boundary; margin cao cùng một kiểu hình ảnh gợi ý cần sửa representation/dữ liệu. Margin chỉ là tín hiệu chẩn đoán, không phải kết luận nhân quả.

### Ưu tiên 2 — Preprocessing: 64 và hình học

**Thử 48 → 64 trước**, giữ CE, backbone và recipe để đo tác động. Lấy ảnh từ file gốc, tính train stats đúng pipeline. Chi phí không gian xấp xỉ `(64/48)^2 ≈ 1,78` lần ở các tầng convolution, nhưng thời gian thực phải đo.

**So sánh square resize với giữ tỷ lệ + padding** ở cùng size nếu contact sheet cho thấy biến dạng. Train có ảnh tỷ lệ dài/ngắn tới khoảng 2,72, nên câu hỏi này có cơ sở. Padding cũng có thể làm biển nhỏ hơn và thêm viền; không mặc định tốt hơn warp. Thử một chính sách padding cố định, tính lại stats và áp dụng nhất quán train/valid/test.

**Thử luminance/gamma có mục tiêu** nếu lỗi tập trung vùng sáng/tối. ColorJitter hiện tại biến đổi khá nhẹ; nó không mô phỏng đầy đủ thiếu sáng, ánh sáng không đều hoặc cháy sáng. Có thể thử một nhánh augmentation gamma, blur nhẹ hoặc noise với xác suất thấp. Chỉ thêm điều kiện thật sự thấy trong dữ liệu.

**CLAHE là ablation, không phải mặc định.** Nếu thử, xử lý kênh sáng thay vì equalize độc lập RGB; quan sát vùng tối vì CLAHE có thể khuếch đại noise. Áp dụng cùng hợp đồng preprocessing khi suy diễn. Không cần đưa grayscale thành input chính khi màu biển có thông tin.

Tránh sharpen/super-resolution để “tạo lại” ký hiệu không có trong ảnh. Nội suy tăng size không tạo thông tin gốc; generative enhancement có thể thay đổi chính chi tiết quyết định nhãn.

### Ưu tiên 3 — Ổn định training trước khi mở rộng model

Train accuracy tiến tới 100%, trong khi validation có các nhịp tụt: A epoch 15 khoảng 0,9198; B epoch 6 khoảng 0,7899 rồi phục hồi. Chưa thể quy hết cho overfit hoặc BatchNorm. Train metric hiện đo với augmentation, dropout và tham số thay đổi trong epoch; không so trực tiếp nó với validation eval như hai phép đo cùng điều kiện.

Các kiểm tra có ích:

- Đo thêm train-eval trên một subset cố định không augmentation.
- Lưu validation loss, class recall và thời gian mỗi epoch; hiện history có metric nhưng output chưa in đủ.
- Thử LR `5e-4` so với `1e-3`, giữ biến khác; quan sát ổn định và chất lượng cuối lịch.
- Nếu dùng EMA, thử decay khoảng `0,99–0,999` **theo optimizer step**, cập nhật sau optimizer. Khoảng này là search gợi ý, không phải kết quả đã xác minh.
- Với model có BatchNorm, có chính sách rõ ràng cho buffers. Khi cần, recalibrate running statistics bằng **train** không augmentation và chỉ bật BN ở train mode, giữ dropout tắt; đánh giá bản recalibrated như một candidate riêng.

PyTorch có `AveragedModel`, EMA và tiện ích cập nhật BatchNorm. EMA trung bình tham số qua thời gian; không bảo đảm sửa lỗi có hệ thống. [PyTorch averaging documentation](https://docs.pytorch.org/docs/2.14/optim.html).

### Ưu tiên 4 — Regularization và loss có chọn lọc

| Kỹ thuật | Thử khi nào | Phạm vi khởi đầu gợi ý |
|---|---|---|
| Label smoothing | Train-eval tốt nhưng generalization kém, logits quá cực đoan | `ε ∈ {0, 0,03, 0,05}` |
| Mixup nhẹ | Cần regularization, labels sạch | `α=0,1–0,2`, có thể chỉ dùng một phần batch |
| Weighted CE | Lớp ít mẫu bị bỏ sót trên nhiều seed | Giữ CE đối chứng; thử exponent `β=0,25/0,5` |
| Balanced sampling | Một số lớp thiếu exposure thực sự | Thử riêng, ghi rõ samples/epoch và số update |
| Logit adjustment | Mất cân bằng decision boundary; có validation đủ tin cậy | Một tham số toàn cục, đối chiếu CE và recall/precision |

Mixup kết hợp cả input và target; khi dùng thì train accuracy theo hard label không còn diễn giải như trước. [Mixup paper](https://arxiv.org/abs/1710.09412). Với biển báo nhỏ, CutMix/RandomErasing có thể che đúng chữ số/mũi tên trong khi target theo diện tích không phản ánh lượng thông tin; ưu tiên thấp hơn.

Logit adjustment có thể dùng trong training hoặc hậu xử lý; hai cách không dùng cùng dấu một cách máy móc. Biến thể hậu xử lý điển hình với CE model dùng `z'_c = z_c − τ log π_c`. Đây là hướng nghiên cứu về long-tail/balanced error, **không phải tối ưu Macro-F1 được bảo đảm**. Không vừa reweight, oversample vừa điều chỉnh prior ngay từ đầu. [Long-tail learning via logit adjustment](https://arxiv.org/abs/2007.07314).

**Temperature scaling một scalar dương không đổi argmax của single model**, nên không tự tăng hard-label Macro-F1; nó có ích cho calibration hoặc phối hợp probabilities trong ensemble. Tune 43 class bias trên validation chỉ có 30–60 ảnh ở một số lớp rất dễ overfit; không ưu tiên.

### Ưu tiên 5 — Backbone nào nên thử?

| Candidate | Vì sao có thể hợp | Điều phải đo |
|---|---|---|
| Giữ MiniResNet, input 64 | Kiểm tra mất chi tiết, ít thay đổi code | F1 lớp 16/34, toàn cục, phút train |
| MiniResNet `(2,2,2,2)`, width 32 | Tăng depth trong cùng thiết kế giữ resolution | Cần recipe đủ hội tụ; tránh kết luận từ run bị cắt sớm |
| MiniResNet width 48, blocks cũ | Tăng channels, ít tầng hơn phương án tăng depth | Chi phí nhiều convolution xấp xỉ theo width² |
| CIFAR-style WideResNet nhỏ, chẳng hạn WRN-16-4 | Một hướng CNN cho ảnh nhỏ; dễ thử depth–width có kiểm soát | Train từ đầu, recipe và thời gian trên GPU thực tế |
| ResNet-18 sửa stem 3×3 stride 1, bỏ maxpool | Đối chứng kiến trúc quen thuộc | Nặng hơn baseline; không giữ nguyên stem ImageNet |
| STN + CNN | Lỗi chủ yếu do lệch vị trí, scale, góc nhìn | Identity init, crop ngoài ảnh, mất nét do resampling |
| MobileNet/EfficientNet nhỏ | Có yêu cầu inference nhẹ trên thiết bị đích | Latency thực tế; FLOPs thấp không bảo đảm train GPU nhanh |

WideResNet cung cấp bằng chứng rằng cân đối width/depth hữu ích trên các benchmark ảnh nhỏ; điều đó chưa chứng minh nó thắng notebook này. [Wide Residual Networks](https://arxiv.org/abs/1605.07146).

STN học phép biến đổi không gian có điều kiện theo ảnh. Nó đáng thử khi lỗi hình học được xác nhận; việc thêm một lần nội suy vào ảnh nhỏ cũng có thể làm mất nét. [Spatial Transformer Networks](https://arxiv.org/abs/1506.02025).

ResNet-50, ConvNeXt lớn hay ViT lớn từ đầu chưa có lý do ưu tiên trong ràng buộc này. Nếu một cuộc thi khác cho phép pretrained, phải đánh giá lại lựa chọn: chất lượng pretraining và domain match có thể quan trọng hơn tên họ kiến trúc.

## 6. Synthetic data: nên làm gì cho bài này?

**Bắt đầu bằng augmentation mô phỏng quá trình chụp ảnh**, vì đã có hơn 26 nghìn ảnh nhưng tính đa dạng độc lập có thể thấp do tracks.

Một chuỗi degradation đáng kiểm chứng là: ảnh nguồn → biến đổi góc nhìn nhỏ → blur quang học/chuyển động nhẹ → downsample → noise/compression → resize input. Chuỗi này chỉ là mô hình gần đúng, cần xem mẫu và tune theo ảnh thật. Không tạo cả chuỗi quá mạnh khiến người cũng không đọc được nhãn.

Nếu cần sinh procedural, dùng tài nguyên được phép từ train: warp/crop/biến đổi ảnh train và đa dạng điều kiện chụp; chỉ ghép nền khi tách foreground đủ đúng. Tạo sẵn nhiều bản gần giống không tăng số biển hoặc bối cảnh độc lập tương ứng.

Thiết kế ablation nhỏ: real-only đối chiếu batch có khoảng 10% hoặc 25% synthetic. Hai tỷ lệ này là điểm thử, không phải công thức. Giữ validation hoàn toàn real, cùng số optimizer updates hoặc ghi rõ compute tăng; chấm theo điều kiện ảnh và lớp. Có thể fine-tune cuối trên real-only nếu thí nghiệm cho thấy synthetic gây lệch.

Với đề này, generator pretrained hoặc mẫu ngoài tập được phép có thể vi phạm quy định học từ đầu; không đưa vào recipe mặc định. Pseudo-labeling public/private test cũng không phù hợp quy định không huấn luyện trên test. Nếu cuộc thi khác cho phép unlabeled data, phải xác định lại phạm vi trước khi dùng.

**Không ưu tiên diffusion cho ký hiệu biển báo:** vừa tốn công vừa phải kiểm tra chặt chữ số, mũi tên và nhãn. Dữ liệu sinh chỉ có giá trị nếu bổ sung biến thiên đang thiếu và cải thiện trên validation real độc lập.

## 7. Những kỹ thuật kinh nghiệm thường có giá trị hơn “đổi model”

1. **Tối ưu theo lỗi có trọng lượng metric.** Ảnh sai lớp hiếm có thể ảnh hưởng Macro-F1 nhiều hơn nhưng phải xét cả false positives của lớp nhận nhầm. Không dùng class frequency làm chẩn đoán duy nhất.
2. **Đếm nguồn độc lập.** Theo dataset card, khoảng 30 ảnh/track khiến 26.399 ảnh chỉ tương ứng cỡ 880 track nếu chia gần đủ chuỗi; đây là ước lượng, không phải số track đã xác minh. 60 ảnh validation có thể chỉ đại diện vài tình huống chụp.
3. **Ensemble theo sự bổ sung lỗi.** A và B gần bằng điểm vẫn có thể phối hợp tốt nếu sai các ảnh khác nhau. So sánh trung bình probabilities 50/50 trên validation trước khi train run thứ ba; chưa có checkpoints ở thư mục được xem để thực hiện phép thử này.
4. **Giữ danh tính hàng khi lưu logits.** Ensemble/TTA sai thứ tự `sample_id` có thể phá toàn bộ kết quả mà code vẫn chạy.
5. **TTA phải bảo toàn nhãn.** Thử original + vài dịch chuyển rất nhỏ có padding; không flip, không crop mất biển. Đo cả F1 và thời gian; TTA cũng có thể làm xấu ảnh gần biên.
6. **Không average weights của hai model độc lập tùy tiện.** Average probabilities là ensemble; SWA/EMA có giả định và cách xử lý BN khác. Hai seed không được căn chỉnh có thể average weights rất kém.
7. **Search ít nhưng đủ hội tụ.** Model 64 bị dừng giữa cosine không thể kết luận yếu hơn model 48 được chạy hết. So sánh cả recipe quality và chất lượng trong cùng ngân sách thời gian.
8. **Đừng tối ưu vào vài track validation.** Chốt số trial; cấu hình thắng phải kiểm tra nhiều seed. Nếu có group IDs hợp lệ trong training, dùng thêm group holdout từ training. Không tự dựng track từ ID hash hoặc mở answer keys để tối ưu.
9. **SAM là lựa chọn sau cùng trong ngân sách chặt.** Nó tối ưu độ sắc của nghiệm nhưng thường cần thêm forward/backward; phải cân đối với một run seed/64 mới. [SAM paper](https://arxiv.org/abs/2010.01412).

## 8. Những điểm code nên chỉnh khi làm phiên bản tiếp

### 8.1. Sửa cách lấy metric

Hiện tại:

```python
val_f1 = val_metrics.get("macro_f1") or val_metrics.get("macro_f1: ")
```

Nếu F1 thật sự bằng 0, toán tử `or` chuyển sang nhánh sau và có thể trả `None`. Dùng hợp đồng key rõ ràng:

```python
val_f1 = float(val_metrics["macro_f1"])
if not math.isfinite(val_f1):
    raise RuntimeError("Validation Macro-F1 is not finite")
```

Không ảnh hưởng run đang lưu vì F1 đều lớn hơn 0, nhưng là lỗi biên thực sự.

### 8.2. Runtime và khả năng tái hiện

- Loader trong `train_experiment` chưa dùng `pin_memory` như loader ban đầu. Có thể thử thêm `pin_memory=True` và `.to(..., non_blocking=True)` trên CUDA; hiệu quả phải đo.
- Với workers >0, thử `persistent_workers=True`; đo data wait và thời gian cả epoch. Với ảnh rất nhỏ, PIL transforms và `frame.iloc` từng mẫu có thể thành bottleneck. Có thể lưu labels thành NumPy array và thử batch transforms.
- AMP trên GPU phù hợp có thể tăng throughput; cần so sánh loss/metric và dùng đúng trình tự **unscale trước clip** khi dùng GradScaler. [PyTorch AMP examples](https://docs.pytorch.org/docs/2.14/notes/amp_examples.html).
- Seed chưa đồng nghĩa bitwise deterministic. Lưu GPU, Python/PyTorch/torchvision/CUDA, workers và cấu hình determinism. Metadata notebook nói accelerator none nhưng output runtime nói CUDA; ưu tiên log thiết bị thực ở lần chạy sau.
- Time cap hiện bắt đầu sau preprocessing, chỉ kiểm tra sau mỗi epoch. Nó không phải giới hạn wall-clock chặt cho cả thí nghiệm. Cần đo thời gian còn lại, epoch dự kiến và inference/submission; khi dừng sớm phải ghi số update và vị trí trên schedule.
- Checkpoint đủ cho inference nhưng thiếu optimizer/scheduler/RNG để resume đúng quỹ đạo. Nếu cần resume, thêm các state đó.
- Notebook chưa viết initializer riêng. Tài liệu tham khảo đề xuất Kaiming cho ReLU không đồng nghĩa notebook đã chủ động áp dụng cấu hình ấy. Mọi thay đổi initializer nên là trial riêng, không gọi là sửa lỗi đã chứng minh.

### 8.3. Đánh giá và nộp bài

Lưu per-class report, numeric confusion matrix, logits và history đầy đủ cho từng run, kể cả weighted B. Export hai CSV bằng thứ tự sample ID từ từng split, kiểm tra đúng 2 cột, đủ dòng, ID duy nhất và nhãn nguyên trong `[0,42]`. Theo dataset card: public 4.290, private 4.140; đây là yêu cầu định dạng, không phải kết quả đã tạo.

Demo `evaluate([0,1,2,2,1], ...)` cho F1 thấp vì cố định đủ 43 lớp và 40 lớp vắng bị tính 0. Điều đó phù hợp metric đề, không phải lỗi sklearn; giải thích rõ để không đọc nhầm kết quả debug.

## 9. Kế hoạch thí nghiệm gọn

| Bước | Trial | Câu hỏi quyết định |
|---|---|---|
| 0 | Load A/B, xuất logits, ảnh sai và numeric CM | Sai do hình học, chi tiết, chất lượng hay decision boundary? |
| 1 | CE48 seed mới | Baseline dao động bao nhiêu? |
| 2 | CE64 cùng seed đối chứng | Giữ chi tiết có giúp lớp yếu không? |
| 3 | Chọn một: padding, gamma/degradation hoặc EMA | Chẩn đoán ở bước 0 dự đoán cải thiện nào? |
| 4 | Chỉ khi còn ngân sách: depth hoặc width | Representation lớn hơn có thêm giá trị? |
| 5 | A/B hoặc hai seed ensemble, TTA nhỏ | Có sửa lỗi bổ sung trong thời gian inference cho phép? |
| 6 | Chốt recipe, kiểm tra nhiều seed nếu đủ thời gian | Điểm tăng có lặp lại và có đáng chi phí? |

Không chạy nguyên một full grid. Search LR thô `3e-4 / 1e-3 / 3e-3` chỉ khi cần và có budget; chọn coarse best rồi thử lân cận. Với run ổn hiện tại, `5e-4` là đối chứng ít tốn công hơn mở toàn bộ grid.

Nếu chỉ còn **một lượt train**, lựa chọn dự kiến của mình là **CE64 với MiniResNet hiện tại**, sau khi xem hồ sơ lỗi; nếu lỗi rõ ràng do ánh sáng hoặc crop thì ưu tiên sửa đúng nguyên nhân đó. Nếu chỉ còn thời gian inference, thử ensemble A/B trước. Chưa có cơ sở hứa một mức điểm cụ thể.

## 10. Đánh giá tài liệu bạn tham khảo

Tài liệu có nền tảng tốt: phân biệt receptive field với spatial resolution, resize với thông tin gốc, số ảnh với số nguồn độc lập; chọn loss theo target và đặt giả thuyết trước ablation.

Phần cần bổ sung để dùng như người có kinh nghiệm:

- Tách kết quả đã chạy khỏi cấu hình đề xuất: 64 chưa chạy, explicit Kaiming chưa có.
- Gắn metric vào lỗi thật: 48/69 lỗi thuộc hai lớp là bằng chứng quyết định hơn bảng model theo kích thước.
- Thiết kế validation và uncertainty theo nguồn ảnh; một seed không phân biệt được A–B ở chênh lệch 0,03 điểm phần trăm.
- Phân biệt training objective, calibration và decision rule; weighted CE không tối ưu trực tiếp Macro-F1.
- Phân biệt native resolution, input size, stride và kích thước chi tiết phân biệt.
- Tính cả throughput và inference/submission trong ngân sách thi.
- Đánh giá synthetic bằng mức tăng đa dạng có ích, không bằng số ảnh sinh ra.

Framework đi kèm triển khai các phần này thành quy trình có thể dùng lại.

## 11. SOTA của bài này là bao nhiêu?

### 11.1. Có hai bài toán đánh giá khác nhau

**Với split mô phỏng của bạn:** chưa có leaderboard/bảng so sánh độc lập cho đúng 26.399 train, 4.380 validation và Macro-F1. Do đó **chưa xác định được SOTA của split này**. Điểm 97,5795% Macro-F1 là baseline đã có của bạn, không thể đổi thành thứ hạng GTSRB chính thức.

**Với benchmark GTSRB 43 lớp:** các mốc accuracy rất cao dưới đây cho biết bài này còn có thể cải thiện, nhưng phải đọc đúng protocol. Tra cứu đến ngày 17/10/2026 không đủ để chứng nhận một vị trí số 1 tuyệt đối trên mọi publication và mọi cách dùng dữ liệu.

| Mốc | Accuracy được báo cáo | Nguồn và mức xác minh |
|---|---:|---|
| Deep Inception + Spatial Transformer, Haloi | **99,81%** | Tác giả nêu trực tiếp trong paper; mốc lịch sử. [Paper](https://arxiv.org/abs/1511.02992) |
| Ensemble 3 CNN với real + synthetic, DeLTA 2022 | **99,85% best**; repo báo mean 99,82 ± 0,02% | Kiểm tra trực tiếp paper và repo tác giả; best tương ứng 12.611/12.630 ảnh test. Có dùng synthetic/template. [Paper](https://www.scitepress.org/PublishedPapers/2022/113011/pdf/index.html), [repo tác giả](https://github.com/Nau3D/bridging-the-gap-between-real-and-synthetic-traffic-sign-datasets) |
| GR-CapsNet, Chen và cộng sự | **99,96% được nêu trong đối chiếu năm 2026** | Mục 4.3 của MASViT nêu mốc này cho GR-CapsNet trên ảnh test gốc. Chưa đọc được bảng kết quả gốc để xác nhận toàn bộ protocol. [Đối chiếu 2026](https://link.springer.com/article/10.1007/s00521-025-11821-2), [paper gốc](https://www.sciencedirect.com/science/article/pii/S0031320323008397) |

**Cách trả lời ngắn gọn:** GTSRB có các mốc công bố **trên 99,8% accuracy**, và tìm thấy mốc đối chiếu **99,96%**; hiện chưa đủ xác minh để gọi 99,96% là SOTA tuyệt đối cùng luật của đề bạn. Mốc 99,85% có paper và mã nguồn tác giả là tham chiếu cụ thể cho hướng real/synthetic ensemble. Cả hai đều không phải Macro-F1 validation của split mô phỏng.

Không nên lấy `99,96 − 97,58` làm khoảng cách tới SOTA: một bên là accuracy, một bên là Macro-F1, số ảnh train/test và điều kiện huấn luyện khác nhau. Ngay cả khi dùng accuracy 98,42% của bạn thì split vẫn khác.

### 11.2. Ví dụ vì sao cần đọc kỹ con số cao

Paper *Two-Stage Traffic Sign Classification System* báo **99,96% ở bước phân loại hình dạng**; bước phân lớp biển tròn/biển tam giác được báo riêng. Đó không phải bằng chứng classifier end-to-end 43 lớp đạt 99,96%. [Paper gốc](https://www.sciencedirect.com/science/article/pii/S1877050924009311).

Khi đánh giá một kết quả “SOTA”, kiểm tra: đủ 43 lớp không; official test 12.630 ảnh hay split tự chia; accuracy hay Macro-F1; single model hay ensemble; có external/synthetic/pretrained; có dùng test để chọn model; số seed và artifact có tái hiện được không. Các cột này cần giống mục tiêu của mình trước khi so số.

## 12. Kiến trúc + preprocessing + strategy mình đề xuất cụ thể

Đây là các candidate để **train xác nhận**, chưa phải bản đã chứng minh thắng A. Chia làm ba mức để bạn có quyết định thực dụng.

### 12.1. R1 — Lượt thử kế tiếp: MiniResNet64

```text
Input RGB 64×64, resize trực tiếp từ ảnh nguồn
Stem Conv3×3, 32 channels, stride 1 + BN + ReLU
Stage 1: 1 residual block, 32 channels, 64×64
Stage 2: 1 residual block, 64 channels, stride 2 -> 32×32
Stage 3: 1 residual block, 128 channels, stride 2 -> 16×16
Stage 4: 1 residual block, 256 channels, stride 2 -> 8×8
Global average pooling -> Dropout 0,1 -> Linear 43
```

Giữ khoảng 1,24 triệu tham số. Lý do chọn: giữ được code/recipe đã chạy, kiểm tra resolution mà không trộn thêm thay đổi backbone. 64 không phục hồi thông tin của ảnh gốc nhỏ, nhưng có thể giữ thêm chi tiết ở ảnh nguồn lớn và thay đổi mức lấy mẫu của đặc trưng.

| Thành phần | R1 cụ thể |
|---|---|
| Resize | Square bilinear để đối chứng trực tiếp A; padding là trial riêng |
| Normalize | Tính mean/std trên train sau resize 64; lưu vào checkpoint |
| Augmentation | Giữ recipe hiện tại: affine ±8°, translate 5%, scale 0,95–1,05, ColorJitter nhẹ |
| Loss | CE thường, label smoothing 0 |
| Optimizer | AdamW LR 1e-3, weight decay 5e-4 |
| Schedule | Warmup 2 epoch, cosine; 30 epoch nếu đủ wall-clock |
| Batch / seed | 128 / 2026 đối chứng A, rồi seed mới cho candidate thắng |
| Checkpoint | Macro-F1; đồng thời lưu P/R/F1 của đủ lớp, logits, validation loss |
| Đo thêm | Lớp 16/34, nhóm sáng/tối theo chỉ báo cố định, size bins, thời gian train/inference |

Nếu R1 cải thiện, chỉ có thể kết luận input 64 hữu ích trong recipe/seed đó; cần xác nhận độ ổn định. Nếu không cải thiện, xem nhóm lỗi có thay đổi không trước khi bỏ giả thuyết.

### 12.2. R1-D — Tăng tính đa dạng đúng điều kiện dữ liệu

Trên recipe tốt hơn giữa 48/64, thử **một nhánh photometric** vì đã thấy validation lớp 16 phân cực sáng/tối:

- Random gamma `γ ∈ [0,7; 1,5]`, xác suất khoảng 0,3, thao tác trên ảnh 0–1 trước normalize; theo định nghĩa `x' = x^γ`, gamma <1 làm sáng, >1 làm tối. Giữ các giá trị khác như đối chứng.
- Xem contact sheet để tránh tạo ảnh không còn thông tin. Gamma không hoàn toàn mô phỏng noise/cháy sáng thực tế; nếu cần, trial sau mới thêm degradation có kiểm soát.
- Blur/downsample nhẹ chỉ thử khi hồ sơ lỗi cho thấy model nhạy với độ nét; không stack ngay mọi augmentation.
- Với lớp 34 bị che ký hiệu, ưu tiên học từ nhiều mẫu/nguồn hợp lệ và giữ context. Một trial che nhỏ ngẫu nhiên có thể giúp robustness nhưng dễ phá nhãn; chỉ thử mức nhẹ và kiểm tra cả precision lẫn recall. Không lấy nhãn dán từ validation để thiết kế mẫu train giống hệt.

CLAHE trên luminance hoặc RGB + nhánh luminance là candidate riêng nếu gamma không giải quyết được vấn đề. Thêm nhánh không tự bảo đảm hơn RGB CNN. Nếu dùng CLAHE như preprocessing cố định, cần train và inference theo cùng hợp đồng.

### 12.3. R2 — Candidate kiến trúc khi còn ngân sách

**Ưu tiên thực dụng: MiniResNet width 32, blocks `(2,2,2,2)`, input 64**, giữ stem stride 1 và ba lần downsample. Theo công thức đếm layer, khoảng 2,81 triệu tham số; cần xác nhận bằng model thực khi triển khai. So với baseline, thêm residual blocks tại cùng resolution giúp kiểm tra representation giàu hơn, dù train accuracy cũ đã gần 100%.

Khả năng học thuộc train và chất lượng representation cho ảnh mới không đồng nhất; model lớn hơn vẫn có thể hữu ích, nhưng phải thắng validation với compute chấp nhận được. Thử R2 bằng recipe tốt đã xác lập, không thêm đồng thời weighted CE, mixup và STN.

Một đối chứng khác là **WRN-16-4**. Chọn giữa R2 và WRN theo thời gian triển khai/profile; trong kỳ thi ngắn, tăng blocks của code có sẵn thường ít tốn công hơn tích hợp họ model khác. **STN-CNN** để sau, khi cặp lỗi và ảnh chứng minh góc nhìn/căn chỉnh là vấn đề chính. GR-CapsNet là hướng nghiên cứu để tham khảo, không phải lựa chọn thi mặc định chỉ vì có điểm công bố cao.

### 12.4. Strategy tối ưu trong ngân sách thực

| Thứ tự | Thí nghiệm | Mục tiêu |
|---|---|---|
| 0 | Load A/B và xuất logits + CM dạng số | Ghép từng ảnh sai với điều kiện chụp; so lỗi A/B |
| 1 | CE64, cùng backbone/recipe | Phân lập tác động resolution |
| 2 | Giữ winner, thử gamma branch | Phân lập tác động đa dạng ánh sáng |
| 3 | Thử LR 5e-4 **hoặc** EMA decay 0,995/step | Kiểm tra độ ổn định; không đổi cả hai để gán nguyên nhân |
| 4 | R2 hoặc WRN nếu budget đủ | Kiểm tra representation/capacity |
| 5 | Xác nhận top recipe bằng seed mới | Tránh chọn chỉ vì may mắn ở seed 2026 |
| 6 | Ensemble 50/50 probabilities của hai candidate bổ sung lỗi | Tăng chất lượng nếu deadline inference cho phép |

Trong 4 giờ còn task khác, thường chọn 1–2 cải tiến có lý do thay vì chạy đủ bảng. Dự trù cả preprocessing, checkpoint, validation, inference và CSV. Nếu mọi run đã có checkpoint thì ensemble A/B có thể là phép thử rẻ trước lượt train tiếp theo.

Nếu dùng EMA, decay 0,995 có cửa sổ trọng số hiệu dụng cỡ 200 optimizer steps, gần một epoch với 207 batch/epoch hiện tại; đây là cách hiểu heuristic để chọn decay. Cần xử lý BN và đánh giá EMA riêng. Không average trực tiếp weights của hai model độc lập.

Nếu bật AMP, profile trên GPU Kaggle thật; P100/T4 có đặc điểm khác nhau. Clip gradients sau unscale khi dùng GradScaler. Lợi ích AMP/loader là tiết kiệm thời gian để có thêm thí nghiệm tốt, không bảo đảm tăng F1 trực tiếp.

**Mục tiêu có thể chấm:** giảm lỗi lớp 16/34 mà không làm precision các lớp khác sụt, tăng Macro-F1 vượt biến thiên seed, hoàn thành inference trong deadline. Chưa có cơ sở dự báo R1/R2 sẽ đạt 99% hay bắt kịp bất kỳ mốc SOTA nào.
