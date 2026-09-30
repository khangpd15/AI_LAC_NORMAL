import React, { useState, useEffect } from 'react';
import BinocularVisionScreening from './components/binocular/BinocularVisionScreening';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-group">
            <div className="brand-symbol" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">RemiCare AI</span>
              <span className="brand-subtitle">Digital Binocular Vision Screening</span>
            </div>
          </div>

          <div className="header-controls">
            {/* Mode Navigation */}
            <nav className="mode-nav" role="tablist" aria-label="Chế độ kiểm tra">
              <button
                type="button"
                role="tab"
                aria-selected="true"
                className="tab-link active"
              >
                Sàng lọc hai mắt
              </button>
            </nav>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Chuyển sang giao diện ${theme === 'dark' ? 'sáng' : 'tối'}`}
              aria-label="Đổi giao diện sáng/tối"
            >
              {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        <ErrorBoundary>
          <BinocularVisionScreening />
        </ErrorBoundary>
      </main>

      {/* App Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          <p className="footer-privacy">
            🔒 <strong>Bảo mật tối đa:</strong> Tất cả quá trình xử lý camera và thị giác máy tính diễn ra 100% cục bộ trên trình duyệt của bạn thông qua WebAssembly. Không có hình ảnh hay video nào được gửi lên bất kỳ máy chủ nào.
          </p>
          <p className="footer-credits">
            RemiCare AI Strabismus Screening &bull; Digital Binocular Vision Screening
          </p>
        </div>
      </footer>
    </div>
  );
}

