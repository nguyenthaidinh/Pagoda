<div align="center">

🏯 PagodaPDF

Bộ công cụ PDF miễn phí, riêng tư và xử lý trực tiếp trên trình duyệt

Nhanh • Miễn phí • Mã nguồn mở • Ưu tiên quyền riêng tư

<p>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg" alt="License: AGPL-3.0">
  </a>
  <a href="https://github.com/nguyenthaidinh/Pagoda/stargazers">
    <img src="https://img.shields.io/github/stars/nguyenthaidinh/Pagoda?style=flat&logo=github" alt="GitHub Stars">
  </a>
  <a href="https://github.com/nguyenthaidinh/Pagoda/network/members">
    <img src="https://img.shields.io/github/forks/nguyenthaidinh/Pagoda?style=flat&logo=github" alt="GitHub Forks">
  </a>
  <a href="https://github.com/nguyenthaidinh/Pagoda/issues">
    <img src="https://img.shields.io/github/issues/nguyenthaidinh/Pagoda?style=flat&logo=github" alt="GitHub Issues">
  </a>
</p>

Giới thiệu •
Tính năng •
Cài đặt •
Triển khai •
Quyền riêng tư •
License •
Attribution

</div>

📖 Giới thiệu

PagodaPDF là bộ công cụ xử lý PDF chạy trực tiếp trên trình duyệt, hướng tới trải nghiệm:

🔒 Privacy-first — ưu tiên xử lý tài liệu ngay trên thiết bị của người dùng.

⚡ Nhanh — tận dụng WebAssembly và các công nghệ web hiện đại.

🧰 Đa năng — gộp, tách, chỉnh sửa, chuyển đổi, nén, ký, OCR và nhiều công cụ khác.

🌐 Dễ self-host — có thể build thành static files và triển khai trên VPS hoặc các nền tảng static hosting.

🆓 Mã nguồn mở — phát hành theo GNU Affero General Public License v3.0 (AGPL-3.0).

PagodaPDF được tùy biến về giao diện, thương hiệu, bản địa hóa và cấu hình từ nền tảng mã nguồn mở BentoPDF. Thông tin nguồn gốc và giấy phép được ghi rõ tại phần Open Source & Attribution.

✨ Tính năng

Nhóm

Một số công cụ tiêu biểu

📚 Gộp & Tổ chức PDF

Gộp PDF, chia PDF, sắp xếp trang, trích xuất trang, xóa trang, xoay trang, đảo thứ tự trang

✏️ Chỉnh sửa PDF

Chỉnh sửa văn bản, chú thích, highlight, watermark, header/footer, đánh số trang, crop, redact

🔄 Chuyển đổi sang PDF

Ảnh → PDF, Word → PDF, Excel → PDF, PowerPoint → PDF, Markdown/Text/JSON/XML → PDF

📤 Chuyển đổi từ PDF

PDF → JPG/PNG/WebP/SVG, PDF → Text, PDF → CSV/Excel, trích xuất bảng

🔍 OCR

Nhận dạng văn bản trong PDF scan và tạo tài liệu có thể tìm kiếm/copy

🗜️ Tối ưu

Nén PDF, sửa PDF lỗi, linearize, chuẩn hóa kích thước trang

🔐 Bảo mật

Mã hóa, giải mã, thay đổi quyền, sanitize, xóa metadata

✍️ Chữ ký

Ký PDF, chữ ký số, xác thực chữ ký

🧩 Công cụ nâng cao

PDF Workflow Builder, metadata, bookmarks, attachments, PDF Multi Tool

[!NOTE]
Danh sách công cụ có thể thay đổi theo phiên bản PagodaPDF và các module được bật khi build.

🔐 Quyền riêng tư

PagodaPDF được thiết kế theo hướng client-side: tài liệu PDF được xử lý ngay trong trình duyệt thay vì gửi lên một máy chủ xử lý tài liệu tập trung.

Một số module WebAssembly hoặc dữ liệu hỗ trợ có thể được tải từ CDN tùy theo cấu hình build. Việc tải runtime/module không đồng nghĩa với việc file PDF của người dùng được upload lên CDN để xử lý.

Nếu triển khai cho môi trường yêu cầu kiểm soát nghiêm ngặt, bạn có thể cấu hình self-host các WebAssembly assets thay vì sử dụng CDN.

🛠️ Công nghệ

PagodaPDF sử dụng nền tảng web hiện đại, bao gồm:

Công nghệ

Vai trò

Vite

Build tool và development server

TypeScript

Kiểm tra kiểu và tổ chức mã nguồn

Tailwind CSS

Xây dựng giao diện

WebAssembly (WASM)

Xử lý PDF và các tác vụ nặng ngay trên trình duyệt

Browser APIs

File handling và xử lý phía client

Một số tính năng nâng cao có thể sử dụng các thành phần như PyMuPDF, Ghostscript, CoherentPDF (CPDF), LibreOffice WASM hoặc Tesseract tùy cấu hình của phiên bản đang triển khai.

🚀 Cài đặt & phát triển

Yêu cầu

Node.js 18+

npm (hoặc package manager tương thích)

Git

1. Clone repository

git clone https://github.com/nguyenthaidinh/Pagoda.git
cd Pagoda

2. Cài dependencies

npm install

3. Chạy development server

npm run dev

Mặc định ứng dụng development có thể được truy cập tại:

http://localhost:5173

📦 Build & triển khai

Build production

npm run build

Build output sẽ được tạo trong thư mục:

dist/

Preview bản production

npm run preview

Mặc định preview server thường chạy tại:

http://localhost:4173

Build sử dụng CDN cho WASM

Nếu muốn giảm tải băng thông cho server và dùng cấu hình CDN của dự án:

VITE_USE_CDN=true npm run build

[!IMPORTANT]
Với các tính năng chuyển đổi tài liệu Office sử dụng LibreOffice WASM, môi trường production nên chạy qua HTTPS và cần cấu hình cross-origin isolation phù hợp để SharedArrayBuffer hoạt động.

🐳 Docker

Nếu repository của bạn có Dockerfile, có thể build image PagodaPDF trực tiếp:

docker build -t pagodapdf .

Chạy container:

docker run -d \
  --name pagodapdf \
  -p 3000:8080 \
  --restart unless-stopped \
  pagodapdf

Sau đó truy cập:

http://localhost:3000

🌍 Triển khai static

Sau khi chạy:

npm run build

bạn có thể đưa nội dung trong dist/ lên:

Nginx / Apache trên VPS

Cloudflare Pages

Vercel

Netlify

GitHub Pages

Các dịch vụ static hosting tương thích khác

Với VPS + Nginx, nên bật HTTPS và các security headers phù hợp với những tính năng WASM cần cross-origin isolation.

🎨 Branding PagodaPDF

Branding có thể cấu hình trong source hoặc thông qua các biến build-time tương thích với nền tảng gốc.

Ví dụ:

VITE_BRAND_NAME="PagodaPDF" \
VITE_BRAND_LOGO="images/pagoda-logo.svg" \
VITE_FOOTER_TEXT="PagodaPDF • Open Source • AGPL-3.0" \
npm run build

Đường dẫn logo được tính tương đối từ thư mục public/.

Nếu PagodaPDF đã được tùy biến trực tiếp trong source thì bạn không bắt buộc phải dùng các biến trên.

📁 Cấu trúc dự án

Cấu trúc thực tế có thể thay đổi theo phiên bản, nhưng các thư mục/file chính thường gồm:

Pagoda/
├── public/              # Static assets, logo, images...
├── src/                 # Application source code
├── docs/                # Documentation (nếu được giữ trong fork)
├── dist/                # Production build output
├── package.json
├── package-lock.json
├── vite.config.ts
├── Dockerfile
├── LICENSE
└── README.md

🤝 Đóng góp

Mọi đóng góp giúp PagodaPDF tốt hơn đều được hoan nghênh.

Quy trình đề xuất:

Fork repository.

Tạo branch mới:

git checkout -b feature/ten-tinh-nang

Commit thay đổi:

git commit -m "feat: add new feature"

Push branch:

git push origin feature/ten-tinh-nang

Mở Pull Request và mô tả rõ thay đổi.

Nếu phát hiện lỗi hoặc muốn đề xuất tính năng, hãy tạo một issue trong repository.

🐛 Báo lỗi & đề xuất

Bạn có thể sử dụng GitHub Issues:

Repository: https://github.com/nguyenthaidinh/Pagoda
Issues: https://github.com/nguyenthaidinh/Pagoda/issues

Khi báo lỗi, nên cung cấp:

Trình duyệt và phiên bản

Hệ điều hành

Công cụ PDF đang sử dụng

Các bước tái hiện lỗi

Screenshot/log nếu có thể

File mẫu chỉ khi file đó không chứa dữ liệu nhạy cảm

📜 License

PagodaPDF được phát hành theo:

GNU Affero General Public License v3.0 — AGPL-3.0

Xem toàn bộ nội dung giấy phép tại LICENSE.

Khi bạn sửa đổi PagodaPDF và cung cấp phiên bản đã sửa để người khác tương tác qua mạng, bạn phải tuân thủ các nghĩa vụ của AGPL-3.0, bao gồm việc cung cấp Corresponding Source của phiên bản đang được sử dụng theo các điều kiện của giấy phép.

Nếu bạn deploy PagodaPDF công khai, hãy đảm bảo repository source public phản ánh đúng phiên bản đang chạy, bao gồm các thay đổi về branding, configuration và code liên quan thuộc phạm vi của giấy phép.

Nội dung README này chỉ nhằm mô tả dự án, không thay thế nội dung pháp lý của file LICENSE.

📜 Open Source & Attribution

PagodaPDF là một dự án phái sinh có sửa đổi từ:

BentoPDF

Original project: BentoPDF

Original repository: https://github.com/alam00000/bentopdf

Upstream author/project: alam00000 và BentoPDF contributors

Upstream license: GNU Affero General Public License v3.0 (AGPL-3.0)

PagodaPDF có các thay đổi so với upstream, có thể bao gồm:

Branding và nhận diện PagodaPDF

Giao diện người dùng

Bản địa hóa / nội dung tiếng Việt

Cấu hình triển khai

Tùy chỉnh trải nghiệm sử dụng

Các sửa đổi và tính năng bổ sung của PagodaPDF

Các copyright notice và license notice áp dụng từ upstream và các thành phần bên thứ ba cần được giữ lại theo giấy phép tương ứng.

PagodaPDF là dự án độc lập và không được BentoPDF hoặc các contributor của BentoPDF tài trợ, xác nhận hay chứng thực, trừ khi có tuyên bố chính thức khác.

Third-party software

PagodaPDF có thể sử dụng các thư viện/phần mềm mã nguồn mở của bên thứ ba. Mỗi thành phần vẫn chịu giấy phép và thông báo bản quyền riêng của thành phần đó.

Một số module xử lý nâng cao của upstream có thể liên quan đến:

PyMuPDF

Ghostscript

CoherentPDF (CPDF)

LibreOffice WASM

Tesseract.js

Các thư viện JavaScript/WebAssembly khác

Hãy giữ nguyên các license notice tương ứng khi phân phối hoặc triển khai các thành phần đó.

💻 Source Code

Source code của PagodaPDF:

https://github.com/nguyenthaidinh/Pagoda

Nếu bạn đang sử dụng một deployment công khai của PagodaPDF, repository source tương ứng nên được cập nhật để phản ánh phiên bản đang chạy theo yêu cầu áp dụng của AGPL-3.0.

⚠️ Disclaimer

PagodaPDF được cung cấp theo điều khoản của giấy phép mã nguồn mở áp dụng và không đi kèm bảo đảm về tính phù hợp cho một mục đích cụ thể.

Người dùng chịu trách nhiệm sao lưu tài liệu quan trọng trước khi thực hiện các thao tác chỉnh sửa, chuyển đổi hoặc tối ưu PDF.

Không tải hoặc chia sẻ tài liệu chứa thông tin nhạy cảm ở những môi trường mà bạn không tin tưởng.

🙏 Acknowledgements

Cảm ơn cộng đồng mã nguồn mở và các contributor đã xây dựng những công nghệ mà PagodaPDF sử dụng.

Đặc biệt cảm ơn BentoPDF và các contributor của dự án upstream đã tạo nền tảng mã nguồn mở ban đầu.

👤 Maintainer

nguyenthaidinh

GitHub: https://github.com/nguyenthaidinh

<div align="center">

🏯 PagodaPDF

Free • Privacy-first • Open Source

Nếu dự án hữu ích với bạn, hãy cân nhắc ⭐ repository để ủng hộ dự án.

</div>
