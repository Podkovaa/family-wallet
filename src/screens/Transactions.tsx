import { useMemo, useState } from 'react';
import { callGAS } from '../lib/rpc';
import { useApp, useRpc } from '../state';
import { formatVND, formatDate } from '../lib/format';
import { AddTransactionModal } from '../components/AddTransactionModal';
import type { RpcResult, Transaction, TxType } from '../types';

const FILTERS: { key: 'all' | TxType; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'income', label: 'Thu' },
  { key: 'expense', label: 'Chi' },
  { key: 'transfer', label: 'Phân bổ' },
];

const SIGN: Record<TxType, string> = { income: '+', expense: '−', transfer: '' };

export function Transactions() {
  const { refresh } = useApp();
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const { data, loading } = useRpc<Transaction[]>('getTransactions', [{ type: null, month: null }]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const list = useMemo(
    () => (data ?? []).filter((t) => filter === 'all' || t.type === filter),
    [data, filter],
  );

  const groups = useMemo(() => {
    const m: Record<string, Transaction[]> = {};
    list.forEach((t) => { (m[t.date] ??= []).push(t); });
    return Object.keys(m).sort((a, b) => b.localeCompare(a)).map((d) => ({ date: d, items: m[d] }));
  }, [list]);

  async function remove(t: Transaction) {
    if (deletingId) return;
    if (!confirm(`Xóa giao dịch "${t.description || formatVND(t.amount)}"?`)) return;
    setDeletingId(t.id);
    try {
      const res = await callGAS<RpcResult>('deleteTransaction', t.id);
      if (res?.success === false) alert(res.message ?? 'Không xóa được.');
      else refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading && !data) return <div className="spinner">Đang tải…</div>;

  return (
    <>
      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button key={f.key} className={`pill ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty"><div className="ic">🧾</div><p>Chưa có giao dịch nào</p></div>
      ) : (
        groups.map((g) => (
          <div className="card" key={g.date}>
            <div className="group-date">📅 {formatDate(g.date)}</div>
            {g.items.map((t) => (
              <div className={`tx-item ${t.type}`} key={t.id}>
                <span className="tx-icon">{t.bucketIcon}</span>
                <div className="tx-main">
                  <div className="tx-desc">{t.description || t.bucketName}</div>
                  <div className="tx-meta">
                    {t.paymentSourceIcon} {t.paymentSourceName}
                    {t.createdBy ? ` · ${t.createdBy.split('@')[0]}` : ''}
                  </div>
                </div>
                <span className={`tx-amount value ${t.type}`}>{SIGN[t.type]}{formatVND(t.amount)}</span>
                <div className="tx-actions">
                  <button className="icon-btn" title="Sửa" onClick={() => setEditing(t)}>✏️</button>
                  <button className="icon-btn danger" title="Xóa" disabled={deletingId === t.id} onClick={() => remove(t)}>
                    {deletingId === t.id ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {editing && <AddTransactionModal editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
