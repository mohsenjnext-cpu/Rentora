import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Rentora Error Boundary]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
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
            background: 'linear-gradient(135deg, #6D5DF5, #5848E8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(109, 93, 245, 0.4)'
          }}>
            ⚡
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
            رنتورا (Rentora)
          </h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF', maxWidth: '340px', marginBottom: '24px', lineHeight: '1.6' }}>
            برای ادامه و بارگذاری مجدد برنامه، روی دکمه زیر کلیک کنید.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 28px',
              borderRadius: '16px',
              backgroundColor: '#6D5DF5',
              color: '#ffffff',
              border: 'none',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(109, 93, 245, 0.3)'
            }}
          >
            بارگذاری مجدد
          </button>
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
