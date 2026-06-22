import { useApp, useRpc } from '../state';
import { formatVND } from '../lib/format';
import { goalPct, isGoalReached } from '../lib/goals';
import { CashflowChart } from '../components/Charts';
import type { DashboardData, Goal } from '../types';

export function Dashboard() {
  const { timeRange } = useApp();
  const { data, loading } = useRpc<DashboardData>('getDashboardData', [timeRange], [timeRange]);
  const { data: goals } = useRpc<Goal[]>('listGoals');

  if (loading && !data) return <div className="spinner">Đang tải…</div>;
  if (!data) return <div className="empty">Không có dữ liệu</div>;

  const topGoals = (goals ?? []).filter((g) => g.status === 'active').slice(0, 2);

  return (
    <>
      <div className="card hero">
        <div className="label">Tổng tài sản</div>
        <div className="value">{formatVND(data.totalAssets)}</div>
      </div>

      <div className="stat-row" style={{ marginBottom: 14 }}>
        <div className="card stat">
          <div className="label">Thu tháng này</div>
          <div className="value income">{formatVND(data.monthIncome)}</div>
        </div>
        <div className="card stat">
          <div className="label">Chi tháng này</div>
          <div className="value expense">{formatVND(data.monthExpense)}</div>
        </div>
      </div>

      {topGoals.length > 0 && (
        <div className="card">
          <div className="card-title">Mục tiêu nổi bật</div>
          {topGoals.map((g) => {
            const pct = goalPct(g.current, g.targetAmount);
            const reached = isGoalReached(g.current, g.targetAmount);
            const color = reached ? 'var(--income)' : pct >= 70 ? 'var(--primary)' : pct >= 40 ? 'var(--amber)' : 'var(--expense)';
            return (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div className="row-between" style={{ fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600 }}>{g.icon} {g.name} {reached && '✅'}</span>
                  <span style={{ color, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div className="progress mt8"><div style={{ width: `${pct}%`, background: color }} /></div>
                <div className="tx-meta" style={{ marginTop: 4 }}>{formatVND(g.current)} / {formatVND(g.targetAmount)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="card-title">Dòng tiền 6 tháng</div>
        <div style={{ height: 200 }}>
          <CashflowChart cashflow={data.cashflow} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Các hũ tài sản</div>
        {data.buckets.map((b) => (
          <div className="bucket" key={b.id}>
            <span className="icon">{b.icon}</span>
            <span className="name">{b.name}</span>
            <span className="bal" style={{ color: b.balance < 0 ? 'var(--expense)' : 'var(--text)' }}>
              {formatVND(b.balance)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
