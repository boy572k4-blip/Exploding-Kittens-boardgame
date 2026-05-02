# 🚀 HƯỚNG DẪN DEPLOY LÊN RAILWAY

## Bước 1: Chuẩn bị Discord Application

### 1.1. Tạo Discord Application
1. Truy cập https://discord.com/developers/applications
2. Click "New Application"
3. Đặt tên cho app (VD: "Exploding Kittens")
4. Vào tab "General Information", copy **Application ID** (đây là DISCORD_CLIENT_ID)

### 1.2. Lấy Client Secret
1. Vào tab "OAuth2"
2. Click "Reset Secret" để tạo mới (hoặc copy secret hiện tại)
3. Copy **Client Secret** (đây là DISCORD_CLIENT_SECRET)
4. **LƯU Ý**: Secret chỉ hiển thị 1 lần, hãy lưu lại ngay!

### 1.3. Cấu hình Discord Activity
1. Vào tab "Activities"
2. Click "Enable Activities"
3. Thêm URL Mapping:
   - **Target URL**: `https://your-app.railway.app` (sẽ có sau khi deploy)
   - **Root Mapping**: `/`

### 1.4. Tạo Bot Token (nếu cần)
1. Vào tab "Bot"
2. Click "Add Bot"
3. Copy **Bot Token** (đây là DISCORD_BOT_TOKEN)

## Bước 2: Deploy lên Railway

### 2.1. Tạo tài khoản Railway
1. Truy cập https://railway.app
2. Đăng nhập bằng GitHub
3. Verify email nếu cần

### 2.2. Tạo Project mới

#### Cách 1: Deploy từ GitHub (Khuyến nghị)
1. Push code lên GitHub repository
2. Vào Railway Dashboard → "New Project"
3. Chọn "Deploy from GitHub repo"
4. Chọn repository của bạn
5. Railway sẽ tự động detect và deploy

#### Cách 2: Deploy từ local
1. Cài Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login vào Railway:
   ```bash
   railway login
   ```

3. Khởi tạo project:
   ```bash
   railway init
   ```

4. Deploy:
   ```bash
   railway up
   ```

### 2.3. Cấu hình Environment Variables

Vào Railway Dashboard → Project → Variables, thêm các biến sau:

```
NODE_ENV=production
PORT=2567
DISCORD_CLIENT_ID=<your_discord_client_id>
DISCORD_CLIENT_SECRET=<your_discord_client_secret>
DISCORD_BOT_TOKEN=<your_discord_bot_token>
AUTH_ADMIN=<your_admin_password>
```

**Giải thích:**
- `NODE_ENV`: Môi trường production
- `PORT`: Cổng server (Railway tự động map)
- `DISCORD_CLIENT_ID`: Application ID từ Discord
- `DISCORD_CLIENT_SECRET`: Client Secret từ Discord
- `DISCORD_BOT_TOKEN`: Bot Token từ Discord (dùng để verify instance)
- `AUTH_ADMIN`: Password để truy cập Colyseus Monitor

### 2.4. Cấu hình Domain

1. Railway sẽ tự động tạo domain: `https://your-app.railway.app`
2. Copy domain này
3. Quay lại Discord Developer Portal
4. Vào tab "Activities" → URL Mappings
5. Cập nhật **Target URL** thành domain Railway của bạn

## Bước 3: Kiểm tra Deployment

### 3.1. Xem Logs
```bash
railway logs
```

Hoặc vào Railway Dashboard → Project → Deployments → View Logs

### 3.2. Kiểm tra server đang chạy
Truy cập: `https://your-app.railway.app`

Bạn sẽ thấy Colyseus Playground hoặc trang chủ game.

### 3.3. Kiểm tra Monitor
Truy cập: `https://your-app.railway.app/colyseus`

Đăng nhập bằng:
- Username: `admin`
- Password: `<AUTH_ADMIN value>`

## Bước 4: Test Game trên Discord

### 4.1. Thêm Activity vào Discord Server
1. Vào Discord Developer Portal
2. Tab "Activities" → "URL Mappings"
3. Click "Save Changes"

### 4.2. Test trong Discord
1. Mở Discord Desktop App
2. Vào một Voice Channel
3. Click vào icon "Rocket" (Activities)
4. Chọn game "Exploding Kittens"
5. Game sẽ load trong Discord!

## Bước 5: Troubleshooting

### Lỗi: "Instance ID verification failed"
**Nguyên nhân**: DISCORD_BOT_TOKEN không đúng hoặc thiếu

**Giải pháp**:
1. Kiểm tra DISCORD_BOT_TOKEN trong Railway Variables
2. Đảm bảo bot token đúng từ Discord Developer Portal
3. Redeploy: `railway up` hoặc trigger redeploy trên Dashboard

### Lỗi: "Cannot connect to server"
**Nguyên nhân**: URL Mapping không đúng

**Giải pháp**:
1. Kiểm tra URL Mapping trong Discord Activities
2. Đảm bảo Target URL trùng với Railway domain
3. Đảm bảo Root Mapping là `/`

### Lỗi: "Build failed"
**Nguyên nhân**: Dependencies hoặc build script lỗi

**Giải pháp**:
1. Xem logs: `railway logs`
2. Kiểm tra `package.json` scripts
3. Đảm bảo Node version >= 16.13.0

### Lỗi: "Application error" hoặc "503"
**Nguyên nhân**: Server crash hoặc không start được

**Giải pháp**:
1. Xem logs: `railway logs`
2. Kiểm tra PORT environment variable
3. Kiểm tra tất cả required env vars đã được set

## Bước 6: Cập nhật Code

### Từ GitHub (Auto Deploy)
1. Push code lên GitHub
2. Railway tự động detect và redeploy

### Từ Local
```bash
railway up
```

## Bước 7: Monitoring

### Xem Resource Usage
Railway Dashboard → Project → Metrics

### Xem Active Rooms
`https://your-app.railway.app/colyseus`

### Xem Logs Real-time
```bash
railway logs --follow
```

## Chi phí Railway

- **Free Tier**: $5 credit/tháng (đủ cho testing)
- **Hobby Plan**: $5/tháng (unlimited usage)
- **Pro Plan**: $20/tháng (team features)

**Lưu ý**: Game này sử dụng WebSocket nên có thể tốn nhiều bandwidth. Monitor usage thường xuyên!

## Cấu trúc Project

```
meono-main/
├── client/              # React frontend
│   ├── dist/           # Built files (served by server)
│   └── package.json
├── server/             # Colyseus backend
│   ├── src/
│   ├── build/          # Compiled TypeScript
│   └── package.json
├── package.json        # Root package (orchestrates build)
├── Dockerfile          # Docker config (Railway uses this)
└── railway.json        # Railway config
```

## Build Process

1. `npm install` → Install root dependencies
2. `npm run bootstrap` → Install client + server dependencies
3. `npm run build` → Build client + server
   - Client: `npm run build --prefix client` → Creates `client/dist/`
   - Server: `npm run build --prefix server` → Creates `server/build/`
4. `npm start` → Start production server
   - Runs: `node server/build/index.js`
   - Server serves client files from `client/dist/`

## Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| NODE_ENV | Yes | Environment | `production` |
| PORT | No | Server port (Railway auto-assigns) | `2567` |
| DISCORD_CLIENT_ID | Yes | Discord Application ID | `1248976494152122419` |
| DISCORD_CLIENT_SECRET | Yes | Discord OAuth2 Secret | `abc123...` |
| DISCORD_BOT_TOKEN | Yes | Discord Bot Token | `MTI0ODk3...` |
| AUTH_ADMIN | Yes | Colyseus Monitor password | `your_secure_password` |

## Checklist Deploy

- [ ] Discord Application đã tạo
- [ ] Đã có DISCORD_CLIENT_ID
- [ ] Đã có DISCORD_CLIENT_SECRET
- [ ] Đã có DISCORD_BOT_TOKEN
- [ ] Code đã push lên GitHub (nếu dùng GitHub deploy)
- [ ] Railway project đã tạo
- [ ] Environment variables đã set đầy đủ
- [ ] Deploy thành công (check logs)
- [ ] Discord URL Mapping đã cập nhật
- [ ] Test game trong Discord thành công

## Liên hệ Support

- Railway Docs: https://docs.railway.app
- Colyseus Docs: https://docs.colyseus.io
- Discord Developer Docs: https://discord.com/developers/docs

---

**Chúc bạn deploy thành công! 🎉**
