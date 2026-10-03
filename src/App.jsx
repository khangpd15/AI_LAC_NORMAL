import React, { useState, useEffect } from 'react';
import HomePage from './components/home/HomePage';
import BinocularVisionScreening from './components/binocular/BinocularVisionScreening';
import ExperienceVisionPage from './components/ExperienceVision/ExperienceVisionPage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  // Navigation views: 'home' (Trang chủ RemiCare) | 'experience' (Trải nghiệm góc nhìn camera) | 'screening' (Sàng lọc hai mắt)
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // 1. Home / Landing Page Mode (Default)
  if (activeTab === 'home') {
    return (
      <ErrorBoundary>
        <HomePage
          onStartExperience={() => setActiveTab('experience')}
          onStartScreening={() => setActiveTab('screening')}
        />
      </ErrorBoundary>
    );
  }

  // 2. Experience Vision Mode (Fullscreen Camera Realtime)
  if (activeTab === 'experience') {
    return (
      <ErrorBoundary>
        <ExperienceVisionPage
          onStartScreening={() => setActiveTab('screening')}
          onExit={() => setActiveTab('home')}
        />
      </ErrorBoundary>
    );
  }

  // 3. Binocular Vision Screening Mode (Clinical screening protocol)
  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-inner">
          <div
            className="brand-group"
            onClick={() => setActiveTab('home')}
            style={{ cursor: 'pointer' }}
            title="Về Trang chủ RemiCare"
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
                aria-selected={activeTab === 'home'}
                className={`tab-link ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
                <span className="tab-icon" aria-hidden="true">⌂</span>
                <span>Trang chủ</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'experience'}
                className={`tab-link ${activeTab === 'experience' ? 'active' : ''}`}
                onClick={() => setActiveTab('experience')}
              >
                <span className="tab-icon" aria-hidden="true">◉</span>
                <span>Trải nghiệm</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'screening'}
                className={`tab-link ${activeTab === 'screening' ? 'active' : ''}`}
                onClick={() => setActiveTab('screening')}
              >
                <span className="tab-icon" aria-hidden="true">▣</span>
                <span>Sàng lọc</span>
              </button>

              <button
                type="button"
                role="tab"
                className="tab-link tab-link-disabled"
                disabled
                title="Tính năng đang được phát triển — không khả dụng"
                style={{ opacity: 0.55, cursor: 'not-allowed' }}
              >
                <span>Mô phỏng lác lé</span>
                <span style={{ fontSize: '0.68rem', background: 'rgba(255, 255, 255, 0.15)', padding: '2px 6px', borderRadius: '9999px', marginLeft: '6px' }}>Đang làm</span>
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
            RemiCare AI &bull; Digital Binocular Vision Screening
          </p>
        </div>
      </footer>
    </div>
  );
}


