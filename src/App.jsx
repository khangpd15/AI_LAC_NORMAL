import React, { useState, useEffect } from 'react';
import BinocularVisionScreening from './components/binocular/BinocularVisionScreening';
import ExperienceVisionPage from './components/ExperienceVision/ExperienceVisionPage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  // Navigation tabs: 'screening' (Sàng lọc hai mắt - mặc định) | 'experience' (Trải nghiệm góc nhìn camera fullscreen)
  const [activeTab, setActiveTab] = useState('screening');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // Khi ở chế độ Trải nghiệm góc nhìn, hiển thị Fullscreen Cinematic không có header/footer
  if (activeTab === 'experience') {
    return (
      <ErrorBoundary>
        <ExperienceVisionPage
          onStartScreening={() => setActiveTab('screening')}
          onExit={() => setActiveTab('screening')}
        />
      </ErrorBoundary>
    );
  }

  // Chế độ Sàng lọc hai mắt chuẩn với Header, Brand Logo và Digital Binocular Vision Screening
  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-inner">
          <div
            className="brand-group"
            onClick={() => setActiveTab('experience')}
            style={{ cursor: 'pointer' }}
            title="Trang chủ RemiCare AI"
          >
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
            {/* Mode Navigation Tabs */}
            <nav className="mode-nav" role="tablist" aria-label="Chế độ trải nghiệm và sàng lọc">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'experience'}
                className={`tab-link ${activeTab === 'experience' ? 'active' : ''}`}
                onClick={() => setActiveTab('experience')}
              >
                <span>👁️ Trải nghiệm góc nhìn</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'screening'}
                className={`tab-link ${activeTab === 'screening' ? 'active' : ''}`}
                onClick={() => setActiveTab('screening')}
              >
                <span>🔬 Sàng lọc hai mắt</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main" id="main-content">
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


