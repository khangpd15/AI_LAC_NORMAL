# KẾ HOẠCH TÍCH HỢP TOÀN DIỆN (PHASE 2 MERGE PLAN)
**Tài liệu:** `docs/merge/02-plan.md`  
**Vai trò:** Senior Frontend Architect & Tech Lead  
**Dự án Host (Repo A):** `AI_LAC_NORMAL`  
**Dự án Module (Repo B):** `PtosisCheck-1.1/frontend`  
**Nhánh làm việc:** `feat/merge-screening-frontend`  
**Trạng thái:** Chờ phê duyệt từ Product Owner / Tech Lead trước khi thực thi Giai đoạn 3  

---

## 1. CHIẾN LƯỢC ĐƯA CODE REPO B VÀO REPO A

### 1.1. So sánh các phương án chiến lược

| Phương án | Mô tả cơ chế | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **(a) Port thẳng thành Feature Module** | Copy các component của B vào thư mục `src/features/screening/ptosis` trong Repo A, viết lại import và config. | Rất nhanh, cấu trúc thư mục sạch, loại bỏ file thừa ngay từ đầu. | Mất lịch sử git commit của tác giả Repo B. |
| **(b) Merge Git History + Reorganize (Khuyến nghị)** | Thêm Repo B làm git remote, merge nhánh của B vào nhánh `feat/merge-screening-frontend` với cờ `--allow-unrelated-histories`, sau đó chuyển file vào đúng cấu trúc module. | **Giữ trọn 100% lịch sử commit và công sức đóng góp của tác giả Repo B**, tạo thành một monorepo thống nhất, dễ truy vết git blame sau này. | Cần thực hiện các bước di chuyển file cẩn thận trong commit merge. |
| **(c) Package / Micro-Frontend** | Đóng gói B thành npm package riêng hoặc iframe / Module Federation. | Cô lập hoàn toàn môi trường build. | Quá cồng kềnh đối với 2 dự án cùng stack React 19 + Vite 8; khó chia sẻ UI layout, header/footer và theme toggle. |

### 1.2. Quyết định lựa chọn: **Phương án (b) kết hợp (a)**
1. Tạo nhánh làm việc `feat/merge-screening-frontend` từ nhánh chính của Repo A.
2. Tích hợp lịch sử commit của Repo B thông qua Git Merge độc lập.
3. Tái cấu trúc mã nguồn của Repo B thành **Feature Module Sàng lọc Sụp mí (`src/features/screening/ptosis`)**, loại bỏ các thành phần layout riêng của B và cắm trực tiếp vào hệ thống Layout chung của Repo A.

---

## 2. CẤU TRÚC THƯ MỤC ĐÍCH TRONG REPO A

Cấu trúc thư mục được thiết kế theo mô hình **Domain-driven Feature Architecture** chuẩn mực của React, vừa bảo tồn trọn vẹn các tính năng hiện tại của Repo A, vừa tách bạch module sàng lọc lác/lé và sụp mí:

```
AI_LAC_NORMAL/
├── public/
│   ├── images/                      # Logo, iris_mascot, banner của Repo A (giữ nguyên)
│   ├── models/                      # Model AI onnx của Repo A (giữ nguyên)
│   └── logo-remi.svg                # Vector logo từ Repo B phục vụ badge bảo mật
├── src/
│   ├── api/                         # API client lõi của Repo A (giữ nguyên)
│   ├── assets/                      # Ảnh tĩnh
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppNavbar.jsx        # [SỬA] Thêm Dropdown "Sàng lọc" 2 cấp & Mobile Accordion
│   │   │   ├── appNavbar.css        # [SỬA] Tokens, styles cho dropdown menu, chevron, active
│   │   │   ├── AppFooter.jsx        # [SỬA] Cập nhật liên kết điều hướng mới
│   │   │   ├── SitePhoto.jsx        # Giữ nguyên
│   │   │   └── ErrorBoundary.jsx    # Giữ nguyên
│   │   ├── home/                    # [SỬA nhẹ link] Trang chủ RemiCare AI
│   │   ├── ExperienceVision/        # Giữ nguyên Trải nghiệm thị giác
│   │   ├── StrabismusSimulation/    # Giữ nguyên Mô phỏng AI Webcam
│   │   └── about/                   # Giữ nguyên Trang Giới thiệu
│   ├── features/
│   │   └── screening/
│   │       ├── hub/                 # [MỚI] Trang Hub Sàng lọc /sang-loc
│   │       │   ├── ScreeningHubPage.jsx   # Thẻ chọn 2 phương pháp (Lác/lé vs Sụp mí)
│   │       │   └── screeningHub.css       # Giao diện thẻ bài chuẩn tokens A
│   │       ├── strabismus/          # [RESTRUCTURE] Chuyển từ src/components/binocular sang
│   │       │   ├── BinocularVisionScreening.jsx
│   │       │   ├── HirschbergStep.jsx
│   │       │   ├── HirschbergResultStep.jsx
│   │       │   ├── PositionCheck.jsx
│   │       │   ├── CoverTestStep.jsx
│   │       │   └── FinalScreeningResult.jsx
│   │       └── ptosis/              # [PORT TỪ REPO B] Module Sàng lọc Sụp mí (PtosisCheck)
│   │           ├── PtosisScreeningPage.tsx # Container chính (kế thừa FSM từ App.tsx của B)
│   │           ├── components/
│   │           │   ├── capture/
│   │           │   │   ├── PtosisCameraView.tsx # Đổi tên tránh trùng CameraView của A
│   │           │   │   ├── CaptureScreen.tsx
│   │           │   │   └── FileUploadZone.tsx
│   │           │   ├── result/
│   │           │   │   ├── ResultScreen.tsx
│   │           │   │   ├── TierCard.tsx
│   │           │   │   ├── AnnotatedCanvas.tsx
│   │           │   │   └── MeasurementDetails.tsx
│   │           │   └── common/
│   │           │       ├── ConsentDialog.tsx
│   │           │       └── QualityErrorModal.tsx
│   │           ├── hooks/
│   │           │   ├── useScreeningApi.ts
│   │           │   └── useImagePreValidation.ts
│   │           ├── types/
│   │           │   ├── api-contracts.ts
│   │           │   └── screening-state.ts
│   │           └── utils/
│   │               └── canvas-overlay-drawer.ts
│   ├── App.jsx                      # [SỬA] Tích hợp BrowserRouter, Routes, Route
│   ├── main.jsx                     # Entrypoint (bọc RouterProvider hoặc BrowserRouter)
│   ├── redesign.css                 # Bảng tokens chính
│   └── index.css                    # CSS toàn cục
├── .env.example                     # [SỬA] Thêm VITE_PTOSIS_BACKEND_URL
├── package.json                     # [SỬA] Thêm react-router-dom, lucide-react, tailwindcss...
├── tailwind.config.js               # [MỚI] Tích hợp Tailwind với preflight: false
├── postcss.config.js                # [MỚI] Cấu hình PostCSS cho Tailwind
├── tsconfig.json                    # [MỚI] Cấu hình TS cho các component .tsx của B
└── vite.config.js                   # [SỬA] Proxy chi tiết /api/v1/screening sang port 8000
```

---

## 3. ROUTE MAP: CHUYỂN ĐỔI TOÀN DIỆN

Hệ thống chuyển từ cơ chế chuyển tab state sang URL Routing chuẩn mực qua `react-router-dom`:

| Đường dẫn (URL) | Tên màn hình | Nguồn gốc mã nguồn | Mô tả hành vi & Quy tắc Active |
|---|---|---|---|
| `/` | **Trang chủ** | `src/components/home/HomePage.jsx` | Mặc định khi tải trang. Tab active: "Trang chủ". |
| `/trai-nghiem` | **Trải nghiệm góc nhìn** | `src/components/ExperienceVision/ExperienceVisionPage.jsx` | Fullscreen camera mô phỏng nhược thị. Tab active: "Trải nghiệm". |
| `/mo-phong` | **Mô phỏng lác lé** | `src/components/StrabismusSimulation/StrabismusSimulationPage.jsx` | AI Webcam live tracking. Tab active: "Mô phỏng lác lé". |
| `/sang-loc` | **Hub Sàng lọc thị lực** | `src/features/screening/hub/ScreeningHubPage.jsx` | **Trang Hub trung tâm** (Lựa chọn 4.3). Hiển thị 2 thẻ chọn: Sàng lọc Lác/Lé & Sàng lọc Sụp mí. Nút CTA "Sàng lọc ngay →" trên header trỏ tới đây. Nút "Sàng lọc" trên Header giữ trạng thái Active Pill. |
| `/sang-loc/lac-le` | **Sàng lọc Lác/Lé** | `src/features/screening/strabismus/BinocularVisionScreening.jsx` | Sàng lọc 2 mắt Hirschberg & Cover Test kèm audio Iris. Header "Sàng lọc" active pill, menu con dropdown mục 1 active. |
| `/sang-loc/sup-mi` | **Sàng lọc Sụp mí** | `src/features/screening/ptosis/PtosisScreeningPage.tsx` | Sàng lọc PtosisCheck (MRD-1, khe mi, Tier 1/2/3). Header "Sàng lọc" active pill, menu con dropdown mục 2 active. |
| `/gioi-thieu` | **Giới thiệu** | `src/components/about/AboutPage.jsx` | Sứ mệnh và công nghệ RemiCare. Tab active: "Giới thiệu". |
| `*` (Catch-all) | Không tìm thấy | Redirect tự động về `/` | Tránh màn hình trắng 404. |

---

## 4. DANH SÁCH FILE SẼ TẠO, SỬA, XOÁ VÀ LÝ DO

### 4.1. File Sửa đổi trong Repo A
1. `package.json`: Thêm các gói `react-router-dom`, `lucide-react`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`.
2. `vite.config.js`:
   - Giữ nguyên middleware `localTtsPlugin` (`/api/tts`).
   - Bổ sung cấu hình `server.proxy` chuyển hướng `/api/v1/screening` sang backend Ptosis local (`http://127.0.0.1:8000`).
3. `.env.example`: Thêm dòng `VITE_PTOSIS_BACKEND_URL=https://api.ptosis.remicare.id.vn`.
4. `src/App.jsx`:
   - Thay thế state `activeTab` bằng `<BrowserRouter>`, `<Routes>`, `<Route>`.
   - Bọc layout chuẩn: `<AppNavbar />`, `<main className="app-main">`, `<AppFooter />`.
   - Giữ nguyên `<ListeningProvider>` bao bọc để audio Iris hoạt động xuyên suốt.
5. `src/components/common/AppNavbar.jsx`:
   - Chuyển đổi nút "Sàng lọc" từ link đơn thành **Dropdown Menu 2 cấp**:
     - Desktop: Hover mở (với debounce 150ms chống giật nhấp nháy), Click/Enter/Space toggle, Phím mũi tên lên/xuống điều hướng, Esc đóng, Click outside đóng. Icon chevron xoay 180° khi mở.
     - Mobile: Accordion mở rộng ngay trong Navigation Drawer và Mobile Bottom Navigation.
     - Accessibility: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`, `role="menuitem"`.
   - Nút CTA "Sàng lọc ngay →": Trỏ link tới `/sang-loc` (Hub chọn phương pháp).
   - Kiểm tra active pill: Kích hoạt khi `location.pathname.startsWith('/sang-loc')`.
6. `src/components/common/appNavbar.css`:
   - Định nghĩa class `.navbar-dropdown-wrapper`, `.navbar-dropdown-menu`, `.navbar-dropdown-item`, `.dropdown-chevron`.
   - Áp dụng các token chuẩn của Repo A: border radius, shadow, background blur, dark mode tokens.
7. `src/components/common/AppFooter.jsx`:
   - Cập nhật các liên kết footer sang các route mới: `/`, `/trai-nghiem`, `/mo-phong`, `/sang-loc/lac-le`, `/sang-loc/sup-mi`, `/gioi-thieu`.
8. `src/components/home/HomePage.jsx`:
   - Cập nhật các nút gọi hàm `onStartScreening` chuyển sang điều hướng URL `/sang-loc` hoặc `/sang-loc/lac-le`.

### 4.2. File Tạo mới trong Repo A
1. `tailwind.config.js`: Cấu hình Tailwind với `corePlugins: { preflight: false }` và `darkMode: ['selector', '[data-theme="dark"]']`.
2. `postcss.config.js`: Tích hợp Tailwind và Autoprefixer vào pipeline Vite.
3. `tsconfig.json`: Cấu hình compiler cho TypeScript để biên dịch các file `.tsx` an toàn.
4. `src/features/screening/hub/ScreeningHubPage.jsx` & `screeningHub.css`: Giao diện trang Hub trung tâm `/sang-loc` với 2 thẻ trực quan chuẩn design token A.
5. `src/features/screening/ptosis/PtosisScreeningPage.tsx`: Container trang sàng lọc sụp mí chuyển thể từ `App.tsx` của Repo B, lược bỏ header/footer riêng của B và nhúng vào layout chuẩn của A.
6. Toàn bộ thư mục components, hooks, types, utils của B được đưa vào `src/features/screening/ptosis/`. Đổi tên `CameraView.tsx` thành `PtosisCameraView.tsx`.
7. `public/logo-remi.svg`: Đưa file SVG từ Repo B sang để phục vụ hiển thị biểu tượng khi cần.

### 4.3. File Loại bỏ (Không mang sang từ Repo B)
1. `PtosisCheck-1.1/frontend/src/App.tsx`: Đã được trích xuất logic vào `PtosisScreeningPage.tsx`.
2. `PtosisCheck-1.1/frontend/src/hooks/useTheme.ts` & `ThemeToggle.tsx`: Đã có Theme Toggle chuẩn của Repo A (`remicare-theme` trên `AppNavbar`).
3. `PtosisCheck-1.1/frontend/index.html`: Sử dụng `index.html` của Repo A làm chuẩn.
4. `PtosisCheck-1.1/frontend/vercel.json`: Không cần thiết cho repo chủ.

---

## 5. KẾ HOẠCH XỬ LÝ DEPENDENCY

| Package | Phiên bản | Vị trí | Lý do bổ sung | Rủi ro & Cách khắc phục |
|---|---|---|---|---|
| `react-router-dom` | `^7.18.4` (hoặc `^6.29.0`) | `dependencies` | Đáp ứng yêu cầu chuyển đổi hệ thống route `/sang-loc/lac-le`, `/sang-loc/sup-mi` theo quyết định của user. | **Thấp**. Peer-dependencies hỗ trợ React 19 hoàn hảo. |
| `lucide-react` | `^1.57.0` | `dependencies` | Cung cấp icon cho các component của module Ptosis (`ShieldCheck`, `AlertCircle`, `Camera`, `Upload`...). | **Không có**. Repo A không có thư viện icon bên ngoài nào gây trùng lặp. |
| `tailwindcss` | `^3.4.19` | `devDependencies` | Biên dịch các utility class trong các component của Repo B. | **Trung bình** (xung đột CSS reset). Khắc phục triệt để bằng `corePlugins: { preflight: false }`. |
| `postcss` | `^8.5.30` | `devDependencies` | Xử lý css qua Tailwind plugin. | Không có rủi ro. |
| `autoprefixer` | `^10.6.1` | `devDependencies` | Đảm bảo tương thích đa trình duyệt cho CSS. | Không có rủi ro. |
| `typescript` | `~6.0.2` | `devDependencies` | Hỗ trợ parse và typecheck các tệp `.ts`, `.tsx` của module B. | Không có rủi ro. Vite hỗ trợ TS sẵn. |
| `@types/node` | `^24.13.3` | `devDependencies` | Cung cấp type definitions cho môi trường Node/Vite. | Không có rủi ro. |

---

## 6. KẾ HOẠCH ĐỒNG BỘ GIAO DIỆN & DESIGN TOKENS (UI MAPPING)

Để đảm bảo toàn bộ giao diện của module Ptosis (Repo B) khoác lên mình ngôn ngữ thiết kế chuẩn của Repo A (nhất quán từ header, logo, màu sắc, phông chữ, dark mode):

### 6.1. Bảng chuyển đổi Class / Style từ B sang Tokens của A

| Thành phần giao diện của B | Class / Giá trị cũ trong Repo B | Token / Class chuẩn tương đương trong Repo A | Kết quả hiển thị |
|---|---|---|---|
| **Nền trang chính** | `bg-[#F9F8F2] dark:bg-[#071619]` | `var(--bg-page)` (`#F8F9FA` / Dark: `#0F172A`) | Đồng bộ với toàn bộ nền của Trang chủ và trang Giới thiệu của A. |
| **Nền thẻ Card / Modal** | `bg-white dark:bg-[#0D2327]` | `var(--bg-surface)` (`#FFFFFF` / Dark: `#1E293B`) | Thẻ card sáng sủa, dark mode chuẩn Slate Dark của A. |
| **Bề mặt phụ (Elevated / Table)** | `bg-[#E1F4F0] dark:bg-[#122D32]` | `var(--bg-elevated)` (`#E1F4F0` / Dark: `#293548`) | Pale Teal êm dịu, không chói mắt. |
| **Chữ tiêu đề chính** | `text-[#00545D] dark:text-[#F9F8F2]` | `var(--text-heading)` (`#00545D` / Dark: `#FFFFFF`) | Tiêu đề Deep Teal đậm nét, sắc sảo. |
| **Chữ nội dung thường** | `text-[#1E293B] dark:text-[#F1F5F9]` | `var(--text-main)` (`#132a2e` / Dark: `#F1F5F9`) | Độ tương phản cao, dễ đọc cho mọi lứa tuổi. |
| **Chữ mờ / Chú thích** | `text-[#267A78] dark:text-[#6FB4AF]` | `var(--text-muted)` (`#3a565c` / Dark: `#94A3B8`) | Chữ phụ êm dịu. |
| **Đường viền thẻ / ngăn cách** | `border-[#B8E8DF] dark:border-[#1A3F45]` | `var(--border-subtle)` (`rgba(0, 84, 93, 0.12)` / Dark: `#1E4650`) | Đường viền mảnh tinh tế. |
| **Nút hành động chính (Primary CTA)** | `bg-[#00AB9B] hover:bg-[#267A78]` | `linear-gradient(135deg, #00AB9B 0%, #087F78 100%)` | Nút bấm gradient phong cách RemiCare kèm bóng đổ phát sáng (`glow`). |
| **Phông chữ hiển thị** | `font-family: 'Inter'` | `font-family: var(--font-sans)` (`'Manrope', sans-serif`) | Thống nhất 100% phông chữ thương hiệu Manrope. |
| **Bo góc (Border Radius)** | `rounded-xl`, `rounded-2xl` | `var(--radius-md)` (14px/16px), `var(--radius-lg)` (20px/24px) | Bo tròn hiện đại, mềm mại. |
| **Cơ chế Dark Mode** | Phụ thuộc class `.dark` trên `<html>` | Selector `[data-theme='dark']` từ `AppNavbar` | Module B tự động đảo màu tức thì khi người dùng nhấn nút Moon/Sun trên Header của A. |

---

## 7. RỦI RO, KẾ HOẠCH ROLLBACK VÀ TIÊU CHÍ HOÀN THÀNH

### 7.1. Phân tích Rủi ro & Giải pháp phòng ngừa
1. **Rủi ro xung đột style (CSS Bleeding / Preflight)**:
   - *Nguy cơ:* Tailwind của B làm hỏng giao diện Trang chủ hoặc trang Mô phỏng của A.
   - *Phòng ngừa:* Tắt `preflight: false` trong `tailwind.config.js`; kiểm tra trực quan từng trang sau khi build.
2. **Rủi ro lỗi định tuyến khi người dùng F5 (Reload Page)**:
   - *Nguy cơ:* Trên production server, truy cập trực tiếp `/sang-loc/lac-le` có thể bị lỗi 404 nếu máy chủ không rewrite URL về `index.html`.
   - *Phòng ngừa:* Cấu hình Vite preview và hướng dẫn cấu hình rewrite Nginx/Vercel/Cloudflare trong tài liệu nghiệm thu.
3. **Rủi ro chiếm dụng Camera giữa các màn hình**:
   - *Nguy cơ:* Người dùng đang ở màn hình Sàng lọc lác/lé (đang bật camera) rồi bấm chuyển sang Sàng lọc sụp mí làm camera bị khóa (`NotReadableError`).
   - *Phòng ngừa:* Thiết lập cleanup function trong `useEffect` của cả 2 module: khi component unmount hoặc route thay đổi, bắt buộc gọi `stream.getTracks().forEach(track => track.stop())`.

### 7.2. Kế hoạch Rollback chi tiết
Mọi thay đổi được thực hiện độc quyền trên nhánh Git mới:
```bash
git checkout -b feat/merge-screening-frontend
```
Nếu xảy ra bất kỳ lỗi hồi quy nghiêm trọng nào không thể khắc phục:
- Chỉ cần quay về nhánh ban đầu: `git checkout main` (hoặc `git checkout fix/UI`).
- Code gốc của Repo A hoàn toàn nguyên vẹn và không bị ảnh hưởng.

### 7.3. Tiêu chí hoàn thành (Definition of Done - DoD)
- [ ] Nhánh `feat/merge-screening-frontend` được tạo từ nhánh chính của Repo A, lịch sử commit rõ ràng theo Conventional Commits.
- [ ] `npm run lint` (oxlint) chạy pass 100%, không phát sinh lỗi cú pháp.
- [ ] `npm test` chạy pass toàn bộ 76 test gốc của Repo A.
- [ ] `npm run build` tạo bundle thành công, không gặp lỗi TypeScript hoặc Vite asset resolve.
- [ ] Menu Dropdown "Sàng lọc" trên Header hoạt động hoàn hảo:
  - Mở khi hover và click, đóng khi click outside hoặc ấn `Esc`.
  - Hỗ trợ phím mũi tên lên/xuống và phím `Enter` chuẩn WCAG Accessibility.
  - Hiển thị đầy đủ 2 lựa chọn: Sàng lọc Lác/Lé và Sàng lọc Sụp mí với icon và mô tả.
  - Giữ trạng thái pill active khi đang ở bất kỳ route con nào của `/sang-loc/*`.
- [ ] Nút CTA "Sàng lọc ngay →" mở trang Hub `/sang-loc` với 2 thẻ lựa chọn trực quan.
- [ ] Chức năng Sàng lọc lác/lé (`/sang-loc/lac-le`): Giữ nguyên 100% tính năng Hirschberg, Cover Test, FaceMesh AI và audio Iris.
- [ ] Chức năng Sàng lọc sụp mí (`/sang-loc/sup-mi`): Hoạt động trơn tru từ chụp/tải ảnh, gọi API phân tích đến vẽ canvas và hiển thị bảng Tier/MRD-1.
- [ ] Dark Mode hoạt động đồng bộ trên toàn bộ các trang mới thông qua nút toggle của Header.
- [ ] Giao diện responsive mượt mà trên 4 kích thước: Mobile (375px), Tablet (768px), Laptop (1280px), Desktop (1920px).

---

**KẾT THÚC KẾ HOẠCH GIAI ĐOẠN 2.**  
Kính mời Product Owner / Tech Lead xem xét và duyệt kế hoạch trên để bắt đầu tiến hành **Giai đoạn 3 (Thực thi code từng bước)**!
