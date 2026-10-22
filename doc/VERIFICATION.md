# Nhật ký kiểm chứng SignEmo

## Kiểm tra trước push và tối ưu tải — 22/10/2026

- `npm run check` qua: lint/boundaries 127 module, TypeScript, **303 test/86 file**, checksum 13 face +25 conversation và production build. `npm run format:check` qua toàn repo. Log: `output/model-download-check.log`. Đã sửa matcher ký hiệu để giữ nguyên câu/phủ định, cập nhật test tên nút và fixture HTTPS/media; sáu file định dạng cũ chỉ được format.
- `npm run build:vercel` qua, đóng gói 40 URL `/immutable/<sha256>/...` sau khi xác minh file output; không đưa binary vào Git. HEAD từng URL trên preview đều 200, GET runtime MediaPipe JS đúng SHA. Header immutable chỉ áp URL checksum; URL gốc/CacheStorage không đổi. `sw.js` không cache HTTP dài hạn. Log: `output/model-download-vercel-build.log`.
- Queue tối đa hai file và tổng kích thước khai báo <=48 MiB; file lớn tải riêng. Test overlap/budget/progress monotonic, lỗi/hủy phải abort và drain sibling, không chạy batch kế tiếp; kiểm thử đóng gói thiếu/hỏng/path ngoài allowlist. Không đổi model/preprocessing/ngưỡng.
- Chrome/Windows, production preview: 14 entry core +28 entry conversation (40 file +2 manifest), reload offline dưới service worker vẫn đủ tài nguyên, Hội thoại không báo lỗi và không mở thiết bị. Ảnh `output/playwright/model-final-offline.png`, kết quả `model-final-offline.log`. Fault injection bằng Playwright route trả 404 cho immutable runtime không gây lỗi thiếu tài nguyên vì fallback dưới service worker vẫn tải được; không tính lượt timeout chờ thông báo này là bằng chứng kiểm thử UI nhánh 404. Nhánh lỗi được kiểm bằng regression downloader.
- Docker clean Linux build đã cài dependency bằng `npm ci`, chuẩn bị/checksum tài nguyên và build thành công. Image `signemo:model-download-20261022`, ID `sha256:4567ace3e0570059250f61ce256d1843c886810011cff79881e1eb7f7f042849`; container kiểm riêng cùng tên, read-only/cap-drop/no-new-privileges, healthy. HTTP `/healthz`, `/`, manifest và runtime JS đều 200. Thêm lock runtime vào `.dockerignore` allowlist để đúng các lệnh COPY; không thay container đang có. Log: `output/model-download-docker.log`.

Các lượt đo trả 0 request do kết thúc quá sớm/cache được loại khỏi kết quả. Lượt trên origin mới chỉ được tính khi đã xác minh đủ 40 file và UI kết thúc chuẩn bị; không công bố phần trăm tăng tốc từ các lượt chưa hoàn tất hoặc khác tải hệ thống. Xác nhận cấu trúc: 40 URL checksum trực tiếp đã trả 200, tránh một compatibility probe cho mỗi file; queue overlap được kiểm riêng. Bằng chứng browser/đo mạng lưu tại `output/playwright/model-speed-*.log`.

Chưa nghiệm thu camera/micro vật lý, Android, chất lượng inference hoặc mạng di động. Trạng thái deploy public cần đọc theo commit/check Vercel và HTTP thực tế, không suy ra từ local build.

## Thiếu tài nguyên trên Vercel — 22/10/2026

- HTTP trực tiếp tại `https://sign-emotion.vercel.app/`: trang và hai manifest trả 200; B2, face landmarker, MediaPipe JS/MJS/WASM và ORT WASM kiểm tra trả 404. Lỗi trùng file `vision_wasm_internal.js` trong ảnh người dùng. Build command cũ không chuẩn bị các binary/runtime bị Git ignore.
- `npm run build:vercel` mới qua toàn bộ prepare/verify/build. Đọc lại output `dist`: 40 file đúng byte count/SHA-256, 339.753.857 byte (324,0145 MiB). Các manifest được tạo lại không có diff.
- Regression tải immutable/fallback/resume, phân loại lỗi và candidate preparation: 17/17 qua (3 file). Thêm trường hợp runtime có source npm không phải URL, SPA HTML và CDN cuối cùng trả 404; trả `missing-assets` thay vì nhắc người dùng giữ mạng ổn định.
- `npm run check`: lint/boundaries (126 module) và TypeScript qua; Vitest 289/295 qua, 6 lỗi trong 4 file: `sign-playback`, `sign-phrases-100`, `quick-phrase-picker`, `conversation-start` (2 timeout và 1 assertion môi trường HTTPS/media). Không sửa các phần này trong lượt tải model. Build đã chạy riêng thành công; không ghi full gate đạt.
- `npm run format:check`: còn 6 file ngoài diff chưa đúng định dạng: `signPhrasesCatalogue.ts`, `QuickPhrasePicker.tsx`, `usePlayableSigns.ts`, `sw.ts`, `vsl-hcm-manifest.json`, `vsl-video-100-manifest.json`.
- Chrome qua Playwright CLI, Windows, Vite production preview `127.0.0.1:4183`, baseline PhoWhisper/B2: tự tải đủ 40 file vào CacheStorage, service worker điều khiển trang. Sau mô phỏng offline và reload, cả 40 file vẫn có, màn Hội thoại không báo tải dở/lỗi; MediaPipe log `Graph successfully started running`. Ảnh: `output/playwright/model-download-fixed-offline.png`. Hai lỗi resource offline là clip preview và VTT chưa lưu, không phải model; hai cảnh báo MediaPipe về XNNPACK/OpenGL.

Chưa triển khai lại Vercel hoặc thử Docker trong lượt này; không bật đồng ý/camera/micro, không kiểm phần cứng, Android hoặc chất lượng inference trên hội thoại thật. Link public vẫn cần deploy bản sửa theo `DEPLOYMENT.md`.

## Tăng diện tích màu — 18/10/2026

Docker đã rebuild và xác nhận browser tải đúng palette/rules mới, build ID `avatar-colour-20261018`; production smoke script `output/playwright/avatar-colour-production.js`. Không chạy lại benchmark AI vì không đổi model/renderer/scheduler; số đo avatar trước không được trình bày thành số đo bản màu mới.

265 test/74 file qua `npm run check` (`output/research-evaluation/avatar-colour-check.log`), format-check qua. Contrast test cho 7 badge trắng/nền semantic và chữ tối/nền pastel >=4,5:1. Chrome harness `output/playwright/avatar-colour-qa.js`: kiểm computed style 7 nền khác nhau, nhãn trắng, phụ đề #24322C; đổi face 7 nhãn nhưng caption vẫn quyết định Buồn, tắt màu gỡ đúng accent. Không tràn 1200/390/844/720 px. Ảnh `avatar-colour-*.png`. Kiểm trình bày, không phải thử nhận biết màu với người dùng, Android thật hay benchmark inference mới. Docker local image `signemo:avatar-colour-20261018`, chưa cập nhật public; log build `avatar-colour-docker.log`.

## Avatar mặt và màu tách nguồn — 18/10/2026

`npm run check`: 264 test/74 file, lint 114 module, typecheck/assets/build qua; format-check cuối qua. Docker local 8095 `signemo:avatar-face-20261018` healthy, healthz 200; public image giữ nguyên. Chrome kiểm 7 pose trên 1 canvas, dừng render khi tĩnh, context lost về SVG, giảm chuyển động, màu Vui của mặt tách màu Buồn của câu, không tràn 390/844/720 px. Asset GLB/chunk 3D cache offline HTTP 200; chú giải hỗ trợ Enter.

A/B 120s với nguồn requestFrame >=19,9 Hz: tắt/bật 3D đạt 4,998/5,007 Hz, 12/12 cửa sổ >=4,5 Hz, p95 nhãn fixture 355,9/330,4 ms; RTF 0,164/0,129, final queue 0, peak private memory +2,58%. Lượt bật mechanical qua, Finish 0 worker/CDP/pthread/track/AudioContext/canvas; lượt tắt có một CDP target Moonshine sau chờ 6s nên **chưa qua toàn bộ lifecycle A/B**. Không suy cải thiện tốc độ từ một cặp đo. Clock audio không đạt, không nghiệm thu partial/final latency; chưa đo 30 phút/Android/accuracy. Lượt nguồn chỉ 1 Hz bị loại, raw giữ nguyên.

Ký hiệu: 2 mẫu keypoint public nghiên cứu, **0 mẫu TP.HCM được duyệt**, không có avatar dịch câu trong bản thường. Chi tiết, nguồn, checksum và raw logs: [AVATAR_COLOURS_SIGN_RESEARCH_20261018.md](AVATAR_COLOURS_SIGN_RESEARCH_20261018.md).

## Video local, nhịp mặt và ký hiệu — 18/10/2026

`npm run check` qua **256 tests/70 files**, lint/boundaries 110 modules, TypeScript, checksum 13 face +25 conversation và build; `format:check` qua. Các lượt đầu thất bại vì test còn mong iframe/âm bật và assertion đóng capture trước khi flush ASR xong; đã cập nhật hành vi và đợi đúng vòng đời, không tăng timeout. Log sạch: `output/research-evaluation/intro-face-check-clean.log`. CSS cỡ phụ đề clip được build/kiểm lại trong image cuối.

Docker local `signemo:media-face-20261018`, digest `sha256:63abcb34c024f3de26b484e463b480aec8dd514c153117513075ef73e48ed6b0`, container `signemo-media-web-1`, chỉ `127.0.0.1:8095`, `/healthz` 200/healthy. Giữ B0-WebGPU/MediaPipe CPU/Moonshine two-thread của bản local trước; không thay public v27/8080, v31/8093 hoặc staging 8094.

Chrome và Edge thật qua video thường + isolated: không yêu cầu MP4/VTT trước thao tác, phát/seek, 4 cue phụ đề, lưu hai asset đúng cache riêng và reload/tua offline; Range `100-199` trả 206/100 byte. Viewport 390 px không tràn ngang. Không iframe/request ngoài origin/non-GET/pageerror trong các kịch bản media. Edge giả lập MP4 404 và quota thiếu vẫn có nút Vào hội thoại hoạt động. Logs `intro-face-chrome-media.log`, `intro-face-edge-media.log`, `intro-face-media-failures.log`; ảnh `output/playwright/media-*-mobile.png`/desktop là lượt Edge cuối. Phụ đề VTT là bản nháp ASR local, chưa được người nghe soát.

Lượt fixture Chrome đầu 120 giây (+30 giây warm-up): 597 frame, 4,974 Hz, tất cả cửa sổ 10 giây >=4,5 Hz; không tồn đọng final, không request ngoài origin/non-GET, Finish đưa Window worker/track/AudioContext và CDP inference targets về 0. **Chỉ cơ chế qua**: audio clock lệch ~29 giây/120s, nên không nghiệm thu latency ASR. Private RAM sampler dừng sớm do Max(Int32) tràn >2 GB; không dùng peak RAM này. Đã sửa bộ đo sang Int64 và đo lại A/B riêng, kết quả ở [báo cáo](INTRO_FACE_CUES_20261018.md). Raw lỗi giữ tại `intro-face-first-120s.json`/`intro-face-baseline-incomplete-memory.json`.

Ký hiệu có player/toggle/queue/cleanup và regression bằng fixture, nhưng **0 clip TP.HCM đủ điều kiện phân phối**. Không công nhận sáu ký hiệu thật hoặc chi phí decode tương ứng đã nghiệm thu. Chưa đo motor Android/iPhone, micro/cảm xúc người thật, accuracy hoặc 30 phút trên image mới.

A/B lại bằng sampler Int64, cùng fixture 120s +warm-up30s: đối chứng/bản mới cadence 4,997/4,998 Hz, 12/12 cửa sổ >=4,5 Hz; nhãn fixture p95 401,6/390,8 ms, RTF 0,250/0,236; peak private committed 2.725.986.304/2.911.674.368 byte (+6,81%). Coverage sampler 179,84/187,66 giây, không bị cắt >2 GB. Final queue peak 0 và Finish đều 0 worker/track/context/inference targets. Clock cả hai lệch ~31s, không dùng partial/final p95 nghiệm thu. Không video ký hiệu thật được decode; chưa đủ bằng chứng đạt cổng phần này hoặc không leak. Raw A/B tại `intro-face-baseline-fixed-memory.json` và `intro-face-new-fixed-memory.json`; bảng chi tiết trong báo cáo. Layout proxy 200% page zoom (720 CSSpx/DPR2), dọc/ngang, focus Tab/giảm chuyển động qua; không là kiểm text-only OS scaling hoặc Android thật.

## Điều phối tài nguyên — lượt đang thực hiện 17/10/2026

Regression mới riêng scheduler/RTF/buffer/adapter: 8 tests/3 files qua, TypeScript qua. Probe worker B0/WebGPU + MediaPipe CPU và GPU đều trả `valid → multiple-faces → no-face → valid` trên ảnh public; không là bằng chứng accuracy hoặc tốc độ. Sampler private bytes xác định đúng browser thử riêng. Full suite trong lúc native compiler chạy: 245/246 tests qua, một test nút retry GPU timeout; chưa tính là quality gate đạt và cần chạy lại khi rảnh. Source build/custom checksum, ma trận 120 giây và 30 phút chưa hoàn tất. [Báo cáo riêng](RESOURCE_SCHEDULING_20261017.md) ghi cổng và giới hạn, không thay số đo v31 bên dưới.

## Moonshine/B0 local v31 — 17/10/2026

Image `signemo:moonshine-b0-20261017-v31`, digest `sha256:671a3f5e94c7ac28999cfe7225a9850f2b4d9a0a50e1478a24ba496a3bf6e8ea`, chỉ localhost:8093. Public 8080 vẫn v27; không cập nhật tunnel. Runtime Moonshine v0.1.5 release khác binary npm, kiểm SHA qua lock, model+runtime ~43,5 MiB. Sửa partial/delta/final flush/warm-up và dispose worker con có xác nhận/tự đóng parent. Không thay ngưỡng mặt/fusion hay bật tone.

Full `npm run check`: **241 tests/64 files**, lint/boundaries 105 modules, TypeScript, checksum 13 face +25 conversation, build và format qua. Lượt check trước có timeout test GPU khi build Docker đồng thời; đã lưu nhận xét và chạy lại sạch, không tăng timeout. Regression riêng cleanup mới 4/4 qua. Browser thật phát hiện CSP nested pthread, đã sửa exception trên route runtime/worker riêng; không mở eval trên document.

Năm FLEURS public (CC-BY-4.0): 18/150 word errors =12% WER; CER 35/643 =5,44% gồm khoảng trắng; ASR riêng RTF ~0,150 gồm partial. Không VAD, không hard-cut, không realtime pacing; first-text cần 1,024–2,560 giây PCM, chưa phải latency micro. Không so CER với báo cáo cũ loại khoảng trắng. Chưa đủ bằng chứng chọn thay Gipformer.

`moonshine-b0-v30-120s.json`: fixture tải 120 giây, capture→face delivery p95 411,92 ms, cadence quan sát 1,22 Hz; first partial p95 1.379,58 ms, final p95 1.100,52 ms, RTF hiệu dụng cuối 0,252. Có drift media/wall ~30 giây; delivery mặt chưa gồm dwell, final tính từ buffer có silence. Không dùng các số này nghiệm thu mục tiêu PC/micro. Không POST/external request/page/worker error trong fixture. Main-renderer heap tối đa 8,13 MiB không phải toàn bộ RAM. Sau Finish Window worker/track/context về 0 nhưng snapshot CDP sau 1 giây còn 7 targets, nên gate không qua. Probe ASR riêng sau ack +6 giây không còn targets. Báo cáo lỗi giữ nguyên; lượt kiểm lại teardown ghi riêng, không thay kết quả cũ.

Lượt harness tiếp theo `moonshine-b0-v30-target-poll-incomplete.json` chạy đủ 120 giây media fixture, nhưng lỗi đồng hồ Node trong phần đo target sau Finish làm report incomplete. Đã sửa harness dùng `Date.now()`; không tính lượt này là đạt. Chi tiết, phạm vi và các mục chưa kiểm: [MOONSHINE_B0_TRIAL_20261017.md](MOONSHINE_B0_TRIAL_20261017.md). Chưa đo micro thật, cảm xúc người, Android hoặc 30 phút trên profile này.

Kiểm lại v31: `moonshine-b0-v31-120s.json` completed **120,04 giây**, mechanicalChecksPassed=true; Finish đưa cả Window workers/tracks/application contexts và CDP inference targets về 0 (CDP 7→0 sau 1,19 giây từ lần chụp đầu). Lỗi parent v30 được sửa bằng self.close sau cleanup/ack. Không page/worker error, non-GET/external request hoặc tải Whisper không dùng. 182 frame, 1,52 Hz; face delivery p95 352,59 ms, partial p95 1.140,74 ms, final p95 706,93 ms, ASR effective RTF cuối 0,186. **Chỉ cơ chế qua**: mapped clock drift 30,89 giây, chưa tính dwell nhãn/âm vị cuối, chưa giữ 5 Hz; không nghiệm thu realtime micro. Heap main-renderer tối đa 7,82 MiB không phải tổng RAM hay bằng chứng không leak. Không chạy suite/build đồng thời lượt đo.

Offline v31: trang mới khi mất mạng vẫn isolated/SW-controlled, Moonshine/VAD/B0 ready từ cache, 0 lỗi worker và 0 lần gọi getUserMedia. Tùy chọn text khả dụng chỉ chứng minh asset đã chuẩn bị; chưa chạy worker text/inference offline. Scope “including optional text” trong report `moonshine-offline.json` không được diễn giải rộng hơn giới hạn đó. Screenshot `output/playwright/moonshine-offline.png`.

## Kiểm chứng toàn diện full luồng & YouTube Demo Embed (v25) — 16/10/2026

- **Lỗi nhúng YouTube và khắc phục triệt để:**
  - Phát hiện và giải quyết xung đột header máy chủ Nginx: `Referrer-Policy: no-referrer` khiến máy chủ YouTube từ chối kết nối (Error 153). Cập nhật thành `strict-origin-when-cross-origin` ở `docker/security-headers.conf` và `public/_headers`.
  - Gỡ bỏ `Cross-Origin-Embedder-Policy: require-corp` khỏi trang chủ `index.html` (chỉ duy trì tại `/research/`). Trình duyệt cho phép nhúng iframe YouTube an toàn mà không chặn CORS/CORP.
  - Video YouTube demo (`g6lhRElRiWs`) đã được xác nhận tải và phát mượt mà trên Chrome thực tế, kèm fallback poster `/demo/signemo-poster.svg` và nút mở tab riêng khi offline.
- **Kết quả cổng kiểm thử chất lượng (Quality Gates):**
  - `npm run lint`: Lint và boundary check đạt 100% trên 102 module, không có vòng lặp phụ thuộc hoặc vi phạm ranh giới kiến trúc.
  - `npm run typecheck`: TypeScript `tsc -b` đạt 0 lỗi type.
  - `npm run test`: Đạt toàn bộ **233/233 tests trên 62 test files** (bao gồm luồng thiết bị, kho mã hóa vault, camera, microphone, hội thoại, nhịp rung, PGlite/IndexedDB, và PWA offline).
  - `npm run assets:verify`: 13 face assets + 25 conversation assets kiểm tra checksum đạt chuẩn 100%.
  - `npm run build`: Production bundle Vite (Rolldown) + PWA service worker (44 precached entries) build thành công không lỗi.
  - `npm run format:check`: Đạt chuẩn định dạng Prettier.
- **Kiểm thử Endpoint & Quick Tunnel trực tuyến:**
  - Container `ou-khinghip-web-1` (port 8080) trạng thái healthy. Các endpoint `/`, `/healthz`, `/sw.js`, `/manifest.webmanifest`, `/demo/signemo-poster.svg` phản hồi HTTP 200 OK.
  - Quick Tunnel Cloudflare mới: `https://biodiversity-accessible-codes-ensure.trycloudflare.com/` hoạt động ổn định, HTTP 200 OK, phản hồi đầy đủ CSP và header an toàn.

## Tiếp tục A/B audio và cleanup — 16/10/2026

Harness `npm run research:audio-clamping` đã chạy trên 5 WAV FLEURS CC-BY-4.0 có SHA, Silero local và chính UtteranceBuilder TS. Có 19 đoạn, clamp 3; A/B cùng 16 lỗi/150 từ (WER 10,67%), 38/643 ký tự (CER 5,91%), 1 deletion và 2 insertion. Không cải thiện nên không bật clamp production. Tail deletion ba từ cuối clip là proxy, không thay alignment/hallucination annotation. Runtime reference Python 3.11.9, Sherpa 1.13.8, ORT 1.22.1 CPU/1 thread; không là số đo browser hoặc độ chính xác tổng quát. Artifact `output/research-evaluation/audio-clamping/summary.json` không chứa transcript.

Smoke 120 giây v19 bắt được 1 AudioContext âm phản hồi chưa đóng. Sửa release ở v20 đã cho context/track về 0, nhưng sau Finish còn 3 worker do tự chuẩn bị phiên tiếp. Báo cáo hai lượt giữ riêng (`pipeline-smoke-v19-context-failure.json`, `pipeline-smoke-v20-audio-fixed.json`); không dùng gate pagehide thay Finish. Người dùng chọn dừng tự chuẩn bị sau phiên, giữ adaptive dwell và bỏ thu thập/calibration 5–10 clip mặt.

Source cuối của lượt này qua **213 tests/58 files**, lint/boundaries 98 modules, TypeScript, checksum 13 face +25 conversation, production build và format. Thêm regression âm phản hồi resume đến muộn/pagehide, Finish không dựa vào unmount, không tự tái tạo worker và chuẩn bị lại không xin thiết bị. Test harness lúc đầu dùng node:test bị Vitest phát hiện như suite rỗng; đã chuyển đúng Vitest, chạy lại toàn bộ thành công. Không tính lượt thất bại là check đạt.

Image local cuối `signemo:lifecycle-20261016-v21`, ID `sha256:ca7403c4d3b7d3646b56ba819878d26faa6330d3f59808c23eedbe4480185bcc`, build `demo-20261016-lifecycle-v21`; container nghiên cứu localhost:8092. Public vẫn v19, không có mount fixture mới. Smoke Chrome PC với worker thật đang kiểm Finish/pagehide trước soak 30 phút. Chưa ghi nhận soak hoặc nghiệm thu Android từ các kiểm tra trên. Chi tiết/ma trận còn thiếu: AUDIO_TAIL_AND_SOAK_20261016.md và CORE_PLAN_COMPLETION_AUDIT_20261016.md.

Chrome v21 lượt đầu dừng sớm khoảng 80,6 giây với audio gap tối đa khoảng 1.042 ms, clock origin shift khoảng 18 giây; worker không báo lỗi, cleanup về 0. Giữ báo cáo `pipeline-smoke-v21-chrome-clock-failure.json`, không tính đạt. Harness bổ sung raw context/sample-offset drift và output-timestamp pair skew để phân biệt mất quantum với đồng hồ render chạy khác wall clock; không nới ngưỡng gap 500 ms hoặc đổi capture sản phẩm.

Lượt kế tiếp hoàn tất **120 giây**, đủ classifier/partial/final/text/fusion, **0 worker/track/AudioContext ứng dụng ngay sau Finish**, cả pagehide/harness cleanup cũng qua. Main-renderer heap lớn nhất khoảng 8,62 MiB, 29 final caption (chưa đủ chạm cap 30). RTF cuối có tính partial khoảng 0,224. Raw media origin/context gap gần 0; output pair skew tối đa khoảng 53 ms, mapped origin dịch khoảng 468 ms trong phiên. Đây là smoke tổng hợp, không là nghiệm thu latency micro thật; không loại bỏ lượt lỗi trước đó. GPU Chrome là Intel gen-12lp, không fallback software. Artifact `pipeline-smoke-v21-chrome-passed.json`.

Đã bắt đầu lượt **1800 giây** trên cùng container/artifact bằng wrapper và browser riêng, cùng sampler process-memory. Khi chưa có báo cáo terminal thì trạng thái vẫn **đang chạy**, chưa nghiệm thu 30 phút. Không rebuild/chạy suite nặng trong lượt này.

## Bản bàn giao cuối v19 và poster — 16/10/2026

Edge HTTPS public cuối: đúng v19, AI lõi sẵn sàng/Start enabled sau consent, Gipformer selected, 0 pageerror/non-GET về origin, 0 request/cache B2 (`output/deployment/public-v19-browser.json`). Không mở camera/micro vật lý. Browser QA được đóng, web/tunnel giữ chạy.

Sau góp ý mới, tăng kích thước các badge chật trong SVG, chia hai dòng mô tả quan sát và đưa nút play ra ngoài vùng ảnh. Kiểm SVG trên Edge: mọi text trong canvas, text gắn data-frame trong badge/card; ảnh `output/playwright/poster-frame-v19.png`. Kiểm tích hợp tại 1366x768, 390x844, 360x640, 800x360: ảnh 16:9, nút dưới ảnh và trong figure, không tràn ngang. Đã xem hai ảnh desktop/mobile `poster-integrated-1366.png`, `poster-integrated-390.png`. Đây là sửa minh họa/giao diện, không là kết quả model.

Full `npm run check` cuối trước sửa poster qua **208 tests/57 files**, lint/typecheck/checksum/build. Sau sửa DemoPlayer/poster: intro 2/2, TypeScript/format qua; Docker v19 build/verify qua. Không tuyên bố full suite chạy lại sau một thay đổi presentation đã được regression/browser kiểm. Offline worker thật đã qua ở v18: reload/prepare B0 và Gipformer, no-face canvas/PCM im lặng, 0 pageerror (`pipeline-offline-v18.json`); v19 không đổi pipeline/model/offline code.

Image v19 `sha256:46779eed57100812e0a4fa97250d75bb36a9b332d790326d67ecdff52a6576d6`. Nâng v18 ->v19 trên cùng staging origin qua nút cập nhật thật thành công, cache encoder giữ nguyên. Client public cũ cũng chuyển sang v19 bằng đợi worker installed, rời rồi vào lại origin; không xóa storage. Public container healthy/HTTPS healthz 200, cùng hostname; giữ tunnel và rollback v13. Phép đo nguồn tổng hợp/PC/Edge không chứng minh Android/Safari, chất lượng Angry/Fear/Disgust hoặc latency mục tiêu.

## Bổ sung player/PWA v18 — 16/10/2026

Build cuối `demo-20261016-responsive-v18`, image `sha256:d8c066a29b442077c187f3dd9fef836c67dbfaf058c9e2945b557c965ec57c46`. Sau kiểm responsive, phát hiện min-height 200 px của player cũ làm tỷ lệ sai; bỏ min-height, kiểm đúng 16:9 cả tám viewport, không request YouTube trước bấm trong lượt quan sát. Regression intro 2/2 qua. Không gọi iframe network hoặc video playback mới là đã nghiệm thu; đây là kiểm hình học và click-only.

Tái hiện PWA v16 tiếp tục dùng CSS cũ dù v17 đã cài và waiting; không có nút cập nhật. App bổ sung đối chiếu registration.waiting khi mount để bù sự kiện trước listener; không tự gửi SKIP_WAITING hoặc reload. Affected app/session/player 19 tests qua, typecheck/lint/format qua. Profile QA đã chuyển v17 ->v18 bằng đợi worker installed, rời origin rồi mở lại; cache encoder Gipformer còn nguyên. Đây là đường xử lý cho client cũ chưa có bản sửa; không xóa vault/cache/cài đặt. Không áp cờ unsafe-webgpu hoặc tắt bảo vệ trình duyệt. Các kết quả v16 ở dưới vẫn là bằng chứng pipeline trước thay đổi UI/PWA cuối.

## Responsive và core v16 — 16/10/2026

Public cuối: `ou-khinghip-web-1` healthy/HTTPS healthz 200, cùng hostname `changelog-trends-bosnia-measurements.trycloudflare.com`, đúng build v16. Edge public khởi tạo AI lõi thành công, Start enabled sau consent; profile Gipformer, 0 pageerror/non-GET về origin, 0 request/cache B2 (`output/deployment/public-v16-browser.json`). Không mở thiết bị thật. Giữ v13 làm rollback và tunnel hiện hữu; chưa xác nhận qua mạng ngoài độc lập.

`npm run check` qua lint/boundaries 98 modules, TypeScript, **207 tests/57 files**, checksum 13 face +25 conversation và production build. Format-check qua; candidate 28 asset/314,54 MiB đúng checksum/budget. Python research gate: 4 qua, 1 skip vì thiếu dependency training tùy chọn; không tuyên bố kiểm training. PostgreSQL/PGlite kiểm migration retention 24 giờ cùng rate-limit/RLS/tombstone; không có hosted Supabase deployment.

Production v15 qua tám viewport trong `output/playwright/responsive-report-v15.json`: camera/caption hoàn toàn trong viewport, 0 tràn ngang/pageerror, hai cột ngang thấp. Phiên canvas+audio im lặng tổng hợp giữ cùng video/stream/tracks sống, không tạo worker/capture lại sau xoay. Không dùng thiết bị camera/mic vật lý. Sau phát hiện nút 360x640 bị cắt, v16 giảm line-height phụ; số đo bốn viewport nhỏ xác nhận nút >=44 px nằm đầy đủ trong vùng capture, caption >=281,8 px và không tràn. Không gọi đây là nghiệm thu Android/iOS, Safari, touch gesture hoặc hiệu năng thực tế. Ảnh dọc/ngang ở output/playwright; không có vòng polish mở rộng.

V16 `demo-20261016-responsive-v16`, image `sha256:cabda52f289a5e9f959968bf1604e739833ea35e717b73f77456fa68001a2442`, staging localhost:8089 healthy. Offline cache ấm reload/prepare thật: B0-WebGPU trả no-face với canvas trống, Gipformer giải mã 1 giây PCM im lặng, 0 pageerror (`output/research-evaluation/pipeline-offline-v16.json`). Thời gian decode im lặng không là latency/WER hội thoại. Nginx syntax/healthz qua, hash asset immutable, không COEP toàn site, viewport-fit=cover. Source/model không đổi sau các kiểm này; chỉ có tài liệu/deployment override.

Không tăng thời hạn giữ khóa: bộ duyệt tự động từ chối bước kiểm tra thay đổi 15 phút, đã hoàn nguyên; người dùng sau đó chọn giữ 5 phút. Test vòng đời mới xác nhận idle reset, khóa khi ẩn và cleanup timer. Giữ PBKDF2 600.000 vòng/dữ liệu cũ. Các khác biệt có chủ ý với đề xuất (không permanent lock, không giữ vote khi mất mặt, không blanket immutable/COEP và không hứa tăng tốc chưa đo) ghi ở RESPONSIVE_CORE_20261016.md.

## Khởi tạo AI v13 — 16/10/2026

`npm run check`: 199 tests/56 files, 98 modules boundaries, typecheck, checksum 13 face + 25 conversation và production build qua; format-check qua. Bảy artifact Gipformer đối chiếu đúng pinned manifest. Regression có download vượt 120 giây giả lập, Range resume/hash/retry hữu hạn, cancellation, thông báo allowlist và retry tương thích.

Docker `signemo:startup-20261016-v13` image ID `sha256:7bd2a8bffd5dbe6e4b6988b977ca6a2e65fc8a83a2e5a5fce7abafebbe08443a` build thành công. Edge staging 8088 và HTTPS public đều đúng build `demo-20261016-startup-v13`, AI lõi sẵn sàng, Start enabled sau consent, profile Gipformer; 0 pageerror, 0 request B2, không cache B2 và 0 non-GET về origin trong lượt quan sát. Không bấm mở thiết bị. Báo cáo `output/deployment/startup-v13-browser.json`, `public-v13-browser.json`.

Cache ấm offline: reload/khởi tạo thành công; worker thật trả no-face cho canvas trống với B0/WebGPU và giải mã PCM im lặng bằng Gipformer, 0 pageerror (`output/research-evaluation/pipeline-offline-v13.json`). Không coi thời gian PCM im lặng là benchmark ASR. Giả lập riêng lỗi GPU ở Worker init: nút tương thích hiện và khởi tạo B0/WASM thật thành công, không mở thiết bị. UI desktop/mobile đã xem; mobile viewport 390 px không tràn ngang. Cảnh báo ORT về node chạy CPU không phải pageerror hoặc lỗi khởi tạo.

Public container healthy/healthz HTTPS 200; tunnel giữ nguyên link hiện hành, không restart; v12 giữ tag rollback. Chưa tái hiện chính xác lỗi profile người dùng; xác minh được lỗi thiết kế gộp download vào timeout và sửa nó, không khẳng định stream-closed hay GPU là nguyên nhân duy nhất. Chưa kiểm camera/micro vật lý, mạng ngoài độc lập, Android, accuracy hoặc latency hội thoại. Xem [báo cáo](STARTUP_RELIABILITY_20261016.md).

## Khôi phục Quick Tunnel bị mất — 16/10/2026, 09:30

Tái hiện ảnh lỗi: `lot-tackle-legendary-anna.trycloudflare.com` trả NXDOMAIN qua DNS máy lẫn 1.1.1.1. Container public vẫn healthy, cloudflared PID 18816 còn chạy nhưng log lặp `Unauthorized: Tunnel not found`/`Register tunnel error from server side`. Không kết luận nguyên nhân sâu hơn của việc mất tunnel hoặc đổi DNS hệ thống.

Đã kiểm tra command line rồi dừng đúng tiến trình tunnel hỏng do phiên trước tạo, giữ log, khởi động tiến trình HTTP/2 mới chạy ẩn PID 27092. Link mới **https://changelog-trends-bosnia-measurements.trycloudflare.com/** đăng ký kết nối Cloudflare thành công; DNS máy và 1.1.1.1 đều có A record, HTTPS healthz **200**, entry JS chứa **demo-20261016-intro-lcp-v12**. Ghi tại `output/deployment/tunnel-v12-current-health.json`, metadata hiện hành `tunnel-v12.json`. Không đổi image/source/model, không chạy lại inference/quality suite cho việc sửa kết nối. Chưa xác nhận từ thiết bị/mạng ngoài độc lập; không bảo đảm uptime của Quick Tunnel.

## Phát hành dùng thử public v12 — 16/10/2026

Theo yêu cầu người dùng, đã recreate riêng `ou-khinghip-web-1`/8080 bằng image v12 digest `sha256:174791bc6c933015990ca373b25408af213398886228381407c223f48bc99b3c`. Không sửa source/bundle đã qua các cổng bên dưới. Override `compose.public-trial.yaml` qua Prettier/config validation; giữ rootfs read-only/cap-drop/no-new-privileges của base, chỉ bind ba thư mục model/runtime công khai read-only. Không mount fixture, transcript, toàn bộ research hoặc volume dữ liệu người dùng. Image public trước đó giữ tag `signemo:rollback-public-20261016-v12`; không tác động container kiosk.

Cloudflared cũ không chạy; mở Quick Tunnel HTTP/2 mới **https://lot-tackle-legendary-anna.trycloudflare.com/** → `http://127.0.0.1:8080`, tiến trình ẩn, no-autoupdate. Container healthy, Nginx hợp lệ, local/public healthz 200. HTTPS entry JS chứa đúng `demo-20261016-intro-lcp-v12`; manifest không B2, Gipformer đúng version Sherpa 1.13.8; HEAD B0/runtime GPU trả 200. Kết quả tại `output/deployment/public-v12-http.json`, PID/log tunnel trong cùng thư mục, không ghi credentials/media.

Chrome/PC trên URL HTTPS công khai: secureContext/media API/WebGPU có; AI lõi chuẩn bị xong và nút bắt đầu enabled sau consent; Tùy chọn đúng `gipformer-research`; không request/cache B2, 0 pageerror và 0 request non-GET về origin trong lượt quan sát. Không bấm mở thiết bị, không gửi media. Lượt QA đầu đánh dấu incomplete do tìm selector bên trong Tùy chọn đang đóng dù coreReady đã true; sửa công cụ mở disclosure, chạy lại đầy đủ đạt. Không sửa ứng dụng để né lỗi. Browser QA đã đóng và giải phóng worker; tunnel được giữ chạy.

Đây là kiểm tra từ PC qua HTTPS public, chưa có kiểm tra mạng/thiết bị ngoài độc lập, camera/micro vật lý, Android hoặc quality mới. Không chạy lại full suite vì phát hành đúng artifact đã kiểm chứng; chỉ thêm deployment override và tài liệu. Các ghi chú public 8080 chưa đổi ở mục lịch sử bên dưới đã được thay thế bởi lượt phát hành dùng thử này; không coi đây là promote chất lượng model.

## YouTube giới thiệu, LCP và candidate không B2 — 16/10/2026

`npm run check` qua: boundaries **94 modules**, TypeScript, **190 tests / 54 files**, checksum 13 face + 25 conversation assets và production build; format-check qua. Sau đó phát hiện đường so sánh lab còn liệt kê B2: lọc candidate chỉ còn B0/WASM và B0/WebGPU, chạy lại **6 tests model-comparison**, lint/typecheck/format đều qua. Bản Docker cuối tiếp tục chạy checksum/typecheck/build. Kiểm thử mới gồm LCP/reset/stale/giới hạn trạng thái, sửa phủ định/số, final được sửa toàn câu và partial không vào lịch sử, lifecycle iframe/offline, pruning candidate nhưng không đổi baseline, batch video chọn B0 thay B2.

Staging **http://127.0.0.1:8087/** hiện là `demo-20261016-intro-lcp-v12`, container `signemo-intro-lcp-20261016-v12`, image `signemo:intro-lcp-20261016-v12`, digest `sha256:174791bc6c933015990ca373b25408af213398886228381407c223f48bc99b3c`. Healthy, healthz 200, Nginx hợp lệ. V10/v11 giữ lại và dừng để rollback; public `ou-khinghip-web-1`/8080 vẫn `signemo:local`. Research mount read-only chỉ mở Gipformer, B0, runtime GPU và fixture public cần thiết, không mount toàn bộ thư mục research chứa B2 hoặc dữ liệu khác.

Runtime image không có `/models/enet_b2_8.onnx`, HTTP trả **404**; manifest phục vụ thật có 12 core assets, `bundleProfile: pc-candidate-b0-only-v1`, 0 entry B2. Danh sách chọn thử kiểm đủ SHA-256 **28 asset / 329.823.725 byte ≈314,54 MiB**: giảm **30.779.724 byte ≈29,35 MiB** so v10. +19,88 MiB trước đó là mức tăng ròng cả profile, không phải kích thước B2. Không gọi đây là RAM hoặc dung lượng toàn bộ app/tone. Không đổi checkpoint mặc định của baseline chỉ từ phép đo này.

Browser Chrome/PC v12: trước khi bấm xem có **0 request YouTube**; sau bấm iframe đúng clip `g6lhRElRiWs`, HTTP 200; rời Giới thiệu thì iframe bị gỡ. Smoke phát thật có `readyState: 4`, thời gian phát tăng >0,2 giây, videoWidth 640, không lỗi media/player. Đây là kiểm tra bắt đầu phát, không xác nhận đã xem hết clip hay track phụ đề Việt. Không dùng clip YouTube làm đầu vào AI. Poster local và hướng dẫn offline giữ đường vào Hội thoại.

Đã xem ảnh Giới thiệu desktop **1366×768** và mobile **390×844**. Lượt v11 thấy khung video tràn vùng cuộn con dù document không báo overflow: v12 thêm width hữu hạn và media position absolute; xác nhận cuối không còn cuộn ngang ở document/main/card/stage. 0 pageerror, AI lõi ready, **0 request B2 và cache lõi không chứa B2**. Báo cáo `output/research-evaluation/intro-v12-ui.json`, `intro-v12-playback.json`; ảnh `output/playwright/intro-v12-{desktop,mobile}.png`. Native ORT có warning phân node CPU như trước, không phải pageerror.

V12 offline cache ấm: reload, chuẩn bị AI, B0/WebGPU infer ảnh xám `no-face` và Gipformer infer PCM im lặng thành công, 0 pageerror; worker QA terminate, bật mạng lại và đóng trang. Báo cáo `intro-v12-offline.json`. Không xác nhận cài mới khi offline hoặc micro/camera thật.

V11 có smoke chức năng **60.056 ms**, 84 frame classifier, 14 partial/final/text/fusion, một capture, tối đa 4 worker, về 0 worker/track; 0 page/worker error, không non-GET, request ngoài origin hoặc checkpoint Whisper không dùng. File `pipeline-v11-functional-60s.json` ghi rõ **Docker build v12 chạy trùng một phần thời gian**, nên không dùng timing để so hiệu năng hoặc nghiệm thu latency. V12 chỉ sửa CSS khung video so v11, không đổi pipeline; không tuyên bố đã chạy lại 30 phút.

LCP là khóa mềm UI, không thêm delay lần đầu hoặc inference; từ mâu thuẫn mở prefix lại, final vẫn sửa toàn câu. Chưa có phép đo người dùng cho độ giật chữ/hiểu nội dung hoặc WER/F1 mới; các cổng clock vật lý, quality, Android, RAM và pilot còn nguyên. Xem [thay đổi và ưu tiên thuật toán tiếp theo](INTRO_PARTIAL_BUNDLE_20261016.md).

## Bàn giao local v10 — 16/10/2026

Source cuối qua `npm run check`: lint/boundaries **93 modules**, TypeScript, **181 tests / 51 files**, checksum **13 face + 25 conversation assets** và production build. `npm run format:check` qua; hai bộ Python confidence/expression evaluation có **4 test qua**. Không dùng số lượng test để thay nghiệm thu chất lượng hoặc thiết bị thật.

Build `demo-20261015-pipeline-v10`, image `signemo:pipeline-upgrade-20261015-v10`, manifest digest `sha256:268033df44c232eeccc79a6c9537cfdbcaf82d00fdc8848b37bfbd3be0e9714c`, container `signemo-pipeline-upgrade-20261015-v10` tại **http://127.0.0.1:8087/**. Ngày 16/10 đã start lại sau khi Docker/container dừng; container healthy và `nginx -t` hợp lệ. Public `ou-khinghip-web-1`/8080 giữ image `signemo:local`, không rollout profile thử lên tunnel.

V10 bổ sung giữ quantum im lặng khi input AudioWorklet tạm rỗng để thời gian và VAD không đứng lại. Regression kiểm im lặng/kết nối lại, mapping timestamp và gap lớn đã qua. Tuy nhiên nguồn audio ảo vẫn có chênh lệch đồng hồ: probe origin từ sample counter so với cặp AudioContext/performance dịch khoảng **70,23 giây sau 5 phút**. Vì vậy **chưa kết luận đã sửa hết nguyên nhân drift**, không coi số delivery sau ánh xạ là phép đo latency micro vật lý hoặc lấy đó xác nhận cổng realtime.

Lượt smoke v10 chạy **300.035 ms**, 851 frame qua classifier, 74 partial/final/text/fusion; một lần mở nguồn thu, tối đa 4 worker, về 0 worker/track khi dừng. Không lỗi page/worker, không request ngoài origin, non-GET hoặc checkpoint Whisper không dùng. Báo cáo `output/research-evaluation/pipeline-v10-clock-5min.json` giữ `productionAcceptancePassed: false`.

| Số đo trong fixture ảo v10                                  |        p95 |
| ----------------------------------------------------------- | ---------: |
| Capture → nhận kết quả frame (chưa gồm toàn bộ dwell/paint) |   160,8 ms |
| Xử lý classifier                                            |    78,2 ms |
| Xử lý ASR final                                             |   380,6 ms |
| Xử lý text                                                  |   170,5 ms |
| Partial delivery theo timestamp đã ánh xạ                   | 1.408,3 ms |
| Final-buffer delivery theo timestamp đã ánh xạ              |   334,6 ms |
| Fusion delivery theo timestamp đã ánh xạ                    |   458,0 ms |

RTF hiệu dụng **0,215**, tính cả partial. Các dòng delivery chỉ là chẩn đoán fixture; final có trailing silence trong mốc VAD, không đo độc lập âm vị cuối. Không có nhãn cảm xúc, ảnh và giọng khác người; không đánh giá WER/F1 hoặc độ chính xác fusion từ lượt tạo tải này. Lượt 30 phút ở v7 bên dưới là bằng chứng tải dài của v7; **chưa chạy lại 30 phút trên v10**.

Offline cache ấm v10: trang reload offline vẫn chuẩn bị được AI; B0/WebGPU trả `no-face` trên ảnh xám, Gipformer nhận PCM im lặng, đúng modelVersion và 0 pageerror. Báo cáo `pipeline-offline.json`; không chứng minh cài mới khi offline hoặc chất lượng ASR. UI đã chụp/xem Giới thiệu và Hội thoại ở **1366×768, 390×844**, không tràn ngang, AI lõi sẵn sàng, selector đúng `gipformer-research`, Tab từ consent đến nút bắt đầu; không mở thiết bị. Báo cáo `pipeline-ui-handoff.json`, ảnh `output/playwright/pipeline-{home,conversation}-{desktop,mobile}.png`. ORT có warning node shape được giao CPU, không phải lỗi JavaScript và không có nghĩa toàn graph chạy GPU thuần.

Còn thiếu: phép đo micro/camera thật và end-to-end có mốc tham chiếu, lượt 30 phút sau sửa clock, baseline RAM cùng phương pháp, validation/test tách người cho speech và Angry/Sad/Fear/Disgust, Android/motor/nhiệt/pin, tone tiếng Việt và pilot. Giữ profile này là bản thử PC; không tự promote hoặc tuyên bố nâng accuracy.

## Nâng cấp hệ thống và chữ tạm — 15/10/2026

V7 qua `npm run check`: boundaries 92 modules, TypeScript, **176 tests / 49 files**, checksum **13 face + 25 conversation assets**, production build; `npm run format:check` qua. Hai bộ Python confidence/expression evaluation có **4 test qua**. Kiểm tra skill pitch bằng `python -X utf8 .../quick_validate.py` qua; phải bật UTF-8 vì Python Windows mặc định cp1252 không đọc được chữ Việt. Lần chạy Vitest đầu trong sandbox bị `spawn EPERM`; chạy lại với quyền tiến trình con phù hợp đã qua, không sửa test để né lỗi.

Staging build thử `demo-20261015-pipeline-v7`, image `signemo:pipeline-upgrade-20261015-v7`, digest `sha256:d1cabb468d5134b5f90306ea0d21707baf4e7c87dbc781f7884abd93fc6fc3fd`, localhost **8087**, research mount read-only. Public 8080 không đổi. Profile này nối Gipformer/B0-WebGPU/PhoBERT; tone không tham gia benchmark. Chrome WebGPU trả vendor `intel`, architecture `gen-12lp`; không chỉ suy GPU từ tên CPU. Browser không cross-origin isolated, WASM một luồng. ORT vẫn cảnh báo một số node được giao CPU; không mô tả toàn graph là GPU thuần.

Đã sửa prewarm classifier trước READY, modelVersion của worker được chuẩn bị trước; cache/checksum B0 và GPU runtime; candidate bỏ tải checkpoint/runtime Whisper không dùng. Đã sửa text readiness muộn để nối một lần vào phiên đang chạy, không mở thêm mic. Regression bao gồm queue/lifecycle, chống nhịp trùng, hủy, quyền và 7 nhãn; chưa phải thử motor hoặc thiết bị thật.

`assets:verify:candidate` kiểm **29 asset, 360.603.449 byte / 343,90 MiB**, trong budget +100 MiB so với baseline ngày 14/10. So manifest hiện tại 339.753.857 byte / 324,01 MiB, tăng **19,88 MiB**. Bao gồm B2 còn trong cache lõi và runtime mới; không tính RAM/app bundle/tone tùy chọn. Không tự chọn profile này làm mặc định sản phẩm.

### Lượt đối chứng trước chỉnh partial

Hai smoke 60 giây đầu có mặt/ASR nhưng text chưa tham gia; harness đánh dấu `incomplete`, không coi là qua toàn pipeline. Đã tìm ra cách bấm bắt đầu trước khi text sẵn sàng khiến cả phiên không nối lại nhánh đó; thêm kiểm thử và sửa hook. Harness giờ chờ/bật text rõ ràng, đếm inference thật, không dùng hình tròn và oscillator để giả tải.

Lượt v6 sau đó chạy **666.539 ms (11,1 phút)**, 2.136 classifier, 166 ASR final, 166 text; operator chủ động dừng để thay chính sách partial. Báo cáo `pipeline-v6-before-partial-change.json` ghi `incomplete` và lý do dừng; **không phải nghiệm thu 30 phút**. Fixture public-domain NASA + đoạn FLEURS 2 giây/2 giây im lặng, không cùng người, không có nhãn biểu cảm. Số đo: partial p95 **2.009,7 ms**, final-buffer delivery **1.103,2 ms**, frame delivery **150,6 ms**, effective RTF **0,284**. Không có lỗi worker/page; teardown về 0 worker/track trong lượt này.

V7 thay riêng snapshot partial của hội thoại Gipformer: cửa sổ tối thiểu 800 ms, ít nhất 512 ms frame tiếng nói, ngưng partial mới ở đuôi im lặng ≥128 ms. Chu kỳ 800 ms/latest-only/final ưu tiên giữ nguyên. Unit test xác nhận PCM/chốt final không đổi; baseline thường không bật policy này. Đây là giảm chờ VAD/giải mã lại, không phải thay trọng số hoặc cải thiện WER được xác nhận.

### Lượt dài v7 đã hoàn tất và phát hiện lệch đồng hồ

V7 hoàn tất **1.800.032 ms**, **6.357 frame qua classifier**, **448 partial**, **448 final**, **448 text/fusion**, chỉ **1 lần mở nguồn thu**, đỉnh 4 worker. Không lỗi worker/page; không request ngoài origin, không POST/non-GET, **không tải checkpoint Whisper không dùng**. Trước cleanup harness, ứng dụng đã về 0 worker và 0 track; harness sau đó đóng AudioContext fixture. File: `output/research-evaluation/pipeline-v7-30min.json`.

| Giai đoạn                    |      p50 |      p95 |
| ---------------------------- | -------: | -------: |
| Capture → nhận kết quả frame | 103,6 ms | 137,2 ms |
| Detection                    |  36,4 ms |  61,2 ms |
| Crop                         |   2,4 ms |   3,5 ms |
| Classifier                   |  58,0 ms |  79,2 ms |
| Xử lý ASR partial            |  86,9 ms | 131,4 ms |
| Xử lý ASR final              | 194,8 ms | 258,6 ms |
| Xử lý text                   |  76,5 ms | 112,7 ms |

RTF hiệu dụng cuối **0,154**, đã tính partial. FPS mặt thực tế khoảng **3,53 Hz** trên nguồn canvas 10 Hz, không gọi là đạt 5 Hz webcam thật. Không có nhãn biểu cảm: tỷ lệ đồng thuận 0 của câu trung tính đọc từ FLEURS và ảnh khác người **không phải accuracy hoặc lỗi fusion được chứng minh**.

Ở đầu v7, partial p95 khoảng 975 ms; sau 30 phút thống kê theo timestamp lại thành **2.508,3 ms**, final-buffer delivery **1.798,7 ms**, fusion **1.860,6 ms**, dù thời gian xử lý giảm và queue không tồn đọng tại các mốc ASR trả kết quả. Source neo audio sample offset vào performance.now() một lần; hai đồng hồ có thể lệch theo thời gian. Vì vậy **không dùng các delivery metric v7 để khẳng định đạt cổng latency** hoặc quy hết cho model. Parser buildId của harness v7 cũng ghép nhầm chữ SignEmo vào đuôi; build thực là `demo-20261015-pipeline-v7`, đã sửa parser cho các lượt sau.

Đã sửa: AudioWorklet gửi mốc currentFrame/contextEnd; MicrophoneCapture ánh xạ qua cặp getOutputTimestamp() sang đồng hồ trang, fallback currentTime khi API chưa có dữ liệu. Session cập nhật origin thay vì neo một lần; gap audio lớn >500 ms dừng phiên thay vì nối lời nói qua khoảng mất dữ liệu. Test mô phỏng drift 30 phút/delivery trễ, timestamp không hợp lệ và dừng an toàn khi gap đều qua. Tham chiếu [Web Audio timestamp](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp). Đây là ánh xạ đồng hồ, chưa phải hiệu chỉnh input/output latency phần cứng.

### Bộ nhớ và offline

Native memory sampler lấy 20 mẫu trong khoảng phút 6–26: private committed bytes của Chrome tự động khoảng **2,45–2,53 GiB**, sau teardown mẫu còn khoảng **1,01 GiB**. Working set có thể bị OS trim, không bằng private bytes hoặc RAM vật lý; số này có thể gồm context/tài nguyên Chrome dùng chung, không gồm VRAM đầy đủ. JS heap sau chuẩn bị khoảng 9–12 MB không đại diện toàn pipeline. Chưa có baseline cùng phương pháp để nghiệm thu mức tăng RAM ≤10%; không chứng minh không rò bộ nhớ từ một lượt.

Offline cache ấm v7: trang sạch reload khi offline vẫn chuẩn bị AI; worker B0/WebGPU chạy ảnh xám trả no-face đúng modelVersion, Gipformer nhận 1 giây PCM im lặng và trả kết quả; không pageerror. Không mở thiết bị thật, không đánh giá WER từ im lặng. Network đã được bật lại, các worker QA đều terminate và trang QA đóng. Báo cáo `pipeline-offline.json`.

Source sau sửa clock qua **180 tests / 50 files**, lint/boundaries 93 modules, typecheck, checksum/build và format-check. Bản clock được đo lại riêng; chưa gọi lượt v7 là nghiệm thu clock mới 30 phút. Chi tiết công cụ và giới hạn tại [SYSTEM_UPGRADE_20261015.md](SYSTEM_UPGRADE_20261015.md).

## So sánh model và phụ đề chữ tối — 15/10/2026

Source cuối qua `npm run check`: lint/boundaries 87 modules, TypeScript, **168 tests / 48 files**, checksum 13 face + 25 conversation assets, production build. `npm run format:check` qua. Test mới kiểm cùng PCM/timestamp, chạy tuần tự/không fallback GPU ngầm, hủy/stale results/chuyển nền, stage không chạy không được tính 0 ms và caption/badge không gán nhầm đoạn. Bốn tệp giao diện có format lệch được chuẩn hóa; không đổi nội dung/hành vi từ việc format.

Docker riêng `signemo-model-comparison-20261015`, image `signemo:model-comparison-20261015`, build `demo-20261015-model-comparison-v4`, cổng **8086**, mount research read-only. Model mặc định vẫn PhoWhisper-tiny q8/B2-WASM/PhoBERT; Emotion2vec GPU tùy chọn giữ nguyên. Nginx syntax/healthz 200/container healthy. Đã phát hiện và sửa Vite không bundle `new Worker` có URL điều kiện: dùng hai entry URL tường minh; GPU worker có CSP riêng, không nới toàn ứng dụng. Không thay container/link 8080.

UI production v3: chạy so sánh ba cấu hình qua nút thật trên video WebM xám tổng hợp 1,1 giây, 6 mốc/cấu hình; tối đa **1 worker**, về 0 sau hoàn tất và sau hủy lượt mới. Không có nhãn nên ba báo cáo quality = null, stage classifier có 0 mẫu/null p95; JSON xuất chỉ settings/metadata/số đo tổng hợp, không media/frame. Kiểm hủy ASR qua UI và regression hide/unmount/stale. Screenshot desktop 1366×768/mobile 390×844 không tràn ngang; fixture CSS caption thêm 320×568, cả 7 màu vẫn có foreground `rgb(36,50,44)`. Fixture minh họa chỉ kiểm CSS, hành vi component dùng React tests, không phải emotion output.

V4 chỉ ẩn bảng/chỉ số F1 cũ khi chưa có nhãn; lint/typecheck/format-check và Docker checksum/build qua sau sửa này. Chrome xác nhận lại 1366/390 px: không tràn ngang, không còn “Macro-F1 0.000” khi chưa có dữ liệu. Đã xem ảnh `output/playwright/comparison-{speech,face,captions,final}-*.png`. Audit kiểm 63 sự kiện của profile thử: có mã comparison, không có text/reference/filename/url/scores/landmarks trong details hoặc nội dung fixture. Bản cuối image `sha256:45e5706bdb3f71e42a2710c766ef7bafd73570939f4c70104e3a9b68f030b0a8`.

Offline v4: bật offline trong browser sau cache ấm, fetch app/khởi tạo worker mặt thật và infer ảnh xám được `no-face`, model `emotiefflib-enet-b2-8-demo-v1`. Lượt đầu fixture QA chưa tạo canvas context nên timeout sau khi worker đã ready; sửa fixture, chạy lại thành công. Video QA ban đầu thiếu Duration/selector trỏ nhầm player trống cũng đã sửa ở công cụ QA, không sửa codec/model để làm test qua. Đã bật mạng lại và reload để bỏ mọi wrapper/fixture trước bàn giao. Đây không phải fresh-install offline, ASR/tone cold-offline hoặc kiểm thiết bị vật lý.

### Số đo worker thực (v2; cùng worker/model bytes trong v3)

Chrome headed 155/Windows, i5-1130G7, 4 nhân/8 luồng; không cross-origin isolated, WASM 1 luồng. Phép đo chạy sau build, từng worker tuần tự. Chưa đo điện/nhiệt/RAM đỉnh hoặc toàn pipeline 30 phút. Báo cáo cục bộ `output/research-evaluation/model-comparison-browser.json` không chứa transcript/media.

**ASR:** 5 PCM tiếng Việt public google/FLEURS (CC-BY-4.0), tổng 52,62 giây/150 từ theo chuẩn hóa của repo. So cùng PCM 16 kHz, PhoWhisper không fallback rồi Gipformer; tái tạo worker/prepare cho mỗi clip. WER token khoảng trắng, NFC/lowercase/bỏ dấu câu; CER bỏ khoảng trắng nhưng giữ dấu tiếng Việt. Số tổng cộng, không lấy trung bình WER từng clip:

| Profile            |            WER |    CER | RTF tổng giải mã / audio | Giải mã file p95 (5 file) |
| ------------------ | -------------: | -----: | -----------------------: | ------------------------: |
| PhoWhisper-tiny q8 | 16,0% (24/150) | 10,04% |                    0,987 |               17.826,5 ms |
| Gipformer 1.5 INT8 |   6,0% (9/150) |  3,21% |                    0,323 |                4.075,1 ms |

Thời gian chuẩn bị từng clip: PhoWhisper ~2,7–3,5 giây; Gipformer ~9,3–12,4 giây gồm kiểm tra/cache/runtime. Đây là file dài 8,52–14,94 giây, chưa gồm VAD/partial hoặc time-to-final sau ngừng nói. Tốc độ có biến động so lượt cũ; không dùng một lượt nhỏ để chọn mặc định. Không có validation/test tách người hoặc hội thoại nhiễu được xác nhận; 5 clip cũ chỉ là smoke, không đạt điều kiện promote dù WER mẫu tốt hơn.

**Mặt:** tensor RGB tổng hợp bất đối xứng đã đối chiếu Python, mỗi cấu hình 1 cold + 30 warm, chỉ đo classifier:

| Profile   |       Cold | Warm p50 | Warm p95 | Max sai khác logits với Python |
| --------- | ---------: | -------: | -------: | -----------------------------: |
| B0/WASM   |   282,2 ms | 156,4 ms | 244,7 ms |                        1,43e-6 |
| B0/WebGPU | 6.513,5 ms |  38,5 ms |  41,7 ms |                        1,07e-6 |
| B2/WebGPU | 5.624,9 ms |  78,8 ms |  89,3 ms |                        1,07e-6 |

Prepare session riêng: ~0,99/3,54/3,65 giây, chưa gồm cold inference. GPU có hai warning node assignment mỗi phiên: một số phép toán CPU, không gọi là thuần GPU. Blank frame qua worker đầy đủ của product/B0-GPU/B2-GPU trả `no-face`, không đo crop/classifier từ mặt thật. Không có nhãn biểu cảm nên **chưa có precision/recall Sad/Angry/Fear/Disgust hoặc confusion thực**. Tensor parity/latency không thay chất lượng hoặc cổng nhãn mặt p95 700 ms. Không thêm flash nguy hiểm hoặc vote F0/RMS.

Worker smoke không có JavaScript pageerror hoặc request khác GET. Console có INFO MediaPipe và W/ORT ghi qua stderr (Playwright xếp thành error), không phải exception JavaScript; không ghi thành “console không lỗi”. Chưa nghiệm thu webcam/mic/motor/Android hoặc riêng tư trên dữ liệu người thật. Xem [MODEL_COMPARISON.md](MODEL_COMPARISON.md) để chạy công cụ và đọc phạm vi xuất/audit.

## Tone hội thoại local — 14/10/2026

Tone FP32/WebGPU đã nối tùy chọn vào hội thoại/fusion; mặc định vẫn face/text. Docker thử localhost:8085 build `demo-20261014-live-tone-v5`; Nginx syntax qua. Chuẩn bị thật và capture PCM public qua stream giả lập thành công: 1 xin quyền kết hợp, 1 tone request/result ~1273,6 ms, phụ đề xuất hiện, tất cả track stopped. Cache quota đã tái hiện và có fallback RAM; two node-assignment warnings, có CPU fallback. Không nghiệm thu chất lượng emotion tiếng Việt/mic thật/Android/30 phút hoặc cold restart offline tone. Không thay container/link 8080. Chi tiết tại [LIVE_TONE.md](LIVE_TONE.md).

Source cuối: `npm run check` qua toàn bộ lint/boundaries 81 modules, TypeScript, **156 tests / 44 files**, checksum và production build; `npm run format:check` qua. Docker v5 healthy. Đã tải lại trang sau fixture để bỏ override thiết bị giả lập trước khi bàn giao.

## Tone/WebGPU local — 14/10/2026

150 tests/41 files và check/lint/TypeScript/checksum/build/format-check qua. Image `signemo:tone-lab-20261014`, build `demo-20261014-tone-gpu-lab-v1`, localhost:8084 healthy/healthz 200/nginx syntax qua. INT8 cùng PCM public không qua parity đầy đủ; FP32/WebGPU sai khác score tối đa ~3,72e-5, qua mốc kỹ thuật trên một clip. Năm lượt warm 3 giây audio ~1,06–1,10 giây, cold còn ~2,4–3,3 giây cho cửa sổ ngắn. Hai warning node assignment, có CPU fallback. Không kiểm chứng tone accuracy tiếng Việt, toàn pipeline/Android/micro vật lý; tone chưa nối vào fusion hoặc bản thường. Xem [TONE_RESEARCH.md](TONE_RESEARCH.md). Container/link 8080 chưa thay.

## B2/ngưỡng nhạy — 14/10/2026

148 tests/40 files, lint, TypeScript, checksum, build và format-check qua. B2 demo 260×260 khởi tạo được trong Chrome; synthetic tensor parity max 5,96e-6. Classifier p95 hai lượt 925/808 ms, chưa đạt cổng phản hồi mặt; không rollout vào link 8080. Giới thiệu prewarm hoàn tất, 0 lỗi console/2 warning MediaPipe; blank frame trả no-face, không xác nhận camera/micro vật lý. Source và Docker staging 8083 dùng ngưỡng mặt/fusion 0,55, margin 0,10; tone chưa có checkpoint thật được chọn nên chưa bật. Chi tiết tại [SENSITIVE_DEMO.md](SENSITIVE_DEMO.md).

## Bản 7 nhãn đã triển khai — 14/10/2026, build cuối `demo-20261014-seven-v5`

V5 chỉ sửa metadata audit avatar: khi online nhưng chưa biết nguyên nhân, ghi `unknown`, không tự kết luận trình duyệt không hỗ trợ. Các bài kiểm thử chức năng/offline bên dưới chạy ở v4; targeted avatar 2/2 và format-check qua sau sửa metadata, Docker v5 typecheck/build/checksum qua. Model/pipeline/giao diện giữ như v4.

- `npm run check` qua: lint/boundaries, TypeScript, **146 tests / 40 files**, checksum 13 asset mặt + 25 asset hội thoại và production build. `npm run format:check` qua. Python research regression 5/5 qua; không dùng test huấn luyện tổng hợp làm bằng chứng pretrained accuracy.
- Docker `signemo:upgrade-20261014` được build, thử riêng tại 8082 rồi tag thành `signemo:local` và tạo lại `ou-khinghip-web-1` tại 8080. Container healthy, `/healthz` HTTP 200. Image cũ giữ ở `signemo:rollback-20261014`. Quick Tunnel mới HTTP/2 đã chạy, `/healthz` HTTPS 200; Chrome thấy đúng build v4 và Giới thiệu mặc định. Hostname được gửi riêng trong chat, cần PC/Docker/tunnel tiếp tục chạy.
- Chrome/Windows, CPU i5-1130G7 4 nhân/8 luồng, RAM khoảng 16 GB. Đây là cấu hình PC; chưa có Android thật. Classifier tensor parity: B0 p50/p95 148/205 ms, B2 313/372 ms, sai khác Python–browser lần lượt 1,43e-6/5,96e-6; không là accuracy hoặc latency toàn nhánh mặt. Gipformer có RTF cửa sổ partial/final ~0,364 so PhoWhisper ~4,656 trên một clip; 5 PCM public smoke khớp Python 5/5, cache repair/offline worker đạt. Chi tiết và phạm vi ở SEVEN_LABEL_UPGRADE.md.
- 10 vòng bắt đầu/kết thúc, model worker thật với stream canvas/tiếng im lặng giả: 10 yêu cầu camera+mic, 10 stream đã dừng, tối đa 4 worker, 0 navigation/reload tự phát. Không xác nhận webcam/mic/loa vật lý hoặc chất lượng ASR bằng bài thử này.
- V4: chuẩn bị lần đầu trên Giới thiệu, mở lại offline, vào Hội thoại/tích đồng ý (chưa bấm mở thiết bị), ASR/VAD/mặt khởi tạo được từ cache, Start enabled; 0 request ghi mạng. Lượt offline đầu ở v3 từng timeout và lỗi tải manifest; sau warm online thì chạy được. V4 bổ sung lưu metadata trước SW control, freeze manifest mỗi boot và không refetch giữa các gói; regression mới kiểm tra hành vi này.
- Bật avatar lần đầu offline khi chunk chưa có: fallback riêng xuất hiện; panel phụ đề và readiness vẫn còn. Hai console error từ tải chunk/caught React error là lỗi được chủ động tạo trong bài thử, không phải lỗi inference. Unknown dùng tư thế neutral nhưng chữ là “Chưa xác định”, không ghi thành prediction neutral. GLB do dự án tạo 110.744 byte; Three.js/chunk/asset chỉ nạp khi bật, không animation liên tục.
- Giới thiệu/Hội thoại đã kiểm bố cục 320×568, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080 và **CSS zoom 200%**: không cuộn ngang. CSS zoom là mô phỏng layout, không thay cho nghiệm thu zoom/browser Android thật. Screenshot ở `output/playwright/seven-labels-*.png`.
- Nguồn/cache/network smoke không có request media/transcript gửi ra ngoài; bộ audit có allowlist và test không lưu exception/nội dung. Phiên kiểm thử giả chỉ có im lặng/canvas tổng hợp. Kho mã hóa round-trip được Fear/Disgust và nhãn legacy. API feedback không đổi.
- Chưa chạy toàn pipeline 30 phút, thiết bị Android/motor thật, validation biểu cảm/Speech tách người hoặc MERaLiON inference/ONNX. Chưa tạo MP4 AI; đã có storyboard, SRT, poster và player fallback. **Không promote Gipformer/B2/tone hoặc công bố tăng accuracy** dựa trên các smoke tests này. Bản thường tiếp tục PhoWhisper/B0 với 7 nhãn và cải tiến pipeline/UI.

## Phụ đề làm nền và R&D mặt–text–tone — 13/10/2026

- `npm run check`: **132 tests/34 files**, TypeScript, lint/boundaries 64 modules, checksum 13 face + 25 conversation assets và production build qua. `npm run lint` và `npm run format:check` qua. Hai Python tests synthetic kiểm consent/expiry/speaker split, train CPU, xuất ONNX, parity và chặn đánh giá held-out lần hai đã qua. Không thay feedback API.
- Docker production `ou-khinghip-web-1` đã rebuild/recreate, healthy, `/healthz` 200 tại `http://localhost:8080`. Build UI `speech-fusion-rnd-20261013`, image `sha256:b23899902dbda4406ced3a92907e5455ef6cf48c2a8b1993dceb5741afdbf421`. Container R&D riêng `signemo-research-web-1` tại 8081 dùng cùng image, chỉ thêm mount research; production không chứa ứng viên Gipformer/tone. Không thay tunnel đang chia sẻ.
- Đã tái hiện lỗi Nginx trả `/runtime/speech/*.mjs` là `application/octet-stream`: ASR không khởi tạo từ trang browser sạch, dù khởi tạo được khi PWA có cache header đúng. Sửa MIME `.mjs/.js/.wasm` tại location runtime; Chrome profile mới đã khởi tạo PhoWhisper và Gipformer. Không kết luận đây là nguyên nhân của mọi lỗi/reload trước đây.
- Chrome headless 155/Windows: responsive hội thoại, luyện tập, cài đặt không tràn ngang tại 320×568, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080 và 683×384; kích thước cuối chỉ là CSS tương đương zoom, không phải thao tác zoom thật. Privacy card cuộn đủ; Escape trả focus. Đã xem ảnh desktop/mobile trong `output/playwright`.
- Bốn pattern dùng Web Audio context `running`, tone duration `[240]`, `[160,160]`, `[70,70,70]`, `[80]` ms; regression unit giữ khoảng nghỉ. Phiên production với canvas xám + micro im lặng tổng hợp mở đủ hai track và dừng track khi kết thúc; worker AI thật. Không có pageerror, POST hoặc request ngoài origin. Native MediaPipe ghi một dòng INFO qua stderr, không phải lỗi JavaScript. Không xác nhận loa/motor/camera/micro vật lý bằng các fixture này.
- Kiểm tra riêng **10 vòng bắt đầu/kết thúc** trên build production: 10 yêu cầu media kết hợp, 10 stream đều kết thúc, tối đa 4 worker mới được instrument cùng lúc và **0 navigation/reload ngoài ý muốn**. Worker AI thật, media tổng hợp im lặng; không dùng kết quả này để tuyên bố đã tái hiện/khắc phục mọi lỗi thiết bị thật.

### Gipformer: smoke và parity, chưa chọn mặc định

Gipformer được ghim HF revision `dd9227dcd8705c13f33bdbe59728d546ab94480f`, Sherpa-ONNX 1.13.8 và checksum từng asset. Gói **84,43 MiB gồm WASM**. Wrapper npm Node được chuyển ESM/POSIX path/MEMFS cho browser; WASM và graph model giữ nguyên. Production tiếp tục PhoWhisper-tiny q8, fallback Whisper tiny, mặt EmotiEffLib và text PhoBERT.

Cùng PCM 16 kHz của **5 clip đọc tiếng Việt public FLEURS, CC-BY-4.0**, worker riêng trên Chrome profile sạch sau sửa MIME:

| Profile            | WER |    CER | RTF decode clip đầy đủ |  Chuẩn bị |
| ------------------ | --: | -----: | ---------------------: | --------: |
| PhoWhisper tiny q8 | 16% | 10,04% |                  0,441 | 2,64 giây |
| Gipformer 1.5 INT8 |  6% |  3,21% |                  0,141 | 6,35 giây |

Gipformer khớp nguyên văn Python 5/5 clip. Không có request ngoài origin hoặc ghi lên server. Báo cáo public có reference/output tại `output/research-evaluation/asr-browser-smoke.json`; summary chỉ chứa số liệu tại `asr-summary.json`. Đây là dữ liệu public chủ động benchmark, không phải audit hoặc transcript hội thoại người dùng.

Cửa sổ PCM nạp sẵn 800/1600/3000 ms: Gipformer decode khoảng 106/212/405 ms, RTF hiệu dụng cả ba lần 0,241. PhoWhisper khoảng 3057/2930/3102 ms, RTF hiệu dụng 3,030: **không đạt mục tiêu chữ tạm trong phép thử này**. Code nay ngưng giải mã partial thêm khi RTF >0,8 để ưu tiên final; không thể ngắt inference đang chạy. Số đo cửa sổ không phải latency capture/VAD/UI hoặc benchmark toàn pipeline. Lượt cuối được chạy sau khi build/tests và browser QA toàn app đã dừng. Phép thử trước khi tách PWA có RTF khác, không gộp hai lần thành một benchmark.

Profile research được chuẩn bị và kiểm checksum rồi cache riêng. Regression Chrome session sạch đã sửa một `tokens.txt` cache hỏng, khởi tạo worker mới khi offline và cho cùng output. Không xóa settings/feedback/vault. QA chỉ thao tác cache riêng trên origin 8081.

### Tone và fusion

Feature extractor browser/offline chung 39 log-mel/F0/prosody features; không mở micro riêng. Python xuất MLP FP32 nhỏ, standardization/temperature trong graph; checksum và hợp đồng đầu vào được kiểm tra. Chỉ synthetic mechanics: 5 vector Python/ONNX/browser có sai số softmax tối đa `1,82e-8`; audio noise không đo được bị từ chối. **Chưa huấn luyện hoặc xác thực tone tiếng Việt**; không đưa synthetic model vào sản phẩm.

Ba nguồn, unsupported labels, conflict, revision/late cue, context hard-cut và effective RTF có regression. Hội thoại mặt chỉ hiển thị; fusion là nguồn nhịp duy nhất. CLI hiệu chỉnh các cặp và ba nguồn trên cùng validation grid, so ablation, chặn speaker leakage, consent hết hạn và ghi đè held-out report. Luật đồng thuận hiện tại làm trọng số đổi score, không đổi label; chưa thể gọi 20/40/40 tối ưu. Không tự promote.

### Cổng chưa hoàn thành

Chưa có validation/test hội thoại tiếng Việt đủ nhãn và tách người; chưa benchmark toàn pipeline 30 phút/RAM đỉnh, chưa xác nhận mục tiêu latency p95 hoặc chất lượng Sad/Angry/tone/fusion. Chưa nghiệm thu camera/micro/loa PC thật trong lượt này, Android/iPhone hoặc pilot ba trải nghiệm. Smoke 5 clip không đủ để đổi ASR mặc định hoặc tuyên bố production realtime. Hướng dẫn và kế hoạch dữ liệu tại [RND_SPEECH_FUSION.md](RND_SPEECH_FUSION.md).

## Lịch sử kiểm chứng — 11/10/2026

## Đợt sửa phiên PC, âm báo và Docker

- `npm run check` qua lint/boundaries, TypeScript, **85 tests/21 files**, 13 face assets + 25 conversation assets kiểm checksum, production build. `npm run lint` cũng được chạy riêng và qua. Không thay API feedback hoặc model trọng số.
- Docker production đã rebuild/recreate, container `web` healthy tại `http://localhost:8080`; `/healthz` trả 200. Image ID: `sha256:f33758a91da4ac4ff808f48ad7b3a12f1f31b1f9b25f8340f8a6836dcf750234`. Build UI: `local-2026-10-11T10:57:34.773Z`. Manifest phục vụ đủ speech (10 asset), emotion (8), speech-base (9), tổng 25 asset riêng biệt do runtime dùng chung.
- Chrome QA đã đối chiếu script bundle đang chạy với HTML lấy trực tiếp từ server, cập nhật PWA từ bản cũ mà không xóa IndexedDB. Container trước đó dùng image cũ và hiển thị màn tải thủ công/năm ô chọn; bản cuối không còn màn tải từng gói.
- Không tràn ngang ở hội thoại/luyện tập/cài đặt tại 320×568, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080 và 683×384. Kích thước cuối tương đương không gian CSS của 1366×768 ở zoom 200%; chưa xác minh thao tác browser zoom thực. Escape đóng menu và trả focus; privacy card cuộn vào vùng nhìn thấy, không bị cắt cố định. Đã xem ảnh mobile/desktop ở `output/playwright/session-mobile.png` và `session-desktop.png`.
- Web Audio thực trên desktop: context `running`, bốn pattern có thời lượng tone 240ms; 160/160ms; 70/70/70ms; 80ms, cùng khoảng nghỉ được kiểm bằng unit tests. Không dùng giá trị `true` từ Vibration API desktop để kết luận có motor. Việc nghe được trên loa ở mức âm lượng thực tế vẫn cần người dùng xác nhận bằng nút “Thử âm”.
- Camera biểu cảm: điểm mặt tổng hợp đi qua filter/gate/UI và phát âm; kết thúc dừng track. Đây là kiểm tra tích hợp nhịp, không là benchmark AI. Worker mặt thật được khởi tạo trong kiểm thử hội thoại và offline.
- Hội thoại với camera canvas + micro im lặng tổng hợp: một yêu cầu chứa audio/video, hai track live, worker mặt/Whisper/VAD thật khởi động; kết thúc dừng tracks. Không có pageerror, POST hoặc request ngoài origin trong luồng responsive/nhịp/hội thoại tổng hợp.
- Một lượt dùng **getUserMedia thật của Chrome**, không mock media/worker: yêu cầu thiết bị thành công, phiên khởi động, không báo lỗi, tất cả track ended sau kết thúc. Trình duyệt QA được cấp quyền camera/micro; điều này không kiểm chứng hộp thoại quyền lần đầu, chất lượng tiếng nói tự nhiên hoặc mọi cấu hình OS. Không lưu media hoặc phụ đề của lượt này.
- Unit regressions bổ sung: quyền từ chối/thiếu/bận, hủy trước grant rồi nhận grant muộn, worker lỗi, teardown, reuse AudioContext từ click và hủy khi worklet tải. Audio bị chặn được báo visual/error, mute giữ mô phỏng, chuyển nền xóa timers. Cài đặt cũ thiếu soundFeedback có mặc định true, không tự đổi lựa chọn visual/off.
- Offline auto preparation: đã kiểm 14 cache entry mặt (gồm manifest) và 26 entry hội thoại; mở tab mới không mạng, worker mặt xử lý khung xám no-face, Whisper/VAD khởi tạo. Script QA dùng tab foreground và khung xám opaque; thử đầu với fixture/tab khác bị timeout và không được tính là đạt.
- `.gitignore` bổ sung secrets, keys, credentials, vault/transcript exports, cache; `.dockerignore` allowlist app và loại credentials/research. Workspace chưa có `.git`, nên chưa kiểm toán được file đã tracked. Không tạo repository hoặc push.

Các script QA hiện tại (chạy lần lượt sau khi mở session Playwright `signemo-fix` ở localhost:8080):

```powershell
npx --yes --package @playwright/cli playwright-cli -s=signemo-fix run-code --filename=scripts/browser-session-responsive-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo-fix run-code --filename=scripts/browser-camera-rhythm-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo-fix run-code --filename=scripts/browser-auto-offline-check.js
```

Kiểm tra thiết bị thật riêng: `scripts/browser-device-capture-check.js`. Logs kết quả ở `output/playwright/session-qa.log`, `camera-rhythm-qa.log`, `device-capture-qa.log`, `offline-qa.log`; đây là artifact QA bị ignore, không phải dữ liệu pilot. Các mục bên dưới là lịch sử kiểm chứng trước đợt này. Android motor/pin/nhiệt, pilot và Supabase hosted vẫn chưa kiểm chứng.

## Môi trường và phạm vi

Windows PC, Node 24.18.0, Chrome headless 155.0.0.0, production preview `http://127.0.0.1:4173` và Docker production `http://127.0.0.1:8080`. MediaPipe Tasks Vision 1.1.0, ONNX Runtime Web 1.30.0, FER+ INT8 opset 12. Phiên bản model `ferplus-int8-opset12-v1`; model/runtime có checksum trong manifest. Đây là kiểm chứng kỹ thuật cục bộ, chưa phải nghiệm thu Android hoặc kết quả pilot.

## Kết quả đã chạy

| Kiểm tra              | Kết quả và giới hạn                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`       | Qua typecheck, 67 test trong 16 file, checksum/giới hạn kích thước cho 13 face assets + 25 conversation assets và production build                                                         |
| Prediction gate       | Qua dwell, cooldown, không rung lặp, trung tính, mất mặt, thứ tự thời gian và lớp ngoài phạm vi                                                                                            |
| Migration/RLS         | Thực thi SQL trên PostgreSQL nhúng PGlite; kiểm tra anon/non-admin/admin, idempotency, mã xóa sai/đúng, cascade, tombstone, rate limit                                                     |
| Hàng đợi IndexedDB    | Qua giữ báo cáo khi lỗi, gửi lại cùng ID/token, offline, gộp sync đồng thời, đợi upload trước withdrawal, xử lý report đã rút trên server                                                  |
| Edge Functions        | `deno check` qua cả submit-report và withdraw-report với import map và lockfile; chưa chạy trên Supabase hosted                                                                            |
| Công cụ đánh giá AI   | 2 Python unittest qua; phát hiện rò rỉ participant giữa split và tính abstention vào recall/coverage                                                                                       |
| Repo skills           | Cả 9 SKILL.md qua `skill-creator/scripts/quick_validate.py`                                                                                                                                |
| Giao diện             | Consent gate, 4 nhịp, quiz, settings; viewport 390×844 và 1280×900; không tràn ngang ở 390px; đã xem ảnh desktop/mobile                                                                    |
| Bàn phím/mobile admin | Skip link nhận focus đầu tiên và đưa focus tới main; nút có outline khi Tab; quản trị mở được từ Cài đặt trên màn hình 390px                                                               |
| AI thật trong browser | Worker khởi tạo MediaPipe + FER+; khung trống → no-face; 5 khung mặt rõ → 8 điểm hữu hạn; 5 khung hai mặt → multiple-faces; 5 khung mặt nhỏ → poor-quality                                 |
| Camera lifecycle      | getUserMedia được mô phỏng bằng canvas stream: từ chối/thiếu/bận có thông báo; kết thúc, rút đồng ý và chuyển nền dừng tracks; phản hồi cục bộ và rút lại hoạt động                        |
| Offline               | Chuẩn bị 13 face assets + 25 conversation assets, kiểm tra SHA-256; PWA mở lại offline và worker xử lý khung trống                                                                         |
| CSP/model lỗi         | Worker chạy dưới CSP dự kiến của Pages, không cần `unsafe-eval` JavaScript; chặn model trả 404 khiến UI báo lỗi và dừng camera                                                             |
| Ranh giới dữ liệu     | Các luồng camera/luyện tập không phát POST; cache kiểm tra chỉ có GET ứng dụng/model/runtime; IndexedDB chỉ có DB SignEmo cho cài đặt/report. Fixture không được lưu vào production assets |

Ảnh mặt là fixture astronaut công khai được tải qua test runner, crop/ghép thành các tình huống kiểm thử. Không có người tham gia pilot hay ground truth đa dạng. Không dùng điểm softmax cao trên ảnh này để tuyên bố độ chính xác.

Lần chạy 5 khung mặt rõ ghi nhận thời gian xử lý **trong worker** lần lượt khoảng 355, 161, 140, 137 và 125 ms. Mẫu rất nhỏ, có warm-up, không bao gồm quyền camera, truyền bitmap, dwell hay motor; không suy ra FPS/độ trễ Android từ các số này. Chức năng Xuất số đo trong ứng dụng ghi thống kê pipeline của phiên để benchmark máy thật sau đó.

## Các lỗi đã tìm và sửa

- Loader MediaPipe dạng UMD không đưa ModuleFactory vào global của module worker. Thêm wrapper ESM, sửa phạm vi hàm debug phụ thuộc sloppy-script hoisting; giữ nguyên bản gốc và checksum cả hai.
- Service worker đã active nhưng trang đầu chưa được điều khiển: thêm clients.claim và chờ controller trước khi báo chuẩn bị offline hoàn tất.
- Kiểm tra cache chỉ theo sự tồn tại không đủ khi artifact đổi: kiểm SHA-256 lại, bỏ entry lỗi; hai model được ghim checksum ở script chuẩn bị.
- VIDEO tracking giữ một mặt thêm một khung sau chuyển cảnh hai mặt trong fixture. Chuyển sang IMAGE để phát hiện lại toàn khung mỗi lượt; regression mới từ chối cả 5/5 khung hai mặt. Điều này không bảo đảm detector thấy mọi mặt thực tế.
- Upload và withdraw cạnh tranh: serialize trên client, khóa giao dịch và tombstone ở database; report đã rút không được tạo lại.

MediaPipe ghi các dòng INFO/WARNING từ runtime native, có dòng INFO được phát qua console.error; chúng không tương đương lỗi khởi tạo. Build còn cảnh báo deprecation `inlineDynamicImports` từ công cụ PWA, build vẫn hoàn tất.

## Chưa kiểm chứng — điều kiện nghiệm thu tiếp theo

- Camera/rung trên Android thật, motor có rung hay bị chặn; đổi camera trước/sau, thiết bị không hỗ trợ.
- 20–30 phút liên tục, nóng máy/pin/bộ nhớ, thực tế 5 FPS và độ trễ 0,5–1 giây.
- Ánh sáng ngược/tối, che mặt, góc lệch và chuyển động tự nhiên; độ chính xác từng lớp, rung sai/phút, fairness/khả năng sử dụng với người dùng mục tiêu.
- Backend hosted: Auth hết phiên, Edge gateway, PostgREST, mạng gián đoạn giữa request/response và cấu hình quyền thực tế. Docker local đã chạy; kiểm thử Docker/PGlite/Deno không thay thế Supabase hosted smoke test.
- Screen reader, đánh giá tương phản toàn bộ trạng thái và thiết bị hỗ trợ thực tế.
- Pilot 5–10 người trưởng thành, đối tác, hữu ích so với tự quan sát, mức phân tâm, người chi trả.
- Deploy HTTPS công khai, video dự phòng người thật và diễn tập trước thi. Chưa có tài khoản Supabase/Cloudflare kết nối hoặc credentials trong repo.

## Chạy lại

```powershell
npm ci
npm run assets:prepare
npm run check
python -m unittest discover -s tests -p test_*.py
npx --yes deno check --config supabase/functions/deno.json supabase/functions/submit-report/index.ts supabase/functions/withdraw-report/index.ts
npm run preview
```

Trong terminal khác, dùng Playwright CLI với Chrome và một session QA riêng:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=signemo open http://127.0.0.1:4173/ --browser=chrome
npx --yes --package @playwright/cli playwright-cli -s=signemo run-code --filename=scripts/browser-ui-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo run-code --filename=scripts/browser-face-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo run-code --filename=scripts/browser-offline-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo run-code --filename=scripts/browser-camera-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo run-code --filename=scripts/browser-csp-check.js
npx --yes --package @playwright/cli playwright-cli -s=signemo run-code --filename=scripts/browser-keyboard-check.js
```

Mở/reload trang sạch trước UI test vì consent không lưu qua lần mở. Browser scripts chỉ dành cho QA; canvas stream không chứng minh camera phần cứng. Face test cần mạng để lấy fixture qua runner. Offline test ngắt mạng của context rồi khôi phục trong finally. Sau đổi build, đóng các tab cũ/cập nhật service worker trước chạy lại; tránh nhầm kết quả cache bản trước. Ảnh QA ở `output/playwright/`, logs/snapshot ở `.playwright-cli/`; cả hai loại khỏi Git.

## Đợt phòng kiểm thử / neutral–sad / consent v2

Đã chạy trên production preview Chrome headless cùng môi trường ở trên:

- npm run check: TypeScript, 67 tests/16 files, 13 face + 25 conversation asset checksums và production build qua.
- .venv/Scripts/python.exe -m unittest discover -s tests -p test_*.py: 6 tests qua, gồm CPU PyTorch train → ONNX, parity Python, consent/expiry, participant leakage, temporal gating, tiêu chí nghiệm thu và test một lần.
- Deno check hai Edge Functions qua sau đổi consent v2. PostgreSQL/PGlite chạy cả hai migrations; RLS/idempotency/tombstone giữ nguyên.
- Browser lab: video xám tổng hợp 2 giây → 10 mẫu theo mốc 200ms; toàn bộ uncertain/no-face, không tạo nhịp; nhãn sad tham chiếu cho recall=0, không kết luận=1. Xuất JSON không có media/đặc trưng nghiên cứu. File MP4 hỏng có thông báo.
- Mô phỏng buồn thể hiện 160ms bật / 220ms nghỉ / 160ms bật. Layout lab 390px không tràn ngang; screenshot tại output/playwright/lab-mobile.png và lab-desktop.png.
- Model phụ tổng hợp chỉ dùng verification: nạp manifest/ONNX có checksum, nút bật camera bị khóa khi chưa approve; ONNX Runtime Web đối chiếu 10 vector Python sai số <=1e-5. Worker thật trên fixture astronaut trả đủ 52 blendshape và 2 điểm model phụ. Không đưa model tổng hợp vào public assets hoặc mặc định.
- Offline baseline: chuẩn bị đủ 13 face assets + manifest, kiểm precache qua worker/controller; context mất mạng, mở trang mới, worker thật khởi tạo và xử lý no-face.
- Camera regression: mô phỏng getUserMedia bằng canvas; quyền bị từ chối/thiếu/bận có lỗi đúng; rút đồng ý/kết thúc/chuyển nền dừng tracks. Lưu local feedback rồi xóa hoàn toàn qua UI. Không có POST trong luồng camera local.
- CSP hiện tại: worker chạy được; model 404 hiển thị lỗi và dừng tracks. YouTube chỉ allow frame-src youtube-nocookie; chưa kiểm chứng phát video YouTube thực qua mạng ngoài.
- IndexedDB migration v1→v2 kiểm chứng bằng database cũ thực trong fake IndexedDB: queued thiếu quyền gửi về local-only; withdrawing xóa payload; haptics=false chuyển off. Queue tests chặn đích thay đổi, retry trùng và sai mã không ghi đè receipt đúng.
- Offline unit tests chặn ready khi thiếu app cache/controller, kiểm bytes/SHA-256, và hủy download không cache bản chưa hoàn tất. Browser regression xóa một entry CSS khỏi precache: ứng dụng từ chối báo ready; phục hồi entry rồi chuẩn bị lại và mở trang mới offline thành công.

Bằng chứng trên xác minh cơ chế kỹ thuật. Chưa có dữ liệu người thật để chứng minh nhận sad tốt hơn, chưa có pilot, Android motor/nhiệt/pin hoặc Supabase hosted. MLP tổng hợp có approved=false; FER+ vẫn mặc định. Hướng dẫn sử dụng và nghiên cứu: AI_LAB.md.

Smoke test mới: scripts/browser-lab-check.js; script camera/offline/CSP hiện có đã cập nhật theo giao diện và consent v2. Artifact tổng hợp và script parity có chứa dữ liệu tổng hợp nằm trong output/playwright, không là dataset pilot. Runtime MediaPipe vẫn ghi INFO delegate qua console.error; không có pageerror trong browser lab.

## Xác nhận PC sau sửa cache manifest — 11/10/2026

- `npm run check`: 67 test trong 16 file, 13 face assets và 25 conversation assets qua checksum, production build thành công. `.venv/Scripts/python.exe -X utf8 -m unittest discover -s tests -p "test_*.py"`: 6 test qua. `npm run format:check` cũng qua.
- Sửa service worker để cache response thành công của `/models/manifest.json` và `/models/conversation-manifest.json`; thao tác cache là best-effort để lỗi quota không chặn response online.
- Chrome trên production preview: chuẩn bị qua UI và xác minh checksum ứng dụng/model nền (khoảng 74 MiB), gói phụ đề (64,5 MiB), gói sắc thái (222,5 MiB). Tắt mạng, mở tab mới: cả hai manifest trả HTTP 200; Settings hiện đủ ba gói; emotion worker suy luận được và Whisper hiển thị kết quả.
- Docker Compose production được build lại và healthy ở `127.0.0.1:8080`; dev server vẫn chạy ở `127.0.0.1:5174`. Chrome trên Docker production cũng mở lại offline được, hai manifest trả 200 và Settings nạp đủ ba gói.
- Một fixture parity trên trình duyệt: sai khác lớn nhất với tham chiếu Python là 0,0062 ở text và 0,0255 ở voice (ngưỡng so sánh 0,03). Đây chỉ xác nhận preprocessing/runtime parity trên một fixture, không đo độ chính xác cảm xúc.
- ASR FLEURS `vi_vn`, 5 mẫu đọc: Whisper tiny WER 0,7133 / CER 0,4799 / RTF 0,7558; Whisper base WER 0,3733 / CER 0,2269 / RTF 1,0167. Mẫu nhỏ, không đại diện hội thoại tự nhiên; base giảm lỗi trên mẫu này nhưng chậm hơn thời lượng audio, chưa được chọn làm mặc định.

Chưa kiểm thử micro/camera vật lý, Android, motor rung, nhiệt/pin, người tham gia pilot, Supabase hosted hoặc hosting HTTPS công khai. Không dùng các kết quả nhỏ trên để khẳng định chất lượng thực tế. Model face/text/voice đều chạy local trong browser; không có huấn luyện mới trên dữ liệu người dùng.

## Hội thoại hợp nhất và Docker production — 11/10/2026

- `npm run check`: lint, TypeScript, 88 test trong 21 file, 13 face + 25 conversation asset checksums và production PWA build đều qua. `npm run format:check` qua; `npm run lint` qua riêng sau khi thêm browser QA scripts.
- Playwright kiểm tra 7 viewport (320×568, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080): không có tràn ngang; breakpoint menu/sidebar và vùng phụ đề đúng. Ảnh: `output/playwright/conversation-desktop.png`, `output/playwright/conversation-mobile.png`.
- Synthetic browser session trên Docker production: một yêu cầu getUserMedia chứa audio và video; đổi camera chỉ yêu cầu video và micro còn live; kết thúc dừng toàn bộ track và đóng capture AudioContext. Trong session không có POST hoặc yêu cầu tài nguyên ngoài origin. Synthetic audio là tone nền, không phải câu nói; không dùng kết quả này để kết luận transcript hoặc fusion.
- `docker compose up -d --build web` hoàn tất; `ou-khinghip-web-1` healthy, `http://localhost:8080/` trả HTTP 200. Footer hiển thị build ID `local-2026-10-11T12:07:52.690Z`. Container dev tiếp tục chạy riêng ở `127.0.0.1:5174`.
- Console có các cảnh báo runtime MediaPipe và một dòng INFO của TensorFlow Lite được ghi ở mức error; không ghi nhận lỗi page-level trong luồng synthetic. Đây không thay thế kiểm tra âm thanh phát ra loa thật.

Chưa thử camera/micro/loa vật lý, chưa kiểm chứng nhận dạng tiếng Việt trong hội thoại thật, độ chính xác face/text/voice fusion, Android, motor rung, pin/nhiệt hoặc pilot. Cần kiểm tra thủ công trên Chrome PC với quyền camera/micro và âm lượng phù hợp trước khi dùng demo với người khác.

## Startup/cache recovery và nhật ký — 11/10/2026

- `npm run check`: lint, TypeScript, 96 tests trong 23 files, 13 face assets + 25 conversation assets qua checksum và production PWA build.
- `npm run format:check` qua.
- Tối ưu đường tải model: stream vào một buffer theo kích thước manifest, kiểm byte count/SHA-256 rồi cache. Mỗi gói xác minh lại sau khi ghi; có tối đa một lượt sửa entry bị mất. UI chỉ báo 100% sau khi readiness/offline cache xác minh xong.
- Chrome/Playwright profile sạch trên Docker: đủ 3 gói `speech`, `emotion`, `speech-base` trong CacheStorage; chỉ số thiếu của mỗi gói bằng 0.
- Recovery browser test: một yêu cầu `getUserMedia` audio+video gắn với thao tác bắt đầu; không có navigation khi bắt đầu. Reload có chủ đích giữ dấu phiên, dừng track, trở về trạng thái idle, hiện “Phiên trước bị gián đoạn” và không tự xin quyền thiết bị lần nữa.
- Sửa race pagehide: marker giữ session ID cho tới khi document cũ kết thúc; component không prewarm AI trong lúc unload. Marker pha bị ghi lại vẫn nhận dạng được phiên đang hoạt động.
- `docker compose build` và `docker compose up -d --force-recreate` hoàn tất; `docker compose ps` báo container healthy ở `127.0.0.1:8080`. Build ID trong app: `local-2026-10-11T16:38:13.749Z`.
- Console browser test không có lỗi JavaScript; hai cảnh báo MediaPipe runtime. Luồng media là canvas/oscillator giả lập, không chứng minh phần cứng hoặc ASR/fusion trên lời nói thật.

Không tái hiện reload tự phát khi bấm bắt đầu trong Playwright. Vì vậy nguyên nhân của lần reload trên PC người dùng vẫn chưa được xác định. Cần kiểm tra Chrome với webcam/micro thật; chưa kiểm chứng loa thật, Android, motor rung, độ chính xác cảm xúc, pin/nhiệt hay pilot.

## Profile AI văn bản và sửa camera — 12/10/2026

- Sửa lỗi trạng thái camera: lỗi đổi thiết bị khi video track hiện tại còn sống không còn bị coi là lỗi nghiêm trọng để hủy cả hội thoại. Regression test xác nhận chỉ một webcam thì ứng dụng báo rõ, không giả vờ đổi camera; đổi camera thật vẫn giữ track micro.
- Preview có chế độ lật riêng qua CSS; đường frame đưa vào inference không bị lật. Dữ liệu cài đặt cũ tiếp tục dùng được với chế độ mặc định `auto`.
- Profile sản phẩm chỉ còn speech (Whisper tiny + VAD + runtime) và emotion văn bản (PhoBERT). Manifest Docker được kiểm tra trực tiếp tại `localhost:8080`: 2 pack, 15 asset; không có `speech-base` hoặc model cảm xúc giọng nói.
- `npm run check`: lint, boundary check, TypeScript, 102 tests trong 23 file, 13 face + 13 conversation assets đã kiểm tra checksum và production PWA build đều qua. `npm run format:check` qua.
- `docker compose up -d --build`: image production được build và container `ou-khinghip-web-1` tạo lại; healthcheck báo healthy, `/healthz` trả `ok`, `/` trả HTTP 200 tại `http://localhost:8080`. Bundle đang phục vụ mang build ID `local-2026-10-12T03:13:53.480Z`.
- Loại bỏ cảm xúc tông giọng khỏi xử lý phiên mới; giữ compatibility khi đọc lịch sử cũ. Fusion hiện chỉ nhận text + face đồng thuận. CaptionRevision chỉ chuẩn hóa định dạng/lặp ở ranh giới đoạn và giữ transcript gốc; chưa có model sinh/correct ngữ nghĩa.

Đây là xác minh mã, asset, build và container. Chưa thử lật hình với webcam vật lý, xác nhận thiết bị camera nào bị lật bởi driver/browser, loa PC thật, chất lượng ASR/fusion hội thoại tiếng Việt, Android hoặc pilot.

## Nhãn mặt sớm và phụ đề cửa sổ tạm — 12/10/2026

- Regression mới: cadence mặt 1.005 giây không reset candidate; nhãn và nhịp có dwell riêng; pose yaw/pitch/roll từ ma trận; snapshot audio sau 800 ms; ASR cuối ưu tiên partial; lặp transcript bất thường bị gắn “Chưa nghe rõ”. Test pose dùng ma trận tổng hợp, không xác nhận góc camera thực.
- `npm run check`: lint/boundary, TypeScript, 111 tests trong 27 files, 13 face + 13 conversation asset checksums và PWA production build đều qua.
- `npm run lint`: qua. `npm run format:check`: qua sau khi format 7 file bằng Prettier.
- Build output tách worker; WASM SIMD threaded khoảng 14,2 MB và JSEP khoảng 21,6 MB. Đây là kích thước bundle, không phải RAM hoặc latency khi chạy. Chưa có phép đo p50/p95 mới trên PC.
- Whisper tiny vẫn multilingual, `language=vietnamese` không phải fine-tuning tiếng Việt. Benchmark FLEURS cũ chỉ có 5 câu đọc (WER 0,7133/CER 0,4799/RTF 0,7558), không đại diện hội thoại. PhoWhisper/Gipformer chưa được tích hợp vào profile sản phẩm.

`docker compose up -d --build web` hoàn tất; container `ou-khinghip-web-1` healthy trên `127.0.0.1:8080`, `/healthz` trả `ok`, trang trả HTTP 200. Build ID trong bundle và UI là `local-2026-10-12T16:05:22.147Z`. Playwright mở build mới, xác nhận tiêu đề SignEmo và UI Hội thoại; viewport `320×568` có document/body scroll width bằng đúng 320 px; 0 lỗi console, 2 cảnh báo MediaPipe (khởi tạo XNNPACK và tắt kiểm tra OpenGL), worker chạy. Đây là smoke test browser, không phải kiểm tra camera/micro/loa phần cứng.

Chưa xác minh bằng webcam/micro/loa vật lý, chưa benchmark phiên 30 phút hoặc chất lượng sad/angry trên dữ liệu người thật. Build và UI đã được cập nhật; chất lượng model/độ trễ trên PC thật vẫn cần nghiệm thu riêng.

## Đo capture mặt và Docker — 13/10/2026

- Camera đợi `requestVideoFrameCallback` khi trình duyệt hỗ trợ, có timer fallback. Mốc frame được ghi trước `createImageBitmap`; `captureMs`, `processingMs` (inference worker) và `latencyMs` (capture đến khi nhận kết quả) được giữ riêng. Bộ lọc stale và p50/p95 của camera dùng latency đầu-cuối. Thêm ba regression cho thời gian capture/latency.
- `npm run check`: lint/boundary, TypeScript, 114 tests trong 28 files, 13 face + 13 conversation asset checksums và production build đều qua. `npm run format:check` qua. Python research suite: 7/7 tests qua.
- Một test chờ trạng thái warmup timeout trong lúc Docker build và Vitest chạy đồng thời; test file qua khi chạy riêng (11/11) và full suite qua khi chạy tuần tự (114/114). Không tái hiện lỗi sau đó.
- `docker compose up -d --build web` build thành công và recreate container. `ou-khinghip-web-1` healthy; `/healthz` trả `ok`, `/` trả HTTP 200. Build ID đọc từ bundle đang phục vụ: `local-2026-10-13T01:11:27.370Z`.

Đây là kiểm tra mã, timing arithmetic, build và container. Chưa đo capture trên webcam thật, chưa xác nhận p95 700 ms, chưa chạy benchmark đồng thời 20–30 phút, chưa thử micro/loa vật lý, chưa có bộ dữ liệu đủ để xác nhận WER hoặc độ chính xác sad/angry; Android và pilot chưa được kiểm tra.

Playwright CLI smoke chưa được chạy lại trong lượt này: lệnh `npx` không tìm thấy gói `@playwright/cli` trong npm cache-only của môi trường. HTTP production smoke đã xác nhận bundle mới trả 200 và chứa nhánh `requestVideoFrameCallback`; kiểm tra này không thay cho tương tác trình duyệt hoặc webcam/micro/loa thật.

## PhoWhisper-tiny ưu tiên và Docker production — 13/10/2026

- PhoWhisper-tiny ONNX q8 được ghim tại revision `29a5ac0c94a244429e513ccb9e3625cea4daf20e`; toàn bộ model/tokenizer tăng 45.305.228 byte (43,2 MiB). Dùng runtime Transformers.js/ONNX hiện có. Whisper tiny q8 được giữ làm fallback khi khởi tạo PhoWhisper thất bại.
- Smoke test bằng Transformers.js + ONNX Runtime Node CPU trên 5 mẫu public FLEURS `vi_vn`: PhoWhisper WER 0,1533, CER 0,0944, RTF 0,1983; Whisper tiny cùng 5 mẫu WER 2,2667, CER 1,7108, RTF 0,3915. Chỉ là phép thử nhỏ của đường Node CPU; không phải browser WASM, không đại diện hội thoại tự nhiên và không đủ để kết luận model đã đạt tiêu chí production.
- `npm run check` qua: lint/boundary, TypeScript, 117 tests trong 29 files, asset checksums và production build. `npm run format:check` qua.
- `docker compose up -d --build` đã build và recreate container; `ou-khinghip-web-1` healthy trên `127.0.0.1:8080`. `/healthz` trả HTTP 200; worker ASR mới và PhoWhisper ONNX encoder được phục vụ HTTP 200. Build ID trong bundle `local-2026-10-13T02:43:45.142Z`.

Không có browser integration session khả dụng để chạy WASM inference end-to-end trong lượt này. Vì vậy việc PhoWhisper khởi tạo và giải mã đã được xác minh trên Node CPU, còn hành vi thực tế của worker WASM trong Chrome, chất lượng hội thoại/giọng vùng miền, microphone vật lý và phần cứng PC vẫn cần nghiệm thu. Mặc định ứng dụng thử PhoWhisper trước; nếu worker không tải được, fallback Whisper tiny và audit ghi profile đã chọn.

## EmotiEffLib classifier được đóng gói — 13/10/2026

- Thay FER+ bằng `enet_b0_8_best_afew.onnx` từ EmotiEffLib revision `c018fcf96c79c3bd9184f1c9438fe2095c9f1943`; kích thước 16,039,595 byte, SHA-256 `7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f`, license Apache-2.0. Manifest khai báo input float32 `[1,3,224,224]` và preprocessing RGB ImageNet; worker ánh xạ raw label order về thứ tự SignEmo trước softmax.
- Chất lượng ảnh vẫn đo trên crop grayscale 64×64; model nhận crop RGB riêng 224×224. Có unit test cho preprocessing, ánh xạ nhãn và đầu vào lỗi.
- Kết quả ONNX checker và CPU inference smoke đã xác nhận graph hợp lệ, shape `[1,3,224,224]` → `[1,8]` và finite output. Đây không xác nhận tốc độ browser/WASM hay độ chính xác biểu cảm.
- `npm run assets:prepare` xác minh 13 asset mặt/runtime; `npm run assets:verify` xác minh 13 asset mặt + 25 asset hội thoại. `npm run check` qua: lint/boundary, TypeScript, 120 tests trong 30 files, checksum và production build. `npm run format:check` qua. Python research suite: 5/5 tests qua.
- `docker compose up -d --build web` build thành công và container `ou-khinghip-web-1` healthy tại `127.0.0.1:8080`; `/healthz` trả `ok`. Manifest được phục vụ có version `emotiefflib-enet-b0-8-best-afew-v1`, không còn FER+; ONNX tải từ container có đúng 16,039,595 byte và SHA-256 đã ghim.
- Playwright CLI không có trong npm cache cục bộ, wrapper Bash bị chặn khi mở pipe trên Windows, và Chrome headless không khởi chạy được trong môi trường này. Vì vậy chưa xác minh worker WASM trong trình duyệt; chỉ có Docker/static asset smoke, Python ONNX CPU smoke, adapter unit tests và build. Chưa có dữ liệu người tham gia tách biệt để so Sad/Angry với FER+; chưa nghiệm thu camera thật hoặc benchmark latency trên Chrome.

## Quick Tunnel cho giảng viên kiểm thử — 14/10/2026

- Chạy `docker compose up --build -d web`; production image `signemo:local` được tạo/cập nhật và container `ou-khinghip-web-1` healthy tại `127.0.0.1:8080`. `/healthz` trả HTTP 200.
- Khởi chạy Cloudflare Quick Tunnel trỏ tới `http://127.0.0.1:8080`. Cả `/healthz` và trang chính qua HTTPS trả HTTP 200. Hostname ngẫu nhiên được gửi riêng trong phiên chat; tunnel cần tiến trình `cloudflared`, Docker và PC tiếp tục chạy, và hostname có thể đổi khi tạo tunnel mới.
- Playwright mở trang qua HTTPS tunnel: tiêu đề và màn Hội thoại đúng; PhoWhisper là profile mặc định, Moonshine vẫn bị khóa; sau khi chuẩn bị xong không còn cảnh báo AI chưa sẵn sàng. Lần mở mới hiển thị tổng tải khoảng 310 MiB. Console không có lỗi JavaScript; có hai cảnh báo MediaPipe không chặn giao diện.
- Chưa bật đồng ý hoặc xin quyền thiết bị trong smoke test này; webcam, microphone, loa vật lý, chất lượng ASR và cảm xúc chưa được nghiệm thu. Lần đầu người thử cần chờ model được tải/cache, tích đồng ý, rồi tự cấp quyền camera và micro.
