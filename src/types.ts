// Shared types mirroring the Google Apps Script backend return shapes.

export type TxType = 'income' | 'expense' | 'transfer';

export interface Bucket {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  balance: number;
  /** Mức sàn cảnh báo (Phase 4). Có thể không có ở dữ liệu cũ. */
  floorAmount?: number;
}

export interface PaymentSource {
  id: string;
  name: string;
  icon: string;
}

/** Giao dịch như backend getTransactions trả về (đã enrich tên hũ/nguồn). */
export interface Transaction {
  id: string;
  date: string;
  type: TxType;
  fromBucketId: string;
  toBucketId: string;
  bucketName: string;
  bucketIcon: string;
  fromBucket: string;
  amount: number;
  description: string;
  paymentSourceId: string;
  paymentSourceName: string;
  paymentSourceIcon: string;
  /** Email người nhập (Phase 2). */
  createdBy?: string;
}

export interface Cashflow {
  labels: string[];
  income: number[];
  expense: number[];
}

export interface DashboardData {
  totalAssets: number;
  buckets: Bucket[];
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  cashflow: Cashflow;
}

export interface CategorySlice {
  name: string;
  icon: string;
  color: string;
  amount: number;
}

export interface MonthlyDetailRow {
  month: string;
  income: number;
  expense: number;
  net: number;
  assets: number;
}

export interface CashflowReport {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  totalAssets: number;
  cashflow: Cashflow;
  categoryBreakdown: CategorySlice[];
  sourceBreakdown: CategorySlice[];
  monthlyDetail: MonthlyDetailRow[];
}

export interface MonthlyBudget {
  spendingLimit: number;
  warnThreshold: number;
  spent: number;
}

/** Payload gửi lên addTransaction / updateTransaction. */
export interface TxInput {
  type: TxType;
  amount: number;
  fromBucketId?: string;
  toBucketId?: string;
  description?: string;
  paymentSourceId?: string;
  date?: string;
}

export interface RpcResult {
  success: boolean;
  id?: string;
  message?: string;
}

export type TimeRange = '1T' | '3T' | '6T' | '1N' | 'all';

export type Role = 'admin' | 'member';

/** Người dùng hiện tại (từ getCurrentUser) — kèm cờ authorized cho cổng đăng nhập. */
export interface CurrentUser {
  email: string;
  name: string;
  icon?: string;
  role: Role | '';
  telegramChatId?: string;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  authorized: boolean;
}

/** Thành viên trong danh sách quản lý (từ listUsers, admin). */
export interface ManagedUser {
  email: string;
  name: string;
  icon: string;
  role: Role;
  telegramChatId: string;
  notifyEmail: boolean;
  notifyTelegram: boolean;
  active: boolean;
  createdAt: string;
}

// ── Mục tiêu tài chính (Phase 3) ─────────────────────────────────────────

/**
 * Kiểu mục tiêu:
 * - `bucket`: gắn với một hũ — tiến độ = số dư hũ liên kết (tự cập nhật).
 * - `contribution`: đóng góp độc lập — tiến độ = tổng các khoản đóng góp.
 */
export type GoalType = 'bucket' | 'contribution';

export type GoalStatus = 'active' | 'done' | 'archived';

/** Ai đã góp bao nhiêu (mục tiêu kiểu contribution). */
export interface GoalContributor {
  email: string;
  name: string;
  amount: number;
}

/** Mục tiêu kèm tiến độ đã tính sẵn ở backend (từ listGoals). */
export interface Goal {
  id: string;
  name: string;
  icon: string;
  type: GoalType;
  linkedBucketId: string;
  targetAmount: number;
  /** '' nếu không đặt hạn, hoặc YYYY-MM-DD. */
  deadline: string;
  createdBy: string;
  status: GoalStatus;
  createdAt: string;
  /** Số tiền hiện có hướng tới mục tiêu (đồng) — backend tính. */
  current: number;
  /** Chỉ có ở kiểu contribution. */
  contributors?: GoalContributor[];
}

/** Một khoản đóng góp (đã enrich tên người góp). */
export interface GoalContribution {
  id: string;
  goalId: string;
  userEmail: string;
  userName: string;
  amount: number;
  date: string;
  note: string;
  createdAt: string;
}

/** Chi tiết một mục tiêu kèm lịch sử đóng góp (từ getGoalProgress). */
export interface GoalDetail {
  id: string;
  name: string;
  icon: string;
  type: GoalType;
  linkedBucketId: string;
  targetAmount: number;
  deadline: string;
  status: GoalStatus;
  current: number;
  contributions: GoalContribution[];
}

/** Payload gửi lên createGoal. */
export interface GoalInput {
  name: string;
  icon?: string;
  type: GoalType;
  linkedBucketId?: string;
  targetAmount: number;
  deadline?: string;
}

// ── Cảnh báo (Phase 4) ───────────────────────────────────────────────────

/** Bật/tắt từng ngưỡng cảnh báo (lưu chung, admin chỉnh). */
export interface AlertSettings {
  budget: boolean;
  floor: boolean;
  cashflow: boolean;
  goal: boolean;
}

/** Cấu hình cảnh báo cho FE (từ getAlertConfig). */
export interface AlertConfig extends AlertSettings {
  telegramConfigured: boolean;
}
