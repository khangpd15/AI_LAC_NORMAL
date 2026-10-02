# 👁️ TRẢI NGHIỆM GÓC NHÌN — Tài liệu các Giai đoạn

> **Module:** `ExperienceVision`  
> **Mục tiêu:** Giúp cha mẹ / người thân trải nghiệm trực tiếp trên camera realtime quá trình thay đổi thị giác khi trẻ bị lác và không được phát hiện / xử trí sớm.  
> **Thiết kế:** Fullscreen cinematic · Camera realtime · Voice-first · 7 giai đoạn cố định · Đúng 3 câu hỏi · Kết thúc → CTA sàng lọc

---

## 🗺️ Tổng quan hành trình

```
Màn hình bắt đầu
  [Bật camera] → [Bắt đầu]
       ↓
Giai đoạn 1 · Bình thường
       ↓
Giai đoạn 2 · Song thị (Nhìn đôi)
       ↓
Giai đoạn 3 · Nhìn mờ
       ↓
Giai đoạn 4 · Não thích nghi         ← 🧠 Câu hỏi 1
       ↓
Giai đoạn 5 · Một mắt ưu tiên ít hơn
       ↓
Giai đoạn 6 · Nhược thị              ← 🧠 Câu hỏi 2
       ↓
Giai đoạn 7 · Nhược thị nặng         ← 🧠 Câu hỏi 3
       ↓
Kết thúc — "Hiểu con hơn. Nhận biết sớm hơn."
       ↓
[🔎 Kiểm tra dấu hiệu lác cho trẻ →]
```

**Tổng câu hỏi phản chiếu:** đúng **3 câu** (tại giai đoạn 4, 6, 7)  
**Điều hướng:** Chỉ 2 nút — `[← Quay lại]` và `[Tiếp tục →]`  
**Quy trình mỗi giai đoạn:** Camera + Effect → Voice đọc → Voice hoàn tất → (Câu hỏi nếu có) → Bật nút Tiếp tục

---

## 🎬 Màn hình bắt đầu

**Bước 1 — Bật camera**

```
         TRẢI NGHIỆM GÓC NHÌN

"Bạn đã sẵn sàng trải nghiệm
 thế giới qua một góc nhìn khác?"

              📷

Camera sẽ được sử dụng để
tạo hiệu ứng thị giác realtime.

         [ Bật camera → ]
```

**Bước 2 — Khi camera đã bật**

```
      ● Camera Preview

         [ Bắt đầu → ]
```

> Camera chạy nền fullscreen. Backdrop trở nên trong suốt hơn để người dùng thấy preview.

---

## 📍 Giai đoạn 1 — Bình thường

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `1` |
| **Hiệu ứng canvas** | `normal` |
| **Câu hỏi** | ❌ Không |
| **Chỉ số HUD** | `1 • 7` |

**Lời chỉ dẫn ngắn:**
> Quan sát hình ảnh trước mắt bạn.

**Lời dẫn Voice AI:**
> *"Hãy nhìn vào khuôn mặt của bạn. Đây là cách hình ảnh bình thường được hai mắt cùng phối hợp để tạo thành một trải nghiệm nhìn thống nhất và sắc nét."*

**Mô tả hiệu ứng:**
- Camera mirror (selfie) sắc nét 100%
- Không có bất kỳ filter nào
- Người dùng thấy chính xác hình ảnh như mắt bình thường

**Sau voice:** Nút `Bắt đầu trải nghiệm →` sáng lên ngay.

---

## 📍 Giai đoạn 2 — Song thị

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `2` |
| **Phụ đề** | Nhìn đôi |
| **Hiệu ứng canvas** | `doubleVision` |
| **Câu hỏi** | ❌ Không |
| **Chỉ số HUD** | `2 • 7` |

**Lời chỉ dẫn ngắn:**
> Hình ảnh trước mắt đang bị tách làm hai.

**Lời dẫn Voice AI:**
> *"Khi hai mắt không cùng hướng nhìn, não nhận được hai hình ảnh không khớp nhau. Hình ảnh trước mắt bạn đang bị tách đôi."*

**Mô tả hiệu ứng — `doubleVision`:**
- Hai lần render stream camera, lệch nhau theo trục ngang
- Offset dao động theo sine wave: `26px + sin(t × 0.0025) × 12px`
- Mỗi lớp `globalAlpha = 0.65` tạo hiệu ứng bóng ma (ghost image)
- Lớp phụ lệch nhẹ về trục dọc `-4px` để tái hiện song thị không hoàn hảo

**Sau voice:** Nút `Tiếp tục →` sáng lên ngay.

---

## 📍 Giai đoạn 3 — Nhìn mờ

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `3` |
| **Phụ đề** | Mất độ nét chi tiết |
| **Hiệu ứng canvas** | `blur` |
| **Câu hỏi** | ❌ Không |
| **Chỉ số HUD** | `3 • 7` |

**Lời chỉ dẫn ngắn:**
> Các chi tiết và đường nét dần mất đi độ sắc nét.

**Lời dẫn Voice AI:**
> *"Khi tiêu điểm không chuẩn hoặc trục nhìn lệch, các chi tiết xung quanh bắt đầu mờ đi. Trẻ nhỏ thường không nhận ra điều này."*

**Mô tả hiệu ứng — `blur`:**
- CSS filter: `blur(11px) contrast(0.9)`
- Toàn bộ hình ảnh mất độ sắc nét
- Mô phỏng mắt không hội tụ được tiêu điểm chính xác

**Sau voice:** Nút `Tiếp tục →` sáng lên ngay.

---

## 📍 Giai đoạn 4 — Não thích nghi

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `4` |
| **Phụ đề** | Ức chế hình ảnh mắt lệch |
| **Hiệu ứng canvas** | `suppression` |
| **Câu hỏi** | ✅ **CÓ — Câu hỏi số 1** |
| **Chỉ số HUD** | `4 • 7` |

**Lời chỉ dẫn ngắn:**
> Não bộ tự động giảm bớt tín hiệu từ một mắt để tránh nhìn đôi.

**Lời dẫn Voice AI:**
> *"Để tránh cảm giác nhìn đôi khó chịu, não bộ tự động giảm chú ý đến một mắt. Tín hiệu từ mắt lệch bị mờ dần và ức chế."*

**Mô tả hiệu ứng — `suppression`:**
- Hình ảnh nền: `contrast(0.7) brightness(0.85)`
- Gradient ức chế lan từ trái sang phải, opacity dao động theo sine
- Màu gradient tối phủ dần nửa hình ảnh tương ứng mắt lệch

---

### 🧠 Câu hỏi phản chiếu 1

> **"Theo bạn, cơ chế não tự 'tắt bớt' hình ảnh này có chữa khỏi lác không?"**

| Lựa chọn | Kết quả |
|---|---|
| ✅ **Không, chỉ che giấu triệu chứng** | Đúng |
| ❌ Có, giúp mắt tự khỏi | Sai |

> 💡 *Đúng. Não chỉ tạm thời né tránh cảm giác khó chịu, nhưng hậu quả là mắt bị lệch sẽ ngày càng ít được sử dụng.*

---

## 📍 Giai đoạn 5 — Một mắt được ưu tiên

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `5` |
| **Phụ đề** | Mắt khỏe sáng rõ — Mắt yếu mờ dần |
| **Hiệu ứng canvas** | `oneEyePriority` |
| **Câu hỏi** | ❌ Không |
| **Chỉ số HUD** | `5 • 7` |

**Lời chỉ dẫn ngắn:**
> Chạm đổi mắt: Mắt khỏe (rõ) ⟷ Mắt yếu (mờ).

**Lời dẫn Voice AI:**
> *"Não bộ bắt đầu ưu tiên mắt khỏe hơn. Mắt còn lại vẫn nhìn thấy ánh sáng, nhưng thông tin gửi về não rất mờ nhạt và kém hiệu quả."*

**Thao tác trực quan người dùng (Ít chữ, nút to):**
- Nút `[ 👁️ MẮT KHỎE (Sáng rõ) ]`: Màn hình sáng nét 100%.
- Nút `[ 👁️‍🗨️ MẮT YẾU (Mờ nhạt) ]`: Màn hình mờ câm, nhạt màu.
- Dành cho phụ huynh chạm bấm đổi mắt xem ngay sự khác biệt mà không cần đọc nhiều chữ.

**Sau voice:** Nút `Tiếp tục →` sáng lên ngay.

---

## 📍 Giai đoạn 6 — Nhược thị

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `6` |
| **Phụ đề** | Đeo kính thường không hết mờ |
| **Hiệu ứng canvas** | `amblyopia` (Mờ nhược thị & Thử kính) |
| **Câu hỏi** | ✅ **CÓ — Câu hỏi số 2** |
| **Chỉ số HUD** | `6 • 7` |

**Lời chỉ dẫn ngắn:**
> Chạm thử nút "Đeo kính" xem hình ảnh thế nào.

**Lời dẫn Voice AI:**
> *"Nếu tình trạng này kéo dài trong những năm đầu đời, nhược thị có thể hình thành. Vấn đề nằm ở sự phát triển của hệ thống thị giác, không chỉ ở cấu trúc mắt."*

**Thao tác trực quan người dùng:**
- Nút to: `[ 👓 CHẠM THỬ "ĐEO KÍNH" ]`.
- Khi chạm: Gọng kính hiện lên trên camera, nhưng hình ảnh **VẪN MỜ**!
- Thông điệp ngắn gọn: *⚠️ Đeo kính vẫn mờ — Nhược thị cần chữa não trước 7–8 tuổi!*

---

### 🧠 Câu hỏi phản chiếu 2

> **"Thời điểm vàng để phục hồi nhược thị đạt hiệu quả tốt nhất ở trẻ là khi nào?"**

| Lựa chọn | Kết quả |
|---|---|
| ✅ **Trước 7–8 tuổi (giai đoạn não mềm dẻo)** | Đúng |
| ❌ Sau tuổi trưởng thành | Sai |

> 💡 *Chính xác! Trước 7–8 tuổi, não bộ có tính mềm dẻo thần kinh cao nhất để tập luyện phục hồi thị lực cho mắt yếu.*

---

## 📍 Giai đoạn 7 — Che mắt khỏe (AI nhận diện tự động)

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `7` |
| **Phụ đề** | Dơ tay che 1 mắt trước camera |
| **Hiệu ứng canvas** | `severeAmblyopia` (Mở 2 mắt = Sáng rõ · Che 1 mắt = Mờ đen) |
| **Câu hỏi** | ✅ **CÓ — Câu hỏi số 3** |
| **Chỉ số HUD** | `7 • 7` |

**Lời chỉ dẫn ngắn:**
> ✋ Dơ tay che một mắt trước camera: Màn hình sẽ mờ đen!

**Lời dẫn Voice AI:**
> *"Hãy tưởng tượng mắt bên trái hoặc bên phải của bạn đang có thị lực rất kém. Giờ hãy đưa tay lên che mắt khỏe mạnh. Hãy thử nhìn thế giới chỉ bằng mắt đang nhìn kém. Đây là một mô phỏng để giúp bạn hình dung khi thị lực của một mắt bị ảnh hưởng rất nghiêm trọng."*

**Cơ chế AI tự động & Thao tác cực đơn giản:**
1. **AI nhận diện đôi mắt (MediaPipe FaceMesh)**:
   - Bình thường (Mở 2 mắt): Màn hình sáng rõ 100% (`👁️ AI: MỞ 2 MẮT — SÁNG RÕ LẠI`).
   - Người dùng dơ tay lên che một mắt: AI phát hiện ngay lập tức ⭢ **MÀN HÌNH TỰ ĐỘNG CHUYỂN MỜ ĐEN!** (`✋ AI: ĐÃ CHE MẮT — MÀN HÌNH MỜ ĐEN`).
   - Bỏ tay xuống: Màn hình tự động sáng rõ lại tức thì!
2. **Nút chạm dự phòng**: Có nút `[ ✋ Chạm che mắt (Mờ đen) ]` / `[ 👁️ Chạm mở mắt (Sáng rõ) ]` hoặc chạm vào màn hình cho người không tiện dơ tay.

---

### 🧠 Câu hỏi phản chiếu 3

> **"Sau trải nghiệm này, điều gì là quan trọng nhất?"**

| Lựa chọn | |
|---|---|
| Phát hiện sớm | |
| Theo dõi dấu hiệu | |
| ⭐ **Cả hai** | Ưu tiên (isPreferred) |

> 💡 *Chính xác! Phát hiện sớm và chủ động theo dõi dấu hiệu ở trẻ giúp bảo vệ thị lực trọn đời cho con.*

---

## 🏁 Màn kết thúc

| Thuộc tính | Giá trị |
|---|---|
| **ID** | `8` |
| **Hiệu ứng canvas** | `normal` (trở lại bình thường) |
| **Câu hỏi** | ❌ Không |

**Voice AI tổng kết:**
> *"Bạn vừa trải nghiệm một mô phỏng. Mỗi người có thể có trải nghiệm thị giác khác nhau. Điều quan trọng là nhận biết dấu hiệu và kiểm tra thị lực cho trẻ khi cần thiết."*

**Giao diện kết thúc:**

```
      Hiểu con hơn.
      Nhận biết sớm hơn.

Mỗi đứa trẻ có một hành trình phát triển
thị giác duy nhất. Hãy chủ động sàng lọc
sớm để cùng bảo vệ đôi mắt sáng cho con.

  [ 🔎 Kiểm tra dấu hiệu lác cho trẻ → ]

         ↺ Trải nghiệm lại
```

**Hành động CTA:** Chuyển trực tiếp sang tab **Sàng lọc hai mắt** (`BinocularVisionScreening`).

---

## ⚙️ Kiến trúc kỹ thuật

```
getUserMedia()
    ↓
<video> (ẩn — nguồn stream)
    ↓
VisualEffectEngine.render() @ 60fps
    ↓
<canvas> fullscreen 100vw × 100vh
    ↓
HUD overlays:
  ├── Top Bar    → "N • 7" indicator + Voice pill
  ├── Middle Zone → Severe guidance + Question card
  └── Bottom Bar  → Stage caption + 2 nav buttons
```

### Các file chính

| File | Vai trò |
|---|---|
| [`storyData.js`](src/components/ExperienceVision/storyData.js) | Dữ liệu 7 giai đoạn + kết thúc |
| [`VisualEffectEngine.js`](src/components/ExperienceVision/VisualEffectEngine.js) | Render 6 hiệu ứng canvas realtime |
| [`CameraView.jsx`](src/components/ExperienceVision/CameraView.jsx) | Camera stream + canvas + fallback simulation |
| [`VoiceController.jsx`](src/components/ExperienceVision/VoiceController.jsx) | Voice-first lifecycle, audioService.speak() |
| [`ReflectionQuestion.jsx`](src/components/ExperienceVision/ReflectionQuestion.jsx) | Card câu hỏi phản chiếu — chỉ hiện sau voice |
| [`ExperienceVisionPage.jsx`](src/components/ExperienceVision/ExperienceVisionPage.jsx) | Điều phối toàn bộ trải nghiệm fullscreen |
| [`experienceVision.css`](src/components/ExperienceVision/experienceVision.css) | Stylesheet cinematic, zero dashboard |

### Quy tắc bất biến

| Quy tắc | Trạng thái |
|---|---|
| 100% xử lý cục bộ trên thiết bị | ✅ |
| Đúng 3 câu hỏi tại giai đoạn 4, 6, 7 | ✅ |
| Câu hỏi CHỈ hiện sau khi voice hoàn tất | ✅ |
| Không timeline list, không dashboard, không slider | ✅ |
| `BinocularVisionScreening` không bị can thiệp | ✅ |

---

*Tài liệu cập nhật: 02/10/2026*
