import { useEffect, useState } from 'react';
import { callGAS } from '../lib/rpc';
import { useApp, useRpc } from '../state';
import { useAuth } from '../auth';
import { formatVND, formatNumber, currentMonthKey } from '../lib/format';
import { parseAmountInput } from '../lib/validation';
import type { AlertConfig, Bucket, MonthlyBudget, RpcResult } from '../types';

const ALERT_LABELS: { key: keyof Omit<AlertConfig, 'telegramConfigured'>; label: string; desc: string }[] = [
  { key: 'budget', label: '⚠️ Vượt hạn mức chi tiêu', desc: 'Khi chi tháng chạm ngưỡng cảnh báo / vượt 100% hạn mức.' },
  { key: 'floor', label: '🏺 Hũ dưới mức sàn', desc: 'Khi số dư một hũ tụt dưới mức sàn đã đặt.' },
  { key: 'cashflow', label: '🔴 Dòng tiền tháng âm', desc: 'Khi tổng chi vượt tổng thu trong tháng.' },
  { key: 'goal', label: '🎯 Mục tiêu chậm tiến độ', desc: 'Khi mục tiêu có hạn đang đi chậm so với kế hoạch.' },
];

export function Budget() {
  const { refresh } = useApp();
  const month = currentMonthKey();
  const { data } = useRpc<MonthlyBudget>('getMonthlyBudget', [month]);

  const [limit, setLimit] = useState(0);
  const [warn, setWarn] = useState(80);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) { setLimit(data.spendingLimit); setWarn(data.warnThreshold); }
  }, [data]);

  const spent = data?.spent ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  const color = pct >= 95 ? 'var(--expense)' : pct >= warn ? 'var(--amber)' : 'var(--income)';
  const status = pct >= 95 ? 'Vượt hạn mức!' : pct >= warn ? 'Sắp chạm ngưỡng' : 'An toàn';

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await callGAS<RpcResult>('setMonthlyBudget', month, limit, warn);
      if (res?.success === false) { alert(res.message ?? 'Không lưu được.'); return; }
      setSaved(true);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Chi tiêu tháng {month.split('-')[1]}/{month.split('-')[0]}</div>
        <div className="row-between mt8">
          <span className="value expense">{formatVND(spent)}</span>
          <span className="tx-meta">/ {formatVND(limit)}</span>
        </div>
        <div className="progress mt8"><div style={{ width: `${pct}%`, background: color }} /></div>
        <div className="mt8" style={{ color, fontWeight: 600, fontSize: '0.85rem' }}>{pct}% — {status}</div>
      </div>

      <div className="card">
        <div className="card-title">Thiết lập hạn mức</div>
        <div className="field">
          <label>Hạn mức chi tiêu / tháng (VND)</label>
          <input
            inputMode="numeric"
            value={limit ? formatNumber(limit) : ''}
            onChange={(e) => setLimit(parseAmountInput(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Ngưỡng cảnh báo: {warn}%</label>
          <input type="range" min={50} max={100} value={warn} onChange={(e) => setWarn(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <button className="btn" disabled={saving || limit <= 0} onClick={save}>
          {saving ? 'Đang lưu…' : saved ? '✓ Đã lưu' : 'Lưu hạn mức'}
        </button>
      </div>

      <BucketFloors />

      <AlertToggles />

      <div className="note warn">
        💡 Mẹo: đặt hạn mức chi tiêu thấp hơn thu nhập ~20% để luôn có phần để dành & đầu tư.
      </div>
    </>
  );
}

// ── Mức sàn cảnh báo cho từng hũ ────────────────────────────────────────
function BucketFloors() {
  const { refresh } = useApp();
  const { data: buckets, reload } = useRpc<Bucket[]>('getAssetBuckets');
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function valueFor(b: Bucket): number {
    return edits[b.id] ?? b.floorAmount ?? 0;
  }

  async function save(b: Bucket) {
    setSavingId(b.id);
    try {
      const res = await callGAS<RpcResult>('setBucketFloor', b.id, valueFor(b));
      if (res?.success === false) { alert(res.message ?? 'Không lưu được.'); return; }
      reload();
      refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Mức sàn cảnh báo theo hũ</div>
      <div className="tx-meta" style={{ marginBottom: 10 }}>
        Khi số dư hũ tụt dưới mức sàn, hệ thống sẽ gửi cảnh báo. Để 0 = không cảnh báo hũ đó.
      </div>
      {(buckets ?? []).map((b) => (
        <div key={b.id} className="row-between" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{b.icon} {b.name}</span>
          <input
            inputMode="numeric"
            style={{ width: 120, padding: 8, border: '1px solid var(--border)', borderRadius: 10, textAlign: 'right' }}
            value={valueFor(b) ? formatNumber(valueFor(b)) : ''}
            placeholder="0"
            onChange={(e) => setEdits((m) => ({ ...m, [b.id]: parseAmountInput(e.target.value) }))}
          />
          <button className="icon-btn" title="Lưu" disabled={savingId === b.id} onClick={() => save(b)}>
            {savingId === b.id ? '…' : '💾'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Bật/tắt từng ngưỡng cảnh báo (chỉ admin chỉnh) ──────────────────────
function AlertToggles() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, reload } = useRpc<AlertConfig>('getAlertConfig');
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(key: keyof Omit<AlertConfig, 'telegramConfigured'>) {
    if (!isAdmin || !data) return;
    setBusy(key);
    try {
      const res = await callGAS<RpcResult>('setAlertSettings', { [key]: !data[key] });
      if (res?.success === false) { alert(res.message ?? 'Không lưu được.'); return; }
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Ngưỡng cảnh báo</div>
      {!isAdmin && (
        <div className="tx-meta" style={{ marginBottom: 8 }}>Chỉ quản trị viên mới bật/tắt được các ngưỡng.</div>
      )}
      {ALERT_LABELS.map((a) => (
        <label key={a.key} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: isAdmin ? 1 : 0.6 }}>
          <div style={{ flex: 1, paddingRight: 10 }}>
            <div style={{ fontWeight: 600 }}>{a.label}</div>
            <div className="tx-meta">{a.desc}</div>
          </div>
          <input
            type="checkbox"
            disabled={!isAdmin || busy === a.key}
            checked={data ? data[a.key] : true}
            onChange={() => toggle(a.key)}
          />
        </label>
      ))}
      {data && !data.telegramConfigured && (
        <div className="tx-meta" style={{ marginTop: 10, color: 'var(--amber)' }}>
          ⚠️ Chưa cấu hình bot Telegram — cảnh báo Telegram sẽ không gửi được. Vào Cài đặt để thiết lập.
        </div>
      )}
    </div>
  );
}
