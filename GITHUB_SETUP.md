# Hướng dẫn cấu hình GitHub Token để tự động commit

Để hệ thống tự động commit file `licenses.json` lên GitHub mỗi khi có thay đổi, bạn cần cấu hình GitHub Personal Access Token.

## Bước 1: Tạo GitHub Personal Access Token

1. Truy cập: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Đặt tên token (ví dụ: "License Manager Auto Commit")
4. Chọn quyền (scopes):
   - ✅ `repo` (Full control of private repositories)
5. Click "Generate token"
6. **LƯU Ý**: Copy token ngay lập tức (chỉ hiển thị 1 lần)

## Bước 2: Cấu hình trong Vercel

### Cách 1: Qua Vercel Dashboard (Khuyến nghị)

1. Truy cập Vercel Dashboard: https://vercel.com/dashboard
2. Đăng nhập vào tài khoản Vercel của bạn
3. Tìm và click vào project **ManagementLicense** (hoặc tên project của bạn)
4. Trong menu bên trái, click vào **Settings**
5. Trong Settings, tìm và click vào **Environment Variables** (ở menu bên trái hoặc tab)
6. Bạn sẽ thấy danh sách các biến môi trường hiện có (nếu có)
7. Click nút **Add New** hoặc **+ Add** để thêm biến mới
8. Thêm từng biến một:

   **Biến 1: GITHUB_TOKEN**
   - **Name**: `GITHUB_TOKEN`
   - **Value**: Dán token GitHub bạn đã tạo (bắt đầu bằng `ghp_`)
   - **Environment**: Chọn tất cả 3 môi trường:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
   - Click **Save**

   **Biến 2: GITHUB_REPO_OWNER** (Tùy chọn - chỉ cần nếu repo khác tên)
   - **Name**: `GITHUB_REPO_OWNER`
   - **Value**: `ncdathwb` (hoặc username GitHub của bạn)
   - **Environment**: Chọn tất cả 3 môi trường
   - Click **Save**

   **Biến 3: GITHUB_REPO_NAME** (Tùy chọn - chỉ cần nếu repo khác tên)
   - **Name**: `GITHUB_REPO_NAME`
   - **Value**: `ManagementLicense` (hoặc tên repo của bạn)
   - **Environment**: Chọn tất cả 3 môi trường
   - Click **Save**

9. **QUAN TRỌNG**: Sau khi thêm xong, bạn PHẢI redeploy project:
   - Vào tab **Deployments**
   - Tìm deployment mới nhất
   - Click vào menu 3 chấm (⋯) bên cạnh deployment
   - Chọn **Redeploy**
   - Hoặc vào **Settings** → **Git** và trigger một commit mới

### Cách 2: Qua Vercel CLI (Nếu bạn dùng CLI)

```bash
vercel env add GITHUB_TOKEN production
vercel env add GITHUB_TOKEN preview
vercel env add GITHUB_TOKEN development
# Nhập token khi được hỏi
```

### Kiểm tra đã thêm đúng chưa

Sau khi redeploy, kiểm tra:
1. Vào **Settings** → **Environment Variables**
2. Xác nhận thấy `GITHUB_TOKEN` trong danh sách
3. Thử thêm/sửa một license và xem có thông báo commit thành công không

## Bước 3: Kiểm tra

Sau khi cấu hình xong:
1. Thử thêm/sửa/xóa một license
2. Kiểm tra xem có thông báo "✅ Đã tự động commit licenses.json lên GitHub!" không
3. Kiểm tra GitHub repository để xem commit mới

## Lưu ý

- Token cần quyền `repo` để có thể commit file
- Nếu không cấu hình token, hệ thống sẽ fallback về download file JSON thủ công
- Token được lưu an toàn trong Vercel Environment Variables

