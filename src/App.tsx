import { useState } from 'react';
import { useApp } from './state';
import { useAuth } from './auth';
import { Dashboard } from './screens/Dashboard';
import { Transactions } from './screens/Transactions';
import { Report } from './screens/Report';
import { Budget } from './screens/Budget';
import { Goals } from './screens/Goals';
import { Settings } from './screens/Settings';
import { AddTransactionModal } from './components/AddTransactionModal';

type Tab = 'dashboard' | 'tx' | 'report' | 'budget' | 'goals' | 'settings';

const TABS: { key: Tab; label: string; ic: string }[] = [
  { key: 'dashboard', label: 'Tổng quan', ic: '🏠' },
  { key: 'tx', label: 'Giao dịch', ic: '🧾' },
  { key: 'report', label: 'Báo cáo', ic: '📊' },
  { key: 'budget', label: 'Ngân sách', ic: '💰' },
  { key: 'goals', label: 'Mục tiêu', ic: '🎯' },
  { key: 'settings', label: 'Cài đặt', ic: '⚙️' },
];

const TITLES: Record<Tab, string> = {
  dashboard: 'Tổng quan',
  tx: 'Giao dịch',
  report: 'Báo cáo dòng tiền',
  budget: 'Ngân sách tháng',
  goals: 'Mục tiêu tài chính',
  settings: 'Cài đặt',
};

export function App() {
  const { user, loading, error, reload } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const { quickAddOpen, openQuickAdd, closeQuickAdd } = useApp();

  // Cổng đăng nhập: chờ danh tính, chặn người ngoài whitelist.
  if (loading) return <div className="spinner" style={{ paddingTop: 80 }}>Đang xác thực…</div>;
  if (error) {
    return (
      <div className="empty" style={{ paddingTop: 80 }}>
        <div className="ic">⚠️</div>
        <p>Không kết nối được máy chủ.</p>
        <button className="btn" style={{ maxWidth: 200, margin: '12px auto 0' }} onClick={reload}>Thử lại</button>
      </div>
    );
  }
  if (!user?.authorized) {
    return (
      <div className="empty" style={{ paddingTop: 80 }}>
        <div className="ic">🔒</div>
        <p>Chưa được cấp quyền</p>
        <div className="tx-meta" style={{ marginTop: 8 }}>
          Tài khoản <b>{user?.email || '(không rõ)'}</b> chưa nằm trong danh sách
          thành viên. Liên hệ quản trị của gia đình để được thêm.
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="appbar">
        <div>
          <h1>{TITLES[tab]}</h1>
          <div className="sub">Family Wallet · Sổ thu chi gia đình</div>
        </div>
        <button className="who" onClick={() => setTab('settings')} title="Tài khoản & Cài đặt" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
          <span className="av">{user.icon ?? '👤'}</span>
          <span>{user.name?.split(' ').slice(-1)[0] || 'Bạn'}</span>
        </button>
      </header>

      <main className="screen">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'tx' && <Transactions />}
        {tab === 'report' && <Report />}
        {tab === 'budget' && <Budget />}
        {tab === 'goals' && <Goals />}
        {tab === 'settings' && <Settings />}
      </main>

      <button className="fab" onClick={openQuickAdd} aria-label="Thêm giao dịch">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`nav-item ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="ic">{t.ic}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {quickAddOpen && <AddTransactionModal onClose={closeQuickAdd} />}
    </div>
  );
}
