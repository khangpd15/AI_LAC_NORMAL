import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import HomePage from './components/home/HomePage';
import BinocularVisionScreening from './components/binocular/BinocularVisionScreening';
import ExperienceVisionPage from './components/ExperienceVision/ExperienceVisionPage';
import StrabismusSimulationPage from './components/StrabismusSimulation/StrabismusSimulationPage';
import AboutPage from './components/about/AboutPage';
import ScreeningHubPage from './features/screening/hub/ScreeningHubPage';
import PtosisScreeningPage from './features/screening/ptosis/PtosisScreeningPage';
import OfflinePage from './components/common/OfflinePage';
import PwaManager from './components/common/PwaManager';
import AppNavbar from './components/common/AppNavbar';
import AppFooter from './components/common/AppFooter';
import ErrorBoundary from './components/ErrorBoundary';
import { ListeningProvider } from './components/audio/ListeningExperience';
import './redesign.css';
import './sitePhotos.css';
import './mobile.css';

/**
 * RemiCare Master Layout Wrapper cho các trang Sàng lọc
 * Bao gồm AppNavbar, container nội dung chính và AppFooter
 */
function ScreeningLayout({ children, activeTab = 'screening' }) {
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <AppNavbar
        activeTab={activeTab}
        onNavigateHome={() => navigate('/')}
        onSelectTab={(tab) => {
          if (tab === 'home') navigate('/');
          else if (tab === 'experience') navigate('/trai-nghiem');
          else if (tab === 'simulation') navigate('/mo-phong');
          else if (tab === 'screening') navigate('/sang-loc');
          else if (tab === 'about') navigate('/gioi-thieu');
        }}
      />
      <main className="app-main" id="main-content">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      <AppFooter
        onNavigateHome={() => navigate('/')}
        onStartExperience={() => navigate('/trai-nghiem')}
        onStartScreening={() => navigate('/sang-loc')}
        onStartSimulation={() => navigate('/mo-phong')}
        onOpenAbout={() => navigate('/gioi-thieu')}
      />
    </div>
  );
}

/**
 * ScrollToTop Component — Tự động cuộn lên đầu trang khi thay đổi URL
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * Main Application Routing Container
 */
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ListeningProvider key={location.pathname}>
      <ScrollToTop />
      <Routes>
        {/* 1. Trang chủ */}
        <Route
          path="/"
          element={
            <ErrorBoundary>
              <HomePage
                onStartExperience={() => navigate('/trai-nghiem')}
                onStartScreening={() => navigate('/sang-loc')}
                onStartSimulation={() => navigate('/mo-phong')}
                onOpenAbout={() => navigate('/gioi-thieu')}
              />
            </ErrorBoundary>
          }
        />

        {/* 2. Trải nghiệm góc nhìn thị giác (Fullscreen) */}
        <Route
          path="/trai-nghiem"
          element={
            <ErrorBoundary>
              <ExperienceVisionPage
                onStartScreening={() => navigate('/sang-loc')}
                onExit={() => navigate('/')}
              />
            </ErrorBoundary>
          }
        />

        {/* 3. Mô phỏng lác lé bằng AI Webcam (Fullscreen) */}
        <Route
          path="/mo-phong"
          element={
            <ErrorBoundary>
              <StrabismusSimulationPage
                onExit={() => navigate('/')}
                onStartScreening={() => navigate('/sang-loc')}
              />
            </ErrorBoundary>
          }
        />

        {/* 4. Giới thiệu RemiCare AI */}
        <Route
          path="/gioi-thieu"
          element={
            <ErrorBoundary>
              <AboutPage
                onNavigateHome={() => navigate('/')}
                onStartExperience={() => navigate('/trai-nghiem')}
                onStartScreening={() => navigate('/sang-loc')}
                onStartSimulation={() => navigate('/mo-phong')}
              />
            </ErrorBoundary>
          }
        />

        {/* 5. Trung tâm Sàng lọc (Hub tổng quan - Lựa chọn 4.3) */}
        <Route
          path="/sang-loc"
          element={
            <ScreeningLayout activeTab="screening">
              <ScreeningHubPage />
            </ScreeningLayout>
          }
        />

        {/* 6. Sàng lọc Lác / Lé (Hirschberg & Digital Cover Test) */}
        <Route
          path="/sang-loc/lac-le"
          element={
            <ScreeningLayout activeTab="screening">
              <BinocularVisionScreening />
            </ScreeningLayout>
          }
        />

        {/* 7. Sàng lọc Sụp mí (PtosisCheck MRD-1 & Khe mi) */}
        <Route
          path="/sang-loc/sup-mi"
          element={
            <ScreeningLayout activeTab="screening">
              <PtosisScreeningPage />
            </ScreeningLayout>
          }
        />

        {/* 8. Trang Ngoại tuyến Offline Fallback */}
        <Route
          path="/offline"
          element={
            <ScreeningLayout activeTab="home">
              <OfflinePage />
            </ScreeningLayout>
          }
        />

        {/* 9. Redirects tương thích các đường dẫn alias / cũ */}
        <Route path="/experience" element={<Navigate to="/trai-nghiem" replace />} />
        <Route path="/simulation" element={<Navigate to="/mo-phong" replace />} />
        <Route path="/about" element={<Navigate to="/gioi-thieu" replace />} />

        {/* 10. Catch-all: Điều hướng về Trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PwaManager />
    </ListeningProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
