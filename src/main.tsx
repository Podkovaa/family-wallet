import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Không tìm thấy #root');

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
