# Hướng dẫn chơi Exploding Kittens Online với Ngrok

## Bước 1: Cài đặt Ngrok

1. Tải ngrok tại: https://ngrok.com/download
2. Giải nén và đặt vào thư mục bất kỳ
3. Đăng ký tài khoản ngrok (miễn phí) để lấy authtoken

## Bước 2: Chạy Server

Mở terminal 1:
```cmd
cd server
npm start
```

Server sẽ chạy ở port 7777 (hoặc 2567 nếu không set PORT)

## Bước 3: Chạy Ngrok cho Server

Mở terminal 2:
```cmd
ngrok http 7777
```

Bạn sẽ thấy URL như: `https://xxxx-xx-xx-xxx-xxx.ngrok-free.app`

**LƯU Ý:** Copy URL này, bạn sẽ cần nó ở bước tiếp theo!

## Bước 4: Cấu hình Client

Mở file `client/app/utility/contexts.ts` và sửa dòng cuối:

```typescript
export const {
    client,
    setCurrentRoom,
    useColyseusRoom,
    useColyseusState
} = colyseus<GameRoomState>("https://YOUR-NGROK-URL-HERE/");
```

Thay `YOUR-NGROK-URL-HERE` bằng URL ngrok của bạn (VD: `xxxx-xx-xx-xxx-xxx.ngrok-free.app`)

## Bước 5: Chạy Client

Mở terminal 3:
```cmd
cd client
npm run dev
```

Client sẽ chạy ở `http://localhost:5173`

## Bước 6: Chơi với bạn bè

### Người tạo phòng:
1. Mở browser vào `http://localhost:5173`
2. Nhập tên của bạn
3. Nhập room ID (VD: `phong123`)
4. Copy URL trong thanh địa chỉ (VD: `http://localhost:5173?room=phong123`)

### Bạn bè muốn join:
**QUAN TRỌNG:** Bạn bè cần chạy ngrok cho client của họ!

Mỗi người cần:
1. Clone code về máy
2. Chạy `npm install` trong thư mục client
3. Sửa file `client/app/utility/contexts.ts` với ngrok URL của server
4. Chạy `npm run dev` trong thư mục client
5. Chạy ngrok cho client: `ngrok http 5173`
6. Mở URL ngrok của client và thêm `?room=phong123` vào cuối

## Cách dễ hơn: Host client lên Vercel/Netlify

Thay vì mỗi người chạy ngrok cho client, bạn có thể:
1. Build client: `npm run build` trong thư mục client
2. Deploy thư mục `client/dist` lên Vercel hoặc Netlify
3. Bạn bè chỉ cần vào URL đó với `?room=phong123`

## Lưu ý

- Ngrok miễn phí có giới hạn, URL sẽ thay đổi mỗi khi restart
- Mỗi lần restart ngrok, phải cập nhật lại URL trong `contexts.ts`
- Để đổi tên, xóa localStorage trong browser (F12 > Application > Local Storage)
