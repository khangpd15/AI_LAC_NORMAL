import React from 'react';

/**
 * ErrorBoundary Component
 * Prevents full-page unmounting or black screens upon uncaught rendering exceptions.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RemiCare ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '520px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }} aria-hidden="true">
              ⚠️
            </span>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '8px', color: '#fca5a5' }}>
              Đã xảy ra sự cố hiển thị
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '20px', lineHeight: '1.5' }}>
              {this.state.error?.message || 'Không thể render giao diện do lỗi runtime.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleReload}
              style={{
                background: '#06b6d4',
                color: '#ffffff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              🔄 Tải lại ứng dụng
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
