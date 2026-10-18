# Tạo tài khoản miễn phí và đưa SignEmo lên Android

Chưa cần mua domain hoặc nâng cấp gói. Làm Cloudflare trước để có link HTTPS thử camera; sau đó nối Supabase để nhận phản hồi. Không cần backend để kiểm tra AI/rung. Tình trạng kiểm tra hiện tại: Wrangler chưa đăng nhập, chưa có `.env` hoặc project Supabase trong workspace.

## 1. Tạo Cloudflare và đưa bản demo lên web

Đăng ký tại [Cloudflare](https://dash.cloudflare.com/sign-up), xác minh email. Không cần thêm domain. Mở PowerShell trong thư mục dự án và chạy:

```powershell
npm run assets:prepare
npm run build
npx wrangler login
npx wrangler pages project create signemo-huy --production-branch main
npx wrangler pages deploy dist --project-name signemo-huy --branch main
```

Ở lệnh login, bạn tự đăng nhập và cho phép Wrangler trong trình duyệt. Đổi `signemo-huy` nếu muốn tên khác; dùng cùng tên trong hai lệnh. Giữ lại URL HTTPS CLI trả về. Chỉ upload `dist`, không upload thư mục gốc chứa hồ sơ dự án.

Đây là Direct Upload; muốn tự động deploy qua Git sau này cần tạo project khác. Quy trình và giới hạn file xem [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/). Chưa có Git repository hoặc remote được tạo trong folder này.

## 2. Thử trên Android trước khi nối backend

Mở URL HTTPS bằng Chrome Android. Vào Luyện nhịp rung, thử đủ bốn pattern. Nếu không rung, ghi máy/phiên bản Chrome và xem mô phỏng; không mặc định API có nghĩa là motor hoạt động.

Vào Camera, cùng người đối diện đồng ý, bắt đầu ở nơi đủ sáng. Kết thúc rồi xuất số đo. Quay lại Tổng quan → Chuẩn bị dùng ngoại tuyến → đợi hoàn tất. Đóng ứng dụng, ngắt mạng, mở lại link và thử camera. Dữ liệu web vẫn có thể bị hệ điều hành xóa; khi đó cần tải lại. Không bật chế độ riêng tư khi kiểm chứng lưu offline.

## 3. Tạo Supabase Free

Đăng ký tại [Supabase Dashboard](https://supabase.com/dashboard), xác minh tài khoản. Tạo organization ở gói **Free**, chọn New project, đặt tên `signemo`, chọn khu vực gần người thử, lưu database password vào trình quản lý mật khẩu. Đợi database sẵn sàng. Không nâng cấp hoặc nhập thông tin thanh toán để làm theo hướng dẫn này.

Lấy Project URL, public publishable/anon key và Project reference từ project. Public key dùng cho frontend; database password/service-role key không được đưa vào frontend. Tham khảo [quickstart React chính thức](https://supabase.com/doc/guides/getting-started/quickstarts/reactjs). Gói miễn phí có hạn mức và có thể tạm dừng khi không hoạt động; xem [pricing hiện tại](https://supabase.com/pricing) trước buổi demo.

## 4. Tạo database và Edge Functions

Trong PowerShell tại thư mục dự án:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy submit-report
npx supabase functions deploy withdraw-report
```

Tự hoàn thành đăng nhập CLI và nhập database password khi CLI yêu cầu. Thay YOUR_PROJECT_REF bằng ref vừa lấy. Không gửi access token, password hoặc service-role key vào chat. Project mới sẽ nhận migration đã kiểm thử trong repo; không chạy reset trên database hosted.

Trong Dashboard → Edge Functions → Secrets, đặt:

| Secret | Giá trị |
|---|---|
| ALLOWED_ORIGINS | Origin HTTPS Cloudflare thực tế, không `/` cuối; nếu thêm localhost thì phân cách bằng dấu phẩy |
| RATE_LIMIT_SALT | Chuỗi ngẫu nhiên bí mật, ít nhất 32 byte; chỉ server |

Có thể tự sinh salt trên máy bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; lưu riêng, không gửi output vào chat hoặc Git. `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` do môi trường hosted cung cấp; không chép sang VITE. Hai endpoint public không yêu cầu đăng nhập người dùng; cấu hình `verify_jwt=false` đã nằm trong `supabase/config.toml`. Validation, giới hạn kích thước/rate limit và RLS vẫn bắt buộc. Xem [DEPLOYMENT.md](DEPLOYMENT.md) để kiểm tra cấu hình chi tiết.

## 5. Cấp đúng một tài khoản quản trị

Trong Auth, tắt Allow new users to sign up và anonymous sign-ins. Tạo thủ công một user cho chủ dự án, dùng mật khẩu riêng. Lấy UUID của user, mở SQL Editor chạy:

```sql
insert into public.admin_users(user_id) values ('UUID_OF_OWNER');
```

Đăng nhập Auth chưa đủ để đọc báo cáo: user phải có trong admin_users. Không thêm trang đăng ký công khai. Không dùng service-role key làm tài khoản quản trị.

## 6. Nối frontend rồi deploy lại

Sao chép `.env.example` thành `.env`, chỉ điền public URL và key:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

```powershell
npm run build
npx wrangler pages deploy dist --project-name signemo-huy --branch main
```

Vite lấy biến môi trường khi build; chỉ chỉnh `.env` mà chưa build lại sẽ không có hiệu lực. Nếu ứng dụng báo phiên bản mới, kết thúc camera rồi đóng các tab/PWA cũ và mở lại. Trên điện thoại, vào Cài đặt → Quản trị pilot. Hoàn thành một phiên, đồng ý gửi phản hồi, kiểm tra Đã gửi và dashboard thấy đúng một báo cáo. Thử gửi lại, rút bằng mã đúng/sai, quyền ngoài allowlist và mất mạng. Đây là bước hosted smoke test còn thiếu trong VERIFICATION.md.

## Thông tin có thể gửi để tiếp tục hỗ trợ

Sau khi tạo xong, chỉ cần thông báo đã đăng nhập Wrangler/Supabase trên máy, tên project Pages, URL HTTPS và Supabase project ref. Public URL/key đặt trực tiếp vào `.env` trên máy. Giữ secrets ở password manager/Dashboard. Không cần gửi chúng qua chat.
