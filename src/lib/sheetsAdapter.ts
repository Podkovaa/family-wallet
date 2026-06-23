// Lớp dữ liệu cho bản MOBILE (Capacitor).
//
// Định tuyến callGAS(fn, ...args) sang Google Sheets API v4 thay cho
// google.script.run. Sẽ được nối vào ./rpc.ts khi bản Capacitor + đăng nhập
// Google native đã sẵn sàng. HIỆN CHƯA được import ở đâu — chỉ là khung (seam).
//
// Triển khai sau: mỗi endpoint GAS (xem gas/Code.gs, ~29 hàm get*/add*/update*…)
// ánh xạ sang Sheets API (values.get / values.append / batchUpdate). Tái dùng
// LOGIC THUẦN ở ./validation, ./goals, ./alerts, ./format — không viết lại.

export interface SheetsContext {
  /** Access token lấy từ Google Sign-In native (scope: drive.file, spreadsheets). */
  accessToken: string;
  /** Spreadsheet riêng của user (tạo lần đầu, lưu local — Preferences). */
  spreadsheetId: string;
}

/**
 * Điểm vào của lớp dữ liệu mobile, cùng chữ ký logic với callGAS:
 * gọi theo TÊN hàm backend + tham số, trả Promise kết quả.
 */
export async function sheetsCall<T = unknown>(
  _ctx: SheetsContext,
  fn: string,
  _args: unknown[],
): Promise<T> {
  // TODO(mobile): chuyển `fn` thành thao tác Sheets API tương ứng.
  throw new Error(`[sheetsAdapter] chưa triển khai endpoint: ${fn}`);
}
