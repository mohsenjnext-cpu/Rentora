import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log non-sensitive diagnostic info
    const msg = String(error?.message || '');
    console.error('[Rentora Error Boundary]:', msg, errorInfo?.componentStack?.slice(0, 300));

    // Stale chunk/module dynamic import auto-recovery with reload guard
    const isChunkError = (
      msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch dynamically') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported') ||
      msg.includes('Importing a module script failed')
    );

    if (isChunkError && typeof window !== 'undefined' && window.sessionStorage) {
      const lastReload = Number(sessionStorage.getItem('rentora_chunk_reload_ts') || 0);
      const now = Date.now();
      if (now - lastReload > 15000) {
        sessionStorage.setItem('rentora_chunk_reload_ts', String(now));
        window.location.reload();
      }
    }
  }

  handleResetAndGoHome = () => {
    try {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
    } catch (_) {}
    this.setState({ hasError: false, error: null, errorCount: this.state.errorCount + 1 });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = String(this.state.error?.message || '').includes('dynamically imported module');
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0E1017',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          direction: 'rtl'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #534AB7, #26215C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(83, 74, 183, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            ⚡
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#FFFFFF' }}>
            رنتورا (Rentora)
          </h2>

          <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '340px', marginBottom: '24px', lineHeight: '1.6' }}>
            {isChunkError
              ? 'نسخه جدیدی از پلتفرم رنتورا منتشر شده است. برای دریافت آخرین به‌روزرسانی روی دکمه زیر کلیک کنید.'
              : 'خطایی در اجرای صفحه رخ داده است. می‌توانید به صفحه اصلی بازگردید یا برنامه را مجدداً بارگذاری کنید.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '280px' }}>
            <button
              onClick={this.handleResetAndGoHome}
              style={{
                padding: '12px 20px',
                borderRadius: '14px',
                backgroundColor: '#534AB7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(83, 74, 183, 0.35)',
                transition: 'opacity 0.2s'
              }}
            >
              تلاش مجدد و بازگشت به خانه
            </button>

            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#D1D5DB',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontWeight: '600',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              بارگذاری مجدد برنامه
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
