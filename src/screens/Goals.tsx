import { useMemo, useState } from 'react';
import { callGAS } from '../lib/rpc';
import { useApp, useRpc } from '../state';
import { formatVND, formatNumber, todayISO } from '../lib/format';
import { parseAmountInput } from '../lib/validation';
import {
  goalPct, goalRemaining, isGoalReached, deadlineLabel, requiredMonthlySaving,
} from '../lib/goals';
import type { Bucket, Goal, GoalContribution, GoalInput, GoalType, RpcResult } from '../types';

export function Goals() {
  const { refresh } = useApp();
  const { data: goals, loading } = useRpc<Goal[]>('listGoals');
  const [creating, setCreating] = useState(false);
  const [contributeTo, setContributeTo] = useState<Goal | null>(null);

  const active = (goals ?? []).filter((g) => g.status === 'active');
  const archived = (goals ?? []).filter((g) => g.status !== 'active');

  return (
    <>
      <button className="btn mt8" style={{ marginBottom: 14 }} onClick={() => setCreating(true)}>
        + Tạo mục tiêu mới
      </button>

      {loading && !goals ? (
        <div className="spinner">Đang tải…</div>
      ) : active.length === 0 && archived.length === 0 ? (
        <div className="empty">
          <div className="ic">🎯</div>
          <p>Chưa có mục tiêu nào. Đặt mục tiêu đầu tiên cho cả nhà!</p>
        </div>
      ) : (
        <>
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} onContribute={() => setContributeTo(g)} onChanged={refresh} />
          ))}
          {archived.length > 0 && (
            <div className="card-title" style={{ marginTop: 8 }}>Đã hoàn thành / lưu trữ</div>
          )}
          {archived.map((g) => (
            <GoalCard key={g.id} goal={g} onContribute={() => setContributeTo(g)} onChanged={refresh} />
          ))}
        </>
      )}

      {creating && <CreateGoalModal onClose={() => setCreating(false)} />}
      {contributeTo && <ContributeModal goal={contributeTo} onClose={() => setContributeTo(null)} />}
    </>
  );
}

// ── Thẻ một mục tiêu ────────────────────────────────────────────────────
function GoalCard({ goal, onContribute, onChanged }: { goal: Goal; onContribute: () => void; onChanged: () => void }) {
  const pct = goalPct(goal.current, goal.targetAmount);
  const remaining = goalRemaining(goal.current, goal.targetAmount);
  const reached = isGoalReached(goal.current, goal.targetAmount);
  const monthly = requiredMonthlySaving(goal.current, goal.targetAmount, goal.deadline, todayISO());
  const color = reached ? 'var(--income)' : pct >= 70 ? 'var(--primary)' : pct >= 40 ? 'var(--amber)' : 'var(--expense)';

  async function markDone() {
    await callGAS<RpcResult>('updateGoal', goal.id, { status: 'done' });
    onChanged();
  }
  async function reopen() {
    await callGAS<RpcResult>('updateGoal', goal.id, { status: 'active' });
    onChanged();
  }
  async function remove() {
    if (!confirm(`Xoá mục tiêu "${goal.name}"? Mọi đóng góp gắn với nó cũng bị xoá.`)) return;
    await callGAS<RpcResult>('deleteGoal', goal.id);
    onChanged();
  }

  return (
    <div className="card" style={{ opacity: goal.status === 'active' ? 1 : 0.6 }}>
      <div className="row-between">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span className="tx-icon">{goal.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div className="tx-desc" style={{ fontWeight: 700 }}>{goal.name} {reached && '✅'}</div>
            <div className="tx-meta">
              {goal.type === 'bucket' ? '🔗 Gắn hũ' : '🤝 Đóng góp'} · {deadlineLabel(goal.deadline, todayISO())}
            </div>
          </div>
        </div>
        <div className="tx-actions">
          {goal.status === 'active'
            ? <button className="icon-btn" title="Đánh dấu hoàn thành" onClick={markDone}>✔️</button>
            : <button className="icon-btn" title="Mở lại" onClick={reopen}>↩️</button>}
          <button className="icon-btn danger" title="Xoá" onClick={remove}>🗑️</button>
        </div>
      </div>

      <div className="row-between mt8">
        <span className="value" style={{ fontSize: '1.05rem', color }}>{formatVND(goal.current)}</span>
        <span className="tx-meta">/ {formatVND(goal.targetAmount)}</span>
      </div>
      <div className="progress mt8"><div style={{ width: `${pct}%`, background: color }} /></div>
      <div className="row-between mt8" style={{ fontSize: '0.8rem' }}>
        <span style={{ color, fontWeight: 600 }}>{pct}%</span>
        {reached
          ? <span style={{ color: 'var(--income)', fontWeight: 600 }}>Đã đạt mục tiêu 🎉</span>
          : <span className="tx-meta">Còn thiếu {formatVND(remaining)}</span>}
      </div>

      {!reached && monthly !== null && monthly > 0 && (
        <div className="mt8" style={{ fontSize: '0.8rem', color: 'var(--primary-dark)' }}>
          💡 Cần để dành <b>{formatVND(monthly)}</b>/tháng để đạt đúng hạn.
        </div>
      )}

      {goal.type === 'contribution' && (goal.contributors?.length ?? 0) > 0 && (
        <div className="mt8" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {goal.contributors!.map((c) => `${c.name}: ${formatNumber(c.amount)}`).join(' · ')}
        </div>
      )}

      {goal.type === 'contribution' && goal.status === 'active' && (
        <button className="btn ghost mt8" onClick={onContribute}>+ Đóng góp</button>
      )}
      {goal.type === 'bucket' && (
        <div className="tx-meta mt8">Tiến độ tự cập nhật theo số dư hũ liên kết.</div>
      )}
    </div>
  );
}

// ── Modal tạo mục tiêu ──────────────────────────────────────────────────
const GOAL_ICONS = ['🎯', '🛵', '🚗', '🏠', '✈️', '🐷', '💍', '🎓', '📱', '🏖️', '🎁', '🩺'];

function CreateGoalModal({ onClose }: { onClose: () => void }) {
  const { refresh } = useApp();
  const { data: buckets } = useRpc<Bucket[]>('getAssetBuckets');

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [type, setType] = useState<GoalType>('contribution');
  const [linkedBucketId, setLinked] = useState('');
  const [target, setTarget] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = useMemo(() => {
    if (!name.trim()) return false;
    if (target <= 0) return false;
    if (type === 'bucket' && !linkedBucketId) return false;
    return true;
  }, [name, target, type, linkedBucketId]);

  async function submit() {
    setErr(null);
    if (!valid) return;
    setBusy(true);
    try {
      const input: GoalInput = { name: name.trim(), icon, type, targetAmount: target, deadline: deadline || undefined };
      if (type === 'bucket') input.linkedBucketId = linkedBucketId;
      const res = await callGAS<RpcResult>('createGoal', input);
      if (res?.success === false) { setErr(res.message ?? 'Không tạo được.'); return; }
      refresh();
      onClose();
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>Tạo mục tiêu</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <div className="seg">
            <button className={type === 'contribution' ? 'transfer active' : ''} onClick={() => setType('contribution')}>🤝 Đóng góp</button>
            <button className={type === 'bucket' ? 'income active' : ''} onClick={() => setType('bucket')}>🔗 Gắn hũ</button>
          </div>
          <div className="tx-meta" style={{ marginTop: 6 }}>
            {type === 'contribution'
              ? 'Cả nhà cùng góp tiền vào mục tiêu; theo dõi ai góp bao nhiêu.'
              : 'Tiến độ chính là số dư của một hũ tài sản (tự cập nhật).'}
          </div>
        </div>

        <div className="field">
          <label>Tên mục tiêu</label>
          <input value={name} placeholder="VD: Mua xe, Du lịch hè…" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label>Biểu tượng</label>
          <div className="filter-bar" style={{ paddingBottom: 0 }}>
            {GOAL_ICONS.map((ic) => (
              <button key={ic} className={`pill ${icon === ic ? 'active' : ''}`} style={{ fontSize: '1.1rem' }} onClick={() => setIcon(ic)}>{ic}</button>
            ))}
          </div>
        </div>

        {type === 'bucket' && (
          <div className="field">
            <label>Hũ liên kết</label>
            <select className="browser-default" value={linkedBucketId} onChange={(e) => setLinked(e.target.value)}>
              <option value="">— Chọn hũ —</option>
              {(buckets ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Số tiền mục tiêu (VND)</label>
          <input inputMode="numeric" value={target ? formatNumber(target) : ''} placeholder="0" onChange={(e) => setTarget(parseAmountInput(e.target.value))} />
        </div>

        <div className="field">
          <label>Hạn hoàn thành (tuỳ chọn)</label>
          <input type="date" min={todayISO()} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>

        {err && <div className="field err" style={{ color: 'var(--expense)' }}>{err}</div>}
        <button className="btn" disabled={!valid || busy} onClick={submit}>
          {busy ? 'Đang tạo…' : 'Tạo mục tiêu'}
        </button>
      </div>
    </div>
  );
}

// ── Modal đóng góp ──────────────────────────────────────────────────────
function ContributeModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { refresh } = useApp();
  const { data: detail } = useRpc<{ contributions: GoalContribution[] }>('getGoalProgress', [goal.id], [goal.id]);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (amount <= 0) return;
    setBusy(true);
    try {
      const res = await callGAS<RpcResult>('contributeToGoal', goal.id, amount, note.trim(), date);
      if (res?.success === false) { setErr(res.message ?? 'Không đóng góp được.'); return; }
      refresh();
      onClose();
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>{goal.icon} Đóng góp · {goal.name}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <label>Số tiền đóng góp (VND)</label>
          <input inputMode="numeric" value={amount ? formatNumber(amount) : ''} placeholder="0" onChange={(e) => setAmount(parseAmountInput(e.target.value))} />
        </div>
        <div className="field">
          <label>Ngày</label>
          <input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Ghi chú</label>
          <input value={note} placeholder="VD: tiền thưởng Tết…" onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && <div className="field err" style={{ color: 'var(--expense)' }}>{err}</div>}
        <button className="btn" disabled={amount <= 0 || busy} onClick={submit}>
          {busy ? 'Đang lưu…' : 'Đóng góp'}
        </button>

        {(detail?.contributions?.length ?? 0) > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="card-title">Lịch sử đóng góp</div>
            {detail!.contributions.map((c) => (
              <div className="tx-item" key={c.id}>
                <span className="tx-icon">🤝</span>
                <div className="tx-main">
                  <div className="tx-desc">{c.userName}{c.note ? ` · ${c.note}` : ''}</div>
                  <div className="tx-meta">{c.date}</div>
                </div>
                <span className="tx-amount value income">+{formatNumber(c.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
