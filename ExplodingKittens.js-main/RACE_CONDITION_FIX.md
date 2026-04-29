# 🔴 CRITICAL BUG FIX: Race Condition khi F5

## Vấn đề

Khi người chơi nhấn F5 trong game, họ **MẤT HẾT BÀI** và phải chơi lại như người chơi mới.

## Nguyên nhân

### Timeline của bug:

```
t=0ms:   User nhấn F5
t=1ms:   Browser đóng WebSocket connection
t=2ms:   Server nhận disconnect event → onLeave() bắt đầu chạy
t=5ms:   Browser tải lại trang
t=10ms:  Browser mở WebSocket connection mới
t=11ms:  Server nhận connect event → onJoin() bắt đầu chạy
t=12ms:  onJoin() check: player với displayName "🐱 Alice" và disconnectedAt !== undefined
t=13ms:  onJoin() KHÔNG TÌM THẤY (vì onLeave chưa set disconnectedAt!)
t=14ms:  onJoin() tạo player mới → MẤT BÀI!
t=20ms:  onLeave() set player.disconnectedAt = Date.now() (quá muộn!)
```

### Code cũ (BUG):

```typescript
// onJoin - GameRoom.ts
if (this.state.started) {
    const existingPlayerIndex = this.state.players.toArray().findIndex(
        p => p.displayName === options.displayName && p.disconnectedAt !== undefined
        //                                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //                                            BUG: Điều kiện này fail nếu onJoin chạy trước onLeave!
    );
    
    if (existingPlayerIndex !== -1) {
        // Rejoin logic...
    }
}

// Nếu không tìm thấy → tạo player mới
const player = new LobbyPlayer();
player.displayName = options.displayName;
this.state.spectators.push(player); // Player mới, mất hết bài!
```

## Giải pháp

### Thay đổi logic:

1. **onJoin**: Chỉ check `displayName`, BỎ điều kiện `disconnectedAt`
2. **onLeave**: Check nếu player đã rejoin với sessionId mới → ignore disconnect cũ

### Code mới (FIXED):

```typescript
// onJoin - GameRoom.ts
if (this.state.started) {
    const existingPlayerIndex = this.state.players.toArray().findIndex(
        p => p.displayName === options.displayName
        // Chỉ check displayName, không cần check disconnectedAt!
        // → Luôn tìm thấy player, bất kể onLeave đã chạy hay chưa
    );
    
    if (existingPlayerIndex !== -1) {
        const existingPlayer = this.state.players.at(existingPlayerIndex);
        const oldSessionId = existingPlayer.sessionId;
        
        // Clear timeout nếu có
        if (existingPlayer.removeTimeout) {
            clearTimeout(existingPlayer.removeTimeout);
            existingPlayer.removeTimeout = undefined;
        }
        
        // Update sessionId mới
        existingPlayer.sessionId = client.sessionId;
        existingPlayer.disconnectedAt = undefined;
        
        // Update ownerId nếu đây là owner
        if (this.state.ownerId === oldSessionId) {
            this.state.ownerId = client.sessionId;
        }
        
        // CRITICAL: Delete old sessionId khỏi map
        if (oldSessionId !== client.sessionId) {
            this.state.playerIndexMap.delete(oldSessionId);
        }
        
        // Update map với sessionId mới
        this.state.playerIndexMap.set(client.sessionId, existingPlayerIndex);
        
        this.log(`Player rejoined! Cards: ${existingPlayer.cards.length}`);
        return; // Player giữ nguyên bài!
    }
}
```

```typescript
// onLeave - GameRoom.ts
async onLeave(client: Client, consented: boolean) {
    if (!consented && this.state.started && !client.userData?.isSpectator) {
        const player = this.state.players.at(playerIndex);
        
        if (player) {
            // CRITICAL: Check nếu player đã rejoin với sessionId khác
            if (player.sessionId !== client.sessionId) {
                this.log(`Player already rejoined with new sessionId, ignoring old disconnect`);
                return; // Ignore disconnect event này
            }
            
            // Mark as disconnected
            player.disconnectedAt = Date.now();
            
            // Set timeout 30s
            player.removeTimeout = setTimeout(() => {
                // Remove player nếu không rejoin
            }, 30000);
            
            return;
        }
    }
    
    // ... permanent leave logic
}
```

## Kết quả

### Trước khi fix:
- ❌ F5 → Mất hết bài
- ❌ Phải chơi lại như người mới
- ❌ Mất vị trí owner nếu là chủ phòng

### Sau khi fix:
- ✅ F5 → Giữ nguyên bài
- ✅ Giữ nguyên vị trí trong game
- ✅ Giữ nguyên quyền owner
- ✅ Không có race condition
- ✅ Hoạt động với mọi tốc độ network

## Test Cases

### Test 1: F5 nhanh (onJoin trước onLeave)
```
1. Player "🐱 Alice" đang chơi với 5 lá bài
2. Nhấn F5
3. onJoin chạy TRƯỚC onLeave
4. onJoin tìm thấy player "🐱 Alice" (không cần check disconnectedAt)
5. Update sessionId mới
6. onLeave chạy sau, thấy sessionId đã khác → ignore
7. ✅ Player giữ nguyên 5 lá bài
```

### Test 2: F5 chậm (onLeave trước onJoin)
```
1. Player "🐱 Alice" đang chơi với 5 lá bài
2. Nhấn F5
3. onLeave chạy TRƯỚC, set disconnectedAt
4. onJoin chạy sau, tìm thấy player "🐱 Alice"
5. Clear disconnectedAt, update sessionId
6. ✅ Player giữ nguyên 5 lá bài
```

### Test 3: Multiple F5 liên tiếp
```
1. Player "🐱 Alice" nhấn F5
2. onLeave1 chạy, set disconnectedAt
3. Player nhấn F5 lần 2 (trước khi rejoin)
4. onJoin1 chạy, update sessionId → sessionId_2
5. onLeave2 chạy, thấy sessionId đã khác → ignore
6. onJoin2 chạy, update sessionId → sessionId_3
7. ✅ Player vẫn giữ nguyên bài
```

## Bài học

1. **Async events không đồng bộ**: Không thể giả định thứ tự của `onLeave` và `onJoin`
2. **Race conditions**: Luôn xem xét trường hợp events chạy đồng thời
3. **Idempotency**: Logic rejoin phải hoạt động bất kể thứ tự events
4. **Cleanup**: Luôn xóa old sessionId khỏi maps để tránh memory leaks

## Files thay đổi

- `server/src/rooms/GameRoom.ts`:
  - `onJoin()`: Bỏ điều kiện `disconnectedAt !== undefined`
  - `onJoin()`: Thêm cleanup old sessionId
  - `onLeave()`: Thêm check sessionId mismatch

## Commit message

```
fix(server): resolve F5 race condition causing card loss

- Remove disconnectedAt check in onJoin to prevent race condition
- Add sessionId mismatch check in onLeave to ignore stale disconnects
- Clean up old sessionId from playerIndexMap on rejoin
- Fixes #44: Players losing all cards on F5 refresh
```
