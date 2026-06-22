/**
 * Family Wallet — Google Apps Script Backend
 * ============================================
 *
 * BALANCE STRATEGY (Hybrid — no conflict):
 * - _Buckets column F uses SUMIF formulas → auto-compute from _Transactions
 * - GAS code ONLY writes to _Transactions (append/delete rows)
 * - GAS code NEVER writes to _Buckets column F
 * - recalculateBalances() only rewrites formulas if corrupted
 *
 * Formula in _Buckets!F2 (copied down for each bucket):
 * =SUMIF(_Transactions!E:E, A2, _Transactions!F:F)
 * -SUMIF(_Transactions!D:D, A2, _Transactions!F:F)
 *
 * LockService: only for concurrent write protection on _Transactions.
 */

// Trần hợp lý cho một giao dịch (mirror src/lib/validation.ts MAX_AMOUNT).
var MAX_AMOUNT = 100000000000; // 100 tỷ VND

// ============================================================
//  ENTRY POINT
// ============================================================

function doGet(e) {
  try {
    initSheets_();
  } catch (err) {
    console.error('initSheets_ failed: ' + err);
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Family Wallet — Sổ Thu Chi Gia Đình')
    .setFaviconUrl('https://cdn-icons-png.flaticon.com/512/8335/8335085.png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

// ============================================================
//  HELPERS
// ============================================================

function getSpreadsheet_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) { /* not bound, continue */ }

  try {
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('SPREADSHEET_ID');
    if (sheetId) {
      var existing = SpreadsheetApp.openById(sheetId);
      if (existing) return existing;
    }
  } catch (e) { /* props fail, try create */ }

  try {
    var newSS = SpreadsheetApp.create('Family Wallet — Data');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', newSS.getId());
    return newSS;
  } catch (e) {
    return null;
  }
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  if (!ss) throw new Error('Không thể kết nối Google Sheets. Vào GAS Editor → Deploy → New Deployment để cấp quyền.');
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function uid_(prefix) {
  return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
}

function readAll_(sheetName) {
  var sheet = getSheet_(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function writeAll_(sheetName, headers, rows) {
  var sheet = getSheet_(sheetName);
  sheet.clear();
  var output = [headers];
  rows.forEach(function(row) {
    output.push(headers.map(function(h) { return row[h] !== undefined ? row[h] : ''; }));
  });
  sheet.getRange(1, 1, output.length, headers.length).setValues(output);
}

function getWeekKey_(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  var startOfYear = new Date(d.getFullYear(), 0, 1);
  var days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
  var weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

function getMonthKey_(dateStr) {
  return dateStr.substring(0, 7);
}

function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================================
//  INITIALIZATION
// ============================================================

function initSheets_() {
  var bSheet = getSheet_('_Buckets');
  if (bSheet.getLastRow() === 0) {
    bSheet.getRange(1, 1, 1, 7).setValues([['id', 'name', 'icon', 'color', 'sortOrder', 'balance', 'floorAmount']]);
    var buckets = [
      ['dau-tu',       'Đầu tư',       '📈', '#3b82f6', 1],
      ['tiet-kiem',    'Tiết kiệm',    '🐷', '#10b981', 2],
      ['du-phong',     'Dự phòng',     '🛡️', '#f59e0b', 3],
      ['chi-tieu-gd',  'Chi tiêu GĐ',  '🏠', '#ef4444', 4],
      ['chua-phan-bo', 'Chưa phân bổ', '💵', '#8b5cf6', 5],
    ];
    bSheet.getRange(2, 1, buckets.length, 5).setValues(buckets);
    for (var i = 0; i < buckets.length; i++) {
      var rowNum = i + 2;
      var formula = '=SUMIF(_Transactions!E:E, A' + rowNum + ', _Transactions!F:F) - SUMIF(_Transactions!D:D, A' + rowNum + ', _Transactions!F:F)';
      bSheet.getRange(rowNum, 6).setFormula(formula);
    }
    var protection = bSheet.getRange('F2:F6').protect();
    protection.setDescription('Công thức SUMIF — không chỉnh sửa tay');
  }

  var psSheet = getSheet_('_PaymentSources');
  if (psSheet.getLastRow() === 0) {
    psSheet.getRange(1, 1, 1, 4).setValues([['id', 'name', 'icon', 'active']]);
    psSheet.getRange(2, 1, 5, 4).setValues([
      ['tien-mat',     'Tiền mặt',     '💵', true],
      ['techcombank',  'Techcombank',  '🏦', true],
      ['vietcombank',  'Vietcombank',  '🏦', true],
      ['momo',         'Ví MoMo',      '📱', true],
      ['khac',         'Khác',         '💳', true],
    ]);
  }

  var txSheet = getSheet_('_Transactions');
  if (txSheet.getLastRow() === 0) {
    txSheet.getRange(1, 1, 1, 12).setValues([[
      'id', 'date', 'type', 'fromBucketId', 'toBucketId', 'amount',
      'description', 'paymentSourceId', 'monthKey', 'weekKey', 'createdAt', 'createdBy'
    ]]);
  }

  var budgetSheet = getSheet_('_MonthlyBudget');
  if (budgetSheet.getLastRow() === 0) {
    budgetSheet.getRange(1, 1, 1, 4).setValues([['id', 'month', 'spendingLimit', 'warnThreshold']]);
  }

  var settingsSheet = getSheet_('_Settings');
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    settingsSheet.getRange(2, 1, 1, 2).setValues([['initialSetupDone', 'true']]);
  }

  var usersSheet = getSheet_('_Users');
  if (usersSheet.getLastRow() === 0) {
    usersSheet.getRange(1, 1, 1, 9).setValues([[
      'email', 'name', 'icon', 'role', 'telegramChatId',
      'notifyEmail', 'notifyTelegram', 'active', 'createdAt'
    ]]);
  }

  var goalsSheet = getSheet_('_Goals');
  if (goalsSheet.getLastRow() === 0) {
    goalsSheet.getRange(1, 1, 1, 10).setValues([[
      'id', 'name', 'icon', 'type', 'linkedBucketId', 'targetAmount',
      'deadline', 'createdBy', 'status', 'createdAt'
    ]]);
  }

  var gcSheet = getSheet_('_GoalContributions');
  if (gcSheet.getLastRow() === 0) {
    gcSheet.getRange(1, 1, 1, 7).setValues([[
      'id', 'goalId', 'userEmail', 'amount', 'date', 'note', 'createdAt'
    ]]);
  }

  var alertSheet = getSheet_('_AlertLog');
  if (alertSheet.getLastRow() === 0) {
    alertSheet.getRange(1, 1, 1, 4).setValues([['id', 'ruleKey', 'period', 'sentAt']]);
  }

  // Migration nhẹ: thêm cột floorAmount cho _Buckets cũ nếu còn thiếu.
  ensureBucketFloorColumn_();
}

/** Đảm bảo _Buckets có cột floorAmount (G). Không đụng tới cột công thức F. */
function ensureBucketFloorColumn_() {
  var bSheet = getSheet_('_Buckets');
  if (bSheet.getLastRow() === 0) return;
  var header = bSheet.getRange(1, 1, 1, Math.max(7, bSheet.getLastColumn())).getValues()[0];
  if (header.indexOf('floorAmount') < 0) {
    bSheet.getRange(1, 7).setValue('floorAmount');
  }
}

// ============================================================
//  AUTH / IDENTITY (Phase 2)
// ============================================================

var USERS_HEADERS = ['email', 'name', 'icon', 'role', 'telegramChatId', 'notifyEmail', 'notifyTelegram', 'active', 'createdAt'];

function activeEmail_() {
  try { return (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

/**
 * Lần đầu chạy: nếu chưa có user nào hợp lệ, người đang truy cập (chủ deploy)
 * tự trở thành admin. Sau đó mọi thành viên phải được admin thêm thủ công.
 */
function ensureBootstrapAdmin_(email) {
  if (!email) return;
  var users = readAll_('_Users');
  var hasActive = users.some(function(u) { return String(u.active) === 'true'; });
  if (hasActive) return;
  users.push({
    email: email, name: email.split('@')[0], icon: '👑', role: 'admin',
    telegramChatId: '', notifyEmail: true, notifyTelegram: false,
    active: true, createdAt: new Date().toISOString(),
  });
  writeAll_('_Users', USERS_HEADERS, users);
}

function findUser_(email) {
  if (!email) return null;
  var users = readAll_('_Users');
  var match = null;
  users.forEach(function(u) {
    if (String(u.email).toLowerCase() === String(email).toLowerCase()) match = u;
  });
  return match;
}

/** Trả về danh tính người đang đăng nhập + cờ authorized cho cổng đăng nhập. */
function getCurrentUser() {
  var email = activeEmail_();
  ensureBootstrapAdmin_(email);
  var me = findUser_(email);
  if (!me || String(me.active) !== 'true') {
    return { email: email, authorized: false, role: '', name: '' };
  }
  return {
    email: me.email,
    name: me.name || email.split('@')[0],
    icon: me.icon || '👤',
    role: me.role || 'member',
    telegramChatId: me.telegramChatId || '',
    notifyEmail: String(me.notifyEmail) === 'true',
    notifyTelegram: String(me.notifyTelegram) === 'true',
    authorized: true,
  };
}

/** Guard: ném lỗi nếu người gọi không nằm trong whitelist. Trả về user. */
function requireUser_() {
  var u = getCurrentUser();
  if (!u.authorized) {
    throw new Error('Tài khoản ' + (u.email || 'của bạn') + ' chưa được cấp quyền. Liên hệ quản trị của gia đình để được thêm.');
  }
  return u;
}

/** Guard: ném lỗi nếu người gọi không phải admin. Trả về user. */
function requireAdmin_() {
  var u = requireUser_();
  if (u.role !== 'admin') {
    throw new Error('Chỉ quản trị viên mới thực hiện được thao tác này.');
  }
  return u;
}

// ============================================================
//  USERS (admin) (Phase 2)
// ============================================================

function listUsers() {
  requireAdmin_();
  return readAll_('_Users')
    .map(function(u) {
      return {
        email: u.email, name: u.name, icon: u.icon || '👤', role: u.role || 'member',
        telegramChatId: u.telegramChatId || '',
        notifyEmail: String(u.notifyEmail) === 'true',
        notifyTelegram: String(u.notifyTelegram) === 'true',
        active: String(u.active) === 'true',
        createdAt: u.createdAt || '',
      };
    });
}

function addUser(input) {
  requireAdmin_();
  var email = String((input && input.email) || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 0) {
    return { success: false, message: 'Email không hợp lệ.' };
  }
  if (findUser_(email)) {
    return { success: false, message: 'Email này đã có trong danh sách.' };
  }
  var users = readAll_('_Users');
  users.push({
    email: email,
    name: (input && input.name) || email.split('@')[0],
    icon: (input && input.icon) || '👤',
    role: (input && input.role) === 'admin' ? 'admin' : 'member',
    telegramChatId: '',
    notifyEmail: true,
    notifyTelegram: false,
    active: true,
    createdAt: new Date().toISOString(),
  });
  writeAll_('_Users', USERS_HEADERS, users);
  return { success: true };
}

function updateUser(email, patch) {
  var admin = requireAdmin_();
  email = String(email || '').toLowerCase();
  var users = readAll_('_Users');
  var found = false;
  users.forEach(function(u) {
    if (String(u.email).toLowerCase() !== email) return;
    found = true;
    if (patch && patch.name !== undefined) u.name = patch.name;
    if (patch && patch.icon !== undefined) u.icon = patch.icon;
    if (patch && patch.role !== undefined) u.role = patch.role === 'admin' ? 'admin' : 'member';
  });
  if (!found) return { success: false, message: 'Không tìm thấy thành viên.' };
  // Không cho phép tự hạ cấp admin cuối cùng → tránh khoá mình ra ngoài.
  if (patch && patch.role === 'member') {
    var admins = users.filter(function(u) { return u.role === 'admin' && String(u.active) === 'true'; });
    if (admins.length === 0) return { success: false, message: 'Phải còn ít nhất một quản trị viên.' };
  }
  writeAll_('_Users', USERS_HEADERS, users);
  return { success: true, admin: admin.email };
}

function deactivateUser(email) {
  requireAdmin_();
  email = String(email || '').toLowerCase();
  var users = readAll_('_Users');
  var target = null;
  users.forEach(function(u) { if (String(u.email).toLowerCase() === email) target = u; });
  if (!target) return { success: false, message: 'Không tìm thấy thành viên.' };
  // Không cho khoá admin hoạt động cuối cùng.
  var activeAdmins = users.filter(function(u) { return u.role === 'admin' && String(u.active) === 'true'; });
  if (target.role === 'admin' && activeAdmins.length <= 1) {
    return { success: false, message: 'Không thể khoá quản trị viên cuối cùng.' };
  }
  target.active = false;
  writeAll_('_Users', USERS_HEADERS, users);
  return { success: true };
}

/** Người dùng tự cập nhật tuỳ chọn nhận cảnh báo của chính mình. */
function setMyNotificationPrefs(prefs) {
  var me = requireUser_();
  var users = readAll_('_Users');
  users.forEach(function(u) {
    if (String(u.email).toLowerCase() !== String(me.email).toLowerCase()) return;
    if (prefs && prefs.notifyEmail !== undefined) u.notifyEmail = !!prefs.notifyEmail;
    if (prefs && prefs.notifyTelegram !== undefined) u.notifyTelegram = !!prefs.notifyTelegram;
    if (prefs && prefs.telegramChatId !== undefined) u.telegramChatId = String(prefs.telegramChatId || '');
  });
  writeAll_('_Users', USERS_HEADERS, users);
  return { success: true };
}

// ============================================================
//  CORE: TRANSACTION HELPERS (no lock — callers hold the lock)
// ============================================================

/**
 * Validate a transaction payload. Returns {ok:true, tx:{...}} on success
 * (with normalized fields) or {ok:false, message} on failure.
 * Mirrors src/lib/validation.ts so client & server agree.
 */
function validateTx_(tx) {
  var amount = Number(tx.amount);
  if (!amount || amount <= 0) return { ok: false, message: 'Số tiền phải lớn hơn 0.' };
  if (Math.floor(amount) !== amount) {
    return { ok: false, message: 'Số tiền (VND) phải là số nguyên, không có số lẻ.' };
  }
  if (amount > MAX_AMOUNT) {
    return { ok: false, message: 'Số tiền quá lớn — kiểm tra lại xem có nhập nhầm không.' };
  }

  var txType = tx.type || 'expense';
  if (['income', 'expense', 'transfer'].indexOf(txType) < 0) {
    return { ok: false, message: 'Loại giao dịch không hợp lệ.' };
  }

  if (txType === 'expense' && !tx.fromBucketId) {
    return { ok: false, message: 'Chi tiêu cần chọn mục nguồn.' };
  }
  if (txType === 'income' && !tx.toBucketId) {
    return { ok: false, message: 'Thu nhập cần chọn mục đích.' };
  }
  if (txType === 'transfer' && (!tx.fromBucketId || !tx.toBucketId)) {
    return { ok: false, message: 'Phân bổ cần chọn mục nguồn và đích.' };
  }
  if (txType === 'transfer' && tx.fromBucketId === tx.toBucketId) {
    return { ok: false, message: 'Không thể phân bổ vào cùng một mục.' };
  }

  var date = tx.date || todayStr_();
  if (date > todayStr_()) {
    return { ok: false, message: 'Không thể ghi giao dịch ở ngày tương lai.' };
  }

  return {
    ok: true,
    tx: {
      type: txType,
      amount: amount,
      fromBucketId: tx.fromBucketId || '',
      toBucketId: tx.toBucketId || '',
      description: tx.description || '',
      paymentSourceId: tx.paymentSourceId || 'tien-mat',
      date: date,
    },
  };
}

function bucketBalance_(bucketId, excludeTxId) {
  var txs = readAll_('_Transactions');
  return txs.reduce(function(bal, tx) {
    if (excludeTxId && String(tx.id) === String(excludeTxId)) return bal;
    var amt = Number(tx.amount) || 0;
    if (tx.toBucketId === bucketId) bal += amt;
    if (tx.fromBucketId === bucketId) bal -= amt;
    return bal;
  }, 0);
}

function checkSufficientBalance_(v, excludeTxId) {
  if (v.type === 'income' || !v.fromBucketId) return { ok: true };
  var available = bucketBalance_(v.fromBucketId, excludeTxId);
  if (v.amount > available + 1e-6) {
    return {
      ok: false,
      message: 'Số dư mục nguồn không đủ. Khả dụng: ' + available.toLocaleString('vi-VN') + ' đ.',
    };
  }
  return { ok: true };
}

function appendTx_(v) {
  var txId = uid_('tx');
  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (e) { who = ''; }
  getSheet_('_Transactions').appendRow([
    txId, v.date, v.type, v.fromBucketId, v.toBucketId, v.amount,
    v.description, v.paymentSourceId, getMonthKey_(v.date), getWeekKey_(v.date),
    new Date().toISOString(), who,
  ]);
  return txId;
}

function deleteTxRow_(txId) {
  var sheet = getSheet_('_Transactions');
  var data = sheet.getDataRange().getValues();
  var idCol = data[0].indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(txId)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ============================================================
//  CORE: ADD / DELETE / UPDATE TRANSACTION
// ============================================================

function addTransaction(tx) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {
    return { success: false, message: 'Hệ thống đang bận, thử lại sau.' };
  }
  var result;
  try {
    var v = validateTx_(tx);
    if (!v.ok) return { success: false, message: v.message };
    var bal = checkSufficientBalance_(v.tx, null);
    if (!bal.ok) return { success: false, message: bal.message };
    var txId = appendTx_(v.tx);
    result = { success: true, id: txId };
  } catch (e) {
    return { success: false, message: 'Lỗi: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
  // Đánh giá ngưỡng cảnh báo NGOÀI lock — không để lỗi gửi mail phá giao dịch.
  try { checkThresholds_(); } catch (e) { console.error('checkThresholds_ failed: ' + e); }
  return result;
}

function deleteTransaction(txId) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {
    return { success: false, message: 'Hệ thống đang bận.' };
  }
  try {
    var removed = deleteTxRow_(txId);
    if (!removed) return { success: false, message: 'Không tìm thấy giao dịch.' };
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Lỗi: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateTransaction(txId, newTx) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {
    return { success: false, message: 'Hệ thống đang bận, thử lại sau.' };
  }
  try {
    var v = validateTx_(newTx);
    if (!v.ok) return { success: false, message: v.message };
    var bal = checkSufficientBalance_(v.tx, txId);
    if (!bal.ok) return { success: false, message: bal.message };
    var removed = deleteTxRow_(txId);
    if (!removed) return { success: false, message: 'Không tìm thấy giao dịch.' };
    var newId = appendTx_(v.tx);
    return { success: true, id: newId };
  } catch (e) {
    return { success: false, message: 'Lỗi: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  READ
// ============================================================

function getAssetBuckets() {
  requireUser_();
  var rows = readAll_('_Buckets');
  return rows
    .map(function(r) {
      return {
        id: r.id, name: r.name, icon: r.icon, color: r.color,
        sortOrder: Number(r.sortOrder), balance: Number(r.balance) || 0,
        floorAmount: Number(r.floorAmount) || 0,
      };
    })
    .sort(function(a, b) { return a.sortOrder - b.sortOrder; });
}

/**
 * Đặt mức sàn cảnh báo cho một hũ. CHỈ ghi cột G của đúng hàng — KHÔNG dùng
 * writeAll_ để tránh xoá công thức SUMIF ở cột F.
 */
function setBucketFloor(bucketId, floorAmount) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var amt = Number(floorAmount) || 0;
  if (amt < 0) return { success: false, message: 'Mức sàn không được âm.' };
  ensureBucketFloorColumn_();
  var bSheet = getSheet_('_Buckets');
  var data = bSheet.getDataRange().getValues();
  var idCol = data[0].indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(bucketId)) {
      bSheet.getRange(i + 1, 7).setValue(amt);
      return { success: true };
    }
  }
  return { success: false, message: 'Không tìm thấy hũ.' };
}

function getPaymentSources() {
  requireUser_();
  var rows = readAll_('_PaymentSources');
  return rows
    .filter(function(r) { return String(r.active) === 'true'; })
    .map(function(r) { return { id: r.id, name: r.name, icon: r.icon }; });
}

function getDashboardData(timeRange) {
  requireUser_();
  var buckets = getAssetBuckets();
  var totalAssets = buckets.reduce(function(s, b) { return s + b.balance; }, 0);
  var now = new Date();
  var currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var allTx = readAll_('_Transactions');
  var monthIncome = 0, monthExpense = 0;
  allTx.forEach(function(tx) {
    if (tx.monthKey !== currentMonth) return;
    if (tx.type === 'income') monthIncome += Number(tx.amount);
    if (tx.type === 'expense') monthExpense += Number(tx.amount);
  });
  return {
    totalAssets: totalAssets,
    buckets: buckets,
    monthIncome: monthIncome,
    monthExpense: monthExpense,
    monthNet: monthIncome - monthExpense,
    cashflow: buildCashflow_(allTx, timeRange || '6T'),
  };
}

function getTransactions(filter) {
  requireUser_();
  var allTx = readAll_('_Transactions');
  var typeFilter = (filter && filter.type) ? filter.type : null;
  var monthFilter = (filter && filter.month) ? filter.month : null;

  var result = allTx.filter(function(tx) {
    if (typeFilter && tx.type !== typeFilter) return false;
    if (monthFilter && tx.monthKey !== monthFilter) return false;
    return true;
  });

  var buckets = getAssetBuckets();
  var sources = getPaymentSources();
  var bMap = {}; buckets.forEach(function(b) { bMap[b.id] = b; });
  var sMap = {}; sources.forEach(function(s) { sMap[s.id] = s; });

  return result
    .sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
    .map(function(tx) {
      var fb = bMap[tx.fromBucketId] || {};
      var tb = bMap[tx.toBucketId] || {};
      var ps = sMap[tx.paymentSourceId] || {};
      return {
        id: tx.id, date: tx.date, type: tx.type,
        fromBucketId: tx.fromBucketId, toBucketId: tx.toBucketId,
        bucketName: tx.type === 'transfer' ? tb.name : (tx.type === 'income' ? 'Chưa phân bổ' : fb.name),
        bucketIcon: tx.type === 'transfer' ? tb.icon : (tx.type === 'income' ? '💵' : fb.icon),
        fromBucket: fb.name || '',
        amount: Number(tx.amount),
        description: tx.description,
        paymentSourceId: tx.paymentSourceId || '',
        paymentSourceName: ps.name || '',
        paymentSourceIcon: ps.icon || '',
        createdBy: tx.createdBy || '',
      };
    });
}

// ============================================================
//  CASHFLOW REPORT
// ============================================================

function getCashflowReport(timeRange) {
  requireUser_();
  var allTx = readAll_('_Transactions');
  var buckets = getAssetBuckets();
  var sources = getPaymentSources();
  var txInRange = filterByTimeRange_(allTx, timeRange || '6T');

  var totalIncome = 0, totalExpense = 0;
  txInRange.forEach(function(tx) {
    if (tx.type === 'income') totalIncome += Number(tx.amount);
    if (tx.type === 'expense') totalExpense += Number(tx.amount);
  });

  var catMap = {};
  buckets.forEach(function(b) { catMap[b.id] = { name: b.name, icon: b.icon, color: b.color, amount: 0 }; });
  txInRange.forEach(function(tx) {
    if (tx.type === 'expense' && tx.fromBucketId && catMap[tx.fromBucketId]) {
      catMap[tx.fromBucketId].amount += Number(tx.amount);
    }
  });
  var categoryBreakdown = Object.keys(catMap).map(function(k){return catMap[k];}).filter(function(c) { return c.amount > 0; });

  var srcMap = {};
  var srcColors = { 'tien-mat': '#10b981', 'techcombank': '#3b82f6', 'vietcombank': '#f59e0b', 'momo': '#ef4444', 'khac': '#8b5cf6' };
  sources.forEach(function(s) { srcMap[s.id] = { name: s.name, icon: s.icon, color: srcColors[s.id] || '#9e9e9e', amount: 0 }; });
  txInRange.forEach(function(tx) {
    if (tx.type !== 'expense') return;
    var sid = tx.paymentSourceId;
    if (sid && srcMap[sid]) srcMap[sid].amount += Number(tx.amount);
  });
  var sourceBreakdown = Object.keys(srcMap).map(function(k){return srcMap[k];}).filter(function(s) { return s.amount > 0; });

  var monthlyDetail = buildMonthlyDetail_(txInRange);
  var totalAssets = buckets.reduce(function(s, b) { return s + b.balance; }, 0);

  return {
    totalIncome: totalIncome,
    totalExpense: totalExpense,
    netCashflow: totalIncome - totalExpense,
    totalAssets: totalAssets,
    cashflow: buildCashflow_(allTx, timeRange || '6T'),
    categoryBreakdown: categoryBreakdown,
    sourceBreakdown: sourceBreakdown,
    monthlyDetail: monthlyDetail,
  };
}

// ============================================================
//  MONTHLY BUDGET
// ============================================================

function getMonthlyBudget(month) {
  requireUser_();
  var rows = readAll_('_MonthlyBudget');
  var budget = null;
  rows.forEach(function(r) { if (r.month === month) budget = r; });

  var allTx = readAll_('_Transactions');
  var spent = allTx.reduce(function(s, tx) {
    if (tx.type === 'expense' && tx.monthKey === month) return s + Number(tx.amount);
    return s;
  }, 0);

  return {
    spendingLimit: budget ? Number(budget.spendingLimit) : 20000000,
    warnThreshold: budget ? Number(budget.warnThreshold) : 80,
    spent: spent,
  };
}

function setMonthlyBudget(month, spendingLimit, warnThreshold) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var rows = readAll_('_MonthlyBudget');
  var found = false;
  var newRows = rows.map(function(r) {
    if (r.month === month) { found = true; r.spendingLimit = spendingLimit; r.warnThreshold = warnThreshold || 80; }
    return r;
  });
  if (!found) {
    newRows.push({ id: uid_('bud'), month: month, spendingLimit: spendingLimit, warnThreshold: warnThreshold || 80 });
  }
  writeAll_('_MonthlyBudget', ['id', 'month', 'spendingLimit', 'warnThreshold'], newRows);
  return { success: true };
}

// ============================================================
//  GOALS — Mục tiêu tài chính (Phase 3)
// ============================================================

var GOALS_HEADERS = ['id', 'name', 'icon', 'type', 'linkedBucketId', 'targetAmount', 'deadline', 'createdBy', 'status', 'createdAt'];
var GCONTRIB_HEADERS = ['id', 'goalId', 'userEmail', 'amount', 'date', 'note', 'createdAt'];

/**
 * Kiểm tra payload tạo/sửa mục tiêu. Trả {ok:true, goal:{...}} (đã chuẩn hoá)
 * hoặc {ok:false, message}. Dùng lại trần MAX_AMOUNT của giao dịch.
 */
function validateGoal_(input) {
  var name = String((input && input.name) || '').trim();
  if (!name) return { ok: false, message: 'Mục tiêu cần có tên.' };

  var type = (input && input.type) === 'bucket' ? 'bucket' : 'contribution';

  var target = Number(input && input.targetAmount);
  if (!target || target <= 0) return { ok: false, message: 'Số tiền mục tiêu phải lớn hơn 0.' };
  if (Math.floor(target) !== target) return { ok: false, message: 'Số tiền mục tiêu (VND) phải là số nguyên.' };
  if (target > MAX_AMOUNT) return { ok: false, message: 'Số tiền mục tiêu quá lớn — kiểm tra lại.' };

  var linkedBucketId = '';
  if (type === 'bucket') {
    linkedBucketId = String((input && input.linkedBucketId) || '');
    if (!linkedBucketId) return { ok: false, message: 'Mục tiêu kiểu gắn-hũ cần chọn hũ liên kết.' };
  }

  var deadline = String((input && input.deadline) || '');
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return { ok: false, message: 'Hạn hoàn thành không hợp lệ.' };
  }

  return {
    ok: true,
    goal: {
      name: name,
      icon: (input && input.icon) || '🎯',
      type: type,
      linkedBucketId: linkedBucketId,
      targetAmount: target,
      deadline: deadline,
    },
  };
}

/** Tiến độ hiện tại của một mục tiêu (đồng). */
function goalCurrent_(goal, contribsByGoal) {
  if (goal.type === 'bucket') {
    return goal.linkedBucketId ? bucketBalance_(goal.linkedBucketId, null) : 0;
  }
  var list = contribsByGoal[goal.id] || [];
  return list.reduce(function(s, c) { return s + (Number(c.amount) || 0); }, 0);
}

function listGoals() {
  requireUser_();
  var goals = readAll_('_Goals');
  var contribs = readAll_('_GoalContributions');
  var byGoal = {};
  contribs.forEach(function(c) {
    var k = String(c.goalId);
    (byGoal[k] = byGoal[k] || []).push(c);
  });

  var nameByEmail = {};
  readAll_('_Users').forEach(function(u) {
    nameByEmail[String(u.email).toLowerCase()] = u.name || '';
  });

  return goals.map(function(g) {
    var type = g.type === 'bucket' ? 'bucket' : 'contribution';
    var current = goalCurrent_({ id: g.id, type: type, linkedBucketId: g.linkedBucketId }, byGoal);

    var contributors = [];
    if (type === 'contribution') {
      var agg = {};
      (byGoal[String(g.id)] || []).forEach(function(c) {
        var k = String(c.userEmail || '').toLowerCase();
        agg[k] = (agg[k] || 0) + (Number(c.amount) || 0);
      });
      contributors = Object.keys(agg).map(function(k) {
        return { email: k, name: nameByEmail[k] || k.split('@')[0], amount: agg[k] };
      }).sort(function(a, b) { return b.amount - a.amount; });
    }

    return {
      id: g.id, name: g.name, icon: g.icon || '🎯', type: type,
      linkedBucketId: g.linkedBucketId || '', targetAmount: Number(g.targetAmount) || 0,
      deadline: g.deadline || '', createdBy: g.createdBy || '',
      status: g.status || 'active', createdAt: g.createdAt || '',
      current: current, contributors: contributors,
    };
  }).sort(function(a, b) {
    // Mục tiêu đang theo đuổi lên trước; trong cùng nhóm, gần hạn lên trước.
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    var ad = a.deadline || '9999-99-99', bd = b.deadline || '9999-99-99';
    return ad.localeCompare(bd);
  });
}

function createGoal(input) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var v = validateGoal_(input);
  if (!v.ok) return { success: false, message: v.message };

  if (v.goal.type === 'bucket') {
    // Hũ liên kết phải tồn tại.
    var exists = readAll_('_Buckets').some(function(b) { return String(b.id) === v.goal.linkedBucketId; });
    if (!exists) return { success: false, message: 'Hũ liên kết không tồn tại.' };
  }

  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (e) { who = ''; }
  var id = uid_('goal');
  getSheet_('_Goals').appendRow([
    id, v.goal.name, v.goal.icon, v.goal.type, v.goal.linkedBucketId,
    v.goal.targetAmount, v.goal.deadline, who, 'active', new Date().toISOString(),
  ]);
  return { success: true, id: id };
}

function updateGoal(id, patch) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var goals = readAll_('_Goals');
  var found = false;
  goals.forEach(function(g) {
    if (String(g.id) !== String(id)) return;
    found = true;
    if (patch && patch.name !== undefined) g.name = String(patch.name).trim() || g.name;
    if (patch && patch.icon !== undefined) g.icon = String(patch.icon) || g.icon;
    if (patch && patch.targetAmount !== undefined) g.targetAmount = Number(patch.targetAmount) || g.targetAmount;
    if (patch && patch.deadline !== undefined) g.deadline = String(patch.deadline);
    if (patch && patch.status !== undefined) {
      g.status = ['active', 'done', 'archived'].indexOf(patch.status) >= 0 ? patch.status : g.status;
    }
  });
  if (!found) return { success: false, message: 'Không tìm thấy mục tiêu.' };
  writeAll_('_Goals', GOALS_HEADERS, goals);
  return { success: true };
}

function deleteGoal(id) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var goals = readAll_('_Goals').filter(function(g) { return String(g.id) !== String(id); });
  writeAll_('_Goals', GOALS_HEADERS, goals);
  // Dọn luôn các khoản đóng góp gắn với mục tiêu này.
  var contribs = readAll_('_GoalContributions').filter(function(c) { return String(c.goalId) !== String(id); });
  writeAll_('_GoalContributions', GCONTRIB_HEADERS, contribs);
  return { success: true };
}

function contributeToGoal(goalId, amount, note, date) {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }

  var goal = null;
  readAll_('_Goals').forEach(function(g) { if (String(g.id) === String(goalId)) goal = g; });
  if (!goal) return { success: false, message: 'Không tìm thấy mục tiêu.' };
  if (goal.type === 'bucket') {
    return { success: false, message: 'Mục tiêu gắn-hũ tự cập nhật theo số dư hũ — không đóng góp thủ công.' };
  }

  var amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, message: 'Số tiền đóng góp phải lớn hơn 0.' };
  if (Math.floor(amt) !== amt) return { success: false, message: 'Số tiền (VND) phải là số nguyên.' };
  if (amt > MAX_AMOUNT) return { success: false, message: 'Số tiền quá lớn — kiểm tra lại.' };

  var d = String(date || todayStr_());
  if (d > todayStr_()) return { success: false, message: 'Không thể đóng góp ở ngày tương lai.' };

  var who = '';
  try { who = Session.getActiveUser().getEmail() || ''; } catch (e) { who = ''; }
  getSheet_('_GoalContributions').appendRow([
    uid_('gc'), goalId, who, amt, d, String(note || ''), new Date().toISOString(),
  ]);
  return { success: true };
}

function getGoalProgress(id) {
  requireUser_();
  var goal = null;
  readAll_('_Goals').forEach(function(g) { if (String(g.id) === String(id)) goal = g; });
  if (!goal) return null;

  var nameByEmail = {};
  readAll_('_Users').forEach(function(u) {
    nameByEmail[String(u.email).toLowerCase()] = u.name || '';
  });

  var contribs = readAll_('_GoalContributions')
    .filter(function(c) { return String(c.goalId) === String(id); })
    .sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });

  var type = goal.type === 'bucket' ? 'bucket' : 'contribution';
  var byGoal = {}; byGoal[String(id)] = contribs;

  return {
    id: goal.id, name: goal.name, icon: goal.icon || '🎯', type: type,
    linkedBucketId: goal.linkedBucketId || '', targetAmount: Number(goal.targetAmount) || 0,
    deadline: goal.deadline || '', status: goal.status || 'active',
    current: goalCurrent_({ id: id, type: type, linkedBucketId: goal.linkedBucketId }, byGoal),
    contributions: contribs.map(function(c) {
      var k = String(c.userEmail || '').toLowerCase();
      return {
        id: c.id, goalId: c.goalId, userEmail: c.userEmail,
        userName: nameByEmail[k] || k.split('@')[0],
        amount: Number(c.amount) || 0, date: c.date, note: c.note || '', createdAt: c.createdAt,
      };
    }),
  };
}

// ============================================================
//  ALERTS — Cảnh báo Email + Telegram (Phase 4)
// ============================================================

function getSetting_(key, dflt) {
  var rows = readAll_('_Settings');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].key) === key) return rows[i].value;
  }
  return dflt;
}

function setSetting_(key, value) {
  var rows = readAll_('_Settings');
  var found = false;
  rows.forEach(function(r) { if (String(r.key) === key) { r.value = value; found = true; } });
  if (!found) rows.push({ key: key, value: value });
  writeAll_('_Settings', ['key', 'value'], rows);
}

/** Định dạng số kiểu VN (1.234.567 đ) — không phụ thuộc Intl. */
function fmt_(n) {
  var neg = Number(n) < 0;
  var s = String(Math.round(Math.abs(Number(n) || 0)));
  var out = '';
  while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
  return (neg ? '-' : '') + s + out + ' đ';
}

// ── Mirror của src/lib/alerts.ts (giữ đồng bộ logic) ───────────────────
function evalBudget_(spent, limit, warnPct) {
  if (!(limit > 0)) return { level: 'none', pct: 0 };
  var pct = Math.round((spent / limit) * 100);
  if (spent >= limit) return { level: 'over', pct: pct };
  var warn = warnPct > 0 ? warnPct : 80;
  if (pct >= warn) return { level: 'warn', pct: pct };
  return { level: 'none', pct: pct };
}

function isGoalBehind_(current, target, createdAt, deadline, today) {
  if (!(target > 0) || current >= target) return false;
  if (!deadline || !createdAt) return false;
  var start = Date.parse(String(createdAt).slice(0, 10) + 'T00:00:00Z');
  var end = Date.parse(deadline + 'T00:00:00Z');
  var now = Date.parse(today + 'T00:00:00Z');
  if (isNaN(start) || isNaN(end) || isNaN(now) || end <= start) return false;
  var frac = Math.max(0, Math.min(1, (now - start) / (end - start)));
  return current < target * frac;
}

// ── Cấu hình cảnh báo (bật/tắt từng ngưỡng) ────────────────────────────
function getAlertSettings() {
  requireUser_();
  return {
    budget: getSetting_('alertBudget', 'true') !== 'false',
    floor: getSetting_('alertFloor', 'true') !== 'false',
    cashflow: getSetting_('alertCashflow', 'true') !== 'false',
    goal: getSetting_('alertGoal', 'true') !== 'false',
  };
}

function setAlertSettings(s) {
  try { requireAdmin_(); } catch (e) { return { success: false, message: e.message }; }
  if (s && s.budget !== undefined) setSetting_('alertBudget', s.budget ? 'true' : 'false');
  if (s && s.floor !== undefined) setSetting_('alertFloor', s.floor ? 'true' : 'false');
  if (s && s.cashflow !== undefined) setSetting_('alertCashflow', s.cashflow ? 'true' : 'false');
  if (s && s.goal !== undefined) setSetting_('alertGoal', s.goal ? 'true' : 'false');
  return { success: true };
}

// ── Telegram bot token (lưu Script Properties, không để trong sheet) ────
function telegramToken_() {
  try { return PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || ''; }
  catch (e) { return ''; }
}

function setTelegramBotToken(token) {
  try { requireAdmin_(); } catch (e) { return { success: false, message: e.message }; }
  PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', String(token || '').trim());
  return { success: true };
}

/** Cho FE: trạng thái cấu hình cảnh báo + đã cài bot Telegram chưa. */
function getAlertConfig() {
  requireUser_();
  return {
    budget: getSetting_('alertBudget', 'true') !== 'false',
    floor: getSetting_('alertFloor', 'true') !== 'false',
    cashflow: getSetting_('alertCashflow', 'true') !== 'false',
    goal: getSetting_('alertGoal', 'true') !== 'false',
    telegramConfigured: telegramToken_() !== '',
  };
}

// ── Gửi cảnh báo ────────────────────────────────────────────────────────
function sendTelegram_(chatId, text) {
  var token = telegramToken_();
  if (!token || !chatId) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: String(chatId), text: text, parse_mode: 'HTML' }),
      muteHttpExceptions: true,
    });
  } catch (e) { console.error('Telegram fail: ' + e); }
}

function activeUsers_() {
  return readAll_('_Users').filter(function(u) { return String(u.active) === 'true'; });
}

/** Gửi tới mọi thành viên đã bật kênh tương ứng. */
function sendAlert_(subject, body) {
  activeUsers_().forEach(function(u) {
    try {
      if (String(u.notifyEmail) === 'true' && u.email) MailApp.sendEmail(u.email, subject, body);
    } catch (e) { console.error('Email fail ' + u.email + ': ' + e); }
    if (String(u.notifyTelegram) === 'true' && u.telegramChatId) {
      sendTelegram_(u.telegramChatId, '<b>' + subject + '</b>\n' + body);
    }
  });
}

// ── Chống spam: _AlertLog (ruleKey + period) ───────────────────────────
function alreadySent_(ruleKey, period) {
  return readAll_('_AlertLog').some(function(r) {
    return String(r.ruleKey) === String(ruleKey) && String(r.period) === String(period);
  });
}

function markSent_(ruleKey, period) {
  getSheet_('_AlertLog').appendRow([uid_('al'), ruleKey, period, new Date().toISOString()]);
}

/** Đọc hũ KHÔNG qua guard — dùng trong ngữ cảnh trigger (không có active user). */
function getAssetBucketsRaw_() {
  return readAll_('_Buckets').map(function(r) {
    return {
      id: r.id, name: r.name,
      balance: Number(r.balance) || 0, floorAmount: Number(r.floorAmount) || 0,
    };
  });
}

/**
 * Đánh giá 4 ngưỡng và gửi cảnh báo (chống trùng theo kỳ tháng).
 * Gọi ngay sau addTransaction; cũng an toàn khi chạy từ trigger.
 */
function checkThresholds_() {
  var budgetOn = getSetting_('alertBudget', 'true') !== 'false';
  var floorOn = getSetting_('alertFloor', 'true') !== 'false';
  var cashflowOn = getSetting_('alertCashflow', 'true') !== 'false';
  var goalOn = getSetting_('alertGoal', 'true') !== 'false';

  var now = new Date();
  var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var today = todayStr_();

  var allTx = readAll_('_Transactions');
  var monthIncome = 0, monthExpense = 0;
  allTx.forEach(function(tx) {
    if (tx.monthKey !== monthKey) return;
    if (tx.type === 'income') monthIncome += Number(tx.amount);
    if (tx.type === 'expense') monthExpense += Number(tx.amount);
  });

  // (a) Ngân sách tháng
  if (budgetOn) {
    var bud = null;
    readAll_('_MonthlyBudget').forEach(function(r) { if (r.month === monthKey) bud = r; });
    var limit = bud ? Number(bud.spendingLimit) : 0;
    var warn = bud ? Number(bud.warnThreshold) : 80;
    var ev = evalBudget_(monthExpense, limit, warn);
    if (ev.level === 'over' && !alreadySent_('budget-over', monthKey)) {
      sendAlert_('⚠️ Vượt hạn mức chi tiêu tháng',
        'Chi tiêu tháng ' + monthKey + ' đã ' + ev.pct + '% hạn mức (' + fmt_(monthExpense) + ' / ' + fmt_(limit) + '). Hãy cân nhắc tiết giảm.');
      markSent_('budget-over', monthKey);
    } else if (ev.level === 'warn' && !alreadySent_('budget-warn', monthKey)) {
      sendAlert_('🔔 Sắp chạm hạn mức chi tiêu',
        'Chi tiêu tháng ' + monthKey + ' đã ' + ev.pct + '% hạn mức (' + fmt_(monthExpense) + ' / ' + fmt_(limit) + ').');
      markSent_('budget-warn', monthKey);
    }
  }

  // (c) Dòng tiền tháng âm
  if (cashflowOn && monthExpense > monthIncome && !alreadySent_('cashflow-neg', monthKey)) {
    sendAlert_('🔴 Dòng tiền tháng đang âm',
      'Tháng ' + monthKey + ': chi (' + fmt_(monthExpense) + ') đang vượt thu (' + fmt_(monthIncome) + ').');
    markSent_('cashflow-neg', monthKey);
  }

  // (b) Hũ dưới mức sàn
  if (floorOn) {
    getAssetBucketsRaw_().forEach(function(b) {
      if (b.floorAmount > 0 && b.balance < b.floorAmount) {
        var key = 'floor-' + b.id;
        if (!alreadySent_(key, monthKey)) {
          sendAlert_('🏺 Hũ "' + b.name + '" dưới mức sàn',
            'Số dư hũ ' + b.name + ' còn ' + fmt_(b.balance) + ', dưới mức sàn ' + fmt_(b.floorAmount) + '.');
          markSent_(key, monthKey);
        }
      }
    });
  }

  // (d) Mục tiêu chậm tiến độ
  if (goalOn) {
    var contribs = readAll_('_GoalContributions');
    var byGoal = {};
    contribs.forEach(function(c) { (byGoal[String(c.goalId)] = byGoal[String(c.goalId)] || []).push(c); });
    readAll_('_Goals').forEach(function(g) {
      if (String(g.status) !== 'active') return;
      var type = g.type === 'bucket' ? 'bucket' : 'contribution';
      var current = goalCurrent_({ id: g.id, type: type, linkedBucketId: g.linkedBucketId }, byGoal);
      if (isGoalBehind_(current, Number(g.targetAmount), g.createdAt, g.deadline, today)) {
        var key = 'goal-behind-' + g.id;
        if (!alreadySent_(key, monthKey)) {
          sendAlert_('🎯 Mục tiêu "' + g.name + '" đang chậm tiến độ',
            'Mục tiêu ' + g.name + ' mới đạt ' + fmt_(current) + ' / ' + fmt_(g.targetAmount) + ', chậm so với kế hoạch tới hạn ' + g.deadline + '.');
          markSent_(key, monthKey);
        }
      }
    });
  }
}

/** Tổng kết định kỳ — gọi bởi time-driven trigger (xem installTriggers). */
function weeklySummary() {
  var now = new Date();
  var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var allTx = readAll_('_Transactions');
  var income = 0, expense = 0;
  allTx.forEach(function(tx) {
    if (tx.monthKey !== monthKey) return;
    if (tx.type === 'income') income += Number(tx.amount);
    if (tx.type === 'expense') expense += Number(tx.amount);
  });
  var buckets = getAssetBucketsRaw_();
  var totalAssets = buckets.reduce(function(s, b) { return s + b.balance; }, 0);

  var lines = [
    'Tổng kết tài chính tuần — tháng ' + monthKey,
    '• Tổng tài sản: ' + fmt_(totalAssets),
    '• Thu tháng này: ' + fmt_(income),
    '• Chi tháng này: ' + fmt_(expense),
    '• Dòng tiền: ' + fmt_(income - expense),
  ];

  var contribs = readAll_('_GoalContributions');
  var byGoal = {};
  contribs.forEach(function(c) { (byGoal[String(c.goalId)] = byGoal[String(c.goalId)] || []).push(c); });
  var goals = readAll_('_Goals').filter(function(g) { return String(g.status) === 'active'; });
  if (goals.length) {
    lines.push('• Mục tiêu đang theo đuổi:');
    goals.forEach(function(g) {
      var type = g.type === 'bucket' ? 'bucket' : 'contribution';
      var cur = goalCurrent_({ id: g.id, type: type, linkedBucketId: g.linkedBucketId }, byGoal);
      var pct = Number(g.targetAmount) > 0 ? Math.round(cur / Number(g.targetAmount) * 100) : 0;
      lines.push('   - ' + g.name + ': ' + pct + '% (' + fmt_(cur) + ' / ' + fmt_(g.targetAmount) + ')');
    });
  }

  sendAlert_('📊 Tổng kết tài chính gia đình', lines.join('\n'));
}

/** Cài (lại) trigger gửi tổng kết 8h sáng thứ Hai hằng tuần. Admin gọi 1 lần. */
function installTriggers() {
  try { requireAdmin_(); } catch (e) { return { success: false, message: e.message }; }
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'weeklySummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklySummary').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  return { success: true, message: 'Đã cài lịch gửi tổng kết 8h sáng thứ Hai hằng tuần.' };
}

/** Gửi một cảnh báo thử tới chính người đang đăng nhập (theo kênh đã bật). */
function sendTestAlert() {
  var me = requireUser_();
  var u = findUser_(me.email);
  if (!u) return { success: false, message: 'Không tìm thấy tài khoản.' };
  var subject = '🔔 Cảnh báo thử — Family Wallet';
  var body = 'Đây là tin nhắn thử. Nếu bạn nhận được, kênh cảnh báo đã hoạt động.';
  var channels = [];
  try {
    if (String(u.notifyEmail) === 'true' && u.email) { MailApp.sendEmail(u.email, subject, body); channels.push('Email'); }
  } catch (e) { return { success: false, message: 'Lỗi gửi email: ' + e }; }
  if (String(u.notifyTelegram) === 'true' && u.telegramChatId) {
    sendTelegram_(u.telegramChatId, '<b>' + subject + '</b>\n' + body);
    channels.push('Telegram');
  }
  if (!channels.length) return { success: false, message: 'Bạn chưa bật kênh nào (Email/Telegram) trong Cài đặt.' };
  return { success: true, message: 'Đã gửi thử qua: ' + channels.join(', ') + '.' };
}

// ============================================================
//  SETTINGS / RECALCULATE
// ============================================================

function getSettings() {
  var rows = readAll_('_Settings');
  var map = {};
  rows.forEach(function(r) { map[r.key] = r.value; });
  return map;
}

function recalculateBalances() {
  try { requireUser_(); } catch (e) { return { success: false, message: e.message }; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { success: false, message: 'Hệ thống đang bận.' };
  }
  try {
    var bSheet = getSheet_('_Buckets');
    var data = bSheet.getDataRange().getValues();
    if (data.length < 2) return { success: false, message: 'Chưa có dữ liệu buckets.' };
    for (var i = 1; i < data.length; i++) {
      var rowNum = i + 1;
      var formula = '=SUMIF(_Transactions!E:E, A' + rowNum + ', _Transactions!F:F) - SUMIF(_Transactions!D:D, A' + rowNum + ', _Transactions!F:F)';
      var cell = bSheet.getRange(rowNum, 6);
      var currentFormula = cell.getFormula();
      if (!currentFormula || currentFormula.indexOf('SUMIF') < 0) {
        cell.setFormula(formula);
      }
    }
    return { success: true, message: 'Đã kiểm tra & sửa công thức SUMIF.' };
  } catch (e) {
    return { success: false, message: 'Lỗi: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  CASHFLOW HELPERS
// ============================================================

function buildCashflow_(txs, timeRange) {
  var labels = [], income = [], expense = [];
  if (timeRange === '1T') {
    for (var w = 3; w >= 0; w--) {
      var d = new Date(); d.setDate(d.getDate() - w * 7);
      var wk = getWeekKey_(d.toISOString().slice(0, 10));
      labels.push('W' + wk.split('-W')[1]);
      income.push(sumByType_(txs, 'income', 'weekKey', wk));
      expense.push(sumByType_(txs, 'expense', 'weekKey', wk));
    }
  } else if (timeRange === '3T') {
    for (var m3 = 2; m3 >= 0; m3--) {
      var d3 = new Date(); d3.setMonth(d3.getMonth() - m3);
      var mk3 = d3.getFullYear() + '-' + String(d3.getMonth() + 1).padStart(2, '0');
      labels.push('T' + (d3.getMonth() + 1));
      income.push(sumByType_(txs, 'income', 'monthKey', mk3));
      expense.push(sumByType_(txs, 'expense', 'monthKey', mk3));
    }
  } else if (timeRange === '6T' || !timeRange) {
    for (var m6 = 5; m6 >= 0; m6--) {
      var d6 = new Date(); d6.setMonth(d6.getMonth() - m6);
      var mk6 = d6.getFullYear() + '-' + String(d6.getMonth() + 1).padStart(2, '0');
      labels.push('T' + (d6.getMonth() + 1));
      income.push(sumByType_(txs, 'income', 'monthKey', mk6));
      expense.push(sumByType_(txs, 'expense', 'monthKey', mk6));
    }
  } else if (timeRange === '1N') {
    for (var m12 = 11; m12 >= 0; m12--) {
      var d12 = new Date(); d12.setMonth(d12.getMonth() - m12);
      var mk12 = d12.getFullYear() + '-' + String(d12.getMonth() + 1).padStart(2, '0');
      labels.push(String(d12.getMonth() + 1) + '/' + String(d12.getFullYear()).substring(2));
      income.push(sumByType_(txs, 'income', 'monthKey', mk12));
      expense.push(sumByType_(txs, 'expense', 'monthKey', mk12));
    }
  } else if (timeRange === 'all') {
    var yearMap = {};
    txs.forEach(function(tx) {
      var y = (tx.monthKey || '').substring(0, 4);
      if (!y) return;
      if (!yearMap[y]) yearMap[y] = { income: 0, expense: 0 };
      if (tx.type === 'income') yearMap[y].income += Number(tx.amount);
      if (tx.type === 'expense') yearMap[y].expense += Number(tx.amount);
    });
    Object.keys(yearMap).sort().forEach(function(y) {
      labels.push(y);
      income.push(yearMap[y].income);
      expense.push(yearMap[y].expense);
    });
  }
  return { labels: labels, income: income, expense: expense };
}

function sumByType_(txs, type, groupKey, groupVal) {
  return txs.reduce(function(s, tx) {
    if (tx.type === type && String(tx[groupKey]) === String(groupVal)) return s + Number(tx.amount);
    return s;
  }, 0);
}

function filterByTimeRange_(txs, timeRange) {
  var months = { '1T': 1, '3T': 3, '6T': 6, '1N': 12 };
  var m = months[timeRange];
  if (!m) return txs;
  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - m);
  var cutoffStr = cutoff.toISOString().slice(0, 10);
  return txs.filter(function(tx) { return tx.date >= cutoffStr; });
}

function buildMonthlyDetail_(txs) {
  var months = {};
  txs.forEach(function(tx) {
    var mk = tx.monthKey;
    if (!mk) return;
    if (!months[mk]) months[mk] = { income: 0, expense: 0 };
    if (tx.type === 'income') months[mk].income += Number(tx.amount);
    if (tx.type === 'expense') months[mk].expense += Number(tx.amount);
  });

  var sorted = Object.keys(months).sort();
  if (sorted.length === 0) return [];
  var running = 0;
  var allTx = readAll_('_Transactions');
  var earliest = sorted[0];
  allTx.forEach(function(tx) {
    if (tx.monthKey < earliest) {
      if (tx.type === 'income') running += Number(tx.amount);
      else if (tx.type === 'expense') running -= Number(tx.amount);
    }
  });

  return sorted.map(function(mk) {
    var m = months[mk];
    var net = m.income - m.expense;
    running += net;
    var parts = mk.split('-');
    return {
      month: 'T' + parseInt(parts[1], 10) + '/' + parts[0],
      income: m.income, expense: m.expense, net: net, assets: running,
    };
  });
}
