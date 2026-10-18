# Đặc tả MVP SignEmo

## Hội thoại và ký hiệu theo câu — 18/10/2026

Player riêng dưới nét mặt cột phải. Chỉ câu chốt nguyên lượt nói có asset đúng và đã kiểm bytes mới phát một lần; một câu chờ mới nhất, revision không phát lại. Bỏ động tác chung và clip giới thiệu gán sai. 100 câu dự kiến có 93 metadata nguồn/7 đề xuất, **0 asset phát được**; mẫu thiếu hiện rõ chưa hỗ trợ. Lưu opt-in được ghi nhớ, mở kho tại chỗ và trạng thái theo ghi mã hóa thực tế; bản chờ hữu hạn, lưu lại sau mở khóa. Giữ khóa 5 phút/hạn 30 ngày, API/model/ngưỡng/nhịp. Chi tiết `CONVERSATION_SIGN_HISTORY_20261018.md`; chỉ Docker local 8095.

## Màu dễ nhận biết — 18/10/2026

Tăng vùng nền nhạt quanh avatar theo biểu cảm, nhãn đặc chữ trắng và badge câu rõ hơn; tên/icon luôn đi kèm màu, phụ đề vẫn chữ tối. Giữ tách nguồn và tắt màu hiện có, chưa rõ dùng nền thường; không flash hay thay model/threshold/fusion. Xem `SIGN_RESEARCH_FACTCHECK_20261018.md` để phân biệt giới hạn NMM, pose và sinh avatar, không dùng các tuyên bố 95%/đầu tiên/độc quyền chưa có bằng chứng.

## Avatar mặt và màu tách nguồn — 18/10/2026

Avatar đầu 3D theo nét mặt đã ổn định, không theo fusion. Dùng GLB do dự án tạo, nội suy mắt/mày/miệng 450 ms và tối đa 30 FPS, đứng yên không render liên tục. Mặc định bật khi thiếu lựa chọn; giữ bật/tắt đã lưu. Mất/nhiều mặt, ảnh không hợp lệ, đổi camera/chuyển nền dừng ngay; lỗi GPU hoặc áp lực lõi dùng SVG. Chỉ mặt phát nhịp. Màu nhãn/viền/vùng avatar theo mặt; badge/viền câu chỉ theo fusion đúng final, chữ vẫn tối. Chú giải thu gọn và hướng dẫn trong Giới thiệu.

Ký hiệu câu là nghiên cứu riêng, chỉ mẫu nguyên câu TP.HCM được xác minh vùng/nghĩa/chuyển động và quyền phân phối mới được duyệt. Không dùng ASL thay thế, không huấn luyện hoặc tự ghép tay. Hiện chưa có mẫu được duyệt, không hiện nút xem ký hiệu trong bản thường. Báo cáo `AVATAR_COLOURS_SIGN_RESEARCH_20261018.md`; local 8095, public giữ nguyên.

## Minh họa thay cho ký hiệu còn thiếu — 18/10/2026

Theo yêu cầu người dùng, từ chưa có video ký hiệu TP.HCM đủ điều kiện dùng sẽ hiện khuôn mặt SVG minh họa 7 biểu cảm. Miệng/lông mày chuyển từ trung tính sang biểu cảm một lần theo cue mặt hợp lệ, có xem lại; không thêm model, media hoặc cử chỉ tay tự đoán. Ghi rõ đây không phải ngôn ngữ ký hiệu. Mất nguồn/chuyển nền dừng minh họa, giảm chuyển động dùng hình tĩnh. Không thay model/ngưỡng/fusion hoặc public.

## Phản hồi theo nét mặt và video local — 18/10/2026

Theo quyết định mới, nhịp Hội thoại chỉ theo nét mặt ổn định, không còn do fusion phát. Giữ dwell nhịp 400 ms, cooldown >=3 giây, quality/stale/generation guards; fusion và revision chỉ cập nhật gợi ý đúng câu. Ô nhịp nằm cạnh thông tin mặt, không làm camera/phụ đề rung. Âm mặc định tắt cho cài đặt mới, giữ lựa chọn cũ. Ký hiệu TP.HCM dùng video người thật có nguồn/quyền phân phối rõ; từ thiếu chỉ chữ/icon. Clip MP4 local và WebVTT nháp tải sau thao tác, lưu offline riêng bằng checksum/Range. Xem [triển khai và giới hạn](INTRO_FACE_CUES_20261018.md). Các quy tắc “chỉ fusion phát nhịp” ở phần lịch sử bên dưới được thay bởi mục này. Không đổi model hoặc public.

## Điều phối tài nguyên local — 17/10/2026

Lượt thử CPU/GPU giữ nguyên model, preprocessing và ngưỡng. Scheduler theo deadline độc lập inference; controller dùng cửa sổ tải gần đây, final ưu tiên partial và text. Runtime Moonshine single/two-thread chỉ chọn bằng build nghiên cứu có checksum, MediaPipe CPU/GPU chỉ chọn qua URL local; không đổi Settings, vault, API feedback hay public. Chi tiết và cổng chưa hoàn tất ở [RESOURCE_SCHEDULING_20261017.md](RESOURCE_SCHEDULING_20261017.md). Chưa công nhận đạt 5 Hz hoặc Android khi chưa có ma trận đo.

## Thử streaming local — 17/10/2026

Thêm build thử rõ ràng `VITE_AI_PROFILE=pc-candidate` + `VITE_STREAMING_ASR=moonshine`: B0/WebGPU và Moonshine tiếng Việt với runtime release v0.1.5 đã pin SHA, thay binary npm không nhận frontend tách đôi. Không đổi baseline/Gipformer mặc định hoặc public từ lựa chọn này. Partial yêu cầu mỗi 512 ms, adapter nạp phần PCM mới trong đoạn VAD hữu hạn; final flush lookahead, warm-up trước quyền thiết bị. Một inference và hàng đợi hữu hạn giữ nguyên. Chỉ URL local `?moonshine=1` có COEP document; không bật lại isolation toàn site. Xem [phạm vi, cách chạy và kiểm chứng](MOONSHINE_B0_TRIAL_20261017.md); không coi lịch partial là latency đã đạt.

## Responsive và lõi — 16/10/2026

Bản thử public hiện hành là **demo-20261016-responsive-v19**, gồm chỉnh poster/badge/nút xem và bắt trạng thái PWA đã chờ. Link/rollback ở DEPLOYMENT.md; không đổi model hoặc cổng nghiệm thu chất lượng.

Hội thoại giữ camera và caption đồng thời trong viewport; ngang thấp dùng hai cột, dọc dành phần lớn chiều cao cho chữ. Cây media/worker không thay theo orientation; panel phụ đề cuộn riêng, giữ 30 final và partial. Prefix có ranh giới cụm tiếng Việt và tích lũy thời gian ổn định 400 ms, vẫn cho final/phủ định sửa lại. Dwell hiển thị thích ứng margin, haptic floor 400 ms không đổi. Mặt chỉ vote khi IoU quan sát với đoạn >=0,40; không giữ nhãn khi mất mặt hoặc dùng quality rejected để tăng coverage. Xem [đối chiếu triển khai](RESPONSIVE_CORE_20261016.md).

Giữ AES-GCM/PBKDF2 600.000 vòng, tự khóa kho sau **5 phút** theo xác nhận người dùng. Không bật COOP/COEP toàn site hoặc immutable một năm cho URL model ổn định; chỉ asset tên hash dùng immutable. Không cam kết các thời gian tăng tốc trong bản đề xuất nếu chưa đo.

## Khởi tạo AI v13 — 16/10/2026

Candidate tải/kiểm checksum model trước khi khởi tạo worker; thời gian download không tính vào timeout init. Hiện tiến độ MiB, tái sử dụng cache đúng checksum và thử tải nối hữu hạn. Lỗi hiển thị theo nhánh/mã an toàn; lỗi mặt có lựa chọn B0/WASM tương thích rõ ràng, không mở thiết bị tự động. Không đổi model, threshold, fusion, vault hoặc API. Chi tiết: [STARTUP_RELIABILITY_20261016.md](STARTUP_RELIABILITY_20261016.md).

## Clip giới thiệu và candidate B0 — 16/10/2026

Theo yêu cầu phát hành tiếp theo, link dùng thử public hiện phục vụ candidate v12 trên PC/WebGPU; baseline trong source vẫn độc lập. Đây là lựa chọn demo, chưa phải nghiệm thu Android/accuracy. Cách chạy và rollback nằm tại DEPLOYMENT.md.

Giới thiệu nhúng video YouTube `g6lhRElRiWs` sau thao tác xem; trước đó chỉ có poster local, không tải iframe/thumbnail bên thứ ba. Clip cần mạng, không chặn AI/offline, không đưa nội dung YouTube vào inference. Caption trên YouTube chỉ hiển thị nếu video có track phù hợp.

Candidate B0 loại checkpoint B2 khỏi cache lõi và generated bundle; baseline/image rollback riêng giữ nguyên. Partial dùng LCP khóa mềm qua hai revision, không đợi thêm để hiện chữ đầu; từ mâu thuẫn và final có quyền sửa prefix. Chỉ final vào text/fusion/vault theo consent; không log nội dung partial. Chi tiết và các tối ưu tiếp theo ở [INTRO_PARTIAL_BUNDLE_20261016.md](INTRO_PARTIAL_BUNDLE_20261016.md).

## Bổ sung đồng hồ audio — 16/10/2026

AudioWorklet giữ quantum im lặng khi input rỗng và gửi mốc context; adapter ánh xạ sang đồng hồ trang, session cập nhật origin và dừng an toàn khi mất dữ liệu quá lớn. Không coi timestamp suy từ sample counter là thời gian trang cố định trong toàn phiên. Fixture audio ảo còn chênh đồng hồ; smoke v10 không thay nghiệm thu latency micro thật hoặc tải dài sau sửa. Trạng thái và giới hạn được ghi ở [VERIFICATION.md](VERIFICATION.md).

## Hợp đồng bổ sung — 15/10/2026, nâng cấp hệ thống

Bản build mặc định vẫn `baseline`. Chỉ image chọn rõ `VITE_AI_PROFILE=pc-candidate` dùng Gipformer/B0-WebGPU/PhoBERT cho hội thoại; không thay cài đặt lưu lâu dài, không nạp hai ASR cùng lúc, không tự promote từ vài clip. Warm-up classifier trước READY, chưa mở thiết bị. GPU không khả dụng phải báo chuẩn bị lỗi, không âm thầm coi fallback là WebGPU.

Text được chuẩn bị sau lõi; nếu người dùng đã bật fusion và gói text hoàn tất trong phiên, nối nhánh một lần cho các đoạn tiếp theo, giữ micro/ASR. Không làm mất phụ đề khi nhánh này chưa sẵn sàng. Chỉ final có đủ ngữ cảnh đi vào PhoBERT; mặt hiện tại tách khỏi kết quả của câu trước. Chỉ fusion đủ điều kiện phát nhịp, giữ quality/generation/cooldown/stale guard hiện có.

Chẩn đoán số liệu ephemeral chỉ mở trên localhost với `?benchmark=1`, chỉ stage/duration/queue/RTF/usable, không ID câu hoặc nội dung; audit 24 giờ vẫn theo allowlist. Profile thử/cache/dung lượng/cổng nghiệm thu được mô tả ở [SYSTEM_UPGRADE_20261015.md](SYSTEM_UPGRADE_20261015.md). Không đổi API feedback hoặc schema vault/settings.

## Cập nhật hiện hành — 15/10/2026

Phụ đề final giữ chữ tối; fusion đúng đoạn chỉ thêm badge tên/icon và viền trái, có thể tắt màu. Không flash khẩn cấp. Đã có so sánh lab PhoWhisper/Gipformer cùng PCM và B0/WASM–B0/WebGPU–B2/WebGPU cùng timestamp video; chưa đổi mặc định từ các phép thử. Source demo vẫn PhoWhisper-tiny/B2-WASM/PhoBERT; Emotion2vec FP32/WebGPU được bật riêng trong Hội thoại, mặc định tắt và chưa nghiệm thu tiếng Việt. Các đoạn bên dưới ghi “chưa nối tone”, “B0 hiện hành” hoặc tô màu toàn câu là trạng thái lịch sử. Hợp đồng, nguồn/checksum và giới hạn ở [MODEL_COMPARISON.md](MODEL_COMPARISON.md), tone ở [LIVE_TONE.md](LIVE_TONE.md).

## Bản thử nhạy hơn — 14/10/2026

Theo yêu cầu mới, đổi classifier sản phẩm thử sang EmotiEffLib B2 `enet_b2_8.onnx`, RGB 260×260/ImageNet; không tái dùng crop 224 của B0. Ngưỡng mặt mặc định 0,55, fusion mặt/text 0,55 và margin 0,10. Áp dụng một lần cho cài đặt cũ 0,65; giữ ngưỡng tùy chỉnh khác và quyền/lưu dữ liệu. Không hạ kiểm tra chất lượng ảnh hoặc yêu cầu hai nguồn đồng thuận. B2 đã qua parity, nhưng chậm hơn B0 và chưa xác minh cải thiện Angry/Sad/Fear/Disgust. Đây là lựa chọn demo theo yêu cầu, không phải model đã đạt cổng accuracy/Android.

Đã có probe Emotion2vec pretrained thật trong lab local: INT8 chưa qua parity đầy đủ/chậm; FP32/WebGPU qua numeric parity trên một PCM tiếng Việt public và smoke cold/warm, chưa có validation cảm xúc hoặc đo cùng pipeline. **Chưa bật tone vào hội thoại/fusion**, xem [TONE_RESEARCH.md](TONE_RESEARCH.md). Checkpoint synthetic chỉ kiểm thử cơ chế. MERaLiON vẫn là nghiên cứu PC, không tự tải lên web. Các quyết định B0/ngưỡng 0,65 ở phần lịch sử bên dưới đã được thay thế.

## Quyết định hiện hành — 14/10/2026

Giới thiệu mở mặc định mỗi lần, chuẩn bị ASR/VAD/mặt bằng một session owner dùng chung với Hội thoại, chưa xin quyền thiết bị. Phụ đề là chính; gợi ý quan sát được là thử nghiệm. Hỗ trợ Vui, Buồn, Giận, Ngạc nhiên, Sợ hãi, Khó chịu/Ghê sợ, Trung tính. Fear không phát hiện nguy hiểm/âm thanh môi trường. Chỉ fusion đủ điều kiện của đúng câu final tô màu và phát nhịp; partial/chưa rõ giữ chữ thường, mặt hiện tại không đổi màu câu cũ. Trọng số mặt/text bằng nhau, ít nhất hai nguồn đồng thuận; Other/Contempt vẫn không hỗ trợ.

PhoWhisper-tiny và EmotiEffLib B0 vẫn mặc định chung PC/Android. Gipformer INT8+Sherpa và EmotiEffLib B2 chỉ nằm trong profile thử local; chưa có phép đo toàn pipeline/Android để promote. Tone pretrained MERaLiON chỉ là công cụ file research PC, chưa chạy/nghiệm thu, không vào browser/production. Không huấn luyện/fine-tune trong đợt này. Tổng model/runtime theo manifest baseline 309,96 MiB, tăng tối đa 100 MiB được kiểm ở build. Không tự tải ứng viên nghiên cứu.

Màu có tùy chọn tắt và đi cùng icon/tên. Sáu nhịp với hai pattern mới còn cần test motor Android. Avatar GLB nhỏ 7 preset mặc định tắt, lazy load/render khi thay đổi, không ký hiệu tay. Clip AI 45 giây hiện có prompt/SRT/poster; MP4 chưa được tạo, không chặn sử dụng. Xem [thay đổi và số đo](SEVEN_LABEL_UPGRADE.md), [storyboard](DEMO_45S_STORYBOARD.md). Quyết định này thay thế phần nhãn/khởi động/model mâu thuẫn trong các ghi chú cũ bên dưới; không thay API feedback hoặc chính sách lưu kho mã hóa/audit.

## Quyết định cập nhật — 13/10/2026

Giá trị chính là phụ đề tiếng Việt local; gợi ý sắc thái giao tiếp là thử nghiệm bổ sung. Không giả định người khiếm thính không đọc được nét mặt. Camera và micro vẫn bắt buộc, PC nghiệm thu trước. Nét mặt là chỉ báo nhỏ cạnh camera và **không tự phát nhịp trong hội thoại**. Fusion gắn với đoạn đã chốt, là nguồn nhịp duy nhất: mỗi ID tối đa một nhịp, cooldown ≥3 giây, bỏ nhịp muộn >3 giây. Revision không tạo nguồn vote/nhịp mới.

ASR adapter dùng chung cho hội thoại/video local, có chuẩn bị, nhận PCM partial/final, reset và dispose. PhoWhisper vẫn là profile mặc định. Moonshine Streaming Tiny Vietnamese WASM là profile nghiên cứu tùy chọn, chỉ bật trên localhost với `/?moonshine=1`; model và runtime cùng origin, tổng thêm khoảng 43,5 MiB, chưa có benchmark SignEmo. Không nạp đồng thời Moonshine và PhoWhisper. Gipformer 1.5 INT8 + Sherpa WASM vẫn là profile nghiên cứu riêng, 84,43 MiB. Nhánh tone MLP tiếng Việt có toolchain và loader artifact trong lab; chưa có trọng số huấn luyện/nghiệm thu. Production vẫn chỉ fusion mặt+text. Profile ba nguồn 20/40/40, equal, 20/50/30, 20/30/50 chỉ dùng validation/lab; không là độ tin cậy đã chứng minh.

Hard-cut 3 giây không được coi là câu hoàn chỉnh; ngữ cảnh có giới hạn, thiếu/truncated thì abstain. Effective RTF tính cả partial. Source có dữ liệu voice legacy vẫn đọc được, không thay feedback API. Chi tiết, nguồn model, CLI và cổng promotion tại [RND_SPEECH_FUSION.md](RND_SPEECH_FUSION.md).

## Mục tiêu và người dùng

Demo AI chạy thật và công cụ pilot cho người khiếm thính trưởng thành, đối thoại 1–1 với một người đồng ý dùng camera, trong môi trường đủ sáng. PWA chạy trên PC Windows/Chrome và Android/Chrome; chỉ Android có thể rung khi API/hardware cho phép. Tiếng Việt, không cần tài khoản người dùng. Chủ dự án có một tài khoản quản trị.

Phạm vi sản phẩm hiện tại: phụ đề tiếng Việt từ micro, phân tích sắc thái văn bản thử nghiệm và tổng hợp với biểu cảm mặt. Cảm xúc giọng nói được bổ sung vào R&D/lab, chưa bật mặc định. Hiện nghiệm thu trên PC; chưa có Android. Không bao gồm thanh toán, smartwatch, mỉa mai, nhận diện danh tính và micro-expression. Không khẳng định cảm xúc thật hoặc tính hữu ích khi chưa được kiểm chứng.

## Luồng nghiệp vụ

Ứng dụng tự chuẩn bị model → đồng ý của cả hai người trưởng thành → bắt đầu hội thoại → camera/micro local → phụ đề, gợi ý khuôn mặt và gợi ý tổng hợp thử nghiệm → kết thúc → lịch sử tùy chọn hoặc phản hồi. Hội thoại là màn duy nhất có camera; đổi camera thay video trong khi giữ phiên micro/ASR. Một thao tác bắt đầu xin cả quyền camera/micro, cả hai thiết bị bắt buộc. Chuyển nền, đổi trang và lỗi thiết bị phải dừng tracks/workers/audio. Lỗi nhánh sắc thái không ngăn ASR. Model cốt lõi hợp lệ cho phép chạy phiên trước khi toàn bộ ứng dụng sẵn sàng offline. Tổng hợp khởi chạy mặc định khi gói sẵn sàng; nếu thiếu hoặc lỗi, phụ đề và gợi ý mặt vẫn chạy.

Khi vào màn hội thoại, ứng dụng xác minh tài nguyên đã cache và khởi tạo worker lõi trước khi bật nút bắt đầu; chưa xin quyền thiết bị trong bước này. PhoWhisper mặc định được chuẩn bị như trước. Profile Moonshine thử nghiệm chỉ khả dụng trên localhost trong chế độ cross-origin isolated (`/?moonshine=1`); không khả dụng qua link tunnel đang chia sẻ. Chỉ profile đã chọn được nạp, không tải model khi bấm bắt đầu. Mỗi lần khởi tạo có thể hủy; worker bị hủy hoặc lỗi phải kết thúc và được giải phóng. Không reload trang để phục hồi readiness. Cập nhật service worker chỉ diễn ra sau lựa chọn rõ ràng của người dùng và khi phiên đã dừng.

AI chạy worker, không có endpoint nhận ảnh. Khung hình nằm trong bộ nhớ tạm, không lưu cache/IndexedDB/log. Chỉ một inference chạy; khung cũ bị bỏ. Model và runtime cùng nguồn với ứng dụng, không cần CDN khi sử dụng.

## Hợp đồng AI

EmotiEffLib `enet_b0_8_best_afew.onnx`, Apache-2.0; input float32 `[1,3,224,224]`, crop RGB căn theo roll, giá trị RGB chia 255 rồi chuẩn hóa ImageNet (mean `[0.485,0.456,0.406]`, std `[0.229,0.224,0.225]`). Nhãn gốc upstream: anger, contempt, disgust, fear, happiness, neutral, sadness, surprise; worker ánh xạ về thứ tự nội bộ neutral, happy, surprised, sad, angry, disgust, fear, contempt. Ba lớp ngoài phạm vi được từ chối, không gộp ép sang lớp gần nhất. Kích thước ONNX là 16,039,595 byte; SHA-256 `7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f`. Đây là model hiện được đóng gói, chưa có bằng chứng cho thấy chính xác hơn FER+ trên người dùng SignEmo.

MediaPipe chạy chế độ IMAGE cho mỗi khung camera để phát hiện lại toàn khung, với tối đa hai mặt. Chế độ VIDEO đã cho thấy giữ tracking một mặt thêm một khung sau khi chuyển sang hai mặt trong fixture; ưu tiên kiểm tra lại hơn tối ưu tracking. Vẫn cần kiểm chứng mặt bị che/góc lệch trên người thật. Loader WASM 1.1.0 có wrapper ESM và sửa phạm vi hàm debug cho strict mode; script chuẩn bị ghi checksum của bản gốc và bản tương thích. Hai model có SHA-256 được ghim trong script, không tự chấp nhận artifact mới từ URL cũ.

Điểm biểu cảm được làm mượt bằng EMA theo thời gian với hằng số khởi đầu 150 ms; ngưỡng mặc định 0,65. Nhãn hiển thị sau 200 ms ổn định. Gate nhịp mặt 400 ms vẫn có trong công cụ chẩn đoán, nhưng không được nối với đầu ra hội thoại: chỉ fusion phát nhịp. Khoảng lấy mẫu thưa, kể cả 1 Hz, không tự xóa ứng viên chỉ vì vượt 1000 ms; mất mặt, nhiều mặt, camera mới hoặc chất lượng không hợp lệ vẫn reset. Kết quả xử lý muộn hơn 750 ms bị loại. Không rung trung tính/không rõ hoặc kết quả tổng hợp thiếu điều kiện; không rung lặp cùng gợi ý đang giữ. Các mốc là cấu hình thử nghiệm, chưa phải SLA hay độ chính xác đã xác thực.

MediaPipe xuất ma trận biến đổi khuôn mặt để ước lượng yaw/pitch/roll; phạm vi ban đầu là ±30°/±20°/±25°. Mặt ngoài phạm vi bị từ chối. Cần xác nhận quy ước ma trận và các góc trên webcam/clip thật; kiểm thử fixture tổng hợp chỉ kiểm tra phép tính, không chứng minh độ bền với góc mặt thực tế.

Vui `[240]`; buồn `[160,220,160]`; giận `[70,70,70,70,70]`; ngạc nhiên `[80]`, đơn vị ms xen kẽ rung/nghỉ. Không điều khiển tần số hoặc amplitude trên web. Trả về `true` từ Vibration API chỉ là trình duyệt chấp nhận yêu cầu, chưa chứng minh motor thực sự rung.

## Hợp đồng dữ liệu

AudioWorklet + Silero VAD chia lời nói thành đoạn tối đa 3 giây hoặc sau khoảng 544 ms im lặng. PhoWhisper-tiny ONNX q8 đã fine-tune cho tiếng Việt là ASR mặc định thử nghiệm; nếu không khởi tạo được, worker dùng Whisper multilingual tiny q8 đã giữ sẵn làm fallback. Tùy chọn Moonshine dùng cùng PCM 16 kHz từ micro hiện tại và adapter streaming riêng; nó chỉ nạp khi người dùng chọn profile thử nghiệm trên localhost COI. Các file model được ghim SHA-256, tổng model/runtime Moonshine khoảng 43,5 MiB, dưới giới hạn 100 MiB. PhoWhisper và Moonshine không được nạp đồng thời. VAD vẫn quyết định lúc lấy partial/final; bản tạm có ID/revision và bị thay tại chỗ, câu chốt ưu tiên hơn. Không tải model khi bấm bắt đầu. Lặp đầu ra bất thường được hiển thị là “Chưa nghe rõ”, không âm thầm sửa thành câu. Chưa có benchmark SignEmo đủ tách người để kết luận chất lượng hoặc độ trễ Moonshine so với PhoWhisper. PhoBERT phân tích sắc thái văn bản trong worker cục bộ khi gói sẵn sàng. Bản sửa phụ đề chỉ chuẩn hóa định dạng/lặp ở biên đoạn; luôn giữ nguyên văn ASR và không viết lại ý. Fusion chỉ xét biểu cảm mặt và văn bản thuộc cùng đoạn; cả hai nguồn phải đủ chất lượng, đủ điểm và đồng thuận. Nhãn mặt hiển thị độc lập; kết quả tổng hợp không chặn nhãn mặt và chỉ fusion phát nhịp theo câu. Chi tiết tại [SPEECH_AI.md](SPEECH_AI.md).

Media/landmarks chỉ trong RAM. Văn bản/decision chỉ lưu khi mở kho bằng mật khẩu và chọn lưu; AES-GCM, TTL 30 ngày, tự khóa khi chuyển nền/không hoạt động. Không đồng bộ kho lên backend. Feedback không chứa phụ đề hay bằng chứng từng đoạn.

Types và validation chuẩn tại `src/shared/contracts.ts`. `InferenceResult` chỉ đi trong worker/UI. `PilotReport` chỉ gồm UUID, phiên bản model/đồng ý, timestamp, rating 1–5, nhận xét <=1000 ký tự và thống kê tổng hợp. Không có ảnh, landmarks, chuỗi biểu cảm, tên hoặc email người tham gia. Schema strict từ chối field lạ.

`POST /functions/v1/submit-report`: `{report, deletionToken}`. Mã xóa là 32 byte ngẫu nhiên, hex 64 ký tự; server chỉ lưu SHA-256. Cùng ID/payload/token gửi lại là idempotent; thay đổi payload/token bị 409. `POST /functions/v1/withdraw-report`: `{reportId, deletionToken}`. Tombstone tối thiểu chặn tái tạo báo cáo đã rút lại, kể cả withdraw đến trước upload. Xóa feedback theo cascade.

Cả hai API kiểm tra Origin allowlist, payload <=16 KiB, validation và rate limit 60 request/giờ/action/bucket IP đã hash với salt và ngày; bucket giữ tối đa khoảng 2 ngày. CORS không thay thế xác thực; public write vẫn có nguy cơ spam, rate limit phù hợp pilot nhỏ và phải theo dõi trước public rollout.

## Quyền quản trị và offline

RLS không cho anon đọc/ghi table; authenticated chỉ đọc khi thuộc `admin_users`. Public API ghi qua service role ở server. Xóa quản trị qua RPC kiểm tra `auth.uid()`. Không mở signup từ app. Service worker chỉ cache GET asset cùng nguồn, không cache API/Auth. Trạng thái báo cáo gồm local/queued/sent/withdrawing/withdrawn. Chỉ bản có đồng ý gửi v2, đúng destination mới được upload khi mạng trở lại/thử lại; local không tự gửi.

Ngoại tuyến chỉ sẵn sàng sau tải/checksum model/runtime và đăng ký service worker production. Cần tải online lần đầu. Quyền camera/rung và dung lượng cache phụ thuộc trình duyệt. Mục tiêu 5 inference/giây, phản hồi ổn định 0,5–1 giây phải benchmark trên thiết bị thật.

## Nhật ký hoạt động cục bộ

Nhật ký ghi những thao tác và trạng thái có ý nghĩa bằng mã sự kiện và mẫu câu tiếng Việt cố định. Mỗi sự kiện có ID, thời gian, mức độ, mã sự kiện, boot/session ID ngẫu nhiên, build ID và metadata kỹ thuật trong allowlist. Lưu trong IndexedDB tối đa 1.000 mục trong 24 giờ; không tự gửi backend và không tự đính kèm feedback. UI hội thoại hiển thị tối đa 5 mục gần nhất; Cài đặt cho phép lọc, xuất JSON/CSV hoặc xóa riêng nhật ký.

Không ghi ảnh, audio, transcript, landmarks, danh tính, nội dung feedback, token, mật khẩu, lỗi thô hoặc dữ liệu từng frame/VAD. Nguyên nhân chỉ được diễn đạt khi có bằng chứng; nếu không, dùng “Phiên trước bị gián đoạn; chưa xác định nguyên nhân”. Nếu IndexedDB lỗi, tiến trình sản phẩm tiếp tục với bộ đệm RAM và chỉ ghi một cảnh báo lưu trữ. Nhật ký không thay thế kiểm tra console/browser và không tự xác định nguyên nhân reload hoặc thiếu bộ nhớ.

## Bổ sung phòng kiểm thử và đồng ý v2

Chi tiết dùng tại AI_LAB.md. Camera/video/luyện tập dùng chung bộ phát auto/visual/off. PredictionGate tạo sự kiện logic độc lập phần cứng; hapticCount trong PilotReport tiếp tục là số yêu cầu được API chấp nhận, không là số motor xác minh.

Phòng kiểm thử xử lý file local, nhãn đoạn không chồng lấn, replay 5 Hz, điểm gốc/EMA/lý do, CSV/JSON và YouTube tham khảo opt-in. Media/landmarks không vào log/storage. Blendshape chỉ xuất dataset nghiên cứu riêng sau đồng ý. MLP phụ 52→64→32→2 là nhánh có điều kiện; EmotiEffLib hiện là profile model được đóng gói nhưng chưa có dữ liệu nghiệm thu để khẳng định tốt hơn.

Đồng ý gửi mới là pilot-v2-2026-10. IndexedDB v2 phân biệt local-only/pilot-upload, destination và thời điểm đồng ý; v1 queued về local-only. Legacy sent không tự đổi đích; withdraw giữ mã/đích, xóa payload local. Server strict chỉ nhận v2 cho submission mới; migration bổ sung giữ báo cáo v1 tồn tại. API withdraw và idempotency giữ nguyên.

## Live tone experimental update - 2026-10-14

Conversation now has explicit optional FP32/WebGPU tone preparation and face/text/voice fusion. Product default remains face/text. See [LIVE_TONE.md](LIVE_TONE.md) for current behavior, quality gates, noise filtering and verification limits. Earlier statements that tone is lab-only describe older builds. No public deployment or Vietnamese accuracy promotion is implied.
