// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';

// Smoke test: bọc đầy đủ provider và mount App để bắt lỗi runtime React
// (context dùng sai chỗ, import vòng, truy cập undefined) mà tsc/build không thấy.
// Không chờ tới khi Dashboard mount biểu đồ (canvas không có trong jsdom) — chỉ
// xác nhận app khởi động và cổng đăng nhập hiển thị.

// Báo cho React biết đây là môi trường test hợp lệ cho act().
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function App2() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

describe('App — render smoke', () => {
  it('mount không ném lỗi và hiện cổng xác thực', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => { root.render(<App2 />); });

    // Trước khi getCurrentUser (mock) resolve → màn "Đang xác thực…"
    expect(document.body.textContent).toContain('Đang xác thực');

    await act(async () => { root.unmount(); });
    container.remove();
  });
});
