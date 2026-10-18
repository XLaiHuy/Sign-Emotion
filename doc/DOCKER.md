# Chạy SignEmo trên PC bằng Docker

Yêu cầu Docker Desktop đang chạy với Linux containers. Không cần Supabase để dùng camera, phụ đề và lịch sử local.

```powershell
docker compose up -d --build
```

Mở http://localhost:8080. Docker build cài dependency từ lockfile, chuẩn bị asset có checksum, build PWA và phục vụ bằng Nginx không chạy root. Model chạy trong browser PC, không trong Nginx container. Lần build đầu cần mạng; những lần sau dùng Docker cache.

Image production chứa MediaPipe/EmotiEffLib `enet_b0_8_best_afew`, Whisper tiny/VAD, PhoBERT văn bản và runtime tương ứng. Không đóng gói Whisper base hoặc model cảm xúc tông giọng. Build kiểm checksum và dừng nếu thiếu asset. Khi mở web, trình duyệt tự tải/xác minh tài nguyên; không cần người dùng tải từng gói. Docker chứa model không có nghĩa trình duyệt đã có cache: lần mở đầu vẫn cần mạng tới máy chủ. Chỉ báo offline sau khi service worker và toàn bộ app/model hợp lệ; xóa cache phải chuẩn bị lại.

Người nhận source chỉ cần Docker Desktop (Linux containers) và lệnh trên; không cần Node trên host để chạy production. `.env` không bắt buộc. Nếu cần backend, sao chép `.env.example` và chỉ điền URL/public key; không đưa khóa service role vào frontend. Đặt `SIGNEMO_PORT` nếu 8080 bận. Model tải trong build theo lockfile, cần mạng ở lần đầu.

## Development với HMR

```powershell
docker compose --profile dev up -d --build dev
```

Mở http://localhost:5173. Source được mount, Vite HMR cập nhật khi lưu. Development không dùng để nghiệm thu offline. Node dependencies nằm trong image, không mount node_modules Windows. Đổi dependency hoặc biến môi trường cần recreate/rebuild container. Public assets development cần được chuẩn bị bằng `npm ci`, `npm run assets:prepare`, `npm run assets:conversation` trên host trước vì public được mount read-only.

## Cập nhật và dừng

Production không tự đổi khi sửa source: chạy lại `docker compose up -d --build`, kết thúc hội thoại, đóng/mở app hoặc tải lại để nhận service worker mới. Không cần xóa IndexedDB; thao tác đó sẽ mất lịch sử và feedback local.

Mã build nằm ở cuối sidebar và thuộc tính `data-build` của app. Có thể đặt `SIGNEMO_BUILD_ID` để đánh dấu bản phát hành. Khi thấy giao diện cũ, dùng nút “Cập nhật và tải lại” sau khi kết thúc phiên; không xóa dữ liệu trình duyệt. Kiểm tra image/container bằng `docker compose images` và `docker compose ps`.

```powershell
docker compose logs --tail 80 web
docker compose --profile dev down
```

8080/5173 mặc định chỉ bind loopback PC. localhost là secure context; dùng IP LAN từ điện thoại cần HTTPS. Android, pin/nhiệt và rung vật lý chưa được kiểm chứng trong đợt PC này.
