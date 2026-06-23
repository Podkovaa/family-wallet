# Family Wallet — Mobile (Capacitor, Android-first)

Nhánh `mobile`. Mục tiêu: phát hành app lên **CH Play (Android trước)**, sau đó App
Store, với chi phí phát triển/hạ tầng **thấp nhất có thể**. DB vẫn là **Google Sheet
của chính người dùng** (họ sở hữu dữ liệu → bảo mật + 0đ lưu trữ).

## Vì sao Capacitor (rẻ nhất với điểm xuất phát này)

App web React hiện có (`../src`) **tái dùng gần như 100%**. Mấu chốt: **mọi lời gọi
backend đều đi qua đúng một hàm** `callGAS(fn, ...args)` ở `../src/lib/rpc.ts`. Hàm
này đã có 2 nhánh: GAS thật (`google.script.run`) và mock (dev). Mobile chỉ cần thêm
**nhánh thứ 3** → gọi thẳng **Google Sheets API** bằng token OAuth của user. UI, màn
hình, biểu đồ, và toàn bộ logic thuần trong `../src/lib/*` (validation, goals,
alerts, format, theme) **giữ nguyên**.

```
UI React (../src)  ──►  callGAS(fn, args)  ──►  ┌ google.script.run   (bản web GAS)
   (không đổi)              (rpc.ts)            ├ mockCall            (dev)
                                                └ sheetsCall          (MOBILE — viết mới)
```

## Chi phí

| Khoản | Giá | Ghi chú |
|---|---|---|
| Google Play | **$25 một lần** | Làm Android trước → chỉ tốn khoản này |
| Apple Developer | $99/năm | Hoãn tới khi làm iOS |
| Máy Mac | — | Chỉ cần cho build iOS. Android **không cần** |
| Google Sheets/Drive API (`drive.file`) | **0đ** | Giữ ràng buộc miễn phí |

## Cấu trúc

```
mobile/
├─ README.md            ← file này
├─ capacitor.config.ts  ← cấu hình app (appId, webDir=www)
├─ .gitignore           ← bỏ www/ android/ ios/ node_modules
├─ www/                 ← (tự sinh) bản build web cho Capacitor bọc
├─ android/             ← (tự sinh bởi `cap add android`)
└─ ios/                 ← (tạo sau, khi làm iOS)

../vite.config.mobile.ts  ← build ../src ra mobile/www (đa file, KHÔNG singlefile)
../src/lib/sheetsAdapter.ts ← khung lớp dữ liệu Sheets API (việc chính còn lại)
```

> Dùng **chung** `package.json` và `node_modules` ở gốc (đỡ cài 2 lần = tiết kiệm
> đĩa + thời gian). Không tạo project node riêng trong `mobile/`.

## Thiết lập lần đầu (chạy ở thư mục GỐC `D:\pj02`)

> Yêu cầu: đã cài **Android Studio** (kèm Android SDK) cho bước build Android.

```bash
# 1) Cài Capacitor + plugin đăng nhập Google (cập nhật package.json + lockfile)
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/android @codetrix-studio/capacitor-google-auth

# 2) Build web app cho mobile (đa file) ra mobile/www
npx vite build --config vite.config.mobile.ts

# 3) Khởi tạo Capacitor đọc cấu hình ở mobile/ rồi thêm nền tảng Android
cd mobile
npx cap add android      # sinh mobile/android (project Gradle)
npx cap sync android     # đồng bộ www + plugin sang android

# 4) Mở Android Studio để chạy/emulator/xuất APK-AAB
npx cap open android
```

Lần build lại về sau: `npx vite build --config vite.config.mobile.ts` → `cd mobile &&
npx cap sync android`.

## Đăng nhập Google + tạo Sheet riêng cho user (việc chính còn lại)

1. **Google Cloud project** → bật **Google Sheets API** + **Drive API**. Tạo OAuth
   client (Android). Scope xin: `https://www.googleapis.com/auth/drive.file` +
   `https://www.googleapis.com/auth/spreadsheets`.
   - ⚠️ Dùng `drive.file` (chỉ thấy file do app tạo) để **né CASA** (đánh giá bảo
     mật restricted-scope rất đắt). Đây là điểm tiết kiệm tiền then chốt.
2. Native Google Sign-In (plugin `capacitor-google-auth`) → lấy **access token**.
3. Lần đầu đăng nhập: tạo spreadsheet mới trên Drive user (Drive API
   `files.create` hoặc Sheets `spreadsheets.create`), seed các sheet
   `_Buckets/_PaymentSources/_Transactions/_MonthlyBudget/_Goals/...` **giống hệt**
   `gas/Code.gs` đang init. Lưu `spreadsheetId` vào local (Preferences).
4. Cài đặt seam: trong `../src/lib/rpc.ts`, thêm nhánh — nếu chạy trong Capacitor
   (`(window as any).Capacitor`) thì gọi `sheetsCall(ctx, fn, args)` thay vì
   `google.script.run`. Triển khai từng endpoint trong `sheetsAdapter.ts` bằng
   Sheets API v4 (`values.get` / `values.append` / `batchUpdate`), tái dùng logic
   thuần ở `../src/lib/*`.

## Lưu ý đánh đổi (đã thống nhất)

- Sheets **không phải DB thật**: mỗi call ~vài trăm ms, không transaction, dễ race
  nếu 2 thiết bị sửa cùng lúc; quota ~60 ghi/phút/user. Đủ cho app tài chính gia
  đình ít ghi → cần thêm **cache offline + đồng bộ**.
- Apple: nếu dùng Google Sign-In thì **bắt buộc thêm Sign in with Apple** (chỉ khi
  làm iOS).
- Nhánh này **vượt ràng buộc "chỉ GAS"** → mọi thứ vẫn miễn phí về hạ tầng, nhưng
  bất kỳ đề xuất nào cần hạ tầng trả phí phải hỏi chủ dự án trước.
