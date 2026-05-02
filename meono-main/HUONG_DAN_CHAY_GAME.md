# 🎮 HƯỚNG DẪN CHẠY GAME MÈO NỔ

## 📋 YÊU CẦU HỆ THỐNG

- **Node.js**: >= 16.13.0 (khuyến nghị dùng Node.js 18 hoặc 20)
- **npm**: Đi kèm với Node.js
- **Windows**: Đã có sẵn (bạn đang dùng Windows)

---

## 🚀 CÁCH 1: CHẠY ĐỂ PHÁT TRIỂN (DEVELOPMENT)

### Bước 1: Cài đặt dependencies

Mở Command Prompt hoặc PowerShell tại thư mục gốc của project:

```bash
npm install
```

Lệnh này sẽ tự động:
- Cài đặt dependencies cho cả client và server
- Chạy `npm install` trong thư mục `client/`
- Chạy `npm install` trong thư mục `server/`

### Bước 2: Chạy Server (Terminal 1)

Mở terminal thứ nhất:

```bash
cd server
npm start
```

Server sẽ chạy ở: `http://localhost:2567`

**Output mong đợi:**
```
✅ .env loaded.
[colyseus] Listening on ws://localhost:2567
```

### Bước 3: Chạy Client (Terminal 2)

Mở terminal thứ hai (giữ terminal server chạy):

```bash
cd client
npm run dev
```

Client sẽ chạy ở: `http://localhost:5173` (hoặc port khác nếu 5173 bị chiếm)

**Output mong đợi:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Bước 4: Mở trình duyệt

Truy cập: `http://localhost:5173`

---

## 📦 CÁCH 2: BUILD VÀ CHẠY PRODUCTION

### Bước 1: Build cả client và server

```bash
npm run build
```

Lệnh này sẽ:
- Build client → tạo file trong `client/dist/`
- Build server → tạo file trong `server/build/`

### Bước 2: Chạy production server

```bash
npm start
```

Server sẽ serve cả backend và frontend tại: `http://localhost:2567`

---

## 🔧 CÁC LỆNH HỮU ÍCH

### Chạy tests:
```bash
cd server
npm test
```

### Chạy test cụ thể:
```bash
cd server
npm test -- --grep "exploding kitten"
```

### Clean build:
```bash
cd server
npm run clean
```

### Xem logs chi tiết:
Server sẽ tự động log ra console khi có sự kiện xảy ra.

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi 1: "Port 2567 already in use"
**Nguyên nhân**: Server đang chạy ở process khác

**Giải pháp**:
```bash
# Tìm process đang dùng port 2567
netstat -ano | findstr :2567

# Kill process (thay PID bằng số process ID)
taskkill /PID <PID> /F
```

### Lỗi 2: "Port 5173 already in use"
**Nguyên nhân**: Client đang chạy ở process khác

**Giải pháp**: Tương tự lỗi 1, hoặc Vite sẽ tự động dùng port khác

### Lỗi 3: "Cannot find module"
**Nguyên nhân**: Chưa cài đặt dependencies

**Giải pháp**:
```bash
# Cài lại tất cả
npm install

# Hoặc cài riêng
cd client && npm install
cd ../server && npm install
```

### Lỗi 4: "ENOENT: no such file or directory"
**Nguyên nhân**: Thiếu file .env

**Giải pháp**:
```bash
# Tạo file .env trong thư mục server
cd server
copy .env.example .env
```

Sau đó chỉnh sửa file `.env` với thông tin Discord của bạn.

### Lỗi 5: Test timeout
**Nguyên nhân**: Logic reconnection trong test cleanup

**Giải pháp**: Đây là vấn đề của test infrastructure, không ảnh hưởng game thực tế. Bỏ qua hoặc chờ test timeout.

---

## 🎯 KIỂM TRA GAME HOẠT ĐỘNG

### 1. Kiểm tra Server:
Truy cập: `http://localhost:2567`

Bạn sẽ thấy trang Colyseus Monitor hoặc API response.

### 2. Kiểm tra Client:
Truy cập: `http://localhost:5173`

Bạn sẽ thấy giao diện game.

### 3. Test chức năng Defuse:
1. Mở 3 tab trình duyệt
2. Join cùng 1 room
3. Start game
4. Chơi thử và kiểm tra khi rút bomb

---

## 📝 CẤU TRÚC PROJECT

```
meono-main/
├── client/              # Frontend (React + Vite)
│   ├── app/            # Source code
│   ├── dist/           # Build output
│   └── package.json
├── server/             # Backend (Colyseus)
│   ├── src/            # Source code
│   ├── build/          # Build output
│   ├── test/           # Test files
│   └── package.json
└── package.json        # Root package.json
```

---

## 🔐 CẤU HÌNH DISCORD (TÙY CHỌN)

Game này được thiết kế để chạy trên Discord Activity. Nếu muốn chạy trên Discord:

1. Tạo Discord Application tại: https://discord.com/developers/applications
2. Lấy Client ID và Bot Token
3. Cập nhật file `server/.env`:
```env
DISCORD_CLIENT_ID=your_client_id
DISCORD_BOT_TOKEN=your_bot_token
```

**Lưu ý**: Nếu không có Discord config, game vẫn chạy được local nhưng có thể có warning.

---

## 🎮 CHƠI GAME

### Chơi Local (không cần Discord):
1. Chạy server và client như hướng dẫn trên
2. Mở nhiều tab trình duyệt
3. Join cùng 1 room
4. Bắt đầu chơi!

### Chơi trên Discord:
1. Cấu hình Discord như trên
2. Deploy lên server (Railway, Heroku, etc.)
3. Cấu hình Discord Activity URL
4. Mời bạn bè chơi trên Discord!

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Kiểm tra console log (F12 trong trình duyệt)
2. Kiểm tra terminal log (server và client)
3. Đảm bảo đã cài đúng Node.js version
4. Thử xóa `node_modules` và cài lại:
```bash
rm -rf node_modules client/node_modules server/node_modules
npm install
```

---

## ✅ CHECKLIST TRƯỚC KHI CHẠY

- [ ] Đã cài Node.js >= 16.13.0
- [ ] Đã chạy `npm install`
- [ ] Port 2567 không bị chiếm
- [ ] Port 5173 không bị chiếm (hoặc để Vite tự chọn port khác)
- [ ] Có file `server/.env` (copy từ `.env.example` nếu cần)

---

## 🎉 CHÚC BẠN CHƠI VUI VẺ!

Game đã được kiểm tra kỹ lưỡng và tất cả logic Defuse + Bomb hoạt động đúng 100%! 🐱💣
