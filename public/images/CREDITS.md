# Nguồn ảnh chụp — RemiCare

## Ảnh minh họa chiến dịch

`campaign-eye-screening.webp` (1536 × 1024) được tạo bằng công cụ ImageGen tích hợp của OpenAI ngày 16/10/2026, theo phong cách ảnh chụp, minh họa phụ huynh Việt Nam cùng bé kiểm tra mắt qua camera. Đây là nhân vật và tình huống do AI tạo, không phải ảnh bệnh nhân thật hay bằng chứng kiểm chứng sản phẩm. Prompt gốc: [campaign-eye-screening.prompt.md](campaign-eye-screening.prompt.md). Bản dùng trên web được chuyển WebP bằng Pillow, chất lượng 86.

## Ảnh chụp từ nguồn bên ngoài

Hai ảnh riêng cho cảnh 2 và 3 của banner: `campaign-eye-clinic.webp` và `campaign-eye-family.webp` (mỗi ảnh 1536 × 1024), tạo bằng ImageGen tích hợp ngày 16/10/2026, chuyển WebP bằng Pillow chất lượng 86. Đây là ảnh minh họa AI, không phải ảnh bệnh nhân, bác sĩ hoặc gia đình sử dụng sản phẩm thực tế. Cảnh che mắt minh họa sự đồng hành trong chăm sóc nhược thị, không phải hướng dẫn tự điều trị. Prompt gốc: [campaign-additional-images.prompts.md](campaign-additional-images.prompts.md).

Đối chiếu trang ảnh và giấy phép ngày 15/10/2026. Các ảnh dưới đây được dùng để minh họa nội dung; không ngụ ý người trong ảnh là người dùng, nhân viên hay người bảo chứng cho RemiCare.

| File WebP | Kích thước | Dung lượng | Tác giả | Nguồn gốc | Giấy phép |
| --- | --- | --- | --- | --- | --- |
| `hero-family.webp` | 1200 × 1000 | 84.054 byte | Arina Krasnikova | [A Mother and Daughter Laughing — Pexels](https://www.pexels.com/photo/a-mother-and-daughter-laughing-6338450/) | [Pexels License](https://www.pexels.com/legal-pages/license) |
| `listen-family.webp` | 960 × 600 | 54.060 byte | Arina Krasnikova | [A Mother and Daughter Laughing — Pexels](https://www.pexels.com/photo/a-mother-and-daughter-laughing-6338450/) | [Pexels License](https://www.pexels.com/legal-pages/license) |
| `listen-eye-care.webp` | 960 × 600 | 35.302 byte | Gustavo Fring | [Small Girl Getting Glasses at Optician — Pexels](https://www.pexels.com/photo/small-girl-getting-glasses-at-optician-5621847/) | [Pexels License](https://www.pexels.com/legal-pages/license) |
| `cta-eye-care.webp` | 1200 × 600 | 38.496 byte | Gustavo Fring | [Small Girl Getting Glasses at Optician — Pexels](https://www.pexels.com/photo/small-girl-getting-glasses-at-optician-5621847/) | [Pexels License](https://www.pexels.com/legal-pages/license) |
| `listen-rest.webp` | 960 × 600 | 146.304 byte | Darren Bockman | [Sunlight Through The Trees — Unsplash](https://unsplash.com/photos/green-leaf-trees-illuminated-by-suns-rays-pN3Z2usSIQw) | [Unsplash License](https://unsplash.com/license) |

Các giấy phép trên cho phép sử dụng thương mại và chỉnh sửa theo điều kiện của từng nguồn. Không dùng ảnh để ngụ ý bảo chứng, không bán lại ảnh nguyên bản hoặc phân phối như kho ảnh.

Xử lý: xoay theo EXIF, chuyển RGB, crop theo khung hiển thị, resize (rộng tối đa 1200px), nén WebP bằng Pillow. Mỗi file nhỏ hơn **150.000 byte**. Lớp phủ mint và lớp phủ tối dưới chữ được áp dụng bằng CSS, không ghi vào ảnh.

Script tái tạo các file: `scripts/prepareSitePhotos.py` (Python + Pillow; cần kết nối mạng). Các ảnh JPG sẵn có của dự án không thuộc đợt thay ảnh này.
