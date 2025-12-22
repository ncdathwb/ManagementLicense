# Hướng dẫn Test Đồng Bộ Giữa PC và Điện Thoại

## Bước 1: Deploy API Endpoint

Trước khi test, đảm bảo bạn đã deploy file `api/licenses.js` lên Vercel:

1. Push code lên GitHub
2. Vercel sẽ tự động deploy
3. Kiểm tra API endpoint hoạt động: `https://management-license.vercel.app/api/licenses`

## Bước 2: Test trên PC

### Chuẩn bị:
1. Mở trình duyệt trên PC
2. Mở Developer Tools (F12)
3. Vào tab Console để xem logs
4. Truy cập: `https://management-license.vercel.app`

### Test Case 1: Thêm License mới trên PC
1. Click nút "Thêm License"
2. Nhập thông tin:
   - Key: `TEST-PC-001`
   - Expiry: Chọn ngày trong tương lai
   - Note: "Test từ PC"
3. Click "Lưu"
4. Kiểm tra Console:
   - Phải thấy: `[SYNC] Sync success`
   - Phải thấy: `[LOAD] Loaded licenses from API: X` (X là số lượng)
   - Phải thấy: `[REFRESH] UI updated from GitHub`

### Test Case 2: Sửa License trên PC
1. Tìm license vừa tạo (`TEST-PC-001`)
2. Click nút "Sửa"
3. Thay đổi Note thành: "Đã sửa từ PC"
4. Click "Lưu"
5. Kiểm tra Console tương tự như trên

### Test Case 3: Xóa License trên PC
1. Tìm license `TEST-PC-001`
2. Click nút "Xóa"
3. Xác nhận xóa
4. Kiểm tra Console

## Bước 3: Test trên Điện Thoại

### Chuẩn bị:
1. Mở trình duyệt trên điện thoại (Chrome/Safari)
2. Truy cập: `https://management-license.vercel.app`
3. Mở Developer Tools (nếu có thể) hoặc kiểm tra qua Remote Debugging

### Test Case 4: Kiểm tra đồng bộ từ PC
1. Sau khi thêm/sửa/xóa trên PC, đợi 1-2 giây
2. Trên điện thoại, kiểm tra:
   - License mới phải xuất hiện tự động
   - Hoặc thấy toast notification: "🔄 Đã cập nhật dữ liệu mới từ server"
   - Console (nếu có): `[LOAD] ⚡ Data changed on server!`

### Test Case 5: Thêm License mới trên Điện Thoại
1. Trên điện thoại, click "Thêm License"
2. Nhập thông tin:
   - Key: `TEST-MOBILE-001`
   - Expiry: Chọn ngày trong tương lai
   - Note: "Test từ điện thoại"
3. Click "Lưu"
4. Đợi 1-2 giây

### Test Case 6: Kiểm tra đồng bộ từ Điện Thoại lên PC
1. Quay lại PC
2. Kiểm tra:
   - License `TEST-MOBILE-001` phải xuất hiện tự động trong vòng 1-2 giây
   - Console phải hiển thị: `[LOAD] ⚡ Data changed on server!`

## Bước 4: Test Real-time Sync

### Test Case 7: Đồng bộ real-time
1. Mở cả PC và điện thoại cùng lúc
2. Trên PC: Thêm license `REALTIME-TEST`
3. Quan sát điện thoại:
   - Phải tự động cập nhật trong vòng 1-2 giây
   - Không cần refresh trang
4. Trên điện thoại: Sửa license `REALTIME-TEST`
5. Quan sát PC:
   - Phải tự động cập nhật trong vòng 1-2 giây

## Kiểm tra Logs

### Trên Console (F12), bạn sẽ thấy:

**Khi load thành công:**
```
[LOAD] Loading from API endpoint with cache-buster: t=...
[LOAD] Loaded licenses from API: X
```

**Khi có thay đổi từ thiết bị khác:**
```
[LOAD] ⚡ Data changed on server! Old hash: ... New hash: ...
[REFRESH] ⚡ Server data changed! UI updated from GitHub
```

**Khi sync thành công:**
```
[SYNC] Sync success: {...}
[SYNC] GitHub commit successful, will reload from GitHub...
[SYNC] UI refreshed from GitHub after sync (attempt 1)
```

## Troubleshooting

### Nếu không đồng bộ:

1. **Kiểm tra API endpoint:**
   - Mở: `https://management-license.vercel.app/api/licenses`
   - Phải trả về JSON array

2. **Kiểm tra Console errors:**
   - Nếu thấy CORS error → API endpoint chưa được deploy
   - Nếu thấy 404 → Kiểm tra đường dẫn API

3. **Hard refresh:**
   - PC: Ctrl+Shift+R hoặc Ctrl+F5
   - Điện thoại: Xóa cache trình duyệt

4. **Kiểm tra Network tab:**
   - Xem request đến `/api/licenses` có thành công không
   - Status code phải là 200

5. **Kiểm tra interval:**
   - Console phải thấy logs mỗi 1 giây: `[LOAD] Loading from API endpoint...`

## Kết quả mong đợi:

✅ Thêm/sửa/xóa trên PC → Điện thoại tự động cập nhật trong 1-2 giây
✅ Thêm/sửa/xóa trên Điện thoại → PC tự động cập nhật trong 1-2 giây
✅ Không cần refresh trang
✅ Console hiển thị logs rõ ràng
✅ Toast notification khi có thay đổi từ thiết bị khác

