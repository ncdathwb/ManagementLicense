# Hướng dẫn Xóa Cache và Đảm bảo Code Mới

## Vấn đề: Browser đang cache file cũ

Nếu bạn vẫn thấy lỗi CORS với `raw.githubusercontent.com`, có nghĩa là browser đang chạy file cũ từ cache.

## Giải pháp:

### 1. **Hard Refresh Browser**

**Trên PC (Windows/Linux):**
- Chrome/Edge: `Ctrl + Shift + R` hoặc `Ctrl + F5`
- Firefox: `Ctrl + Shift + R` hoặc `Ctrl + F5`
- Safari: `Cmd + Shift + R`

**Trên Điện Thoại:**
- Chrome Android: Menu → Settings → Privacy → Clear browsing data → Cached images and files
- Safari iOS: Settings → Safari → Clear History and Website Data

### 2. **Xóa Cache hoàn toàn**

**Chrome DevTools:**
1. Mở DevTools (F12)
2. Right-click vào nút Refresh
3. Chọn "Empty Cache and Hard Reload"

**Hoặc:**
1. Mở DevTools (F12)
2. Vào tab Network
3. Check "Disable cache"
4. Giữ DevTools mở và refresh trang

### 3. **Kiểm tra Code đã được Deploy**

1. Mở DevTools (F12)
2. Vào tab Network
3. Refresh trang
4. Tìm file `index.html`
5. Click vào file đó
6. Vào tab Response
7. Tìm dòng: `const apiUrl = \`${window.location.origin}/api/licenses?${cacheBuster}\`;`
8. Nếu thấy `raw.githubusercontent.com` → File chưa được deploy mới

### 4. **Kiểm tra API Endpoint**

Mở browser và truy cập:
```
https://management-license.vercel.app/api/licenses
```

Phải trả về JSON array (có thể rỗng `[]`). Nếu lỗi 404 → API endpoint chưa được deploy.

### 5. **Deploy lại nếu cần**

Nếu API endpoint chưa có:
1. Đảm bảo file `api/licenses.js` đã được push lên GitHub
2. Vercel sẽ tự động deploy
3. Kiểm tra Vercel Dashboard để xem deployment status

### 6. **Kiểm tra Console Logs**

Sau khi hard refresh, mở Console (F12) và kiểm tra:

**Code mới (đúng):**
```
[LOAD] 🔄 Loading from API endpoint (NO CACHE): https://management-license.vercel.app/api/licenses?_t=...
[LOAD] Loaded licenses from API: X
[LOAD] ✅ Using SERVER data only: X licenses
```

**Code cũ (sai - cần clear cache):**
```
[LOAD] Loading from GitHub with cache-buster: ...
[LOAD] Could not load from GitHub, will try localStorage: Failed to fetch
```

### 7. **Service Worker Cache (nếu có)**

Nếu app có Service Worker:
1. Mở DevTools (F12)
2. Vào tab Application
3. Click "Service Workers" ở sidebar
4. Click "Unregister" nếu có
5. Refresh trang

### 8. **Incognito/Private Mode**

Test trong Incognito mode để tránh cache:
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Safari: `Cmd + Shift + N`

## Checklist:

- [ ] Hard refresh đã thực hiện (Ctrl+Shift+R)
- [ ] DevTools Network tab có "Disable cache" checked
- [ ] Console logs hiển thị `/api/licenses` không phải `raw.githubusercontent.com`
- [ ] API endpoint `/api/licenses` trả về JSON
- [ ] Không còn lỗi CORS trong Console

## Nếu vẫn không được:

1. **Kiểm tra Vercel Deployment:**
   - Vào Vercel Dashboard
   - Xem deployment mới nhất
   - Đảm bảo đã deploy thành công

2. **Kiểm tra GitHub:**
   - Đảm bảo file `api/licenses.js` đã có trong repo
   - Đảm bảo file `index.html` đã được cập nhật

3. **Clear tất cả cache:**
   - Xóa toàn bộ browsing data
   - Restart browser
   - Thử lại

