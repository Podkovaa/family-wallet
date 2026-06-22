import { useApp, useRpc } from '../state';
import { formatVND } from '../lib/format';
import { CashflowChart, BreakdownChart } from '../components/Charts';
import type { CashflowReport, TimeRange } from '../types';

const RANGES: { key: TimeRange; label: string }[] = [
  { key: '1T', label: '1 tháng' },
  { key: '3T', label: '3 tháng' },
  { key: '6T', label: '6 tháng' },
  { key: '1N', label: '1 năm' },
  { key: 'all', label: 'Tất cả' },
];

export function Report() {
  const { timeRange, setTimeRange } = useApp();
  const { data, loading } = useRpc<CashflowReport>('getCashflowReport', [timeRange], [timeRange]);

  if (loading && !data) return <div className="spinner">Đang tải…</div>;
  if (!data) return <div className="empty">Không có dữ liệu</div>;

  return (
    <>
      <div className="filter-bar">
        {RANGES.map((r) => (
          <button key={r.key} className={`pill ${timeRange === r.key ? 'active' : ''}`} onClick={() => setTimeRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="stat-row" style={{ marginBottom: 14 }}>
        <div className="card stat">
          <div className="label">Tổng thu</div>
          <div className="value income">{formatVND(data.totalIncome)}</div>
        </div>
        <div className="card stat">
          <div className="label">Tổng chi</div>
          <div className="value expense">{formatVND(data.totalExpense)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Dòng tiền</div>
        <div style={{ height: 200 }}><CashflowChart cashflow={data.cashflow} /></div>
      </div>

      <div className="card">
        <div className="card-title">Chi theo hũ</div>
        <div style={{ height: 220 }}><BreakdownChart items={data.categoryBreakdown} /></div>
      </div>

      <div className="card">
        <div className="card-title">Chi theo nguồn tiền</div>
        <div style={{ height: 220 }}><BreakdownChart items={data.sourceBreakdown} /></div>
      </div>

      <div className="card">
        <div className="card-title">Chi tiết theo tháng</div>
        {data.monthlyDetail.map((m) => (
          <div className="bucket" key={m.month}>
            <span className="name">{m.month}</span>
            <span className="value income" style={{ fontSize: '0.8rem', marginRight: 8 }}>+{formatVND(m.income)}</span>
            <span className="value expense" style={{ fontSize: '0.8rem' }}>−{formatVND(m.expense)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
