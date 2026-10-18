---
name: signemo-3d-avatar-performance
description: Tối ưu hóa hiệu năng Three.js / WebGL 3D Avatar, kiểm soát bộ nhớ GPU, render dirty-loop, giải phóng VRAM và tránh xung đột tài nguyên với Camera AI.
---

# SignEmo 3D Avatar WebGL Performance

Kỹ năng chuyên sâu về lập trình, tối ưu hóa đồ họa 3D WebGL với **Three.js** trong dự án SignEmo, đảm bảo Avatar 3D hoạt động mượt mà mà không làm nghẽn luồng xử lý của Camera MediaPipe hay ONNX Web Worker trên thiết bị di động.

---

## 1. Nguyên tắc Cốt lõi (Golden Rules)

1. **Avatar là phụ trợ, ASR và Phụ đề là ưu tiên 1:**  
   Khi tài nguyên thiết bị thấp (CPU throttled, pin yếu, nhiệt độ cao), Avatar 3D phải tự động hạ bậc (giảm FPS, tắt bóng, tắt hiệu ứng) hoặc ẩn đi để nhường toàn bộ tài nguyên cho việc xử lý âm thanh/phụ đề.
2. **Không chạy vòng lặp Render vô hạn (No Unconstrained 60FPS Loop):**  
   Tuyệt đối không dùng `requestAnimationFrame` chạy liên tục khi mô hình tĩnh. Áp dụng cơ chế **Render-on-Demand (Dirty Loop)**: chỉ vẽ lại khung hình khi có sự thay đổi cảm xúc mới, morph target mới hoặc tương tác xoay của người dùng.
3. **Giải phóng bộ nhớ triệt để (Disposal Hygiene):**  
   Three.js không tự dọn dẹp bộ nhớ WebGL/GPU khi component unmount. Phải duyệt toàn bộ cây Object3D để dispose geometries, materials, textures và giải phóng WebGLRenderTarget.

---

## 2. Kiến trúc Render-on-Demand (Dirty Flag Loop)

```typescript
// Mẫu điều khiển Render theo nhu cầu trong React 19 / Three.js
export class AvatarRenderer {
  private isDirty: boolean = true;
  private isAnimating: boolean = false;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: window.devicePixelRatio < 2, // Tắt antialias trên màn hình retina/mật độ cao
      powerPreference: 'low-power',           // Tiết kiệm pin tối đa
      precision: 'mediump'                    // Dùng độ chính xác trung bình cho mobile
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }

  // Gọi khi có trạng thái cảm xúc mới (happy, sad, surprised...)
  public triggerEmotionTransition(newEmotion: string) {
    this.isDirty = true;
    this.startTransitionAnimation();
  }

  public requestFrame() {
    this.isDirty = true;
  }

  public loop = () => {
    if (this.isDirty || this.isAnimating) {
      this.renderer.render(this.scene, this.camera);
      if (!this.isAnimating) {
        this.isDirty = false; // Đã vẽ xong khung hình tĩnh, dừng render
      }
    }
  };
}
```

---

## 3. Quản lý Xung đột Tài nguyên với Camera AI

Trong SignEmo, trình duyệt phải chạy đồng thời:
- **Stream Camera HD + MediaPipe Face Mesh** (tiêu tốn WebGL context / CPU).
- **AudioWorklet + Silero VAD + PhoWhisper ONNX** (tiêu tốn WebAssembly memory).
- **Avatar 3D Three.js Canvas**.

### Chiến lược cách ly & điều tiết:
- **Giới hạn số lượng WebGL Context:** Trình duyệt di động thường chỉ cho phép tối đa 8–16 WebGL context đồng thời. Hãy dùng chung canvas hoặc đảm bảo MediaPipe chạy CPU WASM/Worker tách biệt với Three.js canvas.
- **Xử lý mất Context (`webglcontextlost`):**
  ```typescript
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('[Avatar] WebGL Context Lost! Pausing rendering.');
    cancelAnimationFrame(animationId);
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    console.info('[Avatar] WebGL Context Restored! Reinitializing assets.');
    rebuildScene();
  }, false);
  ```
- **Hạ độ phân giải theo thiết bị:**
  - Thiết bị cao cấp (PC/Laptop): PixelRatio = 1.5, ShadowMap bật nhẹ.
  - Thiết bị di động (Android tầm trung): PixelRatio = 1.0, Tắt hoàn toàn ShadowMap, dùng baked ambient lighting hoặc unlit matcap.

---

## 4. Tối ưu hóa GLTF/GLB Avatar

1. **Giới hạn số Poly & Bone:**
   - Số đa giác (triangles): `< 15.000` polys cho toàn bộ mô hình avatar nửa thân.
   - Số xương (Bones): `< 40` bones (chỉ tập trung xương mặt, cổ và vai).
2. **Morph Targets (Blendshapes):**
   - Chỉ giữ các blendshapes tương ứng với 7 nhãn cảm xúc SignEmo: `neutral`, `happy`, `surprised`, `sad`, `angry`, `disgust`, `fear`.
   - Xóa bỏ các blendshape không dùng để tiết kiệm mảng float32 buffer trong GPU vertex shader.
3. **Nén Asset GLB:**
   - Sử dụng **Meshopt** hoặc **Draco Compression** để giảm kích thước file `.glb` xuống dưới **500 KB**.
   - Dùng ảnh Texture nén định dạng WebP hoặc KTX2/Basis Universal, kích thước tối đa `512x512`.

---

## 5. Quy chuẩn Dọn dẹp Bộ nhớ khi Unmount

Khi người dùng chuyển từ màn hình Hội thoại sang màn hình Cài đặt hoặc Lịch sử:

```typescript
export function disposeThreeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(object.material);
        }
      }
    }
  });

  renderer.dispose();
  renderer.forceContextLoss();
}

function disposeMaterial(material: THREE.Material) {
  material.dispose();
  for (const key of Object.keys(material)) {
    const value = (material as any)[key];
    if (value && typeof value === 'object' && 'minFilter' in value) {
      value.dispose(); // Dispose Texture
    }
  }
}
```
