# Camera, micro và sắc thái

## Điều tiết theo tải gần đây — 17/10/2026

RTF điều tiết là cửa sổ 10 giây, RTF cả phiên chỉ dùng báo cáo. Partial đầu yêu cầu ở 512 ms; các lần sau có thể tăng lên 768/1.024 ms khi áp lực kéo dài. Một inference ASR, final ưu tiên lượt kế tiếp, tối đa ba final chờ; quá tải không âm thầm bỏ lời nói. VAD/pre-roll/chia đoạn và trọng số không đổi. Adapter trả execution profile tách với phiên bản model; tone vẫn tùy chọn/tắt mặc định. Xem [protocol native fake microphone và runtime source build](RESOURCE_SCHEDULING_20261017.md).

## Profile Moonshine/B0 local — 17/10/2026

Profile thử riêng dùng runtime release Moonshine v0.1.5 đã nhận frontend tiếng Việt dạng split; SDK npm vẫn 0.1.5, checksum binary release khác binary npm cũ. Partial 512 ms riêng cho streaming, warm-up trước phiên, chỉ feed delta PCM, bỏ partial chờ cũ mà vẫn bù đủ PCM từ snapshot/final tích lũy. Chốt bằng stop/flush lookahead rồi đọc snapshot, không force decode hai lần. Chưa có token ở partial không được coi là lỗi nghe; final vẫn theo guard lặp/không rõ. Giữ hard-cut VAD ~3 giây, nên chưa giữ state xuyên toàn phiên. Không nạp ASR khác đồng thời. Bản public không đổi trong lượt thử; chi tiết tại [MOONSHINE_B0_TRIAL_20261017.md](MOONSHINE_B0_TRIAL_20261017.md).

## Bổ sung lõi — 16/10/2026

Prefix tiếng Việt khóa mềm theo hai cửa sổ đồng thuận và >=400 ms media-time tích lũy, giữ quyền sửa phủ định/số/final và reset khi clock lùi. Resampler worklet tái sử dụng output scratch qua pushInto; giữ VAD/pre-roll/âm cuối nguyên bản. PhoBERT dùng LRU 512 token, không đổi BPE hoặc cache câu. Core/speech/PhoBERT tải bằng cùng downloader Range/retry/checksum hữu hạn. FaceWindow giữ khoảng quan sát thật, fusion cần IoU >=0,40; ảnh không hợp lệ vẫn bị loại. Dwell hiển thị 120/200/320 ms ở cấu hình 200 ms là thử nghiệm chưa validation. Xem RESPONSIVE_CORE_20261016.md và VERIFICATION.md; không suy thành WER/F1 hoặc tốc độ thực tế.

## Ổn định partial — 16/10/2026

Hội thoại và video local dùng chung `PartialCaptionStabilizer`: NFC, LCP qua hai revision liên tiếp cùng ID, không khóa từ cuối, giữ prefix khi hypothesis chỉ ngắn lại nhưng vẫn khớp. Mâu thuẫn từ/số/phủ định mở lại prefix ngay; final thay cả câu, giữ ASR gốc và quy tắc lưu/fusion cũ. Không thêm lần inference hoặc trì hoãn partial đầu, không phải hiệu chỉnh WER. Reset theo phiên/đoạn/epoch/seek và output nghi lỗi; không đưa nội dung vào audit. Xem [hợp đồng và giới hạn](INTRO_PARTIAL_BUNDLE_20261016.md).

## Đồng hồ capture và kiểm chứng — 16/10/2026

Worklet gửi mốc context theo quantum và giữ PCM im lặng khi input tạm rỗng. MicrophoneCapture ánh xạ AudioContext/performance (fallback currentTime), session cập nhật origin thay vì neo một lần; gap lớn dừng an toàn. Unit regression đã qua; nguồn ảo vẫn có chênh đồng hồ trong smoke v10, nên chưa dùng delivery p95 đó làm nghiệm thu micro thật. Lượt tải 30 phút v7 không được tính thành lượt 30 phút cho v10; xem [VERIFICATION.md](VERIFICATION.md).

## Nâng cấp pipeline — 15/10/2026

Thêm image thử PC Gipformer INT8 + B0/WebGPU/PhoBERT, `VITE_AI_PROFILE=pc-candidate`. Bản thường vẫn PhoWhisper/B2-WASM; tone tùy chọn vẫn tắt mặc định. Candidate không tải các checkpoint/runtime Whisper không dùng, nhận cùng một luồng PCM từ micro hiện có, giữ partial/final/queue/generation. Gipformer là OfflineRecognizer giải mã cửa sổ, không phải streaming có state.

Classifier được warm-up trước READY; checkpoint B0 và hai file runtime Asyncify ORT 1.30.0 được kiểm checksum/cache trước phiên. Nhánh text hoàn tất chuẩn bị muộn có thể nối vào phiên hiện tại, không bắt mở lại micro. Không tự suy gợi ý cho đoạn cũ hoặc bật tone từ lỗi thiếu text.

Đã bổ sung đo capture/detection/crop/classifier/delivery và ASR partial/final/text/fusion, chỉ xuất số liệu allowlist local opt-in. Thời gian classifier riêng không thay capture-to-label; mốc cuối đoạn VAD có trailing silence không tương đương đo độc lập thời điểm âm vị cuối. Giữ ngưỡng/EMA/dwell hiện hành đến khi có validation. Công cụ confidence offline không tự áp dụng vào pipeline. Xem [báo cáo nâng cấp](SYSTEM_UPGRADE_20261015.md) và [kiểm chứng](VERIFICATION.md).

## Hiện hành — 15/10/2026

PhoWhisper-tiny q8 vẫn mặc định; SpeechLab so tuần tự PhoWhisper không fallback/Gipformer trên PCM local 16 kHz giống nhau. File benchmark không đo partial/VAD. Mặt demo vẫn B2/WASM; thêm lab B0/WASM, B0/WebGPU, B2/WebGPU, giữ preprocessing riêng 224/260. Emotion2vec FP32/WebGPU đã nối tùy chọn vào hội thoại/fusion, mặc định tắt; không có bảo đảm accuracy tiếng Việt. F0/RMS không là nguồn emotion độc lập. Các đoạn trái với trạng thái này bên dưới là lịch sử; xem [MODEL_COMPARISON.md](MODEL_COMPARISON.md) và [LIVE_TONE.md](LIVE_TONE.md).

## Tone local nghiên cứu — 14/10/2026

Đã có adapter/probe Emotion2vec INT8 và FP32/WebGPU, xem [TONE_RESEARCH.md](TONE_RESEARCH.md). Không mở micro riêng, không đưa tone thành vote sản phẩm: INT8 chậm/parity chưa đạt; GPU mới qua numeric parity trên một PCM public, chưa có validation cảm xúc tiếng Việt hoặc benchmark toàn pipeline. Runtime/parser/score mapping đã tách để chỉ nạp execution provider được chọn trong worker nghiên cứu. Giữ face/text cho bản thường.

## Cấu hình demo nhạy hơn — 14/10/2026

Model mặt được chọn theo yêu cầu mới: EmotiEffLib B2, RGB 260×260, FP32/WASM, hash `180a9d4845b59393de4511598a0d1d34b705034691ea32959ce5009db7cf52b7`, 30.779.724 byte; Apache-2.0, upstream revision c018fcf96c79c3bd9184f1c9438fe2095c9f1943. ASR vẫn PhoWhisper. Mặt/fusion dùng 0,55; margin fusion 0,10; giữ chất lượng/generation/two-source agreement. Hạ ngưỡng tăng coverage có thể tăng nhãn sai; không được gọi là tăng accuracy. Tone thật chưa được chọn/bật, không dùng checkpoint synthetic hoặc quy tắc cao độ giả làm cảm xúc.

## Profile hiện hành — 14/10/2026

Sản phẩm giữ PhoWhisper-tiny q8/B0 và fusion mặt–text, 7 nhãn gồm Fear/Disgust, Other/Contempt không hỗ trợ. Nét mặt hiện tại chỉ hiển thị; fusion final là nguồn màu câu/nhịp duy nhất. Giới thiệu chuẩn bị AI lõi bằng session dùng chung nhưng không mở camera/micro. Tổng baseline manifest 309,96 MiB, cổng tăng tối đa 100 MiB tại build.

Gipformer INT8+Sherpa có smoke browser/PCM/parity/offline; B2 có input RGB 260×260 và parity/latency probe. Cả hai chưa nghiệm thu toàn pipeline/Android, không mặc định sản phẩm. Tone MERaLiON pretrained nghiên cứu PC, chưa infer/export ONNX, không khôi phục classifier tiếng Anh hoặc dùng pitch rule thay model. Xem [cổng lựa chọn và bằng chứng](SEVEN_LABEL_UPGRADE.md). Các ghi chú tone MLP/training cũ là lịch sử research, không phải hướng huấn luyện của đợt này.

## Cập nhật R&D 13/10/2026

Profile sản phẩm vẫn mặc định PhoWhisper/EmotiEffLib/PhoBERT. Moonshine Streaming Tiny Vietnamese WASM 0.1.5 đã được ghim cho nghiên cứu local (43,5 MiB gồm model và runtime), nhưng hiện tạm khóa trong giao diện: lần kiểm tra Chrome, runtime không nhận cặp `frontend.model.ort` / `frontend.weights.ort` của model. Chưa đo WER, độ trễ hoặc RTF SignEmo cho profile này; không quảng bá nó như lựa chọn chạy được. PhoWhisper vẫn là profile sản phẩm. Gipformer INT8 + WASM (84,43 MiB) tiếp tục ở lab. Nhánh tone có feature extractor versioned, CPU MLP/ONNX và loader research-only, chưa có checkpoint tiếng Việt đạt cổng chất lượng. Chi tiết nguồn/checksum, CLI, dữ liệu, mục tiêu và giới hạn tại [RND_SPEECH_FUSION.md](RND_SPEECH_FUSION.md).

Hội thoại chỉ phát nhịp từ fusion final mới nhất, không từ nhãn mặt/chữ tạm; một lần/ID và bỏ nhịp >3 giây. Hard-cut ASR không là kết thúc câu; giữ tối đa hai đoạn trước, thiếu ngữ cảnh thì chưa kết luận. Effective RTF tính tất cả partial/final; gợi ý ngữ cảnh bị bỏ trước khi làm chậm phụ đề. Tone/text dùng cùng khoảng lời nói, không nhân xác suất hay tính transcript revision thành nguồn mới. Source/nhãn ngoài phạm vi giữ nguyên mass unsupported.

## Luồng hiện tại

AudioWorklet downmix → resampler sinc → PCM mono 16 kHz → Silero VAD → đoạn tối đa 3 giây → ASR profile đã chọn. Mặc định là PhoWhisper-tiny q8 đã fine-tune cho tiếng Việt; nếu không khởi tạo được, worker mới dùng Whisper multilingual tiny q8 làm phương án dự phòng. Tùy chọn Moonshine lấy chính các buffer PCM/VAD hiện có, cấp phần audio mới vào stream của model và trả revision tạm; không mở micro thứ hai. VAD vẫn quyết định thời điểm gửi partial/final, nên đây là thử nghiệm model streaming gắn với lịch VAD hiện tại, chưa chứng minh phụ đề từng từ hay độ trễ realtime đạt mục tiêu. Bắt đầu phiên chỉ gắn worker đã khởi tạo; không tải model khi bấm bắt đầu. Cửa sổ tạm được cập nhật tại chỗ; kết quả cuối ưu tiên, thay thế bản tạm và chỉ bản cuối mới đi vào lịch sử/fusion/lưu tùy chọn. Nếu đầu ra lặp bất thường hoặc rỗng, UI báo “Chưa nghe rõ” thay vì hiển thị chuỗi lặp như transcript đáng tin.

Camera lấy mẫu 5 Hz ban đầu; FaceInferenceBudget giảm dần còn 2 hoặc 1 Hz khi ASR có hàng đợi, RTF vượt 0,8 hoặc p95 xử lý mặt cao. Chỉ phục hồi từng mức sau 10 giây không tồn đọng và RTF dưới 0,6. Một khung mặt và một đoạn ASR được xử lý mỗi lần; khung camera cũ bị bỏ. Phân tích sắc thái văn bản chạy trong worker riêng khi không còn ASR chờ; giữ một tác vụ đang chạy và tối đa một đoạn mới nhất chờ. FaceWindow lấy các khung hợp lệ trong đúng khoảng lời nói. Không gọi dịch vụ inference mạng. Các tần số/độ trễ trên là cấu hình và điều phối hiện tại, chưa phải kết quả benchmark PC.

ASR queue tối đa ba đoạn chờ; chỉ một ASR chạy. VAD queue tối đa 96 frame. Quá tải dừng micro với thông báo; không bỏ audio rồi giả vờ phụ đề liên tục. Điểm dừng câu là 544 ms im lặng; đoạn liên tục bị giới hạn khoảng 3 giây và cần benchmark WER/CER so với baseline 4 giây. Dừng chủ động flush đoạn còn lại; chuyển nền/ngắt phiên bỏ xử lý chưa hoàn tất và giữ các câu đã xong. Các worker bị terminate khi rời trang. Không có diarization: một người đối diện nói.

Yêu cầu thu micro bật echo cancellation và noise suppression, tắt auto gain control; trình duyệt có thể không đáp ứng, nên ứng dụng đọc lại `getSettings()` và báo trạng thái. VAD đo RMS, clipping và nền nhiễu trong RAM để đánh giá chất lượng đầu vào; audio kém không được coi là bằng chứng sắc thái đáng tin nhưng phụ đề vẫn tiếp tục. Không có model denoise riêng. Bộ trích xuất F0/log-mel/prosody chỉ bật cho tone nghiên cứu; chưa có checkpoint tiếng Việt được nghiệm thu. Chất lượng ảnh được đo trên crop grayscale 64×64; classifier EmotiEffLib nhận crop RGB 224×224 đã chuẩn hóa ImageNet. Các phép đo chất lượng chỉ chọn abstain/hướng dẫn ánh sáng và vị trí, không phục hồi chi tiết.

## Model và preprocessing

Nguồn/revision/SHA-256 nằm trong `scripts/conversation-assets.lock.json`; runtime được lấy từ đúng phiên bản package lock. Không chạy script pin để tự chấp nhận model mới trong quá trình build.

- PhoWhisper-tiny ONNX q8: ASR mặc định thử nghiệm, weights upstream từ VinAI và được fine-tune tiếng Việt; decoder nhận cùng PCM mono 16 kHz và dùng `language=vietnamese`, `task=transcribe`, giải mã deterministic. Các graph/config/tokenizer được ghim tại `huuquyet/PhoWhisper-tiny@29a5ac0c94a244429e513ccb9e3625cea4daf20e`; model card của bản chuyển ONNX khai báo WTFPL, còn model upstream khai báo BSD-3-Clause. `onnx-community/whisper-tiny` vẫn được đóng gói làm fallback. PhoWhisper chưa có kết quả SignEmo so sánh trên cùng tập đã gán nhãn; việc đổi mặc định thử nghiệm không khẳng định WER hoặc độ trễ đã tốt hơn.
- Moonshine Streaming Tiny Vietnamese: profile thử nghiệm tùy chọn, model revision `quantized_26_08_24`, runtime `@moonshine-ai/moonshine-wasm@0.1.5`, MIT. Lockfile `scripts/moonshine-streaming-vi.lock.json` ghim SHA-256 cho tám asset model và hai runtime asset; script `npm run assets:moonshine` kiểm tra hash, phiên bản/giấy phép runtime và giới hạn tổng model+runtime ≤100 MiB. Build chuẩn bị tài nguyên từ nguồn ghim nếu chưa có bản cục bộ; production phục vụ chúng cùng origin. Adapter không dùng API mở micro của thư viện. Model card khai báo 27M tham số; đây là metadata upstream, không phải kết quả chất lượng/tốc độ SignEmo.
- Whisper tiny multilingual ONNX q8: fallback khi PhoWhisper không khởi tạo được. Ngôn ngữ giải mã `vietnamese` không đồng nghĩa model đã fine-tune riêng cho tiếng Việt. Smoke test cũ trên 5 câu đọc FLEURS cho thấy WER 0,7133/CER 0,4799/RTF 0,7558; mẫu này quá nhỏ và khác hội thoại tự nhiên, nên không đại diện hiệu năng sản phẩm.
- Silero VAD: 512 mẫu/step tại 16 kHz, 64 mẫu context và state recurrent. Cần ít nhất 256 ms được VAD đánh dấu lời nói; có pre-roll và silence boundary 544 ms. Các con số là cấu hình ban đầu cần đo.
- PhoBERT `huyleit/phobert-emotion-social`, INT8: fastBPE whitespace, giới hạn 128 token, input int64. Model card minh họa raw text; kiểm thử parity với PhoBERTTokenizer Python. Chưa có bằng chứng fine-tune phù hợp hội thoại hoặc preprocessing tối ưu; không giả định word segmentation đã được giải quyết.
- Cảm xúc tông giọng: đã loại khỏi worker, manifest và profile sản phẩm. Không nạp hoặc chạy model phân loại cảm xúc audio.

Transformers.js 3.8.1 dùng ORT riêng so với face/VAD/emotion. Hai thư mục runtime tách biệt có chủ đích để tránh thay nhầm WASM ABI. Moonshine WASM yêu cầu cross-origin isolation cho runtime threaded; chỉ Docker local với `/?moonshine=1` đặt COOP/COEP, còn tunnel và profile thường không đổi header. Moonshine thêm khoảng 43,5 MiB cả model/runtime, dưới ngân sách 100 MiB. Không nạp đồng thời hai ASR. Chưa bật WebGPU mặc định. Cần benchmark cùng PCM, tách người nói và held-out test trước khi xem xét đổi profile mặc định.

## Fusion

`src/domain/conversation.ts` là logic thuần. Mỗi nguồn phải hợp lệ, cùng khoảng thời gian, điểm hữu hạn và tổng mass không vượt 1. Giữ mass ngoài phạm vi. Đạt ngưỡng từng nguồn 0,65 và margin 0,15 mới được bỏ phiếu. Cần ít nhất hai nguồn khác nhau đồng thuận; nguồn đáng tin mâu thuẫn → chưa xác định. Trung bình có trọng số các nguồn đủ điều kiện; trọng số baseline bằng nhau.

Đây là late fusion thử nghiệm, không là xác suất cảm xúc thật. Bằng chứng văn bản và khuôn mặt phải cùng đoạn, qua kiểm tra chất lượng, đạt ngưỡng điểm/margin và đồng thuận; baseline có trọng số bằng nhau. Bản ASR gốc và revision của nó vẫn là một nguồn duy nhất. Tối ưu trọng số/ngưỡng bằng validation, tách người/session trước khi chia. Không dùng tập test để hiệu chỉnh. Nhịp chỉ phát từ quyết định fusion đủ điều kiện, tối đa một lần cho câu mới nhất trong 3 giây sau khi nói; mặt không phát nhịp dự phòng. Cooldown và idempotency theo đoạn vẫn áp dụng. Chưa có bằng chứng ích lợi giao tiếp.

## Dữ liệu và đánh giá

ASR smoke benchmark dùng public FLEURS `vi_vn` (CC BY 4.0), lưu attribution và sample IDs. Read speech không đại diện đầy đủ Bắc/Trung/Nam hội thoại tự nhiên và không có nhãn cảm xúc. Chưa có dữ liệu audio/video Việt đồng bộ có nhãn để đánh giá fusion. Không dùng TTS hoặc các clip ghép để tuyên bố độ chính xác.

Profile thử nghiệm hiện ưu tiên PhoWhisper-tiny q8, fallback về Whisper tiny nếu model không khởi tạo. Smoke test cùng 5 mẫu FLEURS bằng Transformers.js/ONNX Runtime Node CPU đạt WER 0,1533, CER 0,0944, RTF 0,1983; Whisper tiny trong cùng phép thử đạt WER 2,2667, CER 1,7108, RTF 0,3915. Đây không phải browser-WASM hoặc tập hội thoại tự nhiên; cần xác nhận trong worker trình duyệt và trên dữ liệu tách người nói trước khi gọi là chất lượng sản phẩm.

Toolchain đánh giá nằm ở `scripts/prepare-speech-evaluation.py` và `scripts/evaluate-speech.mjs`; kết quả quan sát ở VERIFICATION.md. Tập có điều khoản chưa rõ không tự nhập. Dữ liệu người tham gia cần đồng ý riêng, mã và thời hạn; không vào Git/cloud/feedback.

## Lịch sử

IndexedDB v3 thêm vault và conversations, giữ reports/consent cũ. AES-GCM-256, IV ngẫu nhiên mỗi lần ghi, metadata được xác thực qua AAD; PBKDF2 SHA-256 600.000 vòng bọc khóa dữ liệu. Không lưu mật khẩu/khóa dạng rõ. Chỉ lưu khi người dùng mở khóa và chọn lưu trước phiên. Tự khóa khi chuyển nền hoặc không hoạt động 5 phút. TTL 30 ngày được dọn khi ứng dụng chạy; trình duyệt đóng không thể bảo đảm xóa đúng giờ. Quên mật khẩu chỉ có thể xóa kho.

## Smoke benchmark hiện có

Whisper đánh giá trên 5 mẫu đọc của public FLEURS `vi_vn` (CC BY 4.0): tiny WER 0,7133, CER 0,4799, RTF 0,7558; base WER 0,3733, CER 0,2269, RTF 1,0167. Base tốt hơn trên mẫu nhỏ này nhưng chạy lâu hơn thời lượng audio, chưa đủ bằng chứng để đổi mặc định. Các con số không đại diện hội thoại tự nhiên hoặc phương ngữ. Chrome đã khởi tạo ASR offline sau khi xác minh checksum gói; xem `VERIFICATION.md`.

## Ứng viên ASR nghiên cứu

PhoWhisper-tiny (39M tham số theo upstream) là ứng viên đầu tiên vì được tinh chỉnh cho tiếng Việt và gần họ Whisper; repo hiện chưa ghim artifact q8 ONNX đã chuyển đổi. Gipformer 1.5 68M INT8 là ứng viên tiếp theo; upstream khai báo MIT và các trọng số INT8 cần thiết khoảng 73 MiB trước runtime. Kích thước, độ chính xác và tốc độ cần xác minh lại đúng artifact trong trình duyệt. Kết quả model card do tác giả công bố không phải benchmark SignEmo. Zipformer tiếng Việt 30M INT8 không được chọn cho profile sản phẩm vì giấy phép upstream CC-BY-NC-ND không phù hợp với hướng thương mại dự kiến.

Candidate chỉ được promote khi validation cho thấy WER giảm tối thiểu 10% tương đối so với tiny, CER không tăng, RTF trung bình ≤0,8, p95 hoàn tất ≤3 giây sau đoạn, peak memory không tăng quá 10%, rồi xác nhận một lần trên held-out test tách theo người nói. Nếu thiếu benchmark hoặc không đạt, giữ tiny. Tham khảo: [PhoWhisper](https://github.com/VinAIResearch/PhoWhisper), [PhoWhisper-tiny](https://huggingface.co/vinai/PhoWhisper-tiny), [Gipformer 1.5](https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt), [Gipformer artifacts](https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt/tree/main).

CaptionRevision hiện chỉ chuẩn hóa Unicode, khoảng trắng/dấu câu và bỏ lặp nguyên cụm ở biên các đoạn gần nhất. Không có model sinh văn bản hoặc sửa ngữ nghĩa. Bản gốc luôn giữ được và chỉ hiển thị revision khi nội dung đã thay đổi.

## Live tone experimental update - 2026-10-14

Conversation now has explicit optional FP32/WebGPU tone preparation and face/text/voice fusion. Product default remains face/text. See [LIVE_TONE.md](LIVE_TONE.md) for current behavior, quality gates, noise filtering and verification limits. Earlier statements that tone is lab-only describe older builds. No public deployment or Vietnamese accuracy promotion is implied.
