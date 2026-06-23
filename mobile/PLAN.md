# Kế hoạch phát triển Mobile — chi tiết cho session sau

Nhánh `mobile`. Mục tiêu session sau: **nối lớp dữ liệu Sheets API** để app Capacitor
chạy thật trên Android, DB là **Google Sheet riêng của từng user**. Khung đã có ở
`README.md`. File này mô tả **việc cần làm theo thứ tự**.

> ⚠️ Đọc 2 "Quyết định kiến trúc phải chốt" ở cuối TRƯỚC khi code — chúng đổi phạm vi.

---

## Bước 1 — Google Cloud project + OAuth (`drive.file`)

1. Tạo **Google Cloud project** (console.cloud.google.com).
2. **Bật API**: *Google Sheets API* + *Google Drive API*.
3. **OAuth consent screen**: User type **External**; thêm scope:
   - `openid`, `email`, `profile`
   - `https://www.googleapis.com/auth/drive.file`  ← file app **tạo** HOẶC user **chọn
     qua Google Picker** → **né CASA**
   - ⚠️ **TRÁNH** scope `.../auth/spreadsheets` (full) — đây là *restricted scope* →
     kéo theo đánh giá CASA đắt. Với **ví chung có sẵn** (B2), cho thành viên **chọn
     file qua Google Picker** để cấp quyền dưới `drive.file`, rồi Sheets API thao tác
     trên đúng file đó. Giữ trọn lợi thế né CASA.
   - Giai đoạn đầu để **Testing** + thêm test users (chưa cần verify để chạy nội bộ).
4. **Tạo OAuth Client ID**:
   - **Android client**: package name `com.familywallet.app` + **SHA-1** của keystore
     ký app (debug và release khác nhau → khai cả hai).
   - **Web client**: dùng làm `serverClientId` cho plugin đăng nhập (bắt buộc với
     `capacitor-google-auth` để lấy idToken/serverAuthCode).

**Output**: web client ID + android client ID, lưu vào cấu hình app (không hardcode
secret vào repo — dùng biến/`strings.xml`).

---

## Bước 2 — Đăng nhập Google native

1. Cấu hình plugin trong `mobile/capacitor.config.ts`:
   ```ts
   plugins: {
     GoogleAuth: {
       scopes: ['profile', 'email',
         'https://www.googleapis.com/auth/drive.file',
         'https://www.googleapis.com/auth/spreadsheets'],
       serverClientId: '<WEB_CLIENT_ID>',
       forceCodeForRefreshToken: true,
     },
   }
   ```
2. Android: thêm `server_client_id` vào `strings.xml`; theo README plugin (đăng ký
   trong `MainActivity` nếu bản plugin yêu cầu).
3. Code đăng nhập (mới, ví dụ `src/lib/mobileAuth.ts`):
   - `GoogleAuth.initialize()` → `GoogleAuth.signIn()` → lấy `result.authentication.accessToken`.
   - **Token hết hạn ~1h** → cần `GoogleAuth.refresh()` hoặc đăng nhập lại; bọc 1 hàm
     `getAccessToken()` tự refresh trước khi gọi Sheets API.
4. Thay **màn login web hiện tại** (auth-gate `App.tsx:38-58`) bằng màn login mobile
   có nút **"Tiếp tục với Google"** gọi `signIn()` (đây cũng là phần 3a của backlog UI).

---

## Bước 3 — Kết nối ví chung (B2: cả nhà dùng 1 sheet)

> ĐÃ CHỐT B2 — **ví chung qua chia sẻ Drive**, KHÔNG tạo sheet riêng mỗi user.

1. Sau đăng nhập: đọc `spreadsheetId` từ **`@capacitor/preferences`**.
2. **Chủ nhà (admin) lần đầu**: có 2 trường hợp
   - **Đã có ví GAS đang chạy** (bản web hiện tại) → chỉ cần **nhập/quét `spreadsheetId`
     của sheet gia đình đó** vào app (hoặc chọn qua Google Picker). Dùng lại nguyên data.
   - **Gia đình mới hoàn toàn** → app `spreadsheets.create` tạo sheet với tab/header/seed
     **giống `gas/Code.gs` init** (`_Buckets` cột F SUMIF + G floorAmount,
     `_PaymentSources`, `_Transactions`, `_MonthlyBudget`, `_Goals`,
     `_GoalContributions`, `_AlertLog`, `_Users`, `_Settings`).
3. **Mời thành viên**: chủ cấp quyền sửa sheet cho email thành viên (Drive API
   `permissions.create`, hoặc share thủ công). Thành viên mở app → **chọn sheet chung
   qua Google Picker** (cấp quyền `drive.file` cho đúng file) → lưu `spreadsheetId`.
   `_Users` giữ vai trò admin/member (Phase 2) — kiểm tra qua `getCurrentUser`.
4. Lưu `spreadsheetId` vào Preferences; lần mở sau đọc lại, không tạo trùng.

**Tái dùng**: bê nguyên phần khởi tạo sheet/headers/seed từ `gas/Code.gs` sang TS (chỉ
dùng khi tạo ví mới).

---

## Bước 4 — Nối seam + triển khai từng endpoint trong `sheetsAdapter.ts`

1. **Nối seam** ở `src/lib/rpc.ts`: thêm nhánh trước nhánh mock —
   ```ts
   const isMobile = !!(globalThis as any).Capacitor?.isNativePlatform?.();
   if (isMobile) return sheetsCall<T>(getCtx(), fn, args);
   ```
   với `getCtx()` trả `{ accessToken, spreadsheetId }` (token tự refresh).
2. **Triển khai `sheetsCall`** ánh xạ TÊN hàm → thao tác Sheets API v4. Danh sách
   ~29 endpoint lấy từ **`gas/Code.gs`** + **`src/lib/mock.ts`** (nguồn đối chiếu).
   Nhóm chính:

   | Nhóm | Endpoint (vd) | Thao tác Sheets API | Tái dùng logic |
   |---|---|---|---|
   | Đọc | `getTransactions`, `getAssetBuckets`, `getPaymentSources`, `getMonthlyBudget`, `listGoals`, `getGoalProgress` | `values.get` / `values.batchGet` rồi map sang object | parse/format `src/lib/*` |
   | Ghi giao dịch | `addTransaction`, `updateTransaction`, `deleteTransaction` | `values.append` / `values.update` / xoá hàng qua `batchUpdate(deleteDimension)` | `validation.ts`, `validateTx_` |
   | Ngân sách/số dư | `setMonthlyBudget`, `setBucketFloor`, `recalculateBalances` | `values.update` đúng ô; số dư hũ dựa **công thức SUMIF** (Sheets tự tính như GAS) | — |
   | Mục tiêu | `createGoal`, `updateGoal`, `deleteGoal`, `contributeToGoal` | append/update/batchUpdate | `goals.ts` |
   | Người dùng | `getCurrentUser`, `listUsers`, `addUser`, `updateUser`, `deactivateUser`, `setMyNotificationPrefs` | đọc/ghi `_Users` | — |

   - Mỗi endpoint: validate bằng logic thuần đã có (KHÔNG viết lại), trả đúng shape
     mà UI đang mong đợi (đối chiếu `src/lib/mock.ts` để khớp 100%).
3. **Test**: viết test thuần cho mapper row↔object (giống các `*.test.ts` hiện có).

---

## Bước 5 — Build & chạy Android

```bash
npx vite build --config vite.config.mobile.ts
cd mobile && npx cap sync android && npx cap open android
```
Chạy trên emulator/thiết bị, đăng nhập Google thật, kiểm thêm/sửa/xoá giao dịch ghi
xuống đúng Sheet của user.

---

## ✅ Quyết định kiến trúc ĐÃ CHỐT (2026-06-23): A2 + B2

**A2 — Giữ GAS gửi email/Telegram + tổng kết tuần.** **B2 — Ví chung qua chia sẻ Drive.**
Hệ quả lớn (theo hướng tiết kiệm): **backend GAS + sheet chung đã có sẵn & đang chạy**
(bản web hiện tại) → mobile chỉ là **thêm một client** vào hệ thống đó, không dựng lại
backend.

### Cảnh báo (A2) hoạt động thế nào
- **GAS vẫn deploy, gắn vào sheet gia đình chung** — giữ nguyên `sendAlert_`/
  `weeklySummary`/Telegram của Phase 4. Email/Telegram + tổng kết tuần **chạy y như cũ**.
- ⚠️ Mobile ghi **thẳng** vào sheet (không qua GAS `addTransaction`) nên hook cảnh báo
  **tức thì** sau giao dịch sẽ KHÔNG tự kích hoạt. Cách xử lý:
  - Đổi `checkThresholds_` từ hook-tức-thì sang **time-trigger dày** (vd mỗi giờ) đọc
    sheet → gửi nếu chạm ngưỡng. `_AlertLog` chống spam vẫn dùng. (sửa nhẹ ở `gas/Code.gs`)
  - (Tùy chọn thêm) `@capacitor/local-notifications` để báo **tức thì tại máy** ngay khi
    ghi giao dịch — cho phản hồi nhanh, không thay email/Telegram.
- `getAlertConfig`/`setAlertSettings`/`setTelegramBotToken`: gọi qua Sheets (đọc/ghi
  `_Settings`) hoặc giữ ở màn Cài đặt bản web; mobile có thể chỉ đọc.

### Ví chung (B2) — xem Bước 3 đã cập nhật
Chủ dùng lại sheet GAS đang chạy (hoặc tạo mới nếu gia đình mới); mời thành viên bằng
Drive share + thành viên chọn sheet qua Google Picker (giữ scope `drive.file`).

### Bảo mật token & quota
Access token chỉ giữ trong Preferences, không log. Gộp `batchGet`/`batchUpdate` để
tránh quota ~60 ghi/phút/user (và quota thực thi GAS cho trigger cảnh báo).

### Lưu ý chọn lựa kỹ thuật còn mở (không chặn, quyết khi code)
- Tần suất time-trigger cảnh báo (mỗi giờ / vài giờ / ngày) — đổi độ "tức thì" lấy quota.
- Có thêm local-notifications cho phản hồi tức thì hay không.
