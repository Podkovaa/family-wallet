// In-memory mock backend for `vite dev` (when google.script.run is unavailable).
// Mirrors the shape of the GAS backend so the UI can be developed standalone.

import type {
  Bucket, PaymentSource, Transaction, DashboardData, CashflowReport,
  MonthlyBudget, TxInput, RpcResult, ManagedUser, Role,
  Goal, GoalInput, GoalType, GoalDetail,
} from '../types';
import { currentMonthKey, todayISO } from './format';

const buckets: Bucket[] = [
  { id: 'dau-tu', name: 'Đầu tư', icon: '📈', color: '#3b82f6', sortOrder: 1, balance: 50_000_000 },
  { id: 'tiet-kiem', name: 'Tiết kiệm', icon: '🐷', color: '#10b981', sortOrder: 2, balance: 30_000_000 },
  { id: 'du-phong', name: 'Dự phòng', icon: '🛡️', color: '#f59e0b', sortOrder: 3, balance: 20_000_000, floorAmount: 25_000_000 },
  { id: 'chi-tieu-gd', name: 'Chi tiêu GĐ', icon: '🏠', color: '#ef4444', sortOrder: 4, balance: 8_000_000 },
  { id: 'chua-phan-bo', name: 'Chưa phân bổ', icon: '💵', color: '#8b5cf6', sortOrder: 5, balance: 5_000_000 },
];

const sources: PaymentSource[] = [
  { id: 'tien-mat', name: 'Tiền mặt', icon: '💵' },
  { id: 'techcombank', name: 'Techcombank', icon: '🏦' },
  { id: 'vietcombank', name: 'Vietcombank', icon: '🏦' },
  { id: 'momo', name: 'Ví MoMo', icon: '📱' },
  { id: 'khac', name: 'Khác', icon: '💳' },
];

let txs: Transaction[] = [
  mkTx('tx-1', todayISO(), 'expense', 'chi-tieu-gd', '', 250_000, 'Đi chợ', 'tien-mat'),
  mkTx('tx-2', todayISO(), 'income', '', 'chua-phan-bo', 20_000_000, 'Lương tháng', 'techcombank'),
  mkTx('tx-3', todayISO(), 'transfer', 'chua-phan-bo', 'tiet-kiem', 5_000_000, 'Để dành', 'techcombank'),
];

function mkTx(
  id: string, date: string, type: Transaction['type'],
  fromBucketId: string, toBucketId: string, amount: number,
  description: string, paymentSourceId: string,
): Transaction {
  const fb = buckets.find((b) => b.id === fromBucketId);
  const tb = buckets.find((b) => b.id === toBucketId);
  const ps = sources.find((s) => s.id === paymentSourceId);
  return {
    id, date, type, fromBucketId, toBucketId, amount, description,
    bucketName: type === 'transfer' ? tb?.name ?? '' : type === 'income' ? 'Chưa phân bổ' : fb?.name ?? '',
    bucketIcon: type === 'transfer' ? tb?.icon ?? '' : type === 'income' ? '💵' : fb?.icon ?? '',
    fromBucket: fb?.name ?? '',
    paymentSourceId,
    paymentSourceName: ps?.name ?? '',
    paymentSourceIcon: ps?.icon ?? '',
    createdBy: 'me@example.com',
  };
}

const cashflow = {
  labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
  income: [18, 20, 19, 22, 20, 25].map((n) => n * 1_000_000),
  expense: [12, 14, 11, 16, 13, 15].map((n) => n * 1_000_000),
};

let budget: MonthlyBudget = { spendingLimit: 20_000_000, warnThreshold: 80, spent: 5_250_000 };

let users: ManagedUser[] = [
  { email: 'me@example.com', name: 'Chủ nhà (dev)', icon: '👑', role: 'admin', telegramChatId: '', notifyEmail: true, notifyTelegram: false, active: true, createdAt: '2026-01-01T00:00:00Z' },
  { email: 'vo@example.com', name: 'Vợ', icon: '👩', role: 'member', telegramChatId: '', notifyEmail: true, notifyTelegram: false, active: true, createdAt: '2026-02-01T00:00:00Z' },
];

interface GoalRow {
  id: string; name: string; icon: string; type: GoalType; linkedBucketId: string;
  targetAmount: number; deadline: string; createdBy: string; status: 'active' | 'done' | 'archived'; createdAt: string;
}
interface ContribRow { id: string; goalId: string; userEmail: string; amount: number; date: string; note: string; createdAt: string; }

let goals: GoalRow[] = [
  { id: 'goal-1', name: 'Mua xe máy', icon: '🛵', type: 'contribution', linkedBucketId: '', targetAmount: 40_000_000, deadline: '2026-12-31', createdBy: 'me@example.com', status: 'active', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'goal-2', name: 'Quỹ tiết kiệm', icon: '🐷', type: 'bucket', linkedBucketId: 'tiet-kiem', targetAmount: 50_000_000, deadline: '', createdBy: 'me@example.com', status: 'active', createdAt: '2026-02-01T00:00:00Z' },
];
let contribs: ContribRow[] = [
  { id: 'gc-1', goalId: 'goal-1', userEmail: 'me@example.com', amount: 10_000_000, date: '2026-03-15', note: 'Đợt đầu', createdAt: '2026-03-15T00:00:00Z' },
  { id: 'gc-2', goalId: 'goal-1', userEmail: 'vo@example.com', amount: 5_000_000, date: '2026-04-10', note: '', createdAt: '2026-04-10T00:00:00Z' },
];

function nameOf(email: string): string {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase())?.name || email.split('@')[0];
}
function goalCurrent(g: GoalRow): number {
  if (g.type === 'bucket') return buckets.find((b) => b.id === g.linkedBucketId)?.balance ?? 0;
  return contribs.filter((c) => c.goalId === g.id).reduce((s, c) => s + c.amount, 0);
}
function enrichGoal(g: GoalRow): Goal {
  const contributors = g.type === 'contribution'
    ? Object.values(contribs.filter((c) => c.goalId === g.id).reduce<Record<string, { email: string; name: string; amount: number }>>((acc, c) => {
        const k = c.userEmail.toLowerCase();
        acc[k] = acc[k] || { email: k, name: nameOf(c.userEmail), amount: 0 };
        acc[k].amount += c.amount;
        return acc;
      }, {})).sort((a, b) => b.amount - a.amount)
    : [];
  return { ...g, current: goalCurrent(g), contributors };
}

const alertSettings = { budget: true, floor: true, cashflow: true, goal: true };
let telegramConfigured = false;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}

export function mockCall<T>(fn: string, args: unknown[]): Promise<T> {
  switch (fn) {
    case 'getAssetBuckets':
      // Mirror backend: mọi hũ đều có floorAmount (mặc định 0).
      return delay(buckets.map((b) => ({ ...b, floorAmount: b.floorAmount ?? 0 })) as unknown as T);
    case 'getPaymentSources':
      return delay(sources as unknown as T);
    case 'getDashboardData':
      return delay({
        totalAssets: buckets.reduce((s, b) => s + b.balance, 0),
        buckets,
        monthIncome: 20_000_000,
        monthExpense: 5_250_000,
        monthNet: 14_750_000,
        cashflow,
      } as DashboardData as unknown as T);
    case 'getTransactions':
      return delay([...txs] as unknown as T);
    case 'addTransaction': {
      const tx = args[0] as TxInput;
      const id = 'tx-' + Math.random().toString(36).slice(2, 8);
      txs = [mkTx(id, tx.date ?? todayISO(), tx.type, tx.fromBucketId ?? '', tx.toBucketId ?? '',
        Number(tx.amount), tx.description ?? '', tx.paymentSourceId ?? 'tien-mat'), ...txs];
      return delay({ success: true, id } as RpcResult as unknown as T);
    }
    case 'deleteTransaction': {
      const id = args[0] as string;
      txs = txs.filter((t) => t.id !== id);
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'updateTransaction': {
      const [id, tx] = args as [string, TxInput];
      txs = txs.filter((t) => t.id !== id);
      const newId = 'tx-' + Math.random().toString(36).slice(2, 8);
      txs = [mkTx(newId, tx.date ?? todayISO(), tx.type, tx.fromBucketId ?? '', tx.toBucketId ?? '',
        Number(tx.amount), tx.description ?? '', tx.paymentSourceId ?? 'tien-mat'), ...txs];
      return delay({ success: true, id: newId } as RpcResult as unknown as T);
    }
    case 'getCashflowReport':
      return delay({
        totalIncome: 124_000_000,
        totalExpense: 81_000_000,
        netCashflow: 43_000_000,
        totalAssets: buckets.reduce((s, b) => s + b.balance, 0),
        cashflow,
        categoryBreakdown: buckets.slice(0, 4).map((b, i) => ({
          name: b.name, icon: b.icon, color: b.color, amount: (i + 1) * 3_000_000,
        })),
        sourceBreakdown: sources.slice(0, 3).map((s, i) => ({
          name: s.name, icon: s.icon, color: ['#10b981', '#3b82f6', '#f59e0b'][i], amount: (i + 1) * 4_000_000,
        })),
        monthlyDetail: cashflow.labels.map((m, i) => ({
          month: m, income: cashflow.income[i], expense: cashflow.expense[i],
          net: cashflow.income[i] - cashflow.expense[i], assets: (i + 1) * 18_000_000,
        })),
      } as CashflowReport as unknown as T);
    case 'getMonthlyBudget':
      return delay(budget as unknown as T);
    case 'setMonthlyBudget': {
      const [, spendingLimit, warnThreshold] = args as [string, number, number];
      budget = { ...budget, spendingLimit: Number(spendingLimit), warnThreshold: Number(warnThreshold) || 80 };
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'recalculateBalances':
      return delay({ success: true, message: 'Đã kiểm tra & sửa công thức.' } as RpcResult as unknown as T);
    case 'getCurrentUser': {
      const me = users.find((u) => u.email === 'me@example.com');
      return delay({
        email: me?.email ?? 'me@example.com', name: me?.name ?? 'Chủ nhà (dev)',
        icon: me?.icon ?? '👑', role: me?.role ?? 'admin',
        telegramChatId: me?.telegramChatId ?? '', notifyEmail: me?.notifyEmail ?? true,
        notifyTelegram: me?.notifyTelegram ?? false, authorized: true,
      } as unknown as T);
    }
    case 'listUsers':
      return delay([...users] as unknown as T);
    case 'addUser': {
      const input = args[0] as { email: string; name?: string; role?: Role };
      const email = (input.email || '').trim().toLowerCase();
      if (!email.includes('@')) return delay({ success: false, message: 'Email không hợp lệ.' } as RpcResult as unknown as T);
      if (users.some((u) => u.email.toLowerCase() === email)) return delay({ success: false, message: 'Email đã tồn tại.' } as RpcResult as unknown as T);
      users = [...users, { email, name: input.name || email.split('@')[0], icon: '👤', role: input.role === 'admin' ? 'admin' : 'member', telegramChatId: '', notifyEmail: true, notifyTelegram: false, active: true, createdAt: todayISO() }];
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'updateUser': {
      const [email, patch] = args as [string, Partial<ManagedUser>];
      users = users.map((u) => (u.email.toLowerCase() === email.toLowerCase() ? { ...u, ...patch } : u));
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'deactivateUser': {
      const email = args[0] as string;
      users = users.map((u) => (u.email.toLowerCase() === email.toLowerCase() ? { ...u, active: false } : u));
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'setMyNotificationPrefs': {
      const p = args[0] as { notifyEmail?: boolean; notifyTelegram?: boolean; telegramChatId?: string };
      users = users.map((u) => (u.email === 'me@example.com' ? { ...u, ...p } : u));
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'listGoals': {
      const sorted = [...goals].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99');
      });
      return delay(sorted.map(enrichGoal) as unknown as T);
    }
    case 'createGoal': {
      const input = args[0] as GoalInput;
      const name = (input.name || '').trim();
      if (!name) return delay({ success: false, message: 'Mục tiêu cần có tên.' } as RpcResult as unknown as T);
      const target = Number(input.targetAmount);
      if (!target || target <= 0) return delay({ success: false, message: 'Số tiền mục tiêu phải lớn hơn 0.' } as RpcResult as unknown as T);
      const type: GoalType = input.type === 'bucket' ? 'bucket' : 'contribution';
      if (type === 'bucket' && !input.linkedBucketId) return delay({ success: false, message: 'Mục tiêu kiểu gắn-hũ cần chọn hũ liên kết.' } as RpcResult as unknown as T);
      const id = 'goal-' + Math.random().toString(36).slice(2, 8);
      goals = [...goals, { id, name, icon: input.icon || '🎯', type, linkedBucketId: input.linkedBucketId || '', targetAmount: target, deadline: input.deadline || '', createdBy: 'me@example.com', status: 'active', createdAt: todayISO() }];
      return delay({ success: true, id } as RpcResult as unknown as T);
    }
    case 'updateGoal': {
      const [id, patch] = args as [string, Partial<GoalRow>];
      goals = goals.map((g) => (g.id === id ? { ...g, ...patch } : g));
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'deleteGoal': {
      const id = args[0] as string;
      goals = goals.filter((g) => g.id !== id);
      contribs = contribs.filter((c) => c.goalId !== id);
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'contributeToGoal': {
      const [goalId, amount, note, date] = args as [string, number, string?, string?];
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return delay({ success: false, message: 'Không tìm thấy mục tiêu.' } as RpcResult as unknown as T);
      if (goal.type === 'bucket') return delay({ success: false, message: 'Mục tiêu gắn-hũ tự cập nhật theo số dư hũ.' } as RpcResult as unknown as T);
      const amt = Number(amount);
      if (!amt || amt <= 0) return delay({ success: false, message: 'Số tiền đóng góp phải lớn hơn 0.' } as RpcResult as unknown as T);
      contribs = [...contribs, { id: 'gc-' + Math.random().toString(36).slice(2, 8), goalId, userEmail: 'me@example.com', amount: amt, date: date || todayISO(), note: note || '', createdAt: todayISO() }];
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'getGoalProgress': {
      const id = args[0] as string;
      const g = goals.find((x) => x.id === id);
      if (!g) return delay(null as unknown as T);
      const detail: GoalDetail = {
        id: g.id, name: g.name, icon: g.icon, type: g.type, linkedBucketId: g.linkedBucketId,
        targetAmount: g.targetAmount, deadline: g.deadline, status: g.status, current: goalCurrent(g),
        contributions: contribs.filter((c) => c.goalId === id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((c) => ({ ...c, userName: nameOf(c.userEmail) })),
      };
      return delay(detail as unknown as T);
    }
    case 'setBucketFloor': {
      const [bucketId, floor] = args as [string, number];
      const b = buckets.find((x) => x.id === bucketId);
      if (!b) return delay({ success: false, message: 'Không tìm thấy hũ.' } as RpcResult as unknown as T);
      b.floorAmount = Number(floor) || 0;
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'getAlertConfig':
      return delay({ ...alertSettings, telegramConfigured } as unknown as T);
    case 'getAlertSettings':
      return delay({ ...alertSettings } as unknown as T);
    case 'setAlertSettings': {
      Object.assign(alertSettings, args[0] as Partial<typeof alertSettings>);
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'setTelegramBotToken': {
      telegramConfigured = String(args[0] ?? '').trim() !== '';
      return delay({ success: true } as RpcResult as unknown as T);
    }
    case 'installTriggers':
      return delay({ success: true, message: 'Đã cài lịch gửi tổng kết 8h sáng thứ Hai hằng tuần.' } as RpcResult as unknown as T);
    case 'sendTestAlert':
      return delay({ success: true, message: 'Đã gửi thử (giả lập dev).' } as RpcResult as unknown as T);
    default:
      console.warn(`[mock] chưa hỗ trợ hàm: ${fn}`, args, 'month=', currentMonthKey());
      return delay(null as unknown as T);
  }
}
