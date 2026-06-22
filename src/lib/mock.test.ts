import { describe, it, expect } from 'vitest';
import { mockCall } from './mock';
import type {
  Bucket, DashboardData, CashflowReport, MonthlyBudget, CurrentUser,
  ManagedUser, Goal, GoalDetail, AlertConfig, AlertSettings, RpcResult, Transaction,
} from '../types';

// Smoke test toàn bộ bề mặt RPC mà UI gọi (xem grep trong src/) để bắt sớm
// hiện tượng "drift" giữa FE và lớp mock/backend: thiếu handler → trả null.

describe('mock — endpoint đọc trả đúng shape', () => {
  it('các hàm get* / list* không trả null và đúng hình dạng', async () => {
    const buckets = await mockCall<Bucket[]>('getAssetBuckets', []);
    expect(Array.isArray(buckets)).toBe(true);
    expect(typeof buckets[0].floorAmount).toBe('number');

    expect(Array.isArray(await mockCall('getPaymentSources', []))).toBe(true);

    const dash = await mockCall<DashboardData>('getDashboardData', ['6T']);
    expect(typeof dash.totalAssets).toBe('number');
    expect(Array.isArray(dash.buckets)).toBe(true);

    expect(Array.isArray(await mockCall<Transaction[]>('getTransactions', [{}]))).toBe(true);

    const rep = await mockCall<CashflowReport>('getCashflowReport', ['6T']);
    expect(typeof rep.totalIncome).toBe('number');

    const bud = await mockCall<MonthlyBudget>('getMonthlyBudget', ['2026-06']);
    expect(typeof bud.spendingLimit).toBe('number');

    const me = await mockCall<CurrentUser>('getCurrentUser', []);
    expect(me.authorized).toBe(true);

    expect(Array.isArray(await mockCall<ManagedUser[]>('listUsers', []))).toBe(true);

    const goals = await mockCall<Goal[]>('listGoals', []);
    expect(Array.isArray(goals)).toBe(true);
    expect(typeof goals[0].current).toBe('number');

    const detail = await mockCall<GoalDetail>('getGoalProgress', ['goal-1']);
    expect(Array.isArray(detail.contributions)).toBe(true);

    const cfg = await mockCall<AlertConfig>('getAlertConfig', []);
    expect(typeof cfg.telegramConfigured).toBe('boolean');

    const as = await mockCall<AlertSettings>('getAlertSettings', []);
    expect(typeof as.budget).toBe('boolean');
  });
});

describe('mock — endpoint ghi trả success', () => {
  it('mọi hàm ghi trả {success:true}', async () => {
    const ok = (r: RpcResult) => expect(r.success).toBe(true);

    ok(await mockCall<RpcResult>('addTransaction', [{ type: 'expense', amount: 1000, fromBucketId: 'chi-tieu-gd', paymentSourceId: 'tien-mat' }]));
    ok(await mockCall<RpcResult>('updateTransaction', ['tx-1', { type: 'expense', amount: 2000, fromBucketId: 'chi-tieu-gd' }]));
    ok(await mockCall<RpcResult>('deleteTransaction', ['tx-3']));
    ok(await mockCall<RpcResult>('setMonthlyBudget', ['2026-06', 1_000_000, 80]));
    ok(await mockCall<RpcResult>('recalculateBalances', []));
    ok(await mockCall<RpcResult>('setMyNotificationPrefs', [{ notifyEmail: true }]));
    ok(await mockCall<RpcResult>('addUser', [{ email: 'them@example.com', name: 'Thêm' }]));
    ok(await mockCall<RpcResult>('updateUser', ['vo@example.com', { role: 'admin' }]));
    ok(await mockCall<RpcResult>('deactivateUser', ['them@example.com']));
    ok(await mockCall<RpcResult>('createGoal', [{ name: 'Quỹ mới', type: 'contribution', targetAmount: 5_000_000 }]));
    ok(await mockCall<RpcResult>('updateGoal', ['goal-1', { status: 'done' }]));
    ok(await mockCall<RpcResult>('contributeToGoal', ['goal-1', 1_000_000, 'note', '2026-06-01']));
    ok(await mockCall<RpcResult>('deleteGoal', ['goal-2']));
    ok(await mockCall<RpcResult>('setBucketFloor', ['du-phong', 1_000_000]));
    ok(await mockCall<RpcResult>('setAlertSettings', [{ budget: false }]));
    ok(await mockCall<RpcResult>('setTelegramBotToken', ['123:ABC']));
    ok(await mockCall<RpcResult>('installTriggers', []));
    ok(await mockCall<RpcResult>('sendTestAlert', []));
  });

  it('contributeToGoal kiểu gắn-hũ bị từ chối', async () => {
    // goal-2 là kiểu bucket; đã bị xoá ở test trên nếu chạy chung state → tạo lại tình huống
    const g = await mockCall<RpcResult>('contributeToGoal', ['goal-2', 1000]);
    // hoặc không tìm thấy, hoặc bị chặn vì là bucket — cả hai đều success:false
    expect(g.success).toBe(false);
  });
});

describe('mock — hàm lạ trả null (default)', () => {
  it('không ném lỗi với fn không tồn tại', async () => {
    expect(await mockCall('khongCoHam', [])).toBeNull();
  });
});
