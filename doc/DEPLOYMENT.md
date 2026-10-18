# Triển khai SignEmo

## Bản nâng cấp v26: Khởi tạo lại Docker & Cập nhật Public Tunnel — 17/10/2026

Public hiện phục vụ **signemo:auto-compat-20261017-v26**, container `ou-khinghip-web-1` trên cổng 8080. Quick Tunnel mới: **https://remedy-neck-vendors-incl.trycloudflare.com/**.

- **Nguyên nhân clip fail (Error 153 / Refused to connect):**
  1. Header `Referrer-Policy: no-referrer` trong Nginx khiến trình duyệt tước bỏ Referer HTTP header khi iframe gọi đến `www.youtube-nocookie.com`. YouTube kiểm tra Referer để xác thực nguồn nhúng và từ chối kết nối khi thiếu header này.
  2. Header `Cross-Origin-Embedder-Policy: require-corp` vô tình được kích hoạt toàn cục cho `index.html`. Trình duyệt chặn iframe bên thứ ba không mang cờ CORP tương ứng.
- **Giải pháp đã thực hiện:**
  - Cập nhật `docker/security-headers.conf` & `public/_headers`: chuyển `Referrer-Policy` sang `strict-origin-when-cross-origin` (bảo đảm tính riêng tư nhưng vẫn cung cấp origin cho YouTube).
  - Gỡ bỏ COEP toàn cục trên `index.html`; chỉ áp dụng cục bộ cho tuyến `/research/` khi cần thử nghiệm đa luồng.
  - Tự động chuyển đổi mượt mà giữa chế độ WebGPU và WASM CPU khi thiết bị không hỗ trợ.
  - Video YouTube demo phát hoàn hảo, kiểm thử 233/233 tests (62 files) pass sạch 100%.

## Bản nâng cấp v22: Responsive toàn diện & Lõi AI ổn định — 16/10/2026

Public hiện phục vụ **signemo:responsive-core-20261016-v22**, build `demo-20261016-responsive-core-v22`. Link chia sẻ: **https://changelog-trends-bosnia-measurements.trycloudflare.com/**. Recreate container web trên cổng 8080 qua `compose.public-trial.yaml`, giữ nguyên tunnel Quick Tunnel HTTP/2 và ba mount tài nguyên read-only (Gipformer, EmotiEff B0, ORT GPU runtime). Container healthy, `/healthz` HTTP 200, entry bundle JS tải thành công HTTP 200.

Bản này tích hợp đầy đủ:
- Sửa lỗi thuộc tính iframe YouTube (`credentialless`) và sửa thuộc tính `camera.switching`.
- Nâng `map_hash_bucket_size 256` trong Nginx để phục vụ hoàn hảo các tuyến đường model content-addressed.
- Responsive Dual-Pane cho mobile landscape (ngang 2 cột không trôi phụ đề) và thumb-zone cho mobile portrait.
- Giới hạn DOM 30 đoạn gần nhất, kho tự khóa sau 5 phút.
- LCP ổn định chữ tạm tiếng Việt có compound token binding.
- Đóng AudioContext âm phản hồi và giải phóng toàn bộ worker khi kết thúc phiên, thêm nút "Chuẩn bị phiên mới".
- Đạt toàn bộ 231 tests (62 test files), lint và typecheck sạch 100%.

Rollback an toàn: Image v19 cũ được lưu tại tag `signemo:rollback-before-v22`.

## Bản cuối responsive/poster/PWA v19 — 16/10/2026

Public hiện dùng **signemo:responsive-20261016-v19**, build `demo-20261016-responsive-v19`, image `sha256:46779eed57100812e0a4fa97250d75bb36a9b332d790326d67ecdff52a6576d6`. Link giữ nguyên **https://changelog-trends-bosnia-measurements.trycloudflare.com/**; chỉ recreate web, giữ tunnel/ba model mount read-only. Healthy/HTTPS healthz 200. Staging cuối localhost:8089/container `signemo-responsive-20261016-v19`; các v14–v18 dừng và giữ image. Model/profile và dữ liệu người dùng không đổi.

Rollback ổn định v13: đặt image override `signemo:rollback-before-responsive-v19`, chạy lại Compose project `ou-khinghip` với hai file ở lệnh bên dưới, `up -d --no-build --pull never --force-recreate web`. Không cần rebuild source để rollback. Các mục v16/v18 bên dưới là lịch sử thử.

PWA đang giữ bản cũ: kết thúc hội thoại rồi chọn cập nhật nếu hiện. Client rất cũ có thể bỏ lỡ banner; đóng các tab SignEmo rồi mở lại để worker đã cài kích hoạt tự nhiên. Không yêu cầu xóa storage/vault/cache hoặc bật unsafe flags. Đã thử nâng v18 ->v19 qua nút cập nhật và nâng client public cũ bằng rời origin sau khi worker waiting; cache encoder được giữ.

## Bản responsive/core v16 — 16/10/2026

Link hiện hành giữ nguyên **https://changelog-trends-bosnia-measurements.trycloudflare.com/**. Public `ou-khinghip-web-1`/8080 dùng `signemo:responsive-20261016-v16`, build `demo-20261016-responsive-v16`, image `sha256:cabda52f289a5e9f959968bf1604e739833ea35e717b73f77456fa68001a2442`. Recreate riêng web qua `compose.public-trial.yaml`, giữ tunnel PID 27092 và ba model/runtime mount read-only; không mount dữ liệu thử hoặc đổi kiosk. Healthy/HTTPS healthz 200; Edge public đúng build và AI lõi sẵn sàng. Không đổi model hoặc promote accuracy.

Staging cuối localhost:8089 (`signemo-responsive-20261016-v16`); v14/v15 dừng và giữ image. Rollback public bằng đổi image override thành `signemo:rollback-before-responsive-v16` (v13), rồi chạy lại Compose `up -d --no-build --pull never --force-recreate web` với project/two files như bên dưới. Không xóa browser storage; cập nhật PWA sau khi kết thúc phiên.

Migration `202610160001_rate_limit_retention.sql` chỉ kiểm PostgreSQL local; chưa áp lên Supabase hoặc bật backend. Không cần credential backend cho bản trial này. Immutable chỉ áp asset tên hash; model/runtime ổn định URL giữ revalidation, isolation toàn site không bật để giữ player tham khảo. Thông số benchmark/Android chưa được nghiệm thu mới.

## Bản sửa khởi tạo v13 — 16/10/2026

Link giữ nguyên **https://changelog-trends-bosnia-measurements.trycloudflare.com/**. `compose.public-trial.yaml` chọn `signemo:startup-20261016-v13`, build `demo-20261016-startup-v13`, image ID `sha256:7bd2a8bffd5dbe6e4b6988b977ca6a2e65fc8a83a2e5a5fce7abafebbe08443a`. Đã recreate riêng web/8080, giữ ba model/runtime mount read-only và tunnel PID 27092. Healthy và HTTPS healthz 200; Edge public khởi tạo AI thành công. Không mount dữ liệu kiểm thử hoặc thay container kiosk.

Rollback: đổi image trong override sang `signemo:rollback-before-startup-v13`, build ID về v12 rồi chạy lại lệnh Compose `up -d --no-build --pull never --force-recreate web` với cùng project/two compose files bên dưới. Không build lại source v13 để rollback. Giữ vault/feedback/cache; người dùng tải lại trang hoặc chọn cập nhật PWA nếu hiện. Lần đầu vẫn tải khoảng 314,54 MiB model/runtime, chưa gồm app/tone; đây không phải kích thước RAM.

## Link hiện hành sau khôi phục — 16/10/2026, 09:30

**https://changelog-trends-bosnia-measurements.trycloudflare.com/** phục vụ cùng v12 tại 8080. Link `lot-tackle-legendary-anna` bên dưới là lịch sử và không còn hiệu lực: cloudflared vẫn chạy nhưng Cloudflare trả `Unauthorized: Tunnel not found`, DNS máy và 1.1.1.1 đều NXDOMAIN. Chưa xác định nguyên nhân khiến tunnel bị mất phía dịch vụ; không đổi DNS của máy để né lỗi.

Đã thay đúng tiến trình tunnel hỏng bằng Quick Tunnel HTTP/2 mới. DNS máy/1.1.1.1 đều resolve được; HTTPS healthz 200 và JS đúng build v12. Metadata link/PID/log mới tại `output/deployment/tunnel-v12.json`, bằng chứng tại `tunnel-v12-current-health.json`. Docker/image/model không đổi. Link vẫn tạm thời; chỉ giữ tiến trình chạy không bảo đảm hostname Quick Tunnel tồn tại lâu dài.

## Link dùng thử v12 — 16/10/2026

Theo yêu cầu chia sẻ bản candidate, public 8080 đã được chuyển sang image `signemo:intro-lcp-20261016-v12` (Gipformer/B0-WebGPU, YouTube giới thiệu, LCP, không B2). Đây vẫn là bản thử PC, không phải nghiệm thu Android/accuracy. Dùng override riêng để giữ cấu hình baseline không đổi:

```powershell
docker compose -p ou-khinghip -f compose.yaml -f compose.public-trial.yaml up -d --no-build --pull never web
```

Image này cần ba mount read-only chứa checkpoint/runtime công khai đã kiểm checksum: Gipformer, B0 và ORT GPU. Không mount thư mục benchmark, clip/transcript hoặc toàn bộ research. Giữ read-only rootfs, drop capabilities và no-new-privileges của base Compose. Không chạy `down` toàn workspace hoặc thao tác container kiosk khác.

Tunnel cũ không chạy tại thời điểm triển khai. Quick Tunnel HTTP/2 mới: **https://lot-tackle-legendary-anna.trycloudflare.com/**, chuyển về `http://127.0.0.1:8080`; cloudflared chạy ẩn, không bật cập nhật tự động. PC/Docker/cloudflared phải còn chạy; khởi động Quick Tunnel khác sẽ có thể đổi hostname. Log/PID/trạng thái nằm trong `output/deployment/`, không có media hay transcript. Đây là kiểm tra từ PC qua HTTPS công khai, chưa xác minh từ thiết bị/mạng ngoài độc lập.

Artifact cũ giữ ở `signemo:rollback-public-20261016-v12`. Để rollback đúng image mà không phụ thuộc tag mặc định:

```powershell
$previousSignemoTag = $env:SIGNEMO_IMAGE_TAG
try {
  $env:SIGNEMO_IMAGE_TAG = 'rollback-public-20261016-v12'
  docker compose -p ou-khinghip -f compose.yaml up -d --no-build --pull never --force-recreate web
} finally {
  $env:SIGNEMO_IMAGE_TAG = $previousSignemoTag
}
```

Không xóa browser storage để nâng cấp: vault/feedback/cài đặt thuộc origin của người dùng. Hostname Quick Tunnel mới có origin/cache riêng; dữ liệu của hostname cũ không được chuyển hoặc gửi lên server. Camera/micro vẫn chỉ mở sau đồng ý và bấm bắt đầu. YouTube chỉ kết nối khi bấm xem; media của người dùng tiếp tục xử lý local.

## Chạy bản production bằng Docker trên PC

Docker Compose dựng static PWA, không dựng Supabase. Nó bind vào `127.0.0.1:8080`, chạy Nginx non-root, bật healthcheck và chỉ cấp vùng `/tmp` ghi được:

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f web
docker compose down
```

Mở `http://localhost:8080`. Build chuẩn bị model/runtime và kiểm tra SHA-256 bằng `scripts/prepare-assets.mjs`; cần internet ở build đầu nếu các asset chưa có trong workspace. Thay code hoặc biến `VITE_*` cần tạo image mới bằng `docker compose up --build -d`. Compose đọc các biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` từ `.env` ở thư mục gốc; chỉ dùng URL và public anon/publishable key. Các biến này được nhúng vào bundle tĩnh. Không đưa service-role key vào build args, image hoặc trình duyệt.

Port local chạy HTTP nên chỉ dùng camera trên chính PC qua `localhost`. Để thử camera Android, dùng hosting HTTPS ở phần dưới hoặc một reverse proxy TLS được cấu hình riêng. Compose này không cấp chứng chỉ TLS và không mở cổng ra LAN.

## Hosting PWA trên Cloudflare Pages

1. Đưa source lên repository do bạn quản lý; không commit `.env`, research-data hoặc clip.
2. Build command: `npm ci && npm run assets:prepare && npm run build`. Output: `dist`. Node 24.
3. Nếu có backend, thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong build environment, dùng public key.
4. HTTPS mặc định. `_headers` đặt CSP và chặn micro; `_redirects` hỗ trợ SPA. Các asset riêng được kiểm tra <=25 MiB.
5. Kiểm tra trang, camera, worker, rung và tải offline trên Android thật. Không coi emulator là chứng cứ về motor/pin.

Không có tài khoản hosting được kết nối trong workspace này; hướng dẫn không có nghĩa là đã deploy. Ngân sách MVP mặc định dùng free tier, không tự mua tài nguyên.

## Supabase

Cài Supabase CLI theo tài liệu chính thức, tạo project free và dùng dashboard/CLI của chính bạn. Không gửi secrets trong chat.

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Chạy cả hai migrations theo thứ tự: 202610110001_signemo.sql tạo tables/RLS/RPC; 202610110002_feedback_consent.sql bổ sung consent v2 và giữ báo cáo v1. Supabase db push áp dụng cả hai. Không chỉ chạy migration đầu vì submission mới dùng v2. Đặt secrets của Edge Functions qua dashboard: `ALLOWED_ORIGINS` là danh sách origin HTTPS phân cách bằng dấu phẩy (không dấu `/` cuối); `RATE_LIMIT_SALT` là secret ngẫu nhiên >=32 byte. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` là environment server của project, không phải frontend.

```powershell
supabase functions deploy submit-report
supabase functions deploy withdraw-report
```

`verify_jwt=false` cho hai endpoint vì người dùng không đăng nhập; handler thực thi validation, Origin, giới hạn kích thước và rate limit. Không dùng cấu hình này cho API admin. JWT/RLS bảo vệ dashboard truy cập trực tiếp PostgreSQL qua Supabase.

Trong dashboard Auth, tắt **Allow new users to sign up**, tắt anonymous sign-ins, tạo thủ công tài khoản chủ dự án và dùng mật khẩu mạnh. Lấy UUID của tài khoản vừa tạo, chạy SQL trong dashboard:

```sql
insert into public.admin_users(user_id) values ('UUID_FROM_AUTH_USERS');
```

Chỉ một chủ được cấp quyền ban đầu. Không tạo signup UI. Project local đã có `enable_signup=false`; project hosted phải tắt riêng qua dashboard.

Tạo `.env` từ `.env.example`, điền URL và anon/publishable key rồi build lại. Không đưa khóa service role vào client. Dashboard chỉ hoạt động khi migration, Auth và allowlist đã cấu hình.

## Chạy backend local

Docker daemon và Supabase CLI phải hoạt động. `supabase start`, `supabase db reset` (chỉ database local dùng riêng), cấu hình secrets local rồi `supabase functions serve`. Thêm origin localhost vào ALLOWED_ORIGINS local. Không chạy reset trên database chứa dữ liệu thật. Kiểm thử tự động hiện dùng PGlite để kiểm chứng migration/RLS; không thay thế việc chạy thử Edge Functions trên Supabase.

## Kiểm tra sau triển khai

- Anonymous không đọc được reports/feedback/admin_users, không gọi privileged RPC.
- Đúng mã xóa thì withdraw thành công; sai mã bị từ chối; gửi lại sau withdraw bị 409.
- Admin ngoài allowlist không đọc hoặc xóa được báo cáo.
- Tắt backend: camera/rung hoạt động; bản đã đồng ý gửi giữ queued. Bật lại: gửi một lần, không nhân đôi; bản local-only không tự gửi.
- Mất mạng sau tải đầy đủ: đóng/mở lại, camera AI vẫn chạy.
- Không xuất hiện frame/ảnh trong network, storage hoặc server logs.
- Kiểm tra free-tier pause/hạn mức trước buổi demo. Sao lưu dữ liệu pilot bằng export quản trị ở vùng lưu trữ được bảo vệ.

Rollback frontend bằng deploy trước đó; giữ nguyên model/manifest tương ứng. Migration đầu tiên không có rollback tự động phá dữ liệu; sao lưu rồi lập migration bổ sung khi thay schema. Tài liệu chính thức: https://supabase.com/doc/guides/functions/function-configuration và https://developers.cloudflare.com/pages/platform/limits/.

## Bản dựng Container v23 (Tự động thích ứng GPU/CPU & Nút chọn trực tiếp)

- **Image Tag**: `signemo:auto-compat-20261016-v23`
- **Build ID**: `auto-compat-v23`
- **Port**: `8080` (Container `ou-khinghip-web-1`)
- **Public Tunnel**: `https://changelog-trends-bosnia-measurements.trycloudflare.com/`
- **Điểm nâng cấp**:
  1. **Tự động chuyển chế độ tương thích (CPU WASM)** khi thiết bị/trình duyệt không hỗ trợ WebGPU, không chặn người dùng hay khách hàng bằng thông báo lỗi.
  2. **Nút chuyển đổi chế độ trực tiếp**: Bổ sung nút `Dùng chế độ tương thích` ngay tại thông báo trên màn hình Giới thiệu (`HomePage`) và `ConversationPage`, loại bỏ câu điều hướng gượng gạo "Vào hội thoại để thử chuẩn bị lại".
  3. **Tùy chọn thử lại GPU**: Khi đang ở chế độ tương thích, người dùng có nút `Thử lại tăng tốc GPU` linh hoạt.
  4. **Kiểm thử tự động**: Đạt 100% 62 test files, 233/233 test cases Vitest, xác thực boundary và PWA assets.

