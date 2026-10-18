# Đuôi âm thanh và kiểm tra tài nguyên — 16/10/2026

## Quyết định phạm vi

Người dùng chọn **giữ dwell thích ứng hiện tại** (120/200/320 ms ở cấu hình 200 ms), không chuyển về dwell cố định. Người dùng bỏ hạng mục thu thập 5–10 video mặt/hiệu chỉnh từ các clip đó trong lượt này. Không diễn giải quyết định này thành bằng chứng đã calibration. Giữ reset ngay khi mất mặt, khóa kho 5 phút và PBKDF2 600.000 vòng.

## Harness A/B đuôi âm thanh

Chạy `npm run research:audio-clamping` sau khi năm fixture public đã có tại `output/evaluation/fleurs-samples.json`. Cần Python local `.venv/Scripts/python.exe` với NumPy, ONNX Runtime, Sherpa-ONNX; có thể chọn interpreter qua `SIGNEMO_RESEARCH_PYTHON`. Script không tự tải dependency, model hoặc dữ liệu.

- Kiểm tra SHA-256 của năm WAV, Silero và bốn artifact Gipformer trước suy luận.
- Silero Python dùng input 512 + context 64, recurrent state, ngưỡng 0,5. Sau đó **chính `UtteranceBuilder` TypeScript** chia cả hai nhánh, với pre-roll, 17 frame im lặng và giới hạn 94 frame như ứng dụng. Pad frame cuối được dùng chung; flush phần còn lại.
- A giữ PCM; B chỉ đặt 200 ms cuối về 0 nếu RMS thấp hơn `min(0,01; 1,5 × median RMS nền)`. Nền lấy từ frame không lời nói ngoài vùng đuôi đang thử; không dùng chính vùng thử làm sàn nhiễu. Thiếu quan sát nền thì không clamp. Đây là tham số nghiên cứu.
- Giải mã tuần tự bằng Gipformer reference CPU, đổi thứ tự A/B giữa các đoạn. Không loại lặp, viết lại hoặc bỏ hypothesis khi tính điểm.
- Báo WER/CER, substitution/insertion/deletion, deletion rate và proxy mất từ cuối cho từng clip. Proxy cuối là ba từ tham chiếu cuối của toàn clip; **chưa phải căn thời gian từng từ ở mọi biên VAD**. Insertion không tự chứng minh hallucination.
- Transcript public trung gian chỉ nằm trong thư mục nghiên cứu local. Báo cáo tổng hợp không chứa transcript; không mount thư mục phép thử này lên container public. Không sửa audio capture sản phẩm.

Kết quả A/B: **5 clip, 19 đoạn, 150 từ tham chiếu; clamp 3 đoạn**. Cả hai nhánh có WER **10,67%**, CER **5,91%**, 1 deletion (**0,67%**), 2 insertion; proxy deletion ba từ cuối là 0 ở cả hai. Không thấy lợi ích nên **không promote**, giữ PCM nguyên bản. Đây là smoke trên năm mẫu public, không đánh giá giọng vùng miền, micro thật hoặc độ chính xác tổng quát. Thời gian Python không thay benchmark browser.

Artifact: `output/research-evaluation/audio-clamping/summary.json`. Regression: `npx --offline vitest run scripts/audio-clamping.test.mjs`, cũng được chạy trong `npm test`; kiểm tra mất phủ định, lặp cố ý, Unicode, proxy từ cuối, giới hạn clamp, không sửa PCM nguồn và không clamp khi thiếu sàn nhiễu.

## Smoke tài nguyên trước soak

Đã mở container **local riêng** từ image v19, cổng 8090, với fixture NASA public-domain và FLEURS CC-BY-4.0. Container public 8080 không nhận fixture. `browser-pipeline-30min-benchmark.js` bổ sung CDP heap/DOM mỗi phút, số phần tử DOM gắn vào document, số câu final và tất cả AudioContext ứng dụng.

Lượt 120 giây trên v19 thực sự chạy classifier, ASR partial/final, text và fusion; 0 pageerror và 0 request ngoài origin hoặc khác GET trong quan sát. **Teardown không đạt**: worker và media track về 0 nhưng còn **1 AudioContext ứng dụng**. Báo cáo giữ tại `output/research-evaluation/pipeline-smoke-v19-context-failure.json`.

Đã xác định context còn lại thuộc âm phản hồi của `useHaptics`: `cancel()` chỉ dừng oscillator/timer, còn context chỉ đóng khi unmount. Bổ sung `release()` đóng context khi kết thúc/hủy/lỗi phiên, pagehide/chuyển nền, tắt âm hoặc đổi sang chế độ không dùng âm. Resume đến muộn không được khôi phục phát âm; lần bấm mới tạo context mới. Không thay model/threshold/fusion, không bật tone.

**Chưa coi sửa source là nghiệm thu soak.** Cần build image mới, chạy smoke xác nhận context về 0 rồi mới chạy 30 phút. Heap CDP là main renderer, không bao gồm tổng worker/WASM/VRAM. Node detached có thể chờ GC; không ép GC và không gọi kết quả là “zero-leak”. Clock drift của nguồn audio ảo đã xuất hiện trong smoke v19, nên latency delivery đó không dùng nghiệm thu micro thật.

## Đóng context và worker sau Finish

Smoke v20 đã xác nhận AudioContext ứng dụng về **0**, worker/track về 0 sau pagehide. Tuy nhiên đo riêng ngay sau Finish thấy **3 worker chuẩn bị**: source tự warm lại ASR/VAD/mặt khi về idle. Đây là tài nguyên của lần chuẩn bị tiếp theo, không phải bằng chứng worker phiên cũ rò rỉ. Báo cáo gốc: `pipeline-smoke-v20-audio-fixed.json`; gate cũ chỉ xét pagehide nên không dùng cờ đó thay cho nghiệm thu Finish.

Người dùng đã chọn **giải phóng hết; bấm chuẩn bị khi dùng tiếp**. Source bổ sung trạng thái dừng tự chuẩn bị sau Finish/hủy/khi phiên lỗi về idle và nút **“Chuẩn bị phiên mới”**. Không xin quyền thiết bị ở nút chuẩn bị; Start chỉ bật khi AI đã chuẩn bị lại. Tone tùy chọn được tắt/giải phóng khi kết thúc, tránh giữ lựa chọn “bật” trong khi runtime đã bị hủy làm phiên mới không thể bắt đầu. Chuẩn bị lần đầu ở trang giới thiệu vẫn giữ nguyên.

Regression khởi động nay mô phỏng VAD flush và kiểm tra Finish không dựa vào unmount: mọi worker cũ đã terminate, không tự tạo worker mới sau khi chờ, chỉ tạo lại sau bấm chuẩn bị và tổng số lần xin thiết bị vẫn là 1. Báo cáo soak mới tách `afterFinish`/`finishTeardownPassed` khỏi pagehide và cleanup fixture; wrapper bắt buộc cả ba gate.

Lệnh: `node scripts/browser-pipeline-soak.mjs http://127.0.0.1:8091/ 120` (smoke), `1800` (soak). Dùng container local với đúng image sản phẩm và mount fixture public riêng. Wrapper sở hữu browser CLI, đóng browser trong finally, lưu báo cáo `pipeline-soak-<seconds>s.json`. Sampler OS bổ sung `scripts/sample-browser-memory.ps1 -Session pipeline-soak -Seconds 1800`: chỉ lấy tổng private committed bytes/working sets của PID thuộc browser đó; không bao gồm VRAM và không đồng nghĩa RAM vật lý. Lịch lấy mẫu đã trừ thời gian chạy CLI để không cộng dồn khoảng 8 giây mỗi phút.
