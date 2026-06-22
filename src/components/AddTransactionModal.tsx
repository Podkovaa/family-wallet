import { useMemo, useState } from 'react';
import { callGAS } from '../lib/rpc';
import { useApp, useRpc } from '../state';
import { parseAmountInput, validateTx } from '../lib/validation';
import { formatNumber, todayISO } from '../lib/format';
import type { Bucket, PaymentSource, RpcResult, Transaction, TxInput, TxType } from '../types';

interface Props {
  onClose: () => void;
  /** Khi truyền vào → chế độ Sửa (gọi updateTransaction thay vì addTransaction). */
  editing?: Transaction;
}

const TYPE_LABELS: Record<TxType, string> = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  transfer: 'Phân bổ',
};

export function AddTransactionModal({ onClose, editing }: Props) {
  const { refresh } = useApp();
  const { data: buckets } = useRpc<Bucket[]>('getAssetBuckets');
  const { data: sources } = useRpc<PaymentSource[]>('getPaymentSources');

  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [amount, setAmount] = useState<number>(editing?.amount ?? 0);
  const [fromBucketId, setFrom] = useState(editing?.fromBucketId ?? '');
  const [toBucketId, setTo] = useState(editing?.toBucketId ?? '');
  const [paymentSourceId, setSource] = useState(editing?.paymentSourceId || 'tien-mat');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [description, setDesc] = useState(editing?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const tx: TxInput = { type, amount, fromBucketId, toBucketId, paymentSourceId, date, description };
  const validation = useMemo(() => validateTx(tx, todayISO()), [type, amount, fromBucketId, toBucketId, date]);

  async function submit() {
    setServerErr(null);
    if (!validation.ok) return;
    setSubmitting(true);
    try {
      const res = editing
        ? await callGAS<RpcResult>('updateTransaction', editing.id, tx)
        : await callGAS<RpcResult>('addTransaction', tx);
      if (res?.success === false) {
        setServerErr(res.message ?? 'Có lỗi xảy ra.');
        return;
      }
      refresh();
      onClose();
    } catch (e) {
      setServerErr(String((e as Error)?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>{editing ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <div className="seg">
            {(['income', 'expense', 'transfer'] as TxType[]).map((t) => (
              <button
                key={t}
                className={`${t} ${type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Số tiền (VND)</label>
          <input
            inputMode="numeric"
            value={amount ? formatNumber(amount) : ''}
            placeholder="0"
            onChange={(e) => setAmount(parseAmountInput(e.target.value))}
          />
        </div>

        {type !== 'income' && (
          <div className="field">
            <label>{type === 'transfer' ? 'Từ mục' : 'Chi từ mục'}</label>
            <select className="browser-default" value={fromBucketId} onChange={(e) => setFrom(e.target.value)}>
              <option value="">— Chọn mục —</option>
              {(buckets ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
              ))}
            </select>
          </div>
        )}

        {type !== 'expense' && (
          <div className="field">
            <label>{type === 'transfer' ? 'Đến mục' : 'Vào mục'}</label>
            <select className="browser-default" value={toBucketId} onChange={(e) => setTo(e.target.value)}>
              <option value="">— Chọn mục —</option>
              {(buckets ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Nguồn tiền</label>
          <select className="browser-default" value={paymentSourceId} onChange={(e) => setSource(e.target.value)}>
            {(sources ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Ngày</label>
          <input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>Ghi chú</label>
          <input value={description} placeholder="VD: Đi chợ, tiền điện…" onChange={(e) => setDesc(e.target.value)} />
        </div>

        {!validation.ok && amount > 0 && <div className="field err" style={{ color: 'var(--expense)' }}>{validation.message}</div>}
        {serverErr && <div className="field err" style={{ color: 'var(--expense)' }}>{serverErr}</div>}

        <button className="btn" disabled={!validation.ok || submitting} onClick={submit}>
          {submitting ? 'Đang lưu…' : editing ? 'Cập nhật' : 'Lưu giao dịch'}
        </button>
      </div>
    </div>
  );
}
