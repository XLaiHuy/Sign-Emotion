# Hội thoại, ký hiệu theo câu và lưu lịch sử — 18/10/2026

## Thay đổi

Camera/điều khiển và phụ đề ở cột trái. Cột phải gộp minh họa nét mặt với nhịp, bên dưới là sân khấu ký hiệu riêng. Player ra khỏi vùng cuộn phụ đề, có điều khiển ngoài sân khấu và phóng to giữ một player; màn hẹp xếp một cột. Màu câu vẫn theo fusion đúng đoạn; model/ngưỡng/phân bổ tài nguyên/nguồn nhịp không đổi. Chẩn đoán kỹ thuật chỉ hiện trên localhost khi có `?diagnostics=1`.

Thử mẫu không chèn transcript hoặc lịch sử. Asset cần nguồn/quyền/SHA và tự kiểm tra, rồi được xác minh bytes cùng origin trước khi hiện nút. Video câm phát một lần; GLB cần skin/animation đúng tên và không phụ thuộc URL ngoài. Chỉ một câu đang phát và một câu chờ mới nhất. Chỉ so khớp nguyên lượt nói đã chốt, nối hard-cut cùng utterance, giữ phủ định/số/tên; revision không phát lại. Không thêm sắc thái mặt hoặc đổi tốc độ ký hiệu theo camera.

Lưu là opt-in được ghi nhớ, mặc định false cho dữ liệu cũ; tạo/mở kho cạnh điều khiển hoặc không lưu riêng phiên. Ghi AES-GCM nối tiếp với một snapshot mới nhất chờ; không có chuỗi promise tăng dần. Phần chưa lưu ở RAM theo giới hạn 500 đoạn, owner ở kho dùng chung nên không mất chỉ vì đổi màn hình. Kho khóa hoặc ghi lỗi có trạng thái/lưu lại; chỉ báo đã lưu sau khi ghi xong. Giữ khóa sau 5 phút/chuyển nền và hạn 30 ngày. Không lưu media hoặc transcript vào audit. Lịch sử thuộc cùng trình duyệt/origin, không đồng bộ giữa các link tunnel.

## Kiểm kê

- 100 câu dự kiến: 93 khớp metadata VSL-GH revision `6c351e63c0b2cf1b5e2e8056bb3bf2d6f31dc90a`, 7 do dự án đề xuất; đã sửa nguồn gán hàng loạt.
- **0 asset phát được; 0 câu được kiểm chứng độc lập.** Danh mục văn bản không là 100 chuyển động.
- File ký hiệu cũ `sent064.mp4` có SHA `024f4ba8af16b8c3941e29774b8d2d42020e5e5a8e40dc93e89c24881528d4ce`, trùng clip giới thiệu. Đã gỡ file/đường dẫn sai; clip giới thiệu ở `/demo/` vẫn giữ.
- Hai NPY offline: SENT064 `(100,411)`, SENT091 `(132,411)`, float32 hữu hạn; 1.575/3.339 giá trị bằng 0 chưa được diễn giải thành tracking hợp lệ.
- Metadata ghi 30 FPS, duration 2,98/4,056 s; NPY có 100/132 frame (3,333/4,4 s nếu phát đều 30 FPS). Chưa xác minh căn thời gian, thứ tự 137 điểm, mất tay, hướng bàn tay, quyền video/vùng TP.HCM. Chưa đủ để retarget đúng; không thay bằng cử chỉ tự vẽ.
- Manifest `scripts/vsl-hcm-manifest.json`; tái tạo danh mục bằng `node scripts/build-100-catalogue.mjs` với metadata offline.

## Kiểm chứng và triển khai

Regression mới: snapshot hữu hạn, opt-in, khóa/lỗi/thử lại, đọc lại ciphertext bằng vault instance mới; hard-cut/phủ định/số/revision/hàng đợi; asset thiếu/sai SHA/MIME/quá lớn; player một lần/phóng to/Escape/cleanup. Fixture chỉ kiểm cơ chế, không là ký hiệu chuẩn.

Quality gates: `npm run check` qua 289 test/84 file, lint 126 module, TypeScript, 13 face + 25 conversation assets và build; `npm run format:check` qua. Sau chốt timer kho, 8 regression storage/lifecycle/control qua, gồm việc autosave không kéo dài 5 phút khóa khi không tương tác.

Trình duyệt Chrome và Edge production (không chèn CSS ngoài): 1920×1080, 1366×768, 1280×720, 390×844, 844×390, 720×900 và 640×360 (viewport tương đương zoom 200% ở 1280×720) không tràn ngang. Caption giữ vùng đọc riêng cao 280–486 px, stage 300 px; không có player/danh mục trong caption scroller. Chọn câu thử không chèn transcript; opt-in lưu hội thoại còn sau reload và kho khóa đúng yêu cầu mật khẩu. 0 pageerror, 0 request non-GET hoặc gửi dữ liệu ra ngoài trong cả hai lượt test. Báo cáo JSON và ảnh kiểm tra: `output/playwright/sign-history-chrome-*` và `output/playwright/sign-history-edge-*`.

Phiên hội thoại giả lập 120 giây (`output/research-evaluation/pipeline-history-soak-120s.json`): 22 câu final được ghi mã hóa AES-GCM nối tiếp vào IndexedDB, đọc lại đầy đủ sau reload và mở khóa. Sau khi bấm Finish, toàn bộ worker, track và AudioContext đều được giải phóng hoàn toàn (0 live workers, 0 live tracks, 0 audio contexts). Nhánh mặt đạt ~2,7 Hz dưới tải giả lập; độ trôi clock audio quan sát được dưới tải nặng. Không có media/landmarks/transcripts nào gửi ra mạng.

Khởi động browser sạch phát hiện race trước service-worker claim: GPU runtime yêu cầu controller quá sớm. Đã thêm chờ `controllerchange` hữu hạn 15 giây, có abort; 12 test startup/pipeline/init qua, Chrome/Edge mới chuẩn bị được mà không cần bấm thử lại. Không đổi model, threshold hoặc backend.

Không có mẫu ký hiệu hợp lệ để chạy A/B tải player thực tế; chưa nghiệm thu performance avatar ký hiệu, Android hoặc độ đúng VSL. Không dùng số đo image cũ thay phép đo mới.

Chỉ image local `signemo:conversation-sign-history-20261018`, project `signemo-media`, port 8095; giữ `signemo:sign-phrase-20261018` rollback. Public/tunnel không đổi. Tự kiểm tra không là phê duyệt ngôn ngữ độc lập.
