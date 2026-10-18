> **Hồ sơ lịch sử — chưa kiểm chứng.** Đặc tả và phạm vi MVP hiện tại nằm tại [MVP_SPEC.md](../MVP_SPEC.md). Các con số kỹ thuật, thị trường và tài chính trong tài liệu này là đề xuất hoặc giả thuyết, không phải kết quả đã đạt.

**PHỤ LỤC I**

**ĐỀ CƯƠNG Ý TƯỞNG DỰ ÁN KHỞI NGHIỆP**

|  TRƯỜNG ĐẠI HỌC MỞ TP. HỒ CHÍ MINH CUỘC THI “ SINH VIÊN VỚI Ý TƯỞNG SÁNG TẠO & KHỞI NGHIỆP”  NĂM 2026 ĐỀ CƯƠNG Ý TƯỞNG DỰ ÁN  .............TÊN DỰ ÁN............   Thuộc lĩnh vực: …………………….  NHÓM/CÁ NHÂN THỰC HIỆN  (danh sách thành viên – Họ tên, MSSV, Khoa)  Tháng 5  /2026  |
| ----- |

**Trang thứ 1:**

**Thông tin vắn tắt về các thành viên tham gia dự án:**

1. Họ và tên trưởng nhóm: 

2. MSSV: 2351010191

3. Khoa: Đào Tạo Đặc Biệt

4. Số điện thoại liên hệ: 0934014802

5. Email:………………………………………………………………

6. Danh sách thành viên trong nhóm:

| STT | Họ và tên | MSSV | Khoa | Email và Điện thoại |
| :---: | :---: | :---: | :---: | :---: |
| 1 | Phan Cao Huy | 2351010075 | Đào Tạo Đặc Biệt | [2351010075huy@ou.edu.vn](mailto:2351010075huy@ou.edu.vn) \+ 0962421550 |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

   

   

   

**Trang thứ 2:**

**Tóm tắt dự án**

* Tên ý tưởng/dự án: **SignEmo — Cầu nối cảm xúc cho người khiếm thính**

* Ý tưởng chính của dự án:
Ứng dụng công nghệ trí tuệ nhân tạo (Edge AI) chạy offline thời gian thực để nhận diện các vi biểu cảm khuôn mặt (micro-expressions) của người đối diện qua camera điện thoại di động, từ đó mã hóa và truyền tải các trạng thái cảm xúc (vui, buồn, giận dữ, ngạc nhiên...) thành các nhịp rung phản hồi xúc giác (haptic feedback) đa tần số trên thiết bị đeo thông minh (smartwatch) và hiển thị biểu tượng (icon) trực quan trên màn hình.

* Mô tả sản phẩm/dịch vụ, giá trị của dự án:
Sản phẩm gồm một ứng dụng di động (Flutter) tích hợp mô hình học sâu thu gọn (STSTNet-Lite) kết hợp kỹ thuật trích xuất điểm mốc khuôn mặt (MediaPipe Face Landmarker) để phân tích biểu cảm thời gian thực với độ trễ cực thấp (<30ms). Giá trị cốt lõi của SignEmo là cung cấp một "giác quan xúc giác" bổ trợ thông qua ngôn ngữ rung cảm xúc (Haptic Emotional Vocabulary) trên đồng hồ thông minh, giúp người khiếm thính thấu cảm trạng thái cảm xúc ẩn sau lời nói của người đối diện một cách tự nhiên mà không cần nhìn chằm chằm vào màn hình. Điều này tạo điều kiện để họ chủ động giao tiếp, giảm tải áp lực tâm lý và thúc đẩy bình đẳng cơ hội học tập cũng như làm việc trong xã hội.

**Trang 3**

**1.Tính cần thiết của sản phẩm dịch vụ**

- **Mục tiêu, giá trị, tầm nhìn của sản phẩm dịch vụ; Đối tượng thụ hưởng:**
  - **Vấn đề cốt lõi:** Người khiếm thính (khoảng 2,5 triệu người tại Việt Nam) có thể đọc môi hoặc văn bản chuyển ngữ, nhưng hoàn toàn thiếu công cụ hỗ trợ nhận biết biểu cảm tinh tế (micro-expressions) và thái độ phi ngôn ngữ của người đối diện, dẫn đến hiểu lầm, cô lập và áp lực tâm lý lớn.
  - **Mục tiêu:** Trở thành "trợ lý phiên dịch cảm xúc" thời gian thực qua hai kênh song song: icon cảm xúc trực quan trên màn hình và nhịp rung phản hồi xúc giác (haptic) trên cổ tay.
  - **Tầm nhìn:** Tích hợp lên kính thông minh (smart glasses), tối ưu hóa Edge AI chạy hoàn toàn offline, mở rộng thành nền tảng hỗ trợ giao tiếp toàn diện cho người khuyết tật giác quan tại Đông Nam Á.
  - **Đối tượng tạo ra giá trị:** Người khiếm thính cá nhân (giao tiếp tự tin, giảm áp lực); Gia đình/bạn bè (kết nối sâu sắc hơn); Trường học/Doanh nghiệp tuyển dụng người khuyết tật (giao tiếp trôi chảy, tối ưu hiệu suất làm việc).

- **Đối tượng khách hàng quan trọng nhất của sản phẩm dịch vụ:**
  - **Giai đoạn 1 (MVP):** Người khiếm thính cá nhân từ 18-40 tuổi đang đi học hoặc đi làm, có sử dụng smartphone Android. Ưu tiên thử nghiệm tại các trường khuyết tật thính giác lớn tại TP.HCM.
  - **Giai đoạn 2 (B2B):** Các trường học chuyên biệt, trung tâm bảo trợ xã hội và các doanh nghiệp xã hội tuyển dụng lao động khiếm thính.

- **Lý do khách hàng chọn sản phẩm, giải pháp của dự án thay vị lựa chọn các sản phẩm khác:**
  - **So với app chuyển âm thanh thành văn bản (Live Transcribe, Ava):** Họ chỉ đọc được từ ngữ thô, SignEmo cung cấp cảm xúc và sắc thái thái độ thầm lặng.
  - **So với máy trợ thính, ốc tai điện tử:** SignEmo là thiết bị hỗ trợ nhận thức phi ngôn ngữ và phân tích biểu cảm, bổ trợ thay vì thay thế.
  - **Tính năng độc bản:** Kết hợp đồng thời camera AI phân tích biểu cảm khuôn mặt thời gian thực + mã hóa thành "ngôn ngữ rung cảm xúc" đa tần số trên smartwatch + chạy hoàn toàn offline bảo mật tuyệt đối.

- **Đánh giá về giá trị của sản phẩm dịch vụ mang lại cộng đồng và xã hội:**
  - **Giảm bất bình đẳng giác quan:** Bù đắp một phần "giác quan bị thiếu" của người khiếm thính qua xúc giác và thị giác.
  - **Hỗ trợ Mục tiêu Phát triển Bền vững của LHQ:** Đóng góp trực tiếp vào SDG 10 (Giảm bất bình đẳng) và SDG 4 (Giáo dục chất lượng), giúp học sinh khiếm thính thấu cảm giáo viên.

**2. Tính khả thi**

- **Phân tích tính khả thi của việc phát triển, sản xuất sản phẩm:**
  - Dự án có thể phát triển theo hướng MVP trước, tập trung vào 3 đến 5 cảm xúc cơ bản và chạy thử trên một mẫu điện thoại phổ thông. Cách làm này phù hợp với mục tiêu vì tận dụng được nền tảng di động sẵn có, thư viện mã nguồn mở và không cần xây dựng hạ tầng máy chủ riêng.
  - Về mặt triển khai, ứng dụng sẽ dùng camera điện thoại để nhận hình ảnh trực tiếp, hiển thị biểu tượng cảm xúc và gửi rung phản hồi lên điện thoại hoặc đồng hồ thông minh nếu có. Cách tiếp cận này tương thích với các demo công khai của MediaPipe trên Android và iOS vốn đều hỗ trợ camera trực tiếp trên thiết bị vật lý.
  - Với người dùng đầu tiên, thiết bị tối thiểu chỉ cần một smartphone có camera đủ tốt; smartwatch là thiết bị bổ sung ở giai đoạn sau để tăng trải nghiệm. Nếu không có đồng hồ, bản demo vẫn có thể chạy tốt bằng rung trên điện thoại và biểu tượng trên màn hình.
  - Ứng dụng khả thi vì phần mềm không phụ thuộc vào server trung tâm: phần nhận diện và hiển thị đều có thể xử lý ngay trên thiết bị. Điều này giúp giảm độ trễ, giảm chi phí vận hành và phù hợp với môi trường sử dụng thực tế của người khiếm thính.
  - Nhóm có thể tự phát triển nguyên mẫu vì phạm vi tính năng MVP không quá rộng: nhận diện cảm xúc cơ bản, hiển thị icon, rung phản hồi và cho phép người dùng chọn mức nhạy vừa phải. Đây là quy mô đủ nhỏ để hoàn thành trong giai đoạn thi bán kết mà vẫn có tính trình diễn rõ ràng.

- **Nêu rõ những thuận lợi, khó khăn trong quá trình sản xuất, kinh doanh sản phẩm dịch vụ:**
  - **Thuận lợi:**
    - Có thể tận dụng nguồn mở và tài nguyên sẵn có trên điện thoại thông minh, nên chi phí phần mềm ban đầu thấp.
    - Mô hình chạy trên thiết bị cá nhân giúp giảm độ trễ và tăng tính riêng tư, phù hợp với nhu cầu của người khiếm thính.
    - Dữ liệu đầu vào có thể kiểm thử trực tiếp trong môi trường thật như lớp học, cuộc họp nhỏ hoặc giao tiếp gia đình mà không cần thiết lập hệ thống phức tạp.
  - **Khó khăn:**
    - Biểu cảm gương mặt thay đổi nhanh, ánh sáng yếu hoặc góc quay lệch có thể làm giảm độ ổn định của kết quả; vì vậy MVP cần có cảnh báo đơn giản để người dùng chỉnh lại vị trí camera.
    - Đồng hồ thông minh có độ tương thích khác nhau giữa các dòng máy, nên giai đoạn đầu cần ưu tiên chạy ổn định trên điện thoại trước rồi mới mở rộng sang thiết bị đeo.
    - Nếu phạm vi demo bị mở rộng quá sớm, đội sẽ dễ bị trễ tiến độ; vì vậy nên giữ bản trình bày tháng 11 ở mức mô phỏng chạy tốt trên một số thiết bị phổ biến.

**3. Tính độc đáo, sáng tạo**

- **Sản phẩm dịch vụ là hoàn toàn mới chưa có trên thị trường; Giá trị khác biệt:**
  - SignEmo có điểm khác biệt ở chỗ không chỉ chuyển lời nói thành văn bản, mà còn giúp người dùng nắm được sắc thái cảm xúc trong giao tiếp. Đây là lớp hỗ trợ còn thiếu ở nhiều ứng dụng hỗ trợ người khiếm thính hiện nay.
  - Giá trị mới của dự án nằm ở việc kết hợp biểu tượng cảm xúc trực quan với rung phản hồi, nhờ đó người dùng có thể vừa nhìn nhanh vừa cảm nhận qua cổ tay thay vì phải liên tục dán mắt vào màn hình.

- **Phân tích tính khác biệt, tính độc đáo, có áp dụng công nghệ mà đối thủ không thể cạnh tranh:**
  - Sản phẩm có thể tùy biến mức nhạy và kiểu phản hồi rung theo từng nhóm người dùng, nên dễ cá nhân hóa hơn các giải pháp chỉ hiển thị chữ hoặc chỉ phát âm thanh.
  - Việc xử lý trên thiết bị cá nhân giúp tăng tính riêng tư, phù hợp với bối cảnh giao tiếp nhạy cảm của người khiếm thính, đồng thời giảm phụ thuộc vào mạng internet.
  - Dự án có thể tạo chi phí thấp vì dùng công cụ sẵn có, không cần đầu tư server lớn và có thể phát triển theo từng bước: bản cơ bản cho demo, sau đó mở rộng thêm đồng hồ, kính thông minh hoặc các kiểu rung khác.

- **Chi phí thấp, giá cả cạnh tranh vượt trội nhờ đổi mới sáng tạo:**
  - Vì phần lớn thành phần triển khai có thể tận dụng thiết bị sẵn có và phần mềm nguồn mở, dự án có thể giữ chi phí thử nghiệm ở mức thấp.
  - Mô hình phát triển theo MVP giúp tránh lãng phí vào hạ tầng chưa cần thiết, tập trung vào tính năng cốt lõi trước khi mở rộng.

**4. Kế hoạch phát triển sản phẩm/dịch vụ**

- **Xây dựng kế hoạch phát triển từ ý tưởng đến sản phẩm mẫu, sản xuất và thương mại hóa:**
  - **Tháng 5-6/2026 (Phase 0):** Nghiên cứu thuật toán, chọn mô hình pre-trained, thiết kế kiến trúc hệ thống trên Flutter.
  - **Tháng 7-8/2026 (Phase 1):** Tích hợp MediaPipe và TFLite để hoàn thiện tính năng nhận diện cảm xúc khuôn mặt trên điện thoại.
  - **Tháng 9/2026 (Phase 2):** Thiết lập kết nối Bluetooth kết nối ứng dụng với smartwatch, hoàn thiện các pattern rung của Haptic Vocabulary.
  - **Tháng 10/2026 (Phase 3):** Thử nghiệm thực tế tại 1-2 trường chuyên biệt thính giác tại TP.HCM, thu thập phản hồi người dùng thực tế và tinh chỉnh model.
  - **Tháng 11/2026 (Demo MVP):** Ra mắt phiên bản MVP chạy offline ổn định, hỗ trợ 5 cảm xúc chính để tham gia bán kết cuộc thi.

- **Các nguồn thu chính của dự án:**
  - `+` **Dự kiến doanh thu:** *[Bộ phận Kinh doanh tự bổ sung chi tiết số liệu]* (Dự án định hướng mô hình doanh thu hỗn hợp gồm thuê bao tháng gói Pro cá nhân và phí bản quyền năm B2B cho trường chuyên biệt/doanh nghiệp xã hội. Dự kiến năm đầu doanh thu ~120 triệu VNĐ, chủ yếu phủ sóng thương hiệu).
  - `+` **Tính toán chi phí; Điểm hòa vốn:** *[Bộ phận Kinh doanh tự bổ sung chi tiết số liệu]* (Chi phí MVP cực thấp chỉ khoảng 1.5 - 3 triệu VNĐ do tận dụng mã nguồn m**Trang 3**

**Nội dung chính của dự án**

1. **Tổng quan đề án**

Trình bày dưới dạng **Business Model Canvas** *(Lưu ý: chỉ điền những thông tin tối giản, cốt lõi nhất của dự án).*

| **ĐỐI TÁC CHÍNH**<br>- Các trường khuyết tật chuyên biệt, trung tâm bảo trợ thính giác.<br>- Doanh nghiệp xã hội, chuỗi sản xuất tuyển lao động khiếm thính.<br>- Cộng đồng học thuật & Nguồn lực mở (Google MediaPipe, TensorFlow Lite, các repository STSTNet). | **HOẠT ĐỘNG CHÍNH**<br>- Nghiên cứu tối ưu thuật toán Edge AI nhận diện vi biểu cảm thời gian thực.<br>- Xây dựng & chuẩn hóa bộ "ngôn ngữ rung cảm xúc" (Haptic Emotional Vocabulary).<br>- Phát triển và cập nhật phần mềm đa nền tảng (Flutter). | **GIẢI PHÁP GIÁ TRỊ**<br>- "Trợ lý phiên dịch cảm xúc" thời gian thực qua phản hồi rung (haptic) trên cổ tay và icon trên màn hình.<br>- Hoạt động 100% offline (Edge AI), bảo mật tuyệt đối dữ liệu hình ảnh khuôn mặt.<br>- Chi phí sử dụng cực thấp và không bị mỏi mắt. | | **QUAN HỆ KHÁCH HÀNG**<br>- Cá nhân hóa trải nghiệm qua tùy chỉnh độ nhạy (confidence threshold) và pattern rung.<br>- Xây dựng cộng đồng người dùng hỗ trợ và phản hồi cải tiến sản phẩm.<br>- Tiếp cận trực tiếp qua các tổ chức bảo trợ xã hội. | **PHÂN KHÚC KHÁCH HÀNG**<br>- Người khiếm thính cá nhân (18-40 tuổi) sử dụng smartphone/smartwatch.<br>- Các trường học chuyên biệt dành cho trẻ khiếm thính.<br>- Doanh nghiệp xã hội sử dụng nhân lực khiếm thính. |
| ----- | :---: | :---: | ----- | :---: | :---: |
| | **TÀI NGUYÊN CHÍNH**<br>- Đội ngũ kỹ thuật nội bộ (02 chuyên viên IT tự phát triển hệ thống).<br>- Kiến trúc thuật toán tối ưu (Apex-frame Spotting, STSTNet-Lite quantized INT8, FACS Mapping).<br>- Bộ dữ liệu mở quy mô lớn (AffectNet, FER2013, CASME II, SAMM). | | | **CÁC KÊNH THÔNG TIN VÀ KÊNH PHÂN PHỐI**<br>- Cửa hàng ứng dụng Google Play Store và Apple App Store.<br>- Hội nhóm, cộng đồng người khuyết tật thính giác trực tuyến.<br>- Tổ chức workshop trải nghiệm "The Silent Vibe" tại các trường khuyết tật. | |
| **CẤU TRÚC CHI PHÍ**<br>- Chi phí tài khoản Developer (Google Play, Apple App Store).<br>- Thiết bị phần cứng thử nghiệm (smartwatch Android/iOS cũ).<br>- Chi phí tiếp thị cộng đồng ban đầu.<br>- **Phí vận hành máy chủ = 0 VNĐ** (chạy offline). | | | **DÒNG DOANH THU**<br>- Mô hình Freemium: Bản Basic miễn phí nhận diện 3 cảm xúc; Bản Pro (thuê bao tháng giá rẻ) đầy đủ tính năng.<br>- Phí cấp phép bản quyền phần mềm theo năm (B2B) cho trường học chuyên biệt/doanh nghiệp xã hội. | | |

**B. Mô tả thêm về sản phẩm, dịch vụ**

**1.Tính cần thiết của sản phẩm dịch vụ**

- **Dự án đã có sản phẩm dịch vụ hay mới là ý tưởng:**
  Dự án hiện đang ở giai đoạn **ý tưởng hoàn thiện có nền tảng công nghệ và lộ trình kỹ thuật khả thi**. Nhóm đã lựa chọn và kiểm chứng thành công các thành phần cốt lõi của pipeline (MediaPipe Face Landmarker, các mô hình MobileNetV2 trên FER2013 và STSTNet-Lite cho micro-expressions) qua môi trường nghiên cứu và mã nguồn mở. Dự án đã sẵn sàng bước vào giai đoạn code ứng dụng và thiết kế pattern rung, với mục tiêu hoàn thiện bản demo MVP chạy offline ổn định vào tháng 11/2026.

- **Mục tiêu, giá trị, tầm nhìn của sản phẩm dịch vụ; Đối tượng thụ hưởng:**
  - **Mục tiêu:** Tạo ra một "trợ lý phiên dịch cảm xúc" thời gian thực đắc lực cho người khiếm thính thấu cảm giao tiếp phi ngôn ngữ.
  - **Giá trị:** Cung cấp thông tin cảm xúc qua hai kênh: trực quan (icon + confidence bar) và xúc giác (haptic smartwatch) giúp người khiếm thính hiểu sâu hơn, phản xạ nhanh hơn và giảm áp lực tự ti trong các cuộc hội thoại trực tiếp.
  - **Tầm nhìn:** 3-5 năm tới sẽ tinh chỉnh mô hình theo đặc điểm biểu cảm người Việt, tích hợp lên kính thông minh (Smart Glasses) và mở rộng thành nền tảng API mở hỗ trợ các thiết bị trợ thính khác.
  - **Đối tượng tạo ra giá trị:** Người khiếm thính cá nhân, gia đình họ, các trường học chuyên biệt và doanh nghiệp tuyển dụng lao động khuyết tật.

- **Đối tượng khách hàng quan trọng nhất của sản phẩm dịch vụ:**
  - Nhóm người khiếm thính cá nhân trong độ tuổi lao động và học tập (18-40 tuổi) sử dụng smartphone/smartwatch Android/iOS.
  - Các cơ sở giáo dục khuyết tật thính giác và doanh nghiệp xã hội (như quán cafe, xưởng may) sử dụng lao động là người khiếm thính.

- **Lý do khách hàng chọn sản phẩm, giải pháp của dự án thay vì lựa chọn các sản phẩm khác:**
  - Các app chuyển văn bản (Live Transcribe) không có khả năng đọc vị cảm xúc.
  - Thiết bị trợ thính thông thường không hỗ trợ hiểu biểu cảm tinh tế (micro-expression).
  - Điểm vượt trội độc bản: Xử lý Edge AI offline bảo mật 100% dữ liệu, thiết kế "ngôn ngữ rung cảm xúc" đa tần số giúp giao tiếp không cần nhìn màn hình, hoạt động mượt mà trên thiết bị cấu hình trung bình.

- **Đánh giá về giá trị của sản phẩm dịch vụ mang lại cộng đồng và xã hội (cung cấp minh chứng nếu có):**
  - Bù đắp "giác quan thấu cảm" giúp người khiếm thính hòa nhập xã hội tốt hơn.
  - **Minh chứng khoa học:** Các nghiên cứu quốc tế từ MIT Media Lab và Đại học Washington (SoundWatch, 2020) xác nhận haptic feedback cải thiện 68% nhận thức môi trường xã hội của người khiếm thính. Nghiên cứu vibrotactile display (arXiv 2023) chứng minh người dùng dễ dàng học và phân biệt được 4-5 pattern rung biểu cảm chỉ sau 2-3 buổi làm quen ngắn.

**2. Tính khả thi**

- **Việc sản xuất sản phẩm là khả thi:**
  - Công nghệ sẵn sàng vì có thể tận dụng các công cụ mở đã phổ biến trên điện thoại thông minh và đồng hồ thông minh, không cần xây dựng nền tảng riêng từ đầu.
  - Bản demo có thể chạy theo mô hình camera trực tiếp trên thiết bị thật, phù hợp với cách các sample công khai của MediaPipe triển khai trên Android và iOS.
  - Với giai đoạn đầu, chỉ cần một smartphone có camera đủ tốt và một thiết bị đeo để thử phản hồi rung; nếu chưa có đồng hồ, ứng dụng vẫn hoạt động được trên điện thoại.
  - Phần nhận diện và hiển thị đều có thể xử lý ngay trên thiết bị, nên tính khả thi cao vì không phụ thuộc vào máy chủ trung tâm, giảm độ trễ và thuận tiện cho người dùng.

- **Cơ cấu chi phí và giá thành hợp lý:**
  - Chi phí ban đầu hợp lý vì có thể tận dụng điện thoại sẵn có, phần mềm mở và thiết bị đeo cũ để thử nghiệm.
  - Với bản demo cho bán kết, mức đầu tư có thể giữ ở ngưỡng thấp, chủ yếu cho tài khoản nhà phát triển và thiết bị kiểm thử.
  - Không cần đầu tư hạ tầng máy chủ riêng ở giai đoạn đầu nên tránh được chi phí vận hành phát sinh.

- **Nêu rõ những thuận lợi, khó khăn trong quá trình sản xuất, kinh doanh sản phẩm dịch vụ:**
  - **Thuận lợi:**
    - Có thể phát triển theo từng bước nhỏ nên đội sinh viên vẫn có thể tự làm và tự kiểm thử.
    - Môi trường sử dụng gần với thực tế, dễ thử với lớp học, gia đình hoặc cuộc họp nhỏ.
    - Mô hình chạy trên thiết bị cá nhân giúp tăng riêng tư và giảm chi phí hạ tầng.
  - **Khó khăn kỹ thuật & Giải pháp:**
    - Biểu cảm gương mặt thay đổi nhanh và phụ thuộc ánh sáng, góc nhìn nên bản demo cần có cảnh báo đơn giản khi điều kiện nhận diện chưa tốt.
    - Đồng hồ thông minh có độ tương thích khác nhau giữa các dòng máy nên giai đoạn đầu nên ưu tiên chạy mượt trên điện thoại trước.
    - Để kịp mốc tháng 11, nhóm chỉ nên tập trung vào các cảm xúc cơ bản và quy trình demo ổn định thay vì mở rộng quá nhiều tính năng.

- **Sản phẩm có tính cạnh tranh (minh chứng nếu có):**
  - SignEmo có lợi thế vì kết hợp được hai lớp giá trị cùng lúc: nhận biết cảm xúc và phản hồi rung tức thì.
  - So với các giải pháp chỉ chuyển lời nói thành chữ hoặc chỉ hỗ trợ một kênh giao tiếp, SignEmo tạo ra trải nghiệm đầy đủ hơn cho người khiếm thính.

**3. Tính độc đáo, sáng tạo**

- **Sản phẩm dịch vụ là hoàn toàn mới chưa có trên thị trường; Khác biệt và Độc đáo áp dụng công nghệ:**
  - SignEmo khác biệt ở chỗ không chỉ chuyển lời nói thành văn bản, mà còn nhấn mạnh phần cảm xúc và thái độ trong giao tiếp.
  - Tính độc đáo của dự án nằm ở việc kết hợp biểu tượng trực quan với rung phản hồi để người dùng hiểu cảm xúc mà không phải nhìn màn hình liên tục.
  - Cách tiếp cận này thân thiện với người dùng khiếm thính vì dễ hiểu, dễ làm quen và có thể dùng trong nhiều bối cảnh giao tiếp thực tế.

- **Việc sản xuất sản phẩm được tạo ra bởi quá trình đổi mới sáng tạo dẫn đến có chi phí thấp, giá cả cạnh tranh vượt trội so với các đối thủ khác:**
  - Vì tận dụng phần mềm mở và thiết bị phổ biến, dự án có thể giữ chi phí thử nghiệm thấp.
  - Mô hình phát triển theo MVP giúp tập trung vào tính năng cốt lõi trước, sau đó mới mở rộng lên đồng hồ thông minh hoặc thiết bị đeo khác.

**4. Kế hoạch sản xuất, kinh doanh**

- **Có kế hoạch sản xuất hàng hóa dịch vụ rõ ràng:**
  - **Lộ trình kỹ thuật phát triển sản phẩm mẫu (MVP):**
    - *Bước 1:* Xây dựng ứng dụng Flutter cơ bản, tích hợp MediaPipe Face Landmarker để bắt chuyển động khuôn mặt trực tiếp từ camera.
    - *Bước 2:* Tích hợp mô hình AI STSTNet-Lite quantized INT8 chạy on-device qua Flutter TFLite delegate.
    - *Bước 3:* Phát triển mô-đun Bluetooth gửi tín hiệu rung từ điện thoại sang smartwatch Android/Apple Watch, thiết lập Haptic Vocabulary.
    - *Bước 4:* Khử nhiễu tín hiệu bằng thuật toán temporal majority voting (chọn cảm xúc chiếm đa số trong 5 frame liên tiếp) để tránh rung sai.
    - *Bước 5:* Tiến hành thử nghiệm Alpha với nhóm tình nguyện viên khiếm thính và trường chuyên biệt để hiệu chỉnh tần số rung và độ nhạy nhận diện trước khi đóng gói MVP.

- **Phân tích và đánh giá rủi ro:**
  - *Rủi ro về điều kiện môi trường ánh sáng yếu/ngược sáng:* Khắc phục bằng cách tự động tăng độ sáng màn hình camera (phần mềm hỗ trợ) hoặc hiển thị thông báo "Ánh sáng yếu - Vui lòng chuyển hướng camera" khi độ tin cậy của MediaPipe giảm sâu.
  - *Rủi ro về tiêu thụ pin trên thiết bị đeo:* Đồng hồ thông minh chỉ nhận lệnh rung ngắn dạng Bluetooth payload thay vì chạy trực tiếp mô hình AI (model AI chạy hoàn toàn trên điện thoại). Điện thoại áp dụng adaptive sampling (chỉ quét camera 2fps khi không có thay đổi và tăng lên khi phát hiện chuyển động) giúp tiết kiệm pin đến 60%.

- **Giải pháp xây dựng các kênh phân phối hàng hóa:**
  *[Bộ phận Kinh doanh / Marketing tự hoàn thiện]*

- **Phát triển, mở rộng thị trường:**
  *[Bộ phận Kinh doanh / Marketing tự hoàn thiện]*�i diện một cách tự nhiên mà không cần nhìn chằm chằm vào màn hình. Điều này tạo điều kiện để họ chủ động giao tiếp, giảm tải áp lực tâm lý và thúc đẩy bình đẳng cơ hội học tập cũng như làm việc trong xã hội.

**Trang 3**

**Nội dung chính của dự án**

1. **Tổng quan đề án**

Trình bày dưới dạng **Business Model Canvas** *(Lưu ý: chỉ điền những thông tin tối giản, cốt lõi nhất của dự án).*

| ĐỐI TÁC CHÍNH  *Mô tả những mối quan hệ quan trọng nhất bên ngoài doanh nghiệp, giữ cho doanh nghiệp hoạt động.*   | HOẠT ĐỘNG CHÍNH  *Mô tả những hoạt động quan trọng nhất cần thực hiện để giữ cho doanh nghiệp hoạt động (VD: Sản xuất, Cung cấp nền tảng,…).* | GIẢI PHÁP GIÁ TRỊ *Sản phẩm hoặc dịch vụ mang lại giá trị cho khách hàng mục tiêu (VD: Giải trí, Cá nhân hóa, Tiết kiệm tiền,...).* |  | QUAN HỆ KHÁCH HÀNG  *Mô tả mối quan hệ mà doanh nghiệp xây dựng với khách hàng (VD: Tự phục vụ, Hỗ trợ cá nhân, Dịch vụ tự động hóa, Cộng đồng,…).* | PHÂN KHÚC KHÁCH HÀNG *Một hoặc một số nhóm người mà doanh nghiệp cố gắng phục vụ.*   |
| ----- | :---: | :---: | ----- | :---: | :---: |
|  | **TÀI NGUYÊN CHÍNH**  *Mô tả những tài sản quan trọng nhất cần có để giữ cho doanh nghiệp hoạt động (VD: Công nghệ, Con người, Tài chính…).* |  |  | **CÁC KÊNH THÔNG TIN VÀ KÊNH PHÂN PHỐI**  *Kênh mà doanh nghiệp giao tiếp với khách hàng và mang lại giá trị cho khách hàng (VD: Bán hàng trực tuyến, Siêu thị…).* |  |
| **CẤU TRÚC CHI PHÍ** *Toàn bộ chi phí cần thiết để duy trì doanh nghiệp.*  |  |  | **DÒNG DOANH THU** *Mô tả dòng tiền mà doanh nghiệp thu được từ việc cung cấp giá trị (VD: Phí dịch vụ, Quảng cáo, Phí môi giới,…).* |  |  |

**B. Mô tả thêm về sản phẩm, dịch vụ**

**1.Tính cần thiết của sản phẩm dịch vụ**

      \- Dự án hiện ở giai đoạn ý tưởng hoàn thiện và đã có định hướng sản phẩm rõ ràng để làm MVP.

\- SignEmo hướng đến việc giúp người khiếm thính hiểu cảm xúc của người đối diện trong giao tiếp trực tiếp. Ứng dụng sẽ dùng camera điện thoại để nhận diện biểu cảm cơ bản, sau đó hiển thị biểu tượng cảm xúc và rung nhẹ để người dùng nhận biết nhanh hơn. Về lâu dài, sản phẩm có thể mở rộng lên đồng hồ thông minh và các thiết bị đeo khác.

\- Đối tượng khách hàng quan trọng nhất là người khiếm thính từ 18 đến 40 tuổi đang đi học hoặc đi làm, thường xuyên cần giao tiếp trực tiếp trong lớp học, văn phòng, cửa hàng hoặc môi trường dịch vụ.

\- Khách hàng chọn SignEmo vì nhiều ứng dụng hiện có chỉ hỗ trợ chuyển lời nói thành chữ, còn SignEmo bổ sung thêm phần cảm xúc và thái độ của người nói. Điều này giúp người dùng hiểu đầy đủ hơn trong giao tiếp, giảm hiểu lầm và phản ứng tự tin hơn.

\- Về giá trị xã hội, giải pháp có thể hỗ trợ người khiếm thính hòa nhập tốt hơn trong học tập và công việc, đồng thời tạo ra một công cụ giao tiếp thân thiện hơn cho gia đình, giáo viên và người hỗ trợ. Các tài liệu công khai của MediaPipe cho thấy Face Landmarker có thể chạy trực tiếp với camera và hỗ trợ chế độ livestream, nên hướng phát triển của dự án là thực tế; tương tự, Apple cũng cho phép iPhone và Apple Watch trao đổi dữ liệu qua Watch Connectivity khi cả hai ứng dụng đang hoạt động.

	**2\. Tính khả thi**

\- Việc phát triển sản phẩm là khả thi vì MVP có thể giới hạn ở quy trình rất rõ: mở ứng dụng, hướng camera về phía người đối diện, hiển thị biểu tượng cảm xúc và rung phản hồi khi cần. Đây là cách làm phù hợp với các mẫu công khai của MediaPipe trên Android và iOS, vốn đều hỗ trợ chạy camera trực tiếp trên thiết bị thật.

\- Cơ cấu chi phí hợp lý vì giai đoạn đầu chỉ cần smartphone có camera tốt, một thiết bị đeo để thử rung nếu có, và tài khoản nhà phát triển cơ bản. Nếu tính cho bản demo phục vụ bán kết, mức đầu tư ban đầu có thể giữ ở khoảng 2,5 đến 4 triệu đồng, chủ yếu cho thiết bị thử nghiệm và chi phí phát hành ứng dụng.

\- Thuận lợi của dự án là có thể làm từng bước: trước hết chạy ổn trên điện thoại, sau đó mới nối sang đồng hồ thông minh. Khó khăn chủ yếu là điều kiện ánh sáng, góc nhìn và độ ổn định khi người dùng di chuyển. Vì vậy bản demo cần có cảnh báo đơn giản và chỉ tập trung vào những cảm xúc cơ bản để đảm bảo chạy mượt và dễ trình diễn.

\- Sản phẩm có tính cạnh tranh vì vừa hỗ trợ hiểu cảm xúc vừa có phản hồi rung tức thì, trong khi nhiều ứng dụng khác hiện nay chỉ thiên về phụ đề hoặc chỉ hỗ trợ một kênh cảm nhận. Điểm mạnh này đủ rõ để tạo sự khác biệt khi trình bày trước hội đồng.

**3\. Tính độc đáo, sáng tạo**

\- SignEmo là sản phẩm khác biệt vì không chỉ chuyển thông tin lời nói, mà còn nhấn mạnh phần cảm xúc và thái độ trong giao tiếp. Đây là điểm mà nhiều sản phẩm hỗ trợ người khiếm thính trên thị trường chưa làm tốt hoặc chưa làm theo cách dễ dùng cho người dùng phổ thông.

\- Tính độc đáo của dự án nằm ở việc kết hợp biểu tượng trực quan với rung phản hồi để người dùng có thể hiểu cảm xúc mà không phải nhìn màn hình liên tục. Cách tiếp cận này giúp cuộc trò chuyện tự nhiên hơn, nhất là trong lớp học, cuộc họp hoặc giao tiếp gia đình.

\- Dự án cũng có lợi thế về chi phí vì dùng công cụ sẵn có, tận dụng thiết bị phổ biến và đi theo hướng phát triển từng bước. Nhờ đó, bản demo và các giai đoạn mở rộng sau này đều có thể giữ được mức đầu tư thấp nhưng vẫn tạo cảm giác mới và dễ nhớ khi trình bày.

**4\. Kế hoạch sản xuất, kinh doanh**

\- Có kế hoạch sản xuất hàng hóa dịch vụ rõ ràng; 

\- Phân tích và đánh giá rủi ro; 

\- Giải pháp xây dựng các kênh phân phối hàng hóa;

\- Phát triển, mở rộng thị trường.

**5\. Kết quả tiềm năng của dự án** 

Kết quả tiềm năng của dự án được tối ưu hóa dựa trên mô hình doanh thu hỗn hợp, bao gồm phí thuê bao tháng gói nâng cao từ khách hàng cá nhân và phí cấp bản quyền phần mềm theo năm cho các trường chuyên biệt, doanh nghiệp xã hội. Dự kiến doanh thu năm đầu đạt khoảng 120 triệu VNĐ, tập trung vào mục tiêu phủ sóng 2.000 lượt tải bản miễn phí để hoàn thiện sản phẩm, trước khi tăng trưởng mạnh từ năm thứ hai qua khối B2B. Do dự án ứng dụng công nghệ Edge AI chạy offline và có sẵn 2 thành viên IT tự phát triển mã nguồn, chi phí vận hành hệ thống được cắt giảm tối đa, giúp nhóm dự kiến đạt điểm hòa vốn vào cuối năm thứ hai và thu lợi nhuận cao (\>40%) từ năm thứ ba. Về mặt tác động xã hội, giải pháp mở ra một "giác quan xúc giác" qua nhịp rung cổ tay giúp người khiếm thính thấu cảm cuộc thoại thầm lặng, giảm tải áp lực thị giác và tạo đòn bẩy bình đẳng để họ tự tin hòa nhập trường học cũng như công sở.

**6\. Nguồn lực thực hiện**

Nguồn lực thực hiện: Dự án được vận hành bởi đội ngũ liên ngành gồm ba thành viên cam kết đồng hành toàn diện, trong đó có 02 thành viên công nghệ thông tin tự phát triển phần mềm, tối ưu hóa trí tuệ nhân tạo ngoại tuyến và 01 thành viên quản trị kinh doanh phụ trách điều phối, tài chính, truyền thông. Nhóm hiện nhận cố vấn từ Giảng viên Nhà trường và có kế hoạch hợp tác với các trường khuyết tật để kiểm thử, cùng với các doanh nghiệp xã hội làm đối tác đầu ra ngay khi có sản phẩm thử nghiệm. Về nguồn vốn, các thành viên tự góp vốn nội bộ giai đoạn đầu, sau đó lộ trình sẽ gọi vốn mồi từ các nhà đầu tư thiên thần và tiến tới bán sản phẩm trực tiếp cho khách hàng cá nhân cũng như các tổ chức có nhu cầu như các trường học chuyên biệt, trung tâm bảo trợ trẻ khuyết tật, các doanh nghiệp xã hội và cơ sở sản xuất kinh doanh những nơi đang tuyển dụng lao động là người khiếm thính

**7\. Các kênh truyền thông** 

Kế hoạch truyền thông bước đầu của nhóm sẽ tập trung vào chiến dịch lan tỏa gồm 3 bước liên hoàn: Bắt đầu bằng việc nâng cao nhận thức cộng đồng về "Sự cô lập cảm xúc" khi người khiếm thính không thể nghe được ẩn ý qua tông giọng; tiếp nối bằng chuỗi video trải nghiệm thực tế (TikTok/Reels) ghi lại phản ứng khi họ cảm nhận cảm xúc qua nhịp rung; và cuối cùng là lan tỏa thông tin lên các trang mạng xã hội. Dự án sẽ tận dụng các công cụ truyền thông tự xây dựng (Fanpage/TikTok). Điểm nhấn độc đáo của chiến dịch là hoạt động Experiential Marketing mang tên "The Silent Vibe" (Nhịp rung thầm lặng) tổ chức tại sảnh trường, nơi người tham gia đeo tai nghe chống ồn và đoán cảm xúc của bạn mình hoàn toàn qua nhịp rung mã hóa trên vòng đeo tay, giúp tạo hiệu ứng truyền miệng tự nhiên và thu hút người dùng thử bản Beta.- Lập kế hoạch truyền thông tổng thể.

**PHỤ LỤC III**

**BÁO CÁO HOÀN THÀNH DỰ ÁN**

 

| TRƯỜNG ĐẠI HỌC MỞ THÀNH PHỐ HỒ CHÍ MINH  | CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM Độc lập – Tư do – Hạnh phúc |
| :---: | ----- |
| **KHOA …………..** |  |
|  | *Thành phố Hồ Chí Minh, ngày …. tháng … năm 20…* |
|  |  |

**BÁO CÁO THỰC HIỆN DỰ ÁN**

**CUỘC THI “SINH VIÊN VỚI Ý TƯỞNG SÁNG TẠO & KHỞI NGHIỆP”** 

**NĂM 2026**

1. **Thông tin dự án:**

- **Tên dự án:**

- Trưởng nhóm:

- Giảng viên hướng dẫn: 

		\+ GVHD1:

		\+ GVHD2:

- Khoa chuyên môn quản lý:

2. **Tóm tắt các nội dung đã thực hiện:**

- Mức độ hoàn thiện dự án

- Tiến độ thực hiện

- Sự hỗ trợ của GVHD

- Sự hỗ trợ của khoa chuyên môn 

3. **Sản phẩm hoàn thành:**

- Bản thuyết minh dự án hoàn chỉnh: Có/Không

- Sản phẩm mẫu, mô hình hoặc video clip minh họa sản phẩm: Có/Không

- File powerpoint thuyết trình: Có/Không

| KHOA CHUYÊN MÔN | GIẢNG VIÊN HƯỚNG DẨN | TRƯỞNG NHÓM |
| :---: | :---: | :---: |

**PHỤ LỤC IV**

**VIDEO GIỚI THIỆU DỰ ÁN**

**1\. Thời lượng và dung lượng**

\- Video clip có thời lượng không quá 02 phút, dung lượng tối đa 500MB.

\- Định dạng MP4, độ phân giải tối thiểu 720p (HD).

**2\. Tác giả và hình thức thể hiện**

\- Video clip phải được xây dựng bởi các thành viên trong đội dự thi.

\- Có thể kết hợp các yếu tố thuyết trình trực tiếp, hình ảnh minh họa, mô phỏng sản phẩm, phụ đề, nhạc nền, hoặc các đoạn phỏng vấn, phản hồi khách hàng.

\- Hình thức thể hiện mang phong thái kinh doanh, sáng tạo, có thể sử dụng các yếu tố hài hước, sinh động, tương tác cao để tăng tính hấp dẫn và khả năng tiếp cận người xem.

**3\. Nội dung cần thể hiện**

\- Giới thiệu về Đội thi và các thành viên trong đội.

\- Trình bày ý nghĩa xã hội, giá trị cộng đồng của dự án.

\- Giới thiệu tóm tắt sản phẩm/dịch vụ, lợi thế cạnh tranh, mục tiêu, giá trị, tầm nhìn của sản phẩm/dịch vụ.

\- Nêu rõ phân khúc khách hàng và tính khả thi của dự án.

\- Làm rõ yếu tố công nghệ hoặc đổi mới sáng tạo trong dự án, đặc biệt nếu có ứng dụng AI, STEM, IoT, robotics, dữ liệu hoặc công nghệ lõi khác.

\- Thể hiện thông điệp cốt lõi mà dự án muốn truyền tải đến cộng đồng.

\- Làm nổi bật tác động tích cực của sản phẩm/dịch vụ đối với xã hội, đặc biệt về phát triển bền vững (ESG) và chuyển đổi số.

**4\. Phong cách trình bày**

\- Video có thể được dàn dựng dưới dạng thuyết trình, hoạt họa, phóng sự ngắn hoặc mô phỏng công nghệ.

\- Khuyến khích sử dụng đồ họa minh họa, sơ đồ công nghệ, video quay sản phẩm thực tế hoặc mô phỏng AI do đội thi tự thực hiện.

\- Khuyến khích phần trình bày thể hiện bản sắc riêng của nhóm, tinh thần khởi nghiệp và đổi mới sáng tạo.

**5\. Quy định về bản quyền**

\- Video clip phải tuân thủ các quy định về bản quyền hình ảnh, âm thanh, trích dẫn.

\- Không sử dụng tài liệu có bản quyền mà không dẫn nguồn cụ thể.

\- Các video clip có yếu tố vi phạm bản quyền hoặc nội dung không phù hợp với thuần phong mỹ tục, vi phạm pháp luật sẽ không được chấm thi.

\- Khuyến khích sử dụng hình ảnh mô phỏng, minh họa công nghệ AI hoặc mô hình kỹ thuật do đội thi tự xây dựng hoặc có bản quyền hợp pháp.

**Ghi chú:** Đội thi cần đảm bảo chất lượng hình ảnh, âm thanh rõ nét; phần thuyết trình mạch lạc, súc tích, thể hiện được hàm lượng công nghệ, tinh thần khởi nghiệp và giá trị đổi mới sáng tạo của dự án.

**PHỤ LỤC V**

**TIÊU CHÍ CHẤM ĐIỂM**

**1\. Tiêu chí chấm điểm Vòng Xét duyệt Đề cương: thang điểm 100**

a) Sự cần thiết của sản phẩm, dịch vụ đối với nhu cầu thị trường; Lợi ích của sản phẩm, dịch vụ đem lại cho khách hàng, cộng đồng và xã hội; Đánh giá đối tượng, phân khúc khách hàng đối với sản phẩm, dịch vụ. Sản phẩm/ dịch vụ đó sẽ hỗ trợ giải quyết được vấn đề nào của xã hội, của cộng đồng (30 điểm).

b) Tính khả thi trong việc sản xuất, kinh doanh; Khả năng về tài chính; tính hiệu quả bao gồm cơ cấu chi phí, giá thành phù hợp cạnh tranh so với các loại sản phẩm, dịch vụ đã có trên thị trường (25 điểm).

c) Tính độc đáo, sáng tạo, giá trị khác khác biệt của sản phẩm, dịch vụ so với các sản phẩm đã có trên thị trường; Tính bền vững của sản phẩm, dịch vụ (25 điểm).

d) Kế hoạch phát triển sản phẩm: Xây dựng các giai đoạn phát triển sản phẩm; Phân tích cơ cấu nguồn thu, chi phí, lợi nhuận, khả năng tăng trưởng của dự án (20 điểm).

**2\. Tiêu chí chấm điểm Vòng Bán kết: thang điểm 100**

a) Sự cần thiết của sản phẩm, dịch vụ đối với nhu cầu thị trường; Lợi ích của sản phẩm, dịch vụ đem lại cho khách hàng, cộng đồng và xã hội; Đánh giá đối tượng, phân khúc khách hàng đối với sản phẩm, dịch vụ. Sản phẩm/ dịch vụ đó sẽ hỗ trợ giải quyết được vấn đề nào của xã hội, của cộng đồng (20 điểm).

b) Tính khả thi trong việc sản xuất, kinh doanh; Khả năng về tài chính; tính hiệu quả bao gồm cơ cấu chi phí, giá thành phù hợp cạnh tranh so với các loại sản phẩm, dịch vụ đã có trên thị trường (15 điểm).

c) Tính độc đáo, sáng tạo, giá trị khác khác biệt của sản phẩm, dịch vụ so với các sản phẩm đã có trên thị trường; Tính bền vững của sản phẩm, dịch vụ (15 điểm).

d) Kế hoạch sản xuất, kinh doanh: Kế hoạch sản xuất hàng hóa; Phân tích và đánh giá rủi ro; Giải pháp xây dựng các kênh phân phối hàng hóa; Phát triển, mở rộng thị trường (10 điểm).

đ) Kết quả tiềm năng của dự án bao gồm: doanh thu, lợi nhuận dự kiến, khả năng tăng trưởng, tác động xã hội của dự án (10 điểm).

e) Nguồn lực thực hiện: Đánh giá nguồn nhân lực, tính sẵn sàng tham gia, cơ cấu tổ chức bộ máy nhân sự cho dự án; Các đối tác chính, Giải pháp huy động vốn triển khai dự án (10 điểm).

f) Các kênh truyền thông: Lập kế hoạch truyền thông tổng thể; Xây dựng công cụ truyền thông; Giải pháp truyền thông độc đáo và khác biệt (10 điểm).

g) Khả năng trình bày hoặc thuyết trình dự án (10 điểm).

**3\. Tiêu chí chấm điểm Vòng Chung kết: thang điểm 100**

a) Điểm gian hàng (A) – tối đa 20 điểm: Tính thẩm mỹ/sáng tạo/thu hút; Tính quy mô/đầu tư của gian hàng; Thể hiện nổi bật được sản phẩm/dịch vụ (trưng bày); Phong cách đội ngũ, kỹ năng trình bày, …

b) Điểm đánh giá dự án (B): như các tiêu chí và thang điểm ở vòng Bán kết

**Điểm vòng Chung kết \= A \+ B\*0.8**

