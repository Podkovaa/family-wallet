<div align="center">

# 💰 Family Wallet — Sổ Thu Chi Gia Đình

**Ứng dụng quản lý tài chính gia đình theo mô hình "hũ" (envelope budgeting)**
Chạy hoàn toàn **miễn phí** trên hạ tầng Google — không cần server, không tốn phí.

Backend: **Google Apps Script + Google Sheets** · Frontend: **React + TypeScript** (build thành **một file HTML** duy nhất)

</div>

---

## 📑 Mục lục

- [Tính năng chính](#-tính-năng-chính)
- [Công nghệ & cách hoạt động](#-công-nghệ--cách-hoạt-động)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [🚀 HƯỚNG DẪN THIẾT LẬP TỪ ĐẦU (cho người mới)](#-hướng-dẫn-thiết-lập-từ-đầu-cho-người-mới)
  - [Bước 0 — Cài công cụ cần thiết](#bước-0--cài-công-cụ-cần-thiết)
  - [Bước 1 — Tải mã nguồn về máy](#bước-1--tải-mã-nguồn-về-máy)
  - [Bước 2 — Tạo dự án Google Apps Script](#bước-2--tạo-dự-án-google-apps-script)
  - [Bước 3 — Cài & đăng nhập clasp](#bước-3--cài--đăng-nhập-clasp)
  - [Bước 4 — Bật Apps Script API](#bước-4--bật-apps-script-api)
  - [Bước 5 — Build & đẩy code lên Google](#bước-5--build--đẩy-code-lên-google)
  - [Bước 6 — Deploy thành Web App (lấy link)](#bước-6--deploy-thành-web-app-lấy-link)
  - [Bước 7 — Mở app lần đầu & mời thành viên](#bước-7--mở-app-lần-đầu--mời-thành-viên)
  - [Bước 8 — Bật cảnh báo Telegram (tuỳ chọn)](#bước-8--bật-cảnh-báo-telegram-tuỳ-chọn)
- [🔄 Quy trình cập nhật code (giữ nguyên link)](#-quy-trình-cập-nhật-code-giữ-nguyên-link)
- [👀 Xem thử nhanh không cần Google](#-xem-thử-nhanh-không-cần-google)
- [🧰 Lệnh thường dùng](#-lệnh-thường-dùng)
- [🩺 Xử lý sự cố thường gặp](#-xử-lý-sự-cố-thường-gặp)
- [🗺️ Lộ trình phát triển](#️-lộ-trình-phát-triển)
- [⚠️ Giới hạn nền tảng](#️-giới-hạn-nền-tảng)
- [📄 Giấy phép](#-giấy-phép)

---

## ✨ Tính năng chính

- **Thu / chi / chuyển khoản** giữa các "hũ" tiền (tiền mặt, ngân hàng, ví, tiết kiệm…).
- **Ngân sách theo tháng** với hạn mức từng nhóm chi tiêu.
- **Mục tiêu tài chính** 2 kiểu: *gắn hũ* (tiến độ = số dư hũ) và *đóng góp* (theo dõi ai góp bao nhiêu).
- **Báo cáo & biểu đồ** trực quan (Chart.js), tự đổi màu theo giao diện sáng/tối.
- **Đa người dùng** với phân quyền **admin / thành viên**, mỗi giao dịch ghi lại người tạo.
- **Cảnh báo tự động** qua **Email** và **Telegram** theo 4 ngưỡng (vượt hạn mức, hũ dưới sàn, dòng tiền âm, mục tiêu chậm) + **tổng kết hằng tuần**.
- **Giao diện tối / sáng / theo hệ thống**, tối ưu cho điện thoại, hỗ trợ "Thêm vào màn hình chính" (PWA).

## 🏗 Công nghệ & cách hoạt động

| Thành phần | Công nghệ |
|---|---|
| Giao diện (frontend) | React 18 + TypeScript, Vite, Chart.js |
| Backend & lưu trữ | Google Apps Script (V8) + Google Sheets |
| Đóng gói | Vite + `vite-plugin-singlefile` → **một** `index.html` |
| Triển khai | `clasp` (Google Apps Script CLI) |
| Kiểm thử | Vitest (46 unit test) |

**Ý tưởng cốt lõi:** toàn bộ React được **gói vào một file `index.html`** duy nhất. Google Apps Script phục vụ file đó qua `HtmlService`, còn dữ liệu được đọc/ghi trực tiếp vào một **Google Sheet** (app tự tạo ở lần chạy đầu). Nhờ vậy bạn có một web app đầy đủ mà **không cần thuê server** và **không mất phí**.

```
Trình duyệt (React)  ⇄  google.script.run  ⇄  Code.gs (Apps Script)  ⇄  Google Sheets
```

## 📁 Cấu trúc thư mục

```
.
├── src/                  # Frontend — NƠI BẠN SỬA CODE
│   ├── main.tsx          # điểm khởi động React
│   ├── App.tsx           # khung app: bottom-nav, nút + (FAB)
│   ├── state.tsx         # context + hook gọi backend (useRpc)
│   ├── auth.tsx          # đăng nhập / phân quyền
│   ├── theme.tsx         # giao diện sáng/tối
│   ├── types.ts          # kiểu dữ liệu dùng chung
│   ├── lib/              # rpc, mock (chạy dev), validation, format, goals, alerts, theme
│   ├── components/       # AddTransactionModal, Charts
│   └── screens/          # Dashboard, Transactions, Report, Budget, Goals, Settings
├── gas/                  # Thư mục clasp đẩy lên Google
│   ├── appsscript.json   # manifest (quyền, web app)
│   ├── Code.gs           # toàn bộ backend (nguồn — sửa ở đây)
│   └── index.html        # ⚙️ DO `npm run build` SINH RA — không sửa tay, không commit
├── index.html            # khung HTML cho Vite (chứa script áp theme chống nháy)
├── vite.config.ts        # cấu hình build → gas/index.html
├── .clasp.json.example   # mẫu cấu hình clasp (copy thành .clasp.json rồi điền scriptId)
├── package.json          # scripts: dev / build / test / push
└── README.md
```

> 💡 `gas/index.html`, `review.html` và `.clasp.json` **không** nằm trong repo (xem `.gitignore`): file đầu là sản phẩm build, file cuối chứa `scriptId` riêng của mỗi người.

---

## 🚀 HƯỚNG DẪN THIẾT LẬP TỪ ĐẦU (cho người mới)

> Phần này viết cho người **chưa từng lập trình**. Cứ làm tuần tự từng bước, copy đúng từng dòng lệnh. Mỗi lệnh đều có giải thích ngắn gọn.

### Bước 0 — Cài công cụ cần thiết

Bạn cần cài 2 phần mềm (chỉ làm một lần cho máy):

1. **Node.js** (kèm sẵn `npm`) — tải bản **LTS** tại <https://nodejs.org> rồi cài như phần mềm bình thường.
2. **Git** — tải tại <https://git-scm.com/downloads> rồi cài (để tải code và đẩy lên GitHub).

Kiểm tra đã cài xong chưa — mở **Terminal** (macOS) hoặc **Git Bash / PowerShell** (Windows) và gõ:

```bash
node -v        # ví dụ hiện: v20.x.x
npm -v         # ví dụ hiện: 10.x.x
git --version  # ví dụ hiện: git version 2.x
```

Nếu cả ba lệnh đều in ra số phiên bản là đạt. (Nếu báo "command not found", hãy đóng và mở lại cửa sổ Terminal, hoặc cài lại.)

### Bước 1 — Tải mã nguồn về máy

```bash
git clone https://github.com/Podkovaa/family-wallet.git
cd family-wallet
npm install        # tải các thư viện (tạo thư mục node_modules, hơi lâu lần đầu)
```

> `git clone` = tải toàn bộ code về. `npm install` = tải thư viện cần thiết. Chỉ chạy `npm install` lại khi `package.json` thay đổi.

### Bước 2 — Tạo dự án Google Apps Script

Bạn cần một "dự án Apps Script" trên Google để chứa code backend. Có **2 cách**, chọn 1:

**Cách A — Tạo bằng tay (dễ hình dung):**

1. Mở <https://script.google.com> → bấm **New project** (Dự án mới).
2. Đặt tên dự án (ví dụ *Family Wallet*) ở góc trên bên trái.
3. Vào **Project Settings** (biểu tượng ⚙️ bên trái) → tìm mục **Script ID** → **sao chép** chuỗi ID đó. Trông giống:
   `1Bml76NsCUSc8yaaAv-wUE2HmJaIOGYhUnyc9XMYAy6...`

**Cách B — Tạo bằng clasp (nhanh, làm sau khi xong Bước 3):**

```bash
clasp create --type standalone --title "Family Wallet" --rootDir gas
```
Lệnh này tạo dự án mới và **tự điền `scriptId`** vào `.clasp.json` cho bạn.

> 📌 **App tự tạo Google Sheet dữ liệu** ("Family Wallet — Data") trong Google Drive của bạn ở lần chạy đầu tiên — **bạn không cần tạo Sheet thủ công**.

### Bước 3 — Cài & đăng nhập clasp

`clasp` là công cụ dòng lệnh chính thức của Google để đẩy code lên Apps Script.

```bash
npm install -g @google/clasp     # cài clasp toàn cục (một lần cho máy)
clasp login                      # mở trình duyệt để đăng nhập Google
```

- Cửa sổ trình duyệt sẽ mở ra → **đăng nhập bằng tài khoản Google** sẽ làm chủ app → bấm **Allow** để cấp quyền.
- Xong sẽ thấy dòng *"You are logged in as ..."*. Thông tin đăng nhập lưu ở `~/.clasprc.json` (**tuyệt đối không chia sẻ file này**).

Nếu bạn dùng **Cách A** ở Bước 2, hãy tạo file cấu hình clasp từ mẫu và dán Script ID vào:

```bash
cp .clasp.json.example .clasp.json     # Windows PowerShell: copy .clasp.json.example .clasp.json
```
Mở `.clasp.json` bằng trình soạn thảo, thay `PASTE_YOUR_SCRIPT_ID_HERE` bằng Script ID đã sao chép ở Bước 2:

```json
{
  "scriptId": "DÁN_SCRIPT_ID_CỦA_BẠN_VÀO_ĐÂY",
  "rootDir": "gas"
}
```

### Bước 4 — Bật Apps Script API

Đây là công tắc bắt buộc để clasp được phép đẩy code (làm **một lần** cho tài khoản):

1. Mở <https://script.google.com/home/usersettings>
2. Gạt **Google Apps Script API** sang **ON**.
3. Đợi khoảng **1 phút** để Google cập nhật.

> Bỏ qua bước này, `clasp push` sẽ báo lỗi *"User has not enabled the Apps Script API"*.

### Bước 5 — Build & đẩy code lên Google

```bash
npm run push
```

Lệnh `push` làm 2 việc liền nhau:
1. `npm run build` — biên dịch React trong `src/` thành **một** `gas/index.html`.
2. `clasp push -f` — đẩy 3 file (`appsscript.json`, `Code.gs`, `index.html`) lên dự án Apps Script của bạn (ghi đè bản cũ).

Thành công sẽ thấy: `Pushed 3 files.`

### Bước 6 — Deploy thành Web App (lấy link)

Đẩy code lên thôi thì chưa có link để dùng — cần "triển khai" (deploy) thành Web App:

```bash
clasp deploy --description "Bản đầu tiên"
```

Kết quả in ra một dòng như:
```
Deployed AKfycbw30Te...HzsunFKHp8Oh @1
```
Chuỗi `AKfycbw...` là **Deployment ID**. Link web app của bạn là:

```
https://script.google.com/macros/s/AKfycbw...HzsunFKHp8Oh/exec
```

> 📝 **Hãy lưu lại Deployment ID này** — lần cập nhật sau bạn dùng nó để **giữ nguyên link** (xem mục [Quy trình cập nhật](#-quy-trình-cập-nhật-code-giữ-nguyên-link)).

**Cấu hình web app** đã được đặt sẵn trong `gas/appsscript.json`:
- `executeAs: USER_ACCESSING` — chạy bằng tài khoản của người truy cập (mỗi người thấy quyền của mình).
- `access: ANYONE` — bất kỳ ai có **tài khoản Google** đều mở được (vẫn phải đăng nhập).

### Bước 7 — Mở app lần đầu & mời thành viên

1. Mở link `/exec` ở Bước 6 bằng **chính tài khoản Google đã deploy**.
   - Lần đầu Google hiện màn hình xin cấp quyền → bấm **Allow / Cho phép**.
   - Tài khoản này **tự động trở thành admin** và app tự tạo Google Sheet dữ liệu.
2. Vào tab **Cài đặt → Thành viên** → thêm **email Google** của từng người trong nhà.
3. **Quan trọng:** vì web app chạy theo người truy cập (`USER_ACCESSING`), bạn phải **chia sẻ Google Sheet dữ liệu** cho họ:
   - Mở Google Drive của admin → tìm file **"Family Wallet — Data"**.
   - Bấm **Share / Chia sẻ** → thêm email các thành viên với quyền **Editor (Chỉnh sửa)**.
   - Không chia sẻ thì thành viên mở app sẽ bị lỗi không đọc/ghi được dữ liệu.

> Nếu link `/exec` báo *"Không thể mở tệp / Sorry, unable to open the file"* ngay sau khi deploy: đó là **độ trễ lan truyền** của Google, đợi 1–2 phút rồi tải lại; đảm bảo đang đăng nhập đúng tài khoản (thử cửa sổ ẩn danh chỉ một tài khoản).

### Bước 8 — Bật cảnh báo Telegram (tuỳ chọn)

1. Mở **@BotFather** trên Telegram → gõ `/newbot` → đặt tên → nhận **bot token**.
2. Vào app → **Cài đặt → Bot Telegram (quản trị)** → dán token → **Lưu** (token lưu trong Script Properties, không nằm trong Sheet).
3. Mỗi thành viên: nhắn một tin bất kỳ cho bot, rồi mở `https://api.telegram.org/bot<TOKEN>/getUpdates` để lấy `chat.id` của mình.
4. Trong **Cài đặt → Nhận cảnh báo**: bật **Telegram**, dán `chat ID`, **Lưu**.
5. Bấm **Gửi cảnh báo thử** để kiểm tra. (Email chỉ cần bật **Email** — gửi tới chính email Google đang đăng nhập.)
6. Admin bấm **Cài lịch gửi tổng kết tuần** một lần để tạo trigger gửi 8h sáng thứ Hai.

---

## 🔄 Quy trình cập nhật code (giữ nguyên link)

Khi đã chạy ổn, mỗi lần sửa code và muốn cập nhật **mà không đổi link web app**, dùng đúng **Deployment ID** đã lưu ở Bước 6:

```bash
npm run push                                              # build + đẩy code mới lên GAS
clasp deploy --deploymentId <DEPLOYMENT_ID_CỦA_BẠN>       # tạo phiên bản mới, GIỮ NGUYÊN link
```

> ⚠️ Nếu chạy `clasp deploy` **không kèm** `--deploymentId`, clasp tạo một deployment **mới với link khác** — lúc đó phải gửi lại link cho mọi người. Luôn kèm `--deploymentId` để link cố định.
>
> Deployment tự sinh tên `@HEAD` là **chỉ-đọc**, không deploy đè vào nó được — hãy dùng deployment do bạn tự tạo ở Bước 6.

## 👀 Xem thử nhanh không cần Google

`npm run build` đồng thời tạo file **`review.html`** ở thư mục gốc — một trang HTML **tự chứa**, mở thẳng bằng trình duyệt:

```
# macOS/Linux:  mở file review.html bằng trình duyệt
# Windows:      bấm đúp review.html
```

Vì không có `google.script.run`, app tự chạy bằng **dữ liệu mẫu (mock)** trong bộ nhớ trình duyệt — đủ để xem toàn bộ giao diện (Tổng quan, Giao dịch, Báo cáo, Ngân sách, Mục tiêu, Cài đặt, dark mode). Mọi thao tác **không đụng dữ liệu thật**.

## 🧰 Lệnh thường dùng

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy local kèm mock backend (mở `http://localhost:5173`) — sửa code thấy đổi ngay, **không cần Google**. |
| `npm run test` | Chạy 46 unit test (Vitest). |
| `npm run build` | Biên dịch `src/` → `gas/index.html` + `review.html`. |
| `npm run push` | `build` + `clasp push -f` (đẩy code lên Apps Script). |
| `clasp deploy --deploymentId <id>` | Tạo phiên bản mới giữ nguyên link web app. |

## 🩺 Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| `User has not enabled the Apps Script API` | Chưa làm [Bước 4](#bước-4--bật-apps-script-api). Bật API rồi đợi 1 phút, chạy lại. |
| `Invalid manifest ... webapp.access` | Giá trị `access` trong `gas/appsscript.json` phải là `ANYONE` (không phải `ANYONE_WITH_GOOGLE_ACCOUNT`). |
| `Read-only deployments may not be modified` | Bạn đang deploy đè vào `@HEAD` (chỉ-đọc). Tạo deployment mới bằng `clasp deploy` (không kèm id) một lần, rồi dùng id đó. |
| Mở link báo *"Không thể mở tệp"* | Độ trễ lan truyền sau deploy (đợi 1–2 phút) **hoặc** đang đăng nhập nhiều tài khoản Google. Thử cửa sổ ẩn danh với đúng một tài khoản. |
| Thành viên mở app bị lỗi đọc/ghi dữ liệu | Chưa **chia sẻ Google Sheet "Family Wallet — Data"** (quyền Editor) cho email của họ — xem [Bước 7](#bước-7--mở-app-lần-đầu--mời-thành-viên). |
| Sửa code nhưng app trên điện thoại không đổi | Trình duyệt cache bản cũ. Tải lại bằng cách kéo làm mới, mở tab ẩn danh, hoặc thêm `?v=2` vào cuối link để ép tải mới. |
| `clasp` báo chưa đăng nhập | Chạy lại `clasp login`. |

## 🗺️ Lộ trình phát triển

- [x] **Phase 0** — Nền tooling: Vite + React + TS, build single-file, dựng lại UI từ source sạch.
- [x] **Phase 1** — Sửa lỗi & kiểm tra dữ liệu: xóa/sửa giao dịch (giữ nguồn tiền), lưu ngân sách, chặn số âm/thập phân/ngày tương lai (cả client lẫn server), nút đồng bộ số dư.
- [x] **Phase 2** — Đa người dùng: Google login (`USER_ACCESSING` + `ANYONE`), whitelist `_Users`, vai trò admin/member, ghi `createdBy` mỗi giao dịch, cổng đăng nhập, màn Cài đặt quản lý thành viên. Người đầu tiên truy cập tự thành admin.
- [x] **Phase 3** — Mục tiêu tài chính: sheet `_Goals` + `_GoalContributions`, 2 kiểu *gắn hũ* và *đóng góp*; thanh tiến độ, đếm ngược hạn, gợi ý "cần để dành X/tháng".
- [x] **Phase 4** — Cảnh báo Email + Telegram: `checkThresholds_` chạy sau mỗi giao dịch theo **4 ngưỡng**, gửi qua MailApp + Telegram; `_AlertLog` chống gửi trùng; tổng kết hằng tuần qua time-driven trigger.
- [x] **Phase 5** — Hoàn thiện: **dark mode** (Sáng/Tối/Theo hệ thống, áp trước render để không nháy), polish UI, meta **PWA**. Tổng **46 test** xanh.

## ⚠️ Giới hạn nền tảng

- **Service worker / chạy offline không khả thi** vì GAS phục vụ trang qua iframe sandbox của `HtmlService`. App vẫn hỗ trợ "Thêm vào màn hình chính" (PWA standalone) nhưng cần mạng.
- **Hạn mức miễn phí của Google Apps Script** (số email/ngày, số lần gọi `UrlFetchApp`, thời gian chạy) đủ cho phạm vi gia đình; `_AlertLog` chống gửi trùng trong cùng tháng để tiết kiệm.
- Mỗi thành viên phải có **tài khoản Google** và được **chia sẻ quyền sửa** Sheet dữ liệu.

## 📄 Giấy phép

Phát hành theo giấy phép [MIT](./LICENSE) — tự do dùng, sửa, chia sẻ.

---

<div align="center">
Made with ❤️ for families who want to manage money together.
</div>
