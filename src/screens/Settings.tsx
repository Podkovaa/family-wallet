import { useEffect, useState } from 'react';
import { callGAS } from '../lib/rpc';
import { useApp, useRpc } from '../state';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import type { Theme } from '../lib/theme';
import type { ManagedUser, Role, RpcResult } from '../types';

export function Settings() {
  const { user, reload: reloadAuth } = useAuth();
  const { refresh } = useApp();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <div className="card">
        <div className="card-title">Tài khoản của tôi</div>
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 700 }}>{user?.icon ?? '👤'} {user?.name}</div>
            <div className="tx-meta">{user?.email}</div>
          </div>
          <span className="pill active" style={{ pointerEvents: 'none' }}>
            {user?.role === 'admin' ? 'Quản trị' : 'Thành viên'}
          </span>
        </div>
      </div>

      <ThemeToggle />

      <NotificationPrefs onSaved={reloadAuth} />

      <TestAlert />

      {isAdmin && <TelegramConfig />}

      {isAdmin && <WeeklySummaryTrigger />}

      <SyncBalances onDone={refresh} />

      {isAdmin && <MemberManagement />}

      <div className="note info">
        🔒 Dữ liệu chỉ chia sẻ trong các thành viên được cấp quyền. Người ngoài
        danh sách không mở được app.
      </div>
    </>
  );
}

// ── Chuyển giao diện sáng / tối ─────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts: { key: Theme; label: string }[] = [
    { key: 'light', label: '☀️ Sáng' },
    { key: 'dark', label: '🌙 Tối' },
    { key: 'system', label: '🖥️ Hệ thống' },
  ];
  return (
    <div className="card">
      <div className="card-title">Giao diện</div>
      <div className="seg">
        {opts.map((o) => (
          <button
            key={o.key}
            className={theme === o.key ? 'transfer active' : ''}
            onClick={() => setTheme(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tuỳ chọn nhận cảnh báo của chính mình ──────────────────────────────
function NotificationPrefs({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(true);
  const [telegram, setTelegram] = useState(false);
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.notifyEmail ?? true);
    setTelegram(user.notifyTelegram ?? false);
    setChatId(user.telegramChatId ?? '');
  }, [user]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await callGAS<RpcResult>('setMyNotificationPrefs', {
        notifyEmail: email, notifyTelegram: telegram, telegramChatId: chatId.trim(),
      });
      if (res?.success === false) { alert(res.message ?? 'Không lưu được.'); return; }
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Nhận cảnh báo</div>
      <label className="row-between" style={{ padding: '8px 0' }}>
        <span>📧 Qua Email</span>
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
      </label>
      <label className="row-between" style={{ padding: '8px 0' }}>
        <span>💬 Qua Telegram</span>
        <input type="checkbox" checked={telegram} onChange={(e) => setTelegram(e.target.checked)} />
      </label>
      {telegram && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Telegram chat ID</label>
          <input value={chatId} placeholder="VD: 123456789" onChange={(e) => setChatId(e.target.value)} />
          <div className="tx-meta" style={{ marginTop: 4 }}>
            Cách lấy: nhắn cho bot của gia đình, rồi mở
            <code> https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates </code>
            để thấy <code>chat.id</code>. Xem README mục Telegram.
          </div>
        </div>
      )}
      <button className="btn mt8" disabled={saving} onClick={save}>
        {saving ? 'Đang lưu…' : saved ? '✓ Đã lưu' : 'Lưu tuỳ chọn'}
      </button>
    </div>
  );
}

// ── Gửi cảnh báo thử (mọi thành viên) ───────────────────────────────────
function TestAlert() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await callGAS<RpcResult>('sendTestAlert');
      setMsg(res?.message ?? (res?.success ? 'Đã gửi.' : 'Có lỗi.'));
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Kiểm tra cảnh báo</div>
      <div className="tx-meta" style={{ marginBottom: 10 }}>
        Gửi một tin nhắn thử tới các kênh bạn đã bật ở trên.
      </div>
      <button className="btn ghost" disabled={busy} onClick={run}>
        {busy ? 'Đang gửi…' : '📨 Gửi cảnh báo thử'}
      </button>
      {msg && <div className="tx-meta" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// ── Cấu hình bot Telegram (admin) ───────────────────────────────────────
function TelegramConfig() {
  const { data } = useRpc<{ telegramConfigured: boolean }>('getAlertConfig');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await callGAS<RpcResult>('setTelegramBotToken', token.trim());
      if (res?.success === false) { alert(res.message ?? 'Không lưu được.'); return; }
      setSaved(true);
      setToken('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Bot Telegram (quản trị)</div>
      <div className="tx-meta" style={{ marginBottom: 10 }}>
        Tạo bot với <b>@BotFather</b> để lấy token, dán vào đây. Token lưu an toàn
        trong Script Properties, không hiện trong sheet.
        {data && (
          <div style={{ marginTop: 4, color: data.telegramConfigured ? 'var(--income)' : 'var(--amber)' }}>
            {data.telegramConfigured ? '✓ Đã cấu hình bot.' : '• Chưa cấu hình bot.'}
          </div>
        )}
      </div>
      <div className="field">
        <input value={token} placeholder="123456:ABC-DEF…" onChange={(e) => setToken(e.target.value)} />
      </div>
      <button className="btn" disabled={saving || !token.trim()} onClick={save}>
        {saving ? 'Đang lưu…' : saved ? '✓ Đã lưu token' : 'Lưu token bot'}
      </button>
    </div>
  );
}

// ── Cài lịch gửi tổng kết hằng tuần (admin) ─────────────────────────────
function WeeklySummaryTrigger() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await callGAS<RpcResult>('installTriggers');
      setMsg(res?.message ?? (res?.success ? 'Đã cài.' : 'Có lỗi.'));
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Lịch tổng kết định kỳ (quản trị)</div>
      <div className="tx-meta" style={{ marginBottom: 10 }}>
        Cài lịch gửi tổng kết tài chính 8h sáng thứ Hai hằng tuần tới mọi thành viên.
      </div>
      <button className="btn ghost" disabled={busy} onClick={run}>
        {busy ? 'Đang cài…' : '⏰ Cài lịch gửi tổng kết tuần'}
      </button>
      {msg && <div className="tx-meta" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// ── Đồng bộ lại số dư (sửa công thức SUMIF nếu hỏng) ────────────────────
function SyncBalances({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await callGAS<RpcResult>('recalculateBalances');
      setMsg(res?.message ?? (res?.success ? 'Đã đồng bộ.' : 'Có lỗi.'));
      if (res?.success) onDone();
    } catch (e) {
      setMsg(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Đồng bộ số dư</div>
      <div className="tx-meta" style={{ marginBottom: 10 }}>
        Kiểm tra & sửa lại công thức tính số dư các hũ nếu thấy con số bất thường.
      </div>
      <button className="btn ghost" disabled={busy} onClick={run}>
        {busy ? 'Đang đồng bộ…' : '🔄 Đồng bộ lại số dư'}
      </button>
      {msg && <div className="tx-meta" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

// ── Quản lý thành viên (admin) ──────────────────────────────────────────
function MemberManagement() {
  const { user } = useAuth();
  const { data, loading, reload } = useRpc<ManagedUser[]>('listUsers');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    setBusy(true);
    try {
      const res = await callGAS<RpcResult>('addUser', { email: email.trim(), name: name.trim(), role });
      if (res?.success === false) { setErr(res.message ?? 'Không thêm được.'); return; }
      setEmail(''); setName(''); setRole('member');
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(u: ManagedUser) {
    const next: Role = u.role === 'admin' ? 'member' : 'admin';
    const res = await callGAS<RpcResult>('updateUser', u.email, { role: next });
    if (res?.success === false) alert(res.message ?? 'Không đổi được vai trò.');
    else reload();
  }

  async function deactivate(u: ManagedUser) {
    if (!confirm(`Khoá quyền truy cập của ${u.email}?`)) return;
    const res = await callGAS<RpcResult>('deactivateUser', u.email);
    if (res?.success === false) alert(res.message ?? 'Không khoá được.');
    else reload();
  }

  return (
    <div className="card">
      <div className="card-title">Thành viên gia đình</div>

      {loading && !data ? (
        <div className="spinner">Đang tải…</div>
      ) : (
        (data ?? []).map((u) => (
          <div className="tx-item" key={u.email} style={{ opacity: u.active ? 1 : 0.45 }}>
            <span className="tx-icon">{u.icon || '👤'}</span>
            <div className="tx-main">
              <div className="tx-desc">{u.name} {u.role === 'admin' && '👑'}</div>
              <div className="tx-meta">{u.email}{!u.active && ' · đã khoá'}</div>
            </div>
            {u.active && (
              <div className="tx-actions">
                <button className="icon-btn" title="Đổi vai trò" onClick={() => toggleRole(u)}>
                  {u.role === 'admin' ? '⬇️' : '⬆️'}
                </button>
                {u.email.toLowerCase() !== (user?.email ?? '').toLowerCase() && (
                  <button className="icon-btn danger" title="Khoá" onClick={() => deactivate(u)}>🚫</button>
                )}
              </div>
            )}
          </div>
        ))
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label>Thêm thành viên (email Google)</label>
        <input value={email} placeholder="ten@gmail.com" onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Tên hiển thị</label>
        <input value={name} placeholder="VD: Mẹ, Bố, An…" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <div className="seg">
          <button className={role === 'member' ? 'transfer active' : ''} onClick={() => setRole('member')}>Thành viên</button>
          <button className={role === 'admin' ? 'transfer active' : ''} onClick={() => setRole('admin')}>Quản trị</button>
        </div>
      </div>
      {err && <div className="field err" style={{ color: 'var(--expense)' }}>{err}</div>}
      <button className="btn" disabled={busy || !email.includes('@')} onClick={add}>
        {busy ? 'Đang thêm…' : '+ Thêm thành viên'}
      </button>
    </div>
  );
}
