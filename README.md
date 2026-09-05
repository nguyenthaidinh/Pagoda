<p align="center">
  <img src="public/images/pagoda-logo.svg" width="88" alt="PagodaPDF logo">
</p>

<h1 align="center">PagodaPDF</h1>

<p align="center">
  Bộ công cụ PDF mã nguồn mở, ưu tiên quyền riêng tư và xử lý trực tiếp trong trình duyệt.
</p>

<p align="center">
  <a href="https://github.com/nguyenthaidinh/Pagoda/actions/workflows/tests.yml"><img alt="Tests" src="https://github.com/nguyenthaidinh/Pagoda/actions/workflows/tests.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0-only" src="https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg"></a>
</p>

PagodaPDF cung cấp các công cụ chỉnh sửa, sắp xếp, chuyển đổi, tối ưu và bảo mật PDF. Phần lớn thao tác tài liệu chạy tại máy người dùng bằng JavaScript và WebAssembly, giúp hạn chế việc tải tài liệu lên máy chủ.

## Tính năng chính

- Gộp, chia, sắp xếp, xoay, trích xuất và xóa trang PDF.
- Chỉnh sửa, chú thích, watermark, đánh số trang, bookmark và biểu mẫu.
- Chuyển đổi nhiều định dạng sang PDF và xuất dữ liệu từ PDF.
- Mã hóa, giải mã, làm sạch metadata và hỗ trợ chữ ký số.
- Giao diện đa ngôn ngữ, có thể tự triển khai bằng static hosting hoặc Docker.

> Một số tính năng nâng cao tải bộ xử lý WebAssembly từ CDN mặc định. Một số tác vụ như kiểm tra chuỗi chứng thư có thể cần truy cập mạng. Xem `.env.example` để tự lưu trữ các tài nguyên này.

## Chạy cục bộ

Yêu cầu Node.js 20 trở lên và npm.

```bash
git clone https://github.com/nguyenthaidinh/Pagoda.git
cd Pagoda
npm install
npm run dev
```

Mặc định Vite sẽ in địa chỉ truy cập trong terminal. Để tạo bản production:

```bash
npm run build
npm run preview
```

Các lệnh kiểm tra chính:

```bash
npm run test:run
npx tsc --noEmit
npm run build
```

## Cấu hình triển khai

Sao chép `.env.example` thành tệp môi trường phù hợp với nền tảng triển khai và thiết lập ít nhất:

```dotenv
SITE_URL=https://pagoda.liotnu.com
VITE_BRAND_NAME=PagodaPDF
VITE_BRAND_LOGO=images/pagoda-logo.svg
```

Với VPS và tên miền chính thức, cấu hình production của repo này là:

- `BASE_URL=/`
- `SITE_URL=https://pagoda.liotnu.com`

Hãy thay `SITE_URL` khi sử dụng tên miền riêng. Không commit mật khẩu, khóa API hoặc file `.env.*` chứa dữ liệu thật.

## Đóng góp và bảo mật

Đọc [CONTRIBUTING.md](CONTRIBUTING.md) trước khi gửi pull request. Lỗi bảo mật cần được báo theo [SECURITY.md](SECURITY.md), không đăng dữ liệu cá nhân hoặc tài liệu PDF nhạy cảm vào issue công khai.

## Nguồn gốc và ghi công

PagodaPDF là một dự án phái sinh độc lập dựa trên [BentoPDF](https://github.com/alam00000/bentopdf). Dự án này không liên kết, không được tài trợ và không được BentoPDF hoặc các cộng tác viên ban đầu xác nhận chính thức.

- Dự án gốc: BentoPDF
- Kho mã nguồn gốc: https://github.com/alam00000/bentopdf
- Tác giả gốc: các cộng tác viên BentoPDF
- Bản sửa đổi PagodaPDF: Nguyễn Thái Định / LioDev

Thông tin chi tiết nằm trong [NOTICE](NOTICE). Tên kỹ thuật `bentopdf-*` vẫn xuất hiện ở một số dependency và gói vendor vì đó là tên của các thành phần gốc được sử dụng.

## Giấy phép

PagodaPDF được phát hành theo [GNU Affero General Public License v3.0 only](LICENSE). Khi sửa đổi và cung cấp phiên bản qua mạng, bạn phải đáp ứng các nghĩa vụ cung cấp mã nguồn tương ứng của AGPL-3.0.

Các thông báo bản quyền và giấy phép của dự án gốc, dependency và tài nguyên bên thứ ba phải được giữ lại khi phân phối. Nội dung này chỉ là tóm tắt, không phải tư vấn pháp lý.

## Liên hệ

- GitHub Issues: https://github.com/nguyenthaidinh/Pagoda/issues
- Email: hotropagoda@liotnu.com
