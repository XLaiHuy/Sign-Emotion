# SignEmo — clip minh họa AI 45 giây

Trạng thái: prompt/storyboard và poster đã có; chưa tạo MP4 bằng công cụ video AI. Không dùng clip này làm bằng chứng inference hoặc độ chính xác. Không dùng ảnh/giọng người thật chưa đồng ý.

## Bối cảnh để đưa cho công cụ AI

SignEmo là web/PWA hỗ trợ tiếp cận hội thoại tiếng Việt, dành cho người trưởng thành khiếm thính và người đối thoại. Điện thoại hướng camera về người nói; một luồng micro tạo phụ đề tiếng Việt trên thiết bị. AI thử nghiệm kết hợp biểu cảm mặt và sắc thái câu chữ; khi thiếu nguồn hoặc mâu thuẫn, hiển thị “Chưa xác định”. Icon, màu câu và nhịp chỉ xuất hiện khi kết quả tổng hợp đủ điều kiện. Không dịch ngôn ngữ ký hiệu, không phát hiện ý định hay nguy hiểm; không tải hình/âm thanh lên server. Avatar nhỏ chỉ minh họa biểu cảm, mặc định tắt.

## Master prompt (dùng kèm tất cả shot)

Create a restrained, semi-realistic 3D product illustration film, exactly 45 seconds. Two fictional Vietnamese adults aged 24–30 sit across a bright quiet study table. Character A is a Deaf adult woman in a moss-green long-sleeved shirt and cream trousers, shoulder-length black hair. Character B is a man in a pale blue shirt, short black hair. Respectful ordinary conversation, no exaggerated acting or stereotypes. Keep their faces, clothing, body proportions, dark Android phone, cream table, window on the left and plants on the right identical in every shot. A holds the phone with the display facing herself and the rear camera toward B, without blocking her view of his face. Phone movements are small and physically credible. Do not show its front camera photographing B while its screen faces A.

SignEmo UI: ivory #F7F6F1, moss #426854, graphite #24322C; rounded white cards, a camera preview above large readable Vietnamese captions, one small expression indicator and one final contextual cue. Use exact Vietnamese text specified per shot. Add a persistent discreet “Clip minh họa AI” label. No scanning beams, face meshes, floating probability percentages, medical claims, alarms, screen flashes, fabricated performance numbers, imitation sign language or lip-sync avatar. Gentle camera movement, natural daylight, no rapid cuts. All meaning must remain understandable with sound off. Generate the scene WITHOUT baked-in text if your renderer cannot reproduce Vietnamese diacritics; the editor will composite the exact text as an overlay.

Output landscape 1920×1080 and a separately reframed portrait 1080×1920, 25 or 30 FPS. Keep captions in the central safe area, away from bottom system controls. Deliver silent visual shots separately from narration/dialogue. No music underneath spoken test phrases; no narration overlapping character speech. Do not show model downloads or permissions happening without the user's consent. The preparation line is an illustration, not a promise of instantaneous startup.

## Shot prompts, dialogue and overlays

| Time | Shot and action | Exact spoken audio | Exact on-screen text |
| --- | --- | --- | --- |
| 00–06 | Establishing three-quarter wide shot, both adults at the table. A pays attention to B's face, then gently raises the phone. Slow dolly in. | Narrator, calm Vietnamese female voice: “SignEmo giúp theo dõi hội thoại bằng phụ đề tiếng Việt.” | “SignEmo” / “Theo dõi hội thoại bằng phụ đề tiếng Việt.” / “Clip minh họa AI” |
| 06–12 | Over A's shoulder, phone shows the introduction, one CTA and poster. No device permission popup yet. The preparation line quietly disappears when ready. | Narrator: “Chuẩn bị trên thiết bị. Chỉ mở camera và micro khi bạn bắt đầu.” | “Vào hội thoại” / “Đang chuẩn bị trên thiết bị…” then “Camera và micro chỉ mở khi bạn bắt đầu.” |
| 12–18 | Back to both characters, A asks permission; B nods naturally. Close-up A taps consent, enters Conversation, taps Start, then approves one camera/micro permission dialog. Avoid rapid repeated taps. | A: “Mình dùng phụ đề và camera nhé?” B: “Được.” No narration. | “Người đối diện đồng ý dùng camera, micro.” / “Bắt đầu hội thoại” |
| 18–25 | Medium shot B smiles gently and speaks. Insert phone screen: partial text appears in ordinary graphite; it is replaced in place by the complete sentence. After final agreement, show warm ochre text, a small smile icon and “Vui · gợi ý”. A notices the subtle icon. | B: “Rất vui được gặp bạn.” A does not interrupt. | Partial “Rất vui được…” then final “Rất vui được gặp bạn.” in #7A5700. Label “Vui · gợi ý thử nghiệm”. A tiny phone-edge motion illustrates a short pulse; no shockwave. |
| 25–32 | B's expression softens, a small downward mouth/brow change; no theatrical crying. Same stable phone layout. Final caption blue, small sad icon. A remains attentive, no inference about his inner state. | B: “Hôm nay tôi hơi buồn.” | Partial “Hôm nay tôi…” then final “Hôm nay tôi hơi buồn.” in #245C8B. Label “Buồn · gợi ý thử nghiệm”. |
| 32–38 | B shows moderate conversational frustration, lightly furrows brows; no aggressive gesture or danger icon. Caption becomes brick-red only after final cue. | B: “Chuyện này làm tôi bực mình.” | Final “Chuyện này làm tôi bực mình.” in #9C3428. Label “Giận · gợi ý thử nghiệm”. |
| 38–42 | Clean neutral legend overlay, six non-neutral icon/name pairs plus neutral. Optional tiny expression avatar; no hand gestures. No fast flashing or rapid change among avatars. | Narrator: “Gợi ý có thể sai. Hãy hỏi lại khi chưa rõ.” | “Vui · Buồn · Giận · Ngạc nhiên · Sợ hãi · Khó chịu” / “Trung tính: không rung” / “Gợi ý có thể sai — hãy hỏi lại khi chưa rõ.” |
| 42–45 | A taps End. Camera preview becomes dark placeholder; show camera/micro-off status. Pull back to two adults continuing to face one another. End card. | Narrator: “SignEmo. Thử và góp ý cùng chúng mình.” | “Kết thúc hội thoại” then “Camera và micro đã tắt.” / “SignEmo” |

Each row is a separate generation prompt: prepend the master prompt and exact time range, append “Maintain continuity with the prior reference shot; do not add features, captions or narration beyond this row.” Keep a reference still for both characters/room between shots.

## Editing and export

- Composite Vietnamese overlays with Be Vietnam Pro. Do not trust generated letters. Match final text to the dialogue above; no freely rewritten transcript.
- Burn full dialogue/narration subtitles into both versions. Keep “Clip minh họa AI” throughout. Narration captions are visually separate from simulated app captions.
- Provide an SRT master from `DEMO_45S.vi.srt`; align voice timing while editing, never overlay simultaneous narration/dialogue.
- All expression colors also have text/icon. Fear is not an environmental alarm; no sound-event detector appears in this film.
- Export H.264/AAC MP4, `+faststart`, duration 45 seconds. Suggested local paths: `public/demo/signemo-16x9.mp4`, `public/demo/signemo-9x16.mp4`. Update `public/demo/manifest.json` with those exact same-origin paths only after watching both exports muted and verifying Vietnamese text. The app does not auto-play the clip on entry; it loads video bytes after the user's play gesture. The static poster/text remain usable offline when the clip has not been cached.
- Avatar GLB in the app is an authored illustration (~108 KiB), not an emotion model or sign-language translator.
