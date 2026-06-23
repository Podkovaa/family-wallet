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

## Cấu trúc (Capacitor đặt ở GỐC repo)

```
D:\pj02\
├─ capacitor.config.ts   ← cấu hình app (appId, webDir = mobile/www)   [ở GỐC]
├─ vite.config.mobile.ts ← build src/ ra mobile/www (đa file, KHÔNG singlefile)
├─ package.json          ← chung 1 node_modules (đã có @capacitor/core/cli/android)
├─ android/              ← (tự sinh bởi `npx cap add android`) — gitignore
├─ ios/                  ← (tạo sau, khi làm iOS) — gitignore
├─ src/lib/sheetsAdapter.ts ← khung lớp dữ liệu Sheets API (việc chính còn lại)
└─ mobile/
   ├─ README.md          ← file này
   ├─ PLAN.md            ← kế hoạch chi tiết các bước
   └─ www/               ← (tự sinh) bản build web cho Capacitor bọc — gitignore
```

> Đặt Capacitor ở **gốc** (chuẩn Capacitor: project root = nơi có package.json →
> android/ios sinh ở đây) để plugin/sync chạy ổn định và **dùng chung 1
> node_modules** (rẻ, đúng tiêu chí). `android/` & `ios/` vẫn là 2 folder riêng.

## Thiết lập (chạy ở thư mục GỐC `D:\pj02`)

### Đã làm sẵn (commit trên nhánh `mobile`)
- Cài `@capacitor/core` + `@capacitor/cli` + `@capacitor/android` (v8).
- `capacitor.config.ts` ở gốc; script `npm run build:mobile` và `npm run cap:android`.
- Build web ra `mobile/www` **chạy OK** (đa file). Bản GAS vẫn 46/46 test xanh.

### Việc anh cần làm để thấy app chạy (cần Android Studio)
> ⚠️ Máy hiện **chưa có JDK + Android Studio** → đây là bước chặn duy nhất còn lại.

```bash
# 0) Cài Android Studio (kèm Android SDK + emulator) và JDK 17, đặt ANDROID_HOME.

# 1) Build web cho mobile (đã có script)
npm run build:mobile          # = vite build --config vite.config.mobile.ts → mobile/www

# 2) Thêm nền tảng Android (sinh ./android ở GỐC) + đồng bộ
npx cap add android
npx cap sync android          # hoặc gộp bước 1+2 lần sau: npm run cap:android

# 3) Mở Android Studio chạy emulator / xuất APK-AAB
npx cap open android
```

Lần sau chỉ cần: `npm run cap:android` rồi `npx cap open android`.

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
