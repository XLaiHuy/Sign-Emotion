---
name: signemo-pwa-offline-resilience
description: Thiết kế và tối ưu PWA Offline-First, quản lý CacheStorage cho mô hình AI dung lượng lớn (>300MB), vòng đời Service Worker và bảo vệ bộ nhớ thiết bị di động.
---

# SignEmo PWA Offline-First & Large Model Resilience

Kỹ năng chuyên sâu về kiến trúc ứng dụng web lũy tiến (PWA) chạy hoàn toàn ngoại tuyến (**Offline-First**) trong SignEmo, đặc biệt giải quyết bài toán tải, lưu trữ và duy trì các mô hình học sâu dung lượng lớn (>300MB ONNX & WASM) trên thiết bị di động mà không gây lỗi tràn bộ nhớ (Out-of-Memory).

---

## 1. Bản đồ Phân bổ Bộ nhớ & Lưu trữ (Storage Architecture)

Trong SignEmo, dữ liệu được phân chia rạch ròi theo 3 cấp độ lưu trữ cục bộ:

| Tầng lưu trữ | Công nghệ | Dữ liệu quản lý | Chiến lược dọn dẹp |
| :--- | :--- | :--- | :--- |
| **Tầng 1: Static Code** | CacheStorage (`v-app-shell`) | HTML, JS, CSS, Font Be Vietnam Pro, Icons | Cập nhật khi có build mới (`sw.js` hash) |
| **Tầng 2: AI Artifacts** | CacheStorage (`v-models-cache`) | File `.onnx`, `.wasm`, `.bin` (>300MB) | Bất biến (Immutable Cache), kiểm tra SHA-256 |
| **Tầng 3: Vault Dữ liệu** | Dexie (IndexedDB) | Báo cáo đồng thuận, cài đặt, nhật ký mã hóa | Quản lý bởi người dùng, mã hóa AES-GCM |

---

## 2. Chiến lược Tải & Cache Model Dung lượng lớn (>300MB)

### Quy tắc kiểm tra Quota trước khi tải:
Trước khi kích hoạt tải các gói model nặng (PhoWhisper 150MB, Moonshine 43MB, EmotiEffLib 16MB), ứng dụng bắt buộc phải kiểm tra dung lượng còn trống của thiết bị:

```typescript
export async function verifyStorageQuota(requiredBytes: number): Promise<boolean> {
  if (navigator.storage && navigator.storage.estimate) {
    const { quota, usage } = await navigator.storage.estimate();
    if (quota && usage) {
      const remaining = quota - usage;
      if (remaining < requiredBytes * 1.5) { // Dự phòng dư 50%
        console.warn(`[PWA] Bộ nhớ không đủ! Cần: ${requiredBytes}, Còn: ${remaining}`);
        return false;
      }
    }
  }

  // Yêu cầu quyền lưu trữ bền vững (Persistent Storage) để tránh bị hệ điều hành xóa tự động
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.info(`[PWA] Trạng thái lưu trữ bền vững: ${isPersisted}`);
  }
  return true;
}
```

### Chiến lược Tải phân đoạn & Báo cáo tiến độ (Chunked Download & Progress):
- Không tải model trực tiếp qua `fetch().then(r => r.blob())` đối với file > 50MB vì dễ bị OOM trên Chrome Android.
- Đọc qua `ReadableStream` với `reader.read()`, tính toán `%` tiến độ để hiển thị thanh tiến trình rõ ràng cho người khiếm thính.
- Lưu trực tiếp vào `caches.open('signemo-models-v1')` bằng `cache.put(request, new Response(stream))`.

---

## 3. Vòng đời Service Worker An toàn (Safe SW Lifecycle)

> [!IMPORTANT]
> **Tuyệt đối không tự động reload trang khi đang trong phiên hội thoại.**  
> Nếu Service Worker phát hiện bản cập nhật mới khi người dùng đang bật camera/micro, chỉ lưu trạng thái "Có bản cập nhật mới", hiển thị banner thông báo và chờ người dùng chủ động bấm "Cập nhật & Khởi động lại" sau khi kết thúc cuộc đối thoại.

### Quy chuẩn cấu hình Service Worker:
1. **Model Cache:** Dùng chiến lược **Cache-First / Cache-Only**. Một khi file model có hash SHA-256 đã nằm trong cache, không bao giờ gửi request ra mạng.
2. **Dynamic Assets:** Dùng chiến lược **Stale-While-Revalidate** cho các asset giao diện thường xuyên thay đổi.
3. **No-Cache cho Service Worker Script:** File `sw.js` phải được cấu hình `Cache-Control: no-cache, no-store, must-revalidate` trên HTTP Server để đảm bảo trình duyệt luôn check phiên bản mới khi mở app.

---

## 4. Bảo vệ Ranh giới Vòng đời (Lifecycle Boundaries & Memory Cleanup)

Trên thiết bị di động, khi người dùng chuyển ứng dụng sang chạy nền (background), tắt màn hình hoặc chuyển tab:

1. **Lắng nghe sự kiện `visibilitychange`:**
   ```typescript
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState === 'hidden') {
       console.info('[PWA] Tab chuyển nền! Dừng Camera, Micro và giải phóng Worker.');
       sessionOwner.pauseSession();
       cameraStream?.getTracks().forEach(track => track.stop());
       audioContext?.suspend();
     } else if (document.visibilityState === 'visible') {
       console.info('[PWA] Tab hiển thị trở lại. Sẵn sàng khôi phục phiên nếu người dùng bấm tiếp tục.');
     }
   });
   ```
2. **Không để Worker giữ rò rỉ bộ nhớ:**
   Khi kết thúc một phiên hội thoại, các Worker xử lý âm thanh (PhoWhisper) và hình ảnh (MediaPipe) phải được gửi lệnh `terminate()` hoặc dọn sạch bộ nhớ WebAssembly heap nếu không sử dụng trong 5 phút.
3. **Phòng chống Crash do Thấp RAM (OOM Recovery):**
   Nếu ONNX Runtime Web báo lỗi `Wasm memory allocation failed`, bắt buộc phải chuyển sang profile dự phòng nhẹ hơn (Fallback: EmotiEffLib B0 thay vì B2; PhoWhisper multilingual tiny q8 thay vì heavy models).
