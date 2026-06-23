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
   - `https://www.googleapis.com/auth/drive.file`  ← chỉ file do app tạo → **né CASA**
   - `https://www.googleapis.com/auth/spreadsheets`
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

## Bước 3 — Tạo Sheet riêng cho user khi đăng ký

1. Sau đăng nhập: đọc `spreadsheetId` từ **`@capacitor/preferences`**.
2. Nếu CHƯA có (user mới) → gọi Sheets API **`spreadsheets.create`** tạo file mới trên
   Drive user, với các tab + header **giống `gas/Code.gs` init** (nguồn sự thật):
   - `_Buckets` (kèm cột `F` công thức SUMIF số dư + cột `G` `floorAmount`),
     `_PaymentSources`, `_Transactions`, `_MonthlyBudget`, `_Goals`,
     `_GoalContributions`, `_AlertLog`, `_Users`, `_Settings`.
   - Seed dữ liệu mặc định (các hũ/nguồn tiền khởi tạo như bản GAS).
   - User tạo file = **chủ sở hữu**; file nằm trong phạm vi `drive.file`.
3. Lưu `spreadsheetId` vào Preferences. Lần mở sau đọc lại, không tạo trùng.
4. (Tùy mô hình chia sẻ — xem Quyết định B) có thể cho phép **nhập spreadsheetId** của
   gia đình thay vì tạo mới.

**Tái dùng**: bê nguyên phần khởi tạo sheet/headers/seed từ `gas/Code.gs` sang TS.

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

## ⚠️ Quyết định kiến trúc PHẢI chốt trước (đổi phạm vi)

### A. Cảnh báo + tổng kết định kỳ = mất "server"
Phase 4 (email/Telegram) và trigger tuần chạy **server-side trong GAS** (`MailApp`,
`UrlFetchApp`, time-driven triggers). App mobile gọi **thẳng** Sheets → **không có
server** để chạy nền/gửi mail. Các endpoint `sendTestAlert`/`weeklySummary`/
`installTriggers`/`setTelegramBotToken`/`getAlertConfig` không còn chỗ chạy. Phương án:
- **(a) Local notifications** trên máy (`@capacitor/local-notifications`) — kiểm ngưỡng
  ngay sau giao dịch, nhắc tại thiết bị. Miễn phí, nhưng không có tổng kết khi app đóng.
- **(b) Giữ một GAS mỏng** gắn vào sheet của user chỉ để chạy trigger gửi mail/Telegram
  (lai). Phức tạp khi mỗi user 1 sheet.
- **(c) Bỏ cảnh báo server trên mobile** ở v1, chỉ còn cảnh báo tức thì trong app.
→ Đề xuất v1: **(a) + (c)**.

### B. Mô hình "cả nhà dùng chung" với mỗi user 1 Sheet
Bản GAS: 1 sheet chung + whitelist `_Users`. Bản mobile per-user: ai tạo trước là chủ.
Để cả nhà dùng chung 1 ví:
- Chủ tạo spreadsheet → **chia sẻ quyền sửa** cho email thành viên (Drive API
  `permissions.create`); thành viên nhập/nhận `spreadsheetId` đó trong app (không tạo
  mới). `_Users` vẫn dùng để phân vai admin/member.
- Hoặc mỗi user 1 ví độc lập (đơn giản hơn cho v1).
→ Cần chủ dự án chốt: **chung ví** hay **ví riêng** ở v1.

### C. Bảo mật token & quota
Access token chỉ giữ trong bộ nhớ/Preferences, không log. Gộp call (`batchGet`/
`batchUpdate`) để tránh chạm quota ~60 ghi/phút/user.
