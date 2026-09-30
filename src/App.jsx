import React, { useEffect } from 'react';
import BinocularVisionScreening from './components/binocular/BinocularVisionScreening';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-group">
            <img
              src="/images/logo.jpg"
              alt="Logo RemiCare"
              className="brand-logo-img"
            />
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

