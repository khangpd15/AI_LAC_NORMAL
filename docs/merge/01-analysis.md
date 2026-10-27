# BÁO CÁO PHÂN TÍCH GIAI ĐOẠN 1: TÍCH HỢP FRONTEND REMICARE
**Tài liệu:** `docs/merge/01-analysis.md`  
**Vai trò:** Senior Frontend Architect & Tech Lead  
**Thời gian lập:** 2026-10-27  
**Trạng thái:** Hoàn thành Giai đoạn 1 — Chờ xác nhận từ Product Owner / Tech Lead để tiến hành Giai đoạn 2  

---

## 1. TỔNG QUAN HAI DỰ ÁN

- **Repo A – Host / Source of Truth:** `AI_LAC_NORMAL` (`d:\Documents\FPT_Education\FA26\EXE101\New\strabismus\FRONTEND\AI_LAC_NORMAL`)
  - **Sản phẩm:** **RemiCare AI – Nền tảng Chăm sóc Thị giác Toàn diện**.
  - **Chức năng hiện hữu:**
    1. Trang chủ (Landing page phong cách ECOKA hiện đại, audio Iris đồng hành).
    2. Trải nghiệm góc nhìn thị giác trẻ nhược thị (`ExperienceVisionPage`).
    3. Mô phỏng mắt lác lé bằng AI Webcam thời gian thực (`StrabismusSimulationPage`).
    4. Sàng lọc thị giác hai mắt lâm sàng (`BinocularVisionScreening` – Hirschberg + Digital Cover Test + MediaPipe + ONNX model + Trình phát audio Iris).
    5. Trang giới thiệu sứ mệnh & công nghệ cộng đồng (`AboutPage`).
  - **Hệ thống điều hướng:** Header sticky, Sidebar Drawer trượt trái, Mobile Bottom Navigation bar ghim cạnh dưới, Dark/Light Theme toggle (`remicare-theme`).

- **Repo B – Module tích hợp:** `PtosisCheck-1.1/frontend` (`d:\Documents\FPT_Education\FA26\EXE101\New\PtosisCheck-1.1\frontend`)
  - **Sản phẩm thực tế:** **RemiCare PtosisCheck – Hệ thống Sàng lọc Hình thái học Mi mắt (Sụp mí)**.
  - **Chức năng hiện hữu:**
    1. Hộp thoại cam kết quyền riêng tư & bảo vệ dữ liệu y tế phi can thiệp (`ConsentDialog`).
    2. Nạp ảnh mi mắt qua Webcam trực tiếp hoặc Upload tệp (`CameraView`, `FileUploadZone`), hỗ trợ 2 chế độ ảnh: Toàn mặt (`fullface`) hoặc Cận cảnh hai mắt (`eyes_crop`).
    3. Tiền kiểm định chất lượng ảnh client-side (`useImagePreValidation`).
    4. Kết nối API Backend FastAPI (`POST /api/v1/screening/analyze`) theo kiến trúc Zero-Retention RAM.
    5. Trực quan hóa kết quả chi tiết: Bảng phân hạng mức độ sụp mí (`TierCard` – Tier 1/2/3), Canvas tương tác vẽ landmark mí mắt & viền giác mạc (`AnnotatedCanvas`), Bảng số đo mm lâm sàng MRD-1 & Palpebral Fissure (`MeasurementDetails`).
    6. Xử lý lỗi từ chối ảnh y tế (`QualityErrorModal`).

---

## 2. CHI TIẾT TECH STACK & CẤU TRÚC (MỤC 3.1)

| Hạng mục | Repo A (`AI_LAC_NORMAL`) | Repo B (`PtosisCheck-1.1/frontend`) | Đánh giá kiến trúc |
|---|---|---|---|
| **Framework & Core** | React `^19.2.8`, `react-dom` `^19.2.8` | React `^19.2.8`, `react-dom` `^19.2.8` | **Đồng nhất hoàn hảo**. Cùng phiên bản React 19 mới nhất. Không có xung đột core runtime. |
| **Ngôn ngữ** | JavaScript (ESM, `.js`, `.jsx`), không có TypeScript config | TypeScript (`~6.0.2`, `.ts`, `.tsx`, cấu hình đa tầng `tsconfig.app.json`, `tsconfig.test.json`, `tsconfig.node.json`) | Repo A chưa có `tsconfig.json`. Cần bổ sung cấu hình TS vào Repo A để Vite biên dịch `.tsx` của B mượt mà và an toàn typecheck. |
| **Package Manager** | npm (sử dụng `package-lock.json`) | npm (sử dụng `package-lock.json`) | Đồng nhất npm. |
| **Build Tool** | Vite `^8.3.0` (`vite.config.js`) tích hợp plugin `@vitejs/plugin-react` `^6.1.1` và custom plugin `localTtsPlugin` (proxy `/api/tts` sang Google TTS) | Vite `^8.3.0` (`vite.config.ts`) với proxy `/api` sang `http://127.0.0.1:8000` | Cùng Vite 8. Cần chú ý quy tắc proxy trong `vite.config.js` để tránh xung đột giữa `/api/tts` của A và `/api/v1/screening` của B. |
| **Routing** | State-based navigation qua `activeTab` ('home' \| 'experience' \| 'simulation' \| 'screening' \| 'about') trong `App.jsx`. Chưa có thư viện router. | Finite State Machine qua `currentStep` ('CONSENT' \| 'READY_TO_CAPTURE' \| 'ANALYZING' \| 'RESULT' \| 'ERROR') trong `App.tsx`. Chưa có router. | Cả hai đều chưa có `react-router-dom`. Để hỗ trợ deep linking (`/sang-loc/lac-le`, `/sang-loc/sup-mi`, redirect `/sang-loc`), cần tích hợp bộ định tuyến đồng bộ URL. |
| **State Management** | React Local State (`useState`, `useRef`, `useCallback`) + React Context (`ListeningContext` quản lý audio Iris) | React Local State (`useState`, `useCallback`) | Rất tinh gọn, không dùng Redux/Zustand cồng kềnh, dễ dàng cô lập state module. |
| **Data Fetching** | Native `fetch` với custom `apiClient` (`src/api/client.js`) có deduplication, timeout AbortSignal, logging hiệu năng | Native `fetch` gói trong custom hook `useScreeningApi.ts` (`POST /api/v1/screening/analyze`, `GET /api/v1/config/thresholds`) | Dễ dàng chuẩn hóa hook của B theo `apiClient` của A hoặc giữ độc lập hook. |
| **i18n / Ngôn ngữ** | Tiếng Việt y tế & trợ lý Iris hardcoded trong component và file nội dung | Tiếng Việt y tế chuyên môn theo nguyên tắc G4 (không dùng từ ngữ cấm) | Cả 2 đều dùng 100% tiếng Việt chuẩn mực y khoa, không xung đột ngữ nghĩa. |
| **CSS & Styling** | Pure CSS3 + Design Tokens CSS Variables (`redesign.css`, `index.css`, `appNavbar.css`, `appFooter.css`, `homePage.css`, `mobile.css`). Không dùng Tailwind. | Tailwind CSS v3 (`^3.4.19`, `postcss`: `^8.5.30`, `autoprefixer`: `^10.6.1`) với cấu hình palette `remi.*` trong `tailwind.config.js` | **Điểm xung đột then chốt**. Cần tích hợp Tailwind vào A nhưng TẮT Tailwind Preflight (`preflight: false`) để tránh phá vỡ giao diện Repo A. |
| **Icon Library** | Custom Inline SVG Components (`HomeIcons.jsx`, `ListeningExperience.jsx`) | `lucide-react` (`^1.57.0`) | Bổ sung `lucide-react` vào Repo A cho các component của B. Riêng Header của A sẽ dùng SVG đồng bộ với hệ icon hiện có. |
| **Typography / Font** | `Manrope` (300, 400, 600, 700) + `JetBrains Mono` | `Inter` (300..800) | Chuẩn hóa toàn bộ typography của module B sang font `Manrope` của Repo A để đảm bảo visual harmony. |
| **AI / Computer Vision** | MediaPipe FaceMesh (CDN script) + `onnxruntime-web` (`^1.30.0`) + client CV services (`strabismusEngine`, `eyeCoverDetector`) | Client: Pre-validation canvas & drawing overlay 2D (`canvas-overlay-drawer.ts`); AI Backend: FastAPI | Không xung đột. Client của B chỉ vẽ canvas 2D và kiểm tra tệp sơ bộ, không xung đột với ONNX hay MediaPipe của A. |
| **Testing** | Node.js native test runner (`node --test scripts/*.test.js`) — **76/76 tests pass** | Vitest `^5.0.4` + `@testing-library/react` + `jsdom` — **31/31 tests pass** | Giữ nguyên bộ test gốc của cả 2 bên. |
| **Linter** | `oxlint` `^1.81.0` (0 lỗi, 9 warnings) | `oxlint` `^1.81.0` (0 lỗi, 1 warning) | Cùng sử dụng linter oxlint tốc độ cao. |
| **Biến môi trường** | `VITE_AI_BACKEND_URL`, `VITE_HIRSCHBERG_BACKEND_URL`, `VITE_COVER_TEST_BACKEND_URL` | `VITE_API_BASE_URL` | Bổ sung `VITE_PTOSIS_BACKEND_URL` vào `.env.example` của Repo A để tách biệt độc lập service. |

---

## 3. BẢNG SO SÁNH VÀ XỬ LÝ XUNG ĐỘT (MỤC 3.2)

| Hạng mục | Repo A | Repo B | Mức độ | Hướng xử lý đề xuất |
|---|---|---|:---:|---|
| **Tailwind Preflight vs Plain CSS của A** | Plain CSS (`index.css`, `redesign.css` reset toàn cục) | Tailwind CSS v3 tự động chèn `@tailwind base` (Preflight reset) | **CAO** | **Tắt hoàn toàn `preflight` của Tailwind** trong `tailwind.config.js`: `corePlugins: { preflight: false }`. Chỉ cho phép Tailwind generate utility classes (`text-*`, `bg-*`, `flex`, `grid`...), ngăn chặn tuyệt đối việc ghi đè margin/padding/heading tags của Repo A. |
| **Dark Theme Mechanism** | Dùng attribute `data-theme="dark"` trên thẻ `<html>` và biến lưu trữ `localStorage.getItem('remicare-theme')` | Dùng class `.dark` trên thẻ `<html>` và hook `useTheme.ts` | **CAO** | Chuẩn hóa: Sửa `tailwind.config.js` để hỗ trợ dark mode qua selector: `darkMode: ['selector', '[data-theme="dark"]']`. Đồng thời loại bỏ `useTheme.ts` và component `ThemeToggle` riêng của B, kế thừa 100% theme toggle và trạng thái dark của `AppNavbar` trong Repo A. |
| **Trùng tên Component `CameraView`** | `src/components/CameraView.jsx` (dành cho Hirschberg/Cover) và `src/components/ExperienceVision/CameraView.jsx` | `src/components/capture/CameraView.tsx` (dành cho Ptosis) | **TRUNG BÌNH** | Đặt tên theo feature domain hoặc namespace: di chuyển component của B vào thư mục `src/features/screening/ptosis/components/PtosisCameraView.tsx` để triệt tiêu mọi khả năng xung đột import. |
| **Vite Proxy & API Endpoints** | Có custom middleware `localTtsPlugin` bắt route `/api/tts` | Proxy toàn bộ prefix `/api` sang `http://127.0.0.1:8000` | **TRUNG BÌNH** | Trong `vite.config.js` của Repo A: Đặt middleware `localTtsPlugin` trước, đồng thời proxy cụ thể `/api/v1/screening` sang backend của Ptosis (port 8000) thay vì proxy rộng toàn bộ `/api`. |
| **TypeScript trong môi trường JS của A** | Repo A dùng JavaScript thuần | Repo B dùng TypeScript (`.ts`, `.tsx`, types) | **THẤP** | Vite hỗ trợ parse và transpile JSX lẫn TSX bằng esbuild mà không cần thêm loader. Chúng ta thêm file `tsconfig.json` và `@types/node` vào Repo A để hỗ trợ IDE intellisense và type-checking mà không bắt buộc refactor code JS hiện có của A. |
| **Trùng tên Assets (`public/`)** | Có `favicon.svg`, `icons.svg`, `logo.jpg` | Có `favicon.svg`, `icons.svg`, `logo-remi.svg`, `logo-document-title.svg` | **THẤP** | Giữ nguyên favicon và logo của Repo A làm chuẩn. Đưa `logo-remi.svg` của B vào làm tài nguyên bổ trợ nếu cần hiển thị biểu tượng bảo mật, không ghi đè `favicon.svg` hay `icons.svg` của A. |
| **Icon Dependencies** | Handcrafted SVG | `lucide-react` | **THẤP** | Cài thêm dependency `lucide-react` vào Repo A. Các icon trong component của B tiếp tục hoạt động ổn định. |

---

## 4. PHÂN TÍCH CHI TIẾT REPO B (MỤC 3.3)

### 4.1. Bản chất sản phẩm & Chức năng thực tế
Mã nguồn thực tế của Repo B là **RemiCare PtosisCheck** (Sàng lọc Hình thái học Mi mắt / Sụp mí), không phải lác lé. Hệ thống hoạt động theo quy trình 5 bước:
1. **Cam kết & Thỏa thuận (`ConsentDialog.tsx`)**: Người dùng xác nhận hiểu rõ tính chất phi can thiệp y tế (FR-029/G4) và đồng ý xử lý ảnh tạm thời trong RAM.
2. **Thu nhận ảnh (`CaptureScreen.tsx`)**:
   - Chụp qua webcam thời gian thực (`CameraView.tsx`) với khung căn chỉnh khuôn mặt hình oval và hướng dẫn khoảng cách 40-50 cm.
   - Hoặc tải tệp ảnh từ thiết bị (`FileUploadZone.tsx`) với tính năng kéo thả (drag & drop).
   - Lựa chọn chế độ ảnh: Ảnh toàn khuôn mặt (`fullface`) hoặc ảnh chụp cận cảnh hai mắt (`eyes_crop`).
   - Kiểm tra tiền hợp lệ client-side (`useImagePreValidation.ts`): kiểm tra kích thước file (tối đa 10 MB), tỷ lệ khung hình, định dạng (JPEG, PNG, WebP).
3. **Phân tích hình thái (`useScreeningApi.ts`)**:
   - Gửi ảnh qua `POST /api/v1/screening/analyze` dưới dạng `multipart/form-data`.
   - Hiển thị spinner và trạng thái phân tích real-time.
4. **Trực quan hóa kết quả (`ResultScreen.tsx`)**:
   - `TierCard.tsx`: Phân loại kết quả thành 3 cấp độ:
     - **Tier 1 (Bình thường)**: Không phát hiện dấu hiệu sụp mi đáng kể.
     - **Tier 2 (Nghi ngờ sụp mi nhẹ)**: Cần theo dõi hoặc tham vấn bác sĩ.
     - **Tier 3 (Sụp mi trung bình đến nặng)**: Khuyến nghị thăm khám chuyên khoa mắt.
   - `AnnotatedCanvas.tsx`: Canvas 2D vẽ đè landmark mí trên, mí dưới, tâm đồng tử và viền rìa giác mạc (Iris Limbus Contour). Người dùng có thể zoom in, zoom out, bật/tắt từng lớp hiển thị.
   - `MeasurementDetails.tsx`: Trình bày chi tiết các chỉ số đo đạc vật lý: MRD-1 (Khoảng cách phản xạ bờ mi), Chiều cao khe mi (Palpebral Fissure Height), cảnh báo fallback về tâm mống mắt nếu ánh phản xạ giác mạc bị che khuất.
5. **Kiểm soát chất lượng y tế (`QualityErrorModal.tsx`)**:
   - Bắt mã lỗi HTTP 422 từ backend với payload `QualityRejection`.
   - Hiển thị lý do từ chối: mắt nhắm, ảnh quá mờ, góc đầu nghiêng quá mức, thiếu sáng, hoặc không tìm thấy khuôn mặt, kèm ảnh minh họa và nút chụp lại.

### 4.2. Quyền trình duyệt & Cách xử lý
- **Quyền Camera (`navigator.mediaDevices.getUserMedia`)**:
  - Yêu cầu cấu hình video `ideal: 1280x720`.
  - Có cơ chế bắt lỗi chi tiết: `NotAllowedError` (người dùng từ chối cấp quyền), `NotFoundError` (không tìm thấy thiết bị), `NotReadableError` (camera đang bị ứng dụng khác chiếm dụng).
  - Tự động hiển thị fallback thông báo thân thiện và nút chuyển sang tải tệp ảnh từ máy tính/điện thoại.
- **Quyền Microphone / Audio**: Repo B không sử dụng microphone và không phát audio.

### 4.3. Phân tách Module độc lập vs Thành phần gắn chặt với Layout
- **Thành phần gắn chặt với layout riêng của B (CẦN LOẠI BỎ KHI MERGE)**:
  - `<header>` riêng trong `App.tsx` (dòng 98–155): Chứa logo `logo-remi.svg`, badge "Zero-Retention RAM", nút `ThemeToggle` riêng của B.
  - `<footer>` riêng trong `App.tsx` (dòng 215–229): Chứa thông cáo an toàn phi can thiệp y tế và disclaimer GDPR/Nghị định 13.
  - Vỏ bọc bao ngoài `min-h-screen bg-[#F9F8F2] dark:bg-[#071619]...` (dòng 96).
- **Thành phần độc lập (ĐƯỢC ĐÓNG GÓI THÀNH FEATURE MODULE)**:
  - Toàn bộ logic FSM sàng lọc mi mắt.
  - Thư mục `components/capture` (`CaptureScreen`, `PtosisCameraView`, `FileUploadZone`).
  - Thư mục `components/result` (`ResultScreen`, `TierCard`, `AnnotatedCanvas`, `MeasurementDetails`).
  - Thư mục `components/common` (`ConsentDialog`, `QualityErrorModal`).
  - Hooks `useScreeningApi.ts`, `useImagePreValidation.ts`.
  - Types `api-contracts.ts`, `screening-state.ts`.
  - Utils `canvas-overlay-drawer.ts`.

---

## 5. DESIGN SYSTEM CỦA REPO A (TRÍCH XUẤT TỪ CODE THỰC TẾ) (MỤC 3.4)

Trích xuất trực tiếp từ các file nguồn của Repo A:
- `AI_LAC_NORMAL/src/components/common/AppNavbar.jsx`
- `AI_LAC_NORMAL/src/components/common/appNavbar.css`
- `AI_LAC_NORMAL/src/redesign.css`
- `AI_LAC_NORMAL/src/index.css`
- `AI_LAC_NORMAL/public/images/logo.jpg` & `public/logo-remi.svg` (giá trị RGB vector)

### 5.1. Bảng Design Tokens chuẩn trích xuất từ Code Header & Logo

| Tên Token / Thành phần | Giá trị Light Mode | Giá trị Dark Mode | Định dạng lưu trữ | Vị trí định nghĩa trong code Repo A |
|---|---|---|---|---|
| **Logo Image** | `/images/logo.jpg` | `/images/logo.jpg` | File JPG | `AppNavbar.jsx:170`, `index.html:6` |
| **Brand Primary (Mint)** | `#00AB9B` | `#00AB9B` | CSS Var `--color-mint` | `redesign.css:3`, `index.css:8`, `appNavbar.css:167` |
| **Brand Primary Dark (Deep Teal)** | `#00545D` | `#FFFFFF` | CSS Var `--color-deep-teal` | `redesign.css:4, 53`, `index.css:9`, `appNavbar.css:91` |
| **Main Background (Warm White / Slate)** | `#F8F9FA` (`#F9F8F2`) | `#0F172A` | CSS Var `--bg-page` | `redesign.css:11, 42`, `index.css:24` |
| **Card / Surface Background** | `#FFFFFF` | `#1E293B` | CSS Var `--bg-surface` | `redesign.css:12, 43`, `index.css:25`, `appNavbar.css:220` |
| **Elevated Surface (Pale Teal / Dark Teal)** | `#E1F4F0` | `#293548` | CSS Var `--bg-elevated` | `redesign.css:14, 45`, `index.css:27`, `appNavbar.css:131` |
| **Soft Mint (Border UI)** | `#B8E8DF` | `#B8E8DF` | CSS Var `--color-soft-mint` | `redesign.css:6`, `index.css:12`, `appNavbar.css:133` |
| **Deep Green (Interactive Hover)** | `#267A78` | `#B8E8DF` | CSS Var `--color-deep-green` | `redesign.css:8, 54`, `index.css:14`, `redesign.css:94` |
| **Warm Coral (Alert / Accent)** | `#F28C7B` | `#F28C7B` | CSS Var `--color-warm-coral` | `redesign.css:9`, `index.css:16` |
| **Soft Amber (Warning / Badge)** | `#F2C56D` | `#F2C56D` | CSS Var `--color-soft-amber` | `index.css:17` |
| **Text Heading ("RemiCare AI")** | `#00545D` (hoặc `#0F172A`) | `#FFFFFF` | CSS Var `--text-heading` | `redesign.css:16, 47`, `appNavbar.css:84` |
| **Text Tagline ("AI CHĂM SÓC MẮT")** | `#00545D` / `#3a565c` | `#94A3B8` | CSS Var `--text-muted` | `appNavbar.css:91`, `redesign.css:73` |
| **Text Main Body** | `#132a2e` | `#F1F5F9` | CSS Var `--text-main` | `redesign.css:15, 46`, `index.css:34` |
| **Text Muted (Menu Link thường)** | `#64748B` / `#3a565c` | `#94A3B8` | CSS Var `--text-muted` | `appNavbar.css:120`, `redesign.css:76` |
| **Header Background** | `rgba(255, 255, 255, 0.95)` | `rgba(15, 23, 42, 0.94)` | CSS Property | `appNavbar.css:16, 26` |
| **Header Backdrop Filter** | `blur(14px)` | `blur(14px)` | CSS Property | `appNavbar.css:17-18`, `redesign.css:70` |
| **Header Border Bottom** | `1px solid rgba(0, 84, 93, 0.12)` (`#E2E8F0`) | `1px solid #1E4650` (`#334155`) | CSS Var `--border-subtle` | `appNavbar.css:19, 27`, `redesign.css:19, 50` |
| **Header Shadow** | `0 2px 12px rgba(15, 23, 42, 0.04)` | `0 2px 12px rgba(0, 0, 0, 0.2)` | CSS Property | `appNavbar.css:20, 28` |
| **Tab Active Pill Background** | `#E1F4F0` | `rgba(0, 171, 155, 0.16)` | CSS Property | `appNavbar.css:144, 152` |
| **Tab Active Pill Border** | `1px solid #B8E8DF` | `1px solid rgba(0, 171, 155, 0.35)` | CSS Property | `appNavbar.css:146, 153` |
| **Tab Active Pill Text** | `#00545D` | `#B8E8DF` | CSS Property | `appNavbar.css:145, 154` |
| **Tab Active Pill Shadow** | `0 2px 8px rgba(0, 84, 93, 0.12)` | `none` | CSS Property | `appNavbar.css:148` |
| **CTA "Sàng lọc ngay" Gradient** | `linear-gradient(135deg, #00AB9B 0%, #087F78 100%)` | Giống Light | CSS Property | `appNavbar.css:189` |
| **CTA Hover Gradient** | `linear-gradient(135deg, #00C7B4 0%, #066B65 100%)` | Giống Light | CSS Property | `appNavbar.css:201` |
| **CTA Shadow** | `0 3px 12px rgba(0, 171, 155, 0.3)` | Giống Light | CSS Property | `appNavbar.css:196` |
| **CTA Hover Shadow** | `0 5px 16px rgba(0, 171, 155, 0.42)` | Giống Light | CSS Property | `appNavbar.css:203` |
| **Border Radius Pill** | `9999px` | `9999px` | CSS Var `--radius-full` | `appNavbar.css:117, 188`, `redesign.css:23` |
| **Border Radius Container / Modal** | `16px` (md) / `24px` (lg) | `16px` / `24px` | CSS Var `--radius-md`, `--radius-lg` | `redesign.css:21-22`, `index.css:50-51` |
| **Font Family** | `'Manrope', system-ui, -apple-system, sans-serif` | Giống Light | CSS Var `--font-sans` | `redesign.css:10`, `index.css:20`, `appNavbar.css:22` |
| **Header Height** | Desktop: `64px` / Mobile: `56px` | Desktop: `64px` / Mobile: `56px` | CSS Property | `appNavbar.css:40, 812` |
| **Header Max-Width** | `1280px` (padding `10px 24px`) | `1280px` | CSS Property | `appNavbar.css:32-34`, `redesign.css:71` |

### 5.2. Nhận xét về tính đồng bộ token
Bảng màu của Repo B (`remi.*` trong `tailwind.config.js`) và biến màu CSS của Repo A (`--color-*` trong `redesign.css`) được xây dựng từ **cùng một nguồn thiết kế chuẩn thương hiệu RemiCare**:
- `remi.mint: #00AB9B` tương đương `--color-mint: #00AB9B`
- `remi.teal: #00545D` tương đương `--color-deep-teal: #00545D`
- `remi.warmWhite: #F9F8F2` tương đương `--color-warm-white: #F9F8F2`
- `remi.softMint: #B8E8DF` tương đương `--color-soft-mint: #B8E8DF`
- `remi.paleTeal: #E1F4F0` tương đương `--color-pale-teal: #E1F4F0`
- `remi.deepGreen: #267A78` tương đương `--color-deep-green: #267A78`
- `remi.coral: #F28C7B` tương đương `--color-warm-coral: #F28C7B`

Khác biệt duy nhất nằm ở cơ chế áp dụng: Repo B dùng class Tailwind (`bg-remi-warmWhite`, `text-remi-teal`, `dark:bg-[#071619]`), trong khi Repo A dùng CSS variables thuần và cơ chế toggle qua `data-theme="dark"`. Việc đồng bộ sẽ đạt độ nhất quán 100% khi cấu hình Tailwind của Repo B ánh xạ trực tiếp sang các biến CSS này.

---

## 6. CÂU HỎI MỞ (MỤC 3.5)

Kính đề xuất Tech Lead / Product Owner xem xét và cho ý kiến quyết định về 5 điểm sau:

### Câu hỏi 1: Tích hợp đầy đủ chức năng Sụp mí của Repo B hay làm trang Placeholder?
- **Thực tế:** Trong đề bài mục 5.3 ghi *"Trang Sàng lọc sụp mí: Repo B chưa có tính năng này. Tạo trang placeholder... Chuyển nguyên chức năng lác lé từ Repo B"*. Nhưng qua khảo sát mã nguồn thực tế:
  - Repo A đã có trọn vẹn module **Sàng lọc lác/lé** (`BinocularVisionScreening.jsx`) gồm Hirschberg, Cover Test, FaceMesh, ONNX AI và audio Iris.
  - Repo B thực chất lại là module **Sàng lọc sụp mí** (`PtosisCheck`) đã hoàn thiện đầy đủ từ upload/webcam, Quality Gate, gọi API đến trực quan hóa kết quả Tier 1/2/3 và đo lường MRD-1.
- **Đề xuất:**
  - **Lựa chọn A (Khuyến nghị)**: Đưa toàn bộ module Sàng lọc sụp mí hoàn chỉnh từ Repo B vào route `/sang-loc/sup-mi` (thay thế giao diện cũ của B bằng layout & tokens của A). Route `/sang-loc/lac-le` sẽ trỏ đến module sàng lọc lác/lé có sẵn của A. Nhờ đó sản phẩm chung sở hữu ngay cả 2 công cụ sàng lọc hoàn chỉnh!
  - **Lựa chọn B**: Tạo trang placeholder cho `/sang-loc/sup-mi` theo đúng văn bản prompt và chỉ tích hợp code B vào mục lác lé (dù code B là sụp mí).

### Câu hỏi 2: Giải pháp kiến trúc Routing (URL Deep Linking & History)
- **Thực tế:** Cả Repo A và Repo B hiện tại đều **không dùng thư viện react-router**, mà quản lý tab/bước bằng React State (`activeTab`).
- Để đáp ứng yêu cầu: Menu dropdown có route `/sang-loc/lac-le`, `/sang-loc/sup-mi`, và truy cập `/sang-loc` tự động redirect:
  - **Phương án 2.1 (Khuyến nghị - Zero-regression)**: Xây dựng cơ chế **URL Sync Router** gọn nhẹ sử dụng HTML5 History API (`window.location.pathname`, `pushState`, sự kiện `popstate`). Cơ chế này giữ nguyên 100% kiến trúc state hiện hành của Repo A, không gây hồi quy cho các trang Trang chủ, Trải nghiệm, Mô phỏng, đồng thời hỗ trợ tải trực tiếp qua URL trình duyệt, nút Back/Forward và redirect route hoàn hảo.
  - **Phương án 2.2**: Cài đặt gói `react-router-dom` (v6 hoặc v7) và refactor toàn bộ gốc ứng dụng `App.jsx` sang cấu trúc `<BrowserRouter>`, `<Routes>`, `<Route>`. (Rủi ro: cần kiểm thử hồi quy lớn hơn).

### Câu hỏi 3: Kiểm soát Tailwind CSS để tránh xung đột Preflight
- Khi đưa code của Repo B vào Repo A, nếu bật Tailwind mặc định, Preflight của Tailwind sẽ reset CSS toàn bộ trang web (thay đổi font heading, khoảng cách button, outline).
- **Giải pháp đề xuất:** Trong `tailwind.config.js`, tắt triệt để preflight:
  ```javascript
  corePlugins: {
    preflight: false,
  }
  ```
  Và đồng bộ dark mode selector với Repo A:
  ```javascript
  darkMode: ['selector', '[data-theme="dark"]'],
  ```
  *Tech Lead có phê duyệt giải pháp cấu hình này không?*

### Câu hỏi 4: Hành vi nút CTA "Sàng lọc ngay →" trên Header
- Hiện tại nút này nhảy thẳng vào module Sàng lọc. Khi đã chia thành 2 loại sàng lọc (Lác/lé vs Sụp mí):
  - **Lựa chọn 4.1 (Mặc định theo prompt)**: Nhấn nút sẽ mở trực tiếp trang `/sang-loc/lac-le`.
  - **Lựa chọn 4.2**: Nhấn nút sẽ mở menu dropdown để người dùng chọn lác/lé hoặc sụp mí.
  - **Lựa chọn 4.3**: Nhấn nút sẽ dẫn tới trang Hub `/sang-loc` chứa thẻ tóm tắt 2 phương pháp để người dùng quyết định trước khi bắt đầu.

### Câu hỏi 5: Cấu hình Endpoint Backend cho Sàng lọc sụp mí
- Backend của PtosisCheck hiện tại trỏ tới endpoint `/api/v1/screening/analyze` trên `http://127.0.0.1:8000`.
- Chúng tôi đề xuất bổ sung biến môi trường mới vào `.env.example` của Repo A:
  ```env
  VITE_PTOSIS_BACKEND_URL=https://api.ptosis.remicare.id.vn
  ```
  để chạy song song độc lập với `VITE_HIRSCHBERG_BACKEND_URL` và `VITE_COVER_TEST_BACKEND_URL`.

---

**KẾT THÚC BÁO CÁO GIAI ĐOẠN 1.**  
Hệ thống tạm dừng tại đây và chờ phê duyệt / phản hồi từ bạn trước khi chuyển sang **Giai đoạn 2 (Kế hoạch Merge chi tiết)**.
